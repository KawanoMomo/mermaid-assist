'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.classDiagram = (function() {
  // Relation patterns (longest first for greedy matching)
  var RELATION_TYPES = ['<|--', '<|..', '*--', 'o--', '..>', '-->', '--'];

  function parseClass(text) {
    var result = {
      meta: {},
      elements: [],   // classes (with members)
      relations: [],  // relationships
      groups: [],     // namespaces
    };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var relCounter = 0;
    var nsStack = [];
    var classMap = {}; // id -> class element
    var currentClassId = null; // for class block parsing

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^classDiagram/.test(trimmed)) continue;

      // namespace start
      var nsMatch = trimmed.match(/^namespace\s+(\S+)\s*\{?\s*$/);
      if (nsMatch) {
        var nsId = nsMatch[1];
        result.groups.push({
          kind: 'namespace',
          id: nsId,
          line: lineNum,
          endLine: -1,
          label: nsId,
        });
        nsStack.push(nsId);
        continue;
      }

      // End brace (closes namespace or class block)
      if (trimmed === '}') {
        if (currentClassId) {
          currentClassId = null;
          continue;
        }
        if (nsStack.length > 0) {
          var closingNs = nsStack.pop();
          for (var gi = result.groups.length - 1; gi >= 0; gi--) {
            if (result.groups[gi].id === closingNs && result.groups[gi].kind === 'namespace') {
              result.groups[gi].endLine = lineNum; break;
            }
          }
        }
        continue;
      }

      // Class block start: class Name {
      var classBlockMatch = trimmed.match(/^class\s+(\S+)\s*\{\s*$/);
      if (classBlockMatch) {
        var cid = classBlockMatch[1];
        if (!classMap[cid]) {
          var ce = { kind: 'class', id: cid, label: cid, members: [], line: lineNum };
          result.elements.push(ce);
          classMap[cid] = ce;
        }
        currentClassId = cid;
        continue;
      }

      // Standalone class declaration: class Name
      var classDeclMatch = trimmed.match(/^class\s+(\S+)\s*$/);
      if (classDeclMatch) {
        var cid2 = classDeclMatch[1];
        if (!classMap[cid2]) {
          var ce2 = { kind: 'class', id: cid2, label: cid2, members: [], line: lineNum };
          result.elements.push(ce2);
          classMap[cid2] = ce2;
        }
        continue;
      }

      // Member line (inside a class block)
      if (currentClassId && classMap[currentClassId]) {
        // Try method first: visibility + name + (params) + optional return type
        var methodMatch = trimmed.match(/^([+\-#~]?)([^()]+?)(\([^)]*\))\s*(.*)$/);
        if (methodMatch && methodMatch[2]) {
          var mName = methodMatch[2].trim();
          if (mName) {
            classMap[currentClassId].members.push({
              kind: 'method',
              visibility: methodMatch[1] || '',
              name: mName,
              params: methodMatch[3] || '',
              type: methodMatch[4] ? methodMatch[4].trim() : '',
              line: lineNum,
            });
          }
        } else {
          // Attribute: visibility + everything else as name
          var attrMatch = trimmed.match(/^([+\-#~]?)(.+)$/);
          if (attrMatch && attrMatch[2]) {
            var aName = attrMatch[2].trim();
            if (aName) {
              classMap[currentClassId].members.push({
                kind: 'attribute',
                visibility: attrMatch[1] || '',
                name: aName,
                params: '',
                type: '',
                line: lineNum,
              });
            }
          }
        }
        continue;
      }

      // Member with explicit class: ClassName : +name type  OR  ClassName : +method() type
      var memberDeclMatch = trimmed.match(/^(\S+)\s+:\s+(.+)$/);
      if (memberDeclMatch) {
        var mcid = memberDeclMatch[1];
        if (!classMap[mcid]) {
          var newClass = { kind: 'class', id: mcid, label: mcid, members: [], line: lineNum };
          result.elements.push(newClass);
          classMap[mcid] = newClass;
        }
        var memberStr = memberDeclMatch[2].trim();
        var mm = memberStr.match(/^([+\-#~]?)([^()]+?)(\([^)]*\))?\s*(?::\s*(.+))?\s*$/);
        if (mm && mm[2]) {
          classMap[mcid].members.push({
            kind: mm[3] ? 'method' : 'attribute',
            visibility: mm[1] || '',
            name: mm[2].trim(),
            params: mm[3] || '',
            type: mm[4] || '',
            line: lineNum,
          });
        }
        continue;
      }

      // Relationship: ClassA <|-- ClassB : label
      // Or with cardinality: ClassA "1" o-- "many" ClassB : owns
      var relType = null, relPos = -1;
      for (var ri = 0; ri < RELATION_TYPES.length; ri++) {
        var pos = trimmed.indexOf(RELATION_TYPES[ri]);
        if (pos > 0) { relType = RELATION_TYPES[ri]; relPos = pos; break; }
      }
      if (relType && relPos > 0) {
        var leftRaw = trimmed.slice(0, relPos).trim();
        var rest = trimmed.slice(relPos + relType.length);
        var labelMatch = rest.match(/^(.+?)(?:\s*:\s*(.+))?$/);
        var rightRaw = labelMatch ? labelMatch[1].trim() : rest.trim();
        var relLabel = labelMatch ? (labelMatch[2] || '') : '';

        // Strip cardinality strings "1", "many", etc.
        var leftMatch = leftRaw.match(/^(\S+)(?:\s+"([^"]+)")?$/);
        var rightMatch = rightRaw.match(/^(?:"([^"]+)"\s+)?(\S+)$/);
        var fromId = leftMatch ? leftMatch[1] : leftRaw;
        var fromCard = leftMatch && leftMatch[2] ? leftMatch[2] : '';
        var toId = rightMatch ? rightMatch[2] : rightRaw;
        var toCard = rightMatch && rightMatch[1] ? rightMatch[1] : '';

        // Ensure classes exist
        function ensureClass(cls) {
          if (!classMap[cls]) {
            var ne = { kind: 'class', id: cls, label: cls, members: [], line: lineNum };
            result.elements.push(ne);
            classMap[cls] = ne;
          }
        }
        ensureClass(fromId);
        ensureClass(toId);

        result.relations.push({
          kind: 'relation',
          id: '__rel_' + (relCounter++),
          from: fromId,
          to: toId,
          fromCard: fromCard,
          toCard: toCard,
          arrow: relType,
          label: relLabel.trim(),
          line: lineNum,
        });
      }
    }

    return result;
  }

  // ── Updaters ──

  function addClass(text, id) {
    var newLine = '    class ' + id;
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function deleteClass(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function addMember(text, classId, visibility, name, type, isMethod) {
    visibility = visibility || '+';
    var memberPart = visibility + name + (isMethod ? '()' : '') + (type ? ' ' + type : '');
    var newLine = '    ' + classId + ' : ' + memberPart;
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function addRelation(text, from, to, arrow, label) {
    arrow = arrow || '-->';
    var newLine = '    ' + from + ' ' + arrow + ' ' + to + (label ? ' : ' + label : '');
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function deleteRelation(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updateRelation(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    var indent = lines[idx].match(/^(\s*)/)[1];
    var rt = null, rp = -1;
    for (var i = 0; i < RELATION_TYPES.length; i++) {
      var p = trimmed.indexOf(RELATION_TYPES[i]);
      if (p > 0) { rt = RELATION_TYPES[i]; rp = p; break; }
    }
    if (!rt) return text;
    var left = trimmed.slice(0, rp).trim();
    var rest = trimmed.slice(rp + rt.length);
    var lblMatch = rest.match(/^(.+?)(?:\s*:\s*(.+))?$/);
    var right = lblMatch ? lblMatch[1].trim() : rest.trim();
    var label = lblMatch ? (lblMatch[2] || '') : '';

    var leftCls = left.split(/\s+/)[0];
    var rightCls = right.split(/\s+/).pop();

    if (field === 'from') leftCls = value;
    else if (field === 'to') rightCls = value;
    else if (field === 'arrow') rt = value;
    else if (field === 'label') label = value;

    lines[idx] = indent + leftCls + ' ' + rt + ' ' + rightCls + (label ? ' : ' + label : '');
    return lines.join('\n');
  }

  function addNamespace(text, id) {
    var block = [
      '    namespace ' + id + ' {',
      '        ',
      '    }',
    ];
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice.apply(lines, [insertAt, 0].concat(block));
    return lines.join('\n');
  }

  function deleteNamespace(text, startLine, endLine) {
    var lines = text.split('\n');
    lines.splice(startLine - 1, (endLine - startLine + 1));
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

    function fieldHtml(label, id, value, placeholder) {
      return '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">' + escHtml(label) + '</label><input id="' + id + '" type="text" value="' + escHtml(value || '') + '" placeholder="' + escHtml(placeholder || '') + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;"></div>';
    }

    if (!selData || selData.length === 0) {
      var classes = parsedData.elements.filter(function(e) { return e.kind === 'class'; });
      var rels = parsedData.relations.filter(function(r) { return r.kind === 'relation'; });
      var namespaces = parsedData.groups.filter(function(g) { return g.kind === 'namespace'; });

      var classOpts = '';
      for (var ci = 0; ci < classes.length; ci++) classOpts += '<option value="' + escHtml(classes[ci].id) + '">' + escHtml(classes[ci].label) + '</option>';
      if (!classOpts) classOpts = '<option value="">（クラスを先に追加）</option>';

      var relOpts = '';
      var rels_arrows = ['<|--','<|..','*--','o--','..>','-->','--'];
      var relLabels = {'<|--':'inheritance','<|..':'realization','*--':'composition','o--':'aggregation','..>':'dependency','-->':'association','--':'link'};
      for (var ai = 0; ai < rels_arrows.length; ai++) relOpts += '<option value="' + rels_arrows[ai] + '">' + rels_arrows[ai] + ' (' + relLabels[rels_arrows[ai]] + ')</option>';

      var visOpts = '';
      var visLabels = ['+','-','#','~'];
      for (var vi = 0; vi < visLabels.length; vi++) visOpts += '<option value="' + visLabels[vi] + '">' + visLabels[vi] + '</option>';

      var classesList = '';
      for (var lci = 0; lci < classes.length; lci++) {
        var c = classes[lci];
        classesList += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:3px 4px;background:var(--bg-tertiary);border-radius:3px;font-size:11px;">' +
          '<div style="flex:1;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(c.label) + ' <span style="color:var(--text-secondary);font-size:10px;">(' + c.members.length + ' members)</span></div>' +
          '<button class="cl-select-class" data-element-id="' + escHtml(c.id) + '" style="background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">編集</button>' +
          '<button class="cl-delete-class" data-line="' + c.line + '" style="background:var(--accent-red);color:#fff;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">&#x2715;</button>' +
        '</div>';
      }
      if (!classesList) classesList = '<div style="font-size:11px;color:var(--text-secondary);">（クラスなし）</div>';

      var relsList = '';
      for (var lri = 0; lri < rels.length; lri++) {
        var r = rels[lri];
        relsList += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:3px 4px;background:var(--bg-tertiary);border-radius:3px;font-size:11px;">' +
          '<div style="flex:1;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);">' + escHtml(r.from) + ' ' + escHtml(r.arrow) + ' ' + escHtml(r.to) + (r.label ? ' : ' + escHtml(r.label) : '') + '</div>' +
          '<button class="cl-select-rel" data-element-id="' + escHtml(r.id) + '" style="background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">編集</button>' +
          '<button class="cl-delete-rel" data-line="' + r.line + '" style="background:var(--accent-red);color:#fff;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">&#x2715;</button>' +
        '</div>';
      }
      if (!relsList) relsList = '<div style="font-size:11px;color:var(--text-secondary);">（関連なし）</div>';

      var nsList = '';
      for (var lni = 0; lni < namespaces.length; lni++) {
        var ns = namespaces[lni];
        nsList += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:3px 4px;background:var(--bg-tertiary);border-radius:3px;font-size:11px;">' +
          '<div style="flex:1;color:var(--text-primary);">' + escHtml(ns.label) + '</div>' +
          '<button class="cl-delete-ns" data-line="' + ns.line + '" data-end-line="' + ns.endLine + '" style="background:var(--accent-red);color:#fff;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">&#x2715;</button>' +
        '</div>';
      }
      if (!nsList) nsList = '<div style="font-size:11px;color:var(--text-secondary);">（なし）</div>';

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Class Diagram</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">クラスを追加</label>' +
          '<div style="display:flex;gap:4px;">' +
            '<input id="cl-add-class-id" type="text" placeholder="ClassName" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<button id="cl-add-class-btn" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+</button>' +
          '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">メンバを追加</label>' +
          '<div style="display:flex;gap:4px;margin-bottom:4px;">' +
            '<select id="cl-add-mem-class" style="flex:2;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' + classOpts + '</select>' +
            '<select id="cl-add-mem-vis" style="flex:0 0 50px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' + visOpts + '</select>' +
          '</div>' +
          fieldHtml('名前', 'cl-add-mem-name', '', 'name') +
          fieldHtml('型/戻り値', 'cl-add-mem-type', '', 'String') +
          '<div style="display:flex;gap:4px;align-items:center;">' +
            '<label style="font-size:11px;color:var(--text-secondary);"><input id="cl-add-mem-method" type="checkbox"> method (())</label>' +
            '<button id="cl-add-mem-btn" style="margin-left:auto;background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+ 追加</button>' +
          '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">関連を追加</label>' +
          '<div style="display:flex;gap:4px;margin-bottom:4px;">' +
            '<select id="cl-add-rel-from" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' + classOpts + '</select>' +
            '<select id="cl-add-rel-arrow" style="flex:1.5;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;font-family:var(--font-mono);">' + relOpts + '</select>' +
            '<select id="cl-add-rel-to" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' + classOpts + '</select>' +
          '</div>' +
          fieldHtml('ラベル', 'cl-add-rel-label', '', '') +
          '<button id="cl-add-rel-btn" style="width:100%;background:var(--accent);color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;">+ 関連追加</button>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">名前空間を追加</label>' +
          '<div style="display:flex;gap:4px;">' +
            '<input id="cl-add-ns-id" type="text" placeholder="NamespaceName" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<button id="cl-add-ns-btn" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+</button>' +
          '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">クラス一覧</label>' +
          '<div>' + classesList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">関連一覧</label>' +
          '<div>' + relsList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">名前空間一覧</label>' +
          '<div>' + nsList + '</div>' +
        '</div>';

      function bindEvt(id, event, handler) {
        var el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
      }
      bindEvt('cl-add-class-btn', 'click', function() {
        var id = document.getElementById('cl-add-class-id').value.trim();
        if (!id) { alert('IDは必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addClass(ctx.getMmdText(), id));
        ctx.onUpdate();
      });
      bindEvt('cl-add-mem-btn', 'click', function() {
        var clsId = document.getElementById('cl-add-mem-class').value;
        var vis = document.getElementById('cl-add-mem-vis').value;
        var name = document.getElementById('cl-add-mem-name').value.trim();
        var type = document.getElementById('cl-add-mem-type').value.trim();
        var isMethod = document.getElementById('cl-add-mem-method').checked;
        if (!clsId || !name) { alert('クラスと名前は必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addMember(ctx.getMmdText(), clsId, vis, name, type, isMethod));
        ctx.onUpdate();
      });
      bindEvt('cl-add-rel-btn', 'click', function() {
        var from = document.getElementById('cl-add-rel-from').value;
        var to = document.getElementById('cl-add-rel-to').value;
        var arrow = document.getElementById('cl-add-rel-arrow').value;
        var label = document.getElementById('cl-add-rel-label').value.trim();
        if (!from || !to) { alert('クラスを先に追加してください'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addRelation(ctx.getMmdText(), from, to, arrow, label));
        ctx.onUpdate();
      });
      bindEvt('cl-add-ns-btn', 'click', function() {
        var id = document.getElementById('cl-add-ns-id').value.trim();
        if (!id) { alert('IDは必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addNamespace(ctx.getMmdText(), id));
        ctx.onUpdate();
      });

      var selC = propsEl.querySelectorAll('.cl-select-class');
      for (var sci2 = 0; sci2 < selC.length; sci2++) {
        (function(btn) { btn.addEventListener('click', function() { window.MA.selection.setSelected([{ type: 'class', id: btn.getAttribute('data-element-id') }]); }); })(selC[sci2]);
      }
      var delC = propsEl.querySelectorAll('.cl-delete-class');
      for (var dci = 0; dci < delC.length; dci++) {
        (function(btn) { btn.addEventListener('click', function() {
          var ln = parseInt(btn.getAttribute('data-line'), 10);
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteClass(ctx.getMmdText(), ln));
          ctx.onUpdate();
        }); })(delC[dci]);
      }
      var selR = propsEl.querySelectorAll('.cl-select-rel');
      for (var sri = 0; sri < selR.length; sri++) {
        (function(btn) { btn.addEventListener('click', function() { window.MA.selection.setSelected([{ type: 'relation', id: btn.getAttribute('data-element-id') }]); }); })(selR[sri]);
      }
      var delR = propsEl.querySelectorAll('.cl-delete-rel');
      for (var dri = 0; dri < delR.length; dri++) {
        (function(btn) { btn.addEventListener('click', function() {
          var ln = parseInt(btn.getAttribute('data-line'), 10);
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteRelation(ctx.getMmdText(), ln));
          ctx.onUpdate();
        }); })(delR[dri]);
      }
      var delN = propsEl.querySelectorAll('.cl-delete-ns');
      for (var dni = 0; dni < delN.length; dni++) {
        (function(btn) { btn.addEventListener('click', function() {
          var sl = parseInt(btn.getAttribute('data-line'), 10);
          var el2 = parseInt(btn.getAttribute('data-end-line'), 10);
          if (isNaN(el2) || el2 <= 0) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteNamespace(ctx.getMmdText(), sl, el2));
          ctx.onUpdate();
        }); })(delN[dni]);
      }
      return;
    }

    // Single class selected: show members
    if (selData.length === 1 && selData[0].type === 'class') {
      var cid = selData[0].id;
      var cls = null;
      for (var pj = 0; pj < parsedData.elements.length; pj++) {
        if (parsedData.elements[pj].kind === 'class' && parsedData.elements[pj].id === cid) { cls = parsedData.elements[pj]; break; }
      }
      if (!cls) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">クラスが見つかりません</p>'; return; }
      var membersList = '';
      for (var mi = 0; mi < cls.members.length; mi++) {
        var m = cls.members[mi];
        membersList += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:3px 4px;background:var(--bg-tertiary);border-radius:3px;font-size:11px;font-family:var(--font-mono);">' +
          '<div style="flex:1;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(m.visibility) + escHtml(m.name) + escHtml(m.params || '') + (m.type ? ' ' + escHtml(m.type) : '') + '</div>' +
          '<button class="cl-delete-mem" data-line="' + m.line + '" style="background:var(--accent-red);color:#fff;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">&#x2715;</button>' +
        '</div>';
      }
      if (!membersList) membersList = '<div style="font-size:11px;color:var(--text-secondary);">（メンバなし）</div>';
      propsEl.innerHTML =
        '<div style="margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border);font-weight:bold;color:var(--text-primary);font-size:13px;">' + escHtml(cls.label) + '</div>' +
        '<div style="margin-bottom:8px;color:var(--text-secondary);font-size:11px;">クラス: ' + escHtml(cls.id) + '</div>' +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">メンバ一覧</label>' +
          '<div>' + membersList + '</div>' +
        '</div>' +
        '<button id="sel-class-delete" style="width:100%;background:var(--accent-red);color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;margin-top:8px;">クラス削除</button>';

      document.getElementById('sel-class-delete').addEventListener('click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(deleteClass(ctx.getMmdText(), cls.line));
        window.MA.selection.clearSelection();
        ctx.onUpdate();
      });
      var delM = propsEl.querySelectorAll('.cl-delete-mem');
      for (var dmi = 0; dmi < delM.length; dmi++) {
        (function(btn) { btn.addEventListener('click', function() {
          var ln = parseInt(btn.getAttribute('data-line'), 10);
          window.MA.history.pushHistory();
          ctx.setMmdText(window.MA.textUpdater.deleteLine(ctx.getMmdText(), ln));
          ctx.onUpdate();
        }); })(delM[dmi]);
      }
      return;
    }

    // Single relation selected
    if (selData.length === 1 && selData[0].type === 'relation') {
      var rid = selData[0].id;
      var rel = null;
      for (var rj = 0; rj < parsedData.relations.length; rj++) {
        if (parsedData.relations[rj].id === rid) { rel = parsedData.relations[rj]; break; }
      }
      if (!rel) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">関連が見つかりません</p>'; return; }
      var classes2 = parsedData.elements.filter(function(e) { return e.kind === 'class'; });
      var fromOpts = '', toOpts = '';
      for (var ai2 = 0; ai2 < classes2.length; ai2++) {
        var ci2 = classes2[ai2].id;
        fromOpts += '<option value="' + escHtml(ci2) + '"' + (ci2 === rel.from ? ' selected' : '') + '>' + escHtml(classes2[ai2].label) + '</option>';
        toOpts += '<option value="' + escHtml(ci2) + '"' + (ci2 === rel.to ? ' selected' : '') + '>' + escHtml(classes2[ai2].label) + '</option>';
      }
      var arrows3 = ['<|--','<|..','*--','o--','..>','-->','--'];
      var arrowOpts3 = '';
      for (var ai4 = 0; ai4 < arrows3.length; ai4++) arrowOpts3 += '<option value="' + arrows3[ai4] + '"' + (arrows3[ai4] === rel.arrow ? ' selected' : '') + '>' + arrows3[ai4] + '</option>';

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border);font-weight:bold;color:var(--text-primary);font-size:13px;">Relation</div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">From</label><select id="sel-rel-from" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + fromOpts + '</select></div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">Arrow</label><select id="sel-rel-arrow" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;font-family:var(--font-mono);">' + arrowOpts3 + '</select></div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">To</label><select id="sel-rel-to" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + toOpts + '</select></div>' +
        fieldHtml('ラベル', 'sel-rel-label', rel.label) +
        '<button id="sel-rel-delete" style="width:100%;background:var(--accent-red);color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;margin-top:8px;">関連削除</button>';

      document.getElementById('sel-rel-from').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateRelation(ctx.getMmdText(), rel.line, 'from', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-rel-arrow').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateRelation(ctx.getMmdText(), rel.line, 'arrow', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-rel-to').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateRelation(ctx.getMmdText(), rel.line, 'to', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-rel-label').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateRelation(ctx.getMmdText(), rel.line, 'label', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-rel-delete').addEventListener('click', function() { window.MA.history.pushHistory(); ctx.setMmdText(deleteRelation(ctx.getMmdText(), rel.line)); window.MA.selection.clearSelection(); ctx.onUpdate(); });
      return;
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'classDiagram',
    displayName: 'Class',
    detect: function(text) {
      return window.MA.parserUtils.detectDiagramType(text) === 'classDiagram';
    },
    parse: parseClass,
    template: function() {
      return [
        'classDiagram',
        '    class Animal {',
        '        +String name',
        '        +makeSound() void',
        '    }',
        '    class Dog',
        '    Animal <|-- Dog',
      ].join('\n');
    },
    buildOverlay: buildOverlay,
    renderProps: renderProps,
    operations: {
      add: function(text, kind, props) {
        if (kind === 'class') return addClass(text, props.id);
        if (kind === 'member') return addMember(text, props.classId, props.visibility, props.name, props.type, props.isMethod);
        if (kind === 'relation') return addRelation(text, props.from, props.to, props.arrow, props.label);
        if (kind === 'namespace') return addNamespace(text, props.id);
        return text;
      },
      delete: function(text, lineNum) { return window.MA.textUpdater.deleteLine(text, lineNum); },
      update: function(text, lineNum, field, value) {
        var lines = text.split('\n');
        var trimmed = (lines[lineNum - 1] || '').trim();
        for (var i = 0; i < RELATION_TYPES.length; i++) {
          if (trimmed.indexOf(RELATION_TYPES[i]) > 0) return updateRelation(text, lineNum, field, value);
        }
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
        return addRelation(text, fromId, toId, props.arrow, props.label);
      },
    },
    parseClass: parseClass,
    addClass: addClass,
    deleteClass: deleteClass,
    addMember: addMember,
    addRelation: addRelation,
    deleteRelation: deleteRelation,
    updateRelation: updateRelation,
    addNamespace: addNamespace,
    deleteNamespace: deleteNamespace,
    RELATION_TYPES: RELATION_TYPES,
  };
})();
