'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.blockBeta = (function() {
  var COLUMNS_RE = /^columns\s+(\d+)\s*$/;
  // `block:id`, `block:id columns N`, and the column-span form `block:id:N`.
  // Every place that asks "is this a group start?" must use this one regex —
  // a depth counter and an identity check that disagree will pair the wrong
  // braces and delete the wrong range.
  var GROUP_START_RE = /^block:([A-Za-z_][A-Za-z0-9_-]*)(?::\d+)?\s*(?:columns\s+\d+)?\s*$/;
  var BLOCK_TOKEN_RE = /([A-Za-z_][A-Za-z0-9_-]*)(?:\["([^"]*)"\]|\(\("([^"]*)"\)\)|\("([^"]*)"\))?/g;
  var LINK_RE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*(?:--\s*"?([^"]*?)"?\s*)?-->\s*([A-Za-z_][A-Za-z0-9_-]*)\s*$/;

  // 追加フォームの親グループ選択。renderProps は毎回パネルを作り直すので、
  // 保持しないと同じ group へ続けて入れるたびに選び直しになる。
  var lastAddParent = '';

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

  // Index of the 'end' that closes the group opened at startIdx. Counts nesting
  // depth: the first 'end' after a group start belongs to the innermost group,
  // not necessarily to this one. Returns -1 when the group is left unclosed.
  function findMatchingEnd(lines, startIdx) {
    var depth = 0;
    for (var j = startIdx; j < lines.length; j++) {
      var t = lines[j].trim();
      if (GROUP_START_RE.test(t)) {
        depth++;
      } else if (t === 'end') {
        depth--;
        if (depth === 0) return j;
      }
    }
    return -1;
  }

  // Exact id match, not a prefix one: 'block:g10' must not answer to 'g1', or
  // adding a block to g1 lands inside g10 whenever g10 appears first.
  function isGroupStart(trimmed, id) {
    var m = trimmed.match(GROUP_START_RE);
    return !!m && m[1] === id;
  }

  function addNestedBlock(text, parentId, id, label) {
    var token = label && label !== id ? id + '["' + label + '"]' : id;
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (isGroupStart(lines[i].trim(), parentId)) {
        var endIdx = findMatchingEnd(lines, i);
        if (endIdx === -1) return text;
        // Indent one step past the parent rather than a fixed four spaces. The text
        // is the source of truth here, so a child sitting at its parent's depth
        // reads as a sibling — the diagram is right but the diff lies about it.
        var indent = (lines[i].match(/^(\s*)/)[1] || '') + '  ';
        lines.splice(endIdx, 0, indent + token);
        return lines.join('\n');
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

  // Ids the parser itself recognises in `text`. Reusing parseBlock rather than
  // re-scanning tokens keeps this in step with the shapes the module supports,
  // including its keyword guards for `block` / `end` / `columns`.
  // How much a delete would actually remove, counted by running it and diffing the
  // parse. A group takes its contents and every link into them, so the row label
  // alone cannot tell the user what a single ✕ is about to cost.
  function deletionImpact(text, el) {
    var before = parseBlock(text);
    var after = parseBlock(deleteBlock(text, el.line, el.id));
    return {
      elements: before.elements.length - after.elements.length,
      relations: before.relations.length - after.relations.length,
    };
  }

  function collectIds(text) {
    var ids = [];
    var parsed = parseBlock(text);
    for (var i = 0; i < parsed.elements.length; i++) {
      var id = parsed.elements[i].id;
      if (id && ids.indexOf(id) === -1) ids.push(id);
    }
    return ids;
  }

  function deleteBlock(text, lineNum, blockId) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();

    // Ids present before the delete, so the cascade below can work out which
    // ones actually disappeared rather than guessing from the raw text. Scanning
    // tokens by hand mis-reads label words as ids for any shape the token regex
    // does not cover (e.g. `d{"Decision Node"}`), which silently killed links
    // between blocks that were never deleted.
    var idsBefore = collectIds(text);

    // Group block:ID ... end
    if (isGroupStart(trimmed, blockId)) {
      var endIdx = findMatchingEnd(lines, idx);
      // An unclosed group (the user deleted its `end` mid-edit) must not swallow
      // the rest of the file; drop the header line alone and leave the body.
      if (endIdx === -1) endIdx = idx;
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
    // Cascade: drop links whose endpoint no longer exists. Comparing the id sets
    // before and after keeps two cases honest — an id that also lives outside the
    // deleted range survives, so its links stay; and a link that was already
    // dangling before this edit is left exactly as the user wrote it.
    var result = lines.join('\n');
    var idsAfter = collectIds(result);
    var removedIds = idsBefore.filter(function(id) { return idsAfter.indexOf(id) === -1; });
    if (removedIds.length === 0) return result;

    var linkRe = /^(\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*(?:--\s*"?[^"]*?"?\s*)?-->\s*([A-Za-z_][A-Za-z0-9_-]*)\s*$/;
    lines = result.split('\n').filter(function(ln) {
      var m = ln.match(linkRe);
      if (!m) return true;
      return removedIds.indexOf(m[2]) === -1 && removedIds.indexOf(m[3]) === -1;
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
      if (!propsEl) return;
      var escHtml = window.MA.htmlUtils.escHtml;
      var P = window.MA.properties;

      var blocks = parsedData.elements.filter(function(e) { return e.kind === 'block'; });
      var groups = parsedData.elements.filter(function(e) { return e.kind === 'group'; });
      var links = parsedData.relations;

      if (!selData || selData.length === 0) {
        var allBlockOpts = blocks.map(function(b) { return { value: b.id, label: b.id }; })
          .concat(groups.map(function(g) { return { value: g.id, label: 'block:' + g.id }; }));
        if (allBlockOpts.length === 0) allBlockOpts = [{ value: '', label: '（ブロック／グループを先に追加）' }];

        // 親グループの選択は再描画をまたいで保持する。同じ group に続けて入れる
        // ケースが普通なので、毎回「なし」に戻ると選び直しが要る。
        var groupOpts = [{ value: '', label: '（なし・トップレベル）', selected: !lastAddParent }].concat(
          groups.map(function(g) {
            var depth = 0, cur = g;
            while (cur && cur.parentId) {
              depth++;
              cur = groups.filter(function(x) { return x.id === cur.parentId; })[0];
            }
            var indent = new Array(depth + 1).join('　');
            return { value: g.id, label: indent + g.id, selected: g.id === lastAddParent };
          })
        );

        var blocksList = '';
        for (var i = 0; i < blocks.length; i++) {
          var b = blocks[i];
          var bImpact = deletionImpact(ctx.getMmdText(), b);
          var bExtra = bImpact.elements + bImpact.relations;
          blocksList += P.listItemHtml({
            label: b.label !== b.id ? b.id + ' ("' + b.label + '")' : b.id,
            sublabel: b.parentId ? '(in ' + b.parentId + ')' : '',
            selectClass: 'block-select-block', deleteClass: 'block-delete-block',
            deleteLabel: bExtra > 1 ? '✕' + bExtra : '✕',
            deleteTitle: bExtra > 1
              ? ('削除すると ' + bImpact.elements + ' 要素 / ' + bImpact.relations + ' リンクが消えます')
              : '削除',
            dataElementId: b.id, dataLine: b.line,
          });
        }
        if (!blocksList) blocksList = P.emptyListHtml('（ブロックなし）');

        var groupsList = '';
        for (var gi = 0; gi < groups.length; gi++) {
          var g = groups[gi];
          // 1クリックで group 配下がまとめて消えるので、実際に消える数をボタンに出す。
          // 行のラベルはパネル幅で切れるため、警告はボタン側に置く。
          var gImpact = deletionImpact(ctx.getMmdText(), g);
          var gExtra = gImpact.elements + gImpact.relations;
          groupsList += P.listItemHtml({
            label: 'block:' + g.id,
            sublabel: g.parentId ? '(in ' + g.parentId + ')' : '',
            selectClass: 'block-select-group', deleteClass: 'block-delete-group',
            deleteLabel: gExtra > 1 ? '✕' + gExtra : '✕',
            deleteTitle: gExtra > 1
              ? ('削除すると ' + gImpact.elements + ' 要素 / ' + gImpact.relations + ' リンクが消えます')
              : '削除',
            dataElementId: g.id, dataLine: g.line,
          });
        }
        if (!groupsList) groupsList = P.emptyListHtml('（グループなし）');

        var linksList = '';
        for (var li = 0; li < links.length; li++) {
          var l = links[li];
          linksList += P.listItemHtml({
            label: l.from + ' --> ' + l.to + (l.label ? ' ("' + l.label + '")' : ''),
            selectClass: 'block-select-link', deleteClass: 'block-delete-link',
            dataElementId: l.id, dataLine: l.line, mono: true,
          });
        }
        if (!linksList) linksList = P.emptyListHtml('（リンクなし）');

        var currentCols = parsedData.meta && parsedData.meta.columns ? parsedData.meta.columns : '';

        propsEl.innerHTML =
          '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Block Diagram</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">Columns 設定</label>' +
            P.fieldHtml('Columns (1-N)', 'block-set-cols', String(currentCols), '空欄=未設定') +
            P.primaryButtonHtml('block-set-cols-btn', 'Columns 適用') +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">ブロックを追加</label>' +
            P.fieldHtml('ID', 'block-add-id', '', '例: sensor') +
            P.fieldHtml('Label', 'block-add-label', '', '省略可、IDと同じ') +
            P.selectFieldHtml('親グループ', 'block-add-parent', groupOpts) +
            P.primaryButtonHtml('block-add-btn', '+ ブロック追加') +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">グループを追加</label>' +
            P.fieldHtml('グループID', 'block-add-group-id', '', '例: mcu_group') +
            P.primaryButtonHtml('block-add-group-btn', '+ グループ追加') +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">リンクを追加</label>' +
            P.selectFieldHtml('From', 'block-add-link-from', allBlockOpts) +
            P.selectFieldHtml('To', 'block-add-link-to', allBlockOpts) +
            P.fieldHtml('ラベル', 'block-add-link-label', '', '省略可') +
            P.primaryButtonHtml('block-add-link-btn', '+ リンク追加') +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">ブロック一覧</label>' +
            '<div>' + blocksList + '</div>' +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">グループ一覧</label>' +
            '<div>' + groupsList + '</div>' +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">リンク一覧</label>' +
            '<div>' + linksList + '</div>' +
          '</div>';

        P.bindEvent('block-set-cols-btn', 'click', function() {
          var v = parseInt(document.getElementById('block-set-cols').value, 10);
          if (!v || v < 1) { alert('1 以上の整数を入力してください'); return; }
          window.MA.history.pushHistory();
          ctx.setMmdText(setColumns(ctx.getMmdText(), v));
          ctx.onUpdate();
        });
        P.bindEvent('block-add-btn', 'click', function() {
          var id = document.getElementById('block-add-id').value.trim();
          var label = document.getElementById('block-add-label').value.trim();
          var parent = document.getElementById('block-add-parent').value;
          lastAddParent = parent;
          if (!id) { alert('ID は必須です'); return; }
          window.MA.history.pushHistory();
          if (parent) {
            ctx.setMmdText(addNestedBlock(ctx.getMmdText(), parent, id, label));
          } else {
            ctx.setMmdText(addBlock(ctx.getMmdText(), id, label));
          }
          ctx.onUpdate();
        });
        P.bindEvent('block-add-group-btn', 'click', function() {
          var gid = document.getElementById('block-add-group-id').value.trim();
          if (!gid) { alert('グループ ID は必須です'); return; }
          window.MA.history.pushHistory();
          var t = ctx.getMmdText();
          var lines = t.split('\n');
          var insertAt = lines.length;
          while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
          lines.splice(insertAt, 0, '  block:' + gid, '  end');
          ctx.setMmdText(lines.join('\n'));
          ctx.onUpdate();
        });
        P.bindEvent('block-add-link-btn', 'click', function() {
          var from = document.getElementById('block-add-link-from').value;
          var to = document.getElementById('block-add-link-to').value;
          var label = document.getElementById('block-add-link-label').value.trim();
          if (!from || !to) { alert('From / To を選択してください'); return; }
          window.MA.history.pushHistory();
          ctx.setMmdText(addLink(ctx.getMmdText(), from, to, label));
          ctx.onUpdate();
        });

        P.bindSelectButtons(propsEl, 'block-select-block', 'block');
        P.bindSelectButtons(propsEl, 'block-select-group', 'group');
        P.bindSelectButtons(propsEl, 'block-select-link', 'link');
        P.bindDeleteButtons(propsEl, 'block-delete-block', ctx, function(t, ln) {
          var bid = '';
          for (var di = 0; di < parsedData.elements.length; di++) if (parsedData.elements[di].line === ln) { bid = parsedData.elements[di].id; break; }
          return deleteBlock(t, ln, bid);
        });
        P.bindDeleteButtons(propsEl, 'block-delete-group', ctx, function(t, ln) {
          var gid = '';
          for (var di = 0; di < parsedData.elements.length; di++) if (parsedData.elements[di].line === ln) { gid = parsedData.elements[di].id; break; }
          return deleteBlock(t, ln, gid);
        });
        P.bindDeleteButtons(propsEl, 'block-delete-link', ctx, deleteLink);
        return;
      }

      if (selData.length === 1) {
        var sel = selData[0];
        if (sel.type === 'block' || sel.type === 'group') {
          var el = null;
          for (var bi = 0; bi < parsedData.elements.length; bi++) {
            if (parsedData.elements[bi].id === sel.id) { el = parsedData.elements[bi]; break; }
          }
          if (!el) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">要素が見つかりません</p>'; return; }

          propsEl.innerHTML =
            P.panelHeaderHtml(el.kind === 'group' ? 'block:' + el.id : el.id) +
            '<div style="margin-bottom:8px;color:var(--text-secondary);font-size:11px;">種別: ' + escHtml(el.kind) + (el.parentId ? ' (親: ' + escHtml(el.parentId) + ')' : '') + '</div>' +
            P.fieldHtml('ID', 'block-edit-id', el.id) +
            (el.kind === 'block' ? P.fieldHtml('Label', 'block-edit-label', el.label !== el.id ? el.label : '') : '') +
            P.dangerButtonHtml('block-edit-delete', '削除');

          var elLine = el.line, elId = el.id, elKind = el.kind;
          if (el.kind === 'block') {
            document.getElementById('block-edit-label').addEventListener('change', function() {
              window.MA.history.pushHistory();
              ctx.setMmdText(updateBlockLabel(ctx.getMmdText(), elLine, elId, this.value));
              ctx.onUpdate();
            });
          }
          P.bindEvent('block-edit-delete', 'click', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(deleteBlock(ctx.getMmdText(), elLine, elId));
            window.MA.selection.clearSelection();
            ctx.onUpdate();
          });
          return;
        }

        if (sel.type === 'link') {
          var link = null;
          for (var lli = 0; lli < links.length; lli++) if (links[lli].id === sel.id) { link = links[lli]; break; }
          if (!link) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">リンクが見つかりません</p>'; return; }

          var blockOpts = blocks.map(function(b) { return { value: b.id, label: b.id }; })
            .concat(groups.map(function(g) { return { value: g.id, label: 'block:' + g.id }; }));
          if (blockOpts.length === 0) blockOpts = [{ value: '', label: '（ブロック／グループなし）' }];
          var fromOpts = blockOpts.map(function(o) { return { value: o.value, label: o.label, selected: o.value === link.from }; });
          var toOpts = blockOpts.map(function(o) { return { value: o.value, label: o.label, selected: o.value === link.to }; });

          propsEl.innerHTML =
            P.panelHeaderHtml('Link') +
            P.selectFieldHtml('From', 'block-edit-link-from', fromOpts) +
            P.selectFieldHtml('To', 'block-edit-link-to', toOpts) +
            P.fieldHtml('ラベル', 'block-edit-link-label', link.label) +
            P.dangerButtonHtml('block-edit-link-delete', 'リンク削除');

          var linkLine = link.line;
          document.getElementById('block-edit-link-from').addEventListener('change', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(updateLink(ctx.getMmdText(), linkLine, 'from', this.value));
            ctx.onUpdate();
          });
          document.getElementById('block-edit-link-to').addEventListener('change', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(updateLink(ctx.getMmdText(), linkLine, 'to', this.value));
            ctx.onUpdate();
          });
          document.getElementById('block-edit-link-label').addEventListener('change', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(updateLink(ctx.getMmdText(), linkLine, 'label', this.value));
            ctx.onUpdate();
          });
          P.bindEvent('block-edit-link-delete', 'click', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(deleteLink(ctx.getMmdText(), linkLine));
            window.MA.selection.clearSelection();
            ctx.onUpdate();
          });
          return;
        }
      }

      propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
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
    deleteBlock: deleteBlock, deleteLink: deleteLink, deletionImpact: deletionImpact,
    updateBlockLabel: updateBlockLabel, updateLink: updateLink, setColumns: setColumns,
  };
})();
