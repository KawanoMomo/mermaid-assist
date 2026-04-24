'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.xychartBeta = (function() {

  function parseXY(text) {
    var result = {
      meta: {
        title: '',
        horizontal: false,
        xAxisLabel: '', xAxisCategories: [], xAxisMin: null, xAxisMax: null,
        yAxisLabel: '', yAxisMin: 0, yAxisMax: 100,
      },
      elements: [], relations: [],
    };
    if (!text || !text.trim()) return result;
    var lines = text.split('\n');
    var seriesCounter = 0;

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      var hh = trimmed.match(/^xychart-beta(\s+horizontal)?$/);
      if (hh) { if (hh[1]) result.meta.horizontal = true; continue; }

      var tm;
      if ((tm = trimmed.match(/^title\s+"([^"]*)"\s*$/))) { result.meta.title = tm[1]; continue; }
      if ((tm = trimmed.match(/^title\s+(.+)$/))) { result.meta.title = tm[1].trim(); continue; }

      // x-axis [list] or x-axis "label" min --> max or x-axis label [list]
      var xm;
      if ((xm = trimmed.match(/^x-axis\s+(?:"([^"]*)"\s+)?(-?[0-9.]+)\s+-->\s+(-?[0-9.]+)\s*$/))) {
        if (xm[1]) result.meta.xAxisLabel = xm[1];
        result.meta.xAxisMin = parseFloat(xm[2]);
        result.meta.xAxisMax = parseFloat(xm[3]);
        continue;
      }
      if ((xm = trimmed.match(/^x-axis\s+(?:"([^"]*)"\s+)?\[(.+)\]\s*$/))) {
        if (xm[1]) result.meta.xAxisLabel = xm[1];
        result.meta.xAxisCategories = xm[2].split(',').map(function(s) { return s.trim().replace(/^"(.*)"$/, '$1'); });
        continue;
      }

      // y-axis [same patterns]
      var ym;
      if ((ym = trimmed.match(/^y-axis\s+(?:"([^"]*)"\s+)?(-?[0-9.]+)\s+-->\s+(-?[0-9.]+)\s*$/))) {
        if (ym[1]) result.meta.yAxisLabel = ym[1];
        result.meta.yAxisMin = parseFloat(ym[2]);
        result.meta.yAxisMax = parseFloat(ym[3]);
        continue;
      }

      // bar [values] or line [values]
      var bm = trimmed.match(/^(bar|line)\s+\[(.+)\]\s*$/);
      if (bm) {
        var values = bm[2].split(',').map(function(s) { return parseFloat(s.trim()); }).filter(function(v) { return !isNaN(v); });
        result.elements.push({
          kind: bm[1],
          id: '__' + bm[1] + '_' + (seriesCounter++),
          values: values, line: lineNum,
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
    // Insert after header
    for (var j = 0; j < lines.length; j++) {
      if (/^xychart-beta/.test(lines[j].trim())) {
        lines.splice(j + 1, 0, '    ' + newLine);
        return lines.join('\n');
      }
    }
    return text;
  }

  function setTitle(text, v) { return replaceOrInsertLine(text, /^title\s+/, 'title "' + v + '"'); }
  function setHorizontal(text, horizontal) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (/^xychart-beta/.test(t)) {
        var indent = lines[i].match(/^(\s*)/)[1];
        lines[i] = indent + 'xychart-beta' + (horizontal ? ' horizontal' : '');
        return lines.join('\n');
      }
    }
    return text;
  }
  function setXAxisCategories(text, label, categories) {
    var cats = categories.split(',').map(function(s) { return s.trim(); }).filter(Boolean).join(', ');
    var line = 'x-axis ' + (label ? '"' + label + '" ' : '') + '[' + cats + ']';
    return replaceOrInsertLine(text, /^x-axis\s+/, line);
  }
  function setXAxisRange(text, label, min, max) {
    var line = 'x-axis ' + (label ? '"' + label + '" ' : '') + min + ' --> ' + max;
    return replaceOrInsertLine(text, /^x-axis\s+/, line);
  }
  function setYAxis(text, label, min, max) {
    var line = 'y-axis ' + (label ? '"' + label + '" ' : '') + min + ' --> ' + max;
    return replaceOrInsertLine(text, /^y-axis\s+/, line);
  }

  function addSeries(text, kind, values) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    var valStr = Array.isArray(values) ? values.join(', ') : values;
    lines.splice(insertAt, 0, '    ' + kind + ' [' + valStr + ']');
    return lines.join('\n');
  }
  function deleteSeries(text, lineNum) { return window.MA.textUpdater.deleteLine(text, lineNum); }
  function updateSeries(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = lines[idx].trim().match(/^(bar|line)\s+\[(.+)\]\s*$/);
    if (!m) return text;
    var kind = m[1], vals = m[2];
    if (field === 'kind') kind = value;
    else if (field === 'values') vals = Array.isArray(value) ? value.join(', ') : value;
    lines[idx] = indent + kind + ' [' + vals + ']';
    return lines.join('\n');
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var series = parsedData.elements.filter(function(e) { return e.kind === 'bar' || e.kind === 'line'; });
    var m = parsedData.meta;

    if (!selData || selData.length === 0) {
      var seriesList = '';
      for (var i = 0; i < series.length; i++) {
        var s = series[i];
        seriesList += P.listItemHtml({
          label: s.kind + ' [' + s.values.join(', ') + ']',
          sublabel: '(' + s.values.length + ' values)',
          selectClass: 'xy-select-series', deleteClass: 'xy-delete-series',
          dataElementId: s.id, dataLine: s.line, mono: true,
        });
      }
      if (!seriesList) seriesList = P.emptyListHtml('（シリーズなし）');

      var kindOpts = [{ value: 'bar', label: 'bar', selected: true }, { value: 'line', label: 'line' }];

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">XY Chart</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">設定</label>' +
          P.fieldHtml('Title', 'xy-title', m.title) +
          P.primaryButtonHtml('xy-set-title', 'Title 適用') +
          '<div style="height:6px;"></div>' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-primary);margin-bottom:6px;">' +
            '<input type="checkbox" id="xy-horizontal"' + (m.horizontal ? ' checked' : '') + '>' +
            'horizontal 表示' +
          '</label>' +
          '<div style="height:6px;"></div>' +
          P.fieldHtml('X軸ラベル', 'xy-xlabel', m.xAxisLabel) +
          P.fieldHtml('X軸カテゴリ (カンマ区切り)', 'xy-xcats', (m.xAxisCategories || []).join(', '), '例: jan, feb, mar') +
          P.primaryButtonHtml('xy-set-xcats', 'X軸カテゴリ 適用') +
          '<div style="height:6px;"></div>' +
          P.fieldHtml('X軸 min', 'xy-xmin', m.xAxisMin !== null ? String(m.xAxisMin) : '') +
          P.fieldHtml('X軸 max', 'xy-xmax', m.xAxisMax !== null ? String(m.xAxisMax) : '') +
          P.primaryButtonHtml('xy-set-xrange', 'X軸範囲 適用') +
          '<div style="height:6px;"></div>' +
          P.fieldHtml('Y軸ラベル', 'xy-ylabel', m.yAxisLabel) +
          P.fieldHtml('Y軸 min', 'xy-ymin', String(m.yAxisMin)) +
          P.fieldHtml('Y軸 max', 'xy-ymax', String(m.yAxisMax)) +
          P.primaryButtonHtml('xy-set-yaxis', 'Y軸 適用') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">シリーズを追加</label>' +
          P.selectFieldHtml('種別', 'xy-add-kind', kindOpts) +
          P.fieldHtml('値 (カンマ区切り)', 'xy-add-values', '', '例: 10, 20, 30') +
          P.primaryButtonHtml('xy-add-btn', '+ シリーズ追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">シリーズ一覧</label>' +
          '<div>' + seriesList + '</div>' +
        '</div>';

      P.bindEvent('xy-set-title', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(setTitle(ctx.getMmdText(), document.getElementById('xy-title').value.trim()));
        ctx.onUpdate();
      });
      P.bindEvent('xy-horizontal', 'change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(setHorizontal(ctx.getMmdText(), this.checked));
        ctx.onUpdate();
      });
      P.bindEvent('xy-set-xcats', 'click', function() {
        var lbl = document.getElementById('xy-xlabel').value.trim();
        var cats = document.getElementById('xy-xcats').value.trim();
        if (!cats) { alert('カテゴリ必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(setXAxisCategories(ctx.getMmdText(), lbl, cats));
        ctx.onUpdate();
      });
      P.bindEvent('xy-set-xrange', 'click', function() {
        var lbl = document.getElementById('xy-xlabel').value.trim();
        var mn = document.getElementById('xy-xmin').value.trim();
        var mx = document.getElementById('xy-xmax').value.trim();
        if (!mn || !mx) { alert('min/max 必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(setXAxisRange(ctx.getMmdText(), lbl, mn, mx));
        ctx.onUpdate();
      });
      P.bindEvent('xy-set-yaxis', 'click', function() {
        var lbl = document.getElementById('xy-ylabel').value.trim();
        var mn = document.getElementById('xy-ymin').value.trim();
        var mx = document.getElementById('xy-ymax').value.trim();
        if (!mn || !mx) { alert('min/max 必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(setYAxis(ctx.getMmdText(), lbl, mn, mx));
        ctx.onUpdate();
      });
      P.bindEvent('xy-add-btn', 'click', function() {
        var kind = document.getElementById('xy-add-kind').value;
        var vals = document.getElementById('xy-add-values').value.trim();
        if (!vals) { alert('値必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addSeries(ctx.getMmdText(), kind, vals));
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'xy-select-series', 'series');
      P.bindDeleteButtons(propsEl, 'xy-delete-series', ctx, deleteSeries);
      return;
    }

    if (selData.length === 1 && selData[0].type === 'series') {
      var sel = null;
      for (var sj = 0; sj < series.length; sj++) if (series[sj].id === selData[0].id) { sel = series[sj]; break; }
      if (!sel) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">シリーズが見つかりません</p>'; return; }
      var kindOpts2 = [
        { value: 'bar', label: 'bar', selected: sel.kind === 'bar' },
        { value: 'line', label: 'line', selected: sel.kind === 'line' },
      ];
      propsEl.innerHTML =
        P.panelHeaderHtml(sel.kind + ' series') +
        P.selectFieldHtml('種別', 'xy-edit-kind', kindOpts2) +
        P.fieldHtml('値 (カンマ区切り)', 'xy-edit-values', sel.values.join(', ')) +
        P.dangerButtonHtml('xy-edit-delete', 'シリーズ削除');
      var ln = sel.line;
      document.getElementById('xy-edit-kind').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateSeries(ctx.getMmdText(), ln, 'kind', this.value));
        ctx.onUpdate();
      });
      document.getElementById('xy-edit-values').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateSeries(ctx.getMmdText(), ln, 'values', this.value));
        ctx.onUpdate();
      });
      P.bindEvent('xy-edit-delete', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(deleteSeries(ctx.getMmdText(), ln));
        window.MA.selection.clearSelection();
        ctx.onUpdate();
      });
      return;
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'xychart-beta',
    displayName: 'XY Chart',
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'xychart-beta'; },
    parse: parseXY,
    parseXY: parseXY,
    template: function() {
      return [
        'xychart-beta',
        '    title "Sales Revenue"',
        '    x-axis [jan, feb, mar, apr, may]',
        '    y-axis "Revenue" 4000 --> 11000',
        '    bar [5000, 6000, 7500, 8200, 9500]',
        '    line [5000, 6000, 7500, 8200, 9500]',
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
        if (kind === 'bar' || kind === 'line') return addSeries(text, kind, props.values);
        return text;
      },
      delete: function(text, lineNum) { return deleteSeries(text, lineNum); },
      update: function(text, lineNum, field, value) { return updateSeries(text, lineNum, field, value); },
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
    setTitle: setTitle, setHorizontal: setHorizontal,
    setXAxisCategories: setXAxisCategories, setXAxisRange: setXAxisRange, setYAxis: setYAxis,
    addSeries: addSeries, deleteSeries: deleteSeries, updateSeries: updateSeries,
  };
})();
