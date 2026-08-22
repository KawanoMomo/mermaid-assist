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

      // カード。`[本文]` と `id[本文]` の両方を受ける。
      //
      // mermaid の正規表記は `id[本文]` で、`@{ assigned: '…' }` の割り当てを
      // 付けるにはこの形が要る。ところが `^\[` 始まりしか見ていなかったので、
      // **id 付きのカードは行ごと消えていた** (列判定の indent にも掛からない)。
      // mermaid は描くので、図には出るのに一覧にも重ね合わせにも出ない。
      var cm = trimmed.match(/^([A-Za-z_][\w-]*)?\[([^\]]*)\](.*)$/);
      if (cm) {
        // mermaid は SVG の id に DSL の id をそのまま使う (無ければ本文)。
        // 重ね合わせの照合をそこに合わせるため、こちらも同じものを id にする。
        result.elements.push({
          kind: 'card',
          id: cm[1] || ('__c_' + (cardCounter++)),
          cardId: cm[1] || '',
          text: cm[2],
          meta: (cm[3] || '').trim(),
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

  // addCard: columnLine を渡すと、その行のカラムに入れる。
  //
  // 以前はカラムを**ラベル文字列の一致**でしか探していなかったので、同名のカラムが
  // 2つあると常に先頭側へ入る。利用者が2つ目を選んでも、選んだカラムにはカードが
  // 増えない (無言の誤操作)。行番号なら同名でも一意に決まる。
  function addCard(text, columnName, cardText, metaStr, columnLine) {
    var lines = text.split('\n');
    // Find column line
    var colIdx = -1;
    if (columnLine !== undefined && columnLine !== null && !isNaN(columnLine)) {
      var ci = columnLine - 1;
      if (ci >= 0 && ci < lines.length) colIdx = ci;
    }
    if (colIdx < 0) {
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim() === columnName) { colIdx = i; break; }
      }
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
      // 同名カラムを区別できるよう、value に行番号を持たせる。
      // id (= ラベル) だけだと 2つ目の Todo を選んでも value が同じになる。
      var colOpts = columns.map(function(c) { return { value: String(c.line), label: c.id }; });
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
          P.fieldHtml('ラベル (1単語)', 'kb-add-col-name', '', '例: Todo') +
          P.primaryButtonHtml('kb-add-col-btn', '+ カラム追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">カードを追加</label>' +
          P.selectFieldHtml('Column', 'kb-add-c-col', colOpts) +
          P.fieldHtml('ラベル', 'kb-add-c-text', '', '例: Design spec') +
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
        if (!n) { alert('Name は必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addColumn(ctx.getMmdText(), n));
        ctx.onUpdate();
      });
      P.bindEvent('kb-add-c-btn', 'click', function() {
        var col = document.getElementById('kb-add-c-col').value;
        var t = document.getElementById('kb-add-c-text').value.trim();
        var m = document.getElementById('kb-add-c-meta').value.trim();
        if (!col || !t) { alert('Column と Text は必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addCard(ctx.getMmdText(), '', t, m, parseInt(col, 10)));
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
          P.fieldHtml('ラベル', 'kb-edit-col-name', c.label) +
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
          P.fieldHtml('ラベル', 'kb-edit-c-text', card.text) +
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
    // 重ね合わせ。
    //
    // 「mermaid が DSL の id を SVG に出さないので入れない」という判断で
    // 11図種まとめて見送っていたが、**kanban は当てはまらなかった**。実測すると
    //
    //   列  → `<g class="cluster" id="設計 中">`   … 列名そのもの
    //   札  → `<g class="node" id="t1">`           … DSL の id (無ければ本文)
    //
    // どちらも順序に依らない。見送りの理由が全図種に当てはまるかを確かめずに
    // 一括りにしていた。10図種については理由は今も正しい (id が `node-1` や
    // `edge_0_1` のような位置由来で、並べ替えると別の要素を指す)。
    buildOverlay: function(svgEl, parsedData, overlayEl) {
      if (!overlayEl) return;
      while (overlayEl.firstChild) overlayEl.removeChild(overlayEl.firstChild);
      if (!svgEl) return;
      var G = window.MA.overlayGeom;
      G.syncViewport(svgEl, overlayEl);
      if (!parsedData || !parsedData.elements) return;

      // 札は DSL の id、無ければ本文で照合する (mermaid と同じ規則)。
      var byKey = {};
      parsedData.elements.forEach(function(e) {
        if (e.kind === 'column') byKey['c:' + e.id] = e;
        else if (e.kind === 'card') byKey['k:' + (e.cardId || e.text)] = e;
      });

      function place(selector, prefix, useLabelBand) {
        var nodes = svgEl.querySelectorAll(selector);
        for (var i = 0; i < nodes.length; i++) {
          var el = byKey[prefix + nodes[i].getAttribute('id')];
          if (!el) continue;
          // 列の枠は札の上に重なって見えるので、枠全体を当たり判定にすると
          // 札を押せなくなる (実測: 列を押したつもりで札が選ばれた)。
          // 列は見出しの帯だけをつかみ所にする。札は列とは別のグループにあるので
          // 重ならない。
          var target = nodes[i];
          if (useLabelBand) {
            var lab = nodes[i].querySelector('.cluster-label');
            if (lab) target = lab;
          }
          var box = G.boxInSvgSpace(svgEl, target);
          if (!box) continue;
          overlayEl.appendChild(G.hitRect(document, box, {
            id: el.id,
            kind: el.kind,
            line: el.line,
            selected: window.MA.selection.isSelected(el.id),
            className: 'overlay-node',
          }));
        }
      }
      place('g.cluster[id]', 'c:', true);
      place('g.node[id]', 'k:', false);
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
        if (opts.kind === 'column') {
        // 知らない field で名前を書き換えない。
        // 以前は field を見ず kind だけで分岐していたため、どんな field 名でも
        // 名前が置き換わった。将来 field を増やしたときに黙って名前を潰す。
          if (field !== 'name' && field !== 'label') return text;
          return updateColumn(text, lineNum, value);
        }
        return updateCard(text, lineNum, field, value);
      },
      // 素の行入れ替えは**図の宣言行と入れ替わって図を壊す**。
      // 同じ種類の要素が乗っている行としか入れ替えない。
      moveUp: function(text, lineNum) {
        return window.MA.textUpdater.moveElementLine(
          text, lineNum, -1, (parseKanban(text).elements || []));
      },
      moveDown: function(text, lineNum) {
        return window.MA.textUpdater.moveElementLine(
          text, lineNum, 1, (parseKanban(text).elements || []));
      },
      connect: function(text) { return text; },
    },
    addColumn: addColumn, addCard: addCard, deleteElement: deleteElement,
    updateColumn: updateColumn, updateCard: updateCard,
  };
})();
