'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.state = (function() {
  // State diagram transition syntax: "A --> B : event" or "A --> B"
  // 書き出すときに &quot; へ逃がした " を、読むときに戻す。
  // 戻さないと、入れたラベルと一覧に出るラベルが食い違う。
  function decQuote(v) {
    return String(v == null ? '' : v).replace(/&quot;/g, '"');
  }

  function parseState(text) {
    var result = {
      meta: { version: 'v2' },
      elements: [],   // states (including start/end pseudo and fork/join/choice)
      relations: [],  // transitions
      groups: [],     // composite states
    };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var transCounter = 0;
    var compositeStack = [];
    var stateMap = {}; // id -> state element

    // Header
    for (var hi = 0; hi < lines.length; hi++) {
      var ht = lines[hi].trim();
      if (!ht || ht.indexOf('%%') === 0) continue;
      if (/^stateDiagram(-v2)?/.test(ht)) break;
      break;
    }

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^stateDiagram/.test(trimmed)) continue;

      // End of composite
      if (trimmed === '}') {
        if (compositeStack.length > 0) {
          var closingId = compositeStack.pop();
          for (var gi = result.groups.length - 1; gi >= 0; gi--) {
            if (result.groups[gi].id === closingId) {
              result.groups[gi].endLine = lineNum; break;
            }
          }
        }
        continue;
      }

      // Composite state start: state "Label" as Id {  OR  state Id {
      var compMatch = trimmed.match(/^state\s+(?:"([^"]+)"\s+as\s+)?(\S+)\s*\{\s*$/);
      if (compMatch) {
        var id = compMatch[2];
        var label = decQuote(compMatch[1]) || id;
        var grp = {
          kind: 'composite',
          id: id,
          label: label,
          line: lineNum,
          endLine: -1,
          parentId: compositeStack.length > 0 ? compositeStack[compositeStack.length - 1] : null,
        };
        result.groups.push(grp);
        // Also add as a state element
        if (!stateMap[id]) {
          var se = { kind: 'state', id: id, label: label, type: 'composite', line: lineNum };
          result.elements.push(se);
          stateMap[id] = se;
        }
        compositeStack.push(id);
        continue;
      }

      // State type: state Name <<fork>>  or  state Name <<join>>  or  state Name <<choice>>
      var specialMatch = trimmed.match(/^state\s+(\S+)\s+<<(fork|join|choice)>>/);
      if (specialMatch) {
        var sid = specialMatch[1];
        if (!stateMap[sid]) {
          var sel = { kind: 'state', id: sid, label: sid, type: specialMatch[2], line: lineNum };
          result.elements.push(sel);
          stateMap[sid] = sel;
        }
        continue;
      }

      // State alias: state "Label" as Id
      var aliasMatch = trimmed.match(/^state\s+"([^"]+)"\s+as\s+(\S+)\s*$/);
      if (aliasMatch) {
        var aid = aliasMatch[2];
        if (!stateMap[aid]) {
          var sea = { kind: 'state', id: aid, label: decQuote(aliasMatch[1]), type: 'simple', line: lineNum };
          result.elements.push(sea);
          stateMap[aid] = sea;
        }
        continue;
      }

      // Simple state declaration: state Id
      var stateDeclMatch = trimmed.match(/^state\s+(\S+)\s*$/);
      if (stateDeclMatch) {
        var stid = stateDeclMatch[1];
        if (!stateMap[stid]) {
          var sed = { kind: 'state', id: stid, label: stid, type: 'simple', line: lineNum };
          result.elements.push(sed);
          stateMap[stid] = sed;
        }
        continue;
      }

      // Note
      var noteMatch = trimmed.match(/^note\s+(left of|right of|above|below)\s+(\S+)\s*:\s*(.*)$/);
      if (noteMatch) {
        result.elements.push({
          kind: 'note',
          position: noteMatch[1],
          target: noteMatch[2],
          text: noteMatch[3],
          line: lineNum,
        });
        continue;
      }

      // Transition: From --> To : event  or  From --> To
      var tMatch = trimmed.match(/^(\S+|\[\*\])\s+-->\s+(\S+|\[\*\])(?:\s*:\s*(.*))?$/);
      if (tMatch) {
        var from = tMatch[1];
        var to = tMatch[2];
        var event = tMatch[3] || '';

        // Register states (if not [*] which is pseudo)
        function ensureState(stId, lineN) {
          if (stId === '[*]') return;
          if (!stateMap[stId]) {
            var newSt = { kind: 'state', id: stId, label: stId, type: 'simple', line: lineN };
            result.elements.push(newSt);
            stateMap[stId] = newSt;
          }
        }
        ensureState(from, lineNum);
        ensureState(to, lineNum);

        result.relations.push({
          kind: 'transition',
          id: '__tr_' + (transCounter++),
          from: from,
          to: to,
          label: event,
          line: lineNum,
          parentId: compositeStack.length > 0 ? compositeStack[compositeStack.length - 1] : null,
        });
        continue;
      }
    }

    return result;
  }

  // ── Updaters ──

  function addState(text, id, label, type) {
    type = type || 'simple';
    var newLine;
    if (type === 'fork' || type === 'join' || type === 'choice') {
      newLine = '    state ' + id + ' <<' + type + '>>';
    } else if (type === 'simple' && label && label !== id) {
      newLine = '    state "' + label + '" as ' + id;
    } else {
      newLine = '    state ' + id;
    }
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function _isStateLine(trimmed) {
    if (!trimmed) return false;
    if (trimmed.indexOf('%%') === 0) return false;
    if (/-->|--x|-\.->/.test(trimmed)) return false;
    if (/^(stateDiagram|state\s+"|direction|\[\*\]|note\s|}\s*$|{)/i.test(trimmed)) return false;
    return /^\w/.test(trimmed);
  }

  function _moveStateStep(text, lineNum, direction) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var target = idx + direction;
    while (target >= 0 && target < lines.length) {
      var t = lines[target].trim();
      if (!t || t.indexOf('%%') === 0) { target += direction; continue; }
      if (_isStateLine(t)) {
        var tmp = lines[idx];
        lines[idx] = lines[target];
        lines[target] = tmp;
        return lines.join('\n');
      }
      return text;
    }
    return text;
  }

  function moveStateUp(text, lineNum) { return _moveStateStep(text, lineNum, -1); }
  function moveStateDown(text, lineNum) { return _moveStateStep(text, lineNum, 1); }

  // Delete a state and every transition that touches it.
  //
  // Transitions declare both of their endpoints, so deleting "the line the state
  // was first seen on" removed one transition and left the state itself on the
  // canvas — every other transition still named it, and mermaid re-declares from
  // those. Pressing ✕ on Idle removed `[*] --> Idle` and Idle stayed.
  //
  // `stateId` is optional so older single-argument callers keep working.
  // 中身が無くなった合成状態を畳む。
  //
  // mermaid は空の合成状態を **parse は通す** のに、描画で落ちる:
  // "No such shape: roundedWithTitle"。`state S { }` も、ラベル付きの
  // `state "表示名" as S { }` も、入れ子の空も、コメントだけの中身も同じ
  // (v11.13.0 で実測)。parse が通ってしまうぶんステータスバーは OK のままで、
  // 図だけが消える。
  //
  // 合成状態の範囲は parseState() が返す groups から取る。ここで独自に `{` を
  // 数えると、範囲を決める述語と一覧を作る述語が別物になり、両者がずれた瞬間に
  // 誤った行が消える (block / c4 で実際に起きた「述語の非対称」)。
  function collapseEmptyComposites(text) {
    var cur = text;
    // 1回畳むごとに必ず2行以上減るので、行数を上限にすれば取りこぼさない。
    // 固定値 (200) にしていたとき、それより深い入れ子で畳み残しが出た。
    var maxRounds = text.split('\n').length + 2;
    for (var guard = 0; guard < maxRounds; guard++) {
      var parsed = parseState(cur);
      var lines = cur.split('\n');
      var target = null;
      for (var i = 0; i < parsed.groups.length; i++) {
        var g = parsed.groups[i];
        if (!g.endLine || g.endLine <= g.line) continue;   // 閉じていない合成は触らない
        var empty = true;
        for (var j = g.line; j < g.endLine - 1; j++) {     // 本体だけを見る (0 起点)
          var s = String(lines[j] || '').trim();
          if (!s || s.indexOf('%%') === 0) continue;       // 空行とコメントは中身ではない
          empty = false;
          break;
        }
        if (empty) { target = g; break; }
      }
      if (!target) return cur;
      // 中に残っているコメントは利用者が書いた文。畳む位置へ繰り上げる
      // (block の EG7 / c4 の T2 と同じ扱い)。
      var kept = [];
      var headIndent = String(lines[target.line - 1] || '').match(/^(\s*)/)[1];
      for (var k = target.line; k < target.endLine - 1; k++) {
        var ct = String(lines[k] || '').trim();
        if (ct.indexOf('%%') === 0) kept.push(headIndent + ct);
      }
      lines.splice.apply(lines, [target.line - 1, target.endLine - target.line + 1].concat(kept));
      cur = lines.join('\n');
    }
    return cur;
  }

  function deleteState(text, lineNum, stateId) {
    if (!stateId) return collapseEmptyComposites(window.MA.textUpdater.deleteLine(text, lineNum));
    var lines = text.split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      var tr = trimmed.match(/^(\S+|\[\*\])\s+-->\s+(\S+|\[\*\])(?:\s*:\s*(.*))?$/);
      if (tr && (tr[1] === stateId || tr[2] === stateId)) continue;
      var alias = trimmed.match(/^state\s+"[^"]+"\s+as\s+(\S+)\s*$/);
      if (alias && alias[1] === stateId) continue;
      var special = trimmed.match(/^state\s+(\S+)\s+<<(?:fork|join|choice)>>/);
      if (special && special[1] === stateId) continue;
      var decl = trimmed.match(/^state\s+(\S+)\s*$/);
      if (decl && decl[1] === stateId) continue;
      var note = trimmed.match(/^note\s+(?:left of|right of|above|below)\s+(\S+)\s*:/);
      if (note && note[1] === stateId) continue;
      out.push(lines[i]);
    }
    return collapseEmptyComposites(out.join('\n'));
  }

  // mermaid はラベル中の " をエスケープできないが、&quot; はそのまま " として
  // 描かれる (v11.13 実測)。別名の中に " が入ると parse が落ちるので逃がす。
  function encQuote(v) {
    return String(v == null ? '' : v).replace(/"/g, '&quot;');
  }

  function updateStateLabel(text, lineNum, newLabel, stateId) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    var indent = lines[idx].match(/^(\s*)/)[1];

    var aliasMatch = trimmed.match(/^state\s+"([^"]+)"\s+as\s+(\S+)\s*$/);
    if (aliasMatch) {
      lines[idx] = indent + 'state "' + encQuote(newLabel) + '" as ' + aliasMatch[2];
      return lines.join('\n');
    }
    var simpleMatch = trimmed.match(/^state\s+(\S+)\s*$/);
    if (simpleMatch) {
      // Need to convert to aliased form
      lines[idx] = indent + 'state "' + encQuote(newLabel) + '" as ' + simpleMatch[1];
      return lines.join('\n');
    }
    // 宣言行が無い状態。
    //
    // ひな形の状態は遷移 (`[*] --> Idle`) にしか現れないので、`state X` の行が無い。
    // 従来はそこで無言で戻っており、ラベル欄が何もしなかった。
    // 無いなら作る — 別名宣言を先頭 (図種宣言の直後) に挿してラベルを与える。
    // 遷移側は id のままなので、図の形は変わらない。
    if (stateId) {
      // 同じ値の書き戻しでは何もしない。
      //
      // 宣言行が無い状態のラベルは id と同じ文字が出ている。そこへ同じ文字を
      // 書き戻すと別名宣言が1行増え、図は変わらないのに一覧の並びだけがずれる。
      // 押していない要素を動かさないのが R1 の約束なので、ここで止める。
      if (String(newLabel) === String(stateId)) return text;
      var insertAt = 1;
      for (var k = 0; k < lines.length; k++) {
        if (/^(stateDiagram(-v2)?)/.test(lines[k].trim())) { insertAt = k + 1; break; }
      }
      var baseIndent = '    ';
      for (var k2 = insertAt; k2 < lines.length; k2++) {
        var t2 = lines[k2];
        if (t2.trim()) { baseIndent = t2.match(/^(\s*)/)[1]; break; }
      }
      lines.splice(insertAt, 0, baseIndent + 'state "' + encQuote(newLabel) + '" as ' + stateId);
      return lines.join('\n');
    }
    return text;
  }

  // 状態の ID を変える。参照している行をすべて追従させる。
  //
  // パネルには ID 欄が出ているのに、イベントが繋がっておらず**打鍵しても何も
  // 起きなかった** (R18 キーボード完結の走査を全21図種に広げて出た)。
  // 欄があるのに効かないのは、無いより悪い。効いたと思って先へ進んでしまう。
  //
  // 参照の追従が要るのは削除と同じ理由。宣言だけ変えると遷移が古い ID を指した
  // まま残り、mermaid は参照だけで状態を作るので**幽霊状態が生える**。
  function updateStateId(text, oldId, newId) {
    if (!oldId || newId == null) return text;
    newId = String(newId).trim();
    if (!newId || newId === oldId || newId === '[*]') return text;
    // 既にある ID へは変えない (黙って2つの状態を1つに統合させない)
    var existing = parseState(text).elements
      .filter(function(e) { return e.kind === 'state'; })
      .map(function(e) { return e.id; });
    if (existing.indexOf(newId) >= 0) return text;

    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var indent = lines[i].match(/^(\s*)/)[1];
      var trimmed = lines[i].trim();
      if (!trimmed) continue;

      var tr = trimmed.match(/^(\S+|\[\*\])\s+-->\s+(\S+|\[\*\])(\s*:\s*.*)?$/);
      if (tr) {
        var from = tr[1] === oldId ? newId : tr[1];
        var to = tr[2] === oldId ? newId : tr[2];
        if (from !== tr[1] || to !== tr[2]) {
          lines[i] = indent + from + ' --> ' + to + (tr[3] || '');
        }
        continue;
      }
      var alias = trimmed.match(/^state\s+("[^"]*")\s+as\s+(\S+)\s*$/);
      if (alias && alias[2] === oldId) {
        lines[i] = indent + 'state ' + alias[1] + ' as ' + newId;
        continue;
      }
      var special = trimmed.match(/^state\s+(\S+)\s+(<<(?:fork|join|choice)>>.*)$/);
      if (special && special[1] === oldId) {
        lines[i] = indent + 'state ' + newId + ' ' + special[2];
        continue;
      }
      var comp = trimmed.match(/^state\s+(\S+)\s*\{\s*$/);
      if (comp && comp[1] === oldId) {
        lines[i] = indent + 'state ' + newId + ' {';
        continue;
      }
      var decl = trimmed.match(/^state\s+(\S+)\s*$/);
      if (decl && decl[1] === oldId) {
        lines[i] = indent + 'state ' + newId;
        continue;
      }
      var note = trimmed.match(/^note\s+(left of|right of|above|below)\s+(\S+)(\s*:.*)$/);
      if (note && note[2] === oldId) {
        lines[i] = indent + 'note ' + note[1] + ' ' + newId + note[3];
        continue;
      }
    }
    return lines.join('\n');
  }

  function addTransition(text, from, to, event) {
    var newLine = '    ' + from + ' --> ' + to + (event ? ' : ' + event : '');
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  // 合成状態の中身が遷移だけだった場合、それを消すと合成が空になる。
  function deleteTransition(text, lineNum) {
    return collapseEmptyComposites(window.MA.textUpdater.deleteLine(text, lineNum));
  }

  function updateTransition(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = trimmed.match(/^(\S+|\[\*\])\s+-->\s+(\S+|\[\*\])(?:\s*:\s*(.*))?$/);
    if (!m) return text;
    var from = m[1], to = m[2], event = m[3] || '';
    if (field === 'from') from = value;
    else if (field === 'to') to = value;
    else if (field === 'label' || field === 'event') event = value;
    lines[idx] = indent + from + ' --> ' + to + (event ? ' : ' + event : '');
    return lines.join('\n');
  }

  // mermaid は中身の無い合成状態を **parse は通す** のに描画で落ちる
  // (`No such shape: roundedWithTitle`)。空のまま作ると「+ 複合状態を追加」を1回
  // 押しただけで図が消えるのに、ステータスバーは OK のままで手がかりが無い。
  // block の addGroup / c4 の addElement と同じく、必ず子を1つ添えて作る。
  //
  // 子は `[*] --> <id>_1` にする。`state <id>_1` は mermaid が受理しない
  // (同じ roundedWithTitle で落ちる。実機 v11.13.0 で確認)。裸の id 宣言も描けるが、
  // 合成状態の子はプロパティパネルの一覧に出ないため、遷移として置いたほうが
  // 「遷移一覧」から編集・削除できる。合成は初期状態を持つのが普通でもある。
  function freeStateId(text, want) {
    var parsed = parseState(text);
    var taken = parsed.elements.map(function(e) { return e.id; })
      .concat((parsed.groups || []).map(function(g) { return g.id; }));
    if (taken.indexOf(want) === -1) return want;
    for (var n = 2; n < 1000; n++) {
      if (taken.indexOf(want + '_' + n) === -1) return want + '_' + n;
    }
    return want;
  }

  function addComposite(text, id, label) {
    // コンテナ id 自体も重複させない。mermaid は重複した別名を黙って受理するのに、
    // プロパティパネルは最初の一致で選択を解決するので、その後の編集・削除が
    // 別の合成状態に当たる (c4 の uniqueId と同じ理由)。
    id = freeStateId(text, id);
    var childId = freeStateId(text + '\n    state ' + id, id + '_1');
    var block = [
      '    state "' + (label || id) + '" as ' + id + ' {',
      '        [*] --> ' + childId,
      '    }',
    ];
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice.apply(lines, [insertAt, 0].concat(block));
    return lines.join('\n');
  }

  // 合成を丸ごと消すと、それを囲んでいた外側の合成が空になることがある。
  function deleteComposite(text, startLine, endLine) {
    var lines = text.split('\n');
    lines.splice(startLine - 1, (endLine - startLine + 1));
    return collapseEmptyComposites(lines.join('\n'));
  }

  function addNote(text, position, target, noteText) {
    position = position || 'left of';
    var newLine = '    note ' + position + ' ' + target + ' : ' + (noteText || '');
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  // ── UI ──
  function buildOverlay(svgEl, parsedData, overlayEl) {
    // id="state-<状態名>-<連番>"。start/end の擬似ノード (state-root_start-0) は
    // parsedData に存在しないので、id 照合の時点で自然に外れる。
    window.MA.overlayGeom.buildNodeOverlay(svgEl, parsedData, overlayEl, {
      prefix: 'state',
      kindOf: function() { return 'state'; },
    });
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var fieldHtml = P.fieldHtml;
    var bindEvent = P.bindEvent;

    if (!selData || selData.length === 0) {
      var states = parsedData.elements.filter(function(e) { return e.kind === 'state'; });
      var transitions = parsedData.relations.filter(function(r) { return r.kind === 'transition'; });
      var composites = parsedData.groups.filter(function(g) { return g.kind === 'composite'; });

      var stateOpts = '<option value="[*]">[*] (start/end)</option>';
      for (var si = 0; si < states.length; si++) stateOpts += '<option value="' + escHtml(states[si].id) + '">' + escHtml(states[si].label) + '</option>';

      var typeOpts = '';
      var types = ['simple', 'fork', 'join', 'choice'];
      for (var ti = 0; ti < types.length; ti++) typeOpts += '<option value="' + types[ti] + '">' + types[ti] + '</option>';

      var statesList = '';
      for (var lsi = 0; lsi < states.length; lsi++) {
        var s = states[lsi];
        statesList += P.listItemHtml({ label: s.label, sublabel: '(' + s.id + ', ' + (s.type || 'simple') + ')', selectClass: 'st-select-state', deleteClass: 'st-delete-state', dataElementId: s.id, dataLine: s.line });
      }
      if (!statesList) statesList = P.emptyListHtml('（状態なし）');

      var transList = '';
      for (var lti = 0; lti < transitions.length; lti++) {
        var tr = transitions[lti];
        transList += P.listItemHtml({ label: tr.from + ' → ' + tr.to + (tr.label ? ' : ' + tr.label : ''), selectClass: 'st-select-trans', deleteClass: 'st-delete-trans', dataElementId: tr.id, dataLine: tr.line, mono: true });
      }
      if (!transList) transList = P.emptyListHtml('（遷移なし）');

      var compList = '';
      for (var lci = 0; lci < composites.length; lci++) {
        var c = composites[lci];
        compList += P.listItemHtml({ label: c.label, deleteClass: 'st-delete-comp', dataLine: c.line, dataEndLine: c.endLine });
      }
      if (!compList) compList = P.emptyListHtml('（なし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">State Diagram</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">状態を追加</label>' +
          fieldHtml('ID', 'st-add-state-id', '', 'Running') +
          fieldHtml('ラベル', 'st-add-state-label', '', 'Running State') +
          '<div style="display:flex;gap:4px;margin-bottom:8px;">' +
            '<select id="st-add-state-type" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' + typeOpts + '</select>' +
            '<button id="st-add-state-btn" title="状態を追加" style="background:var(--accent);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">+</button>' +
          '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">遷移を追加</label>' +
          P.selectFieldHtml('From', 'st-add-tr-from', [{value: '[*]', label: '[*] (start/end)'}].concat(states.map(function(s) { return { value: s.id, label: s.label }; }))) +
          P.selectFieldHtml('To', 'st-add-tr-to', [{value: '[*]', label: '[*] (start/end)'}].concat(states.map(function(s) { return { value: s.id, label: s.label }; }))) +
          fieldHtml('イベント', 'st-add-tr-event', '', 'click') +
          P.primaryButtonHtml('st-add-tr-btn', '+ 遷移追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">複合状態を追加</label>' +
          // ここだけ横並びだった。パネルは 220px 固定で、この行は約 330px 要る。
          // 実測では 1366 / 1500 / 1920 / 2560px のいずれでも `+` がパネルの外に
          // はみ出し、**どの画面幅でもマウスで押せなかった**。さらに横あふれで
          // パネル自体に横スクロールが生まれ、Tab で `+` へ到達すると 139px 右へ
          // ずれて戻らず、一覧行のラベルが隠れて「編集」「✕」だけが並ぶ。
          // 他の追加フォームと同じ縦積みにする。
          P.fieldHtml('ID', 'st-add-comp-id', '', '例: Running') +
          P.fieldHtml('ラベル', 'st-add-comp-label', '', '省略可、IDと同じ') +
          P.primaryButtonHtml('st-add-comp-btn', '+ 複合状態追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">状態一覧</label>' +
          '<div>' + statesList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">遷移一覧</label>' +
          '<div>' + transList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">複合状態一覧</label>' +
          '<div>' + compList + '</div>' +
        '</div>';

      bindEvent('st-add-state-btn', 'click', function() {
        var id = document.getElementById('st-add-state-id').value.trim();
        var label = document.getElementById('st-add-state-label').value.trim();
        var type = document.getElementById('st-add-state-type').value;
        if (!id) { alert('ID は必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addState(ctx.getMmdText(), id, label || id, type));
        ctx.onUpdate();
      });
      bindEvent('st-add-tr-btn', 'click', function() {
        var from = document.getElementById('st-add-tr-from').value;
        var to = document.getElementById('st-add-tr-to').value;
        var event = document.getElementById('st-add-tr-event').value.trim();
        if (!from || !to) { alert('状態を先に選択してください'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addTransition(ctx.getMmdText(), from, to, event));
        ctx.onUpdate();
      });
      bindEvent('st-add-comp-btn', 'click', function() {
        var id = document.getElementById('st-add-comp-id').value.trim();
        var label = document.getElementById('st-add-comp-label').value.trim();
        if (!id) { alert('ID は必須です'); return; }
        // 重複を黙って改名すると、設計書と id を揃えている利用者が取り違える。
        var finalId = freeStateId(ctx.getMmdText(), id);
        if (finalId !== id) {
          alert('ID "' + id + '" は既に使われているため "' + finalId + '" で追加します');
        }
        window.MA.history.pushHistory();
        ctx.setMmdText(addComposite(ctx.getMmdText(), id, label));
        ctx.onUpdate();
      });
      P.bindSelectButtons(propsEl, 'st-select-state', 'state');
      P.bindSelectButtons(propsEl, 'st-select-trans', 'transition');
      // 遷移行が両端の状態を宣言するので、id なしだと押した状態が残る
      P.bindDeleteButtons(propsEl, 'st-delete-state', ctx, function(t, ln, elId) {
        return deleteState(t, ln, elId);
      });
      P.bindDeleteButtons(propsEl, 'st-delete-trans', ctx, deleteTransition);
      P.bindDeleteButtons(propsEl, 'st-delete-comp', ctx, deleteComposite, true);
      return;
    }

    // Single state selected
    if (selData.length === 1 && selData[0].type === 'state') {
      var sid = selData[0].id;
      var st = null;
      for (var pj = 0; pj < parsedData.elements.length; pj++) {
        if (parsedData.elements[pj].kind === 'state' && parsedData.elements[pj].id === sid) { st = parsedData.elements[pj]; break; }
      }
      if (!st) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">状態が見つかりません</p>'; return; }
      propsEl.innerHTML =
        P.panelHeaderHtml(st.label) +
        fieldHtml('ID', 'sel-state-id', st.id) +
        fieldHtml('ラベル', 'sel-state-label', st.label) +
        '<div style="margin-bottom:8px;color:var(--text-secondary);font-size:11px;">種別: ' + escHtml(st.type || 'simple') + '</div>' +
        P.connectButtonHtml('sel-state-connect') +
        P.actionBarHtml('sel-state', {
          insertBefore: false, insertAfter: false,
          // move は無効。_is*Line が「宣言行か」で判定しており、コンポジット状態 (`state Active {`) を宣言行と誤判定し、他状態の子に吸い込む。
          // mermaid の parse も render も通るため無言で壊れる。述語をブレース深度
          // ベースに直すまで UI から出さない (敵対レビュー指摘)。
          move: false, delete: true,
          // できないことを**言う** (UI-049)。
          //
          // 最初に書いた理由 (「行が遷移行を指すため」) はひな形だけを測ったもので、
          // `state Idle` のような宣言行を持つ文書では成り立たなかった。
          // **本当の理由はもっと悪い — 図が壊れる。**
          //
          // 実測 (コンポジット状態を含む文書で Active を上へ):
          //     state Active {
          //     state Idle          ← 隣の状態が Active の**中に取り込まれた**
          //         [*] --> Warm
          //     }
          // mermaid の parse も render も通るので、無言で別の図になる。
          moveDisabledReason: 'コンポジット状態を動かすと、隣の状態がその中に取り込まれて図が壊れます',
          labels: { delete: '状態削除' },
        });

      P.bindConnectButton('sel-state-connect', 'state', st.id,
        function(fromId, toId) { return addTransition(ctx.getMmdText(), fromId, toId); });

      document.getElementById('sel-state-label').addEventListener('change', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(updateStateLabel(ctx.getMmdText(), st.line, this.value, st.id));
        ctx.onUpdate();
      });
      // ID 欄。以前は欄だけ出ていて何も繋がっておらず、打鍵しても無反応だった。
      // 欄があるのに効かないのは無いより悪い (効いたと思って先へ進む)。
      document.getElementById('sel-state-id').addEventListener('change', function() {
        var next = updateStateId(ctx.getMmdText(), st.id, this.value);
        if (next === ctx.getMmdText()) {
          // 空・重複・[*] は拒否する。黙って戻すと「効かない欄」に見えるので告げる。
          this.value = st.id;
          if (ctx.showTransient) ctx.showTransient('その ID は使えません (空・重複・[*] は不可)');
          return;
        }
        window.MA.history.pushHistory();
        ctx.setMmdText(next);
        window.MA.selection.setSelected([{ type: 'state', id: String(this.value).trim() }]);
        ctx.onUpdate();
      });
      P.bindActionBar('sel-state', {
        up: function() {
          var newText = moveStateUp(ctx.getMmdText(), st.line);
          if (newText === ctx.getMmdText()) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(newText);
          window.MA.selection.setSelected([{ type: 'state', id: st.id }]);
          ctx.onUpdate();
        },
        down: function() {
          var newText = moveStateDown(ctx.getMmdText(), st.line);
          if (newText === ctx.getMmdText()) return;
          window.MA.history.pushHistory();
          ctx.setMmdText(newText);
          window.MA.selection.setSelected([{ type: 'state', id: st.id }]);
          ctx.onUpdate();
        },
        'delete': function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteState(ctx.getMmdText(), st.line, st.id));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        },
      });
      return;
    }

    // Single transition selected
    if (selData.length === 1 && selData[0].type === 'transition') {
      var tid = selData[0].id;
      var tr = null;
      for (var tj = 0; tj < parsedData.relations.length; tj++) {
        if (parsedData.relations[tj].id === tid) { tr = parsedData.relations[tj]; break; }
      }
      if (!tr) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">遷移が見つかりません</p>'; return; }
      var states2 = parsedData.elements.filter(function(e) { return e.kind === 'state'; });
      var fromOpts = '<option value="[*]"' + (tr.from === '[*]' ? ' selected' : '') + '>[*]</option>';
      var toOpts = '<option value="[*]"' + (tr.to === '[*]' ? ' selected' : '') + '>[*]</option>';
      for (var so = 0; so < states2.length; so++) {
        var sid2 = states2[so].id;
        fromOpts += '<option value="' + escHtml(sid2) + '"' + (sid2 === tr.from ? ' selected' : '') + '>' + escHtml(states2[so].label) + '</option>';
        toOpts += '<option value="' + escHtml(sid2) + '"' + (sid2 === tr.to ? ' selected' : '') + '>' + escHtml(states2[so].label) + '</option>';
      }
      propsEl.innerHTML =
        P.panelHeaderHtml('Transition') +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">From</label><select id="sel-tr-from" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + fromOpts + '</select></div>' +
        '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">To</label><select id="sel-tr-to" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' + toOpts + '</select></div>' +
        fieldHtml('イベント', 'sel-tr-event', tr.label) +
        P.actionBarHtml('sel-tr', {
          insertBefore: false, insertAfter: false,
          move: false, delete: true,
          labels: { delete: '遷移削除' },
        });

      document.getElementById('sel-tr-from').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateTransition(ctx.getMmdText(), tr.line, 'from', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-tr-to').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateTransition(ctx.getMmdText(), tr.line, 'to', this.value)); ctx.onUpdate(); });
      document.getElementById('sel-tr-event').addEventListener('change', function() { window.MA.history.pushHistory(); ctx.setMmdText(updateTransition(ctx.getMmdText(), tr.line, 'event', this.value)); ctx.onUpdate(); });
      P.bindActionBar('sel-tr', {
        'delete': function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteTransition(ctx.getMmdText(), tr.line));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        },
      });
      return;
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'stateDiagram',
    displayName: 'State',
    detect: function(text) {
      return window.MA.parserUtils.detectDiagramType(text) === 'stateDiagram';
    },
    parse: parseState,
    template: function() {
      return [
        'stateDiagram-v2',
        '    [*] --> Idle',
        '    Idle --> Running : start',
        '    Running --> Idle : stop',
        '    Running --> [*]',
      ].join('\n');
    },
    buildOverlay: buildOverlay,
    renderProps: renderProps,
    operations: {
      add: function(text, kind, props) {
        if (kind === 'state') return addState(text, props.id, props.label, props.type);
        if (kind === 'transition') return addTransition(text, props.from, props.to, props.event || props.label);
        if (kind === 'composite') return addComposite(text, props.id, props.label);
        if (kind === 'note') return addNote(text, props.position, props.target, props.text);
        return text;
      },
      delete: function(text, lineNum, opts) {
        opts = opts || {};
        // id を渡されたら id 認識の削除を使う。
        //
        // ここは単なる deleteLine だったので、宣言行だけ消えて参照が残る。
        // mermaid は参照だけで状態を作るので、**一覧から消えても図には残る**。
        // A10 で UI の経路は直したが、契約の経路が古いままだった (r2 を契約ベースにして発覚)。
        if (opts.id) return deleteState(text, lineNum, opts.id);
        // id 無しの経路も畳み込みを通す。ここだけ素の deleteLine のままだと、
        // 合成状態の中身が1行しか無い図で `state S { }` が残り mermaid が render で
        // 落ちる。class の operations.delete は classId が undefined でも
        // collapseEmptyNamespaces を通っており、**同じコミットの中で state と class の
        // 判断が割れていた**。今は app.js が必ず id を渡すので到達しないが、
        // 契約テストと将来の呼び手が踏む。
        return collapseEmptyComposites(window.MA.textUpdater.deleteLine(text, lineNum));
      },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        // 分岐は opts.kind で行う。
        //
        // 以前は行の中身に '-->' があるかだけで判定していた。ただ stateDiagram では
        // 状態は遷移行で宣言されるのが普通なので (`[*] --> Idle`)、**状態を選んで
        // ラベルを変えると遷移のラベルが書き換わっていた**。状態の名前は変わらず、
        // 矢印に覚えの無い文字が出る。エラーは出ないので気付きにくい。
        if (opts.kind === 'state') {
          if (field === 'id' || field === 'name') return updateStateId(text, opts.id, value);
          if (field !== 'label') return text;
          return updateStateLabel(text, lineNum, value, opts.id);
        }
        if (opts.kind === 'transition') return updateTransition(text, lineNum, field, value);
        // kind が無い呼び方 (旧い呼出し) は従来どおり行の中身で判定する
        var lines = text.split('\n');
        var trimmed = (lines[lineNum - 1] || '').trim();
        if (trimmed.indexOf('-->') > 0) return updateTransition(text, lineNum, field, value);
        if (field === 'label') return updateStateLabel(text, lineNum, value);
        return text;
      },
      // 素の行入れ替えは**図の宣言行と入れ替わって図を壊す**。
      // 同じ種類の要素が乗っている行としか入れ替えない。
      moveUp: function(text, lineNum) {
        return window.MA.textUpdater.moveElementLine(
          text, lineNum, -1, (parseState(text).elements || []));
      },
      moveDown: function(text, lineNum) {
        return window.MA.textUpdater.moveElementLine(
          text, lineNum, 1, (parseState(text).elements || []));
      },
      connect: function(text, fromId, toId, props) {
        props = props || {};
        return addTransition(text, fromId, toId, props.event || props.label);
      },
    },
    parseState: parseState,
    addState: addState,
    deleteState: deleteState,
    moveStateUp: moveStateUp,
    moveStateDown: moveStateDown,
    updateStateLabel: updateStateLabel,
    updateStateId: updateStateId,
    addTransition: addTransition,
    deleteTransition: deleteTransition,
    updateTransition: updateTransition,
    addComposite: addComposite,
    deleteComposite: deleteComposite,
    addNote: addNote,
  };
})();
