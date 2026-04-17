'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.quadrantChart = (function() {

  function parseQuadrant(text) {
    var result = {
      meta: {
        title: '',
        xAxisLeft: '', xAxisRight: '',
        yAxisBottom: '', yAxisTop: '',
        q1: '', q2: '', q3: '', q4: '',
      },
      elements: [], relations: [],
    };
    if (!text || !text.trim()) return result;
    var lines = text.split('\n');
    var pointCounter = 0;
    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^quadrantChart/.test(trimmed)) continue;

      var tm;
      if ((tm = trimmed.match(/^title\s+(.+)$/))) { result.meta.title = tm[1].trim(); continue; }
      if ((tm = trimmed.match(/^x-axis\s+(.+?)\s+-->\s+(.+)$/))) { result.meta.xAxisLeft = tm[1].trim(); result.meta.xAxisRight = tm[2].trim(); continue; }
      if ((tm = trimmed.match(/^y-axis\s+(.+?)\s+-->\s+(.+)$/))) { result.meta.yAxisBottom = tm[1].trim(); result.meta.yAxisTop = tm[2].trim(); continue; }
      if ((tm = trimmed.match(/^quadrant-([1-4])\s+(.+)$/))) { result.meta['q' + tm[1]] = tm[2].trim(); continue; }
      if ((tm = trimmed.match(/^(.+?):\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]\s*$/))) {
        result.elements.push({
          kind: 'point', id: '__p_' + (pointCounter++),
          label: tm[1].trim(), x: parseFloat(tm[2]), y: parseFloat(tm[3]),
          line: lineNum,
        });
      }
    }
    return result;
  }

  function replaceOrInsertLine(text, regex, newLine, fallbackAfterHeader) {
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
    if (fallbackAfterHeader) {
      for (var j = 0; j < lines.length; j++) {
        if (/^quadrantChart/.test(lines[j].trim())) {
          lines.splice(j + 1, 0, '    ' + newLine);
          return lines.join('\n');
        }
      }
    }
    return text;
  }

  function setTitle(text, v) { return replaceOrInsertLine(text, /^title\s+/, 'title ' + v, true); }
  function setXAxis(text, left, right) { return replaceOrInsertLine(text, /^x-axis\s+/, 'x-axis ' + left + ' --> ' + right, true); }
  function setYAxis(text, bottom, top) { return replaceOrInsertLine(text, /^y-axis\s+/, 'y-axis ' + bottom + ' --> ' + top, true); }
  function setQuadrantLabel(text, num, label) { return replaceOrInsertLine(text, new RegExp('^quadrant-' + num + '\\s+'), 'quadrant-' + num + ' ' + label, true); }

  function addPoint(text, label, x, y) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, '    ' + label + ': [' + x + ', ' + y + ']');
    return lines.join('\n');
  }

  function deletePoint(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updatePoint(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = lines[idx].trim().match(/^(.+?):\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]\s*$/);
    if (!m) return text;
    var label = m[1].trim(), x = m[2], y = m[3];
    if (field === 'label') label = value;
    else if (field === 'x') x = value;
    else if (field === 'y') y = value;
    lines[idx] = indent + label + ': [' + x + ', ' + y + ']';
    return lines.join('\n');
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var points = parsedData.elements.filter(function(e) { return e.kind === 'point'; });
    var m = parsedData.meta;

    if (!selData || selData.length === 0) {
      var pointsList = '';
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        pointsList += P.listItemHtml({
          label: p.label + ': [' + p.x + ', ' + p.y + ']',
          selectClass: 'qd-select-point', deleteClass: 'qd-delete-point',
          dataElementId: p.id, dataLine: p.line, mono: true,
        });
      }
      if (!pointsList) pointsList = P.emptyListHtml('（ポイントなし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Quadrant Chart</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">軸・ラベル設定</label>' +
          P.fieldHtml('Title', 'qd-title', m.title) +
          P.primaryButtonHtml('qd-set-title', 'Title 適用') +
          '<div style="height:6px;"></div>' +
          P.fieldHtml('X軸 左', 'qd-xleft', m.xAxisLeft) +
          P.fieldHtml('X軸 右', 'qd-xright', m.xAxisRight) +
          P.primaryButtonHtml('qd-set-xaxis', 'X軸 適用') +
          '<div style="height:6px;"></div>' +
          P.fieldHtml('Y軸 下', 'qd-ybottom', m.yAxisBottom) +
          P.fieldHtml('Y軸 上', 'qd-ytop', m.yAxisTop) +
          P.primaryButtonHtml('qd-set-yaxis', 'Y軸 適用') +
          '<div style="height:6px;"></div>' +
          P.fieldHtml('Q1 (右上)', 'qd-q1', m.q1) +
          P.fieldHtml('Q2 (左上)', 'qd-q2', m.q2) +
          P.fieldHtml('Q3 (左下)', 'qd-q3', m.q3) +
          P.fieldHtml('Q4 (右下)', 'qd-q4', m.q4) +
          P.primaryButtonHtml('qd-set-quads', '象限ラベル 適用') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">ポイントを追加</label>' +
          P.fieldHtml('Label', 'qd-add-label', '', '例: Campaign A') +
          P.fieldHtml('X (0-1)', 'qd-add-x', '0.5') +
          P.fieldHtml('Y (0-1)', 'qd-add-y', '0.5') +
          P.primaryButtonHtml('qd-add-btn', '+ ポイント追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">ポイント一覧</label>' +
          '<div>' + pointsList + '</div>' +
        '</div>';

      P.bindEvent('qd-set-title', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(setTitle(ctx.getMmdText(), document.getElementById('qd-title').value.trim()));
        ctx.onUpdate();
      });
      P.bindEvent('qd-set-xaxis', 'click', function() {
        var l = document.getElementById('qd-xleft').value.trim();
        var r = document.getElementById('qd-xright').value.trim();
        if (!l || !r) { alert('左右ラベル必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(setXAxis(ctx.getMmdText(), l, r));
        ctx.onUpdate();
      });
      P.bindEvent('qd-set-yaxis', 'click', function() {
        var b = document.getElementById('qd-ybottom').value.trim();
        var t = document.getElementById('qd-ytop').value.trim();
        if (!b || !t) { alert('上下ラベル必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(setYAxis(ctx.getMmdText(), b, t));
        ctx.onUpdate();
      });
      P.bindEvent('qd-set-quads', 'click', function() {
        window.MA.history.pushHistory();
        var t = ctx.getMmdText();
        ['1','2','3','4'].forEach(function(n) {
          var v = document.getElementById('qd-q' + n).value.trim();
          if (v) t = setQuadrantLabel(t, n, v);
        });
        ctx.setMmdText(t);
        ctx.onUpdate();
      });
      P.bindEvent('qd-add-btn', 'click', function() {
        var label = document.getElementById('qd-add-label').value.trim();
        var x = document.getElementById('qd-add-x').value.trim();
        var y = document.getElementById('qd-add-y').value.trim();
        if (!label || !x || !y) { alert('全項目必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addPoint(ctx.getMmdText(), label, x, y));
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'qd-select-point', 'point');
      P.bindDeleteButtons(propsEl, 'qd-delete-point', ctx, deletePoint);
      return;
    }

    if (selData.length === 1 && selData[0].type === 'point') {
      var pt = null;
      for (var pj = 0; pj < points.length; pj++) if (points[pj].id === selData[0].id) { pt = points[pj]; break; }
      if (!pt) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">ポイントが見つかりません</p>'; return; }
      propsEl.innerHTML =
        P.panelHeaderHtml(pt.label) +
        P.fieldHtml('Label', 'qd-edit-label', pt.label) +
        P.fieldHtml('X (0-1)', 'qd-edit-x', String(pt.x)) +
        P.fieldHtml('Y (0-1)', 'qd-edit-y', String(pt.y)) +
        P.dangerButtonHtml('qd-edit-delete', 'ポイント削除');
      var ln = pt.line;
      document.getElementById('qd-edit-label').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updatePoint(ctx.getMmdText(), ln, 'label', this.value));
        ctx.onUpdate();
      });
      document.getElementById('qd-edit-x').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updatePoint(ctx.getMmdText(), ln, 'x', this.value));
        ctx.onUpdate();
      });
      document.getElementById('qd-edit-y').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updatePoint(ctx.getMmdText(), ln, 'y', this.value));
        ctx.onUpdate();
      });
      P.bindEvent('qd-edit-delete', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(deletePoint(ctx.getMmdText(), ln));
        window.MA.selection.clearSelection();
        ctx.onUpdate();
      });
      return;
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'quadrantChart',
    displayName: 'Quadrant',
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'quadrantChart'; },
    parse: parseQuadrant,
    parseQuadrant: parseQuadrant,
    template: function() {
      return [
        'quadrantChart',
        '    title 施策のリーチ vs エンゲージメント',
        '    x-axis Low Reach --> High Reach',
        '    y-axis Low Engagement --> High Engagement',
        '    quadrant-1 拡大すべき',
        '    quadrant-2 改善の余地',
        '    quadrant-3 再評価',
        '    quadrant-4 促進が必要',
        '    施策A: [0.3, 0.6]',
        '    施策B: [0.45, 0.23]',
        '    施策C: [0.57, 0.69]',
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
        if (kind === 'point') return addPoint(text, props.label, props.x, props.y);
        return text;
      },
      delete: function(text, lineNum) { return deletePoint(text, lineNum); },
      update: function(text, lineNum, field, value) { return updatePoint(text, lineNum, field, value); },
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
    setTitle: setTitle, setXAxis: setXAxis, setYAxis: setYAxis, setQuadrantLabel: setQuadrantLabel,
    addPoint: addPoint, deletePoint: deletePoint, updatePoint: updatePoint,
  };
})();
