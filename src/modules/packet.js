'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.packetBeta = (function() {

  function parsePacket(text) {
    var result = { meta: { title: '' }, elements: [], relations: [] };
    if (!text || !text.trim()) return result;
    var lines = text.split('\n');
    var fieldCounter = 0;

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^packet-beta/.test(trimmed)) continue;

      var tm;
      if ((tm = trimmed.match(/^title\s+"([^"]*)"\s*$/))) { result.meta.title = tm[1]; continue; }
      if ((tm = trimmed.match(/^title\s+(.+)$/))) { result.meta.title = tm[1].trim(); continue; }

      // Range: N-M: "label"
      var rm = trimmed.match(/^(\d+)\s*-\s*(\d+)\s*:\s*"([^"]*)"\s*$/);
      if (rm) {
        result.elements.push({
          kind: 'field',
          id: '__f_' + (fieldCounter++),
          startBit: parseInt(rm[1], 10),
          endBit: parseInt(rm[2], 10),
          label: rm[3],
          line: lineNum,
        });
        continue;
      }

      // Single bit: N: "label"
      var sm = trimmed.match(/^(\d+)\s*:\s*"([^"]*)"\s*$/);
      if (sm) {
        var b = parseInt(sm[1], 10);
        result.elements.push({
          kind: 'field',
          id: '__f_' + (fieldCounter++),
          startBit: b, endBit: b,
          label: sm[2],
          line: lineNum,
        });
      }
    }
    return result;
  }

  function setTitle(text, newTitle) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t || t.indexOf('%%') === 0) continue;
      if (/^title\s+/.test(t)) {
        var indent = lines[i].match(/^(\s*)/)[1];
        lines[i] = indent + 'title "' + newTitle + '"';
        return lines.join('\n');
      }
      if (/^packet-beta/.test(t)) {
        lines.splice(i + 1, 0, 'title "' + newTitle + '"');
        return lines.join('\n');
      }
    }
    return text;
  }

  function formatField(startBit, endBit, label) {
    var range = (startBit === endBit) ? String(startBit) : (startBit + '-' + endBit);
    return range + ': "' + label + '"';
  }

  function addField(text, startBit, endBit, label) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, formatField(startBit, endBit, label));
    return lines.join('\n');
  }

  function deleteField(text, lineNum) { return window.MA.textUpdater.deleteLine(text, lineNum); }

  function updateField(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var trimmed = lines[idx].trim();
    var m = trimmed.match(/^(\d+)(?:\s*-\s*(\d+))?\s*:\s*"([^"]*)"\s*$/);
    if (!m) return text;
    var start = parseInt(m[1], 10);
    var end = m[2] ? parseInt(m[2], 10) : start;
    var label = m[3];
    if (field === 'startBit') start = parseInt(value, 10);
    else if (field === 'endBit') end = parseInt(value, 10);
    else if (field === 'label') label = value;
    lines[idx] = indent + formatField(start, end, label);
    return lines.join('\n');
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var fields = parsedData.elements.filter(function(e) { return e.kind === 'field'; });

    if (!selData || selData.length === 0) {
      var fieldsList = '';
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        var range = (f.startBit === f.endBit) ? String(f.startBit) : (f.startBit + '-' + f.endBit);
        var width = f.endBit - f.startBit + 1;
        fieldsList += P.listItemHtml({
          label: range + ': "' + f.label + '"',
          sublabel: '(' + width + ' bits)',
          selectClass: 'pk-select-field', deleteClass: 'pk-delete-field',
          dataElementId: f.id, dataLine: f.line, mono: true,
        });
      }
      if (!fieldsList) fieldsList = P.emptyListHtml('（フィールドなし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Packet</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">Title 設定</label>' +
          P.fieldHtml('Title', 'pk-title', parsedData.meta.title || '') +
          P.primaryButtonHtml('pk-set-title', 'Title 適用') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">フィールドを追加</label>' +
          P.fieldHtml('開始 bit', 'pk-add-start', '0') +
          P.fieldHtml('終了 bit', 'pk-add-end', '0', '同じ値なら単一 bit') +
          P.fieldHtml('Label', 'pk-add-label', '', '例: Source Port') +
          P.primaryButtonHtml('pk-add-btn', '+ フィールド追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">フィールド一覧</label>' +
          '<div>' + fieldsList + '</div>' +
        '</div>';

      P.bindEvent('pk-set-title', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(setTitle(ctx.getMmdText(), document.getElementById('pk-title').value.trim()));
        ctx.onUpdate();
      });
      P.bindEvent('pk-add-btn', 'click', function() {
        var s = document.getElementById('pk-add-start').value.trim();
        var e = document.getElementById('pk-add-end').value.trim();
        var l = document.getElementById('pk-add-label').value.trim();
        if (s === '' || e === '' || !l) { alert('全項目必須'); return; }
        var si = parseInt(s, 10), ei = parseInt(e, 10);
        if (isNaN(si) || isNaN(ei)) { alert('bit は整数'); return; }
        if (ei < si) { alert('終了 >= 開始 でお願いします'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addField(ctx.getMmdText(), si, ei, l));
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'pk-select-field', 'field');
      P.bindDeleteButtons(propsEl, 'pk-delete-field', ctx, deleteField);
      return;
    }

    if (selData.length === 1 && selData[0].type === 'field') {
      var f = null;
      for (var fj = 0; fj < fields.length; fj++) if (fields[fj].id === selData[0].id) { f = fields[fj]; break; }
      if (!f) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">フィールドが見つかりません</p>'; return; }
      propsEl.innerHTML =
        P.panelHeaderHtml(f.label) +
        P.fieldHtml('開始 bit', 'pk-edit-start', String(f.startBit)) +
        P.fieldHtml('終了 bit', 'pk-edit-end', String(f.endBit)) +
        P.fieldHtml('Label', 'pk-edit-label', f.label) +
        P.dangerButtonHtml('pk-edit-delete', 'フィールド削除');
      var ln = f.line;
      ['start', 'end', 'label'].forEach(function(field) {
        var input = document.getElementById('pk-edit-' + field);
        if (input) input.addEventListener('change', function() {
          window.MA.history.pushHistory();
          var key = field === 'start' ? 'startBit' : (field === 'end' ? 'endBit' : 'label');
          ctx.setMmdText(updateField(ctx.getMmdText(), ln, key, this.value));
          ctx.onUpdate();
        });
      });
      P.bindEvent('pk-edit-delete', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(deleteField(ctx.getMmdText(), ln));
        window.MA.selection.clearSelection();
        ctx.onUpdate();
      });
      return;
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'packet-beta',
    displayName: 'Packet',
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'packet-beta'; },
    parse: parsePacket,
    parsePacket: parsePacket,
    template: function() {
      return [
        'packet-beta',
        'title "TCP Header"',
        '0-15: "Source Port"',
        '16-31: "Destination Port"',
        '32-63: "Sequence Number"',
        '64-95: "Acknowledgment Number"',
        '96-99: "Data Offset"',
        '100-105: "Reserved"',
        '106: "URG"',
        '107: "ACK"',
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
        if (kind === 'field') return addField(text, props.startBit, props.endBit, props.label);
        return text;
      },
      delete: function(text, lineNum) { return deleteField(text, lineNum); },
      update: function(text, lineNum, field, value) { return updateField(text, lineNum, field, value); },
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
    setTitle: setTitle, addField: addField, deleteField: deleteField, updateField: updateField,
  };
})();
