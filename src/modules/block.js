'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.blockBeta = (function() {
  var COLUMNS_RE = /^columns\s+(\d+)\s*$/;
  // `block:id`, `block:id columns N`, and the column-span form `block:id:N`.
  // Every place that asks "is this a group start?" must use this one regex —
  // a depth counter and an identity check that disagree will pair the wrong
  // braces and delete the wrong range.
  // 識別子は半角英数字に限らない。
  //
  // mermaid は日本語のブロック id を受け付けて正しく描く
  // (v11.13 実測: `受信["受信部"]` で図形11個・文字も出る)。ところがこちらは
  // `[A-Za-z_]` 始まりでしか拾っていなかったので、**要素が1件も出ず、
  // 一覧も重ね合わせも空になっていた**。
  // erDiagram (A59) / sequence (A80) と同じ「述語の非対称」で3例目。
  //
  // 記号は形状やリンクの記法に使うので識別子から外す。
  // `-` を先頭に許すと `-->` の一部を id と読むので、先頭だけ別に書く。
  var ID = '[^\\s\\[\\](){}"<>:,\\-][^\\s\\[\\](){}"<>:,]*';
  var GROUP_START_RE = new RegExp('^block:(' + ID + ')(?::\\d+)?\\s*(?:columns\\s+\\d+)?\\s*$');
  // 形状付きトークン。菱形 `{"..."}` と六角 `{{"..."}}` を知らないと、
  // `c{"Actuator"}` が `c` と `Actuator` の2ブロックに割れて幽霊が出る。
  var BLOCK_TOKEN_RE = new RegExp('(' + ID + ')' +
    '(?:\\["([^"]*)"\\]|\\(\\("([^"]*)"\\)\\)|\\("([^"]*)"\\)|\\{\\{"([^"]*)"\\}\\}|\\{"([^"]*)"\\})?', 'g');
  var LINK_RE = new RegExp('^(' + ID + ')\\s*(?:--\\s*"?([^"]*?)"?\\s*)?-->\\s*(' + ID + ')\\s*$');

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
      // 装飾行はブロックではない。
      //
      // 以前は `style a fill:#f9f` をトークン分解して `style` `a` `fill` `f9f` の
      // 4つをブロックとして登録していた。幽霊項目の ✕ を押すと style 行が消え、
      // リンクの端点候補に `fill` や `f9f` が並ぶ。既存の .mmd を GUI で開いた
      // 瞬間に起きるので、手書き Mermaid を GUI で触るという前提が崩れていた。
      // 本文にはそのまま残す (編集対象にしないだけ)。
      if (/^(style|classDef|class|click|linkStyle)\s/.test(trimmed)) continue;

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
        var label = decodeLabel(m[2] || m[3] || m[4] || m[5] || m[6] || id);
        // Skip tokens that are actually link keywords (shouldn't happen here but guard)
        if (id === 'block' || id === 'end' || id === 'columns') continue;
        result.elements.push({ kind: 'block', id: id, label: label, parentId: parent2, line: lineNum });
      }
    }
    return result;
  }

  function addBlock(text, id, label) {
    var token = label && label !== id ? id + '["' + encodeLabel(label) + '"]' : id;
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
    var token = label && label !== id ? id + '["' + encodeLabel(label) + '"]' : id;
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (isGroupStart(lines[i].trim(), parentId)) {
        var endIdx = findMatchingEnd(lines, i);
        if (endIdx === -1) return text;
        // Indent one step past the parent rather than a fixed four spaces. The text
        // is the source of truth here, so a child sitting at its parent's depth
        // reads as a sibling — the diagram is right but the diff lies about it.
        // Follow the parent's indent character too: mixing a tab-indented file with
        // spaces makes the new line look shallower than its siblings.
        var parentIndent = lines[i].match(/^(\s*)/)[1] || '';
        var step = parentIndent.indexOf('\t') !== -1 ? '\t' : '  ';
        var indent = parentIndent + step;
        // すでに子がいるなら、その字下げに合わせる。固定幅で足すと、4字下げで
        // 書かれたファイルに 2字下げの行が入り、隣と揃わない (実測: 既存の子が
        // 8 に対し足した子が 2)。図は描けるが、Git の差分にはそのまま出る。
        for (var ci = i + 1; ci < endIdx; ci++) {
          if (lines[ci].trim()) { indent = lines[ci].match(/^(\s*)/)[1] || indent; break; }
        }
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
        var idMatch = tok.match(new RegExp('^(' + ID + ')'));
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

    var linkRe = new RegExp('^(\\s*)(' + ID + ')\\s*(?:--\\s*"?[^"]*?"?\\s*)?-->\\s*(' + ID + ')\\s*$');
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

  // Rewrite one block token on a line, leaving every other token byte-identical.
  //
  // The tokens are found with BLOCK_TOKEN_RE — the same regex parseBlock uses —
  // so "which token is this block" means the same thing here as it does in the
  // parser. The previous implementation built its own `\b<id>` regex instead:
  // that has no closing boundary, so editing `a` on the line
  // `a["A"] ab["AB"] abc["ABC"]` also matched the head of `ab` and `abc` and
  // rewrote the line into `a["新"] a["新"]b["AB"] a["新"]bc["ABC"]`. mermaid
  // parses and renders that happily, so the blocks silently changed identity and
  // the links pointing at them grew phantom targets, with no error anywhere.
  //
  // `build(id, label)` returns the replacement token text.
  function replaceBlockToken(line, blockId, build) {
    var out = '', last = 0, m;
    BLOCK_TOKEN_RE.lastIndex = 0;
    while ((m = BLOCK_TOKEN_RE.exec(line)) !== null) {
      if (m[0] === '') { BLOCK_TOKEN_RE.lastIndex++; continue; }
      if (m[1] !== blockId) continue;
      var label = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4]);
      out += line.slice(last, m.index) + build(m[1], label === undefined ? null : label);
      last = m.index + m[0].length;
    }
    return out + line.slice(last);
  }

  // 引用の中の  は mermaid が受け付けない。 に逃がす (c4 と同じ手)。
  //  を先に逃がすのは、利用者が実際に  と打った場合を壊さないため。
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

  function updateBlockLabel(text, lineNum, blockId, newLabel) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    lines[idx] = replaceBlockToken(lines[idx], blockId, function(id) {
      return id + (newLabel ? '["' + encodeLabel(newLabel) + '"]' : '');
    });
    return lines.join('\n');
  }

  // Rename a block or group id, rewriting the links that point at it.
  //
  // Without the cascade the links keep the old id and mermaid quietly declares a
  // fresh block for it, so renaming grows a duplicate instead of moving one.
  // A rename onto an id that already exists is refused outright: mermaid would
  // merge the two blocks into one with no diagnostic, which reads as "my block
  // disappeared".
  function updateBlockId(text, lineNum, oldId, newId) {
    if (!newId) return text;
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;

    // Also the no-op guard for newId === oldId: the id is already in the
    // diagram, so it reads as a collision with itself and the rename stops.
    var existing = parseBlock(text).elements;
    for (var e = 0; e < existing.length; e++) {
      if (existing[e].id === newId) return text;
    }

    // A group header goes through the same token rewrite as a plain block:
    // BLOCK_TOKEN_RE sees `block:g1:2 columns 3` as the tokens `block`, `g1`,
    // `columns`, so replacing the `g1` token keeps the span and column counts
    // untouched. Special-casing the header would mean a second definition of
    // "which token is the id", which is how the neighbouring bugs got in.
    lines[idx] = replaceBlockToken(lines[idx], oldId, function(id, label) {
      return newId + (label === null ? '' : '["' + label + '"]');
    });

    for (var j = 0; j < lines.length; j++) {
      if (j === idx) continue;
      var lineIndent = lines[j].match(/^(\s*)/)[1];
      var lm = lines[j].trim().match(LINK_RE);
      if (!lm) continue;
      var from = lm[1] === oldId ? newId : lm[1];
      var to = lm[3] === oldId ? newId : lm[3];
      if (from === lm[1] && to === lm[3]) continue;
      var label = (lm[2] || '').trim();
      lines[j] = lineIndent + (label ? from + ' -- "' + label + '" --> ' + to : from + ' --> ' + to);
    }
    return lines.join('\n');
  }

  function updateLink(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = lines[idx].trim().match(LINK_RE);
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
    // 文書が入れ替わったら、モジュールが覚えている状態を捨てる。
    //
    // `lastAddParent` は「最後に足した親グループ」を覚えていて、
    // 同じ文書の中では便利だが、**別の文書を開いても残っていた**。
    // 実測: G1 を持つ文書で G1 に足したあと、**同じ名前の G1 を持つ
    // 別のファイルを開くと G1 が選ばれたまま**で、押すとその中に入る。
    // 実務では図をまたいで命名が揃うので普通に起きる。
    //
    // 「文書が入れ替わったら捨てる」は r15 (状態の持ち越し) で決めた規約。
    // gantt は resetTransientState を持っていたが、block は持っていなかった。
    resetTransientState: function() { lastAddParent = ''; },
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
    // Click-to-select on the diagram itself. Until now this only sized the
    // overlay and produced no hit areas, so block-beta could only be edited
    // through the properties list — the list is fine for four blocks and
    // unusable for forty.
    //
    // mermaid's block renderer puts the DSL id straight onto the node group
    // (`<g class="node ..." id="a">`), so the mapping is exact and does not need
    // to go through label text.
    buildOverlay: function(svgEl, parsedData, overlayEl) {
      var geom = window.MA.overlayGeom;
      geom.syncViewport(svgEl, overlayEl);
      if (!overlayEl || !svgEl || !parsedData) return;

      var byId = {};
      for (var i = 0; i < parsedData.elements.length; i++) {
        byId[parsedData.elements[i].id] = parsedData.elements[i];
      }

      var nodes = svgEl.querySelectorAll('.node');
      for (var n = 0; n < nodes.length; n++) {
        var el = byId[nodes[n].getAttribute('id')];
        if (!el) continue;
        var box = geom.boxInSvgSpace(svgEl, nodes[n]);
        if (!box) continue;
        overlayEl.appendChild(geom.hitRect(document, box, {
          id: el.id,
          kind: el.kind === 'group' ? 'group' : 'block',
          line: el.line,
          selected: window.MA.selection.isSelected(el.id),
          className: 'overlay-node',
        }));
      }
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
            '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">列数設定</label>' +
            P.fieldHtml('列数 (1-N)', 'block-set-cols', String(currentCols), '空欄=未設定') +
            P.primaryButtonHtml('block-set-cols-btn', '列数 適用') +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">ブロックを追加</label>' +
            P.fieldHtml('ID', 'block-add-id', '', '例: sensor') +
            P.fieldHtml('ラベル', 'block-add-label', '', '省略可、IDと同じ') +
            P.selectFieldHtml('親グループ', 'block-add-parent', groupOpts) +
            P.primaryButtonHtml('block-add-btn', '+ ブロック追加') +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">グループを追加</label>' +
            P.fieldHtml('ID', 'block-add-group-id', '', '例: mcu_group') +
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
        // Use the id the row was rendered for. Looking it up by line number picks
        // the first block on that line, and block-beta normally puts several on
        // one line — so pressing b's ✕ used to delete a, silently.
        P.bindDeleteButtons(propsEl, 'block-delete-block', ctx, function(t, ln, elId) {
          return elId ? deleteBlock(t, ln, elId) : t;
        });
        P.bindDeleteButtons(propsEl, 'block-delete-group', ctx, function(t, ln, elId) {
          return elId ? deleteBlock(t, ln, elId) : t;
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
            (el.kind === 'block' ? P.fieldHtml('ラベル', 'block-edit-label', el.label !== el.id ? el.label : '') : '') +
            P.connectButtonHtml('block-edit-connect') +
            P.dangerButtonHtml('block-edit-delete', '削除');

          var elLine = el.line, elId = el.id, elKind = el.kind;
          P.bindConnectButton('block-edit-connect', el.kind === 'group' ? 'group' : 'block', el.id,
            function(fromId, toId) { return addLink(ctx.getMmdText(), fromId, toId, ''); });
          // The ID field used to be rendered without a handler: it looked
          // editable, accepted typing, and threw the value away on blur.
          var idInput = document.getElementById('block-edit-id');
          if (idInput) {
            idInput.addEventListener('change', function() {
              var next = this.value.trim();
              if (!next || next === elId) { this.value = elId; return; }
              var updated = updateBlockId(ctx.getMmdText(), elLine, elId, next);
              if (updated === ctx.getMmdText()) {
                // Refused — the id is taken, or the shape was not recognised.
                // Putting the old value back is the only signal the panel has;
                // leaving the typed text in place would claim a rename happened.
                this.value = elId;
                return;
              }
              window.MA.history.pushHistory();
              ctx.setMmdText(updated);
              window.MA.selection.clearSelection();
              ctx.onUpdate();
            });
          }
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
        return deleteBlock(text, lineNum, opts.blockId || opts.id);
      },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        // 契約 (ADR-012) の識別子は opts.id。この図種だけ独自キーを要求していたため、
        // 契約通り opts.id で呼ぶと黙って空振りしていた。既存呼出しを壊さず受ける。
        var blockId = opts.blockId || opts.id;
        if (opts.kind === 'link') return updateLink(text, lineNum, field, value);
        if (field === 'columns') return setColumns(text, value);
        if (field === 'label') return updateBlockLabel(text, lineNum, blockId, value);
        return text;
      },
      // 素の行入れ替えは**図の宣言行と入れ替わって図を壊す**。
      // 同じ種類の要素が乗っている行としか入れ替えない。
      moveUp: function(text, lineNum) {
        return window.MA.textUpdater.moveElementLine(
          text, lineNum, -1, (parseBlock(text).elements || []));
      },
      moveDown: function(text, lineNum) {
        return window.MA.textUpdater.moveElementLine(
          text, lineNum, 1, (parseBlock(text).elements || []));
      },
      connect: function(text, fromId, toId, props) {
        props = props || {};
        return addLink(text, fromId, toId, props.label || '');
      },
    },
    addBlock: addBlock, addNestedBlock: addNestedBlock, addLink: addLink,
    deleteBlock: deleteBlock, deleteLink: deleteLink, deletionImpact: deletionImpact,
    updateBlockLabel: updateBlockLabel, updateBlockId: updateBlockId, updateLink: updateLink, setColumns: setColumns,
  };
})();
