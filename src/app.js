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
    if (currentModule.type === 'gantt') {
      currentModule.buildOverlay(svgEl, parsed);
    } else {
      currentModule.buildOverlay(svgEl, parsed, overlayEl);
    }
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
var addForm = { label: '', id: '', start: '', end: '', kind: 'task', focus: null };

// Which field to focus after the panel is rebuilt, so a continuous run of adds
// does not need a click between each one.
function setAddFormFocus(field) { addForm.focus = field; }

// The section the add form should be pointing at. Falls back to the first
// section when the remembered one no longer exists (the user deleted it), and to
// -1 when there are no sections at all.
function addFormSectionIndex(parsedData) {
  var count = (parsedData && parsedData.sections) ? parsedData.sections.length : 0;
  if (count === 0) return -1;
  var want = parseInt(addForm.section, 10);
  if (isNaN(want) || want < 0 || want >= count) return 0;
  return want;
}
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
  buildOverlay: function(svgEl, parsedData) {
    if (!overlayEl) return;
    // Clear previous overlay content
    while (overlayEl.firstChild) overlayEl.removeChild(overlayEl.firstChild);

    if (!svgEl || !parsedData || !parsedData.tasks || parsedData.tasks.length === 0) return;

    // Calibrate scale
    calibrateScale(svgEl, parsedData);

    // Match overlay SVG dimensions/viewBox to the mermaid SVG
    var viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) {
      overlayEl.setAttribute('viewBox', viewBox);
    }
    var svgW = svgEl.getAttribute('width');
    var svgH = svgEl.getAttribute('height');
    if (svgW) overlayEl.setAttribute('width', svgW);
    if (svgH) overlayEl.setAttribute('height', svgH);

    var NS = 'http://www.w3.org/2000/svg';
    var barRects = window.MA.modules.gantt.getCalibration().barRects;

    for (var i = 0; i < parsedData.tasks.length; i++) {
      var task = parsedData.tasks[i];
      var br = i < barRects.length ? barRects[i] : null;
      if (!br) continue; // skip tasks we couldn't match to SVG rects
      var selected = window.MA.selection.isSelected(task.id);

      // If selected: add green dashed highlight rect
      if (selected) {
        var hlRect = document.createElementNS(NS, 'rect');
        hlRect.setAttribute('x', br.x - 2);
        hlRect.setAttribute('y', br.y - 2);
        hlRect.setAttribute('width', br.width + 4);
        hlRect.setAttribute('height', br.height + 4);
        hlRect.setAttribute('fill', 'none');
        hlRect.setAttribute('stroke', '#7ee787');
        hlRect.setAttribute('stroke-width', '2');
        hlRect.setAttribute('stroke-dasharray', '4');
        hlRect.setAttribute('rx', '3');
        overlayEl.appendChild(hlRect);
      }

      // Transparent overlay bar rect
      var overlayRect = document.createElementNS(NS, 'rect');
      overlayRect.setAttribute('x', br.x);
      overlayRect.setAttribute('y', br.y);
      overlayRect.setAttribute('width', br.width);
      overlayRect.setAttribute('height', br.height);
      overlayRect.setAttribute('fill', 'transparent');
      overlayRect.setAttribute('cursor', 'move');
      overlayRect.setAttribute('class', 'overlay-bar');
      overlayRect.setAttribute('data-task-id', task.id);
      overlayRect.setAttribute('data-type', 'task');
      overlayRect.setAttribute('data-line', task.line);
      overlayRect.setAttribute('data-index', i);
      overlayEl.appendChild(overlayRect);

      // Left resize handle
      var leftHandle = document.createElementNS(NS, 'rect');
      leftHandle.setAttribute('x', br.x);
      leftHandle.setAttribute('y', br.y);
      leftHandle.setAttribute('width', '6');
      leftHandle.setAttribute('height', br.height);
      leftHandle.setAttribute('fill', selected ? '#7ee787' : 'transparent');
      leftHandle.setAttribute('opacity', selected ? '0.7' : '0');
      leftHandle.setAttribute('cursor', 'w-resize');
      leftHandle.setAttribute('class', 'resize-handle');
      leftHandle.setAttribute('data-task-id', task.id);
      leftHandle.setAttribute('data-handle', 'left');
      leftHandle.setAttribute('data-line', task.line);
      leftHandle.setAttribute('data-index', i);
      overlayEl.appendChild(leftHandle);

      // Right resize handle
      var rightHandle = document.createElementNS(NS, 'rect');
      rightHandle.setAttribute('x', br.x + br.width - 6);
      rightHandle.setAttribute('y', br.y);
      rightHandle.setAttribute('width', '6');
      rightHandle.setAttribute('height', br.height);
      rightHandle.setAttribute('fill', selected ? '#7ee787' : 'transparent');
      rightHandle.setAttribute('opacity', selected ? '0.7' : '0');
      rightHandle.setAttribute('cursor', 'e-resize');
      rightHandle.setAttribute('class', 'resize-handle');
      rightHandle.setAttribute('data-task-id', task.id);
      rightHandle.setAttribute('data-handle', 'right');
      rightHandle.setAttribute('data-line', task.line);
      rightHandle.setAttribute('data-index', i);
      overlayEl.appendChild(rightHandle);
    }
  },
  renderProps: function(selData, parsedData) {
    if (!propsEl) return;

    // No selection
    if (!selData || selData.length === 0) {
      var sectionOptions = '';
      if (parsedData && parsedData.sections) {
        var keepSec = addFormSectionIndex(parsedData);
        for (var si = 0; si < parsedData.sections.length; si++) {
          // The chosen section has to survive the rebuild too, otherwise every
          // keystroke drops the user back to the first section.
          var selAttr = (String(si) === String(keepSec)) ? ' selected' : '';
          sectionOptions += '<option value="' + si + '"' + selAttr + '>' + window.MA.htmlUtils.escHtml(parsedData.sections[si].name) + '</option>';
        }
      }
      if (!sectionOptions) {
        sectionOptions = '<option value="-1">（セクションなし）</option>';
      }

      var sectionListHtml = '';
      if (parsedData && parsedData.sections && parsedData.sections.length > 0) {
        sectionListHtml += '<div id="prop-section-list" style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:12px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">セクション一覧</label>';
        for (var sli = 0; sli < parsedData.sections.length; sli++) {
          var sec = parsedData.sections[sli];
          var taskCount = 0;
          for (var sti = 0; sti < parsedData.tasks.length; sti++) {
            if (parsedData.tasks[sti].sectionIndex === sli) taskCount++;
          }
          sectionListHtml +=
            '<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;padding:3px 4px;background:var(--bg-tertiary);border-radius:3px;">' +
              '<div style="flex:1;font-size:11px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + window.MA.htmlUtils.escHtml(sec.name) + '">' + window.MA.htmlUtils.escHtml(sec.name) + ' <span style="color:var(--text-secondary);font-size:10px;">(' + taskCount + ')</span></div>' +
              '<button class="prop-section-up" data-section-line="' + sec.line + '" title="上のセクションと入れ替え" style="background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);width:20px;height:20px;border-radius:3px;cursor:pointer;font-size:10px;padding:0;">↑</button>' +
              '<button class="prop-section-down" data-section-line="' + sec.line + '" title="下のセクションと入れ替え" style="background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);width:20px;height:20px;border-radius:3px;cursor:pointer;font-size:10px;padding:0;">↓</button>' +
              // 巻き添えの件数をボタン自体に出す (block と同じ手)。
              // 以前はここだけ confirm を出していて、同じ画面のタスク ✕ は無言、
              // block は件数表示と、3通りの作法が混在していた。押す前に何が起きるかを
              // ボタンの文字で示し、確認は出さない (Undo で戻せる)。
              '<button class="prop-section-delete" data-section-name="' + window.MA.htmlUtils.escHtml(sec.name) + '" data-section-line="' + sec.line + '" data-task-count="' + taskCount + '" title="セクション「' + window.MA.htmlUtils.escHtml(sec.name) + '」と含まれるタスク' + taskCount + '件を削除" style="background:var(--accent-red);color:#fff;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;white-space:nowrap;">✕' + (taskCount > 0 ? taskCount : '') + '</button>' +
            '</div>';

          // セクションの下にタスクを並べる。
          //
          // gantt だけプロパティ欄にタスク一覧が無く、タスクを選ぶ手段が
          // 「チャート上のバーをクリックする」しか無かった。他の20図種には一覧がある。
          // 4件なら困らないが、100件になるとバーを目で探すしかなくなり、
          // 一覧を持つ他の図種との差が実務で効いてくる (R8 スケール耐性)。
          for (var tli = 0; tli < parsedData.tasks.length; tli++) {
            var tk = parsedData.tasks[tli];
            if (tk.sectionIndex !== sli) continue;
            var tkLabel = window.MA.htmlUtils.escHtml(tk.label || tk.id || '');
            var tkId = window.MA.htmlUtils.escHtml(tk.id || '');
            sectionListHtml +=
              '<div class="ma-list-row" style="display:flex;align-items:center;gap:4px;margin:0 0 3px 14px;padding:2px 4px;background:var(--bg-primary);border-radius:3px;">' +
                '<div style="flex:1;font-size:11px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + tkLabel + '">' + tkLabel + '</div>' +
                '<button class="prop-task-select" data-element-id="' + tkId + '" data-line="' + tk.line + '" title="「' + tkLabel + '」を選択" style="background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">編集</button>' +
                '<button class="prop-task-delete" data-element-id="' + tkId + '" data-line="' + tk.line + '" title="「' + tkLabel + '」を削除" style="background:var(--accent-red);color:#fff;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">✕</button>' +
              '</div>';
          }
        }
        sectionListHtml += '</div>';
      } else {
        sectionListHtml = '<div id="prop-section-list" style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:12px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:4px;">セクション一覧</label>' +
          '<div style="font-size:11px;color:var(--text-secondary);">（セクションなし）</div>' +
        '</div>';
      }

      var G = window.MA.modules.gantt;
      var addSecIdx = parseInt(addFormSectionIndex(parsedData), 10);
      var isMilestone = addForm.kind === 'milestone';
      // Only used to prefill an empty field: a value the user typed wins.
      var autoStart = G.nextStartDate(mmdText, addSecIdx);
      var autoDays = G.nextDurationDays(mmdText, addSecIdx);
      var autoEnd = (autoStart && autoDays !== null)
        ? window.MA.dateUtils.addDays(autoStart, autoDays) : '';
      var fStart = addForm.start || autoStart || '';
      var fEnd = addForm.end || autoEnd || '';
      var inputStyle = 'width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;';
      var esc = window.MA.htmlUtils.escHtml;

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">タスクを選択するか、新規追加</div>' +
        // 種別トグル。status を唯一の真とし、これはその入力手段でしかない。
        '<div style="margin-bottom:8px;display:flex;gap:2px;">' +
          '<button id="prop-add-kind-task" style="flex:1;background:' + (isMilestone ? 'var(--bg-tertiary)' : 'var(--accent)') + ';color:' + (isMilestone ? 'var(--text-primary)' : '#fff') + ';border:1px solid var(--border);padding:3px 4px;border-radius:3px;cursor:pointer;font-size:10px;">タスク</button>' +
          '<button id="prop-add-kind-milestone" style="flex:1;background:' + (isMilestone ? 'var(--accent)' : 'var(--bg-tertiary)') + ';color:' + (isMilestone ? '#fff' : 'var(--text-primary)') + ';border:1px solid var(--border);padding:3px 4px;border-radius:3px;cursor:pointer;font-size:10px;">マイルストーン</button>' +
        '</div>' +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">ラベル</label>' +
          '<input id="prop-add-label" type="text" value="' + esc(addForm.label || '新規タスク') + '" style="' + inputStyle + '">' +
        '</div>' +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">ID</label>' +
          '<input id="prop-add-id" type="text" value="' + esc(addForm.id) + '" placeholder="' + esc(G.nextTaskId(mmdText)) + '" style="' + inputStyle + '">' +
        '</div>' +
        (isMilestone
          ? '<div style="margin-bottom:8px;">' +
              '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">日付</label>' +
              '<input id="prop-add-start" type="date" value="' + esc(fStart) + '" style="' + inputStyle + '">' +
            '</div>'
          : '<div style="margin-bottom:8px;">' +
              '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">開始日</label>' +
              '<input id="prop-add-start" type="date" value="' + esc(fStart) + '" style="' + inputStyle + '">' +
            '</div>' +
            '<div style="margin-bottom:8px;">' +
              '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">終了日</label>' +
              '<input id="prop-add-end" type="date" value="' + esc(fEnd) + '" style="' + inputStyle + '">' +
            '</div>') +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">セクション</label>' +
          '<select id="prop-add-section" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + sectionOptions + '</select>' +
        '</div>' +
        '<button id="prop-add-btn" style="width:100%;background:var(--accent);color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;margin-bottom:12px;">+ タスク追加</button>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px;margin-bottom:12px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">セクション追加</label>' +
          '<div style="display:flex;gap:4px;">' +
            '<input id="prop-add-sec-name" type="text" placeholder="セクション名" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' +
            '<button id="prop-add-sec-btn" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:12px;">+</button>' +
          '</div>' +
        '</div>' +
        sectionListHtml +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:6px;font-weight:bold;">グローバル設定</label>' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">title</label>' +
          '<input id="prop-global-title" type="text" value="' + window.MA.htmlUtils.escHtml(parsedData.title || '') + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;margin-bottom:6px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">dateFormat</label>' +
          '<input id="prop-global-dateformat" type="text" value="' + window.MA.htmlUtils.escHtml(parsedData.dateFormat || 'YYYY-MM-DD') + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;margin-bottom:6px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">axisFormat</label>' +
          (function() {
            var presets = [
              { v: '%Y-%m-%d', label: '2026-04-14' },
              { v: '%Y/%m/%d', label: '2026/04/14' },
              { v: '%m/%d',    label: '04/14' },
              { v: '%m月%d日', label: '04月14日' },
              { v: '%b %d',    label: 'Apr 14' },
              { v: '%d %b',    label: '14 Apr' },
              { v: '%a',       label: 'Tue (曜日)' }
            ];
            var current = parsedData.axisFormat || '';
            // No axisFormat line means the app picks the granularity from the
            // project span (ganttAxisFor). That is a real, named state — showing
            // "カスタム…" with an empty box says the user chose something custom
            // and then failed to type it, which is the opposite of what is
            // happening.
            var auto = !current;
            var matched = false;
            var opts = '<option value="__auto__"' + (auto ? ' selected' : '') +
              '>自動 (期間に合わせる)</option>';
            for (var pi = 0; pi < presets.length; pi++) {
              var sel = (presets[pi].v === current) ? ' selected' : '';
              if (sel) matched = true;
              opts += '<option value="' + window.MA.htmlUtils.escHtml(presets[pi].v) + '"' + sel + '>' + window.MA.htmlUtils.escHtml(presets[pi].label + '  (' + presets[pi].v + ')') + '</option>';
            }
            var customSel = (matched || auto) ? '' : ' selected';
            opts += '<option value="__custom__"' + customSel + '>カスタム…</option>';
            var customDisplay = (matched || auto) ? 'none' : 'block';
            return '<select id="prop-axisformat-preset" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;margin-bottom:4px;">' + opts + '</select>' +
              '<input id="prop-axisformat-custom" type="text" value="' + window.MA.htmlUtils.escHtml(current) + '" placeholder="%m/%d" style="display:' + customDisplay + ';width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">';
          })() +
        '</div>';

      // Keep every field in addForm as it is typed, so the next rebuild restores
      // it instead of resetting to the hardcoded defaults.
      ['label', 'id', 'start', 'end'].forEach(function(field) {
        var el = document.getElementById('prop-add-' + field);
        if (!el) return;
        el.addEventListener('input', function() { addForm[field] = this.value; });
        // Enter anywhere in the form adds the task — the add button is below the
        // fold on a short panel and the round trip to it is the whole friction.
        el.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') { e.preventDefault(); doAddTask(); }
        });
      });
      var secSel = document.getElementById('prop-add-section');
      if (secSel) {
        secSel.addEventListener('change', function() { addForm.section = this.value; });
      }

      window.MA.properties.bindEvent('prop-add-kind-task', 'click', function() {
        addForm.kind = 'task';
        setAddFormFocus('label');
        renderProps();
      });
      window.MA.properties.bindEvent('prop-add-kind-milestone', 'click', function() {
        addForm.kind = 'milestone';
        setAddFormFocus('label');
        renderProps();
      });

      function doAddTask() {
        var labelEl = document.getElementById('prop-add-label');
        var idEl = document.getElementById('prop-add-id');
        var startEl = document.getElementById('prop-add-start');
        var endEl = document.getElementById('prop-add-end');
        var secEl = document.getElementById('prop-add-section');
        var label = (labelEl && labelEl.value) || '新規タスク';
        var id = (idEl && idEl.value) ? idEl.value : window.MA.modules.gantt.nextTaskId(mmdText);
        var start = startEl ? startEl.value : '';
        var secIdx = secEl ? parseInt(secEl.value, 10) : -1;
        var milestone = addForm.kind === 'milestone';
        // Without a date there is nothing to place the bar at; mermaid resolves a
        // missing start to the chart origin, which reads as a task that silently
        // jumped to the beginning of the project.
        if (!start) {
          // フォーカスを移すだけでは何が起きたのか分からない。
          // 押しても何も起きないのが一番困る (C4 は「ID と Label は必須」と言うのに
          // こちらだけ無言だった) ので、理由をその場で言う。
          if (startEl) startEl.focus();
          showTransient('開始日を入れてください — 日付が無いとバーを置く位置が決まりません', 4000);
          return;
        }
        var end = milestone ? '0d' : ((endEl && endEl.value) || start);
        window.MA.history.pushHistory();
        mmdText = addTask(mmdText, secIdx, label, id, start, end, milestone ? 'milestone' : null);
        // 追加したタスクを自動選択しない。
        //
        // 選択するとプロパティパネルが詳細表示に切り替わり、**追加フォームごと
        // 消える**。「ラベル欄へフォーカスを戻して連続入力」と真正面から
        // 矛盾していて、実測でも追加直後のパネルは詳細表示になり
        // prop-add-label が存在しなかった。5本続けて足したいときに毎回
        // Escape を押して戻る必要がある。
        //
        // 追加した結果は図とエディタに出るので、確認手段は失われない。
        window.MA.selection.clearSelection();
        // Clear only what identifies this task. The section and the kind are the
        // user's current context and carry over to the next add; the dates are
        // recomputed from the task just added.
        addForm.label = '';
        addForm.id = '';
        addForm.start = '';
        addForm.end = '';
        addForm.section = secEl ? secEl.value : addForm.section;
        setAddFormFocus('label');
        suppressSync = true;
        editorEl.value = mmdText;
        suppressSync = false;
        syncLineNumbers();
        scheduleRefresh();
        // renderPropsは scheduleRefresh → refresh → renderProps で自動的に呼ばれるので、追加呼び出しは不要
      }

      window.MA.properties.bindEvent('prop-add-btn', 'click', doAddTask);

      // Restore focus after the rebuild that follows an add or a kind switch.
      if (addForm.focus) {
        var focusEl = document.getElementById('prop-add-' + addForm.focus);
        addForm.focus = null;
        if (focusEl) {
          focusEl.focus();
          if (focusEl.select) focusEl.select();
        }
      }

      // Bind add section button
      var addSecBtn = document.getElementById('prop-add-sec-btn');
      if (addSecBtn) {
        addSecBtn.addEventListener('click', function() {
          var name = document.getElementById('prop-add-sec-name').value.trim();
          if (!name) return;
          window.MA.history.pushHistory();
          mmdText = addSection(mmdText, name);
          suppressSync = true;
          editorEl.value = mmdText;
          suppressSync = false;
          syncLineNumbers();
          scheduleRefresh();
        });
      }

      // Bind section move buttons. Sections own the tasks between their header and
      // the next one, so moving a section carries its tasks along — the task-level
      // ↑↓ only reorders within a section.
      ['up', 'down'].forEach(function(dir) {
        var btns = propsEl.querySelectorAll('.prop-section-' + dir);
        for (var mi = 0; mi < btns.length; mi++) {
          btns[mi].addEventListener('click', function() {
            var ln = parseInt(this.getAttribute('data-section-line'), 10);
            if (isNaN(ln)) return;
            var moved = window.MA.modules.gantt.moveSection(mmdText, ln, dir === 'up' ? -1 : 1);
            if (moved === mmdText) return; // at the edge — nothing to do
            window.MA.history.pushHistory();
            mmdText = moved;
            suppressSync = true;
            editorEl.value = mmdText;
            suppressSync = false;
            syncLineNumbers();
            scheduleRefresh();
          });
        }
      });

      // Bind section delete buttons
      var sectionDeleteBtns = propsEl.querySelectorAll('.prop-section-delete');
      for (var sdbi = 0; sdbi < sectionDeleteBtns.length; sdbi++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            var secName = btn.getAttribute('data-section-name');
            var secLine = parseInt(btn.getAttribute('data-section-line'), 10);
            var secTasks = parseInt(btn.getAttribute('data-task-count'), 10) || 0;
            window.MA.history.pushHistory();
            mmdText = deleteSection(mmdText, secLine);
            suppressSync = true;
            editorEl.value = mmdText;
            suppressSync = false;
            window.MA.selection.setSelected([]);
            syncLineNumbers();
            showTransient('セクション「' + secName + '」とタスク' + secTasks +
              '件を削除 — Ctrl+Z で戻せます');
            scheduleRefresh();
          });
        })(sectionDeleteBtns[sdbi]);
      }

      // Bind task list (select / delete)
      //
      // 選択は他の図種と同じく selection に載せるだけ。バーをクリックした場合と
      // 同じ状態にしたいので、id で選ぶ (行番号は編集で動く)。
      var taskSelBtns = propsEl.querySelectorAll('.prop-task-select');
      for (var tsi = 0; tsi < taskSelBtns.length; tsi++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            var id = btn.getAttribute('data-element-id');
            if (!id) return;
            window.MA.selection.setSelected([{ type: 'task', id: id }]);
            scheduleRefresh();
          });
        })(taskSelBtns[tsi]);
      }
      var taskDelBtns = propsEl.querySelectorAll('.prop-task-delete');
      for (var tdi = 0; tdi < taskDelBtns.length; tdi++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            var ln = parseInt(btn.getAttribute('data-line'), 10);
            if (isNaN(ln)) return;
            window.MA.history.pushHistory();
            mmdText = deleteTask(mmdText, ln);
            suppressSync = true;
            editorEl.value = mmdText;
            suppressSync = false;
            window.MA.selection.setSelected([]);
            syncLineNumbers();
            scheduleRefresh();
          });
        })(taskDelBtns[tdi]);
      }

      // Bind global settings
      function bindGlobal(elId, key) {
        var el = document.getElementById(elId);
        if (el) {
          el.addEventListener('change', function() {
            window.MA.history.pushHistory();
            mmdText = updateGlobalSetting(mmdText, key, el.value);
            suppressSync = true;
            editorEl.value = mmdText;
            suppressSync = false;
            syncLineNumbers();
            scheduleRefresh();
          });
        }
      }
      bindGlobal('prop-global-title', 'title');
      bindGlobal('prop-global-dateformat', 'dateFormat');
      // axisFormat: preset dropdown + custom input
      var afPreset = document.getElementById('prop-axisformat-preset');
      var afCustom = document.getElementById('prop-axisformat-custom');
      if (afPreset) {
        afPreset.addEventListener('change', function() {
          var v = afPreset.value;
          if (v === '__custom__') {
            if (afCustom) {
              afCustom.style.display = 'block';
              afCustom.focus();
            }
            return; // don't update text yet — wait for custom input change
          }
          if (afCustom) afCustom.style.display = 'none';
          window.MA.history.pushHistory();
          // 自動 = the axisFormat line is absent, so the app derives the tick
          // granularity from the project span. Writing a value here would pin it
          // again, because the DSL line beats the config.
          if (v === '__auto__') {
            mmdText = window.MA.modules.gantt.removeGlobalSetting(mmdText, 'axisFormat');
            suppressSync = true;
            editorEl.value = mmdText;
            suppressSync = false;
            syncLineNumbers();
            scheduleRefresh();
            return;
          }
          mmdText = updateGlobalSetting(mmdText, 'axisFormat', v);
          suppressSync = true;
          editorEl.value = mmdText;
          suppressSync = false;
          syncLineNumbers();
          scheduleRefresh();
        });
      }
      if (afCustom) {
        afCustom.addEventListener('change', function() {
          window.MA.history.pushHistory();
          mmdText = updateGlobalSetting(mmdText, 'axisFormat', afCustom.value);
          suppressSync = true;
          editorEl.value = mmdText;
          suppressSync = false;
          syncLineNumbers();
          scheduleRefresh();
        });
      }
      return;
    }

    // Single task selected
    if (selData.length === 1 && selData[0].type === 'task') {
      var taskId = selData[0].id;
      var task = null;
      if (parsedData && parsedData.tasks) {
        for (var ti = 0; ti < parsedData.tasks.length; ti++) {
          if (parsedData.tasks[ti].id === taskId) { task = parsedData.tasks[ti]; break; }
        }
      }
      if (!task) {
        propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">タスクが見つかりません</p>';
        return;
      }

      var statusBtns = ['none', 'done', 'active', 'crit', 'milestone'].map(function(s) {
        var isActive = (s === 'none' && !task.status) || (task.status === s);
        var bg = isActive ? 'var(--accent)' : 'var(--bg-tertiary)';
        var val = s === 'none' ? '' : s;
        return '<button class="prop-status-btn" data-status="' + val + '" style="flex:1;background:' + bg + ';color:var(--text-primary);border:1px solid var(--border);padding:3px 4px;border-radius:3px;cursor:pointer;font-size:10px;">' + s + '</button>';
      }).join('');

      var moveSecOpts = '';
      if (parsedData && parsedData.sections) {
        for (var msi = 0; msi < parsedData.sections.length; msi++) {
          var selAttr = (msi === task.sectionIndex) ? ' selected' : '';
          moveSecOpts += '<option value="' + msi + '"' + selAttr + '>' + window.MA.htmlUtils.escHtml(parsedData.sections[msi].name) + '</option>';
        }
      }
      if (!moveSecOpts) {
        moveSecOpts = '<option value="-1">（セクションなし）</option>';
      }

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;">' +
          '<div style="flex:1;font-weight:bold;color:var(--text-primary);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + window.MA.htmlUtils.escHtml(task.label) + '</div>' +
          '<button id="prop-move-up" title="同一セクション内で上へ移動" style="background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);width:24px;height:22px;border-radius:3px;cursor:pointer;font-size:12px;padding:0;">↑</button>' +
          '<button id="prop-move-down" title="同一セクション内で下へ移動" style="background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);width:24px;height:22px;border-radius:3px;cursor:pointer;font-size:12px;padding:0;">↓</button>' +
        '</div>' +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">ラベル</label>' +
          '<input id="prop-label" type="text" value="' + window.MA.htmlUtils.escHtml(task.label) + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' +
        '</div>' +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">ID</label>' +
          '<input id="prop-id" type="text" value="' + window.MA.htmlUtils.escHtml(window.MA.parserUtils.isAutoId(task.id) ? '' : task.id) + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' +
        '</div>' +
        // A milestone is a point in time; the second date field has nothing to
        // hold. status is the single source of truth for what a task is, so the
        // panel folds purely on it — the add form's kind toggle only ever writes
        // status, it never gets its own opinion.
        (task.status === 'milestone'
          ? '<div style="margin-bottom:8px;">' +
              '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">日付</label>' +
              '<input id="prop-start" type="date" value="' + window.MA.htmlUtils.escHtml(task.startDate || '') + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' +
            '</div>'
          : '<div style="margin-bottom:8px;">' +
              '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">開始日</label>' +
              '<input id="prop-start" type="date" value="' + window.MA.htmlUtils.escHtml(task.startDate || '') + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' +
            '</div>' +
            '<div style="margin-bottom:8px;">' +
              '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">終了日</label>' +
              '<input id="prop-end" type="date" value="' + window.MA.htmlUtils.escHtml(task.endDate || '') + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' +
            '</div>') +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">ステータス</label>' +
          '<div style="display:flex;gap:2px;">' + statusBtns + '</div>' +
        '</div>' +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">after依存</label>' +
          '<input id="prop-after" type="text" value="' + window.MA.htmlUtils.escHtml(task.after || '') + '" placeholder="タスクID (例: a1)" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' +
        '</div>' +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">セクション移動</label>' +
          '<select id="prop-move-section" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + moveSecOpts + '</select>' +
        '</div>' +
        '<button id="prop-delete-btn" style="width:100%;background:var(--accent-red);color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;margin-top:8px;">タスク削除</button>';

      // Bind handlers
      window.MA.properties.bindTextField('prop-label', task.line, 'label');
      window.MA.properties.bindTextField('prop-id', task.line, 'id');
      window.MA.properties.bindTextField('prop-after', task.line, 'after');
      window.MA.properties.bindDateField('prop-start', 'prop-end', task.line, updateTaskDates);

      // Move up/down handlers
      var moveUpBtn = document.getElementById('prop-move-up');
      if (moveUpBtn) {
        moveUpBtn.addEventListener('click', function() {
          var newText = moveTaskWithinSection(mmdText, task.line, -1);
          if (newText === mmdText) return; // no-op (boundary)
          window.MA.history.pushHistory();
          mmdText = newText;
          suppressSync = true;
          editorEl.value = mmdText;
          suppressSync = false;
          syncLineNumbers();
          scheduleRefresh();
        });
      }
      var moveDownBtn = document.getElementById('prop-move-down');
      if (moveDownBtn) {
        moveDownBtn.addEventListener('click', function() {
          var newText = moveTaskWithinSection(mmdText, task.line, 1);
          if (newText === mmdText) return;
          window.MA.history.pushHistory();
          mmdText = newText;
          suppressSync = true;
          editorEl.value = mmdText;
          suppressSync = false;
          syncLineNumbers();
          scheduleRefresh();
        });
      }

      var moveSectionEl = document.getElementById('prop-move-section');
      if (moveSectionEl) {
        moveSectionEl.addEventListener('change', function() {
          var targetIdx = parseInt(moveSectionEl.value, 10);
          if (isNaN(targetIdx)) return;
          var newText = moveTaskToSection(mmdText, task.line, targetIdx);
          if (newText === mmdText) return; // no-op
          window.MA.history.pushHistory();
          mmdText = newText;
          suppressSync = true;
          editorEl.value = mmdText;
          suppressSync = false;
          syncLineNumbers();
          scheduleRefresh();
        });
      }

      // Status buttons
      var statusBtnEls = propsEl.querySelectorAll('.prop-status-btn');
      for (var sbi = 0; sbi < statusBtnEls.length; sbi++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            window.MA.history.pushHistory();
            mmdText = updateTaskField(mmdText, task.line, 'status', btn.getAttribute('data-status'));
            suppressSync = true;
            editorEl.value = mmdText;
            suppressSync = false;
            syncLineNumbers();
            scheduleRefresh();
          });
        })(statusBtnEls[sbi]);
      }

      // Delete button
      var delBtn = document.getElementById('prop-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', function() {
          window.MA.history.pushHistory();
          mmdText = deleteTask(mmdText, task.line);
          suppressSync = true;
          editorEl.value = mmdText;
          suppressSync = false;
          window.MA.selection.setSelected([]);
          syncLineNumbers();
          scheduleRefresh();
        });
      }
      return;
    }

    // Multiple tasks selected
    if (selData.length > 1) {
      var selectedTasks = [];
      if (parsedData && parsedData.tasks) {
        for (var mi = 0; mi < selData.length; mi++) {
          for (var mj = 0; mj < parsedData.tasks.length; mj++) {
            if (parsedData.tasks[mj].id === selData[mi].id) {
              selectedTasks.push(parsedData.tasks[mj]);
              break;
            }
          }
        }
      }

      var batchStatusBtns = ['done', 'active', 'crit', 'none'].map(function(s) {
        var val = s === 'none' ? '' : s;
        return '<button class="batch-status-btn" data-status="' + val + '" style="flex:1;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border);padding:3px 4px;border-radius:3px;cursor:pointer;font-size:10px;">' + s + '</button>';
      }).join('');

      propsEl.innerHTML =
        '<div style="margin-bottom:8px;font-size:11px;color:var(--text-secondary);">' + selData.length + ' タスク選択中</div>' +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">一括ステータス変更</label>' +
          '<div style="display:flex;gap:2px;">' + batchStatusBtns + '</div>' +
        '</div>' +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">一括日付シフト（日数）</label>' +
          '<div style="display:flex;gap:4px;">' +
            '<input id="batch-shift-days" type="number" value="0" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' +
            '<button id="batch-shift-btn" style="background:var(--accent);color:#fff;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px;">適用</button>' +
          '</div>' +
        '</div>' +
        '<button id="batch-delete-btn" style="width:100%;background:var(--accent-red);color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;margin-top:8px;">一括削除</button>';

      // Batch status change
      var batchBtnEls = propsEl.querySelectorAll('.batch-status-btn');
      for (var bbi = 0; bbi < batchBtnEls.length; bbi++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            window.MA.history.pushHistory();
            var statusVal = btn.getAttribute('data-status');
            for (var bti = 0; bti < selectedTasks.length; bti++) {
              mmdText = updateTaskField(mmdText, selectedTasks[bti].line, 'status', statusVal);
            }
            suppressSync = true;
            editorEl.value = mmdText;
            suppressSync = false;
            syncLineNumbers();
            scheduleRefresh();
          });
        })(batchBtnEls[bbi]);
      }

      // Batch date shift
      var shiftBtn = document.getElementById('batch-shift-btn');
      if (shiftBtn) {
        shiftBtn.addEventListener('click', function() {
          var daysVal = parseInt(document.getElementById('batch-shift-days').value, 10);
          if (isNaN(daysVal) || daysVal === 0) return;
          window.MA.history.pushHistory();
          for (var sti = 0; sti < selectedTasks.length; sti++) {
            var st = selectedTasks[sti];
            var newStart = st.startDate && DATE_RE.test(st.startDate) ? window.MA.dateUtils.addDays(st.startDate, daysVal) : null;
            var newEnd = st.endDate && DATE_RE.test(st.endDate) ? window.MA.dateUtils.addDays(st.endDate, daysVal) : null;
            if (newStart || newEnd) {
              mmdText = updateTaskDates(mmdText, st.line, newStart, newEnd);
            }
          }
          suppressSync = true;
          editorEl.value = mmdText;
          suppressSync = false;
          syncLineNumbers();
          scheduleRefresh();
        });
      }

      // Batch delete (reverse line order to preserve line numbers)
      var batchDelBtn = document.getElementById('batch-delete-btn');
      if (batchDelBtn) {
        batchDelBtn.addEventListener('click', function() {
          window.MA.history.pushHistory();
          // Sort by line number descending so deletion doesn't shift lines
          var sorted = selectedTasks.slice().sort(function(a, b) { return b.line - a.line; });
          for (var di = 0; di < sorted.length; di++) {
            mmdText = deleteTask(mmdText, sorted[di].line);
          }
          suppressSync = true;
          editorEl.value = mmdText;
          suppressSync = false;
          window.MA.selection.setSelected([]);
          syncLineNumbers();
          scheduleRefresh();
        });
      }
      return;
    }

    // Section selected
    if (selData.length === 1 && selData[0].type === 'section') {
      var secId = selData[0].id;
      var section = null;
      if (parsedData && parsedData.sections) {
        for (var sci = 0; sci < parsedData.sections.length; sci++) {
          if (parsedData.sections[sci].name === secId) {
            section = parsedData.sections[sci];
            break;
          }
        }
      }
      if (!section) {
        propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">セクションが見つかりません</p>';
        return;
      }

      // Tasks in this section
      var secTasks = [];
      if (parsedData && parsedData.tasks) {
        var secIndex = parsedData.sections.indexOf(section);
        for (var sti2 = 0; sti2 < parsedData.tasks.length; sti2++) {
          if (parsedData.tasks[sti2].sectionIndex === secIndex) {
            secTasks.push(parsedData.tasks[sti2]);
          }
        }
      }

      var taskList = secTasks.map(function(t) {
        return '<div style="padding:2px 4px;font-size:11px;color:var(--text-primary);">' + window.MA.htmlUtils.escHtml(t.label) + '</div>';
      }).join('');

      propsEl.innerHTML =
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">セクション名</label>' +
          '<input id="prop-sec-name" type="text" value="' + window.MA.htmlUtils.escHtml(section.name) + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' +
        '</div>' +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:4px;">タスク一覧 (' + secTasks.length + '件)</label>' +
          taskList +
        '</div>' +
        '<button id="prop-sec-delete-btn" style="width:100%;background:var(--accent-red);color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;margin-top:8px;">セクション削除 (タスクごと)</button>';

      // Bind section name change
      var secNameEl = document.getElementById('prop-sec-name');
      if (secNameEl) {
        secNameEl.addEventListener('change', function() {
          window.MA.history.pushHistory();
          var lines = mmdText.split('\n');
          var idx = section.line - 1;
          if (idx >= 0 && idx < lines.length) {
            var indent = lines[idx].match(/^(\s*)/)[1];
            lines[idx] = indent + 'section ' + secNameEl.value;
            mmdText = lines.join('\n');
            suppressSync = true;
            editorEl.value = mmdText;
            suppressSync = false;
            window.MA.selection.setSelected([{ type: 'section', id: secNameEl.value }]);
            syncLineNumbers();
            scheduleRefresh();
          }
        });
      }

      // Bind section delete
      var secDelBtn = document.getElementById('prop-sec-delete-btn');
      if (secDelBtn) {
        secDelBtn.addEventListener('click', function() {
          window.MA.history.pushHistory();
          mmdText = deleteSection(mmdText, section.line);
          suppressSync = true;
          editorEl.value = mmdText;
          suppressSync = false;
          window.MA.selection.setSelected([]);
          syncLineNumbers();
          scheduleRefresh();
        });
      }
      return;
    }

    // Default fallback
    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">タスクを選択してください</p>';
  },
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
function scheduleRefresh() {
  cancelAnimationFrame(debounceTimer);
  debounceTimer = requestAnimationFrame(function() { refresh(); });
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

  // Render via mermaid.js
  var svgId = 'mermaid-svg-' + thisRender;
  try {
    var renderResult = await mermaid.render(svgId, mmdText);
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
      if (currentModule.type === 'gantt') {
        currentModule.buildOverlay(svgEl, parsed);
      } else {
        currentModule.buildOverlay(svgEl, parsed, overlayEl);
      }
    }

    statusParseEl.textContent = 'OK';
    statusParseEl.classList.remove('error');
    hideParseErrorBanner();
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
  el.textContent = cause || ('構文エラー — 表示しているのは直前に描けた図です');
  el.hidden = false;
}
function hideParseErrorBanner() {
  var el = document.getElementById('parse-error-banner');
  if (el) el.hidden = true;
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
  updateDocumentTitle();
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
      'color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">';
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
  if (box) {
    // 絞った結果0件を無言で見せると「一覧が消えた」と読めるので、件数を常に出す。
    box.placeholder = q ? ('絞り込み中: ' + hit + '件') : ('一覧を絞り込む (' + rows.length + '件)');
  }
}

function renderProps() {
  withFocusKept(function() {
    renderPropsInner();
    applyListFilter();
  });
}

function renderPropsInner() {
  if (!propsEl || !currentModule) return;
  // Gantt's renderProps uses the old 2-arg form (inline in app.js)
  // Sequence and future modules use the 4-arg form: (selData, parsedData, propsEl, ctx)
  if (currentModule.type === 'gantt') {
    currentModule.renderProps(sel, parsed);
  } else {
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
      onUpdate: function() { scheduleRefresh(); },
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
  var cfg = { startOnLoad: false, theme: 'dark', securityLevel: 'loose', maxTextSize: 5000000 };
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
function markSaved() { savedText = mmdText; }

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

function downloadAsFile() {
  var blob = new Blob([mmdText], { type: 'text/plain' });
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
  showTransient(savedMessage(new Date()) + ' (ダウンロード)');
}

async function overwriteSaved() {
  try {
    var w = await saveHandle.createWritable();
    await w.write(mmdText);
    await w.close();
    markSaved();
    showTransient(savedMessage(new Date()) + ' → ' + (saveHandle.name || ''));
  } catch (e) {
    // 上書きに失敗したら参照を捨て、黙ってダウンロードに落とす。
    // 保存できたことにして本文を失わせるのが一番悪い。
    saveHandle = null;
    downloadAsFile();
    markSaved();
    showTransient('上書きに失敗したのでダウンロードしました');
  }
}

// 上書き先を指定する (Ctrl+Shift+S / Export メニュー)。
// 非対応ブラウザ (Firefox / Safari) ではこの機能自体が無いので、
// できないことをその場で言う。黙ってダウンロードすると「指定できた」と誤解される。
async function saveFileAs() {
  if (!window.showSaveFilePicker) {
    showTransient('このブラウザは上書き保存に対応していません (Chrome / Edge なら可能)', 5000);
    return;
  }
  try {
    saveHandle = await window.showSaveFilePicker({
      suggestedName: currentBaseName() + '.mmd',
      types: [{ description: 'Mermaid', accept: { 'text/plain': ['.mmd', '.mermaid'] } }],
    });
  } catch (e) {
    showTransient('保存先の指定を中止しました', 2500);
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
  showTransient('構文エラー中です。表示しているのは直前の図なので書き出しません', 5000);
  return true;
}

function exportSVG() {
  if (blockExportIfStale()) return;
  var svgEl = previewSvgEl.querySelector('svg');
  if (!svgEl) return;
  var clone = svgEl.cloneNode(true);
  var blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = currentBaseName() + '.svg';
  a.click();
  URL.revokeObjectURL(a.href);
}

function svgToCanvas(transparent, callback) {
  var svgEl = previewSvgEl.querySelector('svg');
  if (!svgEl) return;
  var clone = svgEl.cloneNode(true);
  var svgData = new XMLSerializer().serializeToString(clone);
  var img = new Image();
  img.onload = function() {
    var canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext('2d');
    if (!transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0);
    callback(canvas);
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
}

function exportPNG(transparent) {
  if (blockExportIfStale()) return;
  svgToCanvas(transparent, function(canvas) {
    canvas.toBlob(function(blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = currentBaseName() + '.png';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  });
}

function exportClipboard() {
  if (blockExportIfStale()) return;
  svgToCanvas(false, function(canvas) {
    canvas.toBlob(function(blob) {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
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
    scheduleRefresh();
  });

  editorEl.addEventListener('scroll', function() {
    syncLineNumbers();
  });

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
      mmdText = ev.target.result;
      loadedFileName = openedName;
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

  document.getElementById('exp-mmd').addEventListener('click', function() {
    exportMenu.classList.remove('open');
    saveFile();
  });

  document.getElementById('exp-mmd-as').addEventListener('click', function() {
    exportMenu.classList.remove('open');
    saveFileAs();
  });

  document.getElementById('exp-svg').addEventListener('click', function() {
    exportMenu.classList.remove('open');
    exportSVG();
  });

  document.getElementById('exp-png').addEventListener('click', function() {
    exportMenu.classList.remove('open');
    exportPNG(false);
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
      e.preventDefault(); window.MA.history.undo();
    } else if (e.ctrlKey && (e.key === 'y' || ((e.key === 'Z' || e.key === 'z') && e.shiftKey)) && !e.isComposing) {
      // Ctrl+Shift+Z は Figma / draw.io / VSCode で Redo 。Shift 併用だと e.key は 'Z' に
      // なるので、小文字比較だけだと分岐に入らない。
      e.preventDefault(); window.MA.history.redo();
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
      if (!parsed || !parsed.tasks) { showTransient('この図種では Delete キーの削除は未対応です (一覧の ✕ を使ってください)', 3000); return; }
      window.MA.history.pushHistory();
      var lines = sel.map(function(s) {
        var t = parsed.tasks.find(function(tk) { return tk.id === s.id; });
        return t ? t.line : -1;
      }).filter(function(l) { return l > 0; }).sort(function(a, b) { return b - a; });
      lines.forEach(function(l) { mmdText = deleteTask(mmdText, l); });
      suppressSync = true;
      editorEl.value = mmdText;
      suppressSync = false;
      window.MA.selection.setSelected([]);
      syncLineNumbers();
      // 削除に確認を出さないのは Undo で戻せるからだが、戻せることを示して
      // いるのはツールバーの Undo だけで、視線は図の上にある。消したその場で言う。
      showTransient(deletedMessage(lines.length));
      scheduleRefresh();
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
      if (!parsed || !parsed.tasks) { showTransient('この図種ではすべて選択は未対応です', 2500); return; }
      window.MA.selection.setSelected(parsed.tasks.map(function(t) { return { type: 'task', id: t.id }; }));
    } else if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault(); exportClipboard();
    } else if (e.ctrlKey && e.key === 'c' && !inEditor && !inInput && sel.length > 0) {
      e.preventDefault();
      if (!parsed || !parsed.tasks) { showTransient('この図種では要素の複写は未対応です', 2500); return; }
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
