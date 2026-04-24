'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.gitGraph = (function() {
  var COMMIT_TYPES = ['NORMAL', 'REVERSE', 'HIGHLIGHT'];

  function parseArgsToken(str) {
    // Parse space-separated `key: value` pairs where value may be "quoted" or bare
    var result = {};
    var re = /(\w+)\s*:\s*(?:"([^"]*)"|(\S+))/g;
    var m;
    while ((m = re.exec(str)) !== null) {
      result[m[1]] = m[2] !== undefined ? m[2] : m[3];
    }
    return result;
  }

  function parseGitgraph(text) {
    var result = { meta: {}, elements: [], relations: [] };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var currentBranch = 'main';

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^gitGraph/.test(trimmed)) continue;

      // commit
      if (/^commit\b/.test(trimmed)) {
        var argStr = trimmed.replace(/^commit\s*/, '');
        var args = parseArgsToken(argStr);
        result.elements.push({
          kind: 'commit',
          id: args.id || '',
          commitType: args.type || 'NORMAL',
          tag: args.tag || '',
          branch: currentBranch,
          line: lineNum,
        });
        continue;
      }

      // branch
      var bm = trimmed.match(/^branch\s+(\S+)/);
      if (bm) {
        result.elements.push({
          kind: 'branch',
          name: bm[1],
          fromBranch: currentBranch,
          line: lineNum,
        });
        currentBranch = bm[1];
        continue;
      }

      // checkout
      var cm = trimmed.match(/^checkout\s+(\S+)/);
      if (cm) {
        result.elements.push({
          kind: 'checkout',
          target: cm[1],
          line: lineNum,
        });
        currentBranch = cm[1];
        continue;
      }

      // merge
      var mm = trimmed.match(/^merge\s+(\S+)(.*)/);
      if (mm) {
        var margs = parseArgsToken(mm[2]);
        result.elements.push({
          kind: 'merge',
          target: mm[1],
          tag: margs.tag || '',
          mergeType: margs.type || 'NORMAL',
          line: lineNum,
        });
        continue;
      }

      // cherry-pick
      if (/^cherry-pick\b/.test(trimmed)) {
        var cargs = parseArgsToken(trimmed.replace(/^cherry-pick\s*/, ''));
        result.elements.push({
          kind: 'cherry-pick',
          id: cargs.id || '',
          tag: cargs.tag || '',
          line: lineNum,
        });
      }
    }
    return result;
  }

  function formatCommit(id, type, tag) {
    var parts = ['commit'];
    if (id) parts.push('id: "' + id + '"');
    if (type && type !== 'NORMAL') parts.push('type: ' + type);
    if (tag) parts.push('tag: "' + tag + '"');
    return '    ' + parts.join(' ');
  }

  function addCommit(text, id, type, tag) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, formatCommit(id, type, tag));
    return lines.join('\n');
  }

  function addBranch(text, name) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, '    branch ' + name);
    return lines.join('\n');
  }

  function addCheckout(text, target) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, '    checkout ' + target);
    return lines.join('\n');
  }

  function addMerge(text, target, tag) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    var line = '    merge ' + target + (tag ? ' tag: "' + tag + '"' : '');
    lines.splice(insertAt, 0, line);
    return lines.join('\n');
  }

  function addCherryPick(text, id) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, '    cherry-pick id: "' + id + '"');
    return lines.join('\n');
  }

  function deleteLine(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updateCommit(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    if (!/^commit\b/.test(trimmed)) return text;
    var args = parseArgsToken(trimmed.replace(/^commit\s*/, ''));
    if (field === 'id') args.id = value;
    else if (field === 'type') args.type = value;
    else if (field === 'tag') args.tag = value;
    // Rebuild
    var parts = ['commit'];
    if (args.id) parts.push('id: "' + args.id + '"');
    if (args.type && args.type !== 'NORMAL') parts.push('type: ' + args.type);
    if (args.tag) parts.push('tag: "' + args.tag + '"');
    var indent = lines[idx].match(/^(\s*)/)[1];
    lines[idx] = indent + parts.join(' ');
    return lines.join('\n');
  }

  function updateBranch(text, lineNum, newName) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    lines[idx] = indent + 'branch ' + newName;
    return lines.join('\n');
  }

  function updateCheckout(text, lineNum, newTarget) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    lines[idx] = indent + 'checkout ' + newTarget;
    return lines.join('\n');
  }

  function updateMerge(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    var m = trimmed.match(/^merge\s+(\S+)(.*)/);
    if (!m) return text;
    var target = m[1];
    var args = parseArgsToken(m[2]);
    if (field === 'target') target = value;
    else if (field === 'tag') args.tag = value;
    else if (field === 'type') args.type = value;
    var parts = ['merge', target];
    if (args.type && args.type !== 'NORMAL') parts.push('type: ' + args.type);
    if (args.tag) parts.push('tag: "' + args.tag + '"');
    var indent = lines[idx].match(/^(\s*)/)[1];
    lines[idx] = indent + parts.join(' ');
    return lines.join('\n');
  }

  function updateCherryPick(text, lineNum, newId) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    lines[idx] = indent + 'cherry-pick id: "' + newId + '"';
    return lines.join('\n');
  }

  // ── UI ──
  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var els = parsedData.elements;
    var branches = els.filter(function(e) { return e.kind === 'branch'; }).map(function(b) { return b.name; });
    branches.unshift('main');  // main is implicit default

    var commits = els.filter(function(e) { return e.kind === 'commit'; });

    if (!selData || selData.length === 0) {
      var branchOpts = branches.map(function(b) { return { value: b, label: b }; });
      var typeOpts = COMMIT_TYPES.map(function(t) { return { value: t, label: t, selected: t === 'NORMAL' }; });
      var commitIdOpts = commits.filter(function(c) { return c.id; }).map(function(c) { return { value: c.id, label: c.id }; });
      if (commitIdOpts.length === 0) commitIdOpts = [{ value: '', label: '（id 付 commit が未登録）' }];

      var itemsList = '';
      for (var i = 0; i < els.length; i++) {
        var e = els[i];
        var label = '';
        if (e.kind === 'commit') {
          label = 'commit' + (e.id ? ' id:"' + e.id + '"' : '') + (e.commitType !== 'NORMAL' ? ' type:' + e.commitType : '') + (e.tag ? ' tag:"' + e.tag + '"' : '');
        } else if (e.kind === 'branch') label = 'branch ' + e.name;
        else if (e.kind === 'checkout') label = 'checkout ' + e.target;
        else if (e.kind === 'merge') label = 'merge ' + e.target + (e.tag ? ' tag:"' + e.tag + '"' : '');
        else if (e.kind === 'cherry-pick') label = 'cherry-pick id:"' + e.id + '"';
        itemsList += P.listItemHtml({
          label: label, sublabel: '[' + e.kind + ']',
          selectClass: 'gg-select-item', deleteClass: 'gg-delete-item',
          dataElementId: String(e.line), dataLine: e.line, mono: true,
        });
      }
      if (!itemsList) itemsList = P.emptyListHtml('（アイテムなし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Gitgraph</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">Commit を追加</label>' +
          P.fieldHtml('id (任意)', 'gg-add-commit-id', '') +
          P.selectFieldHtml('type', 'gg-add-commit-type', typeOpts) +
          P.fieldHtml('tag (任意)', 'gg-add-commit-tag', '') +
          P.primaryButtonHtml('gg-add-commit-btn', '+ Commit 追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">Branch を追加</label>' +
          P.fieldHtml('Branch name', 'gg-add-branch-name', '') +
          P.primaryButtonHtml('gg-add-branch-btn', '+ Branch 追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">Checkout を追加</label>' +
          P.selectFieldHtml('Target branch', 'gg-add-checkout-target', branchOpts) +
          P.primaryButtonHtml('gg-add-checkout-btn', '+ Checkout 追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">Merge を追加</label>' +
          P.selectFieldHtml('Target branch', 'gg-add-merge-target', branchOpts) +
          P.fieldHtml('tag (任意)', 'gg-add-merge-tag', '') +
          P.primaryButtonHtml('gg-add-merge-btn', '+ Merge 追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">Cherry-pick を追加</label>' +
          P.selectFieldHtml('Commit id', 'gg-add-cp-id', commitIdOpts) +
          P.primaryButtonHtml('gg-add-cp-btn', '+ Cherry-pick 追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">アイテム一覧</label>' +
          '<div>' + itemsList + '</div>' +
        '</div>';

      P.bindEvent('gg-add-commit-btn', 'click', function() {
        var id = document.getElementById('gg-add-commit-id').value.trim();
        var type = document.getElementById('gg-add-commit-type').value;
        var tag = document.getElementById('gg-add-commit-tag').value.trim();
        window.MA.history.pushHistory();
        ctx.setMmdText(addCommit(ctx.getMmdText(), id, type, tag));
        ctx.onUpdate();
      });
      P.bindEvent('gg-add-branch-btn', 'click', function() {
        var name = document.getElementById('gg-add-branch-name').value.trim();
        if (!name) { alert('Branch name は必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addBranch(ctx.getMmdText(), name));
        ctx.onUpdate();
      });
      P.bindEvent('gg-add-checkout-btn', 'click', function() {
        var t = document.getElementById('gg-add-checkout-target').value;
        if (!t) return;
        window.MA.history.pushHistory();
        ctx.setMmdText(addCheckout(ctx.getMmdText(), t));
        ctx.onUpdate();
      });
      P.bindEvent('gg-add-merge-btn', 'click', function() {
        var t = document.getElementById('gg-add-merge-target').value;
        var tag = document.getElementById('gg-add-merge-tag').value.trim();
        if (!t) return;
        window.MA.history.pushHistory();
        ctx.setMmdText(addMerge(ctx.getMmdText(), t, tag));
        ctx.onUpdate();
      });
      P.bindEvent('gg-add-cp-btn', 'click', function() {
        var id = document.getElementById('gg-add-cp-id').value.trim();
        if (!id) { alert('Commit id が必要です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addCherryPick(ctx.getMmdText(), id));
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'gg-select-item', 'item');
      P.bindDeleteButtons(propsEl, 'gg-delete-item', ctx, deleteLine);
      return;
    }

    if (selData.length === 1) {
      var sel = selData[0];
      var found = null;
      for (var fj = 0; fj < els.length; fj++) if (String(els[fj].line) === String(sel.id)) { found = els[fj]; break; }
      if (!found) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">アイテムが見つかりません</p>'; return; }

      var foundLine = found.line;
      var html = P.panelHeaderHtml('[' + found.kind + ']');

      if (found.kind === 'commit') {
        var typeOpts2 = COMMIT_TYPES.map(function(t) { return { value: t, label: t, selected: t === found.commitType }; });
        html += P.fieldHtml('id', 'gg-edit-id', found.id);
        html += P.selectFieldHtml('type', 'gg-edit-type', typeOpts2);
        html += P.fieldHtml('tag', 'gg-edit-tag', found.tag);
      } else if (found.kind === 'branch') {
        html += P.fieldHtml('name', 'gg-edit-branch-name', found.name);
      } else if (found.kind === 'checkout') {
        html += P.fieldHtml('target', 'gg-edit-checkout-target', found.target);
      } else if (found.kind === 'merge') {
        html += P.fieldHtml('target', 'gg-edit-merge-target', found.target);
        html += P.fieldHtml('tag', 'gg-edit-merge-tag', found.tag);
      } else if (found.kind === 'cherry-pick') {
        html += P.fieldHtml('id', 'gg-edit-cp-id', found.id);
      }
      html += P.dangerButtonHtml('gg-edit-delete', '削除');
      propsEl.innerHTML = html;

      if (found.kind === 'commit') {
        document.getElementById('gg-edit-id').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateCommit(ctx.getMmdText(), foundLine, 'id', this.value));
          ctx.onUpdate();
        });
        document.getElementById('gg-edit-type').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateCommit(ctx.getMmdText(), foundLine, 'type', this.value));
          ctx.onUpdate();
        });
        document.getElementById('gg-edit-tag').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateCommit(ctx.getMmdText(), foundLine, 'tag', this.value));
          ctx.onUpdate();
        });
      } else if (found.kind === 'branch') {
        document.getElementById('gg-edit-branch-name').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateBranch(ctx.getMmdText(), foundLine, this.value));
          ctx.onUpdate();
        });
      } else if (found.kind === 'checkout') {
        document.getElementById('gg-edit-checkout-target').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateCheckout(ctx.getMmdText(), foundLine, this.value));
          ctx.onUpdate();
        });
      } else if (found.kind === 'merge') {
        document.getElementById('gg-edit-merge-target').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateMerge(ctx.getMmdText(), foundLine, 'target', this.value));
          ctx.onUpdate();
        });
        document.getElementById('gg-edit-merge-tag').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateMerge(ctx.getMmdText(), foundLine, 'tag', this.value));
          ctx.onUpdate();
        });
      } else if (found.kind === 'cherry-pick') {
        document.getElementById('gg-edit-cp-id').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateCherryPick(ctx.getMmdText(), foundLine, this.value));
          ctx.onUpdate();
        });
      }
      P.bindEvent('gg-edit-delete', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(deleteLine(ctx.getMmdText(), foundLine));
        window.MA.selection.clearSelection();
        ctx.onUpdate();
      });
      return;
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'gitGraph',
    displayName: 'Gitgraph',
    COMMIT_TYPES: COMMIT_TYPES,
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'gitGraph'; },
    parse: parseGitgraph,
    parseGitgraph: parseGitgraph,
    template: function() {
      return [
        'gitGraph',
        '    commit',
        '    commit id: "init"',
        '    branch develop',
        '    commit',
        '    checkout main',
        '    merge develop',
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
    renderProps: renderProps,
    operations: {
      add: function(text, kind, props) {
        if (kind === 'commit') return addCommit(text, props.id || '', props.type || 'NORMAL', props.tag || '');
        if (kind === 'branch') return addBranch(text, props.name);
        if (kind === 'checkout') return addCheckout(text, props.target);
        if (kind === 'merge') return addMerge(text, props.target, props.tag);
        if (kind === 'cherry-pick') return addCherryPick(text, props.id);
        return text;
      },
      delete: function(text, lineNum) { return deleteLine(text, lineNum); },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        if (opts.kind === 'commit') return updateCommit(text, lineNum, field, value);
        if (opts.kind === 'branch') return updateBranch(text, lineNum, value);
        if (opts.kind === 'checkout') return updateCheckout(text, lineNum, value);
        if (opts.kind === 'merge') return updateMerge(text, lineNum, field, value);
        if (opts.kind === 'cherry-pick') return updateCherryPick(text, lineNum, value);
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
      connect: function(text) { return text; },
    },
    addCommit: addCommit, addBranch: addBranch, addCheckout: addCheckout, addMerge: addMerge, addCherryPick: addCherryPick,
    updateCommit: updateCommit, updateBranch: updateBranch, updateCheckout: updateCheckout, updateMerge: updateMerge, updateCherryPick: updateCherryPick,
    deleteLine: deleteLine,
  };
})();
