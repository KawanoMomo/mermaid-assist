'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.sequence = (function() {
  // Arrow types (longest first for greedy matching)
  var ARROW_TYPES = ['-->>', '-->', '--)', '--x', '->>', '-)', '-x', '->'];

  // parseSequence: text → ParsedData
  // ParsedData = {
  //   meta: { title, autonumber: bool | number | null },
  //   elements: [
  //     { kind: 'participant'|'actor', id, label, line },
  //     { kind: 'note', position: 'left of'|'right of'|'over', targets: [id,...], text, line }
  //   ],
  //   relations: [  // messages
  //     { kind: 'message', id: '__msg_N', from, to, arrow, label, line, blockPath: [..] }
  //   ],
  //   groups: [
  //     { kind: 'loop'|'alt'|'opt'|'par'|'else'|'and', id: '__grp_N', line, endLine, label, parentId }
  //   ]
  // }
  function parseSequence(text) {
    var result = { meta: { title: '', autonumber: null }, elements: [], relations: [], groups: [] };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var msgCounter = 0, grpCounter = 0;
    var blockStack = []; // stack of group IDs

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed === 'sequenceDiagram' || trimmed.indexOf('%%') === 0) continue;

      // title
      if (trimmed.indexOf('title ') === 0) {
        result.meta.title = trimmed.slice('title '.length).trim();
        continue;
      }

      // autonumber
      if (trimmed === 'autonumber') { result.meta.autonumber = true; continue; }
      if (trimmed === 'autonumber off') { result.meta.autonumber = false; continue; }
      var anMatch = trimmed.match(/^autonumber\s+(\d+)(\s+\d+)?$/);
      if (anMatch) { result.meta.autonumber = parseInt(anMatch[1], 10); continue; }

      // participant/actor
      var pMatch = trimmed.match(/^(participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/);
      if (pMatch) {
        var p = { kind: pMatch[1], id: pMatch[2], label: pMatch[3] ? pMatch[3].trim() : pMatch[2], line: lineNum };
        result.elements.push(p);
        continue;
      }

      // block start: loop / alt / opt / par
      var blockStart = trimmed.match(/^(loop|alt|opt|par)\s*(.*)$/);
      if (blockStart) {
        var gid = '__grp_' + (grpCounter++);
        var grp = {
          kind: blockStart[1],
          id: gid,
          line: lineNum,
          endLine: -1,
          label: blockStart[2].trim(),
          parentId: blockStack.length > 0 ? blockStack[blockStack.length - 1] : null,
        };
        result.groups.push(grp);
        blockStack.push(gid);
        continue;
      }

      // else / and (mid-block dividers — treat as separate groups for editing)
      var divMatch = trimmed.match(/^(else|and)\s*(.*)$/);
      if (divMatch) {
        var did = '__grp_' + (grpCounter++);
        result.groups.push({
          kind: divMatch[1],
          id: did,
          line: lineNum,
          endLine: lineNum,
          label: divMatch[2].trim(),
          parentId: blockStack.length > 0 ? blockStack[blockStack.length - 1] : null,
        });
        continue;
      }

      // end
      if (trimmed === 'end') {
        if (blockStack.length > 0) {
          var closingId = blockStack.pop();
          for (var gi = result.groups.length - 1; gi >= 0; gi--) {
            if (result.groups[gi].id === closingId) { result.groups[gi].endLine = lineNum; break; }
          }
        }
        continue;
      }

      // note
      var noteMatch = trimmed.match(/^note\s+(left of|right of|over)\s+([^:]+):\s*(.*)$/i);
      if (noteMatch) {
        var targets = noteMatch[2].split(',').map(function(s) { return s.trim(); });
        result.elements.push({
          kind: 'note',
          position: noteMatch[1].toLowerCase(),
          targets: targets,
          text: noteMatch[3],
          line: lineNum,
        });
        continue;
      }

      // message — scan for arrow type (longest first)
      var arrow = null, arrowPos = -1;
      for (var ai = 0; ai < ARROW_TYPES.length; ai++) {
        var at = ARROW_TYPES[ai];
        var pos = trimmed.indexOf(at);
        if (pos > 0) { arrow = at; arrowPos = pos; break; }
      }
      if (arrow) {
        var from = trimmed.slice(0, arrowPos).trim();
        var rest = trimmed.slice(arrowPos + arrow.length);
        var colonIdx = rest.indexOf(':');
        var to, label;
        if (colonIdx >= 0) {
          to = rest.slice(0, colonIdx).trim();
          label = rest.slice(colonIdx + 1).trim();
        } else {
          to = rest.trim();
          label = '';
        }
        result.relations.push({
          kind: 'message',
          id: '__msg_' + (msgCounter++),
          from: from,
          to: to,
          arrow: arrow,
          label: label,
          line: lineNum,
          blockPath: blockStack.slice(),
        });
      }
    }

    return result;
  }

  // ── Updaters ──

  // addParticipant: append after 'sequenceDiagram' or after existing participants
  function addParticipant(text, kind, id, label) {
    kind = kind || 'participant';
    var newLine = '    ' + kind + ' ' + id + (label && label !== id ? ' as ' + label : '');
    var p = parseSequence(text);
    // Insert after last participant/actor, else after first line (sequenceDiagram)
    var insertAfterLine = 1;
    for (var i = 0; i < p.elements.length; i++) {
      if ((p.elements[i].kind === 'participant' || p.elements[i].kind === 'actor') && p.elements[i].line > insertAfterLine) {
        insertAfterLine = p.elements[i].line;
      }
    }
    return window.MA.textUpdater.insertAfter(text, insertAfterLine, newLine);
  }

  function deleteParticipant(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function moveParticipantUp(text, lineNum) {
    var p = parseSequence(text);
    var participants = p.elements.filter(function(e) { return e.kind === 'participant' || e.kind === 'actor'; }).sort(function(a,b){ return a.line - b.line; });
    var idx = -1;
    for (var i = 0; i < participants.length; i++) if (participants[i].line === lineNum) { idx = i; break; }
    if (idx <= 0) return text;
    return window.MA.textUpdater.swapLines(text, lineNum, participants[idx - 1].line);
  }

  function moveParticipantDown(text, lineNum) {
    var p = parseSequence(text);
    var participants = p.elements.filter(function(e) { return e.kind === 'participant' || e.kind === 'actor'; }).sort(function(a,b){ return a.line - b.line; });
    var idx = -1;
    for (var i = 0; i < participants.length; i++) if (participants[i].line === lineNum) { idx = i; break; }
    if (idx < 0 || idx >= participants.length - 1) return text;
    return window.MA.textUpdater.swapLines(text, lineNum, participants[idx + 1].line);
  }

  // moveParticipant: drag-to-reorder via gap index.
  // gapIndex is a GAP position in the pre-move participant array, range [0, N]:
  //   0   = before all participants
  //   k   = between participants k-1 and k
  //   N   = after all participants
  // Gaps adjacent to the dragged participant (at `from` and `from+1`) are no-op
  // since the participant would land back in its own slot.
  //
  // Matches the drop-indicator semantics used by app.js so that dropping on the
  // visible dotted line puts the participant exactly at that position. See
  // 06_PlantUMLAssist/docs/direct-manipulation-ux-checklist.md 観点 J.
  function moveParticipant(text, alias, gapIndex) {
    if (!alias) return text;
    var p = parseSequence(text);
    var participants = p.elements
      .filter(function(e) { return e.kind === 'participant' || e.kind === 'actor'; })
      .sort(function(a, b) { return a.line - b.line; });
    var from = -1;
    for (var i = 0; i < participants.length; i++) {
      if (participants[i].id === alias) { from = i; break; }
    }
    if (from < 0) return text;
    var N = participants.length;
    if (gapIndex < 0) gapIndex = 0;
    if (gapIndex > N) gapIndex = N;
    if (gapIndex === from || gapIndex === from + 1) return text;
    // Translate gap index → post-remove insertion index.
    var targetIdx = (gapIndex <= from) ? gapIndex : gapIndex - 1;
    var lines = text.split('\n');
    var fromLineIdx0 = participants[from].line - 1;
    var lineContent = lines[fromLineIdx0];
    lines.splice(fromLineIdx0, 1);
    var remaining = participants.filter(function(_, idx) { return idx !== from; });
    var toLineIdx0;
    if (targetIdx >= remaining.length) {
      toLineIdx0 = remaining[remaining.length - 1].line;  // line is 1-based, after-last = that line's 0-index + 1
      if (fromLineIdx0 < toLineIdx0) toLineIdx0--;
    } else {
      toLineIdx0 = remaining[targetIdx].line - 1;
      if (fromLineIdx0 < toLineIdx0) toLineIdx0--;
    }
    lines.splice(toLineIdx0, 0, lineContent);
    return lines.join('\n');
  }

  function updateParticipant(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    var m = trimmed.match(/^(participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/);
    if (!m) return text;
    var kind = m[1], id = m[2], label = m[3] ? m[3].trim() : id;
    if (field === 'kind') kind = value;
    else if (field === 'id') id = value;
    else if (field === 'label') label = value;
    var indent = lines[idx].match(/^(\s*)/)[1];
    lines[idx] = indent + kind + ' ' + id + (label && label !== id ? ' as ' + label : '');
    return lines.join('\n');
  }

  // addMessage: append at end of file (or within last block)
  function addMessage(text, from, to, arrow, label) {
    arrow = arrow || '->>';
    var newLine = '    ' + from + arrow + to + (label ? ': ' + label : ': ');
    // Insert before any trailing empty lines, after last non-empty line
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  // insertMessageAt: insert a new message line at the specified 1-based position.
  // position='before' inserts *before* lineNum, 'after' inserts *after* lineNum.
  // Used by hover-insert / resolveInsertLine to place the new message at the
  // visual gap the user clicked on.
  function insertMessageAt(text, lineNum, position, from, to, arrow, label) {
    arrow = arrow || '->>';
    var newLine = '    ' + from + arrow + to + (label ? ': ' + label : ': ');
    if (position === 'after') {
      return window.MA.textUpdater.insertAfter(text, lineNum, newLine);
    }
    return window.MA.textUpdater.insertBefore(text, lineNum, newLine);
  }

  // resolveInsertLine: maps a cursor y-coord (in SVG units) to { line, position }
  // describing where a new message should be inserted in the DSL.
  //
  // Mermaid renders each message as a `<line class="messageLine0|1">` at a
  // known y coordinate. We read the visible messages in DOM order, pair them
  // with parsedData.relations (also in DSL order), and pick the nearest gap.
  //
  // Returns null when no messages are present (caller should fall back to
  // appending at the end of the block).
  function resolveInsertLine(svgEl, parsedData, cursorSvgY) {
    if (!svgEl || !parsedData) return null;
    var msgRelations = (parsedData.relations || []).filter(function(r) { return r.kind === 'message'; });
    if (msgRelations.length === 0) return null;
    var lines = svgEl.querySelectorAll('line.messageLine0, line.messageLine1');
    if (lines.length === 0) return null;
    // Collect y coordinates and sort ascending
    var ys = Array.prototype.map.call(lines, function(l) {
      return parseFloat(l.getAttribute('y1') || l.getAttribute('y') || 0);
    }).sort(function(a, b) { return a - b; });
    // Bind messages to sorted y's by index (both are in DSL order).
    // Build gap midpoints: above first, between each pair, below last.
    var gaps = [];
    gaps.push({ y: ys[0] - 20, insertBefore: msgRelations[0] });
    for (var i = 0; i < ys.length - 1 && i < msgRelations.length - 1; i++) {
      gaps.push({ y: (ys[i] + ys[i + 1]) / 2, insertBefore: msgRelations[i + 1] });
    }
    gaps.push({ y: ys[ys.length - 1] + 20, insertAfter: msgRelations[msgRelations.length - 1] });
    // Pick the gap closest to cursorSvgY
    var best = gaps[0];
    var bestDist = Math.abs(cursorSvgY - gaps[0].y);
    for (var gi = 1; gi < gaps.length; gi++) {
      var d = Math.abs(cursorSvgY - gaps[gi].y);
      if (d < bestDist) { bestDist = d; best = gaps[gi]; }
    }
    if (best.insertAfter) {
      return { line: best.insertAfter.line, position: 'after' };
    }
    return { line: best.insertBefore.line, position: 'before' };
  }

  function deleteMessage(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function moveMessageUp(text, lineNum) {
    return window.MA.textUpdater.swapLines(text, lineNum, lineNum - 1);
  }

  function moveMessageDown(text, lineNum) {
    return window.MA.textUpdater.swapLines(text, lineNum, lineNum + 1);
  }

  function updateMessage(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    var arrow = null, arrowPos = -1;
    for (var ai = 0; ai < ARROW_TYPES.length; ai++) {
      var at = ARROW_TYPES[ai];
      var pos = trimmed.indexOf(at);
      if (pos > 0) { arrow = at; arrowPos = pos; break; }
    }
    if (!arrow) return text;
    var from = trimmed.slice(0, arrowPos).trim();
    var rest = trimmed.slice(arrowPos + arrow.length);
    var colonIdx = rest.indexOf(':');
    var to = colonIdx >= 0 ? rest.slice(0, colonIdx).trim() : rest.trim();
    var label = colonIdx >= 0 ? rest.slice(colonIdx + 1).trim() : '';

    if (field === 'from') from = value;
    else if (field === 'to') to = value;
    else if (field === 'arrow') arrow = value;
    else if (field === 'label') label = value;

    var indent = lines[idx].match(/^(\s*)/)[1];
    lines[idx] = indent + from + arrow + to + ': ' + label;
    return lines.join('\n');
  }

  // addBlock: wrap around selected line range, or add empty block at end
  function addBlock(text, kind, label) {
    kind = kind || 'loop';
    label = label || '';
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    var block = [
      '    ' + kind + (label ? ' ' + label : ''),
      '        ',
      '    end',
    ];
    lines.splice.apply(lines, [insertAt, 0].concat(block));
    return lines.join('\n');
  }

  function deleteBlock(text, startLine, endLine) {
    var lines = text.split('\n');
    lines.splice(startLine - 1, (endLine - startLine + 1));
    return lines.join('\n');
  }

  function addNote(text, position, targets, noteText) {
    position = position || 'over';
    noteText = noteText || '';
    var targetStr = Array.isArray(targets) ? targets.join(',') : targets;
    var newLine = '    note ' + position + ' ' + targetStr + ': ' + noteText;
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function toggleAutonumber(text) {
    var lines = text.split('\n');
    // Find existing autonumber line
    for (var i = 0; i < lines.length; i++) {
      if (/^\s*autonumber(\s|$)/.test(lines[i])) {
        // Remove
        lines.splice(i, 1);
        return lines.join('\n');
      }
    }
    // Add: insert after sequenceDiagram line
    for (var j = 0; j < lines.length; j++) {
      if (lines[j].trim() === 'sequenceDiagram') {
        lines.splice(j + 1, 0, '    autonumber');
        return lines.join('\n');
      }
    }
    return text;
  }

  function updateMetaTitle(text, newTitle) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim().indexOf('title ') === 0) {
        var indent = lines[i].match(/^(\s*)/)[1];
        lines[i] = indent + 'title ' + newTitle;
        return lines.join('\n');
      }
    }
    // Insert after sequenceDiagram
    for (var j = 0; j < lines.length; j++) {
      if (lines[j].trim() === 'sequenceDiagram') {
        lines.splice(j + 1, 0, '    title ' + newTitle);
        return lines.join('\n');
      }
    }
    return text;
  }

  // ── UI: buildOverlay ──
  // Pragmatic implementation: match SVG <text> elements by participant label,
  // create click-targets. Messages are harder to map to SVG paths without
  // detailed mermaid internals, so for v0.6.0 we use a simpler approach:
  // clicking anywhere on the preview loads no specific selection; editing is
  // done via property panel which lists all participants and messages.
  function buildOverlay(svgEl, parsedData, overlayEl) {
    if (!overlayEl) return;
    while (overlayEl.firstChild) overlayEl.removeChild(overlayEl.firstChild);
    if (!svgEl || !parsedData) return;

    // Copy viewBox + dimensions from SVG to overlay
    var viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) overlayEl.setAttribute('viewBox', viewBox);
    var svgW = svgEl.getAttribute('width');
    var svgH = svgEl.getAttribute('height');
    if (svgW) overlayEl.setAttribute('width', svgW);
    if (svgH) overlayEl.setAttribute('height', svgH);

    var NS = 'http://www.w3.org/2000/svg';

    // ── Step 1: label overlays (existing behaviour) ──
    // Map participants to their text labels in the SVG (by matching label text)
    var texts = svgEl.querySelectorAll('text');
    for (var ei = 0; ei < parsedData.elements.length; ei++) {
      var el = parsedData.elements[ei];
      if (el.kind !== 'participant' && el.kind !== 'actor') continue;
      // Find a text element whose content matches the label
      for (var ti = 0; ti < texts.length; ti++) {
        if (texts[ti].textContent.trim() === el.label) {
          try {
            var bb = texts[ti].getBBox();
            // Create a transparent clickable rect over the label area (expanded)
            var rect = document.createElementNS(NS, 'rect');
            rect.setAttribute('x', bb.x - 4);
            rect.setAttribute('y', bb.y - 4);
            rect.setAttribute('width', bb.width + 8);
            rect.setAttribute('height', bb.height + 8);
            rect.setAttribute('fill', 'transparent');
            rect.setAttribute('stroke', window.MA.selection.isSelected(el.id) ? '#7ee787' : 'none');
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('stroke-dasharray', '4');
            rect.setAttribute('cursor', 'pointer');
            rect.setAttribute('class', 'overlay-participant');
            rect.setAttribute('data-element-id', el.id);
            rect.setAttribute('data-element-kind', el.kind);
            rect.setAttribute('data-line', el.line);
            overlayEl.appendChild(rect);
          } catch (e) { /* skip */ }
          break;
        }
      }
    }

    // ── Step 2: full actor-box drag handles ──
    // Overlay an invisible rect on top of every Mermaid `rect.actor.actor-top`
    // and `.actor-bottom` so users can grab the entire actor header (not just
    // the small label) to select / drag-reorder. All rects carry the same
    // data-element-id; app.js dedups by id (not by x) when computing drop gaps
    // — see direct-manipulation-ux-checklist.md 観点 J.
    var participants = parsedData.elements
      .filter(function(e) { return e.kind === 'participant' || e.kind === 'actor'; })
      .sort(function(a, b) { return a.line - b.line; });
    var actorRects = svgEl.querySelectorAll('rect.actor.actor-top, rect.actor.actor-bottom');
    // Mermaid lays actors out left-to-right in DSL order. Collect unique x
    // positions (top & bottom share the same x per actor) to map back to DSL.
    var actorXGroups = {};  // xRounded -> [rect,...]
    Array.prototype.forEach.call(actorRects, function(r) {
      var x = parseFloat(r.getAttribute('x'));
      var key = Math.round(x);
      if (!actorXGroups[key]) actorXGroups[key] = [];
      actorXGroups[key].push(r);
    });
    var sortedXs = Object.keys(actorXGroups).map(Number).sort(function(a, b) { return a - b; });
    for (var xi = 0; xi < sortedXs.length && xi < participants.length; xi++) {
      var participant = participants[xi];
      var rects = actorXGroups[sortedXs[xi]];
      rects.forEach(function(actorRect) {
        try {
          var ax = parseFloat(actorRect.getAttribute('x'));
          var ay = parseFloat(actorRect.getAttribute('y'));
          var aw = parseFloat(actorRect.getAttribute('width'));
          var ah = parseFloat(actorRect.getAttribute('height'));
          var handle = document.createElementNS(NS, 'rect');
          handle.setAttribute('x', ax);
          handle.setAttribute('y', ay);
          handle.setAttribute('width', aw);
          handle.setAttribute('height', ah);
          handle.setAttribute('fill', 'transparent');
          handle.setAttribute('cursor', 'grab');
          handle.setAttribute('class', 'overlay-participant-handle');
          handle.setAttribute('data-element-id', participant.id);
          handle.setAttribute('data-element-kind', 'participant');
          handle.setAttribute('data-line', participant.line);
          overlayEl.appendChild(handle);
        } catch (e) { /* skip */ }
      });
    }
  }

  // ── UI: renderProps ──
  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var props = window.MA.properties;
    var fieldHtml = props.fieldHtml;
    var escHtml = window.MA.htmlUtils.escHtml;

    // No selection: show add forms + participant list + message list + title + autonumber
    if (!selData || selData.length === 0) {
      var participantsList = '';
      var messagesList = '';
      var participants = parsedData.elements.filter(function(e) { return e.kind === 'participant' || e.kind === 'actor'; });
      var messages = parsedData.relations.filter(function(r) { return r.kind === 'message'; });

      for (var pi = 0; pi < participants.length; pi++) {
        var p = participants[pi];
        participantsList += props.listItemHtml({
          label: p.label,
          sublabel: '(' + p.id + ')',
          selectClass: 'seq-select-participant',
          deleteClass: 'seq-delete-participant',
          dataElementId: p.id,
          dataLine: p.line,
        });
      }
      if (!participantsList) participantsList = props.emptyListHtml('（参加者なし）');

      for (var mi = 0; mi < messages.length; mi++) {
        var msg = messages[mi];
        messagesList += props.listItemHtml({
          label: msg.from + msg.arrow + msg.to + ': ' + msg.label,
          selectClass: 'seq-select-message',
          deleteClass: 'seq-delete-message',
          dataElementId: msg.id,
          dataLine: msg.line,
          mono: true,
        });
      }
      if (!messagesList) messagesList = props.emptyListHtml('（メッセージなし）');

      // Build participant select options for add-message form
      var participantOpts = '';
      for (var poi = 0; poi < participants.length; poi++) {
        participantOpts += '<option value="' + escHtml(participants[poi].id) + '">' + escHtml(participants[poi].label) + '</option>';
      }
      if (!participantOpts) participantOpts = '<option value="">（参加者を先に追加）</option>';

      var arrowOpts = '';
      var arrowLabels = { '->>': 'solid arrow (->> )', '-->>': 'dashed arrow (-->>)', '->': 'solid (->)' , '-->': 'dashed (-->)', '-x': 'cross (-x)', '--x': 'dashed cross (--x)', '-)': 'async (-))', '--)': 'dashed async (--))' };
      var arrows = ['->>','-->>','->','-->','-x','--x','-)','--)'];
      for (var aoi = 0; aoi < arrows.length; aoi++) {
        arrowOpts += '<option value="' + arrows[aoi] + '">' + escHtml(arrowLabels[arrows[aoi]]) + '</option>';
      }

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Sequence Diagram</div>' +

        // Title
        fieldHtml('タイトル', 'seq-title', parsedData.meta.title, 'タイトル') +

        // Autonumber toggle
        '<div style="margin-bottom:12px;">' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);cursor:pointer;">' +
            '<input id="seq-autonumber" type="checkbox" ' + (parsedData.meta.autonumber ? 'checked' : '') + '>' +
            ' autonumber (自動番号)' +
          '</label>' +
        '</div>' +

        // Add participant
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">参加者を追加</label>' +
          fieldHtml('ID', 'seq-add-part-id', '', 'C') +
          fieldHtml('ラベル', 'seq-add-part-label', '', 'Carol') +
          '<div style="display:flex;gap:4px;margin-bottom:8px;">' +
            '<select id="seq-add-part-kind" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
              '<option value="participant">participant</option>' +
              '<option value="actor">actor</option>' +
            '</select>' +
            '<button id="seq-add-part-btn" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+ 追加</button>' +
          '</div>' +
        '</div>' +

        // Add message — vertical layout with labeled From/Arrow/To
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">メッセージを追加</label>' +
          props.selectFieldHtml('From', 'seq-add-msg-from', participants.length === 0 ? [{value: '', label: '（参加者を先に追加）'}] : participants.map(function(p) { return { value: p.id, label: p.label }; })) +
          props.selectFieldHtml('Arrow', 'seq-add-msg-arrow', arrows.map(function(a) { return { value: a, label: a }; }), true) +
          props.selectFieldHtml('To', 'seq-add-msg-to', participants.length === 0 ? [{value: '', label: '（参加者を先に追加）'}] : participants.map(function(p) { return { value: p.id, label: p.label }; })) +
          fieldHtml('ラベル', 'seq-add-msg-label', '', 'Message') +
          props.primaryButtonHtml('seq-add-msg-btn', '+ メッセージ追加') +
        '</div>' +

        // Add block
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">ブロックを追加</label>' +
          '<div style="display:flex;gap:4px;margin-bottom:6px;">' +
            '<select id="seq-add-block-kind" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
              '<option value="loop">loop</option>' +
              '<option value="alt">alt</option>' +
              '<option value="opt">opt</option>' +
              '<option value="par">par</option>' +
            '</select>' +
            '<input id="seq-add-block-label" type="text" placeholder="label" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<button id="seq-add-block-btn" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+</button>' +
          '</div>' +
        '</div>' +

        // Participants list
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">参加者一覧</label>' +
          '<div id="seq-participants-list">' + participantsList + '</div>' +
        '</div>' +

        // Messages list
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">メッセージ一覧</label>' +
          '<div id="seq-messages-list">' + messagesList + '</div>' +
        '</div>';

      // Bindings
      var titleEl = document.getElementById('seq-title');
      if (titleEl) {
        titleEl.addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateMetaTitle(ctx.getMmdText(), titleEl.value));
          ctx.onUpdate();
        });
      }

      var anEl = document.getElementById('seq-autonumber');
      if (anEl) {
        anEl.addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(toggleAutonumber(ctx.getMmdText()));
          ctx.onUpdate();
        });
      }

      var addPartBtn = document.getElementById('seq-add-part-btn');
      if (addPartBtn) {
        addPartBtn.addEventListener('click', function() {
          var id = document.getElementById('seq-add-part-id').value.trim();
          var label = document.getElementById('seq-add-part-label').value.trim();
          var kind = document.getElementById('seq-add-part-kind').value;
          if (!id) { alert('IDは必須です'); return; }
          window.MA.history.pushHistory();
          ctx.setMmdText(addParticipant(ctx.getMmdText(), kind, id, label || id));
          ctx.onUpdate();
        });
      }

      var addMsgBtn = document.getElementById('seq-add-msg-btn');
      if (addMsgBtn) {
        addMsgBtn.addEventListener('click', function() {
          var from = document.getElementById('seq-add-msg-from').value;
          var to = document.getElementById('seq-add-msg-to').value;
          var arrow = document.getElementById('seq-add-msg-arrow').value;
          var label = document.getElementById('seq-add-msg-label').value.trim();
          if (!from || !to) { alert('参加者を先に追加してください'); return; }
          window.MA.history.pushHistory();
          ctx.setMmdText(addMessage(ctx.getMmdText(), from, to, arrow, label));
          ctx.onUpdate();
        });
      }

      var addBlockBtn = document.getElementById('seq-add-block-btn');
      if (addBlockBtn) {
        addBlockBtn.addEventListener('click', function() {
          var kind = document.getElementById('seq-add-block-kind').value;
          var label = document.getElementById('seq-add-block-label').value.trim();
          window.MA.history.pushHistory();
          ctx.setMmdText(addBlock(ctx.getMmdText(), kind, label));
          ctx.onUpdate();
        });
      }

      // Participant select/delete buttons
      props.bindSelectButtons(propsEl, 'seq-select-participant', 'participant');
      props.bindDeleteButtons(propsEl, 'seq-delete-participant', ctx, deleteParticipant);

      // Message select/delete buttons
      props.bindSelectButtons(propsEl, 'seq-select-message', 'message');
      props.bindDeleteButtons(propsEl, 'seq-delete-message', ctx, deleteMessage);
      return;
    }

    // Single selection
    if (selData.length === 1) {
      var selId = selData[0].id;
      var selType = selData[0].type;

      if (selType === 'participant') {
        var part = null;
        for (var pj = 0; pj < parsedData.elements.length; pj++) {
          if ((parsedData.elements[pj].kind === 'participant' || parsedData.elements[pj].kind === 'actor') && parsedData.elements[pj].id === selId) {
            part = parsedData.elements[pj]; break;
          }
        }
        if (!part) {
          propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">参加者が見つかりません</p>';
          return;
        }
        propsEl.innerHTML =
          props.panelHeaderHtml(part.label) +
          props.selectFieldHtml('種別', 'sel-part-kind', [
            { value: 'participant', label: 'participant', selected: part.kind === 'participant' },
            { value: 'actor', label: 'actor', selected: part.kind === 'actor' },
          ]) +
          fieldHtml('ID', 'sel-part-id', part.id) +
          fieldHtml('ラベル', 'sel-part-label', part.label) +
          props.dangerButtonHtml('sel-part-delete', '参加者削除');

        props.bindEvent('sel-part-kind', 'change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateParticipant(ctx.getMmdText(), part.line, 'kind', this.value));
          ctx.onUpdate();
        });
        props.bindEvent('sel-part-id', 'change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateParticipant(ctx.getMmdText(), part.line, 'id', this.value));
          ctx.onUpdate();
        });
        props.bindEvent('sel-part-label', 'change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateParticipant(ctx.getMmdText(), part.line, 'label', this.value));
          ctx.onUpdate();
        });
        props.bindEvent('sel-part-delete', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteParticipant(ctx.getMmdText(), part.line));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        });
        return;
      }

      if (selType === 'message') {
        var msg = null;
        for (var mj = 0; mj < parsedData.relations.length; mj++) {
          if (parsedData.relations[mj].id === selId) { msg = parsedData.relations[mj]; break; }
        }
        if (!msg) {
          propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">メッセージが見つかりません</p>';
          return;
        }
        var participants2 = parsedData.elements.filter(function(e) { return e.kind === 'participant' || e.kind === 'actor'; });
        var arrows2 = ['->>','-->>','->','-->','-x','--x','-)','--)'];
        var fromOptsArr = [], toOptsArr = [], arrowOptsArr = [];
        for (var poi2 = 0; poi2 < participants2.length; poi2++) {
          var pid = participants2[poi2].id;
          fromOptsArr.push({ value: pid, label: participants2[poi2].label, selected: pid === msg.from });
          toOptsArr.push({ value: pid, label: participants2[poi2].label, selected: pid === msg.to });
        }
        for (var ao2 = 0; ao2 < arrows2.length; ao2++) {
          arrowOptsArr.push({ value: arrows2[ao2], label: arrows2[ao2], selected: arrows2[ao2] === msg.arrow });
        }

        propsEl.innerHTML =
          props.panelHeaderHtml('Message') +
          props.selectFieldHtml('From', 'sel-msg-from', fromOptsArr) +
          props.selectFieldHtml('Arrow', 'sel-msg-arrow', arrowOptsArr, true) +
          props.selectFieldHtml('To', 'sel-msg-to', toOptsArr) +
          fieldHtml('ラベル', 'sel-msg-label', msg.label) +
          props.dangerButtonHtml('sel-msg-delete', 'メッセージ削除');

        props.bindEvent('sel-msg-from', 'change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateMessage(ctx.getMmdText(), msg.line, 'from', this.value));
          ctx.onUpdate();
        });
        props.bindEvent('sel-msg-arrow', 'change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateMessage(ctx.getMmdText(), msg.line, 'arrow', this.value));
          ctx.onUpdate();
        });
        props.bindEvent('sel-msg-to', 'change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateMessage(ctx.getMmdText(), msg.line, 'to', this.value));
          ctx.onUpdate();
        });
        props.bindEvent('sel-msg-label', 'change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateMessage(ctx.getMmdText(), msg.line, 'label', this.value));
          ctx.onUpdate();
        });
        props.bindEvent('sel-msg-delete', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteMessage(ctx.getMmdText(), msg.line));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        });
        return;
      }
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'sequenceDiagram',
    displayName: 'Sequence',
    detect: function(text) {
      return window.MA.parserUtils.detectDiagramType(text) === 'sequenceDiagram';
    },
    parse: parseSequence,
    template: function() {
      return [
        'sequenceDiagram',
        '    title プロトコルシーケンス',
        '    participant A as Client',
        '    participant B as Server',
        '    A->>B: Request',
        '    B-->>A: Response',
      ].join('\n');
    },
    operations: {
      add: function(text, kind, props) {
        if (kind === 'participant' || kind === 'actor') {
          return addParticipant(text, kind, props.id, props.label);
        }
        if (kind === 'message') {
          return addMessage(text, props.from, props.to, props.arrow, props.label);
        }
        if (kind === 'note') {
          return addNote(text, props.position, props.targets, props.text);
        }
        if (kind === 'loop' || kind === 'alt' || kind === 'opt' || kind === 'par') {
          return addBlock(text, kind, props.label);
        }
        return text;
      },
      delete: function(text, lineNum) {
        // Generic delete single line (works for participant, message, note)
        return window.MA.textUpdater.deleteLine(text, lineNum);
      },
      update: function(text, lineNum, field, value) {
        // Determine element kind by parsing the line
        var lines = text.split('\n');
        var trimmed = (lines[lineNum - 1] || '').trim();
        if (trimmed.indexOf('participant ') === 0 || trimmed.indexOf('actor ') === 0) {
          return updateParticipant(text, lineNum, field, value);
        }
        // Otherwise assume message (arrow-based)
        return updateMessage(text, lineNum, field, value);
      },
      moveUp: function(text, lineNum) {
        var p = parseSequence(text);
        // Try participant first
        for (var i = 0; i < p.elements.length; i++) {
          if ((p.elements[i].kind === 'participant' || p.elements[i].kind === 'actor') && p.elements[i].line === lineNum) {
            return moveParticipantUp(text, lineNum);
          }
        }
        // Fallback: swap with previous non-empty line
        if (lineNum <= 1) return text;
        return window.MA.textUpdater.swapLines(text, lineNum, lineNum - 1);
      },
      moveDown: function(text, lineNum) {
        var p = parseSequence(text);
        for (var i = 0; i < p.elements.length; i++) {
          if ((p.elements[i].kind === 'participant' || p.elements[i].kind === 'actor') && p.elements[i].line === lineNum) {
            return moveParticipantDown(text, lineNum);
          }
        }
        var totalLines = text.split('\n').length;
        if (lineNum >= totalLines) return text;
        return window.MA.textUpdater.swapLines(text, lineNum, lineNum + 1);
      },
      connect: function(text, fromId, toId, props) {
        props = props || {};
        return addMessage(text, fromId, toId, props.arrow, props.label);
      },
    },
    buildOverlay: buildOverlay,
    renderProps: renderProps,
    // Expose internals for testing
    parseSequence: parseSequence,
    addParticipant: addParticipant,
    deleteParticipant: deleteParticipant,
    moveParticipantUp: moveParticipantUp,
    moveParticipantDown: moveParticipantDown,
    moveParticipant: moveParticipant,
    insertMessageAt: insertMessageAt,
    resolveInsertLine: resolveInsertLine,
    updateParticipant: updateParticipant,
    addMessage: addMessage,
    deleteMessage: deleteMessage,
    moveMessageUp: moveMessageUp,
    moveMessageDown: moveMessageDown,
    updateMessage: updateMessage,
    addBlock: addBlock,
    deleteBlock: deleteBlock,
    addNote: addNote,
    toggleAutonumber: toggleAutonumber,
    updateMetaTitle: updateMetaTitle,
    ARROW_TYPES: ARROW_TYPES,
  };
})();
