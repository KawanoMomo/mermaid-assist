'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.sankeyBeta = (function() {

  function parseSankey(text) {
    var result = { meta: {}, elements: [], relations: [] };
    if (!text || !text.trim()) return result;
    var lines = text.split('\n');
    var relCounter = 0;
    var seenNodes = {};

    function recordNode(name) {
      if (!seenNodes[name]) {
        seenNodes[name] = { kind: 'node', id: name, label: name, line: 0 };
        result.elements.push(seenNodes[name]);
      }
    }

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^sankey-beta/.test(trimmed)) continue;

      // CSV: source,target,value (accept optional quotes)
      // Use a simple CSV parse that respects single-quoted fields
      var fields = parseCsvLine(trimmed);
      if (!fields || fields.length !== 3) continue;
      var src = fields[0], tgt = fields[1];
      var val = parseFloat(fields[2]);
      if (isNaN(val)) continue;

      recordNode(src);
      recordNode(tgt);
      // Update line for newly seen nodes to the first line they appear
      if (!seenNodes[src].line) seenNodes[src].line = lineNum;
      if (!seenNodes[tgt].line) seenNodes[tgt].line = lineNum;

      result.relations.push({
        kind: 'flow',
        id: '__f_' + (relCounter++),
        from: src, to: tgt, value: val,
        line: lineNum,
      });
    }
    return result;
  }

  function parseCsvLine(line) {
    var fields = [];
    var cur = '';
    var inQuote = false;
    var quoteChar = '';
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (inQuote) {
        if (c === quoteChar) { inQuote = false; continue; }
        cur += c;
      } else {
        if (c === "'" || c === '"') { inQuote = true; quoteChar = c; continue; }
        if (c === ',') { fields.push(cur.trim()); cur = ''; continue; }
        cur += c;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  function quoteIfNeeded(s) {
    if (/[,'"]/.test(s)) return "'" + s.replace(/['",]/g, '') + "'";
    return s;
  }

  function addFlow(text, src, tgt, value) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, quoteIfNeeded(src) + ',' + quoteIfNeeded(tgt) + ',' + value);
    return lines.join('\n');
  }

  function deleteFlow(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updateFlow(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var fields = parseCsvLine(lines[idx].trim());
    if (!fields || fields.length !== 3) return text;
    var src = fields[0], tgt = fields[1], val = fields[2];
    if (field === 'from') src = value;
    else if (field === 'to') tgt = value;
    else if (field === 'value') val = value;
    lines[idx] = indent + quoteIfNeeded(src) + ',' + quoteIfNeeded(tgt) + ',' + val;
    return lines.join('\n');
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var nodes = parsedData.elements.filter(function(e) { return e.kind === 'node'; });
    var flows = parsedData.relations;

    if (!selData || selData.length === 0) {
      var nodeOpts = nodes.map(function(n) { return { value: n.id, label: n.label }; });
      if (nodeOpts.length === 0) nodeOpts = [{ value: '', label: '（ノードを先に追加）' }];

      var nodesList = '';
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var inbound = flows.filter(function(f) { return f.to === n.id; }).reduce(function(s, f) { return s + f.value; }, 0);
        var outbound = flows.filter(function(f) { return f.from === n.id; }).reduce(function(s, f) { return s + f.value; }, 0);
        nodesList += P.listItemHtml({
          label: n.label,
          sublabel: 'in ' + inbound + ' / out ' + outbound,
          selectClass: null, deleteClass: null,
          dataElementId: n.id, dataLine: n.line,
        });
      }
      if (!nodesList) nodesList = P.emptyListHtml('（ノードなし）');

      var flowsList = '';
      for (var fi = 0; fi < flows.length; fi++) {
        var f = flows[fi];
        flowsList += P.listItemHtml({
          label: f.from + ' → ' + f.to + ' (' + f.value + ')',
          selectClass: 'sk-select-flow', deleteClass: 'sk-delete-flow',
          dataElementId: f.id, dataLine: f.line, mono: true,
        });
      }
      if (!flowsList) flowsList = P.emptyListHtml('（フローなし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Sankey</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">フローを追加</label>' +
          P.fieldHtml('Source (新規 or 既存)', 'sk-add-src', '', '例: A') +
          P.fieldHtml('Target (新規 or 既存)', 'sk-add-tgt', '', '例: B') +
          P.fieldHtml('Value', 'sk-add-val', '', '数値') +
          P.primaryButtonHtml('sk-add-btn', '+ フロー追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">ノード一覧 (in/out 集計)</label>' +
          '<div>' + nodesList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">フロー一覧</label>' +
          '<div>' + flowsList + '</div>' +
        '</div>';

      P.bindEvent('sk-add-btn', 'click', function() {
        var src = document.getElementById('sk-add-src').value.trim();
        var tgt = document.getElementById('sk-add-tgt').value.trim();
        var val = document.getElementById('sk-add-val').value.trim();
        if (!src || !tgt || !val) { alert('全項目必須'); return; }
        if (isNaN(parseFloat(val))) { alert('Value は数値'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addFlow(ctx.getMmdText(), src, tgt, val));
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'sk-select-flow', 'flow');
      P.bindDeleteButtons(propsEl, 'sk-delete-flow', ctx, deleteFlow);
      return;
    }

    if (selData.length === 1 && selData[0].type === 'flow') {
      var fl = null;
      for (var fj = 0; fj < flows.length; fj++) if (flows[fj].id === selData[0].id) { fl = flows[fj]; break; }
      if (!fl) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">フローが見つかりません</p>'; return; }
      propsEl.innerHTML =
        P.panelHeaderHtml(fl.from + ' → ' + fl.to) +
        P.fieldHtml('Source', 'sk-edit-from', fl.from) +
        P.fieldHtml('Target', 'sk-edit-to', fl.to) +
        P.fieldHtml('Value', 'sk-edit-val', String(fl.value)) +
        P.dangerButtonHtml('sk-edit-delete', 'フロー削除');
      var ln = fl.line;
      document.getElementById('sk-edit-from').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateFlow(ctx.getMmdText(), ln, 'from', this.value));
        ctx.onUpdate();
      });
      document.getElementById('sk-edit-to').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateFlow(ctx.getMmdText(), ln, 'to', this.value));
        ctx.onUpdate();
      });
      document.getElementById('sk-edit-val').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateFlow(ctx.getMmdText(), ln, 'value', this.value));
        ctx.onUpdate();
      });
      P.bindEvent('sk-edit-delete', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(deleteFlow(ctx.getMmdText(), ln));
        window.MA.selection.clearSelection();
        ctx.onUpdate();
      });
      return;
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'sankey-beta',
    displayName: 'Sankey',
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'sankey-beta'; },
    parse: parseSankey,
    parseSankey: parseSankey,
    template: function() {
      return [
        'sankey-beta',
        '',
        'Sales,Product_A,100',
        'Sales,Product_B,80',
        'Product_A,Profit,60',
        'Product_A,Cost,40',
        'Product_B,Profit,50',
        'Product_B,Cost,30',
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
        if (kind === 'flow') return addFlow(text, props.from, props.to, props.value);
        return text;
      },
      delete: function(text, lineNum) { return deleteFlow(text, lineNum); },
      update: function(text, lineNum, field, value) { return updateFlow(text, lineNum, field, value); },
      moveUp: function(text, lineNum) {
        if (lineNum <= 1) return text;
        return window.MA.textUpdater.swapLines(text, lineNum, lineNum - 1);
      },
      moveDown: function(text, lineNum) {
        var total = text.split('\n').length;
        if (lineNum >= total) return text;
        return window.MA.textUpdater.swapLines(text, lineNum, lineNum + 1);
      },
      connect: function(text, fromName, toName, props) {
        props = props || {};
        return addFlow(text, fromName, toName, props.value || 1);
      },
    },
    addFlow: addFlow, deleteFlow: deleteFlow, updateFlow: updateFlow,
    parseCsvLine: parseCsvLine,
  };
})();
