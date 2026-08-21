'use strict';

// ── Gantt module aliases (Phase 0 transition: keeps existing code working) ──
var STATUS_KEYWORDS = window.MA.modules.gantt.STATUS_KEYWORDS;
var DATE_RE = window.MA.modules.gantt.DATE_RE;
var DURATION_RE = window.MA.modules.gantt.DURATION_RE;
var parseGantt = window.MA.modules.gantt.parseGantt;
var parseTaskLine = window.MA.modules.gantt.parseTaskLine;
var rebuildTaskMeta = window.MA.modules.gantt.rebuildTaskMeta;
var updateTaskDates = window.MA.modules.gantt.updateTaskDates;
var updateTaskField = window.MA.modules.gantt.updateTaskField;
var addTask = window.MA.modules.gantt.addTask;
var deleteTask = window.MA.modules.gantt.deleteTask;
var sanitizeAfterDependencies = window.MA.modules.gantt.sanitizeAfterDependencies;
var addSection = window.MA.modules.gantt.addSection;
var deleteSection = window.MA.modules.gantt.deleteSection;
var updateGlobalSetting = window.MA.modules.gantt.updateGlobalSetting;
var moveTaskWithinSection = window.MA.modules.gantt.moveTaskWithinSection;
var moveTaskToSection = window.MA.modules.gantt.moveTaskToSection;
var calibrateScale = window.MA.modules.gantt.calibrateScale;
var pxToDate = window.MA.modules.gantt.pxToDate;
var dateToPx = window.MA.modules.gantt.dateToPx;
function isDate(s) { return DATE_RE.test(s); }
function isDuration(s) { return DURATION_RE.test(s); }
function isAfter(s) { return typeof s === 'string' && s.indexOf('after ') === 0; }

// ── PLACEHOLDER (do not remove — keeps grep/diff readable) ────────────────
// The following pure functions have been moved to src/modules/gantt.js:
// parseGantt, parseTaskLine, rebuildTaskMeta, updateTaskDates, updateTaskField,
// addTask, deleteTask, sanitizeAfterDependencies, addSection, deleteSection,
// updateGlobalSetting, moveTaskWithinSection, moveTaskToSection,
// calibrateScale, pxToDate, dateToPx
// The calibration var is now owned by the gantt module (getCalibration()).

function rebuildOverlay() {
  if (!currentModule || !overlayEl) return;
  var svgEl = previewSvgEl ? previewSvgEl.querySelector('svg') : null;
  if (svgEl) {
    // 図種による場合分けは不要になった。gantt も他の20図種と同じ 3引数契約。
    currentModule.buildOverlay(svgEl, parsed, overlayEl);
  }
}

// ── Property Panel Helpers ────────────────────────────────────────────────
// (moved to src/ui/properties.js — bindTextField / bindDateField)

// ── Drag State ────────────────────────────────────────────────────────────
var dragState = null;
// 直近のドラッグ拒否理由。ステータスバーに出し、次の描画で消える。
var dragBlockedMsg = '';
// Sequence-specific drag state (participant reorder via gap drop).
// Kept separate from the Gantt date-drag state above since the two handlers
// run on the same overlay element but track fundamentally different motion.
var seqDragState = null;
// Timestamp of the last drag-end, used to suppress the synthetic click that
// follows a real drag. See PlantUMLAssist: direct-manipulation-ux-checklist
// 観点 C ("click が drag の残響で発火して popup が暴発する" の対策).
var seqJustDraggedAt = 0;
var SEQ_DRAG_CLICK_SUPPRESS_MS = 300;
// 連続したタイプを1つの undo にまとめる窓。手が止まったら次のまとまりになる。
var EDITOR_UNDO_COALESCE_MS = 600;

// ── Application State ──────────────────────────────────────────────────────
var mmdText = '';
var parsed = { title: '', dateFormat: 'YYYY-MM-DD', axisFormat: '', sections: [], tasks: [] };
var sel = [];
var zoom = 1.0;
var suppressSync = false;
var debounceTimer = null;
var DRAG_RENDER_INTERVAL = 100; // ms between mermaid re-renders during drag
var dragRenderTimer = null;
var renderCounter = 0;
var clipboard = null;
var addCounter = 0;

// Set when the document is replaced by a different diagram type, so the next
// render fits the new drawing to the pane instead of inheriting the old zoom.
var pendingAutoFit = false;

// Every value a selection could legitimately point at, taken from the parse.
//
// Modules disagree about which field carries the identity: most use `id`, but a
// gantt section is selected by its `name` and has no `id` at all. Collecting
// both is what lets one guard serve every diagram type without a per-module
// list that would drift.
function knownSelectionIds(parsedData) {
  var out = {};
  if (!parsedData) return out;
  Object.keys(parsedData).forEach(function(key) {
    var arr = parsedData[key];
    if (!Array.isArray(arr)) return;
    arr.forEach(function(x) {
      if (!x) return;
      if (x.id !== undefined && x.id !== null) out[String(x.id)] = true;
      if (x.name !== undefined && x.name !== null) out[String(x.name)] = true;
    });
  });
  return out;
}

// Drop selections that no longer point at anything.
//
// Deleting the selected task from the editor left the selection on its id, so
// the properties panel sat on 「タスクが見つかりません」 and stayed there — the
// user had removed the row and the panel kept reporting an error about it.
// Renaming the selected element did the same: the selection still named the old
// id, so editing your own rename cost you the panel.
//
// Guarded on a non-empty id set: if a module's parse yields nothing we know
// about, clearing every selection would be worse than leaving it alone.
function pruneStaleSelection(parsedData) {
  var current = window.MA.selection.getSelected();
  if (!current.length) return;
  var known = knownSelectionIds(parsedData);
  if (!Object.keys(known).length) return;
  var kept = current.filter(function(s) { return known[String(s.id)]; });
  if (kept.length === current.length) return;
  // setSelected fires onChange → renderProps + rebuildOverlay. Calling it from
  // inside refresh() is safe because it does not schedule another refresh.
  window.MA.selection.setSelected(kept);
}

// Add-form state, held outside the DOM.
//
// renderProps rebuilds the panel with innerHTML on every keystroke in the editor
// and on every selection change, and the date fields were hardcoded
// (value="2026-04-01" / "2026-04-15"). A date the user typed for a parallel
// task was overwritten by the next refresh, so "adjust the date only when the
// work is parallel" was not a workflow the panel could support.
//
// Cleared on a successful add and on a diagram-type switch, nowhere else.

// Which field to focus after the panel is rebuilt, so a continuous run of adds
// does not need a click between each one.

// The section the add form should be pointing at. Falls back to the first
// section when the remembered one no longer exists (the user deleted it), and to
// -1 when there are no sections at all.
var modules = {};
var currentModule = null;

// Register all window.MA.modules into local modules dict, keyed by module.type
// (gantt is defined inline below; sequence and future modules come from window.MA.modules)
// We key by .type so that the diagram-type select value (which matches .type) works directly.
function _registerWindowModules() {
  var mm = window.MA.modules || {};
  var keys = Object.keys(mm);
  for (var _i = 0; _i < keys.length; _i++) {
    var _mod = mm[keys[_i]];
    var _key = (_mod && _mod.type) ? _mod.type : keys[_i];
    if (!modules[_key]) {
      modules[_key] = _mod;
    } else {
      // Fill in any methods missing on the inline definition from the external module
      for (var _prop in _mod) {
        if (Object.prototype.hasOwnProperty.call(_mod, _prop) && !(_prop in modules[_key])) {
          modules[_key][_prop] = _mod[_prop];
        }
      }
    }
  }
}

// ── DOM References ─────────────────────────────────────────────────────────
var editorEl, lineNumEl, previewSvgEl, overlayEl, propsEl;
var statusParseEl, statusInfoEl, zoomDisplayEl;

// ── DiagramModule: Gantt ───────────────────────────────────────────────────
modules.gantt = {
  type: 'gantt',
  detect: function(text) { return text.trim().startsWith('gantt'); },
  parse: parseGantt,
  // buildOverlay は gantt.js へ移した (M2 / ADR-012 の 3引数契約)。
  // ここに残していたのは app.js のクロージャ変数 overlayEl を見ていたからで、
  // 引数で受ける形に揃えたことで依存が消えた。
  buildOverlay: window.MA.modules.gantt.buildOverlay,
  // renderProps は gantt.js へ移した (M2 / ADR-012 の 4引数契約)。
  renderProps: window.MA.modules.gantt.renderProps,
};

// Register window.MA.modules (sequence, etc.) into local modules dict
_registerWindowModules();

// ── Line Numbers ───────────────────────────────────────────────────────────
function syncLineNumbers() {
  if (!editorEl || !lineNumEl) return;
  var lineCount = editorEl.value.split('\n').length;
  var nums = [];
  for (var i = 1; i <= lineCount; i++) nums.push(i);
  lineNumEl.textContent = nums.join('\n');
  // Sync scroll position
  lineNumEl.scrollTop = editorEl.scrollTop;
}

// ── Module Detection ───────────────────────────────────────────────────────
function detectModule(text) {
  var keys = Object.keys(modules);
  for (var i = 0; i < keys.length; i++) {
    if (modules[keys[i]].detect(text)) return modules[keys[i]];
  }
  return null;
}

// ── Refresh Pipeline ───────────────────────────────────────────────────────
// 描き直しを1フレームに合流させるだけでは足りない。
//
// requestAnimationFrame は**同じフレームの中**しかまとめない。人が打つ速さ
// (毎秒5文字 = 200ms 間隔) だと1打鍵ごとに1回描き直す。実測 (1366x768):
//
//   要素   10文字打つ間に固まった合計   1打鍵あたり
//     10                        0ms          0ms
//     50                      797ms         80ms
//    200                     4988ms        500ms
//    400                    14718ms       1470ms
//
// 400要素の図に10文字打つと、**合計 14.7秒 画面が固まる**。
//
// 一定時間を待つ形にする。待ち時間は**前回の描き直しに実際かかった時間**から
// 決める。小さい図は今までどおり即座に (1フレーム)、重い図は打ち終わるまで
// 待つ。固定値にすると、軽い図で無駄に遅くなるか、重い図で効かないかの
// どちらかになる (150ms 固定では 200ms 間隔の打鍵に対して1回も合流しない)。
var lastRenderMs = 0;
var debounceTimeout = null;

function refreshDelay() {
  if (lastRenderMs <= 150) return 0;              // 軽い図はそのまま
  return Math.min(Math.round(lastRenderMs), 800); // 重い図は前回かかった分だけ待つ
}

function scheduleRefresh() {
  cancelAnimationFrame(debounceTimer);
  if (debounceTimeout) { clearTimeout(debounceTimeout); debounceTimeout = null; }
  var wait = refreshDelay();
  if (wait === 0) {
    debounceTimer = requestAnimationFrame(function() { refresh(); });
    return;
  }
  // 待っている間に「読み取りと状態表示だけ先に」追いつかせることも試したが、
  // **それ自体が重かった**。実測 (400要素、200ms 間隔で10文字):
  //
  //   描き直しだけ待つ            固まった合計 14718ms → 1460ms
  //   + 軽い側を毎回先に走らせる                    → 22194ms (悪化)
  //
  // 軽いはずの `refresh(true)` は一覧を作り直す。400要素だと 799行の DOM を
  // 毎回組み直すので **1打鍵あたり約850ms** かかっていた。
  // 一覧に仮想化が無いという UI-022 と同じ根で、そちらが片付くまでは
  // まとめて待つ方が速い。状態表示が最大 800ms 遅れるのは承知の上。
  debounceTimeout = setTimeout(function() {
    debounceTimeout = null;
    debounceTimer = requestAnimationFrame(function() { refresh(); });
  }, wait);
}

async function refresh(skipRender) {
  if (!previewSvgEl) return;

  var thisRender = ++renderCounter;

  // Detect diagram module
  currentModule = detectModule(mmdText);

  // Sync diagram-type select to reflect current diagram type
  var _dtSelect = document.getElementById('diagram-type');
  if (_dtSelect && currentModule) {
    if (_dtSelect.value !== currentModule.type) _dtSelect.value = currentModule.type;
  }

  // Parse (always — it's fast)
  if (currentModule) {
    try {
      parsed = currentModule.parse(mmdText);
    } catch (e) {
      parsed = { title: '', dateFormat: 'YYYY-MM-DD', axisFormat: '', sections: [], tasks: [] };
    }
    pruneStaleSelection(parsed);
  }

  // During drag: update parse/status/props only, skip expensive mermaid render
  if (skipRender) {
    renderProps();
    renderStatus();
    syncLineNumbers();
    return;
  }

  // Rebuild the whole mermaid config before every render. In detail mode the
  // gantt width follows the project span, so it changes with each edit — and
  // because initialize() replaces rather than merges, this has to be the single
  // place that calls it.
  applyMermaidConfig(parsed);

  // 大きい図は mermaid の描画がメインスレッドを塞ぐ。
  //
  // 実測 (1366x768, flowchart): 200要素で 2.1秒、500要素で 3.8秒、600要素で 3.2秒。
  // **その間 100ms 間隔のポーリングが1度もサンプルを取れない** = 画面が一切
  // 更新されない。ステータスは前の値のまま、進行を示すものは何も出ていなかった。
  // 押した操作が効いているのか固まったのかが区別できない。
  //
  // 描画を始める前に「描画中…」を出し、**ブラウザに実際に描かせてから**
  // 重い処理へ入る。await だけではマイクロタスクしか回らず塗り替えは起きないので、
  // requestAnimationFrame の後にもう一度キューへ戻す。
  //
  // 小さい図で毎打鍵ちらつくと逆に邪魔なので、実測で1秒を超え始める大きさ
  // (300行) からにする。
  var heavy = mmdText.length > 6000 || mmdText.split('\n').length > 300;
  if (heavy && statusParseEl) {
    statusParseEl.textContent = '描画中…';
    statusParseEl.classList.remove('error');
    if (previewSvgEl) previewSvgEl.setAttribute('aria-busy', 'true');
    await new Promise(function(res) {
      requestAnimationFrame(function() { setTimeout(res, 0); });
    });
    if (thisRender !== renderCounter) return;   // 追い越されたら捨てる
  }

  // Render via mermaid.js
  var svgId = 'mermaid-svg-' + thisRender;
  var renderStartedAt = (window.performance && performance.now) ? performance.now() : Date.now();
  try {
    var renderResult = await mermaid.render(svgId, mmdText);
    lastRenderMs = ((window.performance && performance.now) ? performance.now() : Date.now()) - renderStartedAt;
    if (previewSvgEl) previewSvgEl.removeAttribute('aria-busy');
    // Guard: if a newer render was started, discard this result
    if (thisRender !== renderCounter) return;

    // 描き上がりが本物か確かめる。
    //
    // 上限を上げてもさらに超える場合がある。mermaid はそのときも例外を投げず
    // プレースホルダーを返すので、こちらで見分けないと「保存したつもりで空同然の
    // 画像を受け取る」ことになる。間違った成果物が黙って出るのが一番悪い。
    if (window.MA.diagnose && window.MA.diagnose.isOversizePlaceholder(renderResult.svg)) {
      throw new Error('本文が長すぎて mermaid が図を描けません (' +
        mmdText.length.toLocaleString() + ' 文字)。図を分割してください。');
    }

    previewSvgEl.innerHTML = renderResult.svg;
    previewStale = false;

    var svgEl = previewSvgEl.querySelector('svg');
    if (svgEl) {
      // ── Fix mermaid.js SVG sizing ──
      // mermaid.js outputs width="100%" + max-width inline style.
      // This causes the SVG to collapse inside an inline-block parent.
      // Fix: set explicit pixel dimensions from the viewBox.
      var vb = svgEl.viewBox.baseVal;
      var naturalW = vb.width || 800;
      var naturalH = vb.height || 400;

      // Remove all mermaid inline styles (max-width, width:100%, etc.)
      svgEl.removeAttribute('style');
      // Set to natural pixel dimensions from viewBox
      svgEl.setAttribute('width', naturalW);
      svgEl.setAttribute('height', naturalH);

      // Sync overlay to same natural dimensions and viewBox
      if (overlayEl) {
        overlayEl.setAttribute('width', naturalW);
        overlayEl.setAttribute('height', naturalH);
        overlayEl.setAttribute('viewBox', svgEl.getAttribute('viewBox'));
      }

      // Fit the drawing to the container on the first render, and again whenever
      // the document is replaced (diagram-type switch, file open).
      //
      // Two separate reasons, both measured on a 1400px window:
      //
      // - Without the "document replaced" case the previous diagram's zoom
      //   carried over, and natural sizes differ by more than an order of
      //   magnitude: after switching away from the startup gantt, stateDiagram
      //   came out 51px wide in a 750px pane while timeline overflowed at 1190px.
      // - gantt must not be scaled at all. Shrinking the drawing is exactly what
      //   overview mode exists to avoid: the startup chart came up at 68% via a
      //   CSS transform, putting the axis labels on screen at 6.8px. Overview
      //   mode reaches the same fit by redrawing at the container width, so the
      //   labels keep their real size.
      if ((thisRender === 1 || pendingAutoFit) && currentModule && currentModule.type === 'gantt') {
        pendingAutoFit = false;
        zoom = 1.0;
        updateZoomLabel();
      } else if (thisRender === 1 || pendingAutoFit) {
        pendingAutoFit = false;
        var previewContainer = document.getElementById('preview-container');
        var containerW = previewContainer.clientWidth - 32;
        var containerH = previewContainer.clientHeight - 32;
        // Both axes. Width alone blew up tall diagrams: a flowchart TD is narrow
        // and long, so fitting its width scaled it to 294% and pushed the last
        // node off the bottom of the pane — "fit" that needs scrolling to read.
        var fitZoom = Math.min(containerW / naturalW,
          containerH > 0 ? containerH / naturalH : Infinity);
        fitZoom = Math.max(0.25, Math.min(3.0, fitZoom));
        zoom = Math.round(fitZoom * 100) / 100;
      }
    }

    // Apply zoom via CSS transform on wrapper (both SVG and overlay)
    previewSvgEl.style.transform = 'scale(' + zoom + ')';
    previewSvgEl.style.transformOrigin = 'top left';
    if (overlayEl) {
      overlayEl.style.transform = 'scale(' + zoom + ')';
      overlayEl.style.transformOrigin = 'top left';
    }
    updateZoomLabel();

    // Build overlay (skip during drag to prevent jitter)
    if (currentModule && svgEl && !dragState) {
      // 図種による場合分けは不要 (gantt も 3引数契約に揃えた)
      currentModule.buildOverlay(svgEl, parsed, overlayEl);
    }

    statusParseEl.textContent = 'OK';
    statusParseEl.classList.remove('error');

    // 描けたのに一部が落ちている場合を黙って通さない。
    //
    // mermaid は必ず例外を投げるとは限らない。kanban の列名に括弧を入れると
    // parse は通り、図も出るが、括弧の中だけが消える。journey の section 名に
    // # を入れると以降が無かったことになる。利用者から見ると「入れたはずの文字が
    // 図に無い」だけで、原因を突き止める手掛かりがどこにも出ていなかった。
    // 失敗したときだけ原因を言うのでは足りない (R11 特殊文字)。
    var warn = window.MA.diagnose ? window.MA.diagnose.diagnose(mmdText, null) : '';
    if (warn) showRenderWarningBanner(warn);
    else hideParseErrorBanner();
  } catch (e) {
    if (thisRender !== renderCounter) return;
    // mermaid のエラーは字句解析器の言葉なので、原因が分かる場合は先に日本語で言う。
    // 「Lexer error on line 3, column 25」だけ見せられても、自分の入力のどの文字が
    // 悪いのかは分からない (R11 特殊文字)。
    var cause = window.MA.diagnose ? window.MA.diagnose.diagnose(mmdText, e) : '';
    // 幅を明示して折り返す。
    //
    // このコンテナは図の大きさに合わせて広がるので、既定のままだと本文は
    // 見えているペインの幅ではなく**キャンバスの幅**で折り返す。結果、一行が
    // ペインの右端で切れ、肝心の「どの文字が該当するか」が読めない。
    // 元からある Render error の行も同じ理由で切れていた (実機で確認)。
    // 直前に描けていた図は残す。
    //
    // 以前は失敗のたびにプレビューを赤いエラーテキストで置き換えていた。構文を
    // 打っている途中は必ず一時的に不正になるので、`section` と打つだけで図が消える。
    // 「テキストを直すと図がどう変わるか」を見ながら書くという3ペインUIの目的が
    // 成り立たなくなっていた。参照したい図が消えるので、結局エディタだけ見て打つことになる。
    //
    // 図が既に出ているなら、そのままにしてステータスと小さな帯だけでエラーを伝える。
    previewStale = true;
    if (previewSvgEl) previewSvgEl.removeAttribute('aria-busy');
    var hadDiagram = !!previewSvgEl.querySelector('svg');
    if (hadDiagram) {
      statusParseEl.textContent = 'Error';
      statusParseEl.classList.add('error');
      showParseErrorBanner(e);
      renderProps();
      renderStatus();
      return;
    }

    // 拡大率を一旦外す。このコンテナには scale(zoom) がかかっているので、
    // 124% のまま文章を出すと文字も 124% になり、指定した幅で折り返しても
    // ペインからはみ出す。図に戻れば次の描画で scale は付け直される。
    previewSvgEl.style.transform = 'none';
    previewSvgEl.innerHTML =
      '<div style="max-width:680px;padding:16px;overflow-wrap:anywhere;white-space:normal;">' +
        (cause ? '<p style="color:var(--accent-red);margin:0 0 12px 0;font-size:13px;line-height:1.6;">' +
          window.MA.htmlUtils.escHtml(cause) + '</p>' : '') +
        '<p style="color:var(--accent-red);margin:0;font-family:var(--font-mono);font-size:12px;line-height:1.5;">Render error:<br>' +
          String(e).replace(/</g, '&lt;') + '</p>' +
      '</div>';
    statusParseEl.textContent = 'Error';
    statusParseEl.classList.add('error');
  }

  renderProps();
  renderStatus();
  syncLineNumbers();
}

// ── Status Bar ─────────────────────────────────────────────────────────────

// The status bar only ever spoke gantt. Every other diagram type produces a
// parse result with no `tasks` array, so the bar fell into the empty branch and
// announced「タスク: 0 | プロパティパネルからタスクを追加してください」while the
// user was looking at a flowchart with thirty nodes. It was not just useless
// there, it was wrong.
//
// Kept as a pure function so the wording is testable without a DOM.
function statusInfoText(parsedData, moduleType) {
  if (!parsedData) return '';
  if (moduleType === 'gantt' || (parsedData.tasks && parsedData.tasks.length > 0)) {
    return ganttStatusText(parsedData);
  }
  var parts = [];
  var els = parsedData.elements ? parsedData.elements.length : 0;
  var rels = parsedData.relations ? parsedData.relations.length : 0;
  var groups = parsedData.groups ? parsedData.groups.length : 0;
  parts.push('要素: ' + els);
  if (rels > 0 || els > 0) parts.push('関連: ' + rels);
  if (groups > 0) parts.push('グループ: ' + groups);
  if (parsedData.meta && parsedData.meta.title) parts.push(parsedData.meta.title);
  if (els === 0 && rels === 0) return '要素: 0 | プロパティパネルから追加してください';
  return parts.join(' | ');
}

function ganttStatusText(parsedData) {
  var tasks = parsedData.tasks || [];
  if (tasks.length === 0) return 'タスク: 0 | プロパティパネルからタスクを追加してください';
  var info = 'タスク: ' + tasks.length;
  if (parsedData.sections && parsedData.sections.length > 0) {
    info += ' | セクション: ' + parsedData.sections.length;
  }
  var dates = tasks.filter(function(t) { return t.startDate; }).map(function(t) { return t.startDate; });
  var endDates = tasks.filter(function(t) { return t.endDate && DATE_RE.test(t.endDate); })
    .map(function(t) { return t.endDate; });
  var allDates = dates.concat(endDates).sort();
  if (allDates.length >= 2) {
    info += ' | 期間: ' + allDates[0] + ' ~ ' + allDates[allDates.length - 1];
  }
  return info;
}

// 一時メッセージ。
//
// 「保存できたのか」「いま何が消えたのか」を画面が何も言っていなかった。
// 行を増やさずに済ませたいので、既存のステータス行を数秒だけ borrow する
// (dragBlockedMsg が同じ枠を使っているのと同じやり方)。
// いまプレビューに出ている図が、今の本文のものではないことを覚えておく。
// 描画失敗時に直前の図を残すようにしたので、そのまま書き出すと
// **編集していない内容**が成果物になる。図を残す判断自体は正しいので、
// Export 側に「古い」という情報を伝える。
var previewStale = false;

var transientMsg = '';
var transientUntil = 0;
var transientTimer = null;
// 「あと何回戻せるか」を数字で出す。工具列のボタンは目に入らない位置にある。
function showUndoDepth(head) {
  var h = window.MA.history;
  if (!h || typeof h.undoDepth !== 'function') return;
  showTransient(head + ' — 戻せる: ' + h.undoDepth() + ' / やり直せる: ' + h.redoDepth(), 2500);
}

function showTransient(msg, ms) {
  transientMsg = msg;
  transientUntil = Date.now() + (ms || 4000);
  if (transientTimer) clearTimeout(transientTimer);
  transientTimer = setTimeout(function() { transientMsg = ''; renderStatus(); }, ms || 4000);
  renderStatus();
}
// ショートカット一覧の開閉。Escape でも閉じられる (閉じ方を探させない)。
// 入力欄を抜けたときにフォーカスがどこにも残らないと、「いまどこにいるか」が
// 画面から消える。矢印キーでの巡回は動くので実害は小さいが、戻し先を決めておく。
// 選んでいる要素を契約経由で消す。
//
// 図種ごとの分岐は持たない。`operations.delete(text, lineNum, opts)` は
// ADR-012 で全21図種が持つ約束になっているので、それだけを使う。
//
// 1件ずつ消すたびに現在の本文を parse し直すのは、削除で行番号がずれるため。
// 最初に取った行番号を使い回すと、2件目以降は無関係の行を消す。
// 逆に「毎回エディタから読み直す」形にすると、途中の結果を捨てて最後の1件しか
// 残らない (過去に e2e でだけ捕まえた形)。本文は変数で明示的に持ち回す。
function deleteSelectedElements(sel) {
  if (!currentModule || !currentModule.operations ||
      typeof currentModule.operations.delete !== 'function') {
    showTransient('この図種は削除に対応していません', 3000);
    return;
  }
  var text = mmdText;
  var removed = 0;
  sel.forEach(function(s) {
    var p;
    try { p = currentModule.parse(text); } catch (e) { return; }
    var target = null;
    var els = p.elements || [];
    for (var i = 0; i < els.length; i++) { if (els[i].id === s.id) { target = els[i]; break; } }
    if (!target) {
      var rels = p.relations || [];
      for (var j = 0; j < rels.length; j++) { if (rels[j].id === s.id) { target = rels[j]; break; } }
    }
    if (!target) return;
    var next = currentModule.operations['delete'](text, target.line, {
      kind: target.kind || s.type, id: target.id, blockId: target.id, name: target.name,
    });
    if (next && next !== text) { text = next; removed++; }
  });
  if (!removed) {
    showTransient('選んでいる要素を消せませんでした', 3000);
    return;
  }
  // 実際に消えた数を数える。
  //
  // 選んだ数をそのまま言うと過少申告になる。flowchart のノードを1つ消すと
  // それに繋がるエッジも消えるので、一覧の ✕ は「✕3」と波及数を出している
  // (tooltip に「1 ノード / 2 エッジが消えます」)。キーボードで消したときだけ
  // 「1件削除」と出るのでは、同じ操作の結果が経路によって違う数に見える。
  var msg = deletedMessage(removed);
  try {
    var b0 = currentModule.parse(mmdText);
    var a0 = currentModule.parse(text);
    var dEl = ((b0.elements || []).length) - ((a0.elements || []).length);
    var dRel = ((b0.relations || []).length) - ((a0.relations || []).length);
    if (dEl > 0 && dRel > 0) msg = dEl + '件と関連 ' + dRel + '件を削除 — Ctrl+Z で戻せます';
    else if (dEl > 0) msg = deletedMessage(dEl);
    else if (dRel > 0) msg = '関連 ' + dRel + '件を削除 — Ctrl+Z で戻せます';
  } catch (e) { /* 数えられなければ選んだ数のまま言う */ }
  window.MA.history.pushHistory();
  mmdText = text;
  suppressSync = true;
  editorEl.value = mmdText;
  suppressSync = false;
  window.MA.selection.setSelected([]);
  syncLineNumbers();
  // 削除に確認を出さないのは Undo で戻せるからだが、戻せることを示して
  // いるのはツールバーの Undo だけで、視線は図の上にある。消したその場で言う。
  showTransient(msg);
  scheduleRefresh();
}

// プロパティパネルに続きがあるかを見て、帯の出し入れをする。
//
// 13インチのノートPC (1366x768) では 21図種中15図種でパネルが画面に収まらない
// (flowchart は 320px はみ出す)。スクロールバーは実測で幅0だったので、
// **続きがあることを示すものが画面に1つも無かった**。
//
// 一番下まで見えているときは出さない。常に出すと「まだ下がある」の合図が
// 意味を失い、無視されるようになる。
function updatePropsOverflowHint() {
  var el = document.getElementById('props-content');
  var hint = document.getElementById('props-more');
  if (!el || !hint) return;
  var more = el.scrollHeight - el.clientHeight - el.scrollTop;
  hint.hidden = more <= 4;   // 端数の丸めで1〜2px残ることがある
}

// 追加フォームの先頭欄へ飛ぶ。
//
// 追加は一番よく使う操作なのに、欄へ入る手段がマウスのクリックしか無かった。
// Enter での確定は既にできるので、**入口の1クリックだけ**がキーボード完結を
// 止めていた。1日100回足すなら100往復。
//
// 欄の id は図種ごとに違う (`fc-add-node-id` / `prop-add-label` / `kb-add-col-name`)
// ので名前の表は持たない。「add を含む id を持つ、最初の入力欄」で選ぶ。
function focusAddForm() {
  var el = document.querySelector(
    '#props-content input[id*="add"], #props-content select[id*="add"], #props-content textarea[id*="add"]');
  if (!el) {
    showTransient('この図種には追加フォームがありません', 2500);
    return;
  }
  el.focus();
  if (el.select) el.select();
}

// エディタへ戻る。
// プレビューへ戻す focusPreview の逆向きが無く、本文を直すたびにマウスへ持ち替えていた。
function focusEditor() {
  if (editorEl && editorEl.focus) editorEl.focus();
}

function focusPreview() {
  var pane = document.getElementById('preview-pane') || previewSvgEl;
  if (pane && pane.focus) { pane.setAttribute('tabindex', '-1'); pane.focus(); }
}

function toggleShortcutHelp(force) {
  var box = document.getElementById('shortcut-help');
  if (!box) return;
  var show = (force === undefined) ? box.hasAttribute('hidden') : force;
  if (show) box.removeAttribute('hidden');
  else box.setAttribute('hidden', '');
}

function twoDigit(n) { return (n < 10 ? '0' : '') + n; }
function savedMessage(d) {
  return '保存: ' + twoDigit(d.getHours()) + ':' + twoDigit(d.getMinutes());
}
function deletedMessage(n) {
  return n + '件削除 — Ctrl+Z で戻せます';
}

// 描画に失敗したが直前の図が残っているとき用の帯。
// 図を消さずに「いま表示しているのは古い」ことだけを伝える。
function showParseErrorBanner(err) {
  var host = document.getElementById('preview-container') || previewSvgEl.parentElement;
  if (!host) return;
  var el = document.getElementById('parse-error-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'parse-error-banner';
    host.appendChild(el);
  }
  var cause = window.MA.diagnose ? window.MA.diagnose.diagnose(mmdText, err) : '';
  // 原因を名指しできないときに「構文エラー」と断定しない。
  //
  // 実際、500本のエッジ上限に当たったときもこの文言が出ていた。本文に構文誤りは
  // 1つも無いのに構文を疑わせるので、何も言わないより高くつく。
  // 分かっているのは「描けなかった」ことだけなので、そこまでを言う。
  el.textContent = cause || ('図を描けませんでした — 表示しているのは直前に描けた図です');
  el.hidden = false;
}
function hideParseErrorBanner() {
  var el = document.getElementById('parse-error-banner');
  if (el) { el.hidden = true; el.classList.remove('warn'); }
}

// 図は描けているが、入れた文字の一部が落ちているときの帯。
// エラーではないので図はそのまま見せ、原因だけを添える。
function showRenderWarningBanner(cause) {
  var host = document.getElementById('preview-container') || previewSvgEl.parentElement;
  if (!host) return;
  var el = document.getElementById('parse-error-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'parse-error-banner';
    host.appendChild(el);
  }
  el.classList.add('warn');
  el.textContent = '図は描けましたが一部が反映されていません — ' + cause;
  el.hidden = false;
}

// D1: いまどのファイルを触っているかを常に見えるようにする。
//
// 保存名は保存時に4秒だけ出て消えていたので、複数の図を並行して直す運用で
// 「どこに上書きされるか」を確かめる手段がなかった。上書き保存を入れた以上、
// これは安全に関わる情報になる。
function updateDocumentTitle() {
  var name = currentBaseName();
  var dirty = hasUnsavedWork(mmdText, savedText,
    currentModule && currentModule.template ? currentModule.template() : null);
  document.title = (dirty ? '● ' : '') + name + '.mmd — MermaidAssist';
}

function renderStatus() {
  // タイトルはステータス行の中身とは独立なので、早期 return の前に更新する。
  //
  // 以前は関数の末尾で呼んでいたので、一時メッセージが出ている4秒間はそこまで
  // 到達しなかった。保存直後に編集しても未保存マークが付かない。
  // 保存した直後はまさに編集を再開する時間帯なので、一番当たりやすい穴だった。
  if (typeof updateDocumentTitle === 'function') updateDocumentTitle();
  if (!statusInfoEl) return;
  if (transientMsg && Date.now() < transientUntil) {
    statusInfoEl.textContent = transientMsg;
    return;
  }
  // Connection mode changes what the next click means, and nothing on screen
  // said so: after pressing 「ここから線を引く」 the panel and the status bar
  // looked exactly as before, so the mode was invisible until a line appeared
  // somewhere unexpected.
  if (dragBlockedMsg) {
    statusInfoEl.textContent = dragBlockedMsg;
    dragBlockedMsg = '';
    return;
  }
  var conn = window.MA.connectionMode.getSource();
  if (conn) {
    statusInfoEl.textContent = '接続モード: ' + conn.id +
      ' から線を引きます — 相手をクリック (Escape で中止)';
    return;
  }
  statusInfoEl.textContent = statusInfoText(parsed, currentModule && currentModule.type);
}

// ── Properties Panel ───────────────────────────────────────────────────────
//
// パネルは innerHTML の入れ替えで作り直されるので、再描画のたびに入力欄が
// 別物になる。確定 (change) のあとだけ再描画していたころは、利用者が既に欄から
// 離れているので問題にならなかった。打鍵ごとに反映するなら、フォーカスと
// カーソル位置を持ち越さないと**打っている途中で欄から弾き出される**。
function withFocusKept(fn) {
  var a = document.activeElement;
  var keepId = a && a.id && propsEl && propsEl.contains(a) ? a.id : null;
  var start = null, end = null;
  if (keepId && a.setSelectionRange) {
    try { start = a.selectionStart; end = a.selectionEnd; } catch (e) { /* type による */ }
  }
  fn();
  if (!keepId) return;
  // 再描画の中でモジュールが自分でフォーカスを置いた場合は、そちらを優先する。
  // タスク連続入力は「追加ボタンを押したあとラベル欄に戻す」ことで成立しているので、
  // ここで無差別に戻すとその意図を上書きしてしまう (e2e が捕まえた)。
  // 戻すのは、再描画でフォーカスが**失われた**ときだけ。
  var nowFocused = document.activeElement;
  if (nowFocused && nowFocused !== document.body &&
      propsEl && propsEl.contains(nowFocused)) return;
  var back = document.getElementById(keepId);
  if (!back) return;
  back.focus();
  if (start !== null && back.setSelectionRange) {
    try { back.setSelectionRange(start, end); } catch (e) { /* 同上 */ }
  }
}

// 一覧の絞り込み。
//
// 100要素の図で一覧は7.7画面分になり、目的の要素に辿り着く手段が目視の
// スクロールしか無かった。要素数に対して線形に効く唯一の摩擦なので、ここだけは
// 縦に1行増やす価値がある。行が少ないうちは出さない。
var listFilterText = '';
var LIST_FILTER_MIN_ROWS = 12;

// 一覧の絞り込みも文書に紐づく状態。
//
// 前の文書で「ノード1」と絞り込んだまま別の文書を開くと、当てはまる行が
// 1つも無いので **一覧が完全に空に見える** (実測: 20行あって表示0行)。
// 絞り込み欄は残っているが、パネルの一番上にあり、ノートPC では
// スクロールしないと見えない (UI-011)。素直に読むと「要素が無い図」に見える。
//
// R15 (状態の持ち越し) は追加フォームの入力欄しか見ていなかったので
// この状態は網に掛かっていなかった。文書が入れ替わったら捨てる。
function clearListFilter() {
  listFilterText = '';
  var box = document.getElementById('ma-list-filter');
  if (box) box.value = '';
}
function applyListFilter() {
  if (!propsEl) return;
  var rows = propsEl.querySelectorAll('.ma-list-row');
  if (rows.length < LIST_FILTER_MIN_ROWS) return;

  var box = document.getElementById('ma-list-filter');
  if (!box) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:6px;';
    wrap.innerHTML = '<input id="ma-list-filter" type="text" placeholder="一覧を絞り込む (' +
      rows.length + '件)" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);' +
      'color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' +
      '<div id="ma-list-filter-count" hidden style="font-size:10px;margin-top:2px;"></div>';
    propsEl.insertBefore(wrap, propsEl.firstChild);
    box = document.getElementById('ma-list-filter');
    box.value = listFilterText;
    box.addEventListener('input', function() {
      listFilterText = box.value;
      filterRows();
    });
  }
  filterRows();
}

function filterRows() {
  if (!propsEl) return;
  var q = listFilterText.trim().toLowerCase();
  var rows = propsEl.querySelectorAll('.ma-list-row');
  var hit = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!q) { r.style.display = ''; hit++; continue; }
    var idAttr = '';
    var withId = r.querySelector('[data-element-id]');
    if (withId) idAttr = withId.getAttribute('data-element-id') || '';
    var text = (r.textContent || '') + ' ' + idAttr;
    var show = text.toLowerCase().indexOf(q) >= 0;
    r.style.display = show ? '' : 'none';
    if (show) hit++;
  }
  var box = document.getElementById('ma-list-filter');
  if (box) box.placeholder = '一覧を絞り込む (' + rows.length + '件)';
  // 件数は欄の外に出す。
  //
  // 以前は placeholder に書いていたが、**placeholder は値が入ると隠れる**。
  // つまり絞り込んでいるときだけ件数が見えなかった。0件のときに
  // 「一覧が空」と「絞り込みで0件」を見分ける手掛かりが、必要な場面でだけ消えていた。
  var cnt = document.getElementById('ma-list-filter-count');
  if (cnt) {
    if (!q) { cnt.hidden = true; }
    else {
      cnt.hidden = false;
      cnt.textContent = rows.length + '件中 ' + hit + '件が一致' +
        (hit === 0 ? ' — 絞り込みを消すと全部出ます' : '');
      cnt.style.color = hit === 0 ? 'var(--accent-orange)' : 'var(--text-secondary)';
    }
  }
}

// 本文の編集で再描画が起きたのか、パネルの操作で起きたのかを区別する。
//
// パネルは毎回 innerHTML を作り直すので、書きかけの追加フォームは消える。
// 実測: 追加フォームに「WIP」と入れてからエディタに1文字打つと、空になった。
// 打鍵の途中で再描画が挟まると先頭の文字も落ちる (「ae」と打って「e」になった)。
//
// ただし**いつでも復元してよいわけではない**。「+追加」を押した直後の再描画では
// フォームが空になるのが正しく、そこで書き戻すと同じ要素をもう一度足しかねない。
// 引き金で分ける。
var refreshCause = 'other';

// 追加フォームの書きかけを持ち越す。
//
// id に 'add' を含む入力欄だけを対象にする。図種ごとに id は違う
// (`fc-add-node-id` / `prop-add-label` / `kb-add-col-name`) が、接頭辞の表は持たない。
// 図種を切り替えると id ごと入れ替わるので、別の図種へ持ち越されることはない
// (持ち越してはいけない — R15 状態の持ち越し)。
function snapshotAddForm() {
  var snap = {};
  if (!propsEl) return snap;
  var els = propsEl.querySelectorAll('input[id*="add"], textarea[id*="add"]');
  for (var i = 0; i < els.length; i++) {
    if (els[i].type === 'radio' || els[i].type === 'checkbox') continue;
    if (els[i].value) snap[els[i].id] = els[i].value;
  }
  return snap;
}

function restoreAddForm(snap) {
  if (!propsEl) return;
  Object.keys(snap).forEach(function(id) {
    var el = document.getElementById(id);
    // 空のときだけ戻す。モジュールが意図して値を置き直した場合は触らない。
    if (el && propsEl.contains(el) && !el.value) el.value = snap[id];
  });
}

function renderProps() {
  var snap = (refreshCause === 'editor') ? snapshotAddForm() : null;
  withFocusKept(function() {
    renderPropsInner();
    applyListFilter();
  });
  if (snap) restoreAddForm(snap);
  // パネルの中身が入れ替わると高さも変わる。帯の出し入れはここで見る。
  updatePropsOverflowHint();
}

function renderPropsInner() {
  if (!propsEl || !currentModule) return;
  // 図種による場合分けは不要になった。gantt も他の20図種と同じ
  // 4引数契約 (selData, parsedData, propsEl, ctx) で呼ぶ。
  {
    currentModule.renderProps(sel, parsed, propsEl, {
      getMmdText: function() { return mmdText; },
      setMmdText: function(t) {
        mmdText = t;
        suppressSync = true;
        editorEl.value = mmdText;
        suppressSync = false;
        syncLineNumbers();
        // Re-parse synchronously so any subsequent renderProps call (e.g.
        // triggered by setSelected right after) sees the updated structure.
        // Without this, module-level `parsed` stayed stale until the async
        // refresh tick and caused selection look-ups to hit wrong messages
        // (visible as "上下を押すと選択が入れ替わる").
        if (currentModule && currentModule.parse) {
          try { parsed = currentModule.parse(mmdText); } catch (e) { /* leave stale */ }
        }
      },
      onUpdate: function() { refreshCause = 'panel'; scheduleRefresh(); },
      // gantt のパネルは拒否理由をステータスに出すので、その口も渡す。
      // 他のモジュールは使わないが、契約にあって困るものではない。
      showTransient: function(msg, ms) { showTransient(msg, ms); },
    });
  }
}

// ── Zoom ───────────────────────────────────────────────────────────────────
// Any deliberate zoom leaves overview mode. There are six entry points into zoom
// (the two buttons, fit, Ctrl+wheel, init, diagram switch); guarding only the
// buttons left Ctrl+wheel — the primary gesture — stacking a CSS transform on top
// of an already-fitted redraw, which is the double-shrink F4 warned about.
// `setZoomFromUser` is that single guard; `setZoom` stays mechanical so fit and
// init can set a value without changing the mode.
function setZoomFromUser(z) {
  if (currentModule && currentModule.type === 'gantt' && ganttViewMode === 'overview') {
    setGanttViewMode('detail');
    // Step off 100% in the direction asked for, rather than landing on it — the
    // first click after leaving overview should visibly do something.
    setZoom(z > zoom ? 1.1 : 0.9);
    scheduleRefresh();
    return;
  }
  setZoom(z);
}

function setZoom(z) {
  zoom = Math.max(0.25, Math.min(3.0, z));
  updateZoomLabel();

  if (previewSvgEl) {
    previewSvgEl.style.transform = 'scale(' + zoom + ')';
    previewSvgEl.style.transformOrigin = '0 0';
  }
  if (overlayEl) {
    overlayEl.style.transform = 'scale(' + zoom + ')';
    overlayEl.style.transformOrigin = '0 0';
  }
}

// ── Gantt overview / detail mode ───────────────────────────────────────────
// Gantt is the one diagram type mermaid lays out on a fixed-width canvas
// (gantt.useWidth, default 1600) while keeping the font at 11px. Scaling that
// down with CSS to make it fit shrinks the text too, so "fits on screen" and
// "readable" were mutually exclusive. Controlling useWidth instead keeps the
// font fixed and only changes how many pixels a day gets.
var DETAIL_PX_PER_DAY = 24;
// Chrome's maximum canvas dimension is 65,535px; stay clear of it so PNG export
// and clipboard copy keep working on very long projects.
var GANTT_MAX_WIDTH = 60000;
// Gantt starts in overview: the chart is drawn at the container width instead of
// being scaled down to fit, so the labels keep their size on first paint.
var ganttViewMode = 'overview'; // 'detail' | 'overview' 

// The available width for a chart, minus padding and the vertical scrollbar. A
// tall chart makes the scrollbar appear, which would otherwise push the chart
// 6px past the edge and produce a horizontal scrollbar in "overview".
function previewContentWidth() {
  var c = document.getElementById('preview-container');
  if (!c) return 800;
  // clientWidth already excludes the scrollbar, so subtracting it again left a
  // permanent 6px gap. The real hazard is measuring before the render that first
  // introduces the scrollbar; `overflow-y: scroll` on the container removes that
  // by reserving the gutter unconditionally.
  return Math.max(200, c.clientWidth - 32);
}

// Axis granularity has to move with the width: mermaid draws 10-12 ticks
// regardless of how wide the canvas is, so a ten-year chart at 24px/day spaces
// them ~8700px apart and prints every one of them as "01/01".
function ganttAxisFor(days) {
  if (days <= 92) return { tickInterval: '1week', axisFormat: '%m/%d' };
  if (days <= 730) return { tickInterval: '1month', axisFormat: '%Y/%m' };
  return { tickInterval: '3month', axisFormat: '%Y/%m' };
}

function ganttSpanDays(parsedData) {
  // Resolving `after` references and durations is the module's job — reading the
  // raw startDate/endDate tokens here made the most ordinary gantt (a chain of
  // `after X, Nd`) look like a single day.
  var r = window.MA.modules.gantt.resolveSpan(parsedData);
  return r ? r.days : 0;
}

// mermaid.initialize replaces the config rather than merging into it: passing
// only {gantt:{...}} silently resets theme to default and securityLevel to
// strict. Every call goes through here so the full object is always supplied,
// and the mode lives in ganttViewMode rather than in mermaid's config — config
// is derived state, so another initialize() elsewhere cannot lose it.
function applyMermaidConfig(parsedData) {
  // maxTextSize の既定は 50,000 文字で、超えると mermaid は**例外を投げずに**
  // 「Maximum text size in diagram exceeded」とだけ書かれた小さな図を返す。
  // 2900タスク (15万文字) のガントで実測したところ、この値を上げれば本物が描ける。
  //
  // maxEdges の既定は 500 本。ここを上げていなかったので、文字数上限を
  // 5,000,000 に引き上げてあるにもかかわらず **800要素 (20,483文字) で描けなく
  // なっていた**。しかも例外の文言は帯の定型文に落ちて「構文エラー」と出るので、
  // 存在しない構文誤りを探すことになる。500本は中規模の構成図で普通に届く数。
  var cfg = {
    startOnLoad: false, theme: 'dark', securityLevel: 'loose',
    maxTextSize: 5000000,
    maxEdges: 100000,
  };
  if (currentModule && currentModule.type === 'gantt') {
    var fitW = previewContentWidth();
    var days = ganttSpanDays(parsedData);
    var width = fitW;
    if (ganttViewMode === 'detail' && days > 0) {
      // Chrome refuses a canvas wider than 65,535px, and PNG/clipboard export
      // sizes its canvas from the SVG. Past that the export throws instead of
      // producing a file, so the chart is capped even if that means fewer px/day.
      width = Math.min(GANTT_MAX_WIDTH, Math.max(fitW, Math.round(days * DETAIL_PX_PER_DAY)));
    }
    cfg.gantt = { useWidth: width };
    // Only pin the axis when the span is actually known. Guessing a granularity
    // from an unknown span is worse than leaving it out: d3 picks 10-12 ticks on
    // its own, whereas a wrong '1week' on a decade-long chart draws 500+ of them.
    if (days > 0) {
      var axis = ganttAxisFor(days);
      cfg.gantt.tickInterval = axis.tickInterval;
      // The DSL's own `axisFormat` line wins over this (verified against
      // mermaid's gantt renderer), so this only fills in for charts that omit it.
      cfg.gantt.axisFormat = axis.axisFormat;
    }
  }
  mermaid.initialize(cfg);
}

// One place decides what the zoom readout says. It used to be written from three
// separate spots, and refresh() ran last — so pressing "fit" showed 概観 for a
// frame and then reverted to 100%, leaving no indication of the mode at all.
function updateZoomLabel() {
  if (!zoomDisplayEl) return;
  var isGantt = currentModule && currentModule.type === 'gantt';
  zoomDisplayEl.textContent = (isGantt && ganttViewMode === 'overview')
    ? '概観'
    : Math.round(zoom * 100) + '%';
}

function setGanttViewMode(mode) {
  ganttViewMode = mode;
  updateZoomLabel();
}

function zoomToFit() {
  // For gantt, "fit" means redraw at the container width so the labels stay
  // 11px, not scale the drawing (and its text) down to 54%.
  if (currentModule && currentModule.type === 'gantt') {
    setZoom(1.0);
    setGanttViewMode('overview');
    scheduleRefresh();
    return;
  }
  var svgEl = previewSvgEl ? previewSvgEl.querySelector('svg') : null;
  var previewContainer = document.getElementById('preview-container');
  if (!svgEl || !previewContainer) return;
  var naturalW = parseFloat(svgEl.getAttribute('width')) || 800;
  var containerW = previewContainer.clientWidth - 32;
  var fitZoom = containerW / naturalW;
  setZoom(Math.round(fitZoom * 100) / 100);
}

// ── File Open / Save ───────────────────────────────────────────────────────

// Base name of the file the user opened, so saving writes back to the same name
// instead of a fresh download. Cleared when the diagram is replaced wholesale.
var loadedFileName = '';

// Text as of the last save/open. The diagram only lives in this tab — there is no
// autosave and no server — so closing it threw the work away without a word.
var savedText = null;

// markSaved は「保存した」ではなく「未保存判定の基準を今の本文にする」関数。
// 起動時のサンプル読み込み・ファイルを開いたとき・図種切替でも呼ばれるので、
// ここに「保存: HH:MM」を出すと**保存していないのに保存したと言う**ことになる
// (実機のスクリーンショットで発覚した)。表示は保存動作の側で行う。
function markSaved() {
  savedText = mmdText;
  // 未保存マークはここで更新する。
  //
  // タイトルは renderStatus() 経由でしか更新されず、保存は再描画を起こさないので
  // 保存しても `●` が消えなかった。マークを付けた目的は「保存し忘れを防ぐ」こと
  // なのに、消えないマークは情報を持たない。入れた機能が目的を果たしていなかった。
  //
  // markSaved は起動時・ファイルを開いたとき・図種切替でも呼ばれるが、
  // どの場合も「いまの本文が基準」になるので、マークが消えるのが正しい。
  if (typeof updateDocumentTitle === 'function') updateDocumentTitle();
}

// A diagram is worth warning about only when it differs from what was last
// saved *and* from the template it started as. Prompting on an untouched
// template would train the user to dismiss the dialog.
function hasUnsavedWork(text, saved, template) {
  var t = String(text == null ? '' : text).trim();
  if (!t) return false;
  if (saved !== null && saved !== undefined && String(saved).trim() === t) return false;
  if (template !== null && template !== undefined && String(template).trim() === t) return false;
  return true;
}

// What a download should be called.
//
// This used to be `(parsed.title || 'untitled')`, and most diagram types have no
// title at all — flowchart, block, c4 and the rest never set one. Saving three
// diagrams in a row produced untitled.mmd, untitled(1).mmd, untitled(2).mmd,
// and the user had to open each one to find out which was which.
//
// Order: the name the file was opened under, then the diagram's own title, then
// the diagram type with a date so at least the files sort and identify.
function downloadBaseName(fileName, title, type, now) {
  var base = sanitizeFileName(fileName || '') || sanitizeFileName(title || '');
  if (base) return base;
  var d = now || new Date();
  var stamp = d.getFullYear() +
    ('0' + (d.getMonth() + 1)).slice(-2) +
    ('0' + d.getDate()).slice(-2);
  return (type || 'diagram') + '-' + stamp;
}

// Titles are free text and go straight into a download name, so the characters
// Windows and POSIX both refuse have to come out. A name that reduces to nothing
// returns '' and lets the caller fall back.
function sanitizeFileName(s) {
  return String(s)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 100);
}

function currentBaseName() {
  return downloadBaseName(loadedFileName, parsed && parsed.title,
    currentModule && currentModule.type);
}

function openFile() {
  document.getElementById('file-input').click();
}

// 一度「名前を付けて保存」したファイルへの参照。以後はここへ上書きする。
var saveHandle = null;

// ファイルに書き出す本文。
//
// エディタの本文は末尾改行を持たない (21図種のひな形も、削除処理も、その規約で
// 揃っている)。ただしファイルとして書き出す側では末尾改行を1つ付ける。
//
// 数十〜数百枚を Git 管理する運用では、末尾改行が無いと全ファイルの差分に
// `\ No newline at end of file` が付き、**末尾に1行足しただけで2行の差分**に
// 見える (既存最終行の削除 + 2行の追加)。レビューで「何を変えたか」が読みにくい。
// POSIX のテキストファイル規約でもあり、Prettier / gofmt も同じことをしている。
//
// 開き直したときは元の本文に戻るよう、読み込み側で末尾の改行を落とす。
// 付けるのは常に1つ、外すのも常に1つ。条件を付けると往復が壊れる。
//
//   本文 "A"    → ファイル "A\n"   → 開き直して "A"     ✓
//   本文 "A\n"  → ファイル "A\n\n" → 開き直して "A\n"   ✓
//
// 「既に改行で終わっていれば足さない」にすると、2つ目のケースで利用者が
// 打った末尾の改行が往復のたびに消える (実際そうなっていた)。
function fileBody() {
  return mmdText + '\n';
}

function downloadAsFile() {
  var blob = new Blob([fileBody()], { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = currentBaseName() + '.mmd';
  a.click();
  URL.revokeObjectURL(a.href);
}

// 保存。
//
// 従来はダウンロードだけで、名前は図の title から自動で決まり、場所も選べなかった。
// リポジトリの `docs/arch.mmd` を更新する運用だと、毎回ダウンロードフォルダから
// 移動してリネームすることになる。
//
// ただし Save の既定をファイル選択ダイアログに変えるのは違う。1クリックで
// 終わっていた操作がモーダルになるのは、毎日使う側には改悪ではない
// (実際、ヘッドレス環境ではダイアログが戻らず Save が完了しなくなった)。
// 上書き先を一度指定したときだけ、以後の Save がそこへの上書きになる。
function saveFile() {
  if (saveHandle) { overwriteSaved(); return; }
  downloadAsFile();
  markSaved();
  showTransient(savedMessage(new Date()) + ' — ダウンロードしました');
}

async function overwriteSaved() {
  try {
    var w = await saveHandle.createWritable();
    await w.write(fileBody());
    await w.close();
    markSaved();
    showTransient(savedMessage(new Date()) + ' → ' + (saveHandle.name || ''));
  } catch (e) {
    // 上書きに失敗したら参照を捨て、黙ってダウンロードに落とす。
    // 保存できたことにして本文を失わせるのが一番悪い。
    saveHandle = null;
    downloadAsFile();
    markSaved();
    showTransient('上書きに失敗 — 代わりにダウンロードしました');
  }
}

// 上書き先を指定する (Ctrl+Shift+S / Export メニュー)。
// 非対応ブラウザ (Firefox / Safari) ではこの機能自体が無いので、
// できないことをその場で言う。黙ってダウンロードすると「指定できた」と誤解される。
async function saveFileAs() {
  if (!window.showSaveFilePicker) {
    showTransient('このブラウザは上書き保存に非対応 — Chrome / Edge なら使えます', 5000);
    return;
  }
  try {
    saveHandle = await window.showSaveFilePicker({
      suggestedName: currentBaseName() + '.mmd',
      types: [{ description: 'Mermaid', accept: { 'text/plain': ['.mmd', '.mermaid'] } }],
    });
  } catch (e) {
    showTransient('保存先の指定を中止 — 本文はそのままです', 2500);
    return;
  }
  if (saveHandle && saveHandle.name) loadedFileName = saveHandle.name;
  overwriteSaved();
}

// ── Export Functions ───────────────────────────────────────────────────────
// 古い図を書き出さない。
//
// 描画に失敗している間は直前の図を残しているので、そのまま Export すると
// **編集していない内容**が成果物になる。帯で「古い」とは言っているが、
// 書き出しはそれを見ていなかった (前回の修正が作った副作用)。
function blockExportIfStale() {
  if (!previewStale) return false;
  showTransient('構文エラー中のため書き出していません — 本文を直すか .mmd で保存してください', 5000);
  return true;
}

// 書き出す SVG の id を、そのファイル固有のものに付け替える。
//
// mermaid が付ける id は `mermaid-svg-<セッション内の連番>` で、
// **別々のセッションで書き出した2枚が同じ id を持つ**。実測: 2つの .mmd を
// それぞれ開いて書き出すと、どちらも `mermaid-svg-2` になった。
//
// スタイルは `#mermaid-svg-2 .node rect { … }` の形で id に紐付いており
// (flowchart で64箇所、gantt で109箇所)、同じ id の SVG を1つの文書に並べると
// 2枚目が `getElementById` で参照できない (実測)。数十〜数百枚を wiki や
// 設計書に貼る運用では、id で参照する仕組みが静かに1枚目だけを指す。
//
// ファイル名から作るので、同じ図を何度書き出しても同じ id になる
// (Git の差分に無意味な変化を出さない)。
function uniqueSvgId(baseName) {
  var safe = String(baseName || 'diagram').replace(/[^A-Za-z0-9_-]/g, '_');
  return 'ma-' + safe;
}

function retargetSvgId(clone, newId) {
  var oldId = clone.getAttribute('id');
  if (!oldId || oldId === newId) return;
  clone.setAttribute('id', newId);

  // スタイル側の参照を付け替える。付け替えないと、書き出した SVG が
  // 自分のスタイルを1つも受け取れなくなる (色も字も既定に戻る)。
  var styles = clone.querySelectorAll('style');
  for (var i = 0; i < styles.length; i++) {
    styles[i].textContent = styles[i].textContent.split('#' + oldId).join('#' + newId);
  }

  // 矢印マーカーの id も同じ接頭辞を持つ (`mermaid-svg-2_flowchart-v2-pointEnd`)。
  //
  // `url(#…)` は文書内で**最初に見つかった id** を拾うので、同じ接頭辞の SVG を
  // 2枚並べると、2枚目の矢印が1枚目のマーカーを使う。線の種類が違えば矢印の形が
  // 入れ替わり、しかもエラーは出ない。id 本体だけ直しても、ここが残ると意味がない。
  var all = clone.querySelectorAll('[id]');
  for (var j = 0; j < all.length; j++) {
    var v = all[j].getAttribute('id');
    if (v && v.indexOf(oldId) === 0) all[j].setAttribute('id', newId + v.slice(oldId.length));
  }
  // url(#…) で参照している側 (marker-start / marker-end / fill / clip-path など)
  var refAttrs = ['marker-start', 'marker-end', 'marker-mid', 'fill', 'stroke', 'clip-path', 'mask', 'filter'];
  var users = clone.querySelectorAll('*');
  for (var k = 0; k < users.length; k++) {
    for (var a = 0; a < refAttrs.length; a++) {
      var av = users[k].getAttribute(refAttrs[a]);
      if (av && av.indexOf('url(#' + oldId) >= 0) {
        users[k].setAttribute(refAttrs[a], av.split('url(#' + oldId).join('url(#' + newId));
      }
    }
    var st = users[k].getAttribute('style');
    if (st && st.indexOf('url(#' + oldId) >= 0) {
      users[k].setAttribute('style', st.split('url(#' + oldId).join('url(#' + newId));
    }
  }
}

function exportSVG() {
  if (blockExportIfStale()) return;
  var svgEl = previewSvgEl.querySelector('svg');
  if (!svgEl) return;
  var clone = svgEl.cloneNode(true);
  retargetSvgId(clone, uniqueSvgId(currentBaseName()));
  var blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = currentBaseName() + '.svg';
  a.click();
  URL.revokeObjectURL(a.href);
}

// scale は書き出す画素の倍率。
//
// これまで等倍しか無かった (実測: viewBox 788x196 → PNG 788x196)。
// 設計書や wiki に貼ると、拡大表示や印刷で字がつぶれる。姉妹プロジェクトの
// 01_StableBlock では同じ理由で 2倍を入れている。
//
// Chrome は幅 65,535px を超える canvas を作れないので、超える倍率は落とす。
// 黙って小さい画像を返すより、要求した倍率で出せないことを告げる。
function svgToCanvas(transparent, callback, scale) {
  var svgEl = previewSvgEl.querySelector('svg');
  if (!svgEl) return;
  var clone = svgEl.cloneNode(true);
  var svgData = new XMLSerializer().serializeToString(clone);
  var img = new Image();
  img.onload = function() {
    var s = scale || 1;
    var MAX = 65535;
    if (img.width * s > MAX || img.height * s > MAX) {
      var fit = Math.min(MAX / img.width, MAX / img.height);
      showTransient('図が大きすぎるため ' + s + '倍では書き出せません — ' +
        fit.toFixed(2) + '倍にしました', 5000);
      s = fit;
    }
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * s);
    canvas.height = Math.round(img.height * s);
    var ctx = canvas.getContext('2d');
    if (!transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    callback(canvas);
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
}

function exportPNG(transparent, scale) {
  if (blockExportIfStale()) return;
  svgToCanvas(transparent, function(canvas) {
    canvas.toBlob(function(blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = currentBaseName() + (scale && scale !== 1 ? '@' + scale + 'x' : '') + '.png';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }, scale);
}

// クリップボードへコピーする。
//
// 以前は `navigator.clipboard.write(...)` を呼びっぱなしで、返る Promise を
// 誰も見ていなかった。実測すると失敗が2通りあり、**どちらも画面には何も出ない**:
//
//   権限が下りない          → コンソールに Write permission denied、画面は無反応
//   ClipboardItem が無い     → コンソールに ReferenceError、画面は無反応
//                             (Firefox / Safari / 古いブラウザ)
//
// 押しても何も起きないので、利用者はそのまま資料へ貼り付ける。すると
// **前にコピーしていた何か**が入る。失敗が成功と見分けられないのが一番悪い。
// 上書き保存の非対応を告げているのと同じ作法に揃える。
function exportClipboard() {
  if (blockExportIfStale()) return;
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) {
    showTransient('このブラウザは図のコピーに非対応 — Chrome / Edge なら使えます。PNG で保存してください', 6000);
    return;
  }
  svgToCanvas(false, function(canvas) {
    canvas.toBlob(function(blob) {
      if (!blob) { showTransient('図を画像にできませんでした', 4000); return; }
      Promise.resolve()
        .then(function() { return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); })
        .then(function() {
          showTransient('図をクリップボードにコピーしました (' +
            Math.round(blob.size / 1024) + ' KB)');
        })
        .catch(function(e) {
          // 何が起きたか分からないまま貼り付けさせない。
          showTransient('クリップボードにコピーできませんでした — ' +
            String((e && e.message) || e).slice(0, 60), 6000);
        });
    });
  });
}

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
  // DOM references
  editorEl      = document.getElementById('editor');
  lineNumEl     = document.getElementById('line-numbers');
  previewSvgEl  = document.getElementById('preview-svg');
  overlayEl     = document.getElementById('overlay-layer');
  propsEl       = document.getElementById('props-content');
  statusParseEl = document.getElementById('status-parse');
  statusInfoEl  = document.getElementById('status-info');
  zoomDisplayEl = document.getElementById('zoom-display');

  // Init mermaid.js
  applyMermaidConfig(null);

  // Default content
  mmdText = [
    'gantt',
    '    title プロジェクト計画',
    '    dateFormat YYYY-MM-DD',
    // axisFormat はあえて書かない (gantt.template() と同じ理由)
    '',
    '    section 要件定義',
    '    要件分析           :a1, 2026-04-01, 2026-04-15',
    '    仕様書作成         :a2, after a1, 2026-04-25',
    '',
    '    section 設計',
    '    基本設計           :b1, 2026-04-20, 2026-05-05',
    '    詳細設計           :b2, after b1, 2026-05-15',
  ].join('\n');

  editorEl.value = mmdText;
  // The startup sample is not the gantt module's template(), so without this the
  // very first diagram-type switch would ask to confirm discarding text the user
  // never wrote.
  markSaved();
  syncLineNumbers();
  setZoom(1.0);

  // History initialization
  window.MA.history.init({
    getMmdText: function() { return mmdText; },
    setMmdText: function(t) {
      mmdText = t;
      suppressSync = true;
      editorEl.value = mmdText;
      suppressSync = false;
      syncLineNumbers();
      scheduleRefresh();
    },
    onUpdate: function() {
      var btnUndo = document.getElementById('btn-undo');
      var btnRedo = document.getElementById('btn-redo');
      if (btnUndo) btnUndo.disabled = !window.MA.history.canUndo();
      if (btnRedo) btnRedo.disabled = !window.MA.history.canRedo();
    }
  });

  // Properties initialization
  window.MA.properties.init({
    onStatus: function() { renderStatus(); },
    // 選択の生存判定と同じ集合を使う。別の判定を持つと「選択は消えるのに
    // 接続はできる」のような食い違いが生まれる
    elementExists: function(id) { return !!knownSelectionIds(parsed)[String(id)]; },
    getMmdText: function() { return mmdText; },
    setMmdText: function(t) {
      mmdText = t;
      suppressSync = true;
      editorEl.value = mmdText;
      suppressSync = false;
      syncLineNumbers();
    },
    onUpdate: function() { scheduleRefresh(); },
    moduleUpdater: function(text, lineNum, field, value) {
      return updateTaskField(text, lineNum, field, value);
    },
  });

  // Selection initialization
  window.MA.selection.init(function() {
    sel = window.MA.selection.getSelected();
    renderProps();
    rebuildOverlay();
  });

  // Initialize history button states
  (function() {
    var btnUndo = document.getElementById('btn-undo');
    var btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = !window.MA.history.canUndo();
    if (btnRedo) btnRedo.disabled = !window.MA.history.canRedo();
  })();

  // ── Editor events ────────────────────────────────────────────────────────
  editorEl.addEventListener('input', function() {
    if (suppressSync) return;
    // A run of typing is one undo step. Pushing per keystroke made undo
    // character-by-character and, with only 80 states kept, silently discarded
    // the pre-edit text once a line grew past 80 characters.
    window.MA.history.pushHistoryCoalesced('editor', EDITOR_UNDO_COALESCE_MS);
    mmdText = editorEl.value;
    refreshCause = 'editor';
    scheduleRefresh();
  });

  editorEl.addEventListener('scroll', function() {
    syncLineNumbers();
  });

  // パネルを下まで送ったら「続きがあります」を引っ込める。
  // 出しっぱなしにすると合図として働かなくなる。
  var propsContentEl = document.getElementById('props-content');
  if (propsContentEl) {
    propsContentEl.addEventListener('scroll', updatePropsOverflowHint);
  }
  // 窓の高さが変われば収まりも変わる。ペインの幅変更でも折り返しが変わる。
  window.addEventListener('resize', updatePropsOverflowHint);

  // Tab / Shift+Tab: indent / outdent with 2 spaces (see workspace ADR-011)
  editorEl.addEventListener('keydown', function(e) {
    if (e.key !== 'Tab' || e.isComposing) return;
    e.preventDefault();
    var start = this.selectionStart;
    var end = this.selectionEnd;
    if (e.shiftKey) {
      var before = this.value.substring(0, start);
      var lineStart = before.lastIndexOf('\n') + 1;
      if (this.value.substring(lineStart, lineStart + 2) === '  ') {
        this.value = this.value.substring(0, lineStart) + this.value.substring(lineStart + 2);
        this.selectionStart = this.selectionEnd = Math.max(lineStart, start - 2);
      }
    } else {
      this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
      this.selectionStart = this.selectionEnd = start + 2;
    }
    this.dispatchEvent(new Event('input'));
  });

  // ── Toolbar buttons ──────────────────────────────────────────────────────
  document.getElementById('btn-open').addEventListener('click', openFile);
  document.getElementById('btn-save').addEventListener('click', saveFile);
  document.getElementById('btn-undo').addEventListener('click', function() { window.MA.history.undo(); });
  document.getElementById('btn-redo').addEventListener('click', function() { window.MA.history.redo(); });

  document.getElementById('btn-zoom-in').addEventListener('click', function() {
    setZoomFromUser(zoom + 0.1);
  });
  document.getElementById('btn-zoom-out').addEventListener('click', function() {
    setZoomFromUser(zoom - 0.1);
  });
  document.getElementById('btn-zoom-fit').addEventListener('click', function() {
    zoomToFit();
  });

  // ── File input handler ───────────────────────────────────────────────────
  document.getElementById('file-input').addEventListener('change', function(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    var openedName = String(file.name || '').replace(/\.[^.]+$/, '');
    reader.onload = function(ev) {
      window.MA.history.pushHistory();
      // Opening a file is a new document: its size is unrelated to whatever was
      // on screen a moment ago, and the view mode resets the same way a type
      // switch does. Editing and undo deliberately do not reset the mode — the
      // one the user picked is theirs to keep while they work on the same diagram.
      // Connection mode is bound to the document that started it (see the
      // diagram-type handler).
      window.MA.connectionMode.cancelConnectionMode();
      pendingAutoFit = true;
      setGanttViewMode('overview');
      setZoom(1.0);
      // 書き出し側で付けた末尾改行を1つだけ落とす (fileBody と対称)。
      // 落とさないと、保存 → 開き直しのたびに末尾の空行が1つ増えていく。
      mmdText = String(ev.target.result || '').replace(/\n$/, '');
      loadedFileName = openedName;
      // ファイルを開いたときも文書は入れ替わる。
      if (currentModule && currentModule.resetTransientState) currentModule.resetTransientState();
      clearListFilter();
      // 別のファイルを開いたら、前の保存先への参照は捨てる。
      // 残しておくと、開いたつもりの無いファイルを上書きする。
      saveHandle = null;
      markSaved();
      suppressSync = true;
      editorEl.value = mmdText;
      suppressSync = false;
      syncLineNumbers();
      scheduleRefresh();
    };
    reader.readAsText(file);
    // Reset so same file can be reopened
    e.target.value = '';
  });

  // ── Export menu toggle ───────────────────────────────────────────────────
  var btnExport  = document.getElementById('btn-export');
  var exportMenu = document.getElementById('export-menu');

  btnExport.addEventListener('click', function(e) {
    e.stopPropagation();
    exportMenu.classList.toggle('open');
  });

  document.addEventListener('click', function() {
    exportMenu.classList.remove('open');
  });

  // Export actions
  // .mmd を Export の先頭に置く。Git に載せるのは .mmd なのに、「書き出す」の
  // 入口が Save と Export に割れており、最も使う形式がメニューに無かった。
  // 打鍵ごとに反映させる。
  //
  // プロパティ欄は change (確定時) でしか反映せず、エディタ側は input で即時だった。
  // 同じ「ラベルを直す」で反映のタイミングが違うので、名前を試行錯誤する場面で
  // GUI 側だけ結果を見ながら詰められない。
  //
  // 対象はラベル欄だけ。ID 欄を即時にすると、打ちかけの不完全な id で
  // 参照側を一斉に書き換えてしまう (リネームは伝播する)。
  // 既存の change ハンドラをそのまま使うので、各モジュールは手を入れない。
  var LIVE_MS = 150;
  var liveTimer = null;
  if (propsEl) {
    propsEl.addEventListener('input', function(ev) {
      var t = ev.target;
      if (!t || t.tagName !== 'INPUT' || t.type !== 'text') return;
      if (!/-label$/.test(t.id || '')) return;
      // 欄を触っている間はずっと束ねる。
      //
      // 合成した change だけ束ねても足りなかった。欄を離れるとブラウザが
      // 本物の change を出すので、そちらが別の履歴を積む。結果、1つの名前を
      // 直しただけで Ctrl+Z が2回必要になっていた (e2e が捕まえた)。
      window.MA.history.setCoalesceMode('live-label:' + t.id, 600000);
      if (liveTimer) clearTimeout(liveTimer);
      liveTimer = setTimeout(function() {
        // 打鍵ごとに反映すると、モジュール側の change ハンドラがそのたび
        // pushHistory を呼ぶ。束ねないと、1つの名前を直すのに Ctrl+Z を
        // 何度も押すことになる (「1編集 = Undo 1回」はこのツールの規律)。
        t.dispatchEvent(new Event('change', { bubbles: true }));
      }, LIVE_MS);
    });

    // 欄を離れたら束ねを終える。次の操作は別の Undo 単位。
    // 再描画で同じ欄にフォーカスが戻る場合 (withFocusKept) は継続する。
    propsEl.addEventListener('focusout', function(ev) {
      var t = ev.target;
      if (!t || !/-label$/.test(t.id || '')) return;
      setTimeout(function() {
        var a = document.activeElement;
        if (a && a.id === t.id) return;
        // 保留中の合成 change を捨てる。欄を離れた時点でブラウザが本物の
        // change を出して確定済みなので、この後に遅れて発火すると束ねが切れた
        // あとにもう一件履歴を積む (打ってすぐ離れると Undo が2回必要になっていた)。
        if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; }
        window.MA.history.setCoalesceMode(null, 0);
      }, 0);
    });
  }

  // 未保存のままタブを閉じる / リロードすると作業が全消失する。
  // 保存がダウンロード操作しか無いのでこまめな保存の習慣も付きにくい。
  // 離脱確認を出す (ブラウザが文面を決めるので、こちらは意思表示だけ)。
  window.addEventListener('beforeunload', function(ev) {
    if (!hasUnsavedWork(mmdText, savedText, currentModule && currentModule.template ? currentModule.template() : null)) return;
    ev.preventDefault();
    ev.returnValue = '';
    return '';
  });

  // 追加フォームで Enter を使えるようにする。
  //
  // 全図種で追加ボタンの click にしか紐付いておらず、10件追加するのに毎回
  // マウスへ持ち替える必要があった。パネル幅は220pxで縦に長いので、ボタンが
  // 画面外ならスクロールも加算される。学習コストを払っても速くならない形。
  //
  // 各モジュールを書き換える代わりに、パネル全体で Enter を拾い、その入力欄の
  // **直後にある追加ボタン**を押す。追加ボタンはどの図種も文字が `+` で始まるか
  // id が `add` を含むので、それを目印にする。
  function findAddButtonAfter(input) {
    var buttons = propsEl.querySelectorAll('button');
    var seen = false;
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var pos = input.compareDocumentPosition(btn);
      // input より後ろにあるボタンだけ見る
      if (!(pos & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      var txt = (btn.textContent || '').trim();
      var id = btn.id || '';
      if (txt.charAt(0) === '+' || /add/i.test(id)) { seen = true; return btn; }
    }
    return seen ? null : null;
  }

  if (propsEl) {
    propsEl.addEventListener('keydown', function(ev) {
      if (ev.key !== 'Enter' || ev.isComposing) return;
      var t = ev.target;
      if (!t || t.tagName !== 'INPUT') return;
      if (t.type !== 'text' && t.type !== 'date' && t.type !== 'number') return;
      var btn = findAddButtonAfter(t);
      if (!btn) return;
      ev.preventDefault();
      btn.click();
    });
  }

  var statusHelp = document.getElementById('status-help');
  if (statusHelp) statusHelp.addEventListener('click', function() { toggleShortcutHelp(true); });

  var helpClose = document.getElementById('shortcut-help-close');
  if (helpClose) helpClose.addEventListener('click', function() { toggleShortcutHelp(false); });
  var helpBox = document.getElementById('shortcut-help');
  if (helpBox) helpBox.addEventListener('click', function(ev) {
    if (ev.target === helpBox) toggleShortcutHelp(false);   // 外側をクリックでも閉じる
  });

  // 保存の入口は Save に集約した。
  //
  // 以前は Save ボタン / Ctrl+S / Ctrl+Shift+S / Export の2項目の4つに散っていた。
  // 初回に1度だけ使う「保存先の指定」が、毎日使う Export と同じ場所にあった。
  var saveMenu = document.getElementById('save-menu');
  var saveMenuBtn = document.getElementById('btn-save-menu');
  if (saveMenuBtn && saveMenu) {
    saveMenuBtn.addEventListener('click', function(ev) {
      ev.stopPropagation();
      saveMenu.classList.toggle('open');
    });
    document.getElementById('save-as').addEventListener('click', function() {
      saveMenu.classList.remove('open');
      saveFileAs();
    });
    document.addEventListener('click', function() { saveMenu.classList.remove('open'); });
  }

  // `?` の存在に気づいてもらうのは初回だけでよい。
  // 置いた場所が画面最下部の二次色なので、数秒だけアクセント色にする。
  var helpHint = document.getElementById('status-help');
  if (helpHint) {
    helpHint.classList.add('first-run');
    setTimeout(function() { helpHint.classList.remove('first-run'); }, 5000);
  }

  document.getElementById('exp-svg').addEventListener('click', function() {
    exportMenu.classList.remove('open');
    exportSVG();
  });

  document.getElementById('exp-png').addEventListener('click', function() {
    exportMenu.classList.remove('open');
    exportPNG(false);
  });

  // 等倍だけだと設計書に貼ったとき拡大や印刷で字がつぶれる。
  // 既定は等倍のまま残し、2倍を別項目として足す (既定を変えると、いま
  // 等倍を前提にしている書き出しの寸法が黙って変わる)。
  document.getElementById('exp-png-2x').addEventListener('click', function() {
    exportMenu.classList.remove('open');
    exportPNG(false, 2);
  });

  document.getElementById('exp-png-transparent').addEventListener('click', function() {
    exportMenu.classList.remove('open');
    exportPNG(true);
  });

  document.getElementById('exp-clipboard').addEventListener('click', function() {
    exportMenu.classList.remove('open');
    exportClipboard();
  });

  // ── Hover-insert guide for Sequence diagram ─────────────────────────────
  // Uses #hover-layer (separate SVG above overlay-layer) so mermaid re-renders
  // do not clear the guide. Active only for sequenceDiagram; other modules
  // ignore the handlers because resolveInsertLine is undefined for them.
  //
  // Suppress rules (cross-apply from PlantUMLAssist direct-manipulation
  // checklist):
  //   - 観点 C: hide guide whenever something is selected (selection =
  //     edit mode, insert would be contradictory)
  //   - 観点 B/C: swallow the synthetic click that follows a drag end
  //     (SEQ_DRAG_CLICK_SUPPRESS_MS window)
  var hoverLayerEl = document.getElementById('hover-layer');

  function _clearHoverGuide() {
    if (!hoverLayerEl) return;
    var guides = hoverLayerEl.querySelectorAll('.hover-guide, .hover-label');
    Array.prototype.forEach.call(guides, function(g) { g.parentNode.removeChild(g); });
  }

  function _syncHoverLayerDims() {
    if (!hoverLayerEl || !overlayEl) return;
    var w = overlayEl.getAttribute('width');
    var h = overlayEl.getAttribute('height');
    var vb = overlayEl.getAttribute('viewBox');
    if (w) hoverLayerEl.setAttribute('width', w);
    if (h) hoverLayerEl.setAttribute('height', h);
    if (vb) hoverLayerEl.setAttribute('viewBox', vb);
    hoverLayerEl.style.transform = overlayEl.style.transform;
  }

  function _drawHoverGuide(svgY) {
    _clearHoverGuide();
    if (!hoverLayerEl || !overlayEl) return;
    _syncHoverLayerDims();
    var NS = 'http://www.w3.org/2000/svg';
    var w = parseFloat(overlayEl.getAttribute('width'))
      || (overlayEl.viewBox && overlayEl.viewBox.baseVal && overlayEl.viewBox.baseVal.width)
      || 800;
    var line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', 0);
    line.setAttribute('y1', svgY);
    line.setAttribute('x2', w);
    line.setAttribute('y2', svgY);
    line.setAttribute('class', 'hover-guide');
    hoverLayerEl.appendChild(line);
    var text = document.createElementNS(NS, 'text');
    text.setAttribute('x', 10);
    text.setAttribute('y', svgY - 3);
    text.setAttribute('class', 'hover-label');
    text.textContent = '+ ここに挿入';
    hoverLayerEl.appendChild(text);
  }

  function _hasAnySelection() {
    var s = window.MA.selection && window.MA.selection.getSelected && window.MA.selection.getSelected();
    return !!(s && s.length > 0);
  }

  function _isSequenceDiagram() {
    return currentModule && currentModule.type === 'sequenceDiagram';
  }

  // ── Ctrl+wheel zoom / Shift+wheel horizontal scroll on preview ───────────
  var previewContainer = document.getElementById('preview-container');
  previewContainer.addEventListener('mousemove', function(e) {
    if (!_isSequenceDiagram()) { _clearHoverGuide(); return; }
    if (_hasAnySelection()) { _clearHoverGuide(); return; }
    if (seqDragState) { _clearHoverGuide(); return; }
    var target = e.target;
    // Over a participant drag handle or other overlay actor — skip guide
    if (target && target.getAttribute && target.getAttribute('data-element-kind')) {
      _clearHoverGuide();
      return;
    }
    if (!overlayEl) return;
    var rect = overlayEl.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right
        || e.clientY < rect.top || e.clientY > rect.bottom) {
      _clearHoverGuide();
      return;
    }
    // Convert client y to SVG y (account for zoom via CTM)
    var pt = overlayEl.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    var ctm = overlayEl.getScreenCTM();
    if (!ctm) return;
    var svgPt = pt.matrixTransform(ctm.inverse());
    _drawHoverGuide(svgPt.y);
  });

  previewContainer.addEventListener('mouseleave', _clearHoverGuide);

  previewContainer.addEventListener('click', function(e) {
    if (!_isSequenceDiagram()) return;
    if (Date.now() - seqJustDraggedAt < SEQ_DRAG_CLICK_SUPPRESS_MS) return;
    if (_hasAnySelection()) return;
    var target = e.target;
    // Let overlay click handlers (participant selection etc.) fire first.
    if (target && target.getAttribute && target.getAttribute('data-element-kind')) return;
    var seqMod = window.MA.modules && window.MA.modules.sequence;
    if (!seqMod || !seqMod.resolveInsertLine) return;
    if (!overlayEl) return;
    var rect = overlayEl.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right
        || e.clientY < rect.top || e.clientY > rect.bottom) return;
    var pt = overlayEl.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    var ctm = overlayEl.getScreenCTM();
    if (!ctm) return;
    var svgPt = pt.matrixTransform(ctm.inverse());
    var svg = document.querySelector('#preview-svg svg');
    var parsedForSeq = seqMod.parseSequence(mmdText);
    var res = seqMod.resolveInsertLine(svg, parsedForSeq, svgPt.y);
    if (!res) return;
    // Open the modal insert form (ported from PlantUMLAssist). The form
    // handles history push, setMmdText, and onUpdate itself via ctx.
    _clearHoverGuide();
    if (!seqMod.showInsertForm) return;
    seqMod.showInsertForm({
      getMmdText: function() { return mmdText; },
      setMmdText: function(s) { mmdText = s; suppressSync = true; editorEl.value = s; suppressSync = false; syncLineNumbers(); },
      onUpdate: function() { scheduleRefresh(); },
    }, res.line, res.position, 'message');
  });

  previewContainer.addEventListener('wheel', function(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      var delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoomFromUser(zoom + delta);
    } else if (e.shiftKey && !e.ctrlKey) {
      // Shift+Wheel → horizontal scroll
      previewContainer.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  // ── Overlay click + drag handling ─────────────────────────────────────────
  overlayEl.addEventListener('mousedown', function(e) {
    var target = e.target;
    var taskId = target.getAttribute('data-task-id');
    var handle = target.getAttribute('data-handle');
    var lineNum = target.getAttribute('data-line');
    var index = target.getAttribute('data-index');

    // Sequence participant drag path: elements have data-element-kind="participant"
    // rather than data-task-id. Handled by a separate code path below.
    var seqKind = target.getAttribute('data-element-kind');
    var seqId = target.getAttribute('data-element-id');
    if (seqKind === 'participant' && seqId) {
      seqDragState = {
        id: seqId,
        startX: e.clientX,
        startY: e.clientY,
        dragging: false,
        ghostEl: null,
      };
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Connection mode: the click after "ここから線" picks the target and the
    // module's own connect() writes the edge.
    //
    // `core/connection-mode.js` has existed since the Tier-1 refactor and the
    // design says edges are drawn by "クリック2回でエッジ作成 共通機構 / 全
    // モジュールから利用" — but nothing ever called it. All 20 modules expose
    // operations.connect(text, from, to, props) and every one of them was
    // unreachable from the canvas. Drawing an edge meant picking both ends out
    // of two dropdowns in the properties panel, which is five interactions and
    // gets worse the more elements the diagram has.
    if (seqKind && seqId && window.MA.connectionMode.isInConnectionMode()) {
      e.preventDefault();
      e.stopPropagation();
      window.MA.connectionMode.notifyTarget(seqKind, seqId);
      return;
    }

    // Any other overlay element that names what it is and which element it
    // stands for — commit selection synchronously. selectItem handles toggle-off
    // on re-click.
    //
    // This used to be a whitelist of 'message' | 'note' | 'group', which is the
    // set sequence.js happens to emit. flowchart's buildOverlay emits
    // data-element-kind="node", so its five overlay rects fell through to the
    // "clicked empty space" branch below and *cleared* the selection: clicking a
    // node in the diagram looked broken rather than unimplemented. A module that
    // labels its overlay elements should not also have to be listed here.
    if (seqKind && seqId) {
      window.MA.selection.selectItem(seqKind, seqId, e.shiftKey);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Click on empty overlay area (no task): clear selection
    if (!taskId && !e.shiftKey) {
      window.MA.selection.clearSelection();
      return;
    }

    if (!taskId) return;

    // Select the task
    if (!handle) {
      window.MA.selection.selectItem('task', taskId, e.shiftKey);
    }

    // Initiate drag if calibration is available
    if (window.MA.modules.gantt.getCalibration().pxPerDay !== 0 && lineNum) {
      var lineNumInt = parseInt(lineNum, 10);
      var indexInt = parseInt(index, 10);

      // Find the task data to get original dates
      var task = null;
      if (parsed && parsed.tasks) {
        for (var dti = 0; dti < parsed.tasks.length; dti++) {
          if (parsed.tasks[dti].id === taskId) { task = parsed.tasks[dti]; break; }
        }
      }
      // A task whose start comes from `after <id>` has no date to shift, so the
      // drag never starts. That silence reads as the app being broken: the bar
      // and its resize handles are drawn like any other, and grabbing them does
      // nothing at all. Say why.
      //
      // (Before date-utils was fixed this branch was worse than silent —
      // addDays(null, n) counted from the epoch, so the few paths that did get
      // through moved the task to 1970 and dropped the dependency with it.)
      if (task && (!task.startDate || !DATE_RE.test(task.startDate))) {
        dragBlockedMsg = task.after
          ? '「' + task.label + '」は after ' + task.after + ' で位置が決まります。' +
            '動かすには開始日を直接指定してください'
          : '「' + task.label + '」は開始日が日付ではないため動かせません';
        renderStatus();
      }
      if (task && task.startDate && DATE_RE.test(task.startDate)) {
        // Use overlay SVG for coordinate conversion (same viewBox as mermaid SVG)
        if (overlayEl && overlayEl.createSVGPoint) {
          var pt = overlayEl.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          try {
            var ctm = overlayEl.getScreenCTM();
            if (ctm) {
              var svgPt = pt.matrixTransform(ctm.inverse());
              var br = window.MA.modules.gantt.getCalibration().barRects[indexInt];
              dragState = {
                taskId: taskId,
                lineNum: lineNumInt,
                handle: handle || null,
                startX: svgPt.x,
                historyPushed: false,
                origStartDate: task.startDate,
                origEndDate: task.endDate || '',
                origBarX: br ? br.x : 0,
                origBarW: br ? br.width : 0,
              };
              // Visual feedback: highlight dragged bar
              var dragBarEl = overlayEl.querySelector('.overlay-bar[data-task-id="' + taskId + '"]');
              if (dragBarEl) {
                dragBarEl.setAttribute('fill', 'rgba(124, 140, 248, 0.3)');
                dragBarEl.setAttribute('data-dragging', 'true');
              }
            }
          } catch (ex) { /* can't get CTM */ }
        }
      }
    }

    e.preventDefault();
    e.stopPropagation();
  });

  // Click on preview-container background: clear selection
  document.getElementById('preview-container').addEventListener('mousedown', function(e) {
    if (e.target === this || e.target === previewSvgEl) {
      window.MA.selection.clearSelection();
    }
  });

  // ── Sequence participant drag: geometry helpers ─────────────────────────
  function _seqParticipantCenters(overlay) {
    // Dedup by data-element-id. Feature: buildOverlay emits actor-top AND
    // actor-bottom rects, so each participant has 2 rects at the same x.
    // Dedup by id (not by x coordinate) to avoid the PlantUMLAssist bug where
    // near-duplicate x values inflated the gap count.
    var byId = {};
    var rects = overlay.querySelectorAll('rect[data-element-kind="participant"]');
    Array.prototype.forEach.call(rects, function(r) {
      var id = r.getAttribute('data-element-id');
      if (!id || id in byId) return;
      var x = parseFloat(r.getAttribute('x'));
      var w = parseFloat(r.getAttribute('width'));
      if (isNaN(x) || isNaN(w)) return;
      byId[id] = { id: id, cx: x + w / 2 };
    });
    var arr = [];
    for (var k in byId) if (Object.prototype.hasOwnProperty.call(byId, k)) arr.push(byId[k]);
    arr.sort(function(a, b) { return a.cx - b.cx; });
    return arr;
  }

  function _seqGaps(overlay, centers) {
    if (!centers || centers.length === 0) return [];
    var overlayW = parseFloat(overlay.getAttribute('width'))
      || (overlay.viewBox && overlay.viewBox.baseVal && overlay.viewBox.baseVal.width)
      || 800;
    var left = Math.max(5, centers[0].cx - 40);
    var right = Math.min(overlayW - 5, centers[centers.length - 1].cx + 40);
    var gaps = [left];
    for (var i = 0; i < centers.length - 1; i++) {
      gaps.push((centers[i].cx + centers[i + 1].cx) / 2);
    }
    gaps.push(right);
    return gaps;
  }

  function _seqScreenToOverlayX(overlay, clientX) {
    if (!overlay || !overlay.createSVGPoint) return null;
    var pt = overlay.createSVGPoint();
    pt.x = clientX; pt.y = 0;
    var ctm = overlay.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse()).x;
  }

  function _seqDrawDropIndicator(overlay, clientX) {
    // Draw into #hover-layer so mermaid re-renders of overlay-layer (which
    // happen during/after drag) don't clobber the indicator mid-gesture.
    var hoverL = document.getElementById('hover-layer');
    if (!hoverL) return;
    var old = hoverL.querySelectorAll('.seq-drop-indicator');
    Array.prototype.forEach.call(old, function(el) { el.parentNode.removeChild(el); });
    var centers = _seqParticipantCenters(overlay);
    if (centers.length === 0) return;
    var gaps = _seqGaps(overlay, centers);
    var localX = _seqScreenToOverlayX(overlay, clientX);
    if (localX == null) return;
    var bestX = gaps[0], bestDist = Infinity;
    for (var i = 0; i < gaps.length; i++) {
      var d = Math.abs(localX - gaps[i]);
      if (d < bestDist) { bestDist = d; bestX = gaps[i]; }
    }
    var h = parseFloat(overlay.getAttribute('height'))
      || (overlay.viewBox && overlay.viewBox.baseVal && overlay.viewBox.baseVal.height)
      || 400;
    // Keep hover-layer dimensions synced to overlay so viewBox clipping doesn't
    // hide the indicator.
    if (overlay.getAttribute('width')) hoverL.setAttribute('width', overlay.getAttribute('width'));
    if (overlay.getAttribute('height')) hoverL.setAttribute('height', overlay.getAttribute('height'));
    if (overlay.getAttribute('viewBox')) hoverL.setAttribute('viewBox', overlay.getAttribute('viewBox'));
    hoverL.style.transform = overlay.style.transform;
    var NS = 'http://www.w3.org/2000/svg';
    var line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', bestX);
    line.setAttribute('y1', 0);
    line.setAttribute('x2', bestX);
    line.setAttribute('y2', h);
    line.setAttribute('class', 'seq-drop-indicator');
    hoverL.appendChild(line);
  }

  function _seqClearDropIndicator(overlay) {
    var hoverL = document.getElementById('hover-layer');
    if (!hoverL) return;
    var old = hoverL.querySelectorAll('.seq-drop-indicator');
    Array.prototype.forEach.call(old, function(el) { el.parentNode.removeChild(el); });
  }

  function _seqComputeDropIndex(overlay, clientX) {
    var centers = _seqParticipantCenters(overlay);
    if (centers.length === 0) return null;
    var gaps = _seqGaps(overlay, centers);
    var localX = _seqScreenToOverlayX(overlay, clientX);
    if (localX == null) return null;
    var bestIdx = 0, bestDist = Infinity;
    for (var i = 0; i < gaps.length; i++) {
      var d = Math.abs(localX - gaps[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    return bestIdx;
  }

  // ── Document mousemove (drag) ───────────────────────────────────────────
  document.addEventListener('mousemove', function(e) {
    // Sequence participant drag path
    if (seqDragState) {
      var dx = e.clientX - seqDragState.startX;
      var dy = e.clientY - seqDragState.startY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (!seqDragState.dragging && dist > 4) {
        seqDragState.dragging = true;
        var g = document.createElement('div');
        g.className = 'seq-drag-ghost';
        g.textContent = seqDragState.id;
        g.style.cssText = 'position:fixed;pointer-events:none;background:rgba(124,140,248,0.9);color:#fff;padding:4px 8px;border-radius:4px;font-size:11px;z-index:9999;left:' + e.clientX + 'px;top:' + e.clientY + 'px;';
        document.body.appendChild(g);
        seqDragState.ghostEl = g;
      }
      if (seqDragState.dragging) {
        seqDragState.ghostEl.style.left = e.clientX + 'px';
        seqDragState.ghostEl.style.top = e.clientY + 'px';
        if (overlayEl) _seqDrawDropIndicator(overlayEl, e.clientX);
      }
      return;
    }
    if (!dragState) return;

    if (!overlayEl || !overlayEl.createSVGPoint) return;

    var pt = overlayEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;

    try {
      var ctm = overlayEl.getScreenCTM();
      if (!ctm) return;
      var svgPt = pt.matrixTransform(ctm.inverse());
      var dx = svgPt.x - dragState.startX;
      var daysDelta = Math.round(dx / window.MA.modules.gantt.getCalibration().pxPerDay);

      if (daysDelta === 0) return;

      // Push history only on first actual move
      if (!dragState.historyPushed) {
        window.MA.history.pushHistory();
        dragState.historyPushed = true;
      }

      if (dragState.handle === null) {
        // Move: shift both dates equally
        var newStart = window.MA.dateUtils.addDays(dragState.origStartDate, daysDelta);
        var newEnd = dragState.origEndDate && DATE_RE.test(dragState.origEndDate) ? window.MA.dateUtils.addDays(dragState.origEndDate, daysDelta) : null;
        mmdText = updateTaskDates(mmdText, dragState.lineNum, newStart, newEnd);
      } else if (dragState.handle === 'left') {
        // Resize left: shift start date, but don't go past end date
        var newStart2 = window.MA.dateUtils.addDays(dragState.origStartDate, daysDelta);
        if (dragState.origEndDate && DATE_RE.test(dragState.origEndDate)) {
          if (window.MA.dateUtils.daysBetween(newStart2, dragState.origEndDate) < 1) {
            newStart2 = window.MA.dateUtils.addDays(dragState.origEndDate, -1); // minimum 1 day
          }
        }
        mmdText = updateTaskDates(mmdText, dragState.lineNum, newStart2, null);
      } else if (dragState.handle === 'right') {
        // Resize right: shift end date, but don't go before start date
        if (dragState.origEndDate && DATE_RE.test(dragState.origEndDate)) {
          var newEnd2 = window.MA.dateUtils.addDays(dragState.origEndDate, daysDelta);
          if (window.MA.dateUtils.daysBetween(dragState.origStartDate, newEnd2) < 1) {
            newEnd2 = window.MA.dateUtils.addDays(dragState.origStartDate, 1); // minimum 1 day
          }
          mmdText = updateTaskDates(mmdText, dragState.lineNum, null, newEnd2);
        }
      }

      // Fix after-dependent task dates to prevent negative widths in mermaid
      mmdText = sanitizeAfterDependencies(mmdText);

      // Update text + editor immediately (no mermaid re-render)
      suppressSync = true;
      editorEl.value = mmdText;
      suppressSync = false;

      // Visually move the overlay bar instead of full re-render
      var barEl = overlayEl.querySelector('.overlay-bar[data-task-id="' + dragState.taskId + '"]');
      if (barEl) {
        var pxDelta = daysDelta * window.MA.modules.gantt.getCalibration().pxPerDay;
        var origX = parseFloat(barEl.getAttribute('data-orig-x') || barEl.getAttribute('x'));
        var origW = parseFloat(barEl.getAttribute('data-orig-w') || barEl.getAttribute('width'));
        if (!barEl.getAttribute('data-orig-x')) {
          barEl.setAttribute('data-orig-x', barEl.getAttribute('x'));
          barEl.setAttribute('data-orig-w', barEl.getAttribute('width'));
        }
        if (dragState.handle === null) {
          barEl.setAttribute('x', origX + pxDelta);
        } else if (dragState.handle === 'left') {
          barEl.setAttribute('x', origX + pxDelta);
          barEl.setAttribute('width', Math.max(5, origW - pxDelta));
        } else if (dragState.handle === 'right') {
          barEl.setAttribute('width', Math.max(5, origW + pxDelta));
        }
      }

      // Show drag tooltip near cursor
      var tooltipEl = document.getElementById('drag-tooltip');
      if (tooltipEl) {
        var currentParsed = parseGantt(mmdText);
        var dragTask = null;
        for (var dpi = 0; dpi < currentParsed.tasks.length; dpi++) {
          if (currentParsed.tasks[dpi].id === dragState.taskId) { dragTask = currentParsed.tasks[dpi]; break; }
        }
        if (dragTask) {
          var tipText = dragTask.startDate || '';
          if (dragTask.endDate && DATE_RE.test(dragTask.endDate)) {
            tipText += ' → ' + dragTask.endDate;
            if (dragTask.startDate && DATE_RE.test(dragTask.startDate)) {
              var dur = window.MA.dateUtils.daysBetween(dragTask.startDate, dragTask.endDate);
              tipText += ' (' + dur + '日)';
            }
          }
          tooltipEl.textContent = tipText;
          tooltipEl.style.display = 'block';
          tooltipEl.style.left = (e.clientX + 16) + 'px';
          tooltipEl.style.top = (e.clientY - 30) + 'px';
        }
      }

      // Lightweight refresh: parse + status only (instant)
      refresh(true);

      // Throttled mermaid re-render: chart updates progressively during drag
      if (!dragRenderTimer) {
        dragRenderTimer = setTimeout(function() {
          dragRenderTimer = null;
          refresh();  // full mermaid re-render
        }, DRAG_RENDER_INTERVAL);
      }
    } catch (ex) { /* ignore CTM errors */ }
  });

  // ── Document mouseup (end drag) ─────────────────────────────────────────
  document.addEventListener('mouseup', function(e) {
    // Sequence participant drag path
    if (seqDragState) {
      if (seqDragState.dragging) {
        var gapIdx = _seqComputeDropIndex(overlayEl, e.clientX);
        var seqMod = window.MA.modules && window.MA.modules.sequence;
        if (gapIdx !== null && seqMod && seqMod.moveParticipant) {
          var newText = seqMod.moveParticipant(mmdText, seqDragState.id, gapIdx);
          if (newText !== mmdText) {
            window.MA.history.pushHistory();
            mmdText = newText;
            suppressSync = true;
            editorEl.value = mmdText;
            suppressSync = false;
            syncLineNumbers();
            scheduleRefresh();
          }
        }
        if (seqDragState.ghostEl && seqDragState.ghostEl.parentNode) {
          seqDragState.ghostEl.parentNode.removeChild(seqDragState.ghostEl);
        }
        if (overlayEl) _seqClearDropIndicator(overlayEl);
        seqJustDraggedAt = Date.now();
      } else {
        // Plain click (no drag motion) → commit selection via selectItem so
        // toggle-off-on-reclick works consistently. Without this the
        // seqDragState was discarded and the participant was never selected.
        window.MA.selection.selectItem('participant', seqDragState.id, false);
      }
      seqDragState = null;
      return;
    }
    if (dragState) {
      dragState = null;
      clearTimeout(dragRenderTimer);
      dragRenderTimer = null;
      var tooltipEl = document.getElementById('drag-tooltip');
      if (tooltipEl) tooltipEl.style.display = 'none';
      // Clear drag visual feedback on any dragging bars
      if (overlayEl) {
        var draggingBars = overlayEl.querySelectorAll('[data-dragging="true"]');
        for (var dbi = 0; dbi < draggingBars.length; dbi++) {
          draggingBars[dbi].setAttribute('fill', 'transparent');
          draggingBars[dbi].removeAttribute('data-dragging');
        }
      }
      // Final full re-render
      refresh();
    }
  });

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  // Every hit area currently on the overlay, in the order it was drawn — which
  // is the order the module walked its parsed elements, i.e. document order.
  //
  // Reading the overlay rather than re-deriving a list from parsedData means the
  // keyboard walk and the mouse click always agree on what is selectable and on
  // what kind each thing is. A second list would drift from the first, which is
  // the failure mode this codebase keeps producing.
  function selectableItems() {
    var items = [];
    if (!overlayEl) return items;
    var tagged = overlayEl.querySelectorAll('[data-element-id][data-element-kind]');
    for (var i = 0; i < tagged.length; i++) {
      items.push({
        kind: tagged[i].getAttribute('data-element-kind'),
        id: tagged[i].getAttribute('data-element-id'),
      });
    }
    // gantt predates the data-element-* convention and tags bars with task ids.
    var bars = overlayEl.querySelectorAll('.overlay-bar[data-task-id]');
    for (var b = 0; b < bars.length; b++) {
      items.push({ kind: 'task', id: bars[b].getAttribute('data-task-id') });
    }
    return items;
  }

  // Move the selection to the next/previous element without touching the mouse.
  // There was no keyboard route between elements at all: selecting the twelfth
  // node meant finding it in the diagram or scrolling the properties list to it,
  // every time.
  function selectAdjacentElement(dir) {
    var items = selectableItems();
    if (!items.length) return false;
    var cur = -1;
    for (var i = 0; i < items.length; i++) {
      if (window.MA.selection.isSelected(items[i].id)) { cur = i; break; }
    }
    var next = cur < 0
      ? (dir > 0 ? 0 : items.length - 1)
      : (cur + dir + items.length) % items.length;
    // setSelected, not selectItem: selectItem toggles, and landing back on the
    // current element (a one-element diagram) would deselect instead of staying.
    window.MA.selection.setSelected([{ type: items[next].kind, id: items[next].id }]);
    return true;
  }

  document.addEventListener('keydown', function(e) {
    var tag = e.target.tagName;
    var inInput = (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA');
    var inEditor = (e.target === editorEl);

    if (e.key === 'Escape' && seqDragState && seqDragState.dragging) {
      if (seqDragState.ghostEl && seqDragState.ghostEl.parentNode) {
        seqDragState.ghostEl.parentNode.removeChild(seqDragState.ghostEl);
      }
      if (overlayEl) _seqClearDropIndicator(overlayEl);
      seqDragState = null;
      return;
    }
    // Ctrl+Z / Ctrl+Y always drive the app's history, including inside the
    // editor.
    //
    // The editor used to be handed to the browser's native textarea undo. That
    // made Ctrl+Z mean two different things depending on where the caret was —
    // character-level inside the editor, operation-level everywhere else — and,
    // worse, the native stack knows nothing about GUI edits: after changing a
    // task through the properties panel, clicking into the editor and pressing
    // Ctrl+Z could not undo that change at all. The two stacks also fought each
    // other: a native undo fires `input`, which pushed the half-undone text back
    // onto the app's stack.
    //
    // IME composition is left alone; taking Ctrl+Z during conversion would break
    // candidate selection.
    // Shift を除外しないと Ctrl+Shift+Z がここに先に吸われて Undo になる。
    // ブラウザによって Shift+z の e.key は 'Z' にも 'z' にもなるので、
    // 文字の大小ではなく **shiftKey で** 分ける。
    if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z') && !e.isComposing) {
      e.preventDefault();
      // 合図が工具列ボタンの無効化しか無く、キーボードで押している人には
      // **どこまで戻ったかが分からなかった**。実測: 90打鍵したあと押し続けると
      // 自分が編集を始める前 (起動時のひな形) まで無言で戻る。
      var couldUndo = window.MA.history.canUndo();
      window.MA.history.undo();
      showUndoDepth(couldUndo ? '元に戻しました' : 'これ以上戻せません');
    } else if (e.ctrlKey && (e.key === 'y' || ((e.key === 'Z' || e.key === 'z') && e.shiftKey)) && !e.isComposing) {
      // Ctrl+Shift+Z は Figma / draw.io / VSCode で Redo 。Shift 併用だと e.key は 'Z' に
      // なるので、小文字比較だけだと分岐に入らない。
      e.preventDefault(); var couldRedo = window.MA.history.canRedo();
      window.MA.history.redo();
      showUndoDepth(couldRedo ? 'やり直しました' : 'これ以上やり直せません');
    } else if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      saveFileAs();
    } else if (e.ctrlKey && e.key === 's') {
      e.preventDefault(); saveFile();
    } else if (e.ctrlKey && (e.key === '0' || e.key === '9' || e.key === '+' ||
                             e.key === '=' || e.key === '-')) {
      // 拡大して細部を見る→全体に戻すは1日数十回。毎回ツールバーへ
      // マウスを往復させていた (プレビュー中央から約400〜600px)。
      e.preventDefault();
      if (e.key === '0') setZoomFromUser(1.0);
      else if (e.key === '9') zoomToFit();
      else if (e.key === '-') setZoomFromUser(zoom - 0.1);
      else setZoomFromUser(zoom + 0.1);
    } else if (e.ctrlKey && e.key === 'o') {
      e.preventDefault(); openFile();
    } else if (e.key === 'Delete' && !inInput && !inEditor) {
      if (sel.length === 0) return;
      // 契約 (ADR-012 operations.delete) で消す。
      //
      // 以前は `parsed.tasks` を見て gantt だけを処理し、他の20図種には
      // 「Delete キーの削除は未対応 — 一覧の ✕ を使ってください」と返していた。
      // 契約は既に全21図種で揃っているのに、この経路だけが gantt 専用の
      // 旧実装のまま残っていた。**削除1回ごとにマウス往復が1回**発生する。
      // キーボード中心で1日100回消すなら100往復。
      deleteSelectedElements(sel);
    } else if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey && !e.altKey && !inInput && !inEditor) {
      // 修飾なし1打鍵。Delete / ? と同じ条件 (入力欄とエディタの外にいるとき) で受ける。
      e.preventDefault();
      focusAddForm();
    } else if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && !e.altKey && !inInput && !inEditor) {
      e.preventDefault();
      focusEditor();
    } else if (e.key === 'F1' && !e.ctrlKey && !e.altKey) {
      // `?` は本文に打てる文字なので、エディタと入力欄では出せない。
      // **利用者が一番長くいる場所 (エディタ) でだけヘルプを呼べなかった。**
      // 実測: エディタにカーソルがある状態で `?` を押すと、ヘルプは出ず
      // 本文に「?」が入る。F1 はどこにいても効かせる。
      e.preventDefault();
      toggleShortcutHelp();
    } else if (e.key === '?' && !inInput && !inEditor) {
      // ショートカットが12個あるのに、それを知る手段が画面に無かった。
      // キーボード中心の人にとって一番価値のある部分が伝わっていない。
      e.preventDefault();
      toggleShortcutHelp();
    } else if (e.key === 'Escape' &&
               document.getElementById('shortcut-help') &&
               !document.getElementById('shortcut-help').hasAttribute('hidden')) {
      toggleShortcutHelp(false);
      focusPreview();
    } else if (e.key === 'Escape') {
      // Escape has to get out of connection mode too. Without it the only way
      // to leave was to complete the edge — clicking anywhere else on the canvas
      // just drew the line you had changed your mind about.
      if (window.MA.connectionMode.isInConnectionMode()) {
        window.MA.connectionMode.cancelConnectionMode();
        renderStatus();
        return;
      }
      window.MA.selection.clearSelection();
    } else if (!inEditor && !inInput && !e.ctrlKey && !e.altKey && !e.metaKey &&
               !window.MA.connectionMode.isInConnectionMode() &&
               (e.key === 'ArrowDown' || e.key === 'ArrowRight' ||
                e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
      // 接続モード中は選択を動かさない。動かすと選択の緑枠が「これを編集中」
      // と言い、ステータスバーは「相手をクリック」と言う、という食い違いが
      // 画面に同時に出る
      // 次/前の要素へ。順序は図の宣言順 (オーバーレイの描画順) なので、
      // どの図種でも「上から順に見ていく」動きになる。
      var forward = (e.key === 'ArrowDown' || e.key === 'ArrowRight');
      if (selectAdjacentElement(forward ? 1 : -1)) e.preventDefault();
    } else if (e.ctrlKey && e.key === 'a' && !inEditor && !inInput) {
      // 選択・コピー・削除は gantt の `parsed.tasks` 前提で書かれていた。
      // 他の図種では `parsed.tasks` が undefined なので `.map` で例外になり、
      // コンソールにしか出ないので利用者には「押しても何も起きない」としか見えない。
      // 未対応なら例外を出さず、その旨をステータスに出す。
      e.preventDefault();
      if (!parsed || !parsed.tasks) { showTransient('すべて選択は未対応 — この図種では一覧から選んでください', 3000); return; }
      window.MA.selection.setSelected(parsed.tasks.map(function(t) { return { type: 'task', id: t.id }; }));
    } else if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault(); exportClipboard();
    } else if (e.ctrlKey && e.key === 'c' && !inEditor && !inInput && sel.length > 0) {
      e.preventDefault();
      if (!parsed || !parsed.tasks) { showTransient('要素の複写は未対応 — エディタで行をコピーしてください', 3000); return; }
      clipboard = sel.map(function(s) {
        return parsed.tasks.find(function(t) { return t.id === s.id; });
      }).filter(Boolean);
    } else if (e.ctrlKey && e.key === 'v' && !inEditor && !inInput && clipboard && clipboard.length > 0) {
      e.preventDefault();
      window.MA.history.pushHistory();
      clipboard.forEach(function(t) {
        var newId = 't' + (++addCounter);
        var newStart = t.startDate ? window.MA.dateUtils.addDays(t.startDate, 7) : null;
        var newEnd = t.endDate && !isDuration(t.endDate) ? window.MA.dateUtils.addDays(t.endDate, 7) : t.endDate;
        mmdText = addTask(mmdText, t.sectionIndex, t.label, newId, newStart, newEnd);
      });
      suppressSync = true;
      editorEl.value = mmdText;
      suppressSync = false;
      syncLineNumbers();
      scheduleRefresh();
    }
  });

  // ── Pane Resizers ─────────────────────────────────────────────────────────
  function setupResizer(resizerId, leftPaneId, rightPaneId, direction) {
    var resizer = document.getElementById(resizerId);
    var leftPane = document.getElementById(leftPaneId);
    var rightPane = document.getElementById(rightPaneId);
    if (!resizer) return;
    if (direction === 'left' && !leftPane) return;
    if (direction === 'right' && !rightPane) return;

    var startX, startLeftW, startRightW;

    resizer.addEventListener('mousedown', function(e) {
      e.preventDefault();
      startX = e.clientX;
      if (leftPane) startLeftW = leftPane.getBoundingClientRect().width;
      if (rightPane) startRightW = rightPane.getBoundingClientRect().width;
      resizer.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      function onMouseMove(e2) {
        var dx = e2.clientX - startX;
        if (direction === 'left') {
          var newW = Math.max(150, startLeftW + dx);
          leftPane.style.width = newW + 'px';
        } else if (direction === 'right') {
          var newW2 = Math.max(150, startRightW - dx);
          rightPane.style.width = newW2 + 'px';
        }
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        resizer.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Re-render with new container width
        scheduleRefresh();
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  setupResizer('resizer-left', 'editor-pane', null, 'left');
  setupResizer('resizer-right', null, 'props-pane', 'right');

  // ── Diagram type select ──────────────────────────────────────────────────
  var diagramTypeSelect = document.getElementById('diagram-type');
  if (diagramTypeSelect) {
    diagramTypeSelect.addEventListener('change', function() {
      var targetType = this.value;
      var mod = modules[targetType];
      if (!mod) return;
      // Switching type replaces the whole document with a template. Undo does
      // bring it back, but nothing on screen says so, and the dropdown sits in
      // the toolbar where a mis-click costs the entire diagram.
      //
      // The confirm comes first: bailing out must leave the view untouched.
      var currentTemplate = currentModule && currentModule.template ? currentModule.template() : null;
      if (hasUnsavedWork(mmdText, savedText, currentTemplate) &&
          !confirm('図の種類を変えると、いま書いている内容は ' + targetType + ' のひな形に置き換わります。続けますか？')) {
        this.value = currentModule ? currentModule.type : this.value;
        return;
      }
      // Connection mode belongs to the document that started it. Left running
      // across a type switch, the next click connected an id from the old
      // diagram to one in the new one: starting from flowchart's `A` and
      // switching to block-beta produced the line `A --> b`, naming a node that
      // does not exist in that diagram.
      window.MA.connectionMode.cancelConnectionMode();
      // The view goes back to what a fresh document shows. Resetting to 'detail'
      // here (as this used to) left the readout saying "100%" while the chart was
      // actually drawn at fit width — no way to tell which mode you were in.
      setGanttViewMode('overview');
      setZoom(1.0);
      window.MA.history.pushHistory();
      pendingAutoFit = true;
      mmdText = mod.template();
      loadedFileName = '';
      // 文書が入れ替わったので、モジュールが持っている一時状態を捨てさせる。
      // 実装していないモジュールは何もしなくてよい (フォームを毎回作り直すため)。
      if (mod.resetTransientState) mod.resetTransientState();
      clearListFilter();
      markSaved();
      suppressSync = true;
      editorEl.value = mmdText;
      suppressSync = false;
      window.MA.selection.clearSelection();
      syncLineNumbers();
      scheduleRefresh();
    });
  }

  // The tab is the only place the diagram exists. Without this, closing it or
  // navigating away discards everything silently.
  window.addEventListener('beforeunload', function(e) {
    var tpl = currentModule && currentModule.template ? currentModule.template() : null;
    if (!hasUnsavedWork(mmdText, savedText, tpl)) return;
    e.preventDefault();
    e.returnValue = '';
    return '';
  });

  // ── Initial render ───────────────────────────────────────────────────────
  scheduleRefresh();
}


// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

// ── Export hook for tests ──────────────────────────────────────────────────
if (typeof __exportForTest === 'function') {
  __exportForTest({
    downloadBaseName: downloadBaseName,
    sanitizeFileName: sanitizeFileName,
    hasUnsavedWork: hasUnsavedWork,
    statusInfoText: statusInfoText,
    parseGantt: parseGantt,
    updateTaskDates: updateTaskDates,
    updateTaskField: updateTaskField,
    addTask: addTask,
    deleteTask: deleteTask,
    daysBetween: window.MA.dateUtils.daysBetween,
    addDays: window.MA.dateUtils.addDays,
    ganttAxisFor: ganttAxisFor,
    ganttSpanDays: ganttSpanDays,
    DETAIL_PX_PER_DAY: DETAIL_PX_PER_DAY,
  });
}
