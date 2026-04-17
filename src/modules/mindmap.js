'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.mindmap = (function() {

  function parseMindmap(text) {
    var result = { meta: {}, elements: [], relations: [] };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var nodeCounter = 0;
    var stack = []; // { id, indent }
    var lastNodeIdx = -1;

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var raw = lines[i];
      if (!raw.trim() || raw.trim().indexOf('%%') === 0) continue;
      if (/^mindmap/.test(raw.trim())) continue;

      var leadingSpaces = raw.match(/^(\s*)/)[1].replace(/\t/g, '  ').length;
      var trimmed = raw.trim();

      // Icon line
      if (/^::icon\(/.test(trimmed)) {
        if (lastNodeIdx >= 0) {
          var iconMatch = trimmed.match(/^::icon\(([^)]+)\)/);
          if (iconMatch) result.elements[lastNodeIdx].icon = iconMatch[1];
        }
        continue;
      }

      // Class line
      if (/^:::/.test(trimmed)) {
        if (lastNodeIdx >= 0) {
          result.elements[lastNodeIdx].className = trimmed.substring(3).trim();
        }
        continue;
      }

      // Shape detection (order matters: longer delimiters first)
      var shape = 'default';
      var text = trimmed;
      var m;
      if ((m = trimmed.match(/^(?:\S+?)?\(\((.+?)\)\)$/))) {
        shape = 'circle'; text = m[1];
      } else if ((m = trimmed.match(/^(?:\S+?)?\)\)(.+?)\(\($/))) {
        shape = 'bang'; text = m[1];
      } else if ((m = trimmed.match(/^(?:\S+?)?\{\{(.+?)\}\}$/))) {
        shape = 'hexagon'; text = m[1];
      } else if ((m = trimmed.match(/^(?:\S+?)?\)(.+?)\($/))) {
        shape = 'cloud'; text = m[1];
      } else if ((m = trimmed.match(/^(?:\S+?)?\[(.+?)\]$/))) {
        shape = 'square'; text = m[1];
      } else if ((m = trimmed.match(/^(?:\S+?)?\((.+?)\)$/))) {
        shape = 'rounded'; text = m[1];
      }

      // Determine parent by indent
      while (stack.length > 0 && stack[stack.length - 1].indent >= leadingSpaces) {
        stack.pop();
      }
      var parentId = stack.length > 0 ? stack[stack.length - 1].id : null;

      var id = '__n' + (nodeCounter++);
      result.elements.push({
        kind: 'node', id: id, text: text, shape: shape,
        icon: '', className: '',
        parentId: parentId, indent: leadingSpaces, level: Math.floor(leadingSpaces / 2),
        line: lineNum,
      });
      lastNodeIdx = result.elements.length - 1;
      stack.push({ id: id, indent: leadingSpaces });
    }
    return result;
  }

  function shapeToText(shape, text) {
    if (shape === 'square') return '[' + text + ']';
    if (shape === 'rounded') return '(' + text + ')';
    if (shape === 'circle') return '((' + text + '))';
    if (shape === 'bang') return '))' + text + '((';
    if (shape === 'cloud') return ')' + text + '(';
    if (shape === 'hexagon') return '{{' + text + '}}';
    return text;
  }

  function addChild(text, parentLineNum, newText, newShape) {
    var lines = text.split('\n');
    var idx = parentLineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var parentIndent = lines[idx].match(/^(\s*)/)[1].length;
    var childIndent = parentIndent + 2;
    var childLine = ' '.repeat(childIndent) + shapeToText(newShape || 'default', newText);
    // Insert after all lines at > parentIndent (existing children go first — append at end of parent's children)
    var insertAt = idx + 1;
    while (insertAt < lines.length) {
      var ln = lines[insertAt];
      var lnTrim = ln.trim();
      if (!lnTrim) { insertAt++; continue; }
      var lnIndent = ln.match(/^(\s*)/)[1].length;
      if (lnIndent <= parentIndent) break;
      insertAt++;
    }
    lines.splice(insertAt, 0, childLine);
    return lines.join('\n');
  }

  function addSibling(text, siblingLineNum, newText, newShape) {
    var lines = text.split('\n');
    var idx = siblingLineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var sibIndent = lines[idx].match(/^(\s*)/)[1].length;
    var siblingLine = ' '.repeat(sibIndent) + shapeToText(newShape || 'default', newText);
    // Find end of sibling's subtree
    var insertAt = idx + 1;
    while (insertAt < lines.length) {
      var ln = lines[insertAt];
      var lnTrim = ln.trim();
      if (!lnTrim) { insertAt++; continue; }
      var lnIndent = ln.match(/^(\s*)/)[1].length;
      if (lnIndent <= sibIndent) break;
      insertAt++;
    }
    lines.splice(insertAt, 0, siblingLine);
    return lines.join('\n');
  }

  function indentNode(text, lineNum) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var curIndent = lines[idx].match(/^(\s*)/)[1].length;
    // Find subtree end
    var endIdx = idx + 1;
    while (endIdx < lines.length) {
      var ln = lines[endIdx];
      if (!ln.trim()) { endIdx++; continue; }
      if (ln.match(/^(\s*)/)[1].length <= curIndent) break;
      endIdx++;
    }
    for (var j = idx; j < endIdx; j++) {
      lines[j] = '  ' + lines[j];
    }
    return lines.join('\n');
  }

  function outdentNode(text, lineNum) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var curIndent = lines[idx].match(/^(\s*)/)[1].length;
    if (curIndent < 2) return text; // can't outdent further
    var endIdx = idx + 1;
    while (endIdx < lines.length) {
      var ln = lines[endIdx];
      if (!ln.trim()) { endIdx++; continue; }
      if (ln.match(/^(\s*)/)[1].length <= curIndent) break;
      endIdx++;
    }
    for (var j = idx; j < endIdx; j++) {
      lines[j] = lines[j].replace(/^ {2}/, '');
    }
    return lines.join('\n');
  }

  function updateNodeText(text, lineNum, newText, newShape) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    lines[idx] = indent + shapeToText(newShape || 'default', newText);
    return lines.join('\n');
  }

  function setIcon(text, lineNum, iconName) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1].length;
    var iconLine = ' '.repeat(indent + 2) + '::icon(' + iconName + ')';
    // Check if an icon line already exists immediately after
    var iconIdx = -1;
    for (var j = idx + 1; j < lines.length; j++) {
      var t = lines[j].trim();
      if (!t) continue;
      if (/^::icon\(/.test(t)) { iconIdx = j; break; }
      // Non-icon non-empty -> stop looking
      break;
    }
    if (iconName) {
      if (iconIdx >= 0) {
        lines[iconIdx] = iconLine;
      } else {
        lines.splice(idx + 1, 0, iconLine);
      }
    } else if (iconIdx >= 0) {
      lines.splice(iconIdx, 1);
    }
    return lines.join('\n');
  }

  function deleteNode(text, lineNum) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var curIndent = lines[idx].match(/^(\s*)/)[1].length;
    var endIdx = idx + 1;
    while (endIdx < lines.length) {
      var ln = lines[endIdx];
      if (!ln.trim()) { endIdx++; continue; }
      if (ln.match(/^(\s*)/)[1].length <= curIndent) break;
      endIdx++;
    }
    lines.splice(idx, endIdx - idx);
    return lines.join('\n');
  }

  // ── UI ──
  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var nodes = parsedData.elements.filter(function(e) { return e.kind === 'node'; });
    var shapes = ['default', 'square', 'rounded', 'circle', 'bang', 'cloud', 'hexagon'];

    if (!selData || selData.length === 0) {
      var parentOpts = [{ value: '', label: '（ルート新規）' }].concat(
        nodes.map(function(n) { return { value: String(n.line), label: ' '.repeat(n.level * 2) + n.text }; })
      );
      var shapeOpts = shapes.map(function(s) { return { value: s, label: s, selected: s === 'default' }; });

      var nodesList = '';
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        nodesList += P.listItemHtml({
          label: ' '.repeat(n.level * 2) + n.text + (n.shape !== 'default' ? ' [' + n.shape + ']' : '') + (n.icon ? ' (' + n.icon + ')' : ''),
          sublabel: 'L' + n.level,
          selectClass: 'mm-select-node', deleteClass: 'mm-delete-node',
          dataElementId: n.id, dataLine: n.line, mono: true,
        });
      }
      if (!nodesList) nodesList = P.emptyListHtml('（ノードなし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Mindmap</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">子ノードを追加</label>' +
          P.selectFieldHtml('親ノード', 'mm-add-parent', parentOpts) +
          P.fieldHtml('Text', 'mm-add-text', '', '例: New Idea') +
          P.selectFieldHtml('Shape', 'mm-add-shape', shapeOpts) +
          P.primaryButtonHtml('mm-add-btn', '+ 子ノード追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">ノード一覧 (インデントが階層)</label>' +
          '<div>' + nodesList + '</div>' +
        '</div>';

      P.bindEvent('mm-add-btn', 'click', function() {
        var pl = document.getElementById('mm-add-parent').value;
        var txt = document.getElementById('mm-add-text').value.trim();
        var shp = document.getElementById('mm-add-shape').value;
        if (!txt) { alert('Text は必須です'); return; }
        window.MA.history.pushHistory();
        if (pl) {
          ctx.setMmdText(addChild(ctx.getMmdText(), parseInt(pl, 10), txt, shp));
        } else {
          // No parent → create root at minimum indent
          var t = ctx.getMmdText();
          var lines = t.split('\n');
          var insertAt = lines.length;
          while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
          lines.splice(insertAt, 0, '  ' + shapeToText(shp, txt));
          ctx.setMmdText(lines.join('\n'));
        }
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'mm-select-node', 'node');
      P.bindDeleteButtons(propsEl, 'mm-delete-node', ctx, deleteNode);
      return;
    }

    if (selData.length === 1) {
      var sel = selData[0];
      if (sel.type === 'node') {
        var n = null;
        for (var nj = 0; nj < nodes.length; nj++) if (nodes[nj].id === sel.id) { n = nodes[nj]; break; }
        if (!n) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">ノードが見つかりません</p>'; return; }
        var shapeOpts2 = shapes.map(function(s) { return { value: s, label: s, selected: s === n.shape }; });

        propsEl.innerHTML =
          P.panelHeaderHtml(n.text) +
          '<div style="margin-bottom:8px;color:var(--text-secondary);font-size:11px;">Level: ' + n.level + (n.parentId ? ' (親: ' + escHtml(n.parentId) + ')' : ' (root)') + '</div>' +
          P.fieldHtml('Text', 'mm-edit-text', n.text) +
          P.selectFieldHtml('Shape', 'mm-edit-shape', shapeOpts2) +
          P.fieldHtml('Icon (空で削除)', 'mm-edit-icon', n.icon, '例: fa fa-book') +
          '<div style="display:flex;gap:4px;margin-bottom:8px;">' +
            '<button id="mm-edit-indent" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:4px;border-radius:3px;cursor:pointer;font-size:11px;">インデント +</button>' +
            '<button id="mm-edit-outdent" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:4px;border-radius:3px;cursor:pointer;font-size:11px;">インデント -</button>' +
          '</div>' +
          P.primaryButtonHtml('mm-edit-add-sibling', '+ 兄弟ノード追加') +
          P.dangerButtonHtml('mm-edit-delete', 'ノード削除');

        var nodeLine = n.line;
        document.getElementById('mm-edit-text').addEventListener('change', function() {
          var newText = this.value;
          var newShape = document.getElementById('mm-edit-shape').value;
          window.MA.history.pushHistory();
          ctx.setMmdText(updateNodeText(ctx.getMmdText(), nodeLine, newText, newShape));
          ctx.onUpdate();
        });
        document.getElementById('mm-edit-shape').addEventListener('change', function() {
          var newShape = this.value;
          var newText = document.getElementById('mm-edit-text').value;
          window.MA.history.pushHistory();
          ctx.setMmdText(updateNodeText(ctx.getMmdText(), nodeLine, newText, newShape));
          ctx.onUpdate();
        });
        document.getElementById('mm-edit-icon').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(setIcon(ctx.getMmdText(), nodeLine, this.value.trim()));
          ctx.onUpdate();
        });
        P.bindEvent('mm-edit-indent', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(indentNode(ctx.getMmdText(), nodeLine));
          ctx.onUpdate();
        });
        P.bindEvent('mm-edit-outdent', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(outdentNode(ctx.getMmdText(), nodeLine));
          ctx.onUpdate();
        });
        P.bindEvent('mm-edit-add-sibling', 'click', function() {
          var sibText = prompt('兄弟ノードのテキスト:', '');
          if (!sibText) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(addSibling(ctx.getMmdText(), nodeLine, sibText, 'default'));
          ctx.onUpdate();
        });
        P.bindEvent('mm-edit-delete', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteNode(ctx.getMmdText(), nodeLine));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        });
        return;
      }
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'mindmap',
    displayName: 'Mindmap',
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'mindmap'; },
    parse: parseMindmap,
    parseMindmap: parseMindmap,
    template: function() {
      return [
        'mindmap',
        '  root((組み込み設計))',
        '    ハードウェア',
        '      MCU',
        '      Sensor',
        '    ソフトウェア',
        '      FreeRTOS',
        '    テスト',
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
        if (kind === 'child') return addChild(text, props.parentLine, props.text, props.shape);
        if (kind === 'sibling') return addSibling(text, props.siblingLine, props.text, props.shape);
        return text;
      },
      delete: function(text, lineNum) { return deleteNode(text, lineNum); },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        if (field === 'text' || field === 'shape') return updateNodeText(text, lineNum, opts.text || value, opts.shape || value);
        if (field === 'icon') return setIcon(text, lineNum, value);
        if (field === 'indent') return indentNode(text, lineNum);
        if (field === 'outdent') return outdentNode(text, lineNum);
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
      connect: function(text) { return text; },
    },
    addChild: addChild, addSibling: addSibling, indentNode: indentNode, outdentNode: outdentNode,
    updateNodeText: updateNodeText, setIcon: setIcon, deleteNode: deleteNode,
  };
})();
