'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.blockBeta = (function() {
  var COLUMNS_RE = /^columns\s+(\d+)\s*$/;
  var GROUP_START_RE = /^block:([A-Za-z_][A-Za-z0-9_-]*)\s*(?:columns\s+\d+)?\s*$/;
  var BLOCK_TOKEN_RE = /([A-Za-z_][A-Za-z0-9_-]*)(?:\["([^"]*)"\]|\(\("([^"]*)"\)\)|\("([^"]*)"\))?/g;
  var LINK_RE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*(?:--\s*"?([^"]*?)"?\s*)?-->\s*([A-Za-z_][A-Za-z0-9_-]*)\s*$/;

  function parseBlock(text) {
    var result = { meta: { columns: null }, elements: [], relations: [] };
    if (!text || !text.trim()) return result;
    var lines = text.split('\n');
    var relCounter = 0;
    var groupStack = [];
    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^block-beta/.test(trimmed)) continue;

      var cm = trimmed.match(COLUMNS_RE);
      if (cm) { result.meta.columns = parseInt(cm[1], 10); continue; }

      if (trimmed === 'end') { groupStack.pop(); continue; }

      var gm = trimmed.match(GROUP_START_RE);
      if (gm) {
        var parent = groupStack.length ? groupStack[groupStack.length - 1] : null;
        result.elements.push({ kind: 'group', id: gm[1], label: gm[1], parentId: parent, line: lineNum });
        groupStack.push(gm[1]);
        continue;
      }

      var lm = trimmed.match(LINK_RE);
      if (lm) {
        result.relations.push({
          id: '__rel_' + (relCounter++),
          from: lm[1], to: lm[3], label: (lm[2] || '').trim(), line: lineNum,
        });
        continue;
      }

      // Block tokens on a line (one or multiple)
      var parent2 = groupStack.length ? groupStack[groupStack.length - 1] : null;
      var m;
      BLOCK_TOKEN_RE.lastIndex = 0;
      while ((m = BLOCK_TOKEN_RE.exec(trimmed)) !== null) {
        var id = m[1];
        var label = m[2] || m[3] || m[4] || id;
        // Skip tokens that are actually link keywords (shouldn't happen here but guard)
        if (id === 'block' || id === 'end' || id === 'columns') continue;
        result.elements.push({ kind: 'block', id: id, label: label, parentId: parent2, line: lineNum });
      }
    }
    return result;
  }

  return {
    type: 'block-beta',
    displayName: 'Block',
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'block-beta'; },
    parse: parseBlock,
    parseBlock: parseBlock,
    template: function() {
      return [
        'block-beta',
        '  columns 3',
        '  a["Sensor"] b["MCU"] c["Actuator"]',
        '  a --> b',
        '  b --> c',
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
    renderProps: function(selData, parsedData, propsEl, ctx) {
      if (propsEl) propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">Block (実装中)</p>';
    },
    operations: { add: function(t) { return t; }, delete: function(t) { return t; }, update: function(t) { return t; }, moveUp: function(t) { return t; }, moveDown: function(t) { return t; }, connect: function(t) { return t; } },
  };
})();
