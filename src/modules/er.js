'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.erDiagram = (function() {
  // ER relation pattern: cardinalities + dashes + cardinalities
  // We match: CARDINALITY -- CARDINALITY  (with -- being either '--' or '..')
  // Cardinality chars: |o, ||, }o, }|, o|, o{, |{
  // Pattern: ENTITY1 LEFTCARD--RIGHTCARD ENTITY2 : label
  var REL_RE = /([|}o]{2})(--|\.\.)([|{o]{2})/;

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
      var entityBlockMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*\{\s*$/);
      if (entityBlockMatch) {
        var eid = entityBlockMatch[1];
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
      var relMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s+([|}o]{2})(--|\.\.)([|{o]{2})\s+([A-Za-z_][A-Za-z0-9_-]*)\s*(?::\s*(.+))?$/);
      if (relMatch) {
        var fromId = relMatch[1];
        var leftCard = relMatch[2];
        var midDash = relMatch[3];
        var rightCard = relMatch[4];
        var toId = relMatch[5];
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

  function deleteEntity(text, lineNum) {
    // Find the entity block boundary (close brace) and remove block
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    // If the line is `ENTITY {`, find the matching `}`
    var trimmed = lines[idx].trim();
    if (/\{\s*$/.test(trimmed)) {
      var endIdx = idx;
      for (var j = idx + 1; j < lines.length; j++) {
        if (lines[j].trim() === '}') { endIdx = j; break; }
      }
      lines.splice(idx, (endIdx - idx + 1));
      return lines.join('\n');
    }
    // Otherwise just delete the single line
    return window.MA.textUpdater.deleteLine(text, lineNum);
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
    var newLine = '    ' + from + ' ' + leftCard + dashStyle + rightCard + ' ' + to + (label ? ' : ' + label : '');
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
    var m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s+([|}o]{2})(--|\.\.)([|{o]{2})\s+([A-Za-z_][A-Za-z0-9_-]*)\s*(?::\s*(.+))?$/);
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
    if (!overlayEl) return;
    while (overlayEl.firstChild) overlayEl.removeChild(overlayEl.firstChild);
    if (!svgEl) return;
    var viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) overlayEl.setAttribute('viewBox', viewBox);
    var svgW = svgEl.getAttribute('width');
    var svgH = svgEl.getAttribute('height');
    if (svgW) overlayEl.setAttribute('width', svgW);
    if (svgH) overlayEl.setAttribute('height', svgH);
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
      P.bindDeleteButtons(propsEl, 'er-delete-entity', ctx, deleteEntity);
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
        '<div style="margin-bottom:8px;color:var(--text-secondary);font-size:11px;">エンティティ: ' + escHtml(ent.id) + '</div>' +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">属性一覧</label>' +
          '<div>' + attrsList + '</div>' +
        '</div>' +
        P.actionBarHtml('sel-ent', {
          insertBefore: false, insertAfter: false,
          move: true, delete: true,
          labels: { delete: 'エンティティ削除' },
        });

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
          ctx.setMmdText(deleteEntity(ctx.getMmdText(), ent.line));
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
      delete: function(text, lineNum) { return window.MA.textUpdater.deleteLine(text, lineNum); },
      update: function(text, lineNum, field, value) {
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
    moveEntityUp: moveEntityUp,
    moveEntityDown: moveEntityDown,
    addAttribute: addAttribute,
    deleteAttribute: deleteAttribute,
    addRelationship: addRelationship,
    deleteRelationship: deleteRelationship,
    updateRelationship: updateRelationship,
  };
})();
