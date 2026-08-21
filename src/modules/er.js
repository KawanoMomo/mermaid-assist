'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.erDiagram = (function() {
  // ER relation pattern: cardinalities + dashes + cardinalities
  // We match: CARDINALITY -- CARDINALITY  (with -- being either '--' or '..')
  // Cardinality chars: |o, ||, }o, }|, o|, o{, |{
  // Pattern: ENTITY1 LEFTCARD--RIGHTCARD ENTITY2 : label
  var REL_RE = /([|}o]{2})(--|\.\.)([|{o]{2})/;

  // mermaid の ER は日本語名も引用符付き名も受け付ける。
  // こちらの parser だけ ASCII 限定だったため、「顧客 ||--o{ 注文」のような
  // 普通の図が**一覧にも重ね合わせにも一切出なかった** (mermaid は描画する)。
  // id は引用符を含まない形で持つ (本文の書き戻し時に quoteEntity で付け直す)。
  function unq(v) {
    var s2 = String(v == null ? '' : v);
    var inner = /^"[\s\S]*"$/.test(s2) ? s2.slice(1, -1) : s2;
    // 書いたときに &quot; へ逃がした " を戻す。
    // 戻さないと、入れた名前と一覧に出る名前が食い違う。
    return inner.replace(/&quot;/g, '"');
  }

  function parseER(text) {
    var result = {
      meta: {},
      elements: [],   // entities (with attributes)
      relations: [],
      groups: [],
    };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var relCounter = 0;
    var entityMap = {};
    var currentEntityId = null;

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^erDiagram/.test(trimmed)) continue;

      // End brace - closes entity block
      if (trimmed === '}') {
        currentEntityId = null;
        continue;
      }

      // Entity block start: ENTITY {
      var entityBlockMatch = trimmed.match(/^((?:"[^"]+"|[^\s{}|:"][^\s{}|:"]*))\s*\{\s*$/);
      if (entityBlockMatch) {
        var eid = unq(entityBlockMatch[1]);
        if (!entityMap[eid]) {
          var ee = { kind: 'entity', id: eid, label: eid, attributes: [], line: lineNum };
          result.elements.push(ee);
          entityMap[eid] = ee;
        }
        currentEntityId = eid;
        continue;
      }

      // Inside entity block: parse attribute
      // Format: type name [PK|FK|UK] [comment]
      if (currentEntityId && entityMap[currentEntityId]) {
        var attrMatch = trimmed.match(/^(\S+)\s+(\S+)(?:\s+(PK|FK|UK))?(?:\s+"([^"]+)")?\s*$/);
        if (attrMatch) {
          entityMap[currentEntityId].attributes.push({
            type: attrMatch[1],
            name: attrMatch[2],
            key: attrMatch[3] || '',
            comment: attrMatch[4] || '',
            line: lineNum,
          });
        }
        continue;
      }

      // Relationship line: ENTITY1 cardinality--cardinality ENTITY2 : label
      var relMatch = trimmed.match(/^((?:"[^"]+"|[^\s{}|:"][^\s{}|:"]*))\s+([|}o]{2})(--|\.\.)([|{o]{2})\s+((?:"[^"]+"|[^\s{}|:"][^\s{}|:"]*))\s*(?::\s*(.+))?$/);
      if (relMatch) {
        var fromId = unq(relMatch[1]);
        var leftCard = relMatch[2];
        var midDash = relMatch[3];
        var rightCard = relMatch[4];
        var toId = unq(relMatch[5]);
        var label = relMatch[6] || '';

        function ensureEntity(eid) {
          if (!entityMap[eid]) {
            var ne = { kind: 'entity', id: eid, label: eid, attributes: [], line: lineNum };
            result.elements.push(ne);
            entityMap[eid] = ne;
          }
        }
        ensureEntity(fromId);
        ensureEntity(toId);

        result.relations.push({
          kind: 'relationship',
          id: '__rel_' + (relCounter++),
          from: fromId,
          to: toId,
          leftCard: leftCard,
          rightCard: rightCard,
          dashStyle: midDash,
          label: label.trim(),
          line: lineNum,
        });
      }
    }

    return result;
  }

  // ── Updaters ──

  function addEntity(text, id) {
    var block = ['    ' + id + ' {', '    }'];
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice.apply(lines, [insertAt, 0].concat(block));
    return lines.join('\n');
  }

  function _isEntityLine(trimmed) {
    if (!trimmed) return false;
    if (trimmed.indexOf('%%') === 0) return false;
    if (/\|\||}o|o{|\|\{|}\||\.\./.test(trimmed)) return false; // relationship cardinality
    if (/^(erDiagram|}\s*$|{)/i.test(trimmed)) return false;
    return /^\w/.test(trimmed);
  }

  function _moveEntityStep(text, lineNum, direction) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var target = idx + direction;
    while (target >= 0 && target < lines.length) {
      var t = lines[target].trim();
      if (!t || t.indexOf('%%') === 0) { target += direction; continue; }
      if (_isEntityLine(t)) {
        var tmp = lines[idx];
        lines[idx] = lines[target];
        lines[target] = tmp;
        return lines.join('\n');
      }
      return text;
    }
    return text;
  }

  function moveEntityUp(text, lineNum) { return _moveEntityStep(text, lineNum, -1); }
  function moveEntityDown(text, lineNum) { return _moveEntityStep(text, lineNum, 1); }

  // Delete an entity: its attribute block and every relationship naming it.
  //
  // A relationship line declares *both* of its entities, so on the standard
  // template both CUSTOMER and ORDER report line 2. Deleting "the line" removed
  // the relationship and left `CUSTOMER { ... }` in place: the entity the user
  // clicked stayed on the canvas and the relationship they did not click
  // disappeared instead.
  //
  // `entityId` is optional so older single-argument callers keep working.
  // エンティティ名の変更。class と同じ理由 (R18 で発覚)。
  //
  // 選択時のパネルに入力欄が無く、名前を変えるにはテキストを直接触るしか
  // なかった。関係行の端点も追従させないと幽霊エンティティが生える。
  // エンティティ名はそのまま図に出る名前でもある。
  // 括弧・コロン・斜線などを含む名前は引用符で囲わないと parse が落ちる。
  // mermaid はラベル中の " をエスケープできないが、&quot; はそのまま " として
  // 描かれる (v11.13 実測)。囲む前に逃がす。
  function encQuote(v) {
    return String(v == null ? '' : v).replace(/"/g, '&quot;');
  }

  function quoteEntity(v) {
    var s = String(v == null ? '' : v);
    if (/^"[\s\S]*"$/.test(s)) return s;
    if (/^[A-Za-z0-9_\-぀-ヿ一-鿿０-ｚ]+$/.test(s)) return s;
    return '"' + encQuote(s) + '"';
  }

  function updateEntityName(text, lineNum, oldId, newId) {
    if (!newId || !String(newId).trim() || newId === oldId) return text;
    var existing = parseER(text).elements.map(function(e) { return e.id; });
    if (existing.indexOf(newId) >= 0) return text;

    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var indent = lines[i].match(/^(\s*)/)[1];
      var trimmed = lines[i].trim();
      if (!trimmed) continue;

      // `NAME {` の宣言
      var decl = trimmed.match(/^(\S+)\s*\{\s*$/);
      if (decl && decl[1] === oldId) {
        lines[i] = indent + quoteEntity(newId) + ' {';
        continue;
      }
      // 関係行 `A ||--o{ B : label`
      if (REL_RE.test(trimmed)) {
        var rel = trimmed.match(/^(\S+)(\s+\S+\s+)(\S+)(\s*:\s*.*)?$/);
        if (rel) {
          var left = rel[1] === oldId ? quoteEntity(newId) : rel[1];
          var right = rel[3] === oldId ? quoteEntity(newId) : rel[3];
          if (left !== rel[1] || right !== rel[3]) {
            lines[i] = indent + left + rel[2] + right + (rel[4] || '');
          }
        }
        continue;
      }
    }
    return lines.join('\n');
  }

  function deleteEntity(text, lineNum, entityId) {
    if (!entityId) {
      var lines0 = text.split('\n');
      var idx0 = lineNum - 1;
      if (idx0 < 0 || idx0 >= lines0.length) return text;
      var t0 = lines0[idx0].trim();
      if (/\{\s*$/.test(t0)) {
        var endIdx = idx0;
        for (var j = idx0 + 1; j < lines0.length; j++) {
          if (lines0[j].trim() === '}') { endIdx = j; break; }
        }
        lines0.splice(idx0, (endIdx - idx0 + 1));
        return lines0.join('\n');
      }
      return window.MA.textUpdater.deleteLine(text, lineNum);
    }

    var lines = text.split('\n');
    var out = [];
    var skipToBrace = false;
    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      if (skipToBrace) {
        if (trimmed === '}') skipToBrace = false;
        continue;
      }
      var block = trimmed.match(/^((?:"[^"]+"|[^\s{}|:"][^\s{}|:"]*))\s*\{\s*$/);
      if (block && block[1] === entityId) { skipToBrace = true; continue; }
      var rel = trimmed.match(/^((?:"[^"]+"|[^\s{}|:"][^\s{}|:"]*))\s+([|}o]{2})(--|\.\.)([|{o]{2})\s+((?:"[^"]+"|[^\s{}|:"][^\s{}|:"]*))\s*(?::\s*(.+))?$/);
      if (rel && (rel[1] === entityId || rel[5] === entityId)) continue;
      out.push(lines[i]);
    }
    return out.join('\n');
  }

  function addAttribute(text, entityId, type, name, key, comment) {
    // Find the entity block and insert before the closing }
    var lines = text.split('\n');
    var inBlock = false;
    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      if (!inBlock) {
        var m = trimmed.match(/^(\S+)\s*\{\s*$/);
        if (m && m[1] === entityId) inBlock = true;
      } else {
        if (trimmed === '}') {
          // Insert before this line
          var attrLine = '        ' + type + ' ' + name + (key ? ' ' + key : '') + (comment ? ' "' + comment + '"' : '');
          lines.splice(i, 0, attrLine);
          return lines.join('\n');
        }
      }
    }
    return text;
  }

  function deleteAttribute(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function addRelationship(text, from, to, leftCard, rightCard, label, dashStyle) {
    leftCard = leftCard || '||';
    rightCard = rightCard || 'o{';
    dashStyle = dashStyle || '--';
    // mermaid の erDiagram はラベルを省略できない。`A ||--o{ B` は
    // `Parse error on line 2` になり、**追加した瞬間に図全体が壊れる**。
    // 空の引用符なら通るので、ラベル未指定はそれを置く (実測で確認)。
    var labelPart = label ? ' : ' + label : ' : ""';
    var newLine = '    ' + from + ' ' + leftCard + dashStyle + rightCard + ' ' + to + labelPart;
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function deleteRelationship(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updateRelationship(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = trimmed.match(/^((?:"[^"]+"|[^\s{}|:"][^\s{}|:"]*))\s+([|}o]{2})(--|\.\.)([|{o]{2})\s+((?:"[^"]+"|[^\s{}|:"][^\s{}|:"]*))\s*(?::\s*(.+))?$/);
    if (!m) return text;
    var from = m[1], lc = m[2], dash = m[3], rc = m[4], to = m[5], label = m[6] || '';

    if (field === 'from') from = value;
    else if (field === 'to') to = value;
    else if (field === 'leftCard') lc = value;
    else if (field === 'rightCard') rc = value;
    else if (field === 'label') label = value;
    else if (field === 'dashStyle') dash = value;

    lines[idx] = indent + from + ' ' + lc + dash + rc + ' ' + to + (label ? ' : ' + label : '');
    return lines.join('\n');
  }

  // ── UI ──
  function buildOverlay(svgEl, parsedData, overlayEl) {
    // id="entity-<エンティティ名>-<連番>"
    window.MA.overlayGeom.buildNodeOverlay(svgEl, parsedData, overlayEl, {
      prefix: 'entity',
      kindOf: function() { return 'entity'; },
    });
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;

    if (!selData || selData.length === 0) {
      var entities = parsedData.elements.filter(function(e) { return e.kind === 'entity'; });
      var rels = parsedData.relations.filter(function(r) { return r.kind === 'relationship'; });

      var entityOpts = '';
      for (var ei = 0; ei < entities.length; ei++) entityOpts += '<option value="' + escHtml(entities[ei].id) + '">' + escHtml(entities[ei].label) + '</option>';
      if (!entityOpts) entityOpts = '<option value="">（エンティティを先に追加）</option>';

      var cards = ['||','|o','}o','}|','o|','o{','|{'];
      var leftCardOpts = '', rightCardOpts = '';
      for (var ci = 0; ci < cards.length; ci++) {
        leftCardOpts += '<option value="' + cards[ci] + '">' + cards[ci] + '</option>';
        rightCardOpts += '<option value="' + cards[ci] + '">' + cards[ci] + '</option>';
      }

      var keyOpts = '<option value="">なし</option><option value="PK">PK</option><option value="FK">FK</option><option value="UK">UK</option>';

      var entitiesList = '';
      for (var lei = 0; lei < entities.length; lei++) {
        var ent = entities[lei];
        entitiesList += P.listItemHtml({ label: ent.label, sublabel: '(' + ent.attributes.length + ' attrs)', selectClass: 'er-select-entity', deleteClass: 'er-delete-entity', dataElementId: ent.id, dataLine: ent.line });
      }
      if (!entitiesList) entitiesList = P.emptyListHtml('（エンティティなし）');

      var relsList = '';
      for (var lri = 0; lri < rels.length; lri++) {
        var rel = rels[lri];
        relsList += P.listItemHtml({ label: rel.from + ' ' + rel.leftCard + (rel.dashStyle || '--') + rel.rightCard + ' ' + rel.to + (rel.label ? ' : ' + rel.label : ''), selectClass: 'er-select-rel', deleteClass: 'er-delete-rel', dataElementId: rel.id, dataLine: rel.line, mono: true });
      }
      if (!relsList) relsList = P.emptyListHtml('（リレーションシップなし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">ER Diagram</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">エンティティを追加</label>' +
          '<div style="display:flex;gap:4px;">' +
            '<input id="er-add-ent-id" type="text" placeholder="ENTITY" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<button id="er-add-ent-btn" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+</button>' +
          '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">属性を追加</label>' +
          '<select id="er-add-attr-entity" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;margin-bottom:4px;">' + entityOpts + '</select>' +
          '<div style="display:flex;gap:4px;margin-bottom:4px;">' +
            '<input id="er-add-attr-type" type="text" placeholder="type" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<input id="er-add-attr-name" type="text" placeholder="name" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<select id="er-add-attr-key" style="flex:0 0 60px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' + keyOpts + '</select>' +
          '</div>' +
          P.fieldHtml('コメント', 'er-add-attr-comment', '', '') +
          P.primaryButtonHtml('er-add-attr-btn', '+ 属性追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">リレーションシップを追加</label>' +
          P.selectFieldHtml('From', 'er-add-rel-from', entities.length === 0 ? [{value: '', label: '（エンティティを先に追加）'}] : entities.map(function(e) { return { value: e.id, label: e.label }; })) +
          P.selectFieldHtml('Left card', 'er-add-rel-lc', cards.map(function(c) { return { value: c, label: c, selected: c === '||' }; }), true) +
          P.selectFieldHtml('Right card', 'er-add-rel-rc', cards.map(function(c) { return { value: c, label: c, selected: c === 'o{' }; }), true) +
          P.selectFieldHtml('To', 'er-add-rel-to', entities.length === 0 ? [{value: '', label: '（エンティティを先に追加）'}] : entities.map(function(e) { return { value: e.id, label: e.label }; })) +
          P.fieldHtml('ラベル', 'er-add-rel-label', '', 'has') +
          P.primaryButtonHtml('er-add-rel-btn', '+ リレーションシップ追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">エンティティ一覧</label>' +
          '<div>' + entitiesList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">リレーションシップ一覧</label>' +
          '<div>' + relsList + '</div>' +
        '</div>';

      P.bindEvent('er-add-ent-btn', 'click', function() {
        var id = document.getElementById('er-add-ent-id').value.trim();
        if (!id) { alert('IDは必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addEntity(ctx.getMmdText(), id));
        ctx.onUpdate();
      });
      P.bindEvent('er-add-attr-btn', 'click', function() {
        var entId = document.getElementById('er-add-attr-entity').value;
        var type = document.getElementById('er-add-attr-type').value.trim();
        var name = document.getElementById('er-add-attr-name').value.trim();
        var key = document.getElementById('er-add-attr-key').value;
        var comment = document.getElementById('er-add-attr-comment').value.trim();
        if (!entId || !type || !name) { alert('エンティティ、型、名前は必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addAttribute(ctx.getMmdText(), entId, type, name, key, comment));
        ctx.onUpdate();
      });
      P.bindEvent('er-add-rel-btn', 'click', function() {
        var from = document.getElementById('er-add-rel-from').value;
        var to = document.getElementById('er-add-rel-to').value;
        var lc = document.getElementById('er-add-rel-lc').value;
        var rc = document.getElementById('er-add-rel-rc').value;
        var label = document.getElementById('er-add-rel-label').value.trim();
        if (!from || !to) { alert('エンティティを先に追加してください'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addRelationship(ctx.getMmdText(), from, to, lc, rc, label, '--'));
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'er-select-entity', 'entity');
      // 関係行は両端のエンティティを宣言するので、id なしだと
      // 押していない方が消える
      P.bindDeleteButtons(propsEl, 'er-delete-entity', ctx, function(t, ln, elId) {
        return deleteEntity(t, ln, elId);
      });
      P.bindSelectButtons(propsEl, 'er-select-rel', 'relationship');
      P.bindDeleteButtons(propsEl, 'er-delete-rel', ctx, deleteRelationship);
      return;
    }

    // Single entity selected: show attributes
    if (selData.length === 1 && selData[0].type === 'entity') {
      var eid = selData[0].id;
      var ent = null;
      for (var pj = 0; pj < parsedData.elements.length; pj++) {
        if (parsedData.elements[pj].kind === 'entity' && parsedData.elements[pj].id === eid) { ent = parsedData.elements[pj]; break; }
      }
      if (!ent) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">エンティティが見つかりません</p>'; return; }
      var attrsList = '';
      for (var ai = 0; ai < ent.attributes.length; ai++) {
        var a = ent.attributes[ai];
        attrsList += P.listItemHtml({ label: a.type + ' ' + a.name + (a.key ? ' [' + a.key + ']' : ''), deleteClass: 'er-delete-attr', dataLine: a.line, mono: true });
      }
      if (!attrsList) attrsList = P.emptyListHtml('（属性なし）');
      propsEl.innerHTML =
        P.panelHeaderHtml(ent.label) +
        // 名前を変えられるようにする (R18 で発覚した取り残し)。
        P.fieldHtml('ID', 'sel-ent-name', ent.id) +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">属性一覧</label>' +
          '<div>' + attrsList + '</div>' +
        '</div>' +
        P.connectButtonHtml('sel-ent-connect') +
        P.actionBarHtml('sel-ent', {
          insertBefore: false, insertAfter: false,
          // move は無効。_is*Line が「宣言行か」で判定しており、属性行 (`string name`) をエンティティ行と誤判定し、ブロック構造を破壊する。
          // mermaid の parse も render も通るため無言で壊れる。述語をブレース深度
          // ベースに直すまで UI から出さない (敵対レビュー指摘)。
          move: false, delete: true,
          labels: { delete: 'エンティティ削除' },
        });

      var entNameEl = document.getElementById('sel-ent-name');
      if (entNameEl) {
        entNameEl.addEventListener('change', function() {
          var next = entNameEl.value.trim();
          if (!next || next === ent.id) return;
          var updated = updateEntityName(ctx.getMmdText(), ent.line, ent.id, next);
          if (updated === ctx.getMmdText()) {
            if (ctx.showTransient) ctx.showTransient('その名前は既に使われています — 別の名前にしてください', 3000);
            entNameEl.value = ent.id;
            return;
          }
          window.MA.history.pushHistory();
          ctx.setMmdText(updated);
          window.MA.selection.setSelected([{ type: 'entity', id: next }]);
          ctx.onUpdate();
        });
      }

      P.bindConnectButton('sel-ent-connect', 'entity', ent.id,
        function(fromId, toId) { return addRelationship(ctx.getMmdText(), fromId, toId); });

      P.bindActionBar('sel-ent', {
        up: function() {
          var newText = moveEntityUp(ctx.getMmdText(), ent.line);
          if (newText === ctx.getMmdText()) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(newText);
          window.MA.selection.setSelected([{ type: 'entity', id: ent.id }]);
          ctx.onUpdate();
        },
        down: function() {
          var newText = moveEntityDown(ctx.getMmdText(), ent.line);
          if (newText === ctx.getMmdText()) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(newText);
          window.MA.selection.setSelected([{ type: 'entity', id: ent.id }]);
          ctx.onUpdate();
        },
        'delete': function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteEntity(ctx.getMmdText(), ent.line, ent.id));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        },
      });
      P.bindDeleteButtons(propsEl, 'er-delete-attr', ctx, deleteAttribute);
      return;
    }

    // Single relationship selected
    if (selData.length === 1 && selData[0].type === 'relationship') {
      var rid = selData[0].id;
      var rel2 = null;
      for (var rj = 0; rj < parsedData.relations.length; rj++) {
        if (parsedData.relations[rj].id === rid) { rel2 = parsedData.relations[rj]; break; }
      }
      if (!rel2) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">リレーションシップが見つかりません</p>'; return; }
      var entities2 = parsedData.elements.filter(function(e) { return e.kind === 'entity'; });
      var fromOpts = '', toOpts = '';
      for (var fi = 0; fi < entities2.length; fi++) {
        var fid = entities2[fi].id;
        fromOpts += '<option value="' + escHtml(fid) + '"' + (fid === rel2.from ? ' selected' : '') + '>' + escHtml(entities2[fi].label) + '</option>';
        toOpts += '<option value="' + escHtml(fid) + '"' + (fid === rel2.to ? ' selected' : '') + '>' + escHtml(entities2[fi].label) + '</option>';
      }
      var cards2 = ['||','|o','}o','}|','o|','o{','|{'];
      var lcOpts = '', rcOpts2 = '';
      for (var ci2 = 0; ci2 < cards2.length; ci2++) {
        lcOpts += '<option value="' + cards2[ci2] + '"' + (cards2[ci2] === rel2.leftCard ? ' selected' : '') + '>' + cards2[ci2] + '</option>';
        rcOpts2 += '<option value="' + cards2[ci2] + '"' + (cards2[ci2] === rel2.rightCard ? ' selected' : '') + '>' + cards2[ci2] + '</option>';
      }
      propsEl.innerHTML =
        P.panelHeaderHtml('Relationship') +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">From</label><select id="sel-rel-from" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + fromOpts + '</select></div>' +
        '<div style="margin-bottom:8px;display:flex;gap:4px;">' +
          '<div style="flex:1;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">Left card</label><select id="sel-rel-lc" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;font-family:var(--font-mono);">' + lcOpts + '</select></div>' +
          '<div style="flex:1;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">Right card</label><select id="sel-rel-rc" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;font-family:var(--font-mono);">' + rcOpts2 + '</select></div>' +
        '</div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">To</label><select id="sel-rel-to" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + toOpts + '</select></div>' +
        P.fieldHtml('ラベル', 'sel-rel-label', rel2.label) +
        P.actionBarHtml('sel-rel', {
          insertBefore: false, insertAfter: false,
          move: false, delete: true,
          labels: { delete: 'リレーションシップ削除' },
        });

      document.getElementById('sel-rel-from').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateRelationship(ctx.getMmdText(), rel2.line, 'from', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-rel-lc').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateRelationship(ctx.getMmdText(), rel2.line, 'leftCard', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-rel-rc').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateRelationship(ctx.getMmdText(), rel2.line, 'rightCard', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-rel-to').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateRelationship(ctx.getMmdText(), rel2.line, 'to', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-rel-label').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateRelationship(ctx.getMmdText(), rel2.line, 'label', this.value)); ctx.onUpdate(); });
      P.bindDeleteButtons(propsEl, 'er-delete-rel', ctx, deleteRelationship);
      P.bindActionBar('sel-rel', {
        'delete': function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteRelationship(ctx.getMmdText(), rel2.line));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        },
      });
      return;
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'erDiagram',
    displayName: 'ER',
    detect: function(text) {
      return window.MA.parserUtils.detectDiagramType(text) === 'erDiagram';
    },
    parse: parseER,
    template: function() {
      return [
        'erDiagram',
        '    CUSTOMER ||--o{ ORDER : places',
        '    CUSTOMER {',
        '        string name',
        '        string email',
        '    }',
        '    ORDER {',
        '        int id PK',
        '        date created',
        '    }',
      ].join('\n');
    },
    buildOverlay: buildOverlay,
    renderProps: renderProps,
    operations: {
      add: function(text, kind, props) {
        if (kind === 'entity') return addEntity(text, props.id);
        if (kind === 'attribute') return addAttribute(text, props.entityId, props.type, props.name, props.key, props.comment);
        if (kind === 'relationship') return addRelationship(text, props.from, props.to, props.leftCard, props.rightCard, props.label, props.dashStyle);
        return text;
      },
      // 契約経由の削除も id 認識の実装を使う。
      // 以前は単なる deleteLine で、要素は「最初に現れた行」を持つため、
      // 関係行だけが消えて宣言が残っていた。mermaid は参照だけで要素を作るので
      // **一覧から消えても図には残る**。UI 経路だけ直して契約経路を忘れる形の再発。
      delete: function(text, lineNum, opts) {
        opts = opts || {};
        return deleteEntity(text, lineNum, opts.id);
      },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        // エンティティ名の変更も統一入口から使えるようにする (class と同じ理由)。
        if (field === 'name' || field === 'id' || field === 'label') {
          var trimmed = (text.split('\n')[lineNum - 1] || '').trim();
          var decl = trimmed.match(/^(\S+)\s*\{\s*$/);
          var oldId = opts.id || (decl ? decl[1] : null);
          if (oldId) return updateEntityName(text, lineNum, oldId, value);
        }
        return updateRelationship(text, lineNum, field, value);
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
        return addRelationship(text, fromId, toId, props.leftCard || '||', props.rightCard || 'o{', props.label, props.dashStyle || '--');
      },
    },
    parseER: parseER,
    addEntity: addEntity,
    deleteEntity: deleteEntity,
    updateEntityName: updateEntityName,
    moveEntityUp: moveEntityUp,
    moveEntityDown: moveEntityDown,
    addAttribute: addAttribute,
    deleteAttribute: deleteAttribute,
    addRelationship: addRelationship,
    deleteRelationship: deleteRelationship,
    updateRelationship: updateRelationship,
  };
})();
