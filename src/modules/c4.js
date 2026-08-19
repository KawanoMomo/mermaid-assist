'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.c4 = (function() {
  var ELEMENT_KINDS = ['Person', 'Person_Ext', 'System', 'System_Ext', 'System_Boundary', 'Container', 'ContainerDb', 'ContainerQueue', 'Component', 'ComponentDb'];
  var REL_KINDS = ['Rel', 'Rel_R', 'Rel_L', 'Rel_U', 'Rel_D', 'BiRel'];

  function parseArgs(str) {
    // Parse comma-separated args, respecting double-quoted strings.
    var args = [];
    var cur = '';
    var inQ = false;
    for (var i = 0; i < str.length; i++) {
      var c = str[i];
      if (inQ) {
        if (c === '"') { inQ = false; continue; }
        cur += c;
      } else {
        if (c === '"') { inQ = true; continue; }
        if (c === ',') { args.push(cur.trim()); cur = ''; continue; }
        cur += c;
      }
    }
    if (cur.trim().length > 0) args.push(cur.trim());
    return args;
  }

  // Map each block-opening line (index) to the index of its matching '}'.
  // Counts braces textually rather than by element kind: Container_Boundary and
  // other hand-written boundary kinds are not in ELEMENT_KINDS, and a kind-based
  // count would mis-pair across them and delete the wrong range.
  function matchBraces(lines) {
    var pairs = {};
    var stack = [];
    for (var i = 0; i < lines.length; i++) {
      // mermaid accepts a trailing comment after the closing brace ('} %% close'),
      // so strip it before testing — otherwise the brace goes uncounted and the
      // boundary looks unclosed.
      var t = stripComment(lines[i]);
      if (!t) continue;
      if (t === '}') {
        var open = stack.pop();
        if (open !== undefined) pairs[open] = i;
      } else if (t.charAt(t.length - 1) === '{') {
        stack.push(i);
      }
    }
    return pairs;
  }

  function stripComment(line) {
    var t = line.trim();
    if (t.indexOf('%%') === 0) return '';
    var at = t.indexOf('%%');
    return at === -1 ? t : t.substring(0, at).trim();
  }

  function parseC4(text) {
    var result = { meta: { title: '', variant: 'Context' }, elements: [], relations: [] };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var relCounter = 0;
    var bracePairs = matchBraces(lines);

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;

      var hm = trimmed.match(/^C4(Context|Container|Component|Dynamic|Deployment)/);
      if (hm) { result.meta.variant = hm[1]; continue; }

      var tm = trimmed.match(/^title\s+(.+)$/);
      if (tm) { result.meta.title = tm[1].trim(); continue; }

      // Element: Kind(alias, "label" [, ...])
      for (var k = 0; k < ELEMENT_KINDS.length; k++) {
        var kind = ELEMENT_KINDS[k];
        var kr = new RegExp('^' + kind + '\\s*\\(\\s*(.+?)\\s*\\)\\s*(?:\\{)?\\s*$');
        var km = trimmed.match(kr);
        if (km) {
          var args = parseArgs(km[1]);
          var el = {
            kind: kind, id: args[0] || '', label: args[1] || '', args: args,
            line: lineNum,
          };
          if (kind === 'Container' || kind === 'ContainerDb' || kind === 'ContainerQueue' || kind === 'Component' || kind === 'ComponentDb') {
            el.tech = args[2] || '';
            el.descr = args[3] || '';
          } else {
            el.descr = args[2] || '';
          }
          // Block form: 'Kind(...) {' … '}'. Record it so updateElement can keep
          // the brace and deleteBoundary can remove the whole range.
          if (trimmed.charAt(trimmed.length - 1) === '{') {
            el.isBoundary = true;
            el.endLine = bracePairs[i] !== undefined ? bracePairs[i] + 1 : lineNum;
          }
          result.elements.push(el);
          break;
        }
      }

      // Relation: Rel(from, to, "label" [, "tech"])
      for (var r = 0; r < REL_KINDS.length; r++) {
        var relKind = REL_KINDS[r];
        var rr = new RegExp('^' + relKind + '\\s*\\(\\s*(.+?)\\s*\\)\\s*$');
        var rm = trimmed.match(rr);
        if (rm) {
          var rargs = parseArgs(rm[1]);
          result.relations.push({
            kind: relKind,
            id: '__r_' + (relCounter++),
            from: rargs[0] || '', to: rargs[1] || '',
            label: rargs[2] || '', tech: rargs[3] || '',
            line: lineNum,
          });
          break;
        }
      }

      // Closing '}' for Boundary blocks - skip
    }
    return result;
  }

  function setTitle(text, newTitle) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t || t.indexOf('%%') === 0) continue;
      if (/^title\s+/.test(t)) {
        var indent = lines[i].match(/^(\s*)/)[1];
        lines[i] = indent + 'title ' + newTitle;
        return lines.join('\n');
      }
      if (/^C4/.test(t)) {
        lines.splice(i + 1, 0, '    title ' + newTitle);
        return lines.join('\n');
      }
    }
    return text;
  }

  function setVariant(text, variant) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t || t.indexOf('%%') === 0) continue;
      if (/^C4/.test(t)) {
        var indent = lines[i].match(/^(\s*)/)[1];
        lines[i] = indent + 'C4' + variant;
        return lines.join('\n');
      }
    }
    return text;
  }

  function formatArgs(kind, id, label, descr, tech, isBoundary) {
    var parts = [id, '"' + (label || '') + '"'];
    if (kind === 'Container' || kind === 'ContainerDb' || kind === 'Component' || kind === 'ComponentDb' || kind === 'ContainerQueue') {
      parts.push('"' + (tech || '') + '"');
      if (descr) parts.push('"' + descr + '"');
    } else {
      if (descr) parts.push('"' + descr + '"');
    }
    return kind + '(' + parts.join(', ') + ')' + (isBoundary ? ' {' : '');
  }

  function isBoundaryKind(kind) {
    return kind === 'System_Boundary';
  }

  function addElement(text, kind, id, label, descr, tech) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    if (isBoundaryKind(kind)) {
      // mermaid v11 rejects an empty boundary ('Parse error … Expecting PERSON,
      // SYSTEM, …'), so a boundary is always created with one placeholder child
      // that the user then renames or replaces.
      lines.splice(insertAt, 0,
        '    ' + formatArgs(kind, id, label, descr, tech, true),
        '        ' + formatArgs('System', id + '_sys', '新規要素'),
        '    }');
    } else {
      lines.splice(insertAt, 0, '    ' + formatArgs(kind, id, label, descr, tech));
    }
    return lines.join('\n');
  }

  function addRel(text, kind, from, to, label, tech) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    var parts = [from, to, '"' + (label || '') + '"'];
    if (tech) parts.push('"' + tech + '"');
    lines.splice(insertAt, 0, '    ' + (kind || 'Rel') + '(' + parts.join(', ') + ')');
    return lines.join('\n');
  }

  function deleteLine(text, lineNum) { return window.MA.textUpdater.deleteLine(text, lineNum); }

  // Delete a boundary together with everything it encloses. Matches the delete
  // semantics of requirement/ER (container delete removes its contents) rather
  // than unwrapping, which would silently change what the diagram means.
  // Element ids the parser recognises in `text`.
  function collectIds(text) {
    var ids = [];
    var parsed = parseC4(text);
    for (var i = 0; i < parsed.elements.length; i++) {
      var id = parsed.elements[i].id;
      if (id && ids.indexOf(id) === -1) ids.push(id);
    }
    return ids;
  }

  // Drop relations whose endpoint disappeared between `before` and `after`.
  // Comparing the two id sets — rather than matching against the deleted line —
  // leaves relations that were already dangling before this edit untouched.
  function pruneDanglingRels(before, after) {
    var idsBefore = collectIds(before);
    var idsAfter = collectIds(after);
    var removed = idsBefore.filter(function(id) { return idsAfter.indexOf(id) === -1; });
    if (removed.length === 0) return after;
    var parsed = parseC4(after);
    var dropLines = {};
    for (var i = 0; i < parsed.relations.length; i++) {
      var r = parsed.relations[i];
      if (removed.indexOf(r.from) !== -1 || removed.indexOf(r.to) !== -1) dropLines[r.line] = true;
    }
    return after.split('\n').filter(function(_, idx) { return !dropLines[idx + 1]; }).join('\n');
  }

  // Delete one element line, then collapse any boundary the delete would have
  // left empty. mermaid rejects `Kind(...) { }` with nothing inside, so removing
  // the last child of a boundary has to take the boundary with it — and that can
  // cascade outwards when the boundary was itself an only child.
  function deleteElementLine(text, lineNum) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    lines.splice(idx, 1);

    for (;;) {
      var pairs = matchBraces(lines);
      var collapsed = false;
      for (var openIdx in pairs) {
        if (!Object.prototype.hasOwnProperty.call(pairs, openIdx)) continue;
        var o = parseInt(openIdx, 10);
        var closeIdx = pairs[o];
        var empty = true;
        for (var j = o + 1; j < closeIdx; j++) {
          if (stripComment(lines[j])) { empty = false; break; }
        }
        if (empty) {
          lines.splice(o, closeIdx - o + 1);
          collapsed = true;
          break; // indices shifted; recompute
        }
      }
      if (!collapsed) break;
    }
    return pruneDanglingRels(text, lines.join('\n'));
  }

  function deleteBoundary(text, startLine, endLine) {
    var lines = text.split('\n');
    var from = startLine - 1;
    var to = (endLine || startLine) - 1;
    if (from < 0 || from >= lines.length) return text;
    if (to < from || to >= lines.length) to = from;
    lines.splice(from, to - from + 1);
    return pruneDanglingRels(text, lines.join('\n'));
  }

  function updateElement(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var trimmed = lines[idx].trim();
    // A trailing '{' means this line opens a block; it has to survive the rewrite
    // or the matching '}' below is orphaned and mermaid fails to parse.
    var hadBrace = trimmed.charAt(trimmed.length - 1) === '{';
    var kindRe = null, matchedKind = null, km = null;
    for (var k = 0; k < ELEMENT_KINDS.length; k++) {
      var ki = ELEMENT_KINDS[k];
      var rr = new RegExp('^' + ki + '\\s*\\(\\s*(.+?)\\s*\\)');
      var m = trimmed.match(rr);
      if (m) { kindRe = rr; matchedKind = ki; km = m; break; }
    }
    if (!matchedKind) return text;
    var args = parseArgs(km[1]);
    var id = args[0] || '', label = args[1] || '';
    var isContainer = (matchedKind === 'Container' || matchedKind === 'ContainerDb' || matchedKind === 'ContainerQueue' || matchedKind === 'Component' || matchedKind === 'ComponentDb');
    var tech = isContainer ? (args[2] || '') : '';
    var descr = isContainer ? (args[3] || '') : (args[2] || '');

    if (field === 'id') id = value;
    else if (field === 'label') label = value;
    else if (field === 'tech') tech = value;
    else if (field === 'descr') descr = value;
    else if (field === 'kind') matchedKind = value;

    lines[idx] = indent + formatArgs(matchedKind, id, label, descr, tech, hadBrace);
    return lines.join('\n');
  }

  function updateRel(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var trimmed = lines[idx].trim();
    var matchedKind = null, km = null;
    for (var k = 0; k < REL_KINDS.length; k++) {
      var rr = new RegExp('^' + REL_KINDS[k] + '\\s*\\(\\s*(.+?)\\s*\\)');
      var m = trimmed.match(rr);
      if (m) { matchedKind = REL_KINDS[k]; km = m; break; }
    }
    if (!matchedKind) return text;
    var args = parseArgs(km[1]);
    var from = args[0] || '', to = args[1] || '', label = args[2] || '', tech = args[3] || '';
    if (field === 'from') from = value;
    else if (field === 'to') to = value;
    else if (field === 'label') label = value;
    else if (field === 'tech') tech = value;
    else if (field === 'kind') matchedKind = value;
    var parts = [from, to, '"' + label + '"'];
    if (tech) parts.push('"' + tech + '"');
    lines[idx] = indent + matchedKind + '(' + parts.join(', ') + ')';
    return lines.join('\n');
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var els = parsedData.elements;
    var rels = parsedData.relations;

    if (!selData || selData.length === 0) {
      var variantOpts = ['Context','Container','Component','Dynamic','Deployment'].map(function(v) {
        return { value: v, label: 'C4' + v, selected: v === parsedData.meta.variant };
      });
      var kindOpts = ELEMENT_KINDS.map(function(k) { return { value: k, label: k, selected: k === 'Person' }; });
      var relKindOpts = REL_KINDS.map(function(k) { return { value: k, label: k, selected: k === 'Rel' }; });
      var elemIdOpts = els.map(function(e) { return { value: e.id, label: e.id + ' (' + e.kind + ')' }; });
      if (elemIdOpts.length === 0) elemIdOpts = [{ value: '', label: '（要素を先に追加）' }];

      var elList = '';
      for (var i = 0; i < els.length; i++) {
        var e = els[i];
        var sub = e.tech ? '[tech: ' + e.tech + ']' : '';
        if (e.isBoundary) {
          // Deleting a boundary takes its contents with it, so show how many
          // elements are inside before the user presses ✕.
          var inner = 0;
          for (var ci = 0; ci < els.length; ci++) {
            if (els[ci].line > e.line && els[ci].line < e.endLine) inner++;
          }
          sub = '(' + inner + ' 要素を含む)';
        }
        elList += P.listItemHtml({
          label: e.kind + '(' + e.id + ', "' + e.label + '")',
          sublabel: sub,
          selectClass: 'c4-select-element',
          deleteClass: e.isBoundary ? 'c4-delete-boundary' : 'c4-delete-element',
          dataElementId: e.id, dataLine: e.line, dataEndLine: e.endLine, mono: true,
        });
      }
      if (!elList) elList = P.emptyListHtml('（要素なし）');

      var relList = '';
      for (var ri = 0; ri < rels.length; ri++) {
        var r = rels[ri];
        relList += P.listItemHtml({
          label: r.kind + '(' + r.from + ' → ' + r.to + ', "' + r.label + '")',
          selectClass: 'c4-select-rel', deleteClass: 'c4-delete-rel',
          dataElementId: r.id, dataLine: r.line, mono: true,
        });
      }
      if (!relList) relList = P.emptyListHtml('（リレーションなし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">C4 Diagram</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">Variant + Title</label>' +
          P.selectFieldHtml('Variant', 'c4-variant', variantOpts) +
          P.primaryButtonHtml('c4-set-variant', 'Variant 適用') +
          '<div style="height:6px;"></div>' +
          P.fieldHtml('Title', 'c4-title', parsedData.meta.title || '') +
          P.primaryButtonHtml('c4-set-title', 'Title 適用') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">要素を追加</label>' +
          P.selectFieldHtml('Kind', 'c4-add-kind', kindOpts) +
          P.fieldHtml('ID', 'c4-add-id', '', '例: user1') +
          P.fieldHtml('Label', 'c4-add-label', '', '例: Customer') +
          P.fieldHtml('Tech (Container系のみ)', 'c4-add-tech', '', '省略可') +
          P.fieldHtml('Description', 'c4-add-descr', '', '省略可') +
          P.primaryButtonHtml('c4-add-btn', '+ 要素追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">リレーションを追加</label>' +
          P.selectFieldHtml('Kind', 'c4-add-rel-kind', relKindOpts) +
          P.selectFieldHtml('From', 'c4-add-rel-from', elemIdOpts) +
          P.selectFieldHtml('To', 'c4-add-rel-to', elemIdOpts) +
          P.fieldHtml('Label', 'c4-add-rel-label', '', '例: Uses') +
          P.fieldHtml('Tech', 'c4-add-rel-tech', '', '省略可') +
          P.primaryButtonHtml('c4-add-rel-btn', '+ リレーション追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">要素一覧</label>' +
          '<div>' + elList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">リレーション一覧</label>' +
          '<div>' + relList + '</div>' +
        '</div>';

      P.bindEvent('c4-set-variant', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(setVariant(ctx.getMmdText(), document.getElementById('c4-variant').value));
        ctx.onUpdate();
      });
      P.bindEvent('c4-set-title', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(setTitle(ctx.getMmdText(), document.getElementById('c4-title').value.trim()));
        ctx.onUpdate();
      });
      P.bindEvent('c4-add-btn', 'click', function() {
        var kind = document.getElementById('c4-add-kind').value;
        var id = document.getElementById('c4-add-id').value.trim();
        var label = document.getElementById('c4-add-label').value.trim();
        var tech = document.getElementById('c4-add-tech').value.trim();
        var descr = document.getElementById('c4-add-descr').value.trim();
        if (!id || !label) { alert('ID と Label は必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addElement(ctx.getMmdText(), kind, id, label, descr, tech));
        ctx.onUpdate();
      });
      P.bindEvent('c4-add-rel-btn', 'click', function() {
        var kind = document.getElementById('c4-add-rel-kind').value;
        var from = document.getElementById('c4-add-rel-from').value;
        var to = document.getElementById('c4-add-rel-to').value;
        var label = document.getElementById('c4-add-rel-label').value.trim();
        var tech = document.getElementById('c4-add-rel-tech').value.trim();
        if (!from || !to) { alert('From/To は必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addRel(ctx.getMmdText(), kind, from, to, label, tech));
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'c4-select-element', 'element');
      P.bindSelectButtons(propsEl, 'c4-select-rel', 'rel');
      P.bindDeleteButtons(propsEl, 'c4-delete-element', ctx, deleteElementLine);
      P.bindDeleteButtons(propsEl, 'c4-delete-boundary', ctx, deleteBoundary, true);
      P.bindDeleteButtons(propsEl, 'c4-delete-rel', ctx, deleteLine);
      return;
    }

    if (selData.length === 1) {
      var sel = selData[0];
      if (sel.type === 'element') {
        var el = null;
        for (var i = 0; i < els.length; i++) if (els[i].id === sel.id) { el = els[i]; break; }
        if (!el) { propsEl.innerHTML = '<p>要素が見つかりません</p>'; return; }
        // Converting between a boundary and a plain element would need braces
        // added or removed on two separate lines, so the kind list is filtered:
        // a boundary can only stay a boundary, and a plain element cannot become
        // one. Boundaries are created from the add form instead.
        var kOpts = ELEMENT_KINDS
          .filter(function(k) { return isBoundaryKind(k) === !!el.isBoundary; })
          .map(function(k) { return { value: k, label: k, selected: k === el.kind }; });
        propsEl.innerHTML =
          P.panelHeaderHtml(el.id) +
          P.selectFieldHtml('Kind', 'c4-edit-kind', kOpts) +
          P.fieldHtml('ID', 'c4-edit-id', el.id) +
          P.fieldHtml('Label', 'c4-edit-label', el.label) +
          P.fieldHtml('Tech', 'c4-edit-tech', el.tech || '') +
          P.fieldHtml('Description', 'c4-edit-descr', el.descr || '') +
          P.dangerButtonHtml('c4-edit-delete', el.isBoundary ? '削除（中の要素ごと）' : '削除');
        var ln = el.line;
        var endLn = el.endLine;
        var isB = !!el.isBoundary;
        ['kind', 'id', 'label', 'tech', 'descr'].forEach(function(f) {
          var input = document.getElementById('c4-edit-' + f);
          if (input) input.addEventListener('change', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(updateElement(ctx.getMmdText(), ln, f, this.value));
            ctx.onUpdate();
          });
        });
        P.bindEvent('c4-edit-delete', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(isB ? deleteBoundary(ctx.getMmdText(), ln, endLn)
                             : deleteElementLine(ctx.getMmdText(), ln));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        });
        return;
      }
      if (sel.type === 'rel') {
        var rel = null;
        for (var ri = 0; ri < rels.length; ri++) if (rels[ri].id === sel.id) { rel = rels[ri]; break; }
        if (!rel) { propsEl.innerHTML = '<p>リレーションが見つかりません</p>'; return; }
        var rOpts = REL_KINDS.map(function(k) { return { value: k, label: k, selected: k === rel.kind }; });
        propsEl.innerHTML =
          P.panelHeaderHtml(rel.from + ' → ' + rel.to) +
          P.selectFieldHtml('Kind', 'c4-edit-rel-kind', rOpts) +
          P.fieldHtml('From', 'c4-edit-rel-from', rel.from) +
          P.fieldHtml('To', 'c4-edit-rel-to', rel.to) +
          P.fieldHtml('Label', 'c4-edit-rel-label', rel.label) +
          P.fieldHtml('Tech', 'c4-edit-rel-tech', rel.tech || '') +
          P.dangerButtonHtml('c4-edit-rel-delete', '削除');
        var rln = rel.line;
        ['kind', 'from', 'to', 'label', 'tech'].forEach(function(f) {
          var input = document.getElementById('c4-edit-rel-' + f);
          if (input) input.addEventListener('change', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(updateRel(ctx.getMmdText(), rln, f, this.value));
            ctx.onUpdate();
          });
        });
        P.bindEvent('c4-edit-rel-delete', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteLine(ctx.getMmdText(), rln));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        });
        return;
      }
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'C4Context',
    displayName: 'C4',
    ELEMENT_KINDS: ELEMENT_KINDS,
    REL_KINDS: REL_KINDS,
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'C4Context'; },
    parse: parseC4,
    parseC4: parseC4,
    template: function() {
      return [
        'C4Context',
        '    title System Context',
        '    Person(user, "User", "End user")',
        '    System(sys, "Banking System", "Core banking")',
        '    System_Ext(ext, "Email System", "External email")',
        '    Rel(user, sys, "Uses")',
        '    Rel(sys, ext, "Sends emails", "SMTP")',
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
        if (REL_KINDS.indexOf(kind) >= 0) return addRel(text, kind, props.from, props.to, props.label, props.tech);
        if (ELEMENT_KINDS.indexOf(kind) >= 0) return addElement(text, kind, props.id, props.label, props.descr, props.tech);
        return text;
      },
      delete: function(text, lineNum) { return deleteLine(text, lineNum); },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        if (opts.kind === 'rel') return updateRel(text, lineNum, field, value);
        if (field === 'title') return setTitle(text, value);
        if (field === 'variant') return setVariant(text, value);
        return updateElement(text, lineNum, field, value);
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
        return addRel(text, 'Rel', fromId, toId, props.label || '', props.tech || '');
      },
    },
    setTitle: setTitle, setVariant: setVariant,
    addElement: addElement, addRel: addRel,
    updateElement: updateElement, updateRel: updateRel, deleteLine: deleteLine,
    deleteBoundary: deleteBoundary, isBoundaryKind: isBoundaryKind,
    deleteElementLine: deleteElementLine,
    parseArgs: parseArgs,
  };
})();
