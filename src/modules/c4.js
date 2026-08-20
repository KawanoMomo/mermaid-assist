'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.c4 = (function() {
  var BOUNDARY_KINDS = ['System_Boundary', 'Container_Boundary', 'Enterprise_Boundary'];
  // Boundary kinds are listed alongside the leaf kinds so the panel can select,
  // edit and delete them. Without this a Container_Boundary is a ghost: it renders,
  // but never appears in the element list, yet a collapse can still remove it.
  var ELEMENT_KINDS = ['Person', 'Person_Ext', 'System', 'System_Ext',
    'Container', 'ContainerDb', 'ContainerQueue', 'Component', 'ComponentDb'].concat(BOUNDARY_KINDS);
  var REL_KINDS = ['Rel', 'Rel_R', 'Rel_L', 'Rel_U', 'Rel_D', 'BiRel'];

  // Sticky add-form choices. renderProps rebuilds the panel on every refresh, so
  // without these the Kind and parent selects snap back on each addition.
  var lastAddKind = 'Person';
  var lastAddParent = '';

  // Quoted C4 arguments cannot contain a raw '"' — mermaid rejects both `"` and
  // `\"` inside them, and accepts only its own `#quot;` entity, which it renders
  // as a double quote. Without this, typing a quote into a label produced a line
  // mermaid could not parse, and the quote was then silently dropped on the next
  // edit when parseArgs re-read the mangled text.
  // '#' is escaped first so a label the user actually typed as "#quot;" survives
  // the round trip instead of coming back as a bare quote. Decoding undoes the two
  // steps in reverse for the same reason.
  function encodeArg(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/#/g, '#35;')
      .replace(/"/g, '#quot;');
  }

  function decodeArg(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/#quot;/g, '"')
      .replace(/#35;/g, '#');
  }

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
    return args.map(decodeArg);
  }

  // Map each block-opening line (index) to the index of its matching '}'.
  // Counts braces textually rather than by element kind: Container_Boundary and
  // other hand-written boundary kinds are not in ELEMENT_KINDS, and a kind-based
  // count would mis-pair across them and delete the wrong range.
  function matchBraces(lines) {
    var pairs = {};
    var stack = [];
    var lastMeaningful = -1;
    for (var i = 0; i < lines.length; i++) {
      // mermaid accepts a trailing comment after the closing brace ('} %% close'),
      // so strip it before testing — otherwise the brace goes uncounted and the
      // boundary looks unclosed.
      var t = stripComment(lines[i]);
      if (!t) continue;
      if (t === '}') {
        var open = stack.pop();
        if (open !== undefined) pairs[open] = i;
      } else if (t === '{') {
        // `Kind(...)` on one line and `{` on the next is valid mermaid. Attribute
        // the opening brace to the element line above so callers can look the
        // boundary up by the line the user actually selected.
        stack.push(lastMeaningful === -1 ? i : lastMeaningful);
      } else if (t.charAt(t.length - 1) === '{') {
        stack.push(i);
      }
      lastMeaningful = i;
    }
    return pairs;
  }

  // Drop a trailing `%%` comment, but only when the marker is outside quotes —
  // a label may legitimately contain one (`"進捗 50%% 済"` parses fine in mermaid),
  // and cutting there would truncate the line mid-string.
  function stripComment(line) {
    var at = commentIndex(line);
    var t = line.trim();
    return at === -1 ? t : t.substring(0, at).trim();
  }

  // The ' %% …' tail of a line, or '' when there is none. Rewrites re-append it so
  // editing a commented line does not silently drop the user's note.
  function commentSuffix(line) {
    var at = commentIndex(line);
    return at === -1 ? '' : ' ' + line.trim().substring(at).trim();
  }

  function commentIndex(line) {
    var t = line.trim();
    var inQ = false;
    for (var i = 0; i < t.length; i++) {
      var ch = t.charAt(i);
      if (ch === '"') { inQ = !inQ; continue; }
      if (!inQ && ch === '%' && t.charAt(i + 1) === '%') return i;
    }
    return -1;
  }

  function parseC4(text) {
    var result = { meta: { title: '', variant: 'Context' }, elements: [], relations: [] };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var relCounter = 0;
    var bracePairs = matchBraces(lines);

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      // Strip a trailing comment first: `System(a, "A") %% note` is valid mermaid,
      // and matching against the raw line would leave that element out of the
      // model entirely — invisible in the list, yet deleted by a range delete.
      var trimmed = stripComment(lines[i]);
      if (!trimmed) continue;

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
          // Block form: 'Kind(...) {' … '}', or the brace on the following line.
          // Both are recorded by matchBraces against this element's index, so the
          // depth counter and the boundary check read the same source and cannot
          // disagree about where the block ends.
          if (bracePairs[i] !== undefined) {
            el.isBoundary = true;
            el.endLine = bracePairs[i] + 1;
          } else if (trimmed.charAt(trimmed.length - 1) === '{') {
            el.isBoundary = true;
            el.endLine = lineNum; // unclosed block
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
    var parts = [id, '"' + encodeArg(label) + '"'];
    if (kind === 'Container' || kind === 'ContainerDb' || kind === 'Component' || kind === 'ComponentDb' || kind === 'ContainerQueue') {
      parts.push('"' + encodeArg(tech) + '"');
      if (descr) parts.push('"' + encodeArg(descr) + '"');
    } else {
      if (descr) parts.push('"' + encodeArg(descr) + '"');
    }
    return kind + '(' + parts.join(', ') + ')' + (isBoundary ? ' {' : '');
  }

  function isBoundaryKind(kind) {
    return BOUNDARY_KINDS.indexOf(kind) !== -1;
  }

  // How much a delete would actually remove, counted by running it and diffing
  // the parse. Guessing from the line range under-reports: relations pointing into
  // the range are cascaded, and an emptied parent boundary collapses with it.
  function deletionImpact(text, el) {
    var before = parseC4(text);
    var after = parseC4(el.isBoundary ? deleteBoundary(text, el.line, el.endLine)
                                      : deleteElementLine(text, el.line));
    return {
      elements: before.elements.length - after.elements.length,
      relations: before.relations.length - after.relations.length,
    };
  }

  // Same answer as deletionImpact, but derived from a parse the caller already has
  // whenever the cheap analysis is conclusive. renderProps needs this for every row
  // and runs on each keystroke; measuring 105 elements the exact form cost 280ms
  // per render because it reparses the document twice per row.
  function deletionImpactFrom(parsed, el, text) {
    if (!el.isBoundary) {
      var enclosing = null;
      for (var bi = 0; bi < parsed.elements.length; bi++) {
        var b = parsed.elements[bi];
        if (!b.isBoundary || b.id === el.id) continue;
        if (el.line > b.line && el.line < b.endLine) {
          if (!enclosing || b.line > enclosing.line) enclosing = b;
        }
      }
      // A boundary left empty collapses, and that can cascade outwards — too
      // fiddly to shortcut, so fall back to the exact computation. Rare: it needs
      // this element to be the only thing inside its boundary.
      if (enclosing && contentCount(parsed, enclosing) <= 1) return deletionImpact(text, el);

      var relHits = 0;
      for (var ri = 0; ri < parsed.relations.length; ri++) {
        var r = parsed.relations[ri];
        if (r.from === el.id || r.to === el.id) relHits++;
      }
      return { elements: 1, relations: relHits };
    }
    return deletionImpact(text, el); // boundaries are few; keep the exact answer
  }

  function contentCount(parsed, boundary) {
    var n = 0, i;
    for (i = 0; i < parsed.elements.length; i++) {
      var e = parsed.elements[i];
      if (e.line > boundary.line && e.line < boundary.endLine) n++;
    }
    for (i = 0; i < parsed.relations.length; i++) {
      var r = parsed.relations[i];
      if (r.line > boundary.line && r.line < boundary.endLine) n++;
    }
    return n;
  }

  // The boundary element occupying `lineNum`, or null when that line is not one.
  function boundaryAt(text, lineNum) {
    var parsed = parseC4(text);
    for (var i = 0; i < parsed.elements.length; i++) {
      var el = parsed.elements[i];
      if (el.line === lineNum && el.isBoundary) return el;
    }
    return null;
  }

  function uniqueId(text, wanted) {
    var taken = collectIds(text);
    if (taken.indexOf(wanted) === -1) return wanted;
    for (var n = 2; ; n++) {
      if (taken.indexOf(wanted + n) === -1) return wanted + n;
    }
  }

  // Kind options for the detail panel. A boundary may only stay a boundary and a
  // plain element may not become one, because converting needs braces added or
  // removed on two separate lines. The element's own kind is always included so
  // an unlisted kind never silently displays as the first option instead.
  function kindOptionsFor(kind, isBoundary) {
    var list = ELEMENT_KINDS.filter(function(k) { return isBoundaryKind(k) === !!isBoundary; });
    if (kind && list.indexOf(kind) === -1) list = [kind].concat(list);
    return list.map(function(k) { return { value: k, label: k, selected: k === kind }; });
  }

  function addElement(text, kind, id, label, descr, tech, parentId) {
    var lines = text.split('\n');
    var indentUnit = '    ';
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;

    // Placing an element inside a boundary is the whole point of having one; without
    // this the only way to fill a boundary is to hand-edit the text.
    if (parentId) {
      var parent = null;
      var parsed = parseC4(text);
      for (var pi = 0; pi < parsed.elements.length; pi++) {
        if (parsed.elements[pi].id === parentId && parsed.elements[pi].isBoundary) {
          parent = parsed.elements[pi];
          break;
        }
      }
      if (parent && parent.endLine > parent.line) {
        insertAt = parent.endLine - 1; // just before the closing brace
        indentUnit = (lines[parent.line - 1].match(/^(\s*)/)[1] || '') + '    ';
      }
    }
    // mermaid accepts a duplicate alias without complaint, but the property panel
    // resolves a selection by first id match — so a duplicate silently hands the
    // user a different element to edit or delete. Suffix rather than collide.
    id = uniqueId(text, id);
    if (isBoundaryKind(kind)) {
      // mermaid v11 rejects an empty boundary ('Parse error … Expecting PERSON,
      // SYSTEM, …'), so a boundary is always created with one placeholder child
      // that the user then renames or replaces. mermaid accepts duplicate aliases
      // silently, and renderProps resolves a selection by first id match, so a
      // collision would hand the user someone else's element — pick a free name.
      var childKind = kind === 'Container_Boundary' ? 'Container' : 'System';
      lines.splice(insertAt, 0,
        indentUnit + formatArgs(kind, id, label, descr, tech, true),
        indentUnit + '    ' + formatArgs(childKind, uniqueId(text, id + '_sys'), '新規要素'),
        indentUnit + '}');
    } else {
      lines.splice(insertAt, 0, indentUnit + formatArgs(kind, id, label, descr, tech));
    }
    return window.MA.textUpdater.matchEol(text, lines.join(String.fromCharCode(10)));
  }

  function addRel(text, kind, from, to, label, tech) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    var parts = [from, to, '"' + encodeArg(label) + '"'];
    if (tech) parts.push('"' + encodeArg(tech) + '"');
    lines.splice(insertAt, 0, '    ' + (kind || 'Rel') + '(' + parts.join(', ') + ')');
    return window.MA.textUpdater.matchEol(text, lines.join(String.fromCharCode(10)));
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

  // Remove every boundary left with nothing inside, repeating outwards: taking
  // the last child out of a boundary makes it empty, and mermaid will not render
  // an empty one. Applies to both kinds of delete — removing a nested boundary
  // empties its parent just as removing a plain element does.
  function collapseEmptyBoundaries(lines) {
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
    return lines;
  }

  // Delete one element line, then tidy up what that leaves behind.
  function deleteElementLine(text, lineNum) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    lines.splice(idx, 1);
    return pruneDanglingRels(text, collapseEmptyBoundaries(lines).join('\n'));
  }

  function deleteBoundary(text, startLine, endLine) {
    var lines = text.split('\n');
    var from = startLine - 1;
    var to = (endLine || startLine) - 1;
    if (from < 0 || from >= lines.length) return text;
    if (to < from || to >= lines.length) to = from;
    lines.splice(from, to - from + 1);
    return pruneDanglingRels(text, collapseEmptyBoundaries(lines).join('\n'));
  }

  function updateElement(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var comment = commentSuffix(lines[idx]);
    var trimmed = stripComment(lines[idx]);
    // A trailing '{' means this line opens a block; it has to survive the rewrite
    // or the matching '}' below is orphaned and mermaid fails to parse.
    var hadBrace = trimmed.charAt(trimmed.length - 1) === '{';
    var matchedKind = null, km = null;
    for (var k = 0; k < ELEMENT_KINDS.length; k++) {
      var ki = ELEMENT_KINDS[k];
      // Anchored and greedy, matching parseC4: a non-greedy unanchored `\)` stops
      // at the first ')' and silently truncates labels like "決済 (Core)".
      var rr = new RegExp('^' + ki + '\\s*\\(\\s*(.+)\\s*\\)\\s*(?:\\{)?\\s*$');
      var m = trimmed.match(rr);
      if (m) { matchedKind = ki; km = m; break; }
    }
    if (!matchedKind) return text;
    var args = parseArgs(km[1]);
    var id = args[0] || '', label = args[1] || '';
    var isContainer = (matchedKind === 'Container' || matchedKind === 'ContainerDb' || matchedKind === 'ContainerQueue' || matchedKind === 'Component' || matchedKind === 'ComponentDb');
    var tech = isContainer ? (args[2] || '') : '';
    var descr = isContainer ? (args[3] || '') : (args[2] || '');

    var oldId = id;
    if (field === 'id') id = value;
    else if (field === 'label') label = value;
    else if (field === 'tech') tech = value;
    else if (field === 'descr') descr = value;
    else if (field === 'kind') matchedKind = value;

    lines[idx] = indent + formatArgs(matchedKind, id, label, descr, tech, hadBrace) + comment;
    if (field === 'id' && value !== oldId) renameRelRefs(lines, oldId, value);
    return lines.join('\n');
  }

  // Renaming an element's id without rewriting the Rel lines that point at it
  // leaves a dangling reference. C4 is the worst case of that: mermaid.parse
  // still returns OK and only mermaid.render throws ("Cannot read properties of
  // undefined (reading 'x')"), so the preview goes blank with no usable message.
  //
  // Only the first two arguments of a Rel line are ids; label/technology/descr
  // are free text and must not be touched even when they contain the old id.
  //
  // The rewrite is done on the raw argument slices rather than by re-serialising
  // the parsed args. Re-serialising would drop the quotes around the label (and
  // any argument past the fourth, which updateRel does not model), so a rename
  // would quietly reformat parts of the line that the user never edited.
  function renameRelRefs(lines, oldId, newId) {
    for (var j = 0; j < lines.length; j++) {
      var lineComment = commentSuffix(lines[j]);
      var t = stripComment(lines[j]).trim();
      var lineIndent = lines[j].match(/^(\s*)/)[1];
      for (var k = 0; k < REL_KINDS.length; k++) {
        var rr = new RegExp('^' + REL_KINDS[k] + '\\s*\\(\\s*(.+)\\s*\\)\\s*$');
        var m = t.match(rr);
        if (!m) continue;
        var raw = splitArgsRaw(m[1]);
        var changed = false;
        for (var a = 0; a < 2 && a < raw.length; a++) {
          if (decodeArg(raw[a].trim().replace(/^"|"$/g, '')) === oldId) {
            raw[a] = raw[a].replace(/^(\s*)(.*?)(\s*)$/, '$1' + encodeArg(newId) + '$3');
            changed = true;
          }
        }
        if (changed) {
          lines[j] = lineIndent + REL_KINDS[k] + '(' + raw.join(',') + ')' + lineComment;
        }
        break;
      }
    }
  }

  // Same top-level comma split as parseArgs, but returns the untouched source
  // slices (quotes, padding and all) so a caller can rewrite one argument in
  // place without reformatting the rest.
  function splitArgsRaw(str) {
    var out = [], cur = '', inQ = false;
    for (var i = 0; i < str.length; i++) {
      var c = str[i];
      if (c === '"') { inQ = !inQ; cur += c; continue; }
      if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  }

  function updateRel(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var comment = commentSuffix(lines[idx]);
    var trimmed = stripComment(lines[idx]);
    var matchedKind = null, km = null;
    for (var k = 0; k < REL_KINDS.length; k++) {
      // Anchored and greedy, matching parseC4 (see updateElement).
      var rr = new RegExp('^' + REL_KINDS[k] + '\\s*\\(\\s*(.+)\\s*\\)\\s*$');
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
    var parts = [from, to, '"' + encodeArg(label) + '"'];
    if (tech) parts.push('"' + encodeArg(tech) + '"');
    lines[idx] = indent + matchedKind + '(' + parts.join(', ') + ')' + comment;
    return lines.join('\n');
  }

  // The label C4 actually drew for a shape. Its <text> runs start with the
  // stereotype (`<<person>>`), which is decoration rather than the name.
  function c4LabelOf(gEl) {
    if (!gEl || !gEl.querySelectorAll) return null;
    var texts = gEl.querySelectorAll('text');
    for (var i = 0; i < texts.length; i++) {
      var t = (texts[i].textContent || '').trim();
      if (t && !/^<<.*>>$/.test(t)) return t;
    }
    return null;
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
      // The add form keeps its Kind and parent between submissions: adding several
      // elements of the same kind into the same boundary is the common case, and
      // resetting to Person/top-level every time makes the user re-pick each round.
      var kindOpts = ELEMENT_KINDS.map(function(k) { return { value: k, label: k, selected: k === lastAddKind }; });
      var relKindOpts = REL_KINDS.map(function(k) { return { value: k, label: k, selected: k === 'Rel' }; });
      var elemIdOpts = els.map(function(e) { return { value: e.id, label: e.id + ' (' + e.kind + ')' }; });
      if (elemIdOpts.length === 0) elemIdOpts = [{ value: '', label: '（要素を先に追加）' }];

      var boundaries = els.filter(function(e) { return e.isBoundary; });
      var parentOpts = [{ value: '', label: '（なし・トップレベル）', selected: !lastAddParent }];
      boundaries.forEach(function(b) {
        parentOpts.push({ value: b.id, label: b.id + ' (' + b.label + ')', selected: b.id === lastAddParent });
      });

      // Which boundary encloses each element, for the list's depth hint.
      function enclosingOf(e) {
        var best = null;
        for (var bi = 0; bi < boundaries.length; bi++) {
          var b = boundaries[bi];
          if (b.id === e.id) continue;
          if (e.line > b.line && e.line < b.endLine) {
            if (!best || b.line > best.line) best = b; // innermost
          }
        }
        return best;
      }

      var elList = '';
      for (var i = 0; i < els.length; i++) {
        var e = els[i];
        var parent = enclosingOf(e);
        var sub = parent ? '(in ' + parent.id + ')' : (e.tech ? '[tech: ' + e.tech + ']' : '');
        // Deleting anything can cascade — a boundary takes its contents, an emptied
        // parent collapses, and relations into the removed range go with it. Put the
        // real total on the button itself: the row's text is ellipsised at the panel
        // width, so a warning inside the label is never actually read.
        var impact = deletionImpactFrom(parsedData, e, ctx.getMmdText());
        var extra = impact.elements + impact.relations;
        elList += P.listItemHtml({
          label: e.kind + '(' + e.id + ', "' + e.label + '")',
          sublabel: sub,
          selectClass: 'c4-select-element',
          deleteClass: e.isBoundary ? 'c4-delete-boundary' : 'c4-delete-element',
          deleteLabel: extra > 1 ? '✕' + extra : '✕',
          deleteTitle: extra > 1
            ? ('削除すると ' + impact.elements + ' 要素 / ' + impact.relations + ' リレーションが消えます')
            : '削除',
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
          P.selectFieldHtml('親境界', 'c4-add-parent', parentOpts) +
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
        var parent = document.getElementById('c4-add-parent').value;
        if (!id || !label) { alert('ID と Label は必須'); return; }
        var before = ctx.getMmdText();
        var finalId = uniqueId(before, id);
        // A duplicate alias is renamed rather than rejected, because mermaid accepts
        // duplicates silently and the panel would then edit the wrong element. Say so:
        // the user may be keeping ids in step with a design document.
        if (finalId !== id) alert('ID "' + id + '" は既に使われているため "' + finalId + '" で追加します');
        lastAddKind = kind;
        lastAddParent = parent;
        window.MA.history.pushHistory();
        ctx.setMmdText(addElement(before, kind, id, label, descr, tech, parent));
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
        var kOpts = kindOptionsFor(el.kind, el.isBoundary);
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
      var geom = window.MA.overlayGeom;
      geom.syncViewport(svgEl, overlayEl);
      if (!overlayEl || !svgEl || !parsedData) return;

      // C4 は要素を識別できる属性を何も出さない。実測すると <g> の class は
      // どの要素も 'person-man' で、id も data-* も無い。手がかりは描画された
      // ラベルだけで、同じラベルの要素が2つあると区別できない。
      //
      // 出現順で決め打つこともできるが、mermaid のレンダラが宣言順を保つ保証は
      // 無く、Boundary のネストで簡単に崩れる。**間違った要素を選ぶのは、
      // 選べないより悪い。**
      //
      // そこで、図の中でラベルが一意な要素だけ当たり判定を作る。重複している
      // ラベルの要素はプロパティ一覧から編集する (それは常に正しく引ける)。
      var count = {};
      var byLabel = {};
      for (var i = 0; i < parsedData.elements.length; i++) {
        var e = parsedData.elements[i];
        if (!e.label) continue;
        count[e.label] = (count[e.label] || 0) + 1;
        byLabel[e.label] = e;
      }

      var groups = svgEl.querySelectorAll('g');
      var used = {};
      for (var g = 0; g < groups.length; g++) {
        var label = c4LabelOf(groups[g]);
        if (!label || count[label] !== 1 || used[label]) continue;
        var el = byLabel[label];
        if (!el) continue;
        var box = geom.boxInSvgSpace(svgEl, groups[g]);
        if (!box) continue;
        used[label] = true;
        overlayEl.appendChild(geom.hitRect(document, box, {
          id: el.id,
          kind: 'element',
          line: el.line,
          selected: window.MA.selection.isSelected(el.id),
          className: 'overlay-node',
        }));
      }
    },
    renderProps: renderProps,
    operations: {
      add: function(text, kind, props) {
        if (REL_KINDS.indexOf(kind) >= 0) return addRel(text, kind, props.from, props.to, props.label, props.tech);
        if (ELEMENT_KINDS.indexOf(kind) >= 0) return addElement(text, kind, props.id, props.label, props.descr, props.tech);
        return text;
      },
      // Boundary-aware, like the property panel. These entry points are not wired
      // up yet, but leaving them on the naive deleteLine/swapLines would bring the
      // orphaned-brace bug straight back the day the registry starts calling them.
      delete: function(text, lineNum) {
        var b = boundaryAt(text, lineNum);
        if (b) return deleteBoundary(text, b.line, b.endLine);
        return deleteElementLine(text, lineNum);
      },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        if (opts.kind === 'rel') return updateRel(text, lineNum, field, value);
        if (field === 'title') return setTitle(text, value);
        if (field === 'variant') return setVariant(text, value);
        return updateElement(text, lineNum, field, value);
      },
      moveUp: function(text, lineNum) {
        // Swapping a boundary header with the line above tears the '{' away from
        // the block it opens. Moving a whole block is a separate feature; refuse
        // rather than corrupt.
        if (lineNum <= 1 || boundaryAt(text, lineNum)) return text;
        return window.MA.textUpdater.swapLines(text, lineNum, lineNum - 1);
      },
      moveDown: function(text, lineNum) {
        var total = text.split('\n').length;
        if (lineNum >= total || boundaryAt(text, lineNum)) return text;
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
    deleteElementLine: deleteElementLine, kindOptionsFor: kindOptionsFor,
    deletionImpact: deletionImpact, deletionImpactFrom: deletionImpactFrom,
    BOUNDARY_KINDS: BOUNDARY_KINDS,
    uniqueId: uniqueId, stripComment: stripComment,
    parseArgs: parseArgs,
  };
})();
