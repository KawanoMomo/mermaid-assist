'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.radarBeta = (function() {

  function parseRadar(text) {
    var result = { meta: { title: '', min: 0, max: 100, axes: [] }, elements: [], relations: [] };
    if (!text || !text.trim()) return result;
    var lines = text.split('\n');
    var curveCounter = 0;

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^radar-beta/.test(trimmed)) continue;

      var tm = trimmed.match(/^title\s+"([^"]*)"\s*$/);
      if (tm) { result.meta.title = tm[1]; continue; }

      var minM = trimmed.match(/^min\s+(-?[0-9.]+)\s*$/);
      if (minM) { result.meta.min = parseFloat(minM[1]); continue; }

      var maxM = trimmed.match(/^max\s+(-?[0-9.]+)\s*$/);
      if (maxM) { result.meta.max = parseFloat(maxM[1]); continue; }

      // axis id["label"], id["label"], ...
      var am = trimmed.match(/^axis\s+(.+)$/);
      if (am) {
        var parts = [];
        var re = /([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*"([^"]*)"\s*\]/g;
        var mm;
        while ((mm = re.exec(am[1])) !== null) {
          parts.push({ id: mm[1], label: mm[2] });
        }
        result.meta.axes = parts;
        continue;
      }

      // curve id["label"]{val1, val2, ...}
      var cm = trimmed.match(/^curve\s+([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*"([^"]*)"\s*\]\s*\{([^}]*)\}\s*$/);
      if (cm) {
        var values = cm[3].split(',').map(function(s) { return parseFloat(s.trim()); }).filter(function(v) { return !isNaN(v); });
        result.elements.push({
          kind: 'curve',
          id: cm[1],
          label: cm[2],
          values: values,
          line: lineNum,
        });
      }
    }
    return result;
  }

  function replaceOrInsertLine(text, regex, newLine) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t || t.indexOf('%%') === 0) continue;
      if (regex.test(t)) {
        var indent = lines[i].match(/^(\s*)/)[1];
        lines[i] = indent + newLine;
        return lines.join('\n');
      }
    }
    for (var j = 0; j < lines.length; j++) {
      if (/^radar-beta/.test(lines[j].trim())) {
        lines.splice(j + 1, 0, '    ' + newLine);
        return lines.join('\n');
      }
    }
    return text;
  }

  function setTitle(text, v) { return replaceOrInsertLine(text, /^title\s+/, 'title "' + v + '"'); }
  function setMin(text, v) { return replaceOrInsertLine(text, /^min\s+/, 'min ' + v); }
  function setMax(text, v) { return replaceOrInsertLine(text, /^max\s+/, 'max ' + v); }

  function setAxes(text, axes) {
    // axes: array of { id, label }
    var axisStr = axes.map(function(a) { return a.id + '["' + a.label + '"]'; }).join(', ');
    return replaceOrInsertLine(text, /^axis\s+/, 'axis ' + axisStr);
  }

  function addCurve(text, id, label, values) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    var valsStr = Array.isArray(values) ? values.join(', ') : values;
    lines.splice(insertAt, 0, '    curve ' + id + '["' + label + '"]{' + valsStr + '}');
    return lines.join('\n');
  }

  function deleteCurve(text, lineNum) { return window.MA.textUpdater.deleteLine(text, lineNum); }

  function updateCurve(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = lines[idx].trim().match(/^curve\s+([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*"([^"]*)"\s*\]\s*\{([^}]*)\}\s*$/);
    if (!m) return text;
    var id = m[1], label = m[2], vals = m[3];
    if (field === 'id') id = value;
    else if (field === 'label') label = value;
    else if (field === 'values') vals = Array.isArray(value) ? value.join(', ') : value;
    lines[idx] = indent + 'curve ' + id + '["' + label + '"]{' + vals + '}';
    return lines.join('\n');
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var curves = parsedData.elements.filter(function(e) { return e.kind === 'curve'; });
    var m = parsedData.meta;

    if (!selData || selData.length === 0) {
      var axesStr = (m.axes || []).map(function(a) { return a.id + ':' + a.label; }).join(', ');

      var curvesList = '';
      for (var i = 0; i < curves.length; i++) {
        var c = curves[i];
        curvesList += P.listItemHtml({
          label: c.id + '["' + c.label + '"] {' + c.values.join(', ') + '}',
          sublabel: '(' + c.values.length + ' values)',
          selectClass: 'rd-select-curve', deleteClass: 'rd-delete-curve',
          dataElementId: c.id, dataLine: c.line, mono: true,
        });
      }
      if (!curvesList) curvesList = P.emptyListHtml('（カーブなし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Radar</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">設定</label>' +
          P.fieldHtml('Title', 'rd-title', m.title) +
          P.primaryButtonHtml('rd-set-title', 'Title 適用') +
          '<div style="height:6px;"></div>' +
          P.fieldHtml('Min', 'rd-min', String(m.min)) +
          P.fieldHtml('Max', 'rd-max', String(m.max)) +
          P.primaryButtonHtml('rd-set-minmax', 'Min/Max 適用') +
          '<div style="height:6px;"></div>' +
          P.fieldHtml('軸 (形式: id1:ラベル, id2:ラベル,...)', 'rd-axes', axesStr, '例: comm:Communication, strat:Strategy') +
          P.primaryButtonHtml('rd-set-axes', '軸 適用') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">カーブを追加</label>' +
          P.fieldHtml('ID', 'rd-add-id', '', '例: alice') +
          P.fieldHtml('Label', 'rd-add-label', '', '例: Alice') +
          P.fieldHtml('Values (カンマ区切り)', 'rd-add-values', '', '軸の数に合わせる') +
          P.primaryButtonHtml('rd-add-btn', '+ カーブ追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">カーブ一覧</label>' +
          '<div>' + curvesList + '</div>' +
        '</div>';

      P.bindEvent('rd-set-title', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(setTitle(ctx.getMmdText(), document.getElementById('rd-title').value.trim()));
        ctx.onUpdate();
      });
      P.bindEvent('rd-set-minmax', 'click', function() {
        window.MA.history.pushHistory();
        var t = ctx.getMmdText();
        var mn = document.getElementById('rd-min').value.trim();
        var mx = document.getElementById('rd-max').value.trim();
        if (mn !== '') t = setMin(t, mn);
        if (mx !== '') t = setMax(t, mx);
        ctx.setMmdText(t);
        ctx.onUpdate();
      });
      P.bindEvent('rd-set-axes', 'click', function() {
        var raw = document.getElementById('rd-axes').value.trim();
        if (!raw) { alert('軸 必須'); return; }
        var axes = raw.split(',').map(function(p) {
          var parts = p.split(':').map(function(x) { return x.trim(); });
          return { id: parts[0], label: parts[1] || parts[0] };
        });
        window.MA.history.pushHistory();
        ctx.setMmdText(setAxes(ctx.getMmdText(), axes));
        ctx.onUpdate();
      });
      P.bindEvent('rd-add-btn', 'click', function() {
        var id = document.getElementById('rd-add-id').value.trim();
        var label = document.getElementById('rd-add-label').value.trim();
        var vals = document.getElementById('rd-add-values').value.trim();
        if (!id || !label || !vals) { alert('全項目必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addCurve(ctx.getMmdText(), id, label, vals));
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'rd-select-curve', 'curve');
      P.bindDeleteButtons(propsEl, 'rd-delete-curve', ctx, deleteCurve);
      return;
    }

    if (selData.length === 1 && selData[0].type === 'curve') {
      var c = null;
      for (var j = 0; j < curves.length; j++) if (curves[j].id === selData[0].id) { c = curves[j]; break; }
      if (!c) { propsEl.innerHTML = '<p>カーブが見つかりません</p>'; return; }
      propsEl.innerHTML =
        P.panelHeaderHtml(c.label) +
        P.fieldHtml('ID', 'rd-edit-id', c.id) +
        P.fieldHtml('Label', 'rd-edit-label', c.label) +
        P.fieldHtml('Values (カンマ区切り)', 'rd-edit-values', c.values.join(', ')) +
        P.dangerButtonHtml('rd-edit-delete', 'カーブ削除');
      var ln = c.line;
      ['id', 'label', 'values'].forEach(function(f) {
        var input = document.getElementById('rd-edit-' + f);
        if (input) input.addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateCurve(ctx.getMmdText(), ln, f, this.value));
          ctx.onUpdate();
        });
      });
      P.bindEvent('rd-edit-delete', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(deleteCurve(ctx.getMmdText(), ln));
        window.MA.selection.clearSelection();
        ctx.onUpdate();
      });
      return;
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'radar-beta',
    displayName: 'Radar',
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'radar-beta'; },
    parse: parseRadar,
    parseRadar: parseRadar,
    template: function() {
      return [
        'radar-beta',
        '    title "Skill Assessment"',
        '    axis c["Comm"], s["Strat"], l["Lead"], v["Vision"], t["Tech"]',
        '    curve a["Alice"]{85, 90, 75, 95, 80}',
        '    curve b["Bob"]{70, 80, 85, 75, 90}',
        '    max 100',
        '    min 0',
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
        if (kind === 'curve') return addCurve(text, props.id, props.label, props.values);
        return text;
      },
      delete: function(text, lineNum) { return deleteCurve(text, lineNum); },
      update: function(text, lineNum, field, value) { return updateCurve(text, lineNum, field, value); },
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
    setTitle: setTitle, setMin: setMin, setMax: setMax, setAxes: setAxes,
    addCurve: addCurve, deleteCurve: deleteCurve, updateCurve: updateCurve,
  };
})();
