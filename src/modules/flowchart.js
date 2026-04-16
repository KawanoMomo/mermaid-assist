'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.flowchart = (function() {
  // Edge type patterns (longest first for greedy matching)
  var EDGE_TYPES = ['==>', '-.->', '-.-', '===', '-->', '---', '--x', '--o'];

  // Shape detection for node text
  // Returns { shape, label } or null if invalid
  function parseNodeShape(raw) {
    raw = raw.trim();
    // Order matters: longer patterns first
    if (/^\(\((.*)\)\)$/.test(raw)) return { shape: 'circle', label: RegExp.$1 };
    if (/^\[\[(.*)\]\]$/.test(raw)) return { shape: 'subroutine', label: RegExp.$1 };
    if (/^\[\((.*)\)\]$/.test(raw)) return { shape: 'cylinder', label: RegExp.$1 };
    if (/^\[\/(.*)\/\]$/.test(raw)) return { shape: 'parallelogram', label: RegExp.$1 };
    if (/^\[\\(.*)\\\]$/.test(raw)) return { shape: 'parallelogram_alt', label: RegExp.$1 };
    if (/^\{\{(.*)\}\}$/.test(raw)) return { shape: 'hexagon', label: RegExp.$1 };
    if (/^\[(.*)\]$/.test(raw)) return { shape: 'rect', label: RegExp.$1 };
    if (/^\((.*)\)$/.test(raw)) return { shape: 'round', label: RegExp.$1 };
    if (/^\{(.*)\}$/.test(raw)) return { shape: 'diamond', label: RegExp.$1 };
    if (/^>(.*)\]$/.test(raw)) return { shape: 'asymmetric', label: RegExp.$1 };
    return null;
  }

  function buildShape(shape, label) {
    label = label || '';
    var map = {
      rect: ['[', ']'], round: ['(', ')'], diamond: ['{', '}'],
      circle: ['((', '))'], parallelogram: ['[/', '/]'],
      parallelogram_alt: ['[\\', '\\]'], asymmetric: ['>', ']'],
      hexagon: ['{{', '}}'], subroutine: ['[[', ']]'], cylinder: ['[(', ')]'],
    };
    var wrap = map[shape] || map.rect;
    return wrap[0] + label + wrap[1];
  }

  function parseFlowchart(text) {
    var result = {
      meta: { direction: 'TD' },
      elements: [],   // nodes
      relations: [],  // edges
      groups: [],     // subgraphs + classDef
    };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var edgeCounter = 0;
    var grpCounter = 0;
    var subgraphStack = [];
    var nodeMap = {}; // id -> {line, label, shape} to avoid duplicates
    var seenClassDefs = {};

    // Parse first non-empty non-comment line for direction
    for (var hi = 0; hi < lines.length; hi++) {
      var ht = lines[hi].trim();
      if (!ht || ht.indexOf('%%') === 0) continue;
      var hm = ht.match(/^(flowchart|graph)\s+(\S+)/);
      if (hm) {
        result.meta.direction = hm[2];
      }
      break;
    }

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^(flowchart|graph)\s+/.test(trimmed)) continue;

      // classDef
      var classDefMatch = trimmed.match(/^classDef\s+(\S+)\s+(.+)$/);
      if (classDefMatch) {
        if (!seenClassDefs[classDefMatch[1]]) {
          result.groups.push({
            kind: 'classDef',
            id: classDefMatch[1],
            line: lineNum,
            label: classDefMatch[1],
            style: classDefMatch[2],
          });
          seenClassDefs[classDefMatch[1]] = true;
        }
        continue;
      }

      // class A,B className
      if (/^class\s+/.test(trimmed)) {
        // Record as-is in groups
        result.groups.push({
          kind: 'class',
          id: '__cls_' + grpCounter++,
          line: lineNum,
          label: trimmed.slice(6).trim(),
        });
        continue;
      }

      // subgraph start
      var sgMatch = trimmed.match(/^subgraph\s+(\S+)(?:\s*\[(.+)\])?/);
      if (sgMatch) {
        var gid = sgMatch[1];
        var glabel = sgMatch[2] || sgMatch[1];
        var grp = {
          kind: 'subgraph',
          id: gid,
          line: lineNum,
          endLine: -1,
          label: glabel,
          parentId: subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : null,
        };
        result.groups.push(grp);
        subgraphStack.push(gid);
        continue;
      }

      // direction inside subgraph
      if (/^direction\s+\S+$/.test(trimmed)) continue;

      // end
      if (trimmed === 'end') {
        if (subgraphStack.length > 0) {
          var closingId = subgraphStack.pop();
          for (var gi = result.groups.length - 1; gi >= 0; gi--) {
            if (result.groups[gi].id === closingId && result.groups[gi].kind === 'subgraph') {
              result.groups[gi].endLine = lineNum; break;
            }
          }
        }
        continue;
      }

      // Edge detection: scan for edge patterns with optional |label|
      // Pattern: SRC[shape] EDGE |label| TGT[shape]
      // We detect edge type by scanning for the longest pattern
      var edgeType = null, edgePos = -1, edgeLen = 0;
      for (var ei = 0; ei < EDGE_TYPES.length; ei++) {
        var et = EDGE_TYPES[ei];
        var pos = trimmed.indexOf(et);
        if (pos > 0 && (edgePos === -1 || pos < edgePos || et.length > edgeLen)) {
          edgeType = et; edgePos = pos; edgeLen = et.length;
        }
      }

      if (edgeType && edgePos > 0) {
        var leftRaw = trimmed.slice(0, edgePos).trim();
        var rest = trimmed.slice(edgePos + edgeType.length);
        // Optional |label|
        var edgeLabel = '';
        var lblMatch = rest.match(/^\|([^|]*)\|\s*(.*)$/);
        if (lblMatch) {
          edgeLabel = lblMatch[1];
          rest = lblMatch[2];
        }
        var rightRaw = rest.trim();
        // Strip trailing semicolons
        if (rightRaw.endsWith(';')) rightRaw = rightRaw.slice(0, -1).trim();

        // Extract node IDs + shapes from left and right
        // A node reference can be just ID, or ID[shape]
        function extractNode(raw) {
          if (!raw) return null;
          // match: ID followed optionally by shape
          var shapeStartIdx = -1;
          var shapeChars = ['[', '(', '{', '>'];
          for (var si = 0; si < raw.length; si++) {
            if (shapeChars.indexOf(raw[si]) !== -1) { shapeStartIdx = si; break; }
          }
          var id, shapePart;
          if (shapeStartIdx === -1) {
            id = raw.trim();
            shapePart = null;
          } else {
            id = raw.slice(0, shapeStartIdx).trim();
            shapePart = raw.slice(shapeStartIdx);
          }
          if (!id) return null;
          var sh = shapePart ? parseNodeShape(shapePart) : null;
          return { id: id, shape: sh ? sh.shape : null, label: sh ? sh.label : null };
        }

        var leftNode = extractNode(leftRaw);
        var rightNode = extractNode(rightRaw);

        if (leftNode && !nodeMap[leftNode.id]) {
          var le = { kind: 'node', id: leftNode.id, label: leftNode.label || leftNode.id, shape: leftNode.shape || 'rect', line: lineNum };
          result.elements.push(le);
          nodeMap[leftNode.id] = le;
        } else if (leftNode && leftNode.shape && nodeMap[leftNode.id]) {
          // Update if this declaration has a shape
          nodeMap[leftNode.id].shape = leftNode.shape;
          nodeMap[leftNode.id].label = leftNode.label;
        }

        if (rightNode && !nodeMap[rightNode.id]) {
          var re = { kind: 'node', id: rightNode.id, label: rightNode.label || rightNode.id, shape: rightNode.shape || 'rect', line: lineNum };
          result.elements.push(re);
          nodeMap[rightNode.id] = re;
        } else if (rightNode && rightNode.shape && nodeMap[rightNode.id]) {
          nodeMap[rightNode.id].shape = rightNode.shape;
          nodeMap[rightNode.id].label = rightNode.label;
        }

        if (leftNode && rightNode) {
          result.relations.push({
            kind: 'edge',
            id: '__edge_' + (edgeCounter++),
            from: leftNode.id,
            to: rightNode.id,
            arrow: edgeType,
            label: edgeLabel,
            line: lineNum,
          });
        }
        continue;
      }

      // Standalone node declaration: e.g. "A[Start]" or "A"
      var soloMatch = trimmed.match(/^(\S+?)(\[.*\]|\(.*\)|\{.*\}|>.*\])?\s*;?\s*$/);
      if (soloMatch) {
        var nid = soloMatch[1];
        var shapePart = soloMatch[2];
        var sh = shapePart ? parseNodeShape(shapePart) : null;
        if (!nodeMap[nid]) {
          var ne = { kind: 'node', id: nid, label: sh ? sh.label : nid, shape: sh ? sh.shape : 'rect', line: lineNum };
          result.elements.push(ne);
          nodeMap[nid] = ne;
        } else if (sh) {
          nodeMap[nid].shape = sh.shape;
          nodeMap[nid].label = sh.label;
        }
      }
    }

    return result;
  }

  // ── Updaters ──

  function addNode(text, id, label, shape) {
    shape = shape || 'rect';
    var newLine = '    ' + id + buildShape(shape, label || id);
    // Insert before end of file (excluding trailing empty lines)
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function deleteNode(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updateNode(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();

    // Try to parse as standalone node or as part of edge
    // For simplicity: find a node declaration on this line and rewrite
    // This handles: "A[Start]" or "A[Start] --> B[End]"
    var indent = lines[idx].match(/^(\s*)/)[1];

    // Check if line has edge
    var edgeType = null, edgePos = -1;
    for (var ei = 0; ei < EDGE_TYPES.length; ei++) {
      var pos = trimmed.indexOf(EDGE_TYPES[ei]);
      if (pos > 0 && (edgePos === -1 || pos < edgePos)) { edgePos = pos; edgeType = EDGE_TYPES[ei]; }
    }

    if (!edgeType) {
      // Standalone node line
      var m = trimmed.match(/^(\S+?)(\[.*\]|\(.*\)|\{.*\}|>.*\])?\s*;?\s*$/);
      if (!m) return text;
      var nid = m[1];
      var sh = m[2] ? parseNodeShape(m[2]) : null;
      var label = sh ? sh.label : nid;
      var shape = sh ? sh.shape : 'rect';
      if (field === 'id') nid = value;
      else if (field === 'label') label = value;
      else if (field === 'shape') shape = value;
      lines[idx] = indent + nid + buildShape(shape, label);
      return lines.join('\n');
    }

    // Line has edge: only update label if field===label; otherwise no-op
    return text;
  }

  function addEdge(text, from, to, arrow, label) {
    arrow = arrow || '-->';
    var newLine = '    ' + from + ' ' + arrow + (label ? ' |' + label + '| ' : ' ') + to;
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function deleteEdge(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updateEdge(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    var indent = lines[idx].match(/^(\s*)/)[1];

    var edgeType = null, edgePos = -1;
    for (var ei = 0; ei < EDGE_TYPES.length; ei++) {
      var pos = trimmed.indexOf(EDGE_TYPES[ei]);
      if (pos > 0 && (edgePos === -1 || pos < edgePos)) { edgePos = pos; edgeType = EDGE_TYPES[ei]; }
    }
    if (!edgeType) return text;

    var leftRaw = trimmed.slice(0, edgePos).trim();
    var rest = trimmed.slice(edgePos + edgeType.length);
    var curLabel = '';
    var lblMatch = rest.match(/^\|([^|]*)\|\s*(.*)$/);
    if (lblMatch) { curLabel = lblMatch[1]; rest = lblMatch[2]; }
    var rightRaw = rest.trim();
    if (rightRaw.endsWith(';')) rightRaw = rightRaw.slice(0, -1).trim();

    if (field === 'from') leftRaw = value;
    else if (field === 'to') rightRaw = value;
    else if (field === 'arrow') edgeType = value;
    else if (field === 'label') curLabel = value;

    lines[idx] = indent + leftRaw + ' ' + edgeType + (curLabel ? ' |' + curLabel + '| ' : ' ') + rightRaw;
    return lines.join('\n');
  }

  function updateDirection(text, newDir) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t || t.indexOf('%%') === 0) continue;
      var m = t.match(/^(flowchart|graph)\s+(\S+)/);
      if (m) {
        var indent = lines[i].match(/^(\s*)/)[1];
        lines[i] = indent + m[1] + ' ' + newDir;
        return lines.join('\n');
      }
      // First non-empty line is the header; if no direction, just append
      if (t === 'flowchart' || t === 'graph') {
        var indent2 = lines[i].match(/^(\s*)/)[1];
        lines[i] = indent2 + t + ' ' + newDir;
        return lines.join('\n');
      }
      break;
    }
    return text;
  }

  function addSubgraph(text, id, label) {
    label = label || '';
    var block = [
      '    subgraph ' + id + (label ? ' [' + label + ']' : ''),
      '        ',
      '    end',
    ];
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice.apply(lines, [insertAt, 0].concat(block));
    return lines.join('\n');
  }

  function deleteSubgraph(text, startLine, endLine) {
    var lines = text.split('\n');
    lines.splice(startLine - 1, (endLine - startLine + 1));
    return lines.join('\n');
  }

  function addClassDef(text, name, style) {
    var newLine = '    classDef ' + name + ' ' + style;
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  // ── UI: buildOverlay ──
  function buildOverlay(svgEl, parsedData, overlayEl) {
    if (!overlayEl) return;
    while (overlayEl.firstChild) overlayEl.removeChild(overlayEl.firstChild);
    if (!svgEl || !parsedData) return;
    var viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) overlayEl.setAttribute('viewBox', viewBox);
    var svgW = svgEl.getAttribute('width');
    var svgH = svgEl.getAttribute('height');
    if (svgW) overlayEl.setAttribute('width', svgW);
    if (svgH) overlayEl.setAttribute('height', svgH);

    var NS = 'http://www.w3.org/2000/svg';
    // Find node elements in flowchart SVG: they have class containing 'node'
    var svgNodes = svgEl.querySelectorAll('.node');
    for (var ni = 0; ni < svgNodes.length; ni++) {
      var gNode = svgNodes[ni];
      // Mermaid node g element's id often contains the flowchart node id
      var svgId = gNode.id || gNode.getAttribute('id') || '';
      // Match by label text content
      var tEls = gNode.querySelectorAll('text, .nodeLabel, foreignObject');
      var nodeText = '';
      for (var ti = 0; ti < tEls.length; ti++) {
        var tt = tEls[ti].textContent.trim();
        if (tt) { nodeText = tt; break; }
      }

      // Find matching element in parsedData
      var matched = null;
      for (var pi = 0; pi < parsedData.elements.length; pi++) {
        if (parsedData.elements[pi].label === nodeText) { matched = parsedData.elements[pi]; break; }
      }
      if (!matched) continue;

      try {
        var bb = gNode.getBBox();
        var rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', bb.x - 2);
        rect.setAttribute('y', bb.y - 2);
        rect.setAttribute('width', bb.width + 4);
        rect.setAttribute('height', bb.height + 4);
        rect.setAttribute('fill', 'transparent');
        rect.setAttribute('stroke', window.MA.selection.isSelected(matched.id) ? '#7ee787' : 'none');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('stroke-dasharray', '4');
        rect.setAttribute('cursor', 'pointer');
        rect.setAttribute('class', 'overlay-node');
        rect.setAttribute('data-element-id', matched.id);
        rect.setAttribute('data-element-kind', 'node');
        rect.setAttribute('data-line', matched.line);
        overlayEl.appendChild(rect);
      } catch (e) { /* skip */ }
    }
  }

  // ── UI: renderProps ──
  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;

    function fieldHtml(label, id, value, placeholder) {
      return '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">' + escHtml(label) + '</label><input id="' + id + '" type="text" value="' + escHtml(value || '') + '" placeholder="' + escHtml(placeholder || '') + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;"></div>';
    }

    if (!selData || selData.length === 0) {
      var nodes = parsedData.elements.filter(function(e) { return e.kind === 'node'; });
      var edges = parsedData.relations.filter(function(r) { return r.kind === 'edge'; });
      var subgraphs = parsedData.groups.filter(function(g) { return g.kind === 'subgraph'; });

      var nodeOpts = '';
      for (var ni = 0; ni < nodes.length; ni++) nodeOpts += '<option value="' + escHtml(nodes[ni].id) + '">' + escHtml(nodes[ni].label) + '</option>';
      if (!nodeOpts) nodeOpts = '<option value="">（ノードを先に追加）</option>';

      var shapeOpts = '';
      var shapes = ['rect','round','diamond','circle','parallelogram','hexagon','subroutine','cylinder','asymmetric'];
      for (var si = 0; si < shapes.length; si++) shapeOpts += '<option value="' + shapes[si] + '">' + shapes[si] + '</option>';

      var arrows = ['-->','---','-.->','-.-','==>','===','--x','--o'];
      var arrowOpts = '';
      for (var ai = 0; ai < arrows.length; ai++) arrowOpts += '<option value="' + arrows[ai] + '">' + arrows[ai] + '</option>';

      var nodesList = '';
      for (var lni = 0; lni < nodes.length; lni++) {
        var n = nodes[lni];
        nodesList += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:3px 4px;background:var(--bg-tertiary);border-radius:3px;font-size:11px;">' +
          '<div style="flex:1;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(n.label) + ' <span style="color:var(--text-secondary);font-size:10px;">(' + escHtml(n.id) + ', ' + escHtml(n.shape) + ')</span></div>' +
          '<button class="fc-select-node" data-element-id="' + escHtml(n.id) + '" style="background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">編集</button>' +
          '<button class="fc-delete-node" data-line="' + n.line + '" style="background:var(--accent-red);color:#fff;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">✕</button>' +
        '</div>';
      }
      if (!nodesList) nodesList = '<div style="font-size:11px;color:var(--text-secondary);">（ノードなし）</div>';

      var edgesList = '';
      for (var lei = 0; lei < edges.length; lei++) {
        var ed = edges[lei];
        edgesList += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:3px 4px;background:var(--bg-tertiary);border-radius:3px;font-size:11px;">' +
          '<div style="flex:1;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);">' + escHtml(ed.from) + ' ' + escHtml(ed.arrow) + ' ' + escHtml(ed.to) + (ed.label ? ' |' + escHtml(ed.label) + '|' : '') + '</div>' +
          '<button class="fc-select-edge" data-element-id="' + escHtml(ed.id) + '" style="background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">編集</button>' +
          '<button class="fc-delete-edge" data-line="' + ed.line + '" style="background:var(--accent-red);color:#fff;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">✕</button>' +
        '</div>';
      }
      if (!edgesList) edgesList = '<div style="font-size:11px;color:var(--text-secondary);">（エッジなし）</div>';

      var subgraphsList = '';
      for (var sgi = 0; sgi < subgraphs.length; sgi++) {
        var sg = subgraphs[sgi];
        subgraphsList += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:3px 4px;background:var(--bg-tertiary);border-radius:3px;font-size:11px;">' +
          '<div style="flex:1;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(sg.label) + ' <span style="color:var(--text-secondary);font-size:10px;">(' + escHtml(sg.id) + ')</span></div>' +
          '<button class="fc-delete-subgraph" data-line="' + sg.line + '" data-end-line="' + sg.endLine + '" style="background:var(--accent-red);color:#fff;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">✕</button>' +
        '</div>';
      }
      if (!subgraphsList) subgraphsList = '<div style="font-size:11px;color:var(--text-secondary);">（なし）</div>';

      var dirs = ['TD','TB','BT','LR','RL'];
      var dirOpts = '';
      for (var di = 0; di < dirs.length; di++) dirOpts += '<option value="' + dirs[di] + '"' + (dirs[di] === parsedData.meta.direction ? ' selected' : '') + '>' + dirs[di] + '</option>';

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Flowchart</div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">方向</label><select id="fc-direction" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + dirOpts + '</select></div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">ノードを追加</label>' +
          fieldHtml('ID', 'fc-add-node-id', '', 'A') +
          fieldHtml('ラベル', 'fc-add-node-label', '', 'Start') +
          '<div style="display:flex;gap:4px;margin-bottom:8px;">' +
            '<select id="fc-add-node-shape" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' + shapeOpts + '</select>' +
            '<button id="fc-add-node-btn" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+ 追加</button>' +
          '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">エッジを追加</label>' +
          '<div style="display:flex;gap:4px;margin-bottom:6px;">' +
            '<select id="fc-add-edge-from" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' + nodeOpts + '</select>' +
            '<select id="fc-add-edge-arrow" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;font-family:var(--font-mono);">' + arrowOpts + '</select>' +
            '<select id="fc-add-edge-to" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' + nodeOpts + '</select>' +
          '</div>' +
          fieldHtml('ラベル', 'fc-add-edge-label', '', '') +
          '<button id="fc-add-edge-btn" style="width:100%;background:var(--accent);color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;">+ エッジ追加</button>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">サブグラフを追加</label>' +
          '<div style="display:flex;gap:4px;">' +
            '<input id="fc-add-sg-id" type="text" placeholder="ID" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<input id="fc-add-sg-label" type="text" placeholder="label" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<button id="fc-add-sg-btn" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+</button>' +
          '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">ノード一覧</label>' +
          '<div>' + nodesList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">エッジ一覧</label>' +
          '<div>' + edgesList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">サブグラフ一覧</label>' +
          '<div>' + subgraphsList + '</div>' +
        '</div>';

      function bindEvt(id, event, handler) {
        var el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
      }
      bindEvt('fc-direction', 'change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateDirection(ctx.getMmdText(), this.value));
        ctx.onUpdate();
      });
      bindEvt('fc-add-node-btn', 'click', function() {
        var id = document.getElementById('fc-add-node-id').value.trim();
        var label = document.getElementById('fc-add-node-label').value.trim();
        var shape = document.getElementById('fc-add-node-shape').value;
        if (!id) { alert('IDは必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addNode(ctx.getMmdText(), id, label || id, shape));
        ctx.onUpdate();
      });
      bindEvt('fc-add-edge-btn', 'click', function() {
        var from = document.getElementById('fc-add-edge-from').value;
        var to = document.getElementById('fc-add-edge-to').value;
        var arrow = document.getElementById('fc-add-edge-arrow').value;
        var label = document.getElementById('fc-add-edge-label').value.trim();
        if (!from || !to) { alert('ノードを先に追加してください'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addEdge(ctx.getMmdText(), from, to, arrow, label));
        ctx.onUpdate();
      });
      bindEvt('fc-add-sg-btn', 'click', function() {
        var id = document.getElementById('fc-add-sg-id').value.trim();
        var label = document.getElementById('fc-add-sg-label').value.trim();
        if (!id) { alert('IDは必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addSubgraph(ctx.getMmdText(), id, label));
        ctx.onUpdate();
      });

      var selNBtns = propsEl.querySelectorAll('.fc-select-node');
      for (var sbi = 0; sbi < selNBtns.length; sbi++) {
        (function(btn) { btn.addEventListener('click', function() { window.MA.selection.setSelected([{ type: 'node', id: btn.getAttribute('data-element-id') }]); }); })(selNBtns[sbi]);
      }
      var delNBtns = propsEl.querySelectorAll('.fc-delete-node');
      for (var dbi = 0; dbi < delNBtns.length; dbi++) {
        (function(btn) { btn.addEventListener('click', function() {
          var ln = parseInt(btn.getAttribute('data-line'), 10);
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteNode(ctx.getMmdText(), ln));
          ctx.onUpdate();
        }); })(delNBtns[dbi]);
      }
      var selEBtns = propsEl.querySelectorAll('.fc-select-edge');
      for (var sei = 0; sei < selEBtns.length; sei++) {
        (function(btn) { btn.addEventListener('click', function() { window.MA.selection.setSelected([{ type: 'edge', id: btn.getAttribute('data-element-id') }]); }); })(selEBtns[sei]);
      }
      var delEBtns = propsEl.querySelectorAll('.fc-delete-edge');
      for (var dei = 0; dei < delEBtns.length; dei++) {
        (function(btn) { btn.addEventListener('click', function() {
          var ln = parseInt(btn.getAttribute('data-line'), 10);
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteEdge(ctx.getMmdText(), ln));
          ctx.onUpdate();
        }); })(delEBtns[dei]);
      }
      var delSGBtns = propsEl.querySelectorAll('.fc-delete-subgraph');
      for (var dsi = 0; dsi < delSGBtns.length; dsi++) {
        (function(btn) { btn.addEventListener('click', function() {
          var sl = parseInt(btn.getAttribute('data-line'), 10);
          var el = parseInt(btn.getAttribute('data-end-line'), 10);
          if (isNaN(el) || el <= 0) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteSubgraph(ctx.getMmdText(), sl, el));
          ctx.onUpdate();
        }); })(delSGBtns[dsi]);
      }
      return;
    }

    // Single node selected
    if (selData.length === 1 && selData[0].type === 'node') {
      var nid = selData[0].id;
      var node = null;
      for (var pj = 0; pj < parsedData.elements.length; pj++) {
        if (parsedData.elements[pj].id === nid) { node = parsedData.elements[pj]; break; }
      }
      if (!node) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">ノードが見つかりません</p>'; return; }
      var shapes = ['rect','round','diamond','circle','parallelogram','hexagon','subroutine','cylinder','asymmetric'];
      var shapeOpts = '';
      for (var si = 0; si < shapes.length; si++) shapeOpts += '<option value="' + shapes[si] + '"' + (shapes[si] === node.shape ? ' selected' : '') + '>' + shapes[si] + '</option>';

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border);font-weight:bold;color:var(--text-primary);font-size:13px;">' + escHtml(node.label) + '</div>' +
        fieldHtml('ID', 'sel-node-id', node.id) +
        fieldHtml('ラベル', 'sel-node-label', node.label) +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">形状</label><select id="sel-node-shape" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + shapeOpts + '</select></div>' +
        '<button id="sel-node-delete" style="width:100%;background:var(--accent-red);color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;margin-top:8px;">ノード削除</button>';

      document.getElementById('sel-node-id').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateNode(ctx.getMmdText(), node.line, 'id', this.value));
        ctx.onUpdate();
      });
      document.getElementById('sel-node-label').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateNode(ctx.getMmdText(), node.line, 'label', this.value));
        ctx.onUpdate();
      });
      document.getElementById('sel-node-shape').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateNode(ctx.getMmdText(), node.line, 'shape', this.value));
        ctx.onUpdate();
      });
      document.getElementById('sel-node-delete').addEventListener('click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(deleteNode(ctx.getMmdText(), node.line));
        window.MA.selection.clearSelection();
        ctx.onUpdate();
      });
      return;
    }

    // Single edge selected
    if (selData.length === 1 && selData[0].type === 'edge') {
      var eid = selData[0].id;
      var edge = null;
      for (var ej = 0; ej < parsedData.relations.length; ej++) {
        if (parsedData.relations[ej].id === eid) { edge = parsedData.relations[ej]; break; }
      }
      if (!edge) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">エッジが見つかりません</p>'; return; }
      var allNodes = parsedData.elements.filter(function(e) { return e.kind === 'node'; });
      var fromOpts = '', toOpts = '';
      for (var ai2 = 0; ai2 < allNodes.length; ai2++) {
        var nn = allNodes[ai2];
        fromOpts += '<option value="' + escHtml(nn.id) + '"' + (nn.id === edge.from ? ' selected' : '') + '>' + escHtml(nn.label) + '</option>';
        toOpts += '<option value="' + escHtml(nn.id) + '"' + (nn.id === edge.to ? ' selected' : '') + '>' + escHtml(nn.label) + '</option>';
      }
      var arrows = ['-->','---','-.->','-.-','==>','===','--x','--o'];
      var arrowOpts = '';
      for (var ai3 = 0; ai3 < arrows.length; ai3++) arrowOpts += '<option value="' + arrows[ai3] + '"' + (arrows[ai3] === edge.arrow ? ' selected' : '') + '>' + arrows[ai3] + '</option>';

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border);font-weight:bold;color:var(--text-primary);font-size:13px;">Edge</div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">From</label><select id="sel-edge-from" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + fromOpts + '</select></div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">Arrow</label><select id="sel-edge-arrow" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;font-family:var(--font-mono);">' + arrowOpts + '</select></div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">To</label><select id="sel-edge-to" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + toOpts + '</select></div>' +
        fieldHtml('ラベル', 'sel-edge-label', edge.label) +
        '<button id="sel-edge-delete" style="width:100%;background:var(--accent-red);color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;margin-top:8px;">エッジ削除</button>';

      document.getElementById('sel-edge-from').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateEdge(ctx.getMmdText(), edge.line, 'from', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-edge-arrow').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateEdge(ctx.getMmdText(), edge.line, 'arrow', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-edge-to').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateEdge(ctx.getMmdText(), edge.line, 'to', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-edge-label').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateEdge(ctx.getMmdText(), edge.line, 'label', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-edge-delete').addEventListener('click', function() { window.MA.history.pushHistory(); ctx.setMmdText(deleteEdge(ctx.getMmdText(), edge.line)); window.MA.selection.clearSelection(); ctx.onUpdate(); });
      return;
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'flowchart',
    displayName: 'Flowchart',
    detect: function(text) {
      return window.MA.parserUtils.detectDiagramType(text) === 'flowchart';
    },
    parse: parseFlowchart,
    template: function() {
      return [
        'flowchart TD',
        '    A[Start] --> B{Decision}',
        '    B -->|Yes| C[OK]',
        '    B -->|No| D[Retry]',
        '    C --> E[End]',
        '    D --> E',
      ].join('\n');
    },
    buildOverlay: buildOverlay,
    renderProps: renderProps,
    operations: {
      add: function(text, kind, props) {
        if (kind === 'node') return addNode(text, props.id, props.label, props.shape);
        if (kind === 'edge') return addEdge(text, props.from, props.to, props.arrow, props.label);
        if (kind === 'subgraph') return addSubgraph(text, props.id, props.label);
        if (kind === 'classDef') return addClassDef(text, props.name, props.style);
        return text;
      },
      delete: function(text, lineNum) {
        return window.MA.textUpdater.deleteLine(text, lineNum);
      },
      update: function(text, lineNum, field, value) {
        var lines = text.split('\n');
        var trimmed = (lines[lineNum - 1] || '').trim();
        var hasEdge = false;
        for (var i = 0; i < EDGE_TYPES.length; i++) {
          if (trimmed.indexOf(EDGE_TYPES[i]) > 0) { hasEdge = true; break; }
        }
        return hasEdge ? updateEdge(text, lineNum, field, value) : updateNode(text, lineNum, field, value);
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
        return addEdge(text, fromId, toId, props.arrow, props.label);
      },
    },
    // Internals
    parseFlowchart: parseFlowchart,
    parseNodeShape: parseNodeShape,
    buildShape: buildShape,
    addNode: addNode,
    deleteNode: deleteNode,
    updateNode: updateNode,
    addEdge: addEdge,
    deleteEdge: deleteEdge,
    updateEdge: updateEdge,
    updateDirection: updateDirection,
    addSubgraph: addSubgraph,
    deleteSubgraph: deleteSubgraph,
    addClassDef: addClassDef,
    EDGE_TYPES: EDGE_TYPES,
  };
})();
