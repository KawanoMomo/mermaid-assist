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
    // Expose internals for testing
    parseSequence: parseSequence,
    addParticipant: addParticipant,
    deleteParticipant: deleteParticipant,
    moveParticipantUp: moveParticipantUp,
    moveParticipantDown: moveParticipantDown,
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
