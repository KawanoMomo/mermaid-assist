'use strict';
window.MA = window.MA || {};
window.MA.properties = (function() {
  var state = {
    getMmdText: function() { return ''; },
    setMmdText: function(t) {},
    onUpdate: function() {},
    onStatus: function() {},
    elementExists: function(id) { return true; },
    moduleUpdater: function(text, lineNum, field, value) { return text; },
  };

  function init(opts) {
    state.getMmdText = opts.getMmdText;
    state.setMmdText = opts.setMmdText;
    state.onUpdate = opts.onUpdate || function() {};
    state.moduleUpdater = opts.moduleUpdater;
    // Redraw the status bar. Connection mode is announced there, and the
    // selection callback does not cover it.
    state.onStatus = opts.onStatus || function() {};
    // 「その id はいま図に存在するか」。接続モードは編集をまたいで生き残るので、
    // 始点が消えていないかを繋ぐ直前に確かめる必要がある。
    state.elementExists = opts.elementExists || function() { return true; };
  }

  // bindTextField: text input の change で moduleUpdater を呼んでテキスト更新
  function bindTextField(elId, lineNum, field) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.addEventListener('change', function() {
      window.MA.history.pushHistory();
      var newText = state.moduleUpdater(state.getMmdText(), lineNum, field, el.value);
      // Renaming the selected element left the selection on the old id, so the
      // panel you were typing in switched to 「見つかりません」 the moment the
      // rename landed. Carry the selection over to the new id instead.
      if (field === 'id' && el.value) followRename(el.value);
      state.setMmdText(newText);
      state.onUpdate();
    });
  }

  // Move any selection that pointed at the renamed element to its new id,
  // keeping the selection type as it was.
  function followRename(newId) {
    var sel = window.MA.selection.getSelected();
    if (sel.length !== 1) return;
    window.MA.selection.setSelected([{ type: sel[0].type, id: newId }]);
  }

  // "Draw an edge from here" — starts connection mode. The next click on the
  // canvas picks the target.
  //
  // Without this the only way to add an edge was two dropdowns and a button in
  // the properties panel: five interactions, and the dropdowns get unusable once
  // the diagram has thirty elements. `connection-mode.js` and every module's
  // operations.connect() were already there, just never wired to anything.
  function connectButtonHtml(id) {
    return '<button id="' + id + '" style="width:100%;background:var(--bg-tertiary);' +
      'color:var(--text-primary);border:1px solid var(--accent);padding:5px 8px;' +
      'border-radius:4px;cursor:pointer;font-size:12px;margin-bottom:8px;">' +
      'ここから線を引く</button>';
  }

  // Wire the button to connection mode. `connect` receives (fromId, toId) and
  // is expected to return the new text.
  function bindConnectButton(id, fromType, fromId, connect) {
    bindEvent(id, 'click', function() {
      window.MA.connectionMode.startConnectionMode(fromType, fromId, function(src, target) {
        if (!target || !target.id || target.id === src.id) return;
        // The source has to still exist. Connection mode survives editing, so
        // deleting the start element in the editor and then clicking a target
        // drew a line from a node that is no longer in the diagram — mermaid
        // then re-creates it implicitly and a deleted element reappears with no
        // error anywhere.
        if (!state.elementExists(src.id)) {
          state.onStatus();
          return;
        }
        window.MA.history.pushHistory();
        state.setMmdText(connect(src.id, target.id));
        window.MA.selection.clearSelection();
        state.onUpdate();
      });
      // Keeping the source selected would make the highlight say "this is what
      // you are editing" while the next click actually means "connect to this".
      //
      // clearSelection fires the selection callback (panel + overlay redraw) but
      // not the status bar, and the status bar is where the mode is announced.
      window.MA.selection.clearSelection();
      state.onUpdate();
      if (state.onStatus) state.onStatus();
    });
  }

  // bindDateField: 開始日/終了日 ペアのバインド (datesUpdater は外部から注入)
  function bindDateField(startId, endId, lineNum, datesUpdater) {
    var startEl = document.getElementById(startId);
    var endEl = document.getElementById(endId);
    if (startEl) {
      startEl.addEventListener('change', function() {
        window.MA.history.pushHistory();
        var newText = datesUpdater(state.getMmdText(), lineNum, startEl.value, null);
        state.setMmdText(newText);
        state.onUpdate();
      });
    }
    if (endEl) {
      endEl.addEventListener('change', function() {
        window.MA.history.pushHistory();
        var newText = datesUpdater(state.getMmdText(), lineNum, null, endEl.value);
        state.setMmdText(newText);
        state.onUpdate();
      });
    }
  }

  // ── HTML builders ────────────────────────────────────────────────────────
  var escHtml = function(s) {
    return window.MA.htmlUtils.escHtml(s);
  };

  // fieldHtml: standard text input field with label
  function fieldHtml(label, id, value, placeholder) {
    // `for` を落とすと、この入力欄は支援技術から名前なしに見える。実測では
    // placeholder が名前に流用され、Tech と Description がどちらも「省略可」という
    // 同じ名前になっていた。ラベルは既に隣にあるので、結び付けるだけで直る。
    return '<div style="margin-bottom:8px;">' +
      '<label for="' + escHtml(id) + '" style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">' + escHtml(label) + '</label>' +
      '<input id="' + id + '" type="text" value="' + escHtml(value || '') + '" placeholder="' + escHtml(placeholder || '') + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' +
    '</div>';
  }

  // selectFieldHtml: select dropdown with label
  // options: array of { value, label, selected? }
  function selectFieldHtml(label, id, options, monoFont) {
    var opts = '';
    for (var i = 0; i < options.length; i++) {
      var sel = options[i].selected ? ' selected' : '';
      opts += '<option value="' + escHtml(options[i].value) + '"' + sel + '>' + escHtml(options[i].label) + '</option>';
    }
    var fontStyle = monoFont ? 'font-family:var(--font-mono);' : '';
    // fieldHtml と同じ理由で `for` が要る。実測では From と To の2つが同じ選択肢を
    // 持つ無名の combobox として並び、支援技術では見分けがつかなかった。
    return '<div style="margin-bottom:8px;">' +
      '<label for="' + escHtml(id) + '" style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">' + escHtml(label) + '</label>' +
      '<select id="' + id + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;' + fontStyle + '">' + opts + '</select>' +
    '</div>';
  }

  // panelHeaderHtml: title bar at top of single-element edit panel
  function panelHeaderHtml(label) {
    return '<div style="margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border);font-weight:bold;color:var(--text-primary);font-size:13px;">' + escHtml(label) + '</div>';
  }

  // sectionHeaderHtml: divider with section heading (used inside no-selection panel for grouped controls)
  function sectionHeaderHtml(label) {
    return '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
      '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">' + escHtml(label) + '</label>';
  }

  function sectionFooterHtml() {
    return '</div>';
  }

  // 説明用の隠し span に振る id の連番。パネルは innerHTML で作り直されるので、
  // 増え続けても DOM に残るのは今表示している行ぶんだけ。
  var descSeq = 0;

  // listItemHtml: row with label + select-edit and delete buttons
  // opts: { label, sublabel?, selectClass, deleteClass, dataElementId?, dataLine?, dataEndLine?, mono? }
  function listItemHtml(opts) {
    var sub = opts.sublabel ? ' <span style="color:var(--text-secondary);font-size:10px;">' + escHtml(opts.sublabel) + '</span>' : '';
    var fontStyle = opts.mono ? 'font-family:var(--font-mono);' : '';
    var dataAttrs = '';
    if (opts.dataElementId !== undefined) dataAttrs += ' data-element-id="' + escHtml(opts.dataElementId) + '"';
    if (opts.dataLine !== undefined) dataAttrs += ' data-line="' + opts.dataLine + '"';
    if (opts.dataEndLine !== undefined) dataAttrs += ' data-end-line="' + opts.dataEndLine + '"';
    // 「編集」も「✕」も、どの行のものかがボタン名から分からない。支援技術の
    // ボタン一覧では同名が並ぶだけで選べないので、行のラベルを名前に入れる。
    var selAria = ' aria-label="' + escHtml('「' + String(opts.label).trim() + '」を編集') + '"';
    var selectBtn = opts.selectClass ?
      '<button class="' + opts.selectClass + '"' + dataAttrs + selAria + ' style="background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;min-height:24px;border-radius:3px;cursor:pointer;font-size:10px;">編集</button>' : '';
    // deleteLabel / deleteTitle let a module warn about a cascading delete on the
    // button itself. The row's text is ellipsised at the panel width, so a warning
    // placed in the label is frequently invisible.
    var delLabel = opts.deleteLabel ? escHtml(opts.deleteLabel) : '✕';
    // 記号だけのボタンは、何を消すのか読み取れない。ホバーとスクリーンリーダの
    // 両方でここが唯一の手がかりになる。
    //
    // deleteTitle が受け取るのは「削除すると 3 要素 / 2 リレーションが消えます」の
    // ような**動作の説明だけ**で、どの行のものかは付けない。行の識別はここで一度だけ
    // 足す。以前は deleteTitle を渡していない経路 (この関数を通る 41 か所のうち
    // 36 か所) で既定値に行ラベルが入り、そこへさらに前置していたため
    // 「A」「A」を削除 と二重に読み上げられていた。
    //
    // 名前 (aria-label) と説明 (aria-describedby) を分ける。
    //
    // title と aria-label を同一文字列にしていたとき、Chromium は
    // 「名前に採用されなかった title」を description に回すため、
    // **name と description がバイト一致**していた (20要素の C4 で削除ボタン 39個
    // すべてが description === name。実測)。NVDA は「オブジェクトの説明を報告」が
    // 既定 ON、JAWS / VoiceOver も description を読むので、同じ全文が2回読まれる。
    // 20要素で読み上げ 3,522 文字、name 最長 74 文字。
    //
    // aria-describedby は description の計算で title より優先されるので、
    // マウス用ツールチップ (title) を残したまま重複だけ消える。
    // 識別部分は削らない —— 100要素で名前を「削除」に縮めると 199 個の同名ボタンが
    // 並び、支援技術のボタン一覧で選べなくなる (この関数が解こうとした問題そのもの)。
    var rowLabel = String(opts.label).trim();   // mindmap は階層を表す先頭空白を持つ
    var delIdent = '「' + rowLabel + '」を削除';
    var deleteBtn = '';
    var descSpan = '';
    if (opts.deleteClass) {
      var delAria = ' aria-label="' + escHtml(delIdent) + '"';
      var delTitle = '', delDescribedBy = '';
      // 名前が既に言っていることは説明しない。c4 / block / flowchart は
      // カスケードが無い行に `deleteTitle: '削除'` を渡すので、そのまま説明にすると
      // 名前「「X」を削除」の後ろで「削除」ともう一度読まれる (実測で41個中22個)。
      var hasExtraInfo = opts.deleteTitle && ('「' + rowLabel + '」を' + opts.deleteTitle) !== delIdent;
      if (hasExtraInfo) {
        // カスケードの警告がある場合だけ、詳細を description に回す。
        var descId = 'ma-del-desc-' + (descSeq++);
        descSpan = '<span id="' + descId + '" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;">' +
          escHtml(opts.deleteTitle) + '</span>';
        delDescribedBy = ' aria-describedby="' + descId + '"';
        delTitle = ' title="' + escHtml('「' + rowLabel + '」を' + opts.deleteTitle) + '"';
      }
      // 警告が無い場合は title を付けない。付けると内容が aria-label と一致し、
      // Chromium がそれを description に回して同じ文字列を2回読ませる。
      // ホバーで失うのは「✕ は削除」という自明な説明だけで、行の全文は行そのものの
      // title から今までどおり読める。
      deleteBtn = '<button class="' + opts.deleteClass + '"' + dataAttrs + delTitle + delAria + delDescribedBy +
        ' style="background:var(--accent-red);color:#fff;border:none;padding:4px 8px;min-width:24px;min-height:24px;border-radius:3px;cursor:pointer;font-size:10px;white-space:nowrap;">' + delLabel + '</button>';
    }
    // 行に印を付ける。一覧の絞り込みはこの印を見て行を選ぶので、
    // 各モジュールは何もしなくてよい (41か所がこの関数を通る)。
    // 行の文字はパネル幅で切り落とされる。既定幅でも半数以上の行が省略され、
    // しかも `(in 親)` のような補足は行末にあるので真っ先に消える。切れた行を
    // 読む手段が本文テキストを見に行くことしか無かったので、全文を title に置く。
    var rowFull = String(opts.label) + (opts.sublabel ? ' ' + String(opts.sublabel) : '');
    return '<div class="ma-list-row" style="display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:3px 4px;background:var(--bg-tertiary);border-radius:3px;font-size:11px;">' +
      // 名前欄は 123px しかなく、長い名前は ellipsis で切れる。実測では
      // "ComM_ChannelStateManager_MainFunction" が "ComM_ChannelStat" までしか
      // 読めず、**先頭が共通で末尾だけ違う名前を見分けられない** (組込みの
      // BSW 名は先頭共通が普通)。gantt.js は自前の行に title を付けていたが、
      // 41か所が通るこの共有関数には無かった。切れたときの唯一の手がかりを足す。
      //
      // 補足 (`(in 親ID)` など) も入れる。補足は行末にあるので真っ先に切れるが、
      // 「どの親の中か」は名前と同じくらい効く手がかりになる。
      '<div title="' + escHtml(rowFull) + '" style="flex:1;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + fontStyle + '">' + escHtml(opts.label) + sub + '</div>' +
      selectBtn + deleteBtn + descSpan +
    '</div>';
  }

  // emptyListHtml: placeholder text when a list is empty
  function emptyListHtml(text) {
    return '<div style="font-size:11px;color:var(--text-secondary);">' + escHtml(text) + '</div>';
  }

  // primaryButtonHtml: full-width accent button
  function primaryButtonHtml(id, label) {
    // 白文字だと accent (#7c8cf8) に対して 3.02:1 で AA に届かない。地の色は
    // そのままに文字を暗くすると 6.28:1 になる。
    return '<button id="' + id + '" style="width:100%;background:var(--accent);color:#0d1117;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">' + escHtml(label) + '</button>';
  }

  // dangerButtonHtml: full-width red button (for delete actions)
  function dangerButtonHtml(id, label) {
    return '<button id="' + id + '" style="width:100%;background:var(--accent-red);color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;margin-top:8px;">' + escHtml(label) + '</button>';
  }

  // ── Action bar (selected-element UX) ─────────────────────────────────────
  // Emits the standard 5-button row (↑前に挿入 / ↓後に挿入 / ↑上へ / ↓下へ /
  // 削除) used by every module's selected-element panel. The matching event
  // hookup is provided by bindActionBar below.
  //
  // opts (all optional, default true for booleans):
  //   insertBefore : boolean
  //   insertAfter  : boolean
  //   move         : boolean | { up: boolean, down: boolean }
  //   delete       : boolean
  //   labels       : { insertBefore?, insertAfter?, up?, down?, delete? }
  //
  // The <prefix>-extra div is ALWAYS emitted so modules can append module-
  // specific buttons at a stable DOM location. See ADR-020 / ADR-022.
  function actionBarHtml(idPrefix, opts) {
    opts = opts || {};
    var labels = opts.labels || {};
    var moveUp = true, moveDown = true;
    if (opts.move === false) { moveUp = false; moveDown = false; }
    else if (opts.move && typeof opts.move === 'object') {
      moveUp = opts.move.up !== false;
      moveDown = opts.move.down !== false;
    }
    var insertBefore = opts.insertBefore !== false;
    var insertAfter = opts.insertAfter !== false;
    var includeDelete = opts.delete !== false;

    var html = '';
    if (insertBefore || insertAfter) {
      html += '<div class="action-bar-row" data-action-bar-row="insert">';
      if (insertBefore) {
        html += '<button id="' + idPrefix + '-insert-before" class="action-btn">' +
                escHtml(labels.insertBefore || '↑ この前に挿入') + '</button>';
      }
      if (insertAfter) {
        html += '<button id="' + idPrefix + '-insert-after" class="action-btn">' +
                escHtml(labels.insertAfter || '↓ この後に挿入') + '</button>';
      }
      html += '</div>';
    }
    if (moveUp || moveDown) {
      html += '<div class="action-bar-row" data-action-bar-row="move">';
      if (moveUp) {
        html += '<button id="' + idPrefix + '-up" class="action-btn">' +
                escHtml(labels.up || '↑ 上へ') + '</button>';
      }
      if (moveDown) {
        html += '<button id="' + idPrefix + '-down" class="action-btn">' +
                escHtml(labels.down || '↓ 下へ') + '</button>';
      }
      html += '</div>';
    } else if (opts.moveDisabledReason) {
      // 並べ替えができない図種で、ボタンを**消さずに理由つきで出す** (UI-049)。
      //
      // classDiagram では ↑↓ が出るのに erDiagram では出ない。利用者から見ると
      // その差は内部事情 (要素の line が宣言行を指すか関係行を指すか) で決まって
      // おり、画面から読めない。**無いものは探しても見つからない**ので、
      // 探す時間がそのまま失われる。
      //
      // 理由を書いたモジュールだけがこの形になる。書かなければ今までどおり
      // 何も出ない — 全パネルを一度に変えると、まだ測っていない図種まで
      // 「できない理由」を名乗ることになる。
      html += '<div class="action-bar-row" data-action-bar-row="move-disabled">';
      html += '<button id="' + idPrefix + '-up" class="action-btn" disabled ' +
              'title="' + escHtml(opts.moveDisabledReason) + '">' +
              escHtml(labels.up || '↑ 上へ') + '</button>';
      html += '<button id="' + idPrefix + '-down" class="action-btn" disabled ' +
              'title="' + escHtml(opts.moveDisabledReason) + '">' +
              escHtml(labels.down || '↓ 下へ') + '</button>';
      html += '</div>';
    }
    html += '<div id="' + idPrefix + '-extra" class="action-bar-extra"></div>';
    if (includeDelete) {
      html += '<button id="' + idPrefix + '-delete" class="action-btn-danger">' +
              escHtml(labels.delete || '削除') + '</button>';
    }
    return html;
  }

  // bindActionBar: connect click handlers to the buttons that actionBarHtml
  // emitted for the same idPrefix. Handlers are optional — missing keys simply
  // skip the bind (no error). Unknown keys are ignored for forward-compat.
  //
  // Recognised keys → id suffix:
  //   insertBefore → -insert-before
  //   insertAfter  → -insert-after
  //   up           → -up
  //   down         → -down
  //   delete       → -delete
  function bindActionBar(idPrefix, handlers) {
    handlers = handlers || {};
    var map = {
      insertBefore: '-insert-before',
      insertAfter: '-insert-after',
      up: '-up',
      down: '-down',
      'delete': '-delete',
    };
    for (var key in map) {
      if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
      var fn = handlers[key];
      if (typeof fn !== 'function') continue;
      bindEvent(idPrefix + map[key], 'click', fn);
    }
  }

  // ── Event binding helpers ────────────────────────────────────────────────

  // bindEvent: simple event binding by element ID
  function bindEvent(id, event, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  // bindAllByClass: bind a handler to all elements matching a CSS class within propsEl
  // handlerWithBtn(btn) is called per element with that element as the only arg
  function bindAllByClass(propsEl, className, handlerWithBtn) {
    if (!propsEl) return;
    var btns = propsEl.querySelectorAll('.' + className);
    for (var i = 0; i < btns.length; i++) {
      (function(btn) { btn.addEventListener('click', function() { handlerWithBtn(btn); }); })(btns[i]);
    }
  }

  // bindSelectButtons: standardized select-button bindings.
  // For elements with class `selectClass` and attribute `data-element-id`, sets selection on click.
  //
  // Uses toggle semantics (selection.selectItem) instead of unconditional setSelected:
  // clicking the currently-sole-selected item deselects it. Matches the "click again
  // to deselect" UX applied in PlantUMLAssist and aligns with the selection.js
  // single-select toggle contract already used by Gantt overlay clicks.
  // Cross-ref: 06_PlantUMLAssist/docs/direct-manipulation-ux-checklist.md 観点 B.
  function bindSelectButtons(propsEl, selectClass, selectionType) {
    bindAllByClass(propsEl, selectClass, function(btn) {
      var id = btn.getAttribute('data-element-id');
      window.MA.selection.selectItem(selectionType, id, false);
    });
  }

  // bindDeleteButtons: standardized delete-button bindings.
  // For elements with class `deleteClass` and attribute `data-line`, calls deleteFn(text, lineNum)
  // and updates state. Optional: pass `data-end-line` and use `endLine` for block deletion.
  function bindDeleteButtons(propsEl, deleteClass, ctx, deleteFn, useEndLine) {
    bindAllByClass(propsEl, deleteClass, function(btn) {
      var ln = parseInt(btn.getAttribute('data-line'), 10);
      if (isNaN(ln)) return;
      var endLn;
      if (useEndLine) {
        endLn = parseInt(btn.getAttribute('data-end-line'), 10);
        if (isNaN(endLn) || endLn <= 0) return;
      }
      window.MA.history.pushHistory();
      // The row already carries which element it stands for; hand it to the module.
      // block-beta puts several blocks on one line (`a["Sensor"] b["MCU"] c["Actuator"]`),
      // so a line number alone cannot say which one the user pressed — resolving by
      // line picks the first every time, and pressing b's ✕ deletes a.
      var elId = btn.getAttribute('data-element-id');
      // 押した行が一覧の何番目だったかを覚えておく。パネルは innerHTML で作り直され、
      // 押したボタンごと DOM から消えるので、そのままだとフォーカスが body へ落ちる。
      // 実測: 100要素の図で `c50` の ✕ を押すと、隣の `c51` の ✕ へ戻るまで **Tab 120回**。
      // 「支援技術のボタン一覧から選べるようにする」ためにこの関数へ名前を入れたのに、
      // 選んだ直後に居場所を失っていた。
      var siblings = Array.prototype.slice.call(propsEl.querySelectorAll('.' + deleteClass));
      var pressedAt = siblings.indexOf(btn);

      var newText = useEndLine
        ? deleteFn(ctx.getMmdText(), ln, endLn)
        : deleteFn(ctx.getMmdText(), ln, elId);
      ctx.setMmdText(newText);
      ctx.onUpdate();

      // 作り直された後の一覧で、消した位置の次 → 無ければ前 → それも無ければ
      // 一覧そのもの、の順に置く。ctx.onUpdate() が同期でパネルを作り直す実装と
      // 非同期の実装の両方があるので、次のタスクで拾う。
      if (pressedAt >= 0 && typeof window.setTimeout === 'function') {
        window.setTimeout(function() {
          var host = (typeof document !== 'undefined' && document.getElementById)
            ? (document.getElementById('props-content') || propsEl) : propsEl;
          if (!host || !host.querySelectorAll) return;
          var after = host.querySelectorAll('.' + deleteClass);
          if (!after.length) return;
          var target = after[Math.min(pressedAt, after.length - 1)];
          if (target && target.focus) target.focus();
        }, 0);
      }
    });
  }

  // bindFieldChange: bind change event to update a single field via a custom updater
  // updaterFn(text, lineNum, field, value) -> text
  function bindFieldChange(elId, lineNum, field, ctx, updaterFn) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.addEventListener('change', function() {
      window.MA.history.pushHistory();
      ctx.setMmdText(updaterFn(ctx.getMmdText(), lineNum, field, el.value));
      ctx.onUpdate();
    });
  }

  return {
    init: init,
    bindTextField: bindTextField,
    bindDateField: bindDateField,
    // HTML builders
    fieldHtml: fieldHtml,
    selectFieldHtml: selectFieldHtml,
    panelHeaderHtml: panelHeaderHtml,
    sectionHeaderHtml: sectionHeaderHtml,
    sectionFooterHtml: sectionFooterHtml,
    listItemHtml: listItemHtml,
    emptyListHtml: emptyListHtml,
    primaryButtonHtml: primaryButtonHtml,
    dangerButtonHtml: dangerButtonHtml,
    actionBarHtml: actionBarHtml,
    // Event helpers
    bindEvent: bindEvent,
    connectButtonHtml: connectButtonHtml,
    bindConnectButton: bindConnectButton,
    bindActionBar: bindActionBar,
    bindAllByClass: bindAllByClass,
    bindSelectButtons: bindSelectButtons,
    bindDeleteButtons: bindDeleteButtons,
    bindFieldChange: bindFieldChange,
  };
})();
