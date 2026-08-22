'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.classDiagram = (function() {
  // Relation patterns (longest first for greedy matching)
  var RELATION_TYPES = ['<|--', '<|..', '*--', 'o--', '..>', '-->', '--'];

  // 表示ラベルは `["..."]` の形で宣言行に付く。
  function unqLabel(v) {
    if (!v) return '';
    var s2 = String(v);
    return /^"[\s\S]*"$/.test(s2) ? s2.slice(1, -1) : s2;
  }

  // mermaid はラベルの中の " をエスケープできないが、&quot; はそのまま
  // " として描かれる (v11.13 実測)。
  function encLabel(v) {
    return String(v == null ? '' : v).replace(/"/g, '&quot;');
  }

  // クラスの表示ラベルを変える。宣言行が無ければ作る。
  //
  // クラス名は識別子なので日本語や括弧を入れると図が壊れる。
  // 以前はラベル欄がクラス名そのものを書き換えていたので、
  // 「設計(詳細)」のような実務の名前を入れると parse が落ちていた。
  function updateClassLabel(text, lineNum, classId, newLabel) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var enc = encLabel(newLabel);
    var indent = lines[idx].match(/^(\s*)/)[1];
    var trimmed = lines[idx].trim();
    var m = trimmed.match(/^class\s+([^\s\[{]+)(?:\[".*?"\])?(\s*\{\s*)?$/);
    if (m) {
      // ラベルを外す指定 (空文字) なら ["..."] ごと消す
      var suffix = enc ? '["' + enc + '"]' : '';
      lines[idx] = indent + 'class ' + m[1] + suffix + (m[2] ? ' {' : '');
      return lines.join('\n');
    }
    // 宣言行が無い (関係行だけで現れるクラス)。図種宣言の直後に作る。
    if (!classId || !enc) return text;
    var insertAt = 1;
    for (var k = 0; k < lines.length; k++) {
      if (/^classDiagram/.test(lines[k].trim())) { insertAt = k + 1; break; }
    }
    var baseIndent = '    ';
    for (var k2 = insertAt; k2 < lines.length; k2++) {
      if (lines[k2].trim()) { baseIndent = lines[k2].match(/^(\s*)/)[1]; break; }
    }
    lines.splice(insertAt, 0, baseIndent + 'class ' + classId + '["' + enc + '"]');
    return lines.join('\n');
  }

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

      // Class block start: class Name {  /  class Name["表示ラベル"] {
      //
      // mermaid は識別子とは別に表示ラベルを持てる (`class Animal["設計(詳細)"]`)。
      // これまでこちらはその形を読めず、ラベル欄がクラス名そのものを書き換えていた。
      // クラス名は識別子なので日本語や括弧を入れると図が壊れる。表示ラベルなら
      // 「設計(詳細)」をそのまま出せる (v11.13 実測)。
      var classBlockMatch = trimmed.match(/^class\s+([^\s\[{]+)(?:\[(".*?")\])?\s*\{\s*$/);
      if (classBlockMatch) {
        var cid = classBlockMatch[1];
        if (!classMap[cid]) {
          var ce = { kind: 'class', id: cid, label: unqLabel(classBlockMatch[2]) || cid, members: [], line: lineNum };
          result.elements.push(ce);
          classMap[cid] = ce;
        }
        currentClassId = cid;
        continue;
      }

      // Standalone class declaration: class Name
      var classDeclMatch = trimmed.match(/^class\s+([^\s\[{]+)(?:\[(".*?")\])?\s*$/);
      if (classDeclMatch) {
        var cid2 = classDeclMatch[1];
        if (!classMap[cid2]) {
          var ce2 = { kind: 'class', id: cid2, label: unqLabel(classDeclMatch[2]) || cid2, members: [], line: lineNum };
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

  function _isClassLine(trimmed) {
    if (!trimmed) return false;
    if (trimmed.indexOf('%%') === 0) return false;
    if (/<\|--|--\|>|<--|-->|--\*|\*--|--o|o--|\.\./.test(trimmed)) return false; // relation
    if (/^(classDiagram|class\s+".*"|direction|note\s|}\s*$)/i.test(trimmed)) return false;
    return /^(class\s+\w|\w+\s*:)/i.test(trimmed);
  }

  function _moveClassStep(text, lineNum, direction) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var target = idx + direction;
    while (target >= 0 && target < lines.length) {
      var t = lines[target].trim();
      if (!t || t.indexOf('%%') === 0) { target += direction; continue; }
      if (_isClassLine(t)) {
        var tmp = lines[idx];
        lines[idx] = lines[target];
        lines[target] = tmp;
        return lines.join('\n');
      }
      return text;
    }
    return text;
  }

  function moveClassUp(text, lineNum) { return _moveClassStep(text, lineNum, -1); }
  function moveClassDown(text, lineNum) { return _moveClassStep(text, lineNum, 1); }

  // Delete a class and everything that only existed because of it.
  //
  // Deleting the line the class was first seen on removed `class Animal {` and
  // left `+String name`, `+makeSound() void` and the closing `}` behind — the
  // members floated free and mermaid refused the whole diagram. The relations
  // naming the class also stayed, so it came back as an implicitly declared,
  // memberless class.
  //
  // `classId` is optional so the older single-argument callers keep working.
  function deleteClass(text, lineNum, classId) {
    if (!classId) return window.MA.textUpdater.deleteLine(text, lineNum);
    var lines = text.split('\n');
    var out = [];
    var skipToBrace = false;
    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      if (skipToBrace) {
        if (trimmed === '}') skipToBrace = false;
        continue;
      }
      var block = trimmed.match(/^class\s+(\S+)\s*\{\s*$/);
      if (block && block[1] === classId) { skipToBrace = true; continue; }
      var decl = trimmed.match(/^class\s+(\S+)\s*$/);
      if (decl && decl[1] === classId) continue;
      if (classRelTouches(trimmed, classId)) continue;
      // `X : +member` form
      var mem = trimmed.match(/^(\S+)\s+:\s+/);
      if (mem && mem[1] === classId) continue;
      out.push(lines[i]);
    }
    return out.join('\n');
  }

  // Whether the line is a relation with classId at either end.
  // Exact match, not prefix: deleting `Ani` must not take `Animal`'s relations
  // with it.
  function classRelTouches(trimmed, classId) {
    var m = trimmed.match(/^(\S+)\s+([<>|*o.\-]{2,})\s+(\S+?)(?:\s*:\s*.*)?$/);
    if (!m) return false;
    return m[1] === classId || m[3] === classId;
  }

  // クラス名の変更。
  //
  // 選択時のパネルはクラス名を読み取り専用の文字として出すだけで、入力欄が無かった。
  // 他の図種 (flowchart / block / sequence / c4 / state / requirement) は ID 欄を持ち、
  // 変更すると参照側も追従する。class だけ取り残されていた (R18 で発覚)。
  //
  // 参照の追従が要るのは削除と同じ理由。宣言だけ変えると関係行が古い名前を
  // 指したまま残り、mermaid は参照だけで要素を作るので幽霊クラスが生える。
  //
  // 既にある名前への変更は拒否する。mermaid は2つを黙って統合するので、
  // 利用者からは「クラスが消えた」としか見えない。
  function updateClassName(text, lineNum, oldId, newId) {
    if (!newId || !String(newId).trim() || newId === oldId) return text;
    var existing = parseClass(text).elements.map(function(e) { return e.id; });
    if (existing.indexOf(newId) >= 0) return text;

    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var indent = lines[i].match(/^(\s*)/)[1];
      var trimmed = lines[i].trim();
      if (!trimmed) continue;

      // `class X {` / `class X`
      var decl = trimmed.match(/^class\s+(\S+)(\s*\{\s*)?$/);
      if (decl && decl[1] === oldId) {
        lines[i] = indent + 'class ' + newId + (decl[2] ? ' {' : '');
        continue;
      }
      // `A <|-- B` などの関係行
      var rel = trimmed.match(/^(\S+)(\s+[<>|*o.\-]{2,}\s+)(\S+?)(\s*:\s*.*)?$/);
      if (rel) {
        var left = rel[1] === oldId ? newId : rel[1];
        var right = rel[3] === oldId ? newId : rel[3];
        if (left !== rel[1] || right !== rel[3]) {
          lines[i] = indent + left + rel[2] + right + (rel[4] || '');
        }
        continue;
      }
      // `X : +member` 形式
      var mem = trimmed.match(/^(\S+)(\s+:\s+.*)$/);
      if (mem && mem[1] === oldId) {
        lines[i] = indent + newId + mem[2];
        continue;
      }
    }
    return lines.join('\n');
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
    // mermaid のクラスノードは id="classId-<クラス名>-<連番>"。
    // クリックで選択できるようにする (プロパティ一覧だけだとクラスが増えたとき
    // 目的のクラスを探すのに一覧をスクロールし続けることになる)。
    window.MA.overlayGeom.buildNodeOverlay(svgEl, parsedData, overlayEl, {
      prefix: 'classId',
      kindOf: function() { return 'class'; },
    });
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var props = window.MA.properties;
    var fieldHtml = props.fieldHtml;
    var bindEvent = props.bindEvent;

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
        classesList += props.listItemHtml({ label: c.label, sublabel: '(' + c.members.length + ' members)', selectClass: 'cl-select-class', deleteClass: 'cl-delete-class', dataElementId: c.id, dataLine: c.line });
      }
      if (!classesList) classesList = props.emptyListHtml('（クラスなし）');

      var relsList = '';
      for (var lri = 0; lri < rels.length; lri++) {
        var r = rels[lri];
        relsList += props.listItemHtml({ label: r.from + ' ' + r.arrow + ' ' + r.to + (r.label ? ' : ' + r.label : ''), selectClass: 'cl-select-rel', deleteClass: 'cl-delete-rel', dataElementId: r.id, dataLine: r.line, mono: true });
      }
      if (!relsList) relsList = props.emptyListHtml('（関連なし）');

      var nsList = '';
      for (var lni = 0; lni < namespaces.length; lni++) {
        var ns = namespaces[lni];
        nsList += props.listItemHtml({ label: ns.label, deleteClass: 'cl-delete-ns', dataLine: ns.line, dataEndLine: ns.endLine });
      }
      if (!nsList) nsList = props.emptyListHtml('（なし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Class Diagram</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">クラスを追加</label>' +
          '<div style="display:flex;gap:4px;">' +
            '<input id="cl-add-class-id" type="text" placeholder="ClassName" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<button id="cl-add-class-btn" title="クラスを追加" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+</button>' +
          '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">メンバを追加</label>' +
          '<div style="display:flex;gap:4px;margin-bottom:4px;">' +
            '<select id="cl-add-mem-class" style="flex:2;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' + classOpts + '</select>' +
            '<select id="cl-add-mem-vis" style="flex:0 0 50px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' + visOpts + '</select>' +
          '</div>' +
          fieldHtml('ラベル', 'cl-add-mem-name', '', 'name') +
          fieldHtml('型/戻り値', 'cl-add-mem-type', '', 'String') +
          '<div style="display:flex;gap:4px;align-items:center;">' +
            '<label style="font-size:11px;color:var(--text-secondary);"><input id="cl-add-mem-method" type="checkbox"> method (())</label>' +
            '<button id="cl-add-mem-btn" style="margin-left:auto;background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+ 追加</button>' +
          '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">関連を追加</label>' +
          props.selectFieldHtml('From', 'cl-add-rel-from', classes.length === 0 ? [{value: '', label: '（クラスを先に追加）'}] : classes.map(function(c) { return { value: c.id, label: c.label }; })) +
          props.selectFieldHtml('Arrow', 'cl-add-rel-arrow', rels_arrows.map(function(a) { return { value: a, label: a + ' (' + relLabels[a] + ')' }; }), true) +
          props.selectFieldHtml('To', 'cl-add-rel-to', classes.length === 0 ? [{value: '', label: '（クラスを先に追加）'}] : classes.map(function(c) { return { value: c.id, label: c.label }; })) +
          fieldHtml('ラベル', 'cl-add-rel-label', '', '') +
          props.primaryButtonHtml('cl-add-rel-btn', '+ 関連追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">名前空間を追加</label>' +
          '<div style="display:flex;gap:4px;">' +
            '<input id="cl-add-ns-id" type="text" placeholder="NamespaceName" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<button id="cl-add-ns-btn" title="名前空間を追加" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+</button>' +
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

      bindEvent('cl-add-class-btn', 'click', function() {
        var id = document.getElementById('cl-add-class-id').value.trim();
        if (!id) { alert('IDは必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addClass(ctx.getMmdText(), id));
        ctx.onUpdate();
      });
      bindEvent('cl-add-mem-btn', 'click', function() {
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
      bindEvent('cl-add-rel-btn', 'click', function() {
        var from = document.getElementById('cl-add-rel-from').value;
        var to = document.getElementById('cl-add-rel-to').value;
        var arrow = document.getElementById('cl-add-rel-arrow').value;
        var label = document.getElementById('cl-add-rel-label').value.trim();
        if (!from || !to) { alert('クラスを先に追加してください'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addRelation(ctx.getMmdText(), from, to, arrow, label));
        ctx.onUpdate();
      });
      bindEvent('cl-add-ns-btn', 'click', function() {
        var id = document.getElementById('cl-add-ns-id').value.trim();
        if (!id) { alert('IDは必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addNamespace(ctx.getMmdText(), id));
        ctx.onUpdate();
      });

      props.bindSelectButtons(propsEl, 'cl-select-class', 'class');
      // 3引数目は data-element-id。クラスは行を共有する (関係行が両端を宣言する)
      // ので、id が無いと押した行の別クラスまで巻き込む
      props.bindDeleteButtons(propsEl, 'cl-delete-class', ctx, function(t, ln, elId) {
        return deleteClass(t, ln, elId);
      });
      props.bindSelectButtons(propsEl, 'cl-select-rel', 'relation');
      props.bindDeleteButtons(propsEl, 'cl-delete-rel', ctx, deleteRelation);
      props.bindDeleteButtons(propsEl, 'cl-delete-ns', ctx, deleteNamespace, true);
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
        membersList += props.listItemHtml({ label: m.visibility + m.name + (m.params || '') + (m.type ? ' ' + m.type : ''), deleteClass: 'cl-delete-mem', dataLine: m.line, mono: true });
      }
      if (!membersList) membersList = props.emptyListHtml('（メンバなし）');
      propsEl.innerHTML =
        props.panelHeaderHtml(cls.label) +
        // 名前を変えられるようにする。以前は読み取り専用の文字だったので、
        // リネームにはテキストを直接触るしかなかった (R18)。
        props.fieldHtml('ID', 'sel-class-name', cls.id) +
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">メンバ一覧</label>' +
          '<div>' + membersList + '</div>' +
        '</div>' +
        props.connectButtonHtml('sel-class-connect') +
        props.actionBarHtml('sel-class', {
          insertBefore: false, insertAfter: false,
          // move は無効。_is*Line が「宣言行か」で判定しており、ブロック形式のクラス (`class Dog {`) を宣言行と誤判定し、他クラスの本体に飲み込ませる。
          // mermaid の parse も render も通るため無言で壊れる。述語をブレース深度
          // ベースに直すまで UI から出さない (敵対レビュー指摘)。
          move: false, delete: true,
          labels: { delete: 'クラス削除' },
        });

      // 図の上でクリック2回で関係を引く
      var clsNameEl = document.getElementById('sel-class-name');
      if (clsNameEl) {
        clsNameEl.addEventListener('change', function() {
          var next = clsNameEl.value.trim();
          if (!next || next === cls.id) return;
          var updated = updateClassName(ctx.getMmdText(), cls.line, cls.id, next);
          if (updated === ctx.getMmdText()) {
            // 拒否されたときに黙っていると「押しても何も起きない」になる。
            if (ctx.showTransient) ctx.showTransient('その名前は既に使われています — 別の名前にしてください', 3000);
            clsNameEl.value = cls.id;
            return;
          }
          window.MA.history.pushHistory();
          ctx.setMmdText(updated);
          window.MA.selection.setSelected([{ type: 'class', id: next }]);
          ctx.onUpdate();
        });
      }

      props.bindConnectButton('sel-class-connect', 'class', cls.id,
        function(fromId, toId) { return addRelation(ctx.getMmdText(), fromId, toId); });

      props.bindActionBar('sel-class', {
        up: function() {
          var newText = moveClassUp(ctx.getMmdText(), cls.line);
          if (newText === ctx.getMmdText()) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(newText);
          window.MA.selection.setSelected([{ type: 'class', id: cls.id }]);
          ctx.onUpdate();
        },
        down: function() {
          var newText = moveClassDown(ctx.getMmdText(), cls.line);
          if (newText === ctx.getMmdText()) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(newText);
          window.MA.selection.setSelected([{ type: 'class', id: cls.id }]);
          ctx.onUpdate();
        },
        'delete': function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteClass(ctx.getMmdText(), cls.line, cls.id));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        },
      });
      props.bindDeleteButtons(propsEl, 'cl-delete-mem', ctx, window.MA.textUpdater.deleteLine);
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
        props.panelHeaderHtml('Relation') +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">From</label><select id="sel-rel-from" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + fromOpts + '</select></div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">Arrow</label><select id="sel-rel-arrow" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;font-family:var(--font-mono);">' + arrowOpts3 + '</select></div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">To</label><select id="sel-rel-to" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + toOpts + '</select></div>' +
        fieldHtml('ラベル', 'sel-rel-label', rel.label) +
        props.actionBarHtml('sel-rel', {
          insertBefore: false, insertAfter: false,
          move: false, delete: true,
          labels: { delete: '関連削除' },
        });

      document.getElementById('sel-rel-from').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateRelation(ctx.getMmdText(), rel.line, 'from', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-rel-arrow').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateRelation(ctx.getMmdText(), rel.line, 'arrow', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-rel-to').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateRelation(ctx.getMmdText(), rel.line, 'to', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-rel-label').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateRelation(ctx.getMmdText(), rel.line, 'label', this.value)); ctx.onUpdate(); });
      props.bindActionBar('sel-rel', {
        'delete': function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteRelation(ctx.getMmdText(), rel.line));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        },
      });
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
      // 契約経由の削除も id 認識の実装を使う。
      // 以前は単なる deleteLine で、要素は「最初に現れた行」を持つため、
      // 関係行だけが消えて宣言が残っていた。mermaid は参照だけで要素を作るので
      // **一覧から消えても図には残る**。UI 経路だけ直して契約経路を忘れる形の再発。
      delete: function(text, lineNum, opts) {
        opts = opts || {};
        return deleteClass(text, lineNum, opts.id);
      },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        var lines = text.split('\n');
        var trimmed = (lines[lineNum - 1] || '').trim();
        for (var i = 0; i < RELATION_TYPES.length; i++) {
          if (trimmed.indexOf(RELATION_TYPES[i]) > 0) return updateRelation(text, lineNum, field, value);
        }
        // クラス名の変更を統一入口からも使えるようにする。
        // 関数は追加したのに入口へ繋いでいなかった。r12 を契約ベースに書き換えたら
        // 「どの field を渡しても本文が変わらない」として出てきた。
        var decl = trimmed.match(/^class\s+([^\s\[{]+)/);
        var oldId = opts.id || (decl ? decl[1] : null);
        // label = 図に出る文字 (識別子とは別)、name/id = 識別子の改名。
        // 以前は label も改名に回していたので、実務の名前を入れると図が壊れた。
        if (field === 'label') return updateClassLabel(text, lineNum, oldId, value);
        if (field === 'name' || field === 'id') {
          if (oldId) return updateClassName(text, lineNum, oldId, value);
        }
        return text;
      },
      // 素の行入れ替えは**図の宣言行と入れ替わって図を壊す**。
      // 同じ種類の要素が乗っている行としか入れ替えない。
      moveUp: function(text, lineNum) {
        return window.MA.textUpdater.moveElementLine(
          text, lineNum, -1, (parseClass(text).elements || []));
      },
      moveDown: function(text, lineNum) {
        return window.MA.textUpdater.moveElementLine(
          text, lineNum, 1, (parseClass(text).elements || []));
      },
      connect: function(text, fromId, toId, props) {
        props = props || {};
        return addRelation(text, fromId, toId, props.arrow, props.label);
      },
    },
    parseClass: parseClass,
    addClass: addClass,
    deleteClass: deleteClass,
    updateClassName: updateClassName,
    updateClassLabel: updateClassLabel,
    moveClassUp: moveClassUp,
    moveClassDown: moveClassDown,
    addMember: addMember,
    addRelation: addRelation,
    deleteRelation: deleteRelation,
    updateRelation: updateRelation,
    addNamespace: addNamespace,
    deleteNamespace: deleteNamespace,
    RELATION_TYPES: RELATION_TYPES,
  };
})();
