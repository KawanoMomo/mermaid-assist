'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.requirementDiagram = (function() {
  var REQ_TYPES = ['requirement', 'functionalRequirement', 'interfaceRequirement', 'performanceRequirement', 'physicalRequirement', 'designConstraint'];
  var RISKS = ['low', 'medium', 'high'];
  var VERIFY_METHODS = ['analysis', 'inspection', 'test', 'demonstration'];
  var RELTYPES = ['contains', 'copies', 'derives', 'satisfies', 'verifies', 'refines', 'traces'];

  var REQ_BLOCK_RE = new RegExp('^(' + REQ_TYPES.join('|') + ')\\s+([A-Za-z_][A-Za-z0-9_-]*)\\s*\\{\\s*$');
  var ELEMENT_BLOCK_RE = /^element\s+([A-Za-z_][A-Za-z0-9_-]*)\s*\{\s*$/;
  var FIELD_RE = /^([A-Za-z]+)\s*:\s*(.+)$/;
  var REL_RE = new RegExp('^([A-Za-z_][A-Za-z0-9_-]*)\\s+-\\s+(' + RELTYPES.join('|') + ')\\s+->\\s+([A-Za-z_][A-Za-z0-9_-]*)\\s*$');

  function parseRequirement(text) {
    var result = { meta: {}, elements: [], relations: [] };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var relCounter = 0;
    var current = null;

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^requirementDiagram/.test(trimmed)) continue;

      if (trimmed === '}') { current = null; continue; }

      var rm = trimmed.match(REQ_BLOCK_RE);
      if (rm) {
        current = {
          kind: 'requirement', reqType: rm[1], name: rm[2],
          id: '', text: '', risk: '', verifymethod: '',
          line: lineNum,
        };
        result.elements.push(current);
        continue;
      }

      var em = trimmed.match(ELEMENT_BLOCK_RE);
      if (em) {
        current = {
          kind: 'element', name: em[1],
          type: '', docref: '',
          line: lineNum,
        };
        result.elements.push(current);
        continue;
      }

      if (current) {
        var fm = trimmed.match(FIELD_RE);
        if (fm) {
          var key = fm[1].toLowerCase();
          var val = fm[2].trim();
          if (current.kind === 'requirement') {
            if (key === 'id') current.id = val;
            else if (key === 'text') current.text = val;
            else if (key === 'risk') current.risk = val.toLowerCase();
            else if (key === 'verifymethod') current.verifymethod = val.toLowerCase();
          } else if (current.kind === 'element') {
            if (key === 'type') current.type = val;
            else if (key === 'docref') current.docref = val;
          }
          continue;
        }
      }

      var lm = trimmed.match(REL_RE);
      if (lm) {
        result.relations.push({
          id: '__rel_' + (relCounter++),
          from: lm[1], reltype: lm[2], to: lm[3],
          line: lineNum,
        });
      }
    }

    return result;
  }

  function addRequirement(text, reqType, name) {
    var block = [
      reqType + ' ' + name + ' {',
      '    id: ',
      '    text: ',
      '    risk: medium',
      '    verifymethod: analysis',
      '}',
    ];
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice.apply(lines, [insertAt, 0].concat(block));
    return lines.join('\n');
  }

  function addElement(text, name) {
    var block = [
      'element ' + name + ' {',
      '    type: ',
      '    docref: ',
      '}',
    ];
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice.apply(lines, [insertAt, 0].concat(block));
    return lines.join('\n');
  }

  function addRelation(text, from, reltype, to) {
    var newLine = from + ' - ' + reltype + ' -> ' + to;
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function deleteElement(text, lineNum, elementName) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    if (/\{\s*$/.test(trimmed)) {
      var endIdx = idx;
      for (var j = idx + 1; j < lines.length; j++) {
        if (lines[j].trim() === '}') { endIdx = j; break; }
      }
      lines.splice(idx, (endIdx - idx + 1));
    } else {
      lines.splice(idx, 1);
    }
    if (elementName) {
      var relRe = new RegExp('^\\s*([A-Za-z_][A-Za-z0-9_-]*)\\s+-\\s+\\S+\\s+->\\s+([A-Za-z_][A-Za-z0-9_-]*)\\s*$');
      lines = lines.filter(function(ln) {
        var m = ln.match(relRe);
        if (!m) return true;
        return m[1] !== elementName && m[2] !== elementName;
      });
    }
    return lines.join('\n');
  }

  function deleteRelation(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updateRequirementField(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var fieldKey = field.toLowerCase();
    for (var j = idx + 1; j < lines.length; j++) {
      var t2 = lines[j].trim();
      if (t2 === '}') {
        lines.splice(j, 0, '    ' + fieldKey + ': ' + value);
        return lines.join('\n');
      }
      var m = t2.match(/^([A-Za-z]+)\s*:\s*(.*)$/);
      if (m && m[1].toLowerCase() === fieldKey) {
        var indent = lines[j].match(/^(\s*)/)[1];
        lines[j] = indent + fieldKey + ': ' + value;
        return lines.join('\n');
      }
    }
    return text;
  }

  function updateRequirementType(text, lineNum, newReqType) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = lines[idx].trim().match(REQ_BLOCK_RE);
    if (!m) return text;
    lines[idx] = indent + newReqType + ' ' + m[2] + ' {';
    return lines.join('\n');
  }

  function updateElementField(text, lineNum, field, value) {
    return updateRequirementField(text, lineNum, field, value);
  }

  function updateRelation(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = lines[idx].trim().match(/^([A-Za-z_][A-Za-z0-9_-]*)\s+-\s+(\S+)\s+->\s+([A-Za-z_][A-Za-z0-9_-]*)\s*$/);
    if (!m) return text;
    var from = m[1], reltype = m[2], to = m[3];
    if (field === 'from') from = value;
    else if (field === 'reltype') reltype = value;
    else if (field === 'to') to = value;
    lines[idx] = indent + from + ' - ' + reltype + ' -> ' + to;
    return lines.join('\n');
  }

  function updateName(text, lineNum, oldName, newName) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var trimmed = lines[idx].trim();
    var rm = trimmed.match(REQ_BLOCK_RE);
    if (rm) {
      lines[idx] = indent + rm[1] + ' ' + newName + ' {';
    } else {
      var em = trimmed.match(ELEMENT_BLOCK_RE);
      if (em) {
        lines[idx] = indent + 'element ' + newName + ' {';
      }
    }
    var relRe = /^(\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s+-\s+\S+\s+->\s+)([A-Za-z_][A-Za-z0-9_-]*)(\s*)$/;
    for (var j = 0; j < lines.length; j++) {
      var rm2 = lines[j].match(relRe);
      if (rm2) {
        var from = rm2[2] === oldName ? newName : rm2[2];
        var to = rm2[4] === oldName ? newName : rm2[4];
        lines[j] = rm2[1] + from + rm2[3] + to + rm2[5];
      }
    }
    return lines.join('\n');
  }

  return {
    type: 'requirementDiagram',
    displayName: 'Requirement',
    REQ_TYPES: REQ_TYPES,
    RISKS: RISKS,
    VERIFY_METHODS: VERIFY_METHODS,
    RELTYPES: RELTYPES,
    detect: function(text) {
      return window.MA.parserUtils.detectDiagramType(text) === 'requirementDiagram';
    },
    parse: parseRequirement,
    parseRequirement: parseRequirement,
    addRequirement: addRequirement,
    addElement: addElement,
    addRelation: addRelation,
    deleteElement: deleteElement,
    deleteRelation: deleteRelation,
    updateRequirementField: updateRequirementField,
    updateRequirementType: updateRequirementType,
    updateElementField: updateElementField,
    updateRelation: updateRelation,
    updateName: updateName,
    template: function() {
      return [
        'requirementDiagram',
        '',
        'requirement sample_req {',
        '    id: REQ-001',
        '    text: サンプル要件',
        '    risk: medium',
        '    verifymethod: test',
        '}',
        '',
        'element sample_elem {',
        '    type: code module',
        '    docref: src/sample.c',
        '}',
        '',
        'sample_elem - satisfies -> sample_req',
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

      var reqs = parsedData.elements.filter(function(e) { return e.kind === 'requirement'; });
      var elems = parsedData.elements.filter(function(e) { return e.kind === 'element'; });
      var rels = parsedData.relations;

      if (!selData || selData.length === 0) {
        var allNamesOpts = parsedData.elements.map(function(el) { return { value: el.name, label: el.name }; });
        if (allNamesOpts.length === 0) allNamesOpts = [{ value: '', label: '（要素を先に追加）' }];

        var reqTypeOpts = REQ_TYPES.map(function(rt) { return { value: rt, label: rt, selected: rt === 'requirement' }; });
        var reltypeOpts = RELTYPES.map(function(rt) { return { value: rt, label: rt, selected: rt === 'satisfies' }; });

        var reqsList = '';
        for (var i = 0; i < reqs.length; i++) {
          reqsList += P.listItemHtml({
            label: reqs[i].name,
            sublabel: '(' + reqs[i].reqType + (reqs[i].id ? ', id=' + reqs[i].id : '') + ')',
            selectClass: 'req-select-req', deleteClass: 'req-delete-req',
            dataElementId: reqs[i].name, dataLine: reqs[i].line,
          });
        }
        if (!reqsList) reqsList = P.emptyListHtml('（要件なし）');

        var elemsList = '';
        for (var j = 0; j < elems.length; j++) {
          elemsList += P.listItemHtml({
            label: elems[j].name,
            sublabel: elems[j].type ? '(' + elems[j].type + ')' : '',
            selectClass: 'req-select-elem', deleteClass: 'req-delete-elem',
            dataElementId: elems[j].name, dataLine: elems[j].line,
          });
        }
        if (!elemsList) elemsList = P.emptyListHtml('（要素なし）');

        var relsList = '';
        for (var k = 0; k < rels.length; k++) {
          relsList += P.listItemHtml({
            label: rels[k].from + ' - ' + rels[k].reltype + ' -> ' + rels[k].to,
            selectClass: 'req-select-rel', deleteClass: 'req-delete-rel',
            dataElementId: rels[k].id, dataLine: rels[k].line, mono: true,
          });
        }
        if (!relsList) relsList = P.emptyListHtml('（リレーションなし）');

        propsEl.innerHTML =
          '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Requirement Diagram</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">要件を追加</label>' +
            P.selectFieldHtml('Type', 'req-add-req-type', reqTypeOpts) +
            P.fieldHtml('Name', 'req-add-req-name', '', '') +
            P.primaryButtonHtml('req-add-req-btn', '+ 要件追加') +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">エレメントを追加</label>' +
            P.fieldHtml('Name', 'req-add-elem-name', '', '') +
            P.primaryButtonHtml('req-add-elem-btn', '+ エレメント追加') +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">リレーションを追加</label>' +
            P.selectFieldHtml('From', 'req-add-rel-from', allNamesOpts) +
            P.selectFieldHtml('Type', 'req-add-rel-type', reltypeOpts) +
            P.selectFieldHtml('To', 'req-add-rel-to', allNamesOpts) +
            P.primaryButtonHtml('req-add-rel-btn', '+ リレーション追加') +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">要件一覧</label>' +
            '<div>' + reqsList + '</div>' +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">エレメント一覧</label>' +
            '<div>' + elemsList + '</div>' +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">リレーション一覧</label>' +
            '<div>' + relsList + '</div>' +
          '</div>';

        P.bindEvent('req-add-req-btn', 'click', function() {
          var rtv = document.getElementById('req-add-req-type').value;
          var nv = document.getElementById('req-add-req-name').value.trim();
          if (!nv) { alert('Name は必須です'); return; }
          window.MA.history.pushHistory();
          ctx.setMmdText(addRequirement(ctx.getMmdText(), rtv, nv));
          ctx.onUpdate();
        });
        P.bindEvent('req-add-elem-btn', 'click', function() {
          var nv = document.getElementById('req-add-elem-name').value.trim();
          if (!nv) { alert('Name は必須です'); return; }
          window.MA.history.pushHistory();
          ctx.setMmdText(addElement(ctx.getMmdText(), nv));
          ctx.onUpdate();
        });
        P.bindEvent('req-add-rel-btn', 'click', function() {
          var fv = document.getElementById('req-add-rel-from').value;
          var tv = document.getElementById('req-add-rel-to').value;
          var rtv = document.getElementById('req-add-rel-type').value;
          if (!fv || !tv) { alert('From / To を選択してください'); return; }
          window.MA.history.pushHistory();
          ctx.setMmdText(addRelation(ctx.getMmdText(), fv, rtv, tv));
          ctx.onUpdate();
        });

        P.bindSelectButtons(propsEl, 'req-select-req', 'requirement');
        P.bindSelectButtons(propsEl, 'req-select-elem', 'element');
        P.bindSelectButtons(propsEl, 'req-select-rel', 'relation');
        P.bindDeleteButtons(propsEl, 'req-delete-req', ctx, function(t, ln) {
          var nm = '';
          for (var di = 0; di < parsedData.elements.length; di++) if (parsedData.elements[di].line === ln) { nm = parsedData.elements[di].name; break; }
          return deleteElement(t, ln, nm);
        });
        P.bindDeleteButtons(propsEl, 'req-delete-elem', ctx, function(t, ln) {
          var nm = '';
          for (var di = 0; di < parsedData.elements.length; di++) if (parsedData.elements[di].line === ln) { nm = parsedData.elements[di].name; break; }
          return deleteElement(t, ln, nm);
        });
        P.bindDeleteButtons(propsEl, 'req-delete-rel', ctx, deleteRelation);
        return;
      }

      // Detail panels: implemented in subsequent tasks (T14-T16)
      propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">詳細パネル (実装中)</p>';
    },
    operations: {
      add: function(text, kind, props) {
        if (kind === 'requirement') return addRequirement(text, props.reqType || 'requirement', props.name);
        if (kind === 'element') return addElement(text, props.name);
        if (kind === 'relation') return addRelation(text, props.from, props.reltype, props.to);
        return text;
      },
      delete: function(text, lineNum, opts) {
        opts = opts || {};
        if (opts.kind === 'relation') return deleteRelation(text, lineNum);
        return deleteElement(text, lineNum, opts.elementName);
      },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        if (opts.kind === 'relation') return updateRelation(text, lineNum, field, value);
        if (opts.kind === 'element') return updateElementField(text, lineNum, field, value);
        if (field === 'reqType') return updateRequirementType(text, lineNum, value);
        if (field === 'name') return updateName(text, lineNum, opts.oldName, value);
        return updateRequirementField(text, lineNum, field, value);
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
      connect: function(text, fromName, toName, props) {
        props = props || {};
        return addRelation(text, fromName, props.reltype || 'satisfies', toName);
      },
    },
  };
})();
