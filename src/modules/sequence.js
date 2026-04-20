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
          id: '__note_' + lineNum,
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

  // _showInsertForm: open a modal form at #seq-modal for inserting a message
  // before/after a specific line. Ported from PlantUMLAssist so the hover-
  // insert click produces a structured form instead of 3 × prompt().
  //
  // ctx: { getMmdText, setMmdText, onUpdate } — same shape as PlantUMLAssist
  // line: 1-based line number anchor
  // position: 'before' | 'after'
  // kind: 'message' (note kind is PlantUML-specific; Mermaid note syntax is
  //       different and we keep message-only for now).
  function _showInsertForm(ctx, line, position, kind) {
    kind = kind || 'message';
    var modal = document.getElementById('seq-modal');
    var content = document.getElementById('seq-modal-content');
    if (!modal || !content) return;
    var P = window.MA.properties;
    var parsed = parseSequence(ctx.getMmdText());
    var participants = parsed.elements.filter(function(e) { return e.kind === 'participant' || e.kind === 'actor'; });
    var partOpts = participants.map(function(p) { return { value: p.id, label: p.label }; });
    if (partOpts.length === 0) partOpts = [{ value: '', label: '（参加者なし）' }];
    var partOptsWithNew = partOpts.slice();
    partOptsWithNew.push({ value: '__new__', label: '+ 新規追加…' });

    var title = (position === 'before' ? '前に' : '後に') + 'メッセージを挿入';
    var arrowOpts = ARROW_TYPES.map(function(a) { return { value: a, label: a, selected: a === '->>' }; });

    content.innerHTML =
      '<h3 style="margin:0 0 12px 0;font-size:13px;">' + title + '</h3>' +
      P.selectFieldHtml('From', 'seq-mod-from', partOptsWithNew) +
      P.selectFieldHtml('Arrow', 'seq-mod-arrow', arrowOpts, true) +
      P.selectFieldHtml('To', 'seq-mod-to', partOptsWithNew) +
      P.fieldHtml('本文', 'seq-mod-label', '', 'Message') +
      '<div id="seq-mod-new-inline" style="display:none;margin-top:6px;padding:8px;background:var(--bg-tertiary);border-left:3px solid var(--accent);border-radius:3px;">' +
        '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;">新しい参加者を作成</label>' +
        '<input id="seq-mod-new-id" type="text" placeholder="ID (必須)" style="width:100%;background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);padding:4px 6px;border-radius:3px;font-size:12px;margin-bottom:4px;box-sizing:border-box;">' +
        '<input id="seq-mod-new-label" type="text" placeholder="ラベル (任意)" style="width:100%;background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);padding:4px 6px;border-radius:3px;font-size:12px;margin-bottom:4px;box-sizing:border-box;">' +
        '<select id="seq-mod-new-kind" style="width:100%;background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);padding:4px 6px;border-radius:3px;font-size:12px;box-sizing:border-box;">' +
          '<option value="participant">participant</option>' +
          '<option value="actor">actor</option>' +
        '</select>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px;">' +
        '<button id="seq-mod-cancel" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:8px;border-radius:4px;cursor:pointer;">キャンセル</button>' +
        '<button id="seq-mod-confirm" style="flex:1;background:var(--accent);border:none;color:#fff;padding:8px;border-radius:4px;cursor:pointer;">確定</button>' +
      '</div>';
    modal.style.display = 'flex';

    // Inline "new participant" toggle
    var inlineEl = document.getElementById('seq-mod-new-inline');
    function maybeShowInline() {
      var fr = document.getElementById('seq-mod-from');
      var to = document.getElementById('seq-mod-to');
      if (!fr || !to || !inlineEl) return;
      inlineEl.style.display = (fr.value === '__new__' || to.value === '__new__') ? 'block' : 'none';
    }
    var frEl = document.getElementById('seq-mod-from');
    var toEl = document.getElementById('seq-mod-to');
    if (frEl) frEl.addEventListener('change', maybeShowInline);
    if (toEl) toEl.addEventListener('change', maybeShowInline);

    function closeModal() { modal.style.display = 'none'; }
    document.getElementById('seq-mod-cancel').addEventListener('click', closeModal);

    document.getElementById('seq-mod-confirm').addEventListener('click', function() {
      var t = ctx.getMmdText();
      var fr = document.getElementById('seq-mod-from').value;
      var to = document.getElementById('seq-mod-to').value;
      var arrow = document.getElementById('seq-mod-arrow').value || '->>';
      var label = document.getElementById('seq-mod-label').value || '';
      if (fr === '__new__' || to === '__new__') {
        var newId = document.getElementById('seq-mod-new-id').value.trim();
        if (!newId) { alert('新しい参加者の ID は必須です'); return; }
        var newLabel = document.getElementById('seq-mod-new-label').value.trim() || newId;
        var newKind = document.getElementById('seq-mod-new-kind').value;
        window.MA.history.pushHistory();
        t = addParticipant(t, newKind, newId, newLabel);
        if (fr === '__new__') fr = newId;
        if (to === '__new__') to = newId;
      } else {
        window.MA.history.pushHistory();
      }
      t = insertMessageAt(t, line, position, fr, to, arrow, label);
      ctx.setMmdText(t);
      closeModal();
      if (ctx.onUpdate) ctx.onUpdate();
    });
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

    // ── Step 3: group (loop/alt/opt/par) overlays ──
    // Mermaid renders each block frame as 4 consecutive `<line class="loopLine">`
    // elements (top / right / bottom / left). Chunk them by 4 to recover the
    // bbox, then pair with parsedData.groups in DSL order (buildOverlay gets
    // them in source order so a simple zip works).
    var loopLines = Array.prototype.slice.call(svgEl.querySelectorAll('line.loopLine'));
    var groupData = parsedData.groups || [];
    for (var gi = 0; gi + 3 < loopLines.length && Math.floor(gi / 4) < groupData.length; gi += 4) {
      var l0 = loopLines[gi], l1 = loopLines[gi + 1], l2 = loopLines[gi + 2], l3 = loopLines[gi + 3];
      var xs = [l0, l1, l2, l3].map(function(l) {
        return [parseFloat(l.getAttribute('x1')), parseFloat(l.getAttribute('x2'))];
      }).reduce(function(a, b) { return a.concat(b); }, []);
      var ys = [l0, l1, l2, l3].map(function(l) {
        return [parseFloat(l.getAttribute('y1')), parseFloat(l.getAttribute('y2'))];
      }).reduce(function(a, b) { return a.concat(b); }, []);
      var gx = Math.min.apply(null, xs), gy = Math.min.apply(null, ys);
      var gw = Math.max.apply(null, xs) - gx;
      var gh = Math.max.apply(null, ys) - gy;
      if (isNaN(gx) || isNaN(gy) || gw <= 0 || gh <= 0) continue;
      var grp = groupData[Math.floor(gi / 4)];
      // Clickable rect only along the top band so it does not swallow clicks
      // on nested messages. Top bar is ~20px tall matching Mermaid's label bar.
      var grect = document.createElementNS(NS, 'rect');
      grect.setAttribute('x', gx);
      grect.setAttribute('y', gy);
      grect.setAttribute('width', gw);
      grect.setAttribute('height', 20);
      grect.setAttribute('fill', 'transparent');
      grect.setAttribute('cursor', 'pointer');
      grect.setAttribute('class', 'overlay-group');
      grect.setAttribute('data-element-id', grp.id);
      grect.setAttribute('data-element-kind', 'group');
      grect.setAttribute('data-line', grp.line);
      grect.setAttribute('data-end-line', grp.endLine);
      overlayEl.appendChild(grect);
    }

    // ── Step 3.5: note overlays ──
    // Mermaid renders notes as `<rect class="note">` + `<text class="noteText">`.
    // Notes appear in DSL order so zip with parsedData.elements filtered to kind='note'.
    var noteRects = Array.prototype.slice.call(svgEl.querySelectorAll('rect.note'));
    var noteData = (parsedData.elements || []).filter(function(e) { return e.kind === 'note'; });
    for (var ni = 0; ni < noteRects.length && ni < noteData.length; ni++) {
      try {
        var nr = noteRects[ni];
        var note = noteData[ni];
        var nrect = document.createElementNS(NS, 'rect');
        nrect.setAttribute('x', nr.getAttribute('x'));
        nrect.setAttribute('y', nr.getAttribute('y'));
        nrect.setAttribute('width', nr.getAttribute('width'));
        nrect.setAttribute('height', nr.getAttribute('height'));
        nrect.setAttribute('fill', 'transparent');
        nrect.setAttribute('cursor', 'pointer');
        nrect.setAttribute('class', 'overlay-note');
        nrect.setAttribute('data-element-id', note.id || ('__note_' + ni));
        nrect.setAttribute('data-element-kind', 'note');
        nrect.setAttribute('data-line', note.line);
        overlayEl.appendChild(nrect);
      } catch (e) { /* skip */ }
    }

    // ── Step 4: message overlays ──
    // Cross-apply of PlantUMLAssist B3 (label-less message selectable): we
    // build one rect per visible message line (line.messageLine0/1) so the
    // arrow itself becomes clickable even when the message has no label.
    // The messages in the SVG appear in DSL order (same as parsedData.relations
    // filtered to kind==='message'), so we zip them together by sorted y.
    var msgRelations = (parsedData.relations || []).filter(function(r) { return r.kind === 'message'; });
    var msgLineEls = Array.prototype.slice.call(svgEl.querySelectorAll('line.messageLine0, line.messageLine1'));
    // Pair by ordinal. Mermaid renders in DSL order so simple zip works.
    msgLineEls.sort(function(a, b) {
      return parseFloat(a.getAttribute('y1') || 0) - parseFloat(b.getAttribute('y1') || 0);
    });
    for (var mi = 0; mi < msgLineEls.length && mi < msgRelations.length; mi++) {
      var mLine = msgLineEls[mi];
      var rel = msgRelations[mi];
      try {
        var x1 = parseFloat(mLine.getAttribute('x1'));
        var x2 = parseFloat(mLine.getAttribute('x2'));
        var yy = parseFloat(mLine.getAttribute('y1'));
        if (isNaN(x1) || isNaN(x2) || isNaN(yy)) continue;
        // Clickable band: ±10px vertical hit-box around the arrow line.
        var mx = Math.min(x1, x2);
        var mw = Math.abs(x2 - x1);
        var mrect = document.createElementNS(NS, 'rect');
        mrect.setAttribute('x', mx);
        mrect.setAttribute('y', yy - 10);
        mrect.setAttribute('width', mw || 20);
        mrect.setAttribute('height', 20);
        mrect.setAttribute('fill', 'transparent');
        mrect.setAttribute('cursor', 'pointer');
        mrect.setAttribute('class', 'overlay-message');
        mrect.setAttribute('data-element-id', rel.id);
        mrect.setAttribute('data-element-kind', 'message');
        mrect.setAttribute('data-line', rel.line);
        overlayEl.appendChild(mrect);
      } catch (e) { /* skip */ }
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
        // Participant action bar ported from PlantUMLAssist: provides
        // "move left / right" reorder buttons + delete. Mirrors the
        // PlantUML props panel layout for cross-tool consistency.
        propsEl.innerHTML =
          props.panelHeaderHtml(part.label) +
          props.selectFieldHtml('種別', 'sel-part-kind', [
            { value: 'participant', label: 'participant', selected: part.kind === 'participant' },
            { value: 'actor', label: 'actor', selected: part.kind === 'actor' },
          ]) +
          fieldHtml('ID', 'sel-part-id', part.id) +
          fieldHtml('ラベル', 'sel-part-label', part.label) +
          '<div style="display:flex;gap:4px;margin:8px 0;">' +
            '<button id="sel-part-left" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;">← 左へ</button>' +
            '<button id="sel-part-right" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;">右へ →</button>' +
          '</div>' +
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
        props.bindEvent('sel-part-left', 'click', function() {
          var newText = moveParticipantUp(ctx.getMmdText(), part.line);
          if (newText === ctx.getMmdText()) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(newText);
          ctx.onUpdate();
        });
        props.bindEvent('sel-part-right', 'click', function() {
          var newText = moveParticipantDown(ctx.getMmdText(), part.line);
          if (newText === ctx.getMmdText()) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(newText);
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

        // Message action bar ported from PlantUMLAssist: direct insertion-anchor
        // buttons invoke the modal insert form at the selected line, matching
        // PlantUML's "↑この前に / ↓この後に" pattern. Also "↑上へ / ↓下へ" for
        // quick reordering within the DSL.
        propsEl.innerHTML =
          props.panelHeaderHtml('Message') +
          props.selectFieldHtml('From', 'sel-msg-from', fromOptsArr) +
          props.selectFieldHtml('Arrow', 'sel-msg-arrow', arrowOptsArr, true) +
          props.selectFieldHtml('To', 'sel-msg-to', toOptsArr) +
          fieldHtml('ラベル', 'sel-msg-label', msg.label) +
          '<div style="display:flex;gap:4px;margin:8px 0 4px 0;">' +
            '<button id="sel-msg-insert-before" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;">↑ この前に挿入</button>' +
            '<button id="sel-msg-insert-after" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;">↓ この後に挿入</button>' +
          '</div>' +
          '<div style="display:flex;gap:4px;margin:4px 0;">' +
            '<button id="sel-msg-up" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;">↑ 上へ</button>' +
            '<button id="sel-msg-down" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;">↓ 下へ</button>' +
          '</div>' +
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
        props.bindEvent('sel-msg-insert-before', 'click', function() {
          _showInsertForm(ctx, msg.line, 'before', 'message');
        });
        props.bindEvent('sel-msg-insert-after', 'click', function() {
          _showInsertForm(ctx, msg.line, 'after', 'message');
        });
        props.bindEvent('sel-msg-up', 'click', function() {
          var newText = moveMessageUp(ctx.getMmdText(), msg.line);
          if (newText === ctx.getMmdText()) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(newText);
          ctx.onUpdate();
        });
        props.bindEvent('sel-msg-down', 'click', function() {
          var newText = moveMessageDown(ctx.getMmdText(), msg.line);
          if (newText === ctx.getMmdText()) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(newText);
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

      if (selType === 'note') {
        var note = null;
        for (var nj = 0; nj < parsedData.elements.length; nj++) {
          if (parsedData.elements[nj].kind === 'note' && parsedData.elements[nj].id === selId) {
            note = parsedData.elements[nj]; break;
          }
        }
        if (!note) {
          propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">注釈が見つかりません</p>';
          return;
        }
        var partList = parsedData.elements.filter(function(e) { return e.kind === 'participant' || e.kind === 'actor'; });
        var posOptsN = [
          { value: 'left of', label: 'left of', selected: note.position === 'left of' },
          { value: 'right of', label: 'right of', selected: note.position === 'right of' },
          { value: 'over', label: 'over', selected: note.position === 'over' },
        ];
        var targetOptsN = partList.map(function(p) {
          return { value: p.id, label: p.label, selected: note.targets && note.targets[0] === p.id };
        });
        propsEl.innerHTML =
          props.panelHeaderHtml('Note') +
          props.selectFieldHtml('Position', 'sel-note-pos', posOptsN) +
          props.selectFieldHtml('Target', 'sel-note-target', targetOptsN) +
          fieldHtml('本文', 'sel-note-text', note.text) +
          '<div style="display:flex;gap:4px;margin:8px 0 4px 0;">' +
            '<button id="sel-note-insert-before" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;">↑ この前に挿入</button>' +
            '<button id="sel-note-insert-after" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;">↓ この後に挿入</button>' +
          '</div>' +
          props.dangerButtonHtml('sel-note-delete', '注釈削除');

        function rewriteNoteLine(newPos, newTarget, newText) {
          var text = ctx.getMmdText();
          var lines = text.split('\n');
          var idx0 = note.line - 1;
          if (idx0 < 0 || idx0 >= lines.length) return;
          var indent = (lines[idx0].match(/^(\s*)/) || ['',''])[1];
          lines[idx0] = indent + 'Note ' + newPos + ' ' + newTarget + (newText ? ': ' + newText : '');
          window.MA.history.pushHistory();
          ctx.setMmdText(lines.join('\n'));
          ctx.onUpdate();
        }
        props.bindEvent('sel-note-pos', 'change', function() {
          rewriteNoteLine(this.value, document.getElementById('sel-note-target').value, document.getElementById('sel-note-text').value);
        });
        props.bindEvent('sel-note-target', 'change', function() {
          rewriteNoteLine(document.getElementById('sel-note-pos').value, this.value, document.getElementById('sel-note-text').value);
        });
        props.bindEvent('sel-note-text', 'change', function() {
          rewriteNoteLine(document.getElementById('sel-note-pos').value, document.getElementById('sel-note-target').value, this.value);
        });
        props.bindEvent('sel-note-insert-before', 'click', function() {
          _showInsertForm(ctx, note.line, 'before', 'message');
        });
        props.bindEvent('sel-note-insert-after', 'click', function() {
          _showInsertForm(ctx, note.line, 'after', 'message');
        });
        props.bindEvent('sel-note-delete', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(window.MA.textUpdater.deleteLine(ctx.getMmdText(), note.line));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        });
        return;
      }

      if (selType === 'group') {
        // Group block selection — ported from PlantUMLAssist. Mermaid blocks
        // (loop/alt/opt/par) are detected in parsedData.groups. Offer label
        // edit + delete + "+ else 行を追加" (alt only).
        var grp = null;
        for (var gj = 0; gj < (parsedData.groups || []).length; gj++) {
          if (parsedData.groups[gj].id === selId) { grp = parsedData.groups[gj]; break; }
        }
        if (!grp) {
          propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">ブロックが見つかりません</p>';
          return;
        }
        var isAlt = grp.kind === 'alt';
        propsEl.innerHTML =
          props.panelHeaderHtml(grp.kind) +
          fieldHtml('ラベル', 'sel-grp-label', grp.label || '') +
          (isAlt ? '<button id="sel-grp-add-else" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;margin-bottom:6px;">+ else 行を追加</button>' : '') +
          props.dangerButtonHtml('sel-grp-delete', 'ブロック削除 (中身は保持)');

        props.bindEvent('sel-grp-label', 'change', function() {
          var text = ctx.getMmdText();
          var lines = text.split('\n');
          var idx0 = grp.line - 1;
          if (idx0 < 0 || idx0 >= lines.length) return;
          var indent = (lines[idx0].match(/^(\s*)/) || ['',''])[1];
          var newLabel = this.value;
          lines[idx0] = indent + grp.kind + (newLabel ? ' ' + newLabel : '');
          window.MA.history.pushHistory();
          ctx.setMmdText(lines.join('\n'));
          ctx.onUpdate();
        });
        if (isAlt) {
          props.bindEvent('sel-grp-add-else', 'click', function() {
            var cond = prompt('else 条件 (空欄可):', '') || '';
            var text = ctx.getMmdText();
            var lines = text.split('\n');
            var endIdx0 = (grp.endLine || grp.line) - 1;
            if (endIdx0 < 0 || endIdx0 >= lines.length) return;
            var indent = (lines[endIdx0].match(/^(\s*)/) || ['',''])[1];
            lines.splice(endIdx0, 0, indent + 'else' + (cond ? ' ' + cond : ''));
            window.MA.history.pushHistory();
            ctx.setMmdText(lines.join('\n'));
            ctx.onUpdate();
          });
        }
        props.bindEvent('sel-grp-delete', 'click', function() {
          // Remove the opening and matching end lines, keep inner content.
          var text = ctx.getMmdText();
          var lines = text.split('\n');
          window.MA.history.pushHistory();
          if (grp.endLine && grp.endLine > grp.line) lines.splice(grp.endLine - 1, 1);
          lines.splice(grp.line - 1, 1);
          ctx.setMmdText(lines.join('\n'));
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
    showInsertForm: function(ctx, line, position, kind) {
      _showInsertForm(ctx, line, position, kind);
    },
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
