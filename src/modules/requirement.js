'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.requirementDiagram = (function() {
  var REQ_TYPES = ['requirement', 'functionalRequirement', 'interfaceRequirement', 'performanceRequirement', 'physicalRequirement', 'designConstraint'];
  var RISKS = ['low', 'medium', 'high'];
  var VERIFY_METHODS = ['analysis', 'inspection', 'test', 'demonstration'];
  var RELTYPES = ['contains', 'copies', 'derives', 'satisfies', 'verifies', 'refines', 'traces'];

  var REQ_BLOCK_RE = new RegExp('^(' + REQ_TYPES.join('|') + ')\\s+([A-Za-z_][A-Za-z0-9_-]*)\\s*\\{\\s*$');
  var ELEMENT_BLOCK_RE = /^element\s+([A-Za-z_][A-Za-z0-9_-]*)\s*\{\s*$/;
  var FIELD_RE = /^([A-Za-z]+)\s*:\s*(.+)$/;
  var REL_RE = new RegExp('^([A-Za-z_][A-Za-z0-9_-]*)\\s+-\\s+(' + RELTYPES.join('|') + ')\\s+->\\s+([A-Za-z_][A-Za-z0-9_-]*)\\s*$');

  function parseRequirement(text) {
    var result = { meta: {}, elements: [], relations: [] };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var relCounter = 0;
    var current = null;

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^requirementDiagram/.test(trimmed)) continue;

      if (trimmed === '}') { current = null; continue; }

      var rm = trimmed.match(REQ_BLOCK_RE);
      if (rm) {
        current = {
          kind: 'requirement', reqType: rm[1], name: rm[2],
          id: '', text: '', risk: '', verifymethod: '',
          line: lineNum,
        };
        result.elements.push(current);
        continue;
      }

      var em = trimmed.match(ELEMENT_BLOCK_RE);
      if (em) {
        current = {
          kind: 'element', name: em[1],
          type: '', docref: '',
          line: lineNum,
        };
        result.elements.push(current);
        continue;
      }

      if (current) {
        var fm = trimmed.match(FIELD_RE);
        if (fm) {
          var key = fm[1].toLowerCase();
          var val = fm[2].trim();
          if (current.kind === 'requirement') {
            if (key === 'id') current.id = val;
            else if (key === 'text') current.text = val;
            else if (key === 'risk') current.risk = val.toLowerCase();
            else if (key === 'verifymethod') current.verifymethod = val.toLowerCase();
          } else if (current.kind === 'element') {
            if (key === 'type') current.type = val;
            else if (key === 'docref') current.docref = val;
          }
          continue;
        }
      }

      var lm = trimmed.match(REL_RE);
      if (lm) {
        result.relations.push({
          id: '__rel_' + (relCounter++),
          from: lm[1], reltype: lm[2], to: lm[3],
          line: lineNum,
        });
      }
    }

    return result;
  }

  function addRequirement(text, reqType, name) {
    var block = [
      reqType + ' ' + name + ' {',
      '    id: ',
      '    text: ',
      '    risk: medium',
      '    verifymethod: analysis',
      '}',
    ];
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice.apply(lines, [insertAt, 0].concat(block));
    return lines.join('\n');
  }

  function addElement(text, name) {
    var block = [
      'element ' + name + ' {',
      '    type: ',
      '    docref: ',
      '}',
    ];
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice.apply(lines, [insertAt, 0].concat(block));
    return lines.join('\n');
  }

  function addRelation(text, from, reltype, to) {
    var newLine = from + ' - ' + reltype + ' -> ' + to;
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function deleteElement(text, lineNum, elementName) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    if (/\{\s*$/.test(trimmed)) {
      var endIdx = idx;
      for (var j = idx + 1; j < lines.length; j++) {
        if (lines[j].trim() === '}') { endIdx = j; break; }
      }
      lines.splice(idx, (endIdx - idx + 1));
    } else {
      lines.splice(idx, 1);
    }
    if (elementName) {
      var relRe = new RegExp('^\\s*([A-Za-z_][A-Za-z0-9_-]*)\\s+-\\s+\\S+\\s+->\\s+([A-Za-z_][A-Za-z0-9_-]*)\\s*$');
      lines = lines.filter(function(ln) {
        var m = ln.match(relRe);
        if (!m) return true;
        return m[1] !== elementName && m[2] !== elementName;
      });
    }
    return lines.join('\n');
  }

  function deleteRelation(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  return {
    type: 'requirementDiagram',
    displayName: 'Requirement',
    REQ_TYPES: REQ_TYPES,
    RISKS: RISKS,
    VERIFY_METHODS: VERIFY_METHODS,
    RELTYPES: RELTYPES,
    detect: function(text) {
      return window.MA.parserUtils.detectDiagramType(text) === 'requirementDiagram';
    },
    parse: parseRequirement,
    parseRequirement: parseRequirement,
    addRequirement: addRequirement,
    addElement: addElement,
    addRelation: addRelation,
    deleteElement: deleteElement,
    deleteRelation: deleteRelation,
    template: function() {
      return [
        'requirementDiagram',
        '',
        'requirement sample_req {',
        '    id: REQ-001',
        '    text: サンプル要件',
        '    risk: medium',
        '    verifymethod: test',
        '}',
        '',
        'element sample_elem {',
        '    type: code module',
        '    docref: src/sample.c',
        '}',
        '',
        'sample_elem - satisfies -> sample_req',
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
      if (propsEl) propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">Requirement (実装中)</p>';
    },
    operations: { add: function(t) { return t; }, delete: function(t) { return t; }, update: function(t) { return t; }, moveUp: function(t) { return t; }, moveDown: function(t) { return t; }, connect: function(t) { return t; } },
  };
})();
