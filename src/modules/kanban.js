'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.kanban = (function() {

  function parseKanban(text) {
    var result = { meta: {}, elements: [], relations: [] };
    if (!text || !text.trim()) return result;
    var lines = text.split('\n');
    var cardCounter = 0, colCounter = 0;
    var currentColumn = null;

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var raw = lines[i];
      var trimmed = raw.trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^kanban/.test(trimmed)) continue;

      var indent = raw.match(/^(\s*)/)[1].length;

      // Card: starts with [
      var cm = trimmed.match(/^\[([^\]]*)\](.*)$/);
      if (cm) {
        result.elements.push({
          kind: 'card',
          id: '__c_' + (cardCounter++),
          text: cm[1],
          meta: (cm[2] || '').trim(),
          parentId: currentColumn,
          line: lineNum,
        });
        continue;
      }

      // Column: a bare identifier at shallow indent (treat 2-spaces indent as column level)
      // Heuristic: if indent < 8 and not a card, it's a column
      if (indent <= 6) {
        result.elements.push({
          kind: 'column',
          id: trimmed,
          label: trimmed,
          line: lineNum,
        });
        currentColumn = trimmed;
      }
    }
    return result;
  }

  function addColumn(text, name) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, '    ' + name);
    return lines.join('\n');
  }

  function addCard(text, columnName, cardText, metaStr) {
    var lines = text.split('\n');
    // Find column line
    var colIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim() === columnName) { colIdx = i; break; }
    }
    if (colIdx < 0) return text;
    // Find end of column's cards (next column or end)
    var insertAt = lines.length;
    for (var j = colIdx + 1; j < lines.length; j++) {
      var t = lines[j].trim();
      if (!t) continue;
      var ind = lines[j].match(/^(\s*)/)[1].length;
      // Next column when indent <= 6 and not starting with [
      if (ind <= 6 && t.indexOf('[') !== 0) { insertAt = j; break; }
    }
    while (insertAt > colIdx + 1 && lines[insertAt - 1].trim() === '') insertAt--;
    var cardLine = '        [' + cardText + ']' + (metaStr ? ' ' + metaStr : '');
    lines.splice(insertAt, 0, cardLine);
    return lines.join('\n');
  }

  function deleteElement(text, lineNum) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    // If it's a column (no brackets), remove the column line AND all its cards until next column
    if (trimmed.indexOf('[') !== 0) {
      var endIdx = lines.length;
      for (var j = idx + 1; j < lines.length; j++) {
        var t = lines[j].trim();
        if (!t) continue;
        var ind = lines[j].match(/^(\s*)/)[1].length;
        if (ind <= 6 && t.indexOf('[') !== 0) { endIdx = j; break; }
      }
      lines.splice(idx, endIdx - idx);
      return lines.join('\n');
    }
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updateColumn(text, lineNum, newName) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    lines[idx] = indent + newName;
    return lines.join('\n');
  }

  function updateCard(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = lines[idx].trim().match(/^\[([^\]]*)\](.*)$/);
    if (!m) return text;
    var txt = m[1];
    var meta = (m[2] || '').trim();
    if (field === 'text') txt = value;
    else if (field === 'meta') meta = value;
    lines[idx] = indent + '[' + txt + ']' + (meta ? ' ' + meta : '');
    return lines.join('\n');
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var columns = parsedData.elements.filter(function(e) { return e.kind === 'column'; });
    var cards = parsedData.elements.filter(function(e) { return e.kind === 'card'; });

    if (!selData || selData.length === 0) {
      var colOpts = columns.map(function(c) { return { value: c.id, label: c.id }; });
      if (colOpts.length === 0) colOpts = [{ value: '', label: '（カラムを先に追加）' }];

      var colList = '';
      for (var ci = 0; ci < columns.length; ci++) {
        var c = columns[ci];
        var cardCount = cards.filter(function(x) { return x.parentId === c.id; }).length;
        colList += P.listItemHtml({
          label: c.label, sublabel: '(' + cardCount + ' cards)',
          selectClass: 'kb-select-col', deleteClass: 'kb-delete-col',
          dataElementId: c.id, dataLine: c.line,
        });
      }
      if (!colList) colList = P.emptyListHtml('（カラムなし）');

      var cardList = '';
      for (var ci2 = 0; ci2 < cards.length; ci2++) {
        var cd = cards[ci2];
        cardList += P.listItemHtml({
          label: '[' + cd.text + ']' + (cd.meta ? ' ' + cd.meta : ''),
          sublabel: '(' + (cd.parentId || '?') + ')',
          selectClass: 'kb-select-card', deleteClass: 'kb-delete-card',
          dataElementId: cd.id, dataLine: cd.line, mono: true,
        });
      }
      if (!cardList) cardList = P.emptyListHtml('（カードなし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Kanban</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">カラムを追加</label>' +
          P.fieldHtml('Name (1単語)', 'kb-add-col-name', '', '例: Todo') +
          P.primaryButtonHtml('kb-add-col-btn', '+ カラム追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">カードを追加</label>' +
          P.selectFieldHtml('Column', 'kb-add-c-col', colOpts) +
          P.fieldHtml('Text', 'kb-add-c-text', '', '例: Design spec') +
          P.fieldHtml('Meta (任意)', 'kb-add-c-meta', '', "例: @{ assigned: 'alice' }") +
          P.primaryButtonHtml('kb-add-c-btn', '+ カード追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">カラム一覧</label>' +
          '<div>' + colList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">カード一覧</label>' +
          '<div>' + cardList + '</div>' +
        '</div>';

      P.bindEvent('kb-add-col-btn', 'click', function() {
        var n = document.getElementById('kb-add-col-name').value.trim();
        if (!n) { alert('Name 必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addColumn(ctx.getMmdText(), n));
        ctx.onUpdate();
      });
      P.bindEvent('kb-add-c-btn', 'click', function() {
        var col = document.getElementById('kb-add-c-col').value;
        var t = document.getElementById('kb-add-c-text').value.trim();
        var m = document.getElementById('kb-add-c-meta').value.trim();
        if (!col || !t) { alert('Column と Text 必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addCard(ctx.getMmdText(), col, t, m));
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'kb-select-col', 'column');
      P.bindSelectButtons(propsEl, 'kb-select-card', 'card');
      P.bindDeleteButtons(propsEl, 'kb-delete-col', ctx, deleteElement);
      P.bindDeleteButtons(propsEl, 'kb-delete-card', ctx, deleteElement);
      return;
    }

    if (selData.length === 1) {
      var sel = selData[0];
      if (sel.type === 'column') {
        var c = null;
        for (var i = 0; i < columns.length; i++) if (columns[i].id === sel.id) { c = columns[i]; break; }
        if (!c) { propsEl.innerHTML = '<p>カラムが見つかりません</p>'; return; }
        propsEl.innerHTML =
          P.panelHeaderHtml(c.label) +
          P.fieldHtml('Name', 'kb-edit-col-name', c.label) +
          P.dangerButtonHtml('kb-edit-col-delete', 'カラム削除');
        var ln = c.line;
        document.getElementById('kb-edit-col-name').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateColumn(ctx.getMmdText(), ln, this.value));
          ctx.onUpdate();
        });
        P.bindEvent('kb-edit-col-delete', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteElement(ctx.getMmdText(), ln));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        });
        return;
      }
      if (sel.type === 'card') {
        var card = null;
        for (var j = 0; j < cards.length; j++) if (cards[j].id === sel.id) { card = cards[j]; break; }
        if (!card) { propsEl.innerHTML = '<p>カードが見つかりません</p>'; return; }
        propsEl.innerHTML =
          P.panelHeaderHtml(card.text) +
          '<div style="margin-bottom:8px;color:var(--text-secondary);font-size:11px;">Column: ' + escHtml(card.parentId || '?') + '</div>' +
          P.fieldHtml('Text', 'kb-edit-c-text', card.text) +
          P.fieldHtml('Meta', 'kb-edit-c-meta', card.meta || '') +
          P.dangerButtonHtml('kb-edit-c-delete', 'カード削除');
        var ln = card.line;
        document.getElementById('kb-edit-c-text').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateCard(ctx.getMmdText(), ln, 'text', this.value));
          ctx.onUpdate();
        });
        document.getElementById('kb-edit-c-meta').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateCard(ctx.getMmdText(), ln, 'meta', this.value));
          ctx.onUpdate();
        });
        P.bindEvent('kb-edit-c-delete', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteElement(ctx.getMmdText(), ln));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        });
        return;
      }
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'kanban',
    displayName: 'Kanban',
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'kanban'; },
    parse: parseKanban,
    parseKanban: parseKanban,
    template: function() {
      return [
        'kanban',
        '    Todo',
        '        [Design spec]',
        '        [Research approach]',
        '    InProgress',
        '        [Implement feature]',
        '    Done',
        '        [Initial release]',
      ].join('\n');
    },
    buildOverlay: function(svgEl, parsedData, overlayEl) {
      if (!overlayEl) return;
      while (overlayEl.firstChild) overlayEl.removeChild(overlayEl.firstChild);
      if (!svgEl) return;
      var viewBox = svgEl.getAttribute('viewBox');
      if (viewBox) overlayEl.setAttribute('viewBox', viewBox);
      var svgW = svgEl.getAttribute('width'); var svgH = svgEl.getAttribute('height');
      if (svgW) overlayEl.setAttribute('width', svgW);
      if (svgH) overlayEl.setAttribute('height', svgH);
    },
    renderProps: renderProps,
    operations: {
      add: function(text, kind, props) {
        if (kind === 'column') return addColumn(text, props.name);
        if (kind === 'card') return addCard(text, props.column, props.text, props.meta);
        return text;
      },
      delete: function(text, lineNum) { return deleteElement(text, lineNum); },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        if (opts.kind === 'column') return updateColumn(text, lineNum, value);
        return updateCard(text, lineNum, field, value);
      },
      moveUp: function(text, lineNum) {
        if (lineNum <= 1) return text;
        return window.MA.textUpdater.swapLines(text, lineNum, lineNum - 1);
      },
      moveDown: function(text, lineNum) {
        var total = text.split('\n').length;
        if (lineNum >= total) return text;
        return window.MA.textUpdater.swapLines(text, lineNum, lineNum + 1);
      },
      connect: function(text) { return text; },
    },
    addColumn: addColumn, addCard: addCard, deleteElement: deleteElement,
    updateColumn: updateColumn, updateCard: updateCard,
  };
})();
