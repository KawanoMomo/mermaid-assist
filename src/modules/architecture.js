'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.architectureBeta = (function() {
  var ICONS = ['cloud', 'database', 'disk', 'server', 'internet'];
  var SIDES = ['T', 'B', 'L', 'R'];

  function parseArchitecture(text) {
    var result = { meta: {}, elements: [], relations: [], groups: [] };
    if (!text || !text.trim()) return result;
    var lines = text.split('\n');
    var edgeCounter = 0;

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^architecture-beta/.test(trimmed)) continue;

      // group <id>(<icon>)[<label>]
      var gm = trimmed.match(/^group\s+(\S+)\s*\(([^)]+)\)\s*\[([^\]]*)\]\s*(?:in\s+(\S+))?\s*$/);
      if (gm) {
        result.groups.push({
          kind: 'group', id: gm[1], icon: gm[2], label: unquoteLabel(gm[3]),
          parentId: gm[4] || null, line: lineNum,
        });
        continue;
      }

      // service <id>(<icon>)[<label>] [in <group>]
      var sm = trimmed.match(/^service\s+(\S+)\s*\(([^)]+)\)\s*\[([^\]]*)\]\s*(?:in\s+(\S+))?\s*$/);
      if (sm) {
        result.elements.push({
          kind: 'service', id: sm[1], icon: sm[2], label: unquoteLabel(sm[3]),
          parentId: sm[4] || null, line: lineNum,
        });
        continue;
      }

      // Edge: srcId:srcSide -- tgtSide:tgtId [with arrow? minimal variant]
      var em = trimmed.match(/^(\S+):([TBLR])\s+--\s+([TBLR]):(\S+)\s*$/);
      if (em) {
        result.relations.push({
          kind: 'edge', id: '__e_' + (edgeCounter++),
          from: em[1], fromSide: em[2],
          to: em[4], toSide: em[3],
          line: lineNum,
        });
      }
    }
    return result;
  }

  // architecture のラベルは `[…]` にそのまま置かれる。半角英数字・下線・空白しか
  // 通らないので、日本語を入れると字句解析が落ちる。
  //
  // 「引用符で囲んでも通らない」と記録していたが、**実測すると通る**
  // (`service a(server)["設計"]` → 「設計」を描画、v11.13)。
  // 記録の方が誤っており、直せない制限として扱っていた。
  // 組込の構成図で日本語が使えないのは実務上大きい。
  function quoteLabel(v) {
    var s2 = String(v == null ? '' : v);
    if (/^"[\s\S]*"$/.test(s2)) return s2;
    if (/^[A-Za-z0-9_ ]*$/.test(s2)) return s2;
    return '"' + s2.replace(/"/g, '&quot;') + '"';
  }

  // 読むときは引用符を外す (入れた文字と一覧に出る文字を一致させる)。
  function unquoteLabel(v) {
    var s2 = String(v == null ? '' : v);
    var inner = /^"[\s\S]*"$/.test(s2) ? s2.slice(1, -1) : s2;
    return inner.replace(/&quot;/g, '"');
  }

  function addGroup(text, id, icon, label, parent) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    var line = '    group ' + id + '(' + icon + ')[' + quoteLabel(label) + ']' + (parent ? ' in ' + parent : '');
    lines.splice(insertAt, 0, line);
    return lines.join('\n');
  }

  function addService(text, id, icon, label, parent) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    var line = '    service ' + id + '(' + icon + ')[' + quoteLabel(label) + ']' + (parent ? ' in ' + parent : '');
    lines.splice(insertAt, 0, line);
    return lines.join('\n');
  }

  function addEdge(text, from, fromSide, toSide, to) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, '    ' + from + ':' + fromSide + ' -- ' + toSide + ':' + to);
    return lines.join('\n');
  }

  function deleteLine(text, lineNum) { return window.MA.textUpdater.deleteLine(text, lineNum); }

  // Delete a group or service together with everything that names it.
  //
  // Deleting the line on its own left `service db(database)[DB] in api` pointing
  // at a group that no longer exists, and mermaid refused the whole diagram.
  // Same for a service: the edges naming it stayed behind.
  //
  // A group's members are not deleted — they just leave the group. Removing
  // someone's boxes because the box around them went away is not what the ✕ on
  // the group row promises.
  function deleteElement(text, lineNum, elementId) {
    if (!elementId) return deleteLine(text, lineNum);
    var lines = text.split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var indent = lines[i].match(/^(\s*)/)[1];
      var trimmed = lines[i].trim();

      var decl = trimmed.match(/^(group|service)\s+(\S+)\s*\(([^)]+)\)\s*\[([^\]]*)\]\s*(?:in\s+(\S+))?\s*$/);
      if (decl) {
        if (decl[2] === elementId) continue;              // 本体
        if (decl[5] === elementId) {                      // 消えたグループの中身
          out.push(indent + decl[1] + ' ' + decl[2] + '(' + decl[3] + ')[' + decl[4] + ']');
          continue;
        }
        out.push(lines[i]);
        continue;
      }

      var edge = trimmed.match(/^(\S+):([TBLR])(\s+--\s+)([TBLR]):(\S+)\s*$/);
      if (edge && (edge[1] === elementId || edge[5] === elementId)) continue;

      out.push(lines[i]);
    }
    return out.join('\n');
  }

  function updateElement(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var trimmed = lines[idx].trim();
    // group or service
    var m = trimmed.match(/^(group|service)\s+(\S+)\s*\(([^)]+)\)\s*\[([^\]]*)\]\s*(?:in\s+(\S+))?\s*$/);
    if (!m) return text;
    var kind = m[1], id = m[2], icon = m[3], label = m[4], parent = m[5] || '';
    var oldId = id;
    if (field === 'id') id = value;
    else if (field === 'icon') icon = value;
    else if (field === 'label') label = value;
    else if (field === 'parentId') parent = value;
    else if (field === 'kind') kind = value;
    lines[idx] = indent + kind + ' ' + id + '(' + icon + ')[' + quoteLabel(label) + ']' + (parent ? ' in ' + parent : '');
    if (field === 'id' && value !== oldId) renameRefs(lines, oldId, value, idx);
    return lines.join('\n');
  }

  // Rewrite the references to a renamed id: the two endpoints of an edge line
  // and the `in <parent>` clause of anything nested under a renamed group.
  // Leaving them behind makes mermaid refuse the whole diagram
  // ("The left-hand id [x] does not yet exist"), so the preview is replaced by
  // an error that names an id the user can no longer see anywhere.
  //
  // Labels are free text and keep the old string even when it matches the id.
  function renameRefs(lines, oldId, newId, skipIdx) {
    for (var j = 0; j < lines.length; j++) {
      var indent = lines[j].match(/^(\s*)/)[1];
      var trimmed = lines[j].trim();
      if (!trimmed) continue;

      if (j !== skipIdx) {
        // group/service ... in <parent>  — same shape as parseArchitecture
        var em = trimmed.match(/^(group|service)\s+(\S+)\s*\(([^)]+)\)\s*\[([^\]]*)\]\s*in\s+(\S+)\s*$/);
        if (em && em[5] === oldId) {
          lines[j] = indent + em[1] + ' ' + em[2] + '(' + em[3] + ')[' + em[4] + '] in ' + newId;
          continue;
        }
      }

      // <id>:<side> -- <side>:<id>
      var edge = trimmed.match(/^(\S+):([TBLR])(\s+--\s+)([TBLR]):(\S+)\s*$/);
      if (edge) {
        var from = edge[1] === oldId ? newId : edge[1];
        var to = edge[5] === oldId ? newId : edge[5];
        lines[j] = indent + from + ':' + edge[2] + edge[3] + edge[4] + ':' + to;
      }
    }
  }

  function updateEdge(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = lines[idx].trim().match(/^(\S+):([TBLR])\s+--\s+([TBLR]):(\S+)\s*$/);
    if (!m) return text;
    var from = m[1], fromSide = m[2], toSide = m[3], to = m[4];
    if (field === 'from') from = value;
    else if (field === 'to') to = value;
    else if (field === 'fromSide') fromSide = value;
    else if (field === 'toSide') toSide = value;
    lines[idx] = indent + from + ':' + fromSide + ' -- ' + toSide + ':' + to;
    return lines.join('\n');
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var services = parsedData.elements.filter(function(e) { return e.kind === 'service'; });
    var groups = parsedData.groups;
    var edges = parsedData.relations;

    if (!selData || selData.length === 0) {
      var iconOpts = ICONS.map(function(ic) { return { value: ic, label: ic }; });
      var groupOpts = [{ value: '', label: '（なし・トップ）' }].concat(groups.map(function(g) { return { value: g.id, label: g.id }; }));
      var serviceOpts = services.map(function(s) { return { value: s.id, label: s.id }; });
      if (serviceOpts.length === 0) serviceOpts = [{ value: '', label: '（サービスを先に追加）' }];
      var sideOpts = SIDES.map(function(s) { return { value: s, label: s, selected: s === 'R' }; });

      var groupsList = '';
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        groupsList += P.listItemHtml({
          label: 'group ' + g.id + '(' + g.icon + ')[' + g.label + ']',
          sublabel: g.parentId ? 'in ' + g.parentId : '',
          selectClass: 'arch-select-group', deleteClass: 'arch-delete-group',
          dataElementId: g.id, dataLine: g.line, mono: true,
        });
      }
      if (!groupsList) groupsList = P.emptyListHtml('（グループなし）');

      var servicesList = '';
      for (var si = 0; si < services.length; si++) {
        var s = services[si];
        servicesList += P.listItemHtml({
          label: 'service ' + s.id + '(' + s.icon + ')[' + s.label + ']',
          sublabel: s.parentId ? 'in ' + s.parentId : '',
          selectClass: 'arch-select-service', deleteClass: 'arch-delete-service',
          dataElementId: s.id, dataLine: s.line, mono: true,
        });
      }
      if (!servicesList) servicesList = P.emptyListHtml('（サービスなし）');

      var edgesList = '';
      for (var ei = 0; ei < edges.length; ei++) {
        var e = edges[ei];
        edgesList += P.listItemHtml({
          label: e.from + ':' + e.fromSide + ' -- ' + e.toSide + ':' + e.to,
          selectClass: 'arch-select-edge', deleteClass: 'arch-delete-edge',
          dataElementId: e.id, dataLine: e.line, mono: true,
        });
      }
      if (!edgesList) edgesList = P.emptyListHtml('（エッジなし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Architecture</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">グループを追加</label>' +
          P.fieldHtml('ID', 'arch-add-g-id', '', '例: api') +
          P.selectFieldHtml('Icon', 'arch-add-g-icon', iconOpts) +
          P.fieldHtml('ラベル', 'arch-add-g-label', '', '例: API Cluster') +
          P.selectFieldHtml('親グループ', 'arch-add-g-parent', groupOpts) +
          P.primaryButtonHtml('arch-add-g-btn', '+ グループ追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">サービスを追加</label>' +
          P.fieldHtml('ID', 'arch-add-s-id', '', '例: db') +
          P.selectFieldHtml('Icon', 'arch-add-s-icon', iconOpts) +
          P.fieldHtml('ラベル', 'arch-add-s-label', '', '例: Database') +
          P.selectFieldHtml('親グループ', 'arch-add-s-parent', groupOpts) +
          P.primaryButtonHtml('arch-add-s-btn', '+ サービス追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">エッジを追加</label>' +
          P.selectFieldHtml('From', 'arch-add-e-from', serviceOpts) +
          P.selectFieldHtml('From side', 'arch-add-e-fside', sideOpts) +
          P.selectFieldHtml('To side', 'arch-add-e-tside', sideOpts) +
          P.selectFieldHtml('To', 'arch-add-e-to', serviceOpts) +
          P.primaryButtonHtml('arch-add-e-btn', '+ エッジ追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">グループ一覧</label>' +
          '<div>' + groupsList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">サービス一覧</label>' +
          '<div>' + servicesList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">エッジ一覧</label>' +
          '<div>' + edgesList + '</div>' +
        '</div>';

      P.bindEvent('arch-add-g-btn', 'click', function() {
        var id = document.getElementById('arch-add-g-id').value.trim();
        var icon = document.getElementById('arch-add-g-icon').value;
        var label = document.getElementById('arch-add-g-label').value.trim();
        var parent = document.getElementById('arch-add-g-parent').value;
        if (!id || !label) { alert('ID と Label 必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addGroup(ctx.getMmdText(), id, icon, label, parent));
        ctx.onUpdate();
      });
      P.bindEvent('arch-add-s-btn', 'click', function() {
        var id = document.getElementById('arch-add-s-id').value.trim();
        var icon = document.getElementById('arch-add-s-icon').value;
        var label = document.getElementById('arch-add-s-label').value.trim();
        var parent = document.getElementById('arch-add-s-parent').value;
        if (!id || !label) { alert('ID と Label 必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addService(ctx.getMmdText(), id, icon, label, parent));
        ctx.onUpdate();
      });
      P.bindEvent('arch-add-e-btn', 'click', function() {
        var from = document.getElementById('arch-add-e-from').value;
        var fside = document.getElementById('arch-add-e-fside').value;
        var tside = document.getElementById('arch-add-e-tside').value;
        var to = document.getElementById('arch-add-e-to').value;
        if (!from || !to) { alert('From/To 必須'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addEdge(ctx.getMmdText(), from, fside, tside, to));
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'arch-select-group', 'group');
      P.bindSelectButtons(propsEl, 'arch-select-service', 'service');
      P.bindSelectButtons(propsEl, 'arch-select-edge', 'edge');
      // 3引数目は data-element-id。無いと `in <group>` やエッジが残り、
      // 存在しない要素を指したまま mermaid が図全体を拒否する
      P.bindDeleteButtons(propsEl, 'arch-delete-group', ctx, function(t, ln, elId) {
        return deleteElement(t, ln, elId);
      });
      P.bindDeleteButtons(propsEl, 'arch-delete-service', ctx, function(t, ln, elId) {
        return deleteElement(t, ln, elId);
      });
      P.bindDeleteButtons(propsEl, 'arch-delete-edge', ctx, deleteLine);
      return;
    }

    if (selData.length === 1) {
      var sel = selData[0];
      if (sel.type === 'group' || sel.type === 'service') {
        var list = sel.type === 'group' ? groups : services;
        var el = null;
        for (var i = 0; i < list.length; i++) if (list[i].id === sel.id) { el = list[i]; break; }
        if (!el) { propsEl.innerHTML = '<p>要素が見つかりません</p>'; return; }
        var iconOpts2 = ICONS.map(function(ic) { return { value: ic, label: ic, selected: ic === el.icon }; });
        var groupOpts2 = [{ value: '', label: '（なし・トップ）' }].concat(groups.map(function(g) { return { value: g.id, label: g.id, selected: g.id === el.parentId }; }));
        propsEl.innerHTML =
          P.panelHeaderHtml(el.id) +
          P.fieldHtml('ID', 'arch-edit-id', el.id) +
          P.selectFieldHtml('Icon', 'arch-edit-icon', iconOpts2) +
          P.fieldHtml('ラベル', 'arch-edit-label', el.label) +
          P.selectFieldHtml('親グループ', 'arch-edit-parent', groupOpts2) +
          P.dangerButtonHtml('arch-edit-delete', '削除');
        var ln = el.line;
        ['id', 'icon', 'label', 'parent'].forEach(function(f) {
          var input = document.getElementById('arch-edit-' + f);
          if (input) input.addEventListener('change', function() {
            window.MA.history.pushHistory();
            var key = f === 'parent' ? 'parentId' : f;
            ctx.setMmdText(updateElement(ctx.getMmdText(), ln, key, this.value));
            ctx.onUpdate();
          });
        });
        P.bindEvent('arch-edit-delete', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteLine(ctx.getMmdText(), ln));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        });
        return;
      }
      if (sel.type === 'edge') {
        var edge = null;
        for (var ei = 0; ei < edges.length; ei++) if (edges[ei].id === sel.id) { edge = edges[ei]; break; }
        if (!edge) { propsEl.innerHTML = '<p>エッジが見つかりません</p>'; return; }
        var serviceOpts2 = services.map(function(s) { return { value: s.id, label: s.id }; });
        var fromOpts = serviceOpts2.map(function(o) { return { value: o.value, label: o.label, selected: o.value === edge.from }; });
        var toOpts = serviceOpts2.map(function(o) { return { value: o.value, label: o.label, selected: o.value === edge.to }; });
        var fSideOpts = SIDES.map(function(s) { return { value: s, label: s, selected: s === edge.fromSide }; });
        var tSideOpts = SIDES.map(function(s) { return { value: s, label: s, selected: s === edge.toSide }; });
        propsEl.innerHTML =
          P.panelHeaderHtml(edge.from + ':' + edge.fromSide + ' → ' + edge.toSide + ':' + edge.to) +
          P.selectFieldHtml('From', 'arch-edit-e-from', fromOpts) +
          P.selectFieldHtml('From side', 'arch-edit-e-fside', fSideOpts) +
          P.selectFieldHtml('To side', 'arch-edit-e-tside', tSideOpts) +
          P.selectFieldHtml('To', 'arch-edit-e-to', toOpts) +
          P.dangerButtonHtml('arch-edit-e-delete', 'エッジ削除');
        var eln = edge.line;
        ['from', 'fside', 'tside', 'to'].forEach(function(f) {
          var input = document.getElementById('arch-edit-e-' + f);
          if (input) input.addEventListener('change', function() {
            window.MA.history.pushHistory();
            var key = f === 'fside' ? 'fromSide' : (f === 'tside' ? 'toSide' : f);
            ctx.setMmdText(updateEdge(ctx.getMmdText(), eln, key, this.value));
            ctx.onUpdate();
          });
        });
        P.bindEvent('arch-edit-e-delete', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteLine(ctx.getMmdText(), eln));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        });
        return;
      }
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'architecture-beta',
    displayName: 'Architecture',
    ICONS: ICONS, SIDES: SIDES,
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'architecture-beta'; },
    parse: parseArchitecture,
    parseArchitecture: parseArchitecture,
    template: function() {
      return [
        'architecture-beta',
        '    group api(cloud)[API Cluster]',
        '    service db(database)[Database] in api',
        '    service disk1(disk)[Storage] in api',
        '    service server(server)[Server] in api',
        '    service gateway(internet)[Gateway]',
        '    db:L -- R:server',
        '    disk1:T -- B:server',
        '    gateway:R -- L:server',
      ].join('\n');
    },
    buildOverlay: function(svgEl, parsedData, overlayEl) {
      // mermaid は service を <g id="service-<id>" class="architecture-service">
      // で描く。flowchart 系のような末尾連番は付かないので prefix を自前で外す。
      // group は <rect id="group-..."> で g ではないため、ここではサービスだけ。
      window.MA.overlayGeom.buildNodeOverlay(svgEl, parsedData, overlayEl, {
        selector: '.architecture-service',
        svgIdToKey: function(svgId) {
          var m = String(svgId || '').match(/^service-(.+)$/);
          return m ? m[1] : null;
        },
        kindOf: function() { return 'service'; },
      });
    },
    renderProps: renderProps,
    operations: {
      add: function(text, kind, props) {
        if (kind === 'group') return addGroup(text, props.id, props.icon, props.label, props.parent);
        if (kind === 'service') return addService(text, props.id, props.icon, props.label, props.parent);
        if (kind === 'edge') return addEdge(text, props.from, props.fromSide, props.toSide, props.to);
        return text;
      },
      delete: function(text, lineNum) { return deleteLine(text, lineNum); },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        if (opts.kind === 'edge') return updateEdge(text, lineNum, field, value);
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
        return addEdge(text, fromId, props.fromSide || 'R', props.toSide || 'L', toId);
      },
    },
    addGroup: addGroup, addService: addService, addEdge: addEdge,
    deleteLine: deleteLine,
    deleteElement: deleteElement, updateElement: updateElement, updateEdge: updateEdge,
  };
})();
