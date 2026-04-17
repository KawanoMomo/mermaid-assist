'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.pie = (function() {

  function parsePie(text) {
    var result = { meta: { title: '', showData: false }, elements: [], relations: [] };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var sliceCounter = 0;

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;

      // Header: `pie [showData] [title <text>]`
      var hm = trimmed.match(/^pie\b(?:\s+(showData))?(?:\s+title\s+(.*))?$/);
      if (hm) {
        if (hm[1]) result.meta.showData = true;
        if (hm[2]) result.meta.title = hm[2].trim();
        continue;
      }

      // Slice: `"label" : value`
      var sm = trimmed.match(/^"([^"]*)"\s*:\s*([0-9.]+)\s*$/);
      if (sm) {
        result.elements.push({
          kind: 'slice',
          id: '__s_' + (sliceCounter++),
          label: sm[1],
          value: parseFloat(sm[2]),
          line: lineNum,
        });
      }
    }
    return result;
  }

  function addSlice(text, label, value) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, '    "' + label + '" : ' + value);
    return lines.join('\n');
  }

  function deleteSlice(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updateSlice(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = lines[idx].trim().match(/^"([^"]*)"\s*:\s*([0-9.]+)\s*$/);
    if (!m) return text;
    var label = m[1], val = m[2];
    if (field === 'label') label = value;
    else if (field === 'value') val = value;
    lines[idx] = indent + '"' + label + '" : ' + val;
    return lines.join('\n');
  }

  function setTitle(text, newTitle) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t || t.indexOf('%%') === 0) continue;
      var m = t.match(/^pie\b(\s+showData)?(?:\s+title\s+.*)?$/);
      if (m) {
        var indent = lines[i].match(/^(\s*)/)[1];
        var showData = m[1] ? ' showData' : '';
        lines[i] = indent + 'pie' + showData + (newTitle ? ' title ' + newTitle : '');
        return lines.join('\n');
      }
      break;
    }
    return text;
  }

  function setShowData(text, show) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t || t.indexOf('%%') === 0) continue;
      var m = t.match(/^pie\b(\s+showData)?(?:\s+title\s+(.*))?$/);
      if (m) {
        var indent = lines[i].match(/^(\s*)/)[1];
        var title = (m[2] || '').trim();
        lines[i] = indent + 'pie' + (show ? ' showData' : '') + (title ? ' title ' + title : '');
        return lines.join('\n');
      }
      break;
    }
    return text;
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var slices = parsedData.elements.filter(function(e) { return e.kind === 'slice'; });

    if (!selData || selData.length === 0) {
      var slicesList = '';
      for (var i = 0; i < slices.length; i++) {
        var s = slices[i];
        slicesList += P.listItemHtml({
          label: '"' + s.label + '" : ' + s.value,
          selectClass: 'pie-select-slice', deleteClass: 'pie-delete-slice',
          dataElementId: s.id, dataLine: s.line, mono: true,
        });
      }
      if (!slicesList) slicesList = P.emptyListHtml('（スライスなし）');

      var currentTitle = parsedData.meta.title || '';
      var currentShowData = parsedData.meta.showData;

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Pie Chart</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">Title 設定</label>' +
          P.fieldHtml('Title', 'pie-title', currentTitle) +
          P.primaryButtonHtml('pie-set-title-btn', 'Title 適用') +
        '</div>' +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-primary);">' +
            '<input type="checkbox" id="pie-show-data"' + (currentShowData ? ' checked' : '') + '>' +
            'showData (数値表示)' +
          '</label>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">スライスを追加</label>' +
          P.fieldHtml('Label', 'pie-add-label', '', '例: Dogs') +
          P.fieldHtml('Value', 'pie-add-value', '', '数値') +
          P.primaryButtonHtml('pie-add-btn', '+ スライス追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">スライス一覧</label>' +
          '<div>' + slicesList + '</div>' +
        '</div>';

      P.bindEvent('pie-set-title-btn', 'click', function() {
        var v = document.getElementById('pie-title').value.trim();
        window.MA.history.pushHistory();
        ctx.setMmdText(setTitle(ctx.getMmdText(), v));
        ctx.onUpdate();
      });
      P.bindEvent('pie-show-data', 'change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(setShowData(ctx.getMmdText(), this.checked));
        ctx.onUpdate();
      });
      P.bindEvent('pie-add-btn', 'click', function() {
        var label = document.getElementById('pie-add-label').value.trim();
        var value = document.getElementById('pie-add-value').value.trim();
        if (!label || !value) { alert('Label と Value は必須です'); return; }
        if (isNaN(parseFloat(value))) { alert('Value は数値を入れてください'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addSlice(ctx.getMmdText(), label, value));
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'pie-select-slice', 'slice');
      P.bindDeleteButtons(propsEl, 'pie-delete-slice', ctx, deleteSlice);
      return;
    }

    if (selData.length === 1 && selData[0].type === 'slice') {
      var sl = null;
      for (var sj = 0; sj < slices.length; sj++) if (slices[sj].id === selData[0].id) { sl = slices[sj]; break; }
      if (!sl) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">スライスが見つかりません</p>'; return; }

      propsEl.innerHTML =
        P.panelHeaderHtml(sl.label) +
        P.fieldHtml('Label', 'pie-edit-label', sl.label) +
        P.fieldHtml('Value', 'pie-edit-value', String(sl.value)) +
        P.dangerButtonHtml('pie-edit-delete', 'スライス削除');

      var sliceLine = sl.line;
      document.getElementById('pie-edit-label').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateSlice(ctx.getMmdText(), sliceLine, 'label', this.value));
        ctx.onUpdate();
      });
      document.getElementById('pie-edit-value').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateSlice(ctx.getMmdText(), sliceLine, 'value', this.value));
        ctx.onUpdate();
      });
      P.bindEvent('pie-edit-delete', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(deleteSlice(ctx.getMmdText(), sliceLine));
        window.MA.selection.clearSelection();
        ctx.onUpdate();
      });
      return;
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'pie',
    displayName: 'Pie',
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'pie'; },
    parse: parsePie,
    parsePie: parsePie,
    template: function() {
      return [
        'pie title プロジェクト工数',
        '    "設計" : 30',
        '    "実装" : 50',
        '    "テスト" : 20',
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
        if (kind === 'slice') return addSlice(text, props.label, props.value);
        return text;
      },
      delete: function(text, lineNum) { return deleteSlice(text, lineNum); },
      update: function(text, lineNum, field, value) {
        if (field === 'title') return setTitle(text, value);
        if (field === 'showData') return setShowData(text, value);
        return updateSlice(text, lineNum, field, value);
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
    addSlice: addSlice, deleteSlice: deleteSlice, updateSlice: updateSlice,
    setTitle: setTitle, setShowData: setShowData,
  };
})();
