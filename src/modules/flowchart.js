'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.flowchart = (function() {
  // Edge type patterns (longest first for greedy matching)
  //
  // 両端に記号が付く形 (`o--o` `x--x` `<-->`) を知らないと、`A o--o B` の
  // 左辺を `A o` という**存在しないノード**として拾う。長い形を先に並べないと
  // 短い `--o` に先に当たって同じことが起きるので、順序を崩さないこと。
  var EDGE_TYPES = ['<-.->', '<-->', '<==>', 'o--o', 'o--x', 'x--o', 'x--x',
                    '==>', '==o', '==x', '-.->', '-.-', '===', '-->', '---', '--x', '--o'];

  // Shape detection for node text
  // Returns { shape, label } or null if invalid
  function parseNodeShape(raw) {
    raw = raw.trim();
    // Order matters: longer patterns first
    if (/^\(\((.*)\)\)$/.test(raw)) return { shape: 'circle', label: unquoteLabel(RegExp.$1) };
    if (/^\[\[(.*)\]\]$/.test(raw)) return { shape: 'subroutine', label: unquoteLabel(RegExp.$1) };
    if (/^\[\((.*)\)\]$/.test(raw)) return { shape: 'cylinder', label: unquoteLabel(RegExp.$1) };
    if (/^\[\/(.*)\/\]$/.test(raw)) return { shape: 'parallelogram', label: unquoteLabel(RegExp.$1) };
    if (/^\[\\(.*)\\\]$/.test(raw)) return { shape: 'parallelogram_alt', label: unquoteLabel(RegExp.$1) };
    if (/^\{\{(.*)\}\}$/.test(raw)) return { shape: 'hexagon', label: unquoteLabel(RegExp.$1) };
    if (/^\[(.*)\]$/.test(raw)) return { shape: 'rect', label: unquoteLabel(RegExp.$1) };
    if (/^\((.*)\)$/.test(raw)) return { shape: 'round', label: unquoteLabel(RegExp.$1) };
    if (/^\{(.*)\}$/.test(raw)) return { shape: 'diamond', label: unquoteLabel(RegExp.$1) };
    if (/^>(.*)\]$/.test(raw)) return { shape: 'asymmetric', label: unquoteLabel(RegExp.$1) };
    return null;
  }

  // 記号を含むラベルは引用で囲む。
  //
  // flowchart の `[]` `()` `{}` は形状の指定なので、「設計(詳細)」をそのまま
  // 置くと parse が落ちて図が出ない。「"引用"付き」は引用が落ちる。
  // 実測ではどの形状も引用囲みを受け付け、`#quot;` は引用符として描かれる。
  // (この欠陥は updateNode がエッジ行で無言の空振りだった間ずっと隠れていた)
  function _labelNeedsQuote(s) {
    return /["()\[\]{}<>|#]/.test(String(s));
  }
  function encodeLabel(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/#/g, '#35;')
      .replace(/"/g, '#quot;');
  }
  function decodeLabel(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/#quot;/g, '"')
      .replace(/#35;/g, '#');
  }
  function unquoteLabel(s) {
    var t = String(s === undefined || s === null ? '' : s);
    if (t.length >= 2 && t.charAt(0) === '"' && t.charAt(t.length - 1) === '"') t = t.slice(1, -1);
    return decodeLabel(t);
  }

  function buildShape(shape, label) {
    label = label || '';
    if (_labelNeedsQuote(label)) label = '"' + encodeLabel(label) + '"';
    var map = {
      rect: ['[', ']'], round: ['(', ')'], diamond: ['{', '}'],
      circle: ['((', '))'], parallelogram: ['[/', '/]'],
      parallelogram_alt: ['[\\', '\\]'], asymmetric: ['>', ']'],
      hexagon: ['{{', '}}'], subroutine: ['[[', ']]'], cylinder: ['[(', ')]'],
    };
    var wrap = map[shape] || map.rect;
    return wrap[0] + label + wrap[1];
  }

  // Locate the edge operator on a line. parseFlowchart, updateNode and
  // renameNodeRefs all have to agree on where the edge is: when they disagree,
  // the GUI edits a different node than the one the properties panel is showing.
  // (updateNode used to omit the `et.length > edgeLen` clause and so could pick
  // a shorter operator than the parser did on the same line.)
  function findEdge(trimmed) {
    var edgeType = null, edgePos = -1, edgeLen = 0;
    for (var ei = 0; ei < EDGE_TYPES.length; ei++) {
      var et = EDGE_TYPES[ei];
      var pos = trimmed.indexOf(et);
      if (pos > 0 && (edgePos === -1 || pos < edgePos || et.length > edgeLen)) {
        edgeType = et; edgePos = pos; edgeLen = et.length;
      }
    }
    return edgeType ? { type: edgeType, pos: edgePos } : null;
  }

  // Split "A[x] -->|note| B[y];" into its parts, keeping every piece verbatim so
  // a caller can rewrite one of them without reformatting the rest.
  function splitEdgeLine(trimmed) {
    var e = findEdge(trimmed);
    if (!e) return null;
    var rest = trimmed.slice(e.pos + e.type.length);
    var labelPart = '';
    var lblMatch = rest.match(/^\|([^|]*)\|/);
    if (lblMatch) { labelPart = lblMatch[0]; rest = rest.slice(lblMatch[0].length); }
    var tail = '';
    var tm = rest.match(/(\s*;\s*)$/);
    if (tm) { tail = tm[1]; rest = rest.slice(0, rest.length - tm[1].length); }
    return {
      left: trimmed.slice(0, e.pos),
      edge: e.type,
      labelPart: labelPart,
      right: rest,
      tail: tail,
    };
  }

  // Split a node reference ("A", "A[Start]") into its id and its shape suffix.
  // Mirrors extractNode inside parseFlowchart.
  function splitNodeRef(raw) {
    var shapeChars = ['[', '(', '{', '>'];
    for (var si = 0; si < raw.length; si++) {
      if (shapeChars.indexOf(raw[si]) !== -1) {
        return { id: raw.slice(0, si), shape: raw.slice(si) };
      }
    }
    return { id: raw, shape: '' };
  }

  // Rewrite every reference to oldId. Without this, renaming a node id leaves
  // the edges pointing at the old id: mermaid.parse and mermaid.render both
  // succeed and silently grow a phantom node, so the diagram gains an element
  // the user never drew and nothing reports an error.
  //
  // Only the id positions are touched — shape labels, edge labels and comments
  // keep the old text even when it happens to equal the id.
  function renameNodeRefs(lines, oldId, newId, skipIdx) {
    for (var j = 0; j < lines.length; j++) {
      if (j === skipIdx) continue;
      var raw = lines[j];
      var indent = raw.match(/^(\s*)/)[1];
      var trimmed = raw.trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^(flowchart|graph)\s+/.test(trimmed) || trimmed === 'end') continue;
      if (/^(classDef|subgraph|direction|linkStyle)\b/.test(trimmed)) continue;

      // "class A,B name" / "style A fill:#fff" / "click A callback"
      var kw = trimmed.match(/^(class|style|click)\s+(\S+)(.*)$/);
      if (kw) {
        var ids = kw[2].split(',').map(function(s) { return s === oldId ? newId : s; });
        lines[j] = indent + kw[1] + ' ' + ids.join(',') + kw[3];
        continue;
      }

      var parts = splitEdgeLine(trimmed);
      if (parts) {
        var l = splitNodeRef(parts.left.replace(/\s+$/, ''));
        var lPad = parts.left.slice(parts.left.replace(/\s+$/, '').length);
        var rLead = parts.right.slice(0, parts.right.length - parts.right.replace(/^\s+/, '').length);
        var r = splitNodeRef(parts.right.replace(/^\s+/, ''));
        if (l.id.trim() === oldId) l.id = newId;
        if (r.id.trim() === oldId) r.id = newId;
        lines[j] = indent + l.id + l.shape + lPad + parts.edge + parts.labelPart +
                   rLead + r.id + r.shape + parts.tail;
        continue;
      }

      // Standalone reference, e.g. a bare "A" listed inside a subgraph.
      var solo = splitNodeRef(trimmed.replace(/;\s*$/, ''));
      if (solo.id === oldId) {
        lines[j] = indent + newId + solo.shape + trimmed.slice(trimmed.replace(/;\s*$/, '').length);
      }
    }
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

  // moveNodeUp / moveNodeDown: swap with the previous / next line that is
  // also a node definition. Non-node lines (edges, subgraph boundaries,
  // blanks, comments) are skipped over only if they're blank/comment; a
  // structural line causes a no-op so block shape stays intact.
  function _isNodeLine(trimmed) {
    if (!trimmed) return false;
    if (trimmed.indexOf('%%') === 0) return false;
    if (/-->|---|-\.->|-\.-|==>|===|--x|--o/.test(trimmed)) return false; // edge
    if (/^(subgraph|end|flowchart|graph|direction|classDef|class\s|style\s|linkStyle|click\s)/i.test(trimmed)) return false;
    return /^\w/.test(trimmed);
  }

  // 入れ替えてよい行か。
  //
  // 以前は「ノード行」だけを相手にしていたので、直上がエッジ行だと無言で空振り
  // していた。`A[Start] --> B[Mid]` のようにノードをエッジ行にインラインで書くのは
  // flowchart で最も普通の書き方なので、実質「↑ が常に死んでいる」状態だった。
  // 宣言順はレイアウトに影響するが、エッジ行との入れ替えは構文上安全なので相手に含める。
  //
  // 逆に `subgraph` / `end` を越えると**属するグループが変わる** — これは意味が
  // 変わるので越えない。装飾行 (classDef / style / click) も動かさない。
  function _isMovableLine(trimmed) {
    if (!trimmed) return false;
    if (trimmed.indexOf('%%') === 0) return false;
    if (/^(subgraph|end|flowchart|graph|direction|classDef|class\s|style\s|linkStyle|click\s)/i.test(trimmed)) return false;
    return true;
  }

  function _moveNodeStep(text, lineNum, direction) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var target = idx + direction;
    while (target >= 0 && target < lines.length) {
      var t = lines[target].trim();
      if (!t || t.indexOf('%%') === 0) { target += direction; continue; }
      if (_isMovableLine(t)) {
        var tmp = lines[idx];
        lines[idx] = lines[target];
        lines[target] = tmp;
        return lines.join('\n');
      }
      return text;
    }
    return text;
  }

  function moveNodeUp(text, lineNum) { return _moveNodeStep(text, lineNum, -1); }
  function moveNodeDown(text, lineNum) { return _moveNodeStep(text, lineNum, 1); }

  // Nodes that carry an explicit shape on this line. These are the declarations
  // that would be lost with the line, so a delete has to re-emit them.
  function declaredOnLine(trimmed) {
    var out = [];
    var parts = splitEdgeLine(trimmed);
    var refs = parts
      ? [parts.left.trim(), parts.right.trim()]
      : [trimmed.replace(/;\s*$/, '').trim()];
    for (var i = 0; i < refs.length; i++) {
      if (!refs[i]) continue;
      var ref = splitNodeRef(refs[i]);
      if (!ref.shape) continue;
      var sh = parseNodeShape(ref.shape);
      if (!sh) continue;
      out.push({ id: ref.id.trim(), shape: sh.shape, label: sh.label });
    }
    return out;
  }

  // Delete one node and everything that only existed because of it.
  //
  // mermaid's flowchart declares nodes inside edge lines
  // (`A[開始] --> B[処理]`), so several nodes share one line number. Deleting the
  // line — which is what this used to do — removed a node the user did not pick
  // and stripped the label off the one they did: pressing ✕ on 処理 made 開始
  // disappear and turned 処理 into a bare `B`.
  //
  // Instead: drop the lines that reference the node, then put back a standalone
  // declaration for every other node whose shape/label lived on one of those
  // lines. `nodeId` is optional so older callers that only had a line number
  // keep their previous behaviour.
  function deleteNode(text, lineNum, nodeId) {
    if (!nodeId) return window.MA.textUpdater.deleteLine(text, lineNum);
    var entries = text.split('\n').map(function(l) { return { text: l }; });
    return dropRedundantDecls(removeNodeRefs(entries, nodeId)).join('\n');
  }

  // Drop every line that mentions nodeId, re-emitting the declarations of the
  // other endpoints so their labels survive. Works on entry objects rather than
  // strings so it can be applied repeatedly (deleteSubgraph removes each member
  // in turn) without losing track of which lines this delete synthesised.
  function removeNodeRefs(entries, nodeId) {
    var out = [];
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var indent = entry.text.match(/^(\s*)/)[1];
      var trimmed = entry.text.trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) { out.push(entry); continue; }

      // `class A,B name` / `style A ...` / `click A ...`
      var kw = trimmed.match(/^(class|style|click)\s+(\S+)(.*)$/);
      if (kw) {
        var kept = kw[2].split(',').filter(function(s) { return s !== nodeId; });
        if (kept.length) out.push({ text: indent + kw[1] + ' ' + kept.join(',') + kw[3] });
        continue;
      }

      var parts = splitEdgeLine(trimmed);
      if (parts) {
        var l = splitNodeRef(parts.left.trim());
        var r = splitNodeRef(parts.right.trim());
        if (l.id.trim() !== nodeId && r.id.trim() !== nodeId) { out.push(entry); continue; }
        // The edge goes; keep the surviving endpoint's declaration.
        var decls = declaredOnLine(trimmed);
        for (var d = 0; d < decls.length; d++) {
          if (decls[d].id === nodeId) continue;
          out.push({
            text: indent + decls[d].id + buildShape(decls[d].shape, decls[d].label),
            synthesized: true,
            id: decls[d].id,
          });
        }
        continue;
      }

      if (/^(flowchart|graph|subgraph|direction|classDef|linkStyle)\b/.test(trimmed) || trimmed === 'end') {
        out.push(entry);
        continue;
      }
      var solo = splitNodeRef(trimmed.replace(/;\s*$/, ''));
      if (solo.id.trim() === nodeId) continue;
      out.push(entry);
    }
    return out;
  }

  // Drop the declarations this delete put back that turned out to be unnecessary
  // — the node is still declared with its shape on a line that survived, or the
  // same node got re-emitted twice because it appeared on two removed edges.
  //
  // Only lines carrying `synthesized` are candidates. A duplicate declaration the
  // user wrote themselves is theirs to keep; silently tidying it would make a
  // delete rewrite parts of the file that have nothing to do with the delete.
  function dropRedundantDecls(entries) {
    var declaredElsewhere = {};
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].synthesized) continue;
      var ds = declaredOnLine(entries[i].text.trim());
      for (var k = 0; k < ds.length; k++) declaredElsewhere[ds[k].id] = true;
    }
    var emitted = {};
    var out = [];
    for (var j = 0; j < entries.length; j++) {
      var e = entries[j];
      if (e.synthesized) {
        if (declaredElsewhere[e.id] || emitted[e.id]) continue;
        emitted[e.id] = true;
      }
      out.push(e.text);
    }
    return out;
  }

  // Delete an edge without taking the endpoint labels with it.
  //
  // `A[開始] --> B[処理]` is one line, so removing the edge used to remove both
  // declarations: the nodes stayed in the diagram (other lines still referenced
  // them) but came back as bare `A` and `B`.
  function deleteEdge(text, lineNum) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var entries = [];
    for (var i = 0; i < lines.length; i++) {
      if (i !== idx) { entries.push({ text: lines[i] }); continue; }
      var indent = lines[i].match(/^(\s*)/)[1];
      var decls = declaredOnLine(lines[i].trim());
      for (var d = 0; d < decls.length; d++) {
        entries.push({
          text: indent + decls[d].id + buildShape(decls[d].shape, decls[d].label),
          synthesized: true,
          id: decls[d].id,
        });
      }
    }
    return dropRedundantDecls(entries).join('\n');
  }

  // How much a delete would actually remove, counted by running it and diffing
  // the parse. A subgraph takes its contents and every edge crossing its border,
  // and a node takes every edge that touches it, so the row label on its own
  // cannot tell the user what one ✕ is about to cost.
  function deletionImpact(text, el) {
    var before = parseFlowchart(text);
    var after = parseFlowchart(
      el.kind === 'subgraph'
        ? deleteSubgraph(text, el.line, el.endLine)
        : deleteNode(text, el.line, el.id)
    );
    return {
      elements: before.elements.length - after.elements.length,
      relations: before.relations.length - after.relations.length,
    };
  }

  function updateNode(text, lineNum, field, value, nodeId) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();

    // Try to parse as standalone node or as part of edge
    // For simplicity: find a node declaration on this line and rewrite
    // This handles: "A[Start]" or "A[Start] --> B[End]"
    var indent = lines[idx].match(/^(\s*)/)[1];

    // Check if line has edge (same detection as parseFlowchart — see findEdge)
    var edge = findEdge(trimmed);

    if (!edge) {
      // Standalone node line
      var m = trimmed.match(/^(\S+?)(\[.*\]|\(.*\)|\{.*\}|>.*\])?\s*;?\s*$/);
      if (!m) return text;
      var nid = m[1];
      var oldId = nid;
      var sh = m[2] ? parseNodeShape(m[2]) : null;
      var label = sh ? sh.label : nid;
      var shape = sh ? sh.shape : 'rect';
      if (field === 'id') nid = value;
      else if (field === 'label') label = value;
      else if (field === 'shape') shape = value;
      lines[idx] = indent + nid + buildShape(shape, label);
      if (field === 'id' && value !== oldId) renameNodeRefs(lines, oldId, value, idx);
      return lines.join('\n');
    }

    // 宣言がエッジ行にある場合。`A[Start] --> B{Decision}` は flowchart の普通の
    // 書き方で、ひな形の全ノードがこれに当たる。ここが no-op だったので、ラベル欄も
    // ID 欄も形状も**無言で効かなかった** (エラーも出ない)。
    // 元のコードには「label なら更新する」とコメントがあるだけで、分岐自体が無かった。
    //
    // 行には両端があるので、行番号だけではどちらを直すのか決まらない。削除で先に
    // 直したのと同じ形で、押した要素の id を受け取って端を特定する。id が無い
    // 旧来の呼び方では左辺 (その行で先に現れる方) を対象にする。
    //
    // 書式は splitEdgeLine がそのまま保持するので、直した端以外は1文字も動かない
    // (1操作で差分を汚さない — R9 の見ているところ)。
    var parts = splitEdgeLine(trimmed);
    if (!parts) return text;

    var leftCore = parts.left.replace(/\s+$/, '');
    var leftPad = parts.left.slice(leftCore.length);
    var rightLead = parts.right.slice(0, parts.right.length - parts.right.replace(/^\s+/, '').length);
    var rightCore = parts.right.replace(/^\s+/, '');

    var l = splitNodeRef(leftCore);
    var r = splitNodeRef(rightCore);

    var side;
    if (nodeId) {
      // 完全一致だけを見る。前方一致だと `A` を直したつもりで `AB` を掘む。
      if (l.id === nodeId) side = 'left';
      else if (r.id === nodeId) side = 'right';
      else return text;               // その行に居ない → 何もしない
    } else {
      side = 'left';
    }

    var target = side === 'left' ? l : r;
    var shapeInfo = target.shape ? parseNodeShape(target.shape) : null;
    var curId = target.id;
    var curLabel = shapeInfo ? shapeInfo.label : curId;
    var curShape = shapeInfo ? shapeInfo.shape : 'rect';
    var newId = curId;
    if (field === 'id') newId = value;
    else if (field === 'label') curLabel = value;
    else if (field === 'shape') curShape = value;
    else return text;

    target.id = newId;
    target.shape = buildShape(curShape, curLabel);

    lines[idx] = indent + l.id + l.shape + leftPad + parts.edge + parts.labelPart +
                 rightLead + r.id + r.shape + parts.tail;
    if (field === 'id' && value !== curId) renameNodeRefs(lines, curId, value, idx);
    return lines.join('\n');
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

  // Delete a subgraph together with its contents.
  //
  // Removing the block's lines is not enough: an edge drawn from a member to a
  // node outside the group still names the member, so mermaid re-declares it as
  // a bare node. The group's box vanished, the labels vanished, and an
  // unlabelled ghost of every member stayed on the canvas. Each member goes
  // through the same removal as a node delete.
  function deleteSubgraph(text, startLine, endLine) {
    var members = parseFlowchart(text).elements.filter(function(n) {
      return n.line >= startLine && n.line <= endLine;
    }).map(function(n) { return n.id; });

    var lines = text.split('\n');
    lines.splice(startLine - 1, (endLine - startLine + 1));
    var entries = lines.map(function(l) { return { text: l }; });
    for (var i = 0; i < members.length; i++) {
      entries = removeNodeRefs(entries, members[i]);
    }
    return dropRedundantDecls(entries).join('\n');
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
  // Match SVG nodes back to parsed nodes by mermaid's own element id
  // (`flowchart-<id>-<n>`), not by label text.
  //
  // Label matching took the *first* element whose label equalled the rendered
  // text, so on a chart with two nodes both labelled 確認 the second one's
  // overlay answered for the first: clicking the lower node selected the upper
  // one. Ids are what the DSL and the renderer actually agree on.
  //
  // The rect geometry goes through overlayGeom.boxInSvgSpace — the raw getBBox()
  // this used before is in the node's own coordinate system, so every rect
  // landed on top of the others at the local origin.
  function buildOverlay(svgEl, parsedData, overlayEl) {
    var geom = window.MA.overlayGeom;
    geom.syncViewport(svgEl, overlayEl);
    if (!overlayEl || !svgEl || !parsedData) return;

    var byId = {};
    for (var pi = 0; pi < parsedData.elements.length; pi++) {
      byId[parsedData.elements[pi].id] = parsedData.elements[pi];
    }

    var svgNodes = svgEl.querySelectorAll('.node');
    for (var ni = 0; ni < svgNodes.length; ni++) {
      var gNode = svgNodes[ni];
      var nodeId = geom.idFromSvgNodeId(gNode.getAttribute('id'), 'flowchart');
      var matched = nodeId ? byId[nodeId] : null;
      if (!matched) continue;
      var box = geom.boxInSvgSpace(svgEl, gNode);
      if (!box) continue;
      overlayEl.appendChild(geom.hitRect(document, box, {
        id: matched.id,
        kind: 'node',
        line: matched.line,
        selected: window.MA.selection.isSelected(matched.id),
        className: 'overlay-node',
      }));
    }
  }

  // ── UI: renderProps ──
  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var fieldHtml = window.MA.properties.fieldHtml;
    var props = window.MA.properties;

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
        // A node takes its edges with it, and on a compact diagram it can take a
        // neighbour's declaration line too. The row label cannot show that, so
        // the count goes on the button.
        var nImpact = deletionImpact(ctx.getMmdText(), n);
        var nExtra = nImpact.elements + nImpact.relations;
        nodesList += window.MA.properties.listItemHtml({
          label: n.label,
          sublabel: '(' + n.id + ', ' + n.shape + ')',
          selectClass: 'fc-select-node',
          deleteClass: 'fc-delete-node',
          deleteLabel: nExtra > 1 ? '✕' + nExtra : '✕',
          deleteTitle: nExtra > 1
            ? '削除すると ' + nImpact.elements + ' ノード / ' + nImpact.relations + ' エッジが消えます'
            : '',
          dataElementId: n.id,
          dataLine: n.line,
        });
      }
      if (!nodesList) nodesList = window.MA.properties.emptyListHtml('（ノードなし）');

      var edgesList = '';
      for (var lei = 0; lei < edges.length; lei++) {
        var ed = edges[lei];
        edgesList += window.MA.properties.listItemHtml({
          label: ed.from + ' ' + ed.arrow + ' ' + ed.to + (ed.label ? ' |' + ed.label + '|' : ''),
          selectClass: 'fc-select-edge',
          deleteClass: 'fc-delete-edge',
          dataElementId: ed.id,
          dataLine: ed.line,
          mono: true,
        });
      }
      if (!edgesList) edgesList = window.MA.properties.emptyListHtml('（エッジなし）');

      var subgraphsList = '';
      for (var sgi = 0; sgi < subgraphs.length; sgi++) {
        var sg = subgraphs[sgi];
        var sgImpact = deletionImpact(ctx.getMmdText(), sg);
        var sgExtra = sgImpact.elements + sgImpact.relations;
        subgraphsList += window.MA.properties.listItemHtml({
          label: sg.label,
          sublabel: '(' + sg.id + ')',
          selectClass: null,
          deleteClass: 'fc-delete-subgraph',
          deleteLabel: sgExtra > 1 ? '✕' + sgExtra : '✕',
          deleteTitle: sgExtra > 1
            ? '削除すると ' + sgImpact.elements + ' ノード / ' + sgImpact.relations + ' エッジが消えます'
            : '',
          dataLine: sg.line,
          dataEndLine: sg.endLine,
        });
      }
      if (!subgraphsList) subgraphsList = window.MA.properties.emptyListHtml('（なし）');

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
          props.selectFieldHtml('From', 'fc-add-edge-from', nodes.length === 0 ? [{value: '', label: '（ノードを先に追加）'}] : nodes.map(function(n) { return { value: n.id, label: n.label }; })) +
          props.selectFieldHtml('Arrow', 'fc-add-edge-arrow', arrows.map(function(a) { return { value: a, label: a }; }), true) +
          props.selectFieldHtml('To', 'fc-add-edge-to', nodes.length === 0 ? [{value: '', label: '（ノードを先に追加）'}] : nodes.map(function(n) { return { value: n.id, label: n.label }; })) +
          fieldHtml('ラベル', 'fc-add-edge-label', '', '') +
          window.MA.properties.primaryButtonHtml('fc-add-edge-btn', '+ エッジ追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">サブグラフを追加</label>' +
          '<div style="display:flex;gap:4px;">' +
            '<input id="fc-add-sg-id" type="text" placeholder="ID" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<input id="fc-add-sg-label" type="text" placeholder="label" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<button id="fc-add-sg-btn" title="サブグラフを追加" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+</button>' +
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

      window.MA.properties.bindEvent('fc-direction', 'change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateDirection(ctx.getMmdText(), this.value));
        ctx.onUpdate();
      });
      window.MA.properties.bindEvent('fc-add-node-btn', 'click', function() {
        var id = document.getElementById('fc-add-node-id').value.trim();
        var label = document.getElementById('fc-add-node-label').value.trim();
        var shape = document.getElementById('fc-add-node-shape').value;
        if (!id) { alert('IDは必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addNode(ctx.getMmdText(), id, label || id, shape));
        ctx.onUpdate();
      });
      window.MA.properties.bindEvent('fc-add-edge-btn', 'click', function() {
        var from = document.getElementById('fc-add-edge-from').value;
        var to = document.getElementById('fc-add-edge-to').value;
        var arrow = document.getElementById('fc-add-edge-arrow').value;
        var label = document.getElementById('fc-add-edge-label').value.trim();
        if (!from || !to) { alert('ノードを先に追加してください'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addEdge(ctx.getMmdText(), from, to, arrow, label));
        ctx.onUpdate();
      });
      window.MA.properties.bindEvent('fc-add-sg-btn', 'click', function() {
        var id = document.getElementById('fc-add-sg-id').value.trim();
        var label = document.getElementById('fc-add-sg-label').value.trim();
        if (!id) { alert('IDは必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addSubgraph(ctx.getMmdText(), id, label));
        ctx.onUpdate();
      });

      window.MA.properties.bindSelectButtons(propsEl, 'fc-select-node', 'node');
      // The 3rd argument is data-element-id. It matters here because several
      // nodes can share one line (`A[開始] --> B[処理]`): without the id the
      // delete falls back to removing the whole line, taking the neighbour with it.
      window.MA.properties.bindDeleteButtons(propsEl, 'fc-delete-node', ctx, function(t, ln, elId) {
        return elId ? deleteNode(t, ln, elId) : t;
      });
      window.MA.properties.bindSelectButtons(propsEl, 'fc-select-edge', 'edge');
      window.MA.properties.bindDeleteButtons(propsEl, 'fc-delete-edge', ctx, deleteEdge);
      window.MA.properties.bindDeleteButtons(propsEl, 'fc-delete-subgraph', ctx, deleteSubgraph, true);
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
        window.MA.properties.panelHeaderHtml(node.label) +
        fieldHtml('ID', 'sel-node-id', node.id) +
        fieldHtml('ラベル', 'sel-node-label', node.label) +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">形状</label><select id="sel-node-shape" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + shapeOpts + '</select></div>' +
        window.MA.properties.connectButtonHtml('sel-node-connect') +
        window.MA.properties.actionBarHtml('sel-node', {
          insertBefore: false, insertAfter: false,
          move: true, delete: true,
          labels: { delete: 'ノード削除' },
        });

      // 図の上でクリック2回でエッジを引く。From/To のドロップダウンから
      // 両端を探す必要がなくなる (ノードが増えるほど効く)
      window.MA.properties.bindConnectButton('sel-node-connect', 'node', node.id,
        function(fromId, toId) { return addEdge(ctx.getMmdText(), fromId, toId); });

      document.getElementById('sel-node-id').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateNode(ctx.getMmdText(), node.line, 'id', this.value, node.id));
        ctx.onUpdate();
      });
      document.getElementById('sel-node-label').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateNode(ctx.getMmdText(), node.line, 'label', this.value, node.id));
        ctx.onUpdate();
      });
      document.getElementById('sel-node-shape').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateNode(ctx.getMmdText(), node.line, 'shape', this.value, node.id));
        ctx.onUpdate();
      });
      window.MA.properties.bindActionBar('sel-node', {
        up: function() {
          var newText = moveNodeUp(ctx.getMmdText(), node.line);
          if (newText === ctx.getMmdText()) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(newText);
          window.MA.selection.setSelected([{ type: 'node', id: node.id }]);
          ctx.onUpdate();
        },
        down: function() {
          var newText = moveNodeDown(ctx.getMmdText(), node.line);
          if (newText === ctx.getMmdText()) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(newText);
          window.MA.selection.setSelected([{ type: 'node', id: node.id }]);
          ctx.onUpdate();
        },
        'delete': function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteNode(ctx.getMmdText(), node.line, node.id));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        },
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
        window.MA.properties.panelHeaderHtml('Edge') +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">From</label><select id="sel-edge-from" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + fromOpts + '</select></div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">Arrow</label><select id="sel-edge-arrow" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;font-family:var(--font-mono);">' + arrowOpts + '</select></div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">To</label><select id="sel-edge-to" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + toOpts + '</select></div>' +
        fieldHtml('ラベル', 'sel-edge-label', edge.label) +
        window.MA.properties.actionBarHtml('sel-edge', {
          insertBefore: false, insertAfter: false,
          move: false, delete: true,
          labels: { delete: 'エッジ削除' },
        });

      document.getElementById('sel-edge-from').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateEdge(ctx.getMmdText(), edge.line, 'from', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-edge-arrow').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateEdge(ctx.getMmdText(), edge.line, 'arrow', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-edge-to').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateEdge(ctx.getMmdText(), edge.line, 'to', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-edge-label').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateEdge(ctx.getMmdText(), edge.line, 'label', this.value)); ctx.onUpdate(); });
      window.MA.properties.bindActionBar('sel-edge', {
        'delete': function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteEdge(ctx.getMmdText(), edge.line));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        },
      });
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
      delete: function(text, lineNum, opts) {
        opts = opts || {};
        // id を渡されたら id 認識の削除を使う (state と同型)。
        //
        // ここは単なる deleteLine だったので、`B -->|Yes| C[OK]` の C を消そうと
        // しても行ごと消えるだけで、B や他の参照が残る。A4 で UI の経路は
        // 直したが、契約の経路が古いまま残っていた。
        if (opts.id && opts.kind !== 'edge') return deleteNode(text, lineNum, opts.id);
        return window.MA.textUpdater.deleteLine(text, lineNum);
      },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        var lines = text.split('\n');
        var trimmed = (lines[lineNum - 1] || '').trim();
        var hasEdge = false;
        for (var i = 0; i < EDGE_TYPES.length; i++) {
          if (trimmed.indexOf(EDGE_TYPES[i]) > 0) { hasEdge = true; break; }
        }
        // 「行にエッジ記号があればエッジ」では取り違える。
        //
        // `A[Start] --> B{Decision}` はノードの宣言とエッジが同じ行にあるので、
        // A のラベルを変えようとすると**エッジのラベル**が付いていた
        // (`A --> |新ラベル| B`)。updateNode は第5引数に id を受け取れるのに、
        // 入口が渡していなかった。呼び出し側が「どちらを指しているか」を言えるようにする。
        //
        // 何も言われなければ従来どおり (エッジ行はエッジ扱い) にして、既存の
        // 呼び出しを壊さない。
        if (opts.kind === 'node' || opts.id) {
          return updateNode(text, lineNum, field, value, opts.id);
        }
        if (opts.kind === 'edge') return updateEdge(text, lineNum, field, value);
        return hasEdge ? updateEdge(text, lineNum, field, value) : updateNode(text, lineNum, field, value);
      },
      // 素の行入れ替えは**図の宣言行と入れ替わって図を壊す**。
      // 同じ種類の要素が乗っている行としか入れ替えない。
      moveUp: function(text, lineNum) {
        return window.MA.textUpdater.moveElementLine(
          text, lineNum, -1, (parseFlowchart(text).elements || []));
      },
      moveDown: function(text, lineNum) {
        return window.MA.textUpdater.moveElementLine(
          text, lineNum, 1, (parseFlowchart(text).elements || []));
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
    moveNodeUp: moveNodeUp,
    moveNodeDown: moveNodeDown,
    updateNode: updateNode,
    addEdge: addEdge,
    deleteEdge: deleteEdge,
    deletionImpact: deletionImpact,
    updateEdge: updateEdge,
    updateDirection: updateDirection,
    addSubgraph: addSubgraph,
    deleteSubgraph: deleteSubgraph,
    addClassDef: addClassDef,
    EDGE_TYPES: EDGE_TYPES,
  };
})();
