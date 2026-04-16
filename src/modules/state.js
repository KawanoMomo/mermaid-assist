'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.state = (function() {
  // State diagram transition syntax: "A --> B : event" or "A --> B"
  function parseState(text) {
    var result = {
      meta: { version: 'v2' },
      elements: [],   // states (including start/end pseudo and fork/join/choice)
      relations: [],  // transitions
      groups: [],     // composite states
    };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var transCounter = 0;
    var compositeStack = [];
    var stateMap = {}; // id -> state element

    // Header
    for (var hi = 0; hi < lines.length; hi++) {
      var ht = lines[hi].trim();
      if (!ht || ht.indexOf('%%') === 0) continue;
      if (/^stateDiagram(-v2)?/.test(ht)) break;
      break;
    }

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^stateDiagram/.test(trimmed)) continue;

      // End of composite
      if (trimmed === '}') {
        if (compositeStack.length > 0) {
          var closingId = compositeStack.pop();
          for (var gi = result.groups.length - 1; gi >= 0; gi--) {
            if (result.groups[gi].id === closingId) {
              result.groups[gi].endLine = lineNum; break;
            }
          }
        }
        continue;
      }

      // Composite state start: state "Label" as Id {  OR  state Id {
      var compMatch = trimmed.match(/^state\s+(?:"([^"]+)"\s+as\s+)?(\S+)\s*\{\s*$/);
      if (compMatch) {
        var id = compMatch[2];
        var label = compMatch[1] || id;
        var grp = {
          kind: 'composite',
          id: id,
          label: label,
          line: lineNum,
          endLine: -1,
          parentId: compositeStack.length > 0 ? compositeStack[compositeStack.length - 1] : null,
        };
        result.groups.push(grp);
        // Also add as a state element
        if (!stateMap[id]) {
          var se = { kind: 'state', id: id, label: label, type: 'composite', line: lineNum };
          result.elements.push(se);
          stateMap[id] = se;
        }
        compositeStack.push(id);
        continue;
      }

      // State type: state Name <<fork>>  or  state Name <<join>>  or  state Name <<choice>>
      var specialMatch = trimmed.match(/^state\s+(\S+)\s+<<(fork|join|choice)>>/);
      if (specialMatch) {
        var sid = specialMatch[1];
        if (!stateMap[sid]) {
          var sel = { kind: 'state', id: sid, label: sid, type: specialMatch[2], line: lineNum };
          result.elements.push(sel);
          stateMap[sid] = sel;
        }
        continue;
      }

      // State alias: state "Label" as Id
      var aliasMatch = trimmed.match(/^state\s+"([^"]+)"\s+as\s+(\S+)\s*$/);
      if (aliasMatch) {
        var aid = aliasMatch[2];
        if (!stateMap[aid]) {
          var sea = { kind: 'state', id: aid, label: aliasMatch[1], type: 'simple', line: lineNum };
          result.elements.push(sea);
          stateMap[aid] = sea;
        }
        continue;
      }

      // Simple state declaration: state Id
      var stateDeclMatch = trimmed.match(/^state\s+(\S+)\s*$/);
      if (stateDeclMatch) {
        var stid = stateDeclMatch[1];
        if (!stateMap[stid]) {
          var sed = { kind: 'state', id: stid, label: stid, type: 'simple', line: lineNum };
          result.elements.push(sed);
          stateMap[stid] = sed;
        }
        continue;
      }

      // Note
      var noteMatch = trimmed.match(/^note\s+(left of|right of|above|below)\s+(\S+)\s*:\s*(.*)$/);
      if (noteMatch) {
        result.elements.push({
          kind: 'note',
          position: noteMatch[1],
          target: noteMatch[2],
          text: noteMatch[3],
          line: lineNum,
        });
        continue;
      }

      // Transition: From --> To : event  or  From --> To
      var tMatch = trimmed.match(/^(\S+|\[\*\])\s+-->\s+(\S+|\[\*\])(?:\s*:\s*(.*))?$/);
      if (tMatch) {
        var from = tMatch[1];
        var to = tMatch[2];
        var event = tMatch[3] || '';

        // Register states (if not [*] which is pseudo)
        function ensureState(stId, lineN) {
          if (stId === '[*]') return;
          if (!stateMap[stId]) {
            var newSt = { kind: 'state', id: stId, label: stId, type: 'simple', line: lineN };
            result.elements.push(newSt);
            stateMap[stId] = newSt;
          }
        }
        ensureState(from, lineNum);
        ensureState(to, lineNum);

        result.relations.push({
          kind: 'transition',
          id: '__tr_' + (transCounter++),
          from: from,
          to: to,
          label: event,
          line: lineNum,
          parentId: compositeStack.length > 0 ? compositeStack[compositeStack.length - 1] : null,
        });
        continue;
      }
    }

    return result;
  }

  // ── Updaters ──

  function addState(text, id, label, type) {
    type = type || 'simple';
    var newLine;
    if (type === 'fork' || type === 'join' || type === 'choice') {
      newLine = '    state ' + id + ' <<' + type + '>>';
    } else if (type === 'simple' && label && label !== id) {
      newLine = '    state "' + label + '" as ' + id;
    } else {
      newLine = '    state ' + id;
    }
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function deleteState(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updateStateLabel(text, lineNum, newLabel) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    var indent = lines[idx].match(/^(\s*)/)[1];

    var aliasMatch = trimmed.match(/^state\s+"([^"]+)"\s+as\s+(\S+)\s*$/);
    if (aliasMatch) {
      lines[idx] = indent + 'state "' + newLabel + '" as ' + aliasMatch[2];
      return lines.join('\n');
    }
    var simpleMatch = trimmed.match(/^state\s+(\S+)\s*$/);
    if (simpleMatch) {
      // Need to convert to aliased form
      lines[idx] = indent + 'state "' + newLabel + '" as ' + simpleMatch[1];
      return lines.join('\n');
    }
    return text;
  }

  function addTransition(text, from, to, event) {
    var newLine = '    ' + from + ' --> ' + to + (event ? ' : ' + event : '');
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function deleteTransition(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updateTransition(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = trimmed.match(/^(\S+|\[\*\])\s+-->\s+(\S+|\[\*\])(?:\s*:\s*(.*))?$/);
    if (!m) return text;
    var from = m[1], to = m[2], event = m[3] || '';
    if (field === 'from') from = value;
    else if (field === 'to') to = value;
    else if (field === 'label' || field === 'event') event = value;
    lines[idx] = indent + from + ' --> ' + to + (event ? ' : ' + event : '');
    return lines.join('\n');
  }

  function addComposite(text, id, label) {
    var block = [
      '    state "' + (label || id) + '" as ' + id + ' {',
      '        ',
      '    }',
    ];
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice.apply(lines, [insertAt, 0].concat(block));
    return lines.join('\n');
  }

  function deleteComposite(text, startLine, endLine) {
    var lines = text.split('\n');
    lines.splice(startLine - 1, (endLine - startLine + 1));
    return lines.join('\n');
  }

  function addNote(text, position, target, noteText) {
    position = position || 'left of';
    var newLine = '    note ' + position + ' ' + target + ' : ' + (noteText || '');
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  // ── UI ──
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

    // Minimal overlay: no clickable highlight for now (property panel is primary UI)
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var fieldHtml = P.fieldHtml;
    var bindEvent = P.bindEvent;

    if (!selData || selData.length === 0) {
      var states = parsedData.elements.filter(function(e) { return e.kind === 'state'; });
      var transitions = parsedData.relations.filter(function(r) { return r.kind === 'transition'; });
      var composites = parsedData.groups.filter(function(g) { return g.kind === 'composite'; });

      var stateOpts = '<option value="[*]">[*] (start/end)</option>';
      for (var si = 0; si < states.length; si++) stateOpts += '<option value="' + escHtml(states[si].id) + '">' + escHtml(states[si].label) + '</option>';

      var typeOpts = '';
      var types = ['simple', 'fork', 'join', 'choice'];
      for (var ti = 0; ti < types.length; ti++) typeOpts += '<option value="' + types[ti] + '">' + types[ti] + '</option>';

      var statesList = '';
      for (var lsi = 0; lsi < states.length; lsi++) {
        var s = states[lsi];
        statesList += P.listItemHtml({ label: s.label, sublabel: '(' + s.id + ', ' + (s.type || 'simple') + ')', selectClass: 'st-select-state', deleteClass: 'st-delete-state', dataElementId: s.id, dataLine: s.line });
      }
      if (!statesList) statesList = P.emptyListHtml('（状態なし）');

      var transList = '';
      for (var lti = 0; lti < transitions.length; lti++) {
        var tr = transitions[lti];
        transList += P.listItemHtml({ label: tr.from + ' → ' + tr.to + (tr.label ? ' : ' + tr.label : ''), selectClass: 'st-select-trans', deleteClass: 'st-delete-trans', dataElementId: tr.id, dataLine: tr.line, mono: true });
      }
      if (!transList) transList = P.emptyListHtml('（遷移なし）');

      var compList = '';
      for (var lci = 0; lci < composites.length; lci++) {
        var c = composites[lci];
        compList += P.listItemHtml({ label: c.label, deleteClass: 'st-delete-comp', dataLine: c.line, dataEndLine: c.endLine });
      }
      if (!compList) compList = P.emptyListHtml('（なし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">State Diagram</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">状態を追加</label>' +
          fieldHtml('ID', 'st-add-state-id', '', 'Running') +
          fieldHtml('ラベル', 'st-add-state-label', '', 'Running State') +
          '<div style="display:flex;gap:4px;margin-bottom:8px;">' +
            '<select id="st-add-state-type" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' + typeOpts + '</select>' +
            '<button id="st-add-state-btn" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+</button>' +
          '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">遷移を追加</label>' +
          P.selectFieldHtml('From', 'st-add-tr-from', [{value: '[*]', label: '[*] (start/end)'}].concat(states.map(function(s) { return { value: s.id, label: s.label }; }))) +
          P.selectFieldHtml('To', 'st-add-tr-to', [{value: '[*]', label: '[*] (start/end)'}].concat(states.map(function(s) { return { value: s.id, label: s.label }; }))) +
          fieldHtml('イベント', 'st-add-tr-event', '', 'click') +
          P.primaryButtonHtml('st-add-tr-btn', '+ 遷移追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">複合状態を追加</label>' +
          '<div style="display:flex;gap:4px;">' +
            '<input id="st-add-comp-id" type="text" placeholder="ID" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<input id="st-add-comp-label" type="text" placeholder="label" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<button id="st-add-comp-btn" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+</button>' +
          '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">状態一覧</label>' +
          '<div>' + statesList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">遷移一覧</label>' +
          '<div>' + transList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">複合状態一覧</label>' +
          '<div>' + compList + '</div>' +
        '</div>';

      bindEvent('st-add-state-btn', 'click', function() {
        var id = document.getElementById('st-add-state-id').value.trim();
        var label = document.getElementById('st-add-state-label').value.trim();
        var type = document.getElementById('st-add-state-type').value;
        if (!id) { alert('IDは必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addState(ctx.getMmdText(), id, label || id, type));
        ctx.onUpdate();
      });
      bindEvent('st-add-tr-btn', 'click', function() {
        var from = document.getElementById('st-add-tr-from').value;
        var to = document.getElementById('st-add-tr-to').value;
        var event = document.getElementById('st-add-tr-event').value.trim();
        if (!from || !to) { alert('状態を先に選択してください'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addTransition(ctx.getMmdText(), from, to, event));
        ctx.onUpdate();
      });
      bindEvent('st-add-comp-btn', 'click', function() {
        var id = document.getElementById('st-add-comp-id').value.trim();
        var label = document.getElementById('st-add-comp-label').value.trim();
        if (!id) { alert('IDは必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addComposite(ctx.getMmdText(), id, label));
        ctx.onUpdate();
      });
      P.bindSelectButtons(propsEl, 'st-select-state', 'state');
      P.bindSelectButtons(propsEl, 'st-select-trans', 'transition');
      P.bindDeleteButtons(propsEl, 'st-delete-state', ctx, deleteState);
      P.bindDeleteButtons(propsEl, 'st-delete-trans', ctx, deleteTransition);
      P.bindDeleteButtons(propsEl, 'st-delete-comp', ctx, deleteComposite, true);
      return;
    }

    // Single state selected
    if (selData.length === 1 && selData[0].type === 'state') {
      var sid = selData[0].id;
      var st = null;
      for (var pj = 0; pj < parsedData.elements.length; pj++) {
        if (parsedData.elements[pj].kind === 'state' && parsedData.elements[pj].id === sid) { st = parsedData.elements[pj]; break; }
      }
      if (!st) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">状態が見つかりません</p>'; return; }
      propsEl.innerHTML =
        P.panelHeaderHtml(st.label) +
        fieldHtml('ID', 'sel-state-id', st.id) +
        fieldHtml('ラベル', 'sel-state-label', st.label) +
        '<div style="margin-bottom:8px;color:var(--text-secondary);font-size:11px;">種別: ' + escHtml(st.type || 'simple') + '</div>' +
        P.dangerButtonHtml('sel-state-delete', '状態削除');

      document.getElementById('sel-state-label').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateStateLabel(ctx.getMmdText(), st.line, this.value));
        ctx.onUpdate();
      });
      document.getElementById('sel-state-delete').addEventListener('click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(deleteState(ctx.getMmdText(), st.line));
        window.MA.selection.clearSelection();
        ctx.onUpdate();
      });
      return;
    }

    // Single transition selected
    if (selData.length === 1 && selData[0].type === 'transition') {
      var tid = selData[0].id;
      var tr = null;
      for (var tj = 0; tj < parsedData.relations.length; tj++) {
        if (parsedData.relations[tj].id === tid) { tr = parsedData.relations[tj]; break; }
      }
      if (!tr) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">遷移が見つかりません</p>'; return; }
      var states2 = parsedData.elements.filter(function(e) { return e.kind === 'state'; });
      var fromOpts = '<option value="[*]"' + (tr.from === '[*]' ? ' selected' : '') + '>[*]</option>';
      var toOpts = '<option value="[*]"' + (tr.to === '[*]' ? ' selected' : '') + '>[*]</option>';
      for (var so = 0; so < states2.length; so++) {
        var sid2 = states2[so].id;
        fromOpts += '<option value="' + escHtml(sid2) + '"' + (sid2 === tr.from ? ' selected' : '') + '>' + escHtml(states2[so].label) + '</option>';
        toOpts += '<option value="' + escHtml(sid2) + '"' + (sid2 === tr.to ? ' selected' : '') + '>' + escHtml(states2[so].label) + '</option>';
      }
      propsEl.innerHTML =
        P.panelHeaderHtml('Transition') +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">From</label><select id="sel-tr-from" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + fromOpts + '</select></div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">To</label><select id="sel-tr-to" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + toOpts + '</select></div>' +
        fieldHtml('イベント', 'sel-tr-event', tr.label) +
        P.dangerButtonHtml('sel-tr-delete', '遷移削除');

      document.getElementById('sel-tr-from').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateTransition(ctx.getMmdText(), tr.line, 'from', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-tr-to').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateTransition(ctx.getMmdText(), tr.line, 'to', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-tr-event').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateTransition(ctx.getMmdText(), tr.line, 'event', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-tr-delete').addEventListener('click', function() { window.MA.history.pushHistory(); ctx.setMmdText(deleteTransition(ctx.getMmdText(), tr.line)); window.MA.selection.clearSelection(); ctx.onUpdate(); });
      return;
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'stateDiagram',
    displayName: 'State',
    detect: function(text) {
      return window.MA.parserUtils.detectDiagramType(text) === 'stateDiagram';
    },
    parse: parseState,
    template: function() {
      return [
        'stateDiagram-v2',
        '    [*] --> Idle',
        '    Idle --> Running : start',
        '    Running --> Idle : stop',
        '    Running --> [*]',
      ].join('\n');
    },
    buildOverlay: buildOverlay,
    renderProps: renderProps,
    operations: {
      add: function(text, kind, props) {
        if (kind === 'state') return addState(text, props.id, props.label, props.type);
        if (kind === 'transition') return addTransition(text, props.from, props.to, props.event || props.label);
        if (kind === 'composite') return addComposite(text, props.id, props.label);
        if (kind === 'note') return addNote(text, props.position, props.target, props.text);
        return text;
      },
      delete: function(text, lineNum) { return window.MA.textUpdater.deleteLine(text, lineNum); },
      update: function(text, lineNum, field, value) {
        var lines = text.split('\n');
        var trimmed = (lines[lineNum - 1] || '').trim();
        if (trimmed.indexOf('-->') > 0) return updateTransition(text, lineNum, field, value);
        if (field === 'label') return updateStateLabel(text, lineNum, value);
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
        return addTransition(text, fromId, toId, props.event || props.label);
      },
    },
    parseState: parseState,
    addState: addState,
    deleteState: deleteState,
    updateStateLabel: updateStateLabel,
    addTransition: addTransition,
    deleteTransition: deleteTransition,
    updateTransition: updateTransition,
    addComposite: addComposite,
    deleteComposite: deleteComposite,
    addNote: addNote,
  };
})();
