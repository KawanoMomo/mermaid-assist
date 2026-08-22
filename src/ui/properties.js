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
    return '<div style="margin-bottom:8px;">' +
      '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">' + escHtml(label) + '</label>' +
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
    return '<div style="margin-bottom:8px;">' +
      '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">' + escHtml(label) + '</label>' +
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

  // listItemHtml: row with label + select-edit and delete buttons
  // opts: { label, sublabel?, selectClass, deleteClass, dataElementId?, dataLine?, dataEndLine?, mono? }
  function listItemHtml(opts) {
    var sub = opts.sublabel ? ' <span style="color:var(--text-secondary);font-size:10px;">' + escHtml(opts.sublabel) + '</span>' : '';
    var fontStyle = opts.mono ? 'font-family:var(--font-mono);' : '';
    var dataAttrs = '';
    if (opts.dataElementId !== undefined) dataAttrs += ' data-element-id="' + escHtml(opts.dataElementId) + '"';
    if (opts.dataLine !== undefined) dataAttrs += ' data-line="' + opts.dataLine + '"';
    if (opts.dataEndLine !== undefined) dataAttrs += ' data-end-line="' + opts.dataEndLine + '"';
    var selectBtn = opts.selectClass ?
      '<button class="' + opts.selectClass + '"' + dataAttrs + ' style="background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">編集</button>' : '';
    // deleteLabel / deleteTitle let a module warn about a cascading delete on the
    // button itself. The row's text is ellipsised at the panel width, so a warning
    // placed in the label is frequently invisible.
    var delLabel = opts.deleteLabel ? escHtml(opts.deleteLabel) : '✕';
    // 記号だけのボタンは、何を消すのか読み取れない。deleteTitle を渡していない
    // モジュールにも行のラベルから既定の説明を与える。ホバーとスクリーンリーダの
    // 両方でここが唯一の手がかりになる。
    var delTitleText = opts.deleteTitle || ('「' + String(opts.label) + '」を削除');
    var delTitle = ' title="' + escHtml(delTitleText) + '"';
    var deleteBtn = opts.deleteClass ?
      '<button class="' + opts.deleteClass + '"' + dataAttrs + delTitle + ' style="background:var(--accent-red);color:#fff;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;white-space:nowrap;">' + delLabel + '</button>' : '';
    // 行に印を付ける。一覧の絞り込みはこの印を見て行を選ぶので、
    // 各モジュールは何もしなくてよい (41か所がこの関数を通る)。
    return '<div class="ma-list-row" style="display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:3px 4px;background:var(--bg-tertiary);border-radius:3px;font-size:11px;">' +
      // 名前欄は 123px しかなく、長い名前は ellipsis で切れる。実測では
      // "ComM_ChannelStateManager_MainFunction" が "ComM_ChannelStat" までしか
      // 読めず、**先頭が共通で末尾だけ違う名前を見分けられない** (組込みの
      // BSW 名は先頭共通が普通)。gantt.js は自前の行に title を付けていたが、
      // 41か所が通るこの共有関数には無かった。切れたときの唯一の手がかりを足す。
      '<div title="' + escHtml(String(opts.label)) + '" style="flex:1;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + fontStyle + '">' + escHtml(opts.label) + sub + '</div>' +
      selectBtn + deleteBtn +
    '</div>';
  }

  // emptyListHtml: placeholder text when a list is empty
  function emptyListHtml(text) {
    return '<div style="font-size:11px;color:var(--text-secondary);">' + escHtml(text) + '</div>';
  }

  // primaryButtonHtml: full-width accent button
  function primaryButtonHtml(id, label) {
    return '<button id="' + id + '" style="width:100%;background:var(--accent);color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;">' + escHtml(label) + '</button>';
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
      var newText = useEndLine
        ? deleteFn(ctx.getMmdText(), ln, endLn)
        : deleteFn(ctx.getMmdText(), ln, elId);
      ctx.setMmdText(newText);
      ctx.onUpdate();
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
