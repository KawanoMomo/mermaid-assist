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

  function addBlock(text, id, label) {
    var token = label && label !== id ? id + '["' + label + '"]' : id;
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, '  ' + token);
    return lines.join('\n');
  }

  function addNestedBlock(text, parentId, id, label) {
    var token = label && label !== id ? id + '["' + label + '"]' : id;
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (t === 'block:' + parentId || t.indexOf('block:' + parentId) === 0) {
        // Find matching end
        for (var j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === 'end') {
            lines.splice(j, 0, '    ' + token);
            return lines.join('\n');
          }
        }
      }
    }
    return text;
  }

  function addLink(text, from, to, label) {
    var line = label ? '  ' + from + ' -- "' + label + '" --> ' + to : '  ' + from + ' --> ' + to;
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, line);
    return lines.join('\n');
  }

  function deleteBlock(text, lineNum, blockId) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();

    // Group block:ID ... end
    if (trimmed === 'block:' + blockId || trimmed.indexOf('block:' + blockId) === 0) {
      var endIdx = idx;
      for (var j = idx + 1; j < lines.length; j++) {
        if (lines[j].trim() === 'end') { endIdx = j; break; }
      }
      lines.splice(idx, endIdx - idx + 1);
    } else {
      // Remove just this block token from the line, or whole line if only this token
      var tokens = trimmed.split(/\s+/);
      var kept = tokens.filter(function(tok) {
        var idMatch = tok.match(/^([A-Za-z_][A-Za-z0-9_-]*)/);
        return !idMatch || idMatch[1] !== blockId;
      });
      if (kept.length === 0) {
        lines.splice(idx, 1);
      } else {
        var indent = lines[idx].match(/^(\s*)/)[1];
        lines[idx] = indent + kept.join(' ');
      }
    }
    // Cascade: remove links referencing this blockId
    var linkRe = /^(\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*(?:--\s*"?[^"]*?"?\s*)?-->\s*([A-Za-z_][A-Za-z0-9_-]*)\s*$/;
    lines = lines.filter(function(ln) {
      var m = ln.match(linkRe);
      if (!m) return true;
      return m[2] !== blockId && m[3] !== blockId;
    });
    return lines.join('\n');
  }

  function deleteLink(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updateBlockLabel(text, lineNum, blockId, newLabel) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var line = lines[idx];
    // Replace the specific block token (id or id["label"]) for matching blockId
    var tokenRe = new RegExp('(\\b' + blockId + ')(?:\\["[^"]*"\\])?', 'g');
    lines[idx] = line.replace(tokenRe, blockId + (newLabel ? '["' + newLabel + '"]' : ''));
    return lines.join('\n');
  }

  function updateLink(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = lines[idx].trim().match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*(?:--\s*"?([^"]*?)"?\s*)?-->\s*([A-Za-z_][A-Za-z0-9_-]*)\s*$/);
    if (!m) return text;
    var from = m[1], label = m[2] || '', to = m[3];
    if (field === 'from') from = value;
    else if (field === 'to') to = value;
    else if (field === 'label') label = value;
    lines[idx] = indent + (label ? from + ' -- "' + label + '" --> ' + to : from + ' --> ' + to);
    return lines.join('\n');
  }

  function setColumns(text, n) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (/^\s*columns\s+\d+\s*$/.test(lines[i])) {
        lines[i] = '  columns ' + n;
        return lines.join('\n');
      }
    }
    // Insert right after block-beta header
    for (var i2 = 0; i2 < lines.length; i2++) {
      if (/^block-beta/.test(lines[i2].trim())) {
        lines.splice(i2 + 1, 0, '  columns ' + n);
        return lines.join('\n');
      }
    }
    // Fallback: prepend
    lines.unshift('  columns ' + n);
    return lines.join('\n');
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
    operations: {
      add: function(text, kind, props) {
        if (kind === 'block') return addBlock(text, props.id, props.label);
        if (kind === 'nested') return addNestedBlock(text, props.parentId, props.id, props.label);
        if (kind === 'link') return addLink(text, props.from, props.to, props.label);
        return text;
      },
      delete: function(text, lineNum, opts) {
        opts = opts || {};
        if (opts.kind === 'link') return deleteLink(text, lineNum);
        return deleteBlock(text, lineNum, opts.blockId);
      },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        if (opts.kind === 'link') return updateLink(text, lineNum, field, value);
        if (field === 'columns') return setColumns(text, value);
        if (field === 'label') return updateBlockLabel(text, lineNum, opts.blockId, value);
        return text;
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
      connect: function(text, fromId, toId, props) {
        props = props || {};
        return addLink(text, fromId, toId, props.label || '');
      },
    },
    addBlock: addBlock, addNestedBlock: addNestedBlock, addLink: addLink,
    deleteBlock: deleteBlock, deleteLink: deleteLink,
    updateBlockLabel: updateBlockLabel, updateLink: updateLink, setColumns: setColumns,
  };
})();
