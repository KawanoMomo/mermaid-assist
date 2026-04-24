'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.journey = (function() {

  function parseJourney(text) {
    var result = { meta: { title: '' }, elements: [], relations: [] };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var taskCounter = 0;
    var currentSection = null;

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^journey/.test(trimmed)) continue;

      var tm = trimmed.match(/^title\s+(.+)$/);
      if (tm) { result.meta.title = tm[1].trim(); continue; }

      var sm = trimmed.match(/^section\s+(.+)$/);
      if (sm) {
        currentSection = sm[1].trim();
        result.elements.push({ kind: 'section', id: currentSection, label: currentSection, line: lineNum });
        continue;
      }

      // Task: text: score: actors
      var km = trimmed.match(/^(.+?):\s*(-?\d+(?:\.\d+)?)\s*:\s*(.+)$/);
      if (km) {
        var actors = km[3].split(',').map(function(a) { return a.trim(); }).filter(function(a) { return a.length > 0; });
        result.elements.push({
          kind: 'task',
          id: '__t_' + (taskCounter++),
          text: km[1].trim(),
          score: parseFloat(km[2]),
          actors: actors,
          parentId: currentSection,
          line: lineNum,
        });
      }
    }
    return result;
  }

  function setTitle(text, newTitle) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t || t.indexOf('%%') === 0) continue;
      if (/^title\s+/.test(t)) {
        var indent = lines[i].match(/^(\s*)/)[1];
        lines[i] = indent + 'title ' + newTitle;
        return lines.join('\n');
      }
      // Insert after journey header
      if (/^journey/.test(t)) {
        lines.splice(i + 1, 0, '    title ' + newTitle);
        return lines.join('\n');
      }
    }
    return text;
  }

  function addSection(text, name) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, '    section ' + name);
    return lines.join('\n');
  }

  function addTask(text, sectionName, taskText, score, actors) {
    var lines = text.split('\n');
    var secIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].trim().match(/^section\s+(.+)$/);
      if (m && m[1].trim() === sectionName) { secIdx = i; break; }
    }
    if (secIdx < 0) return text;
    var insertAt = lines.length;
    for (var j = secIdx + 1; j < lines.length; j++) {
      if (/^\s*section\s+/.test(lines[j])) { insertAt = j; break; }
    }
    while (insertAt > secIdx + 1 && lines[insertAt - 1].trim() === '') insertAt--;
    var actorsStr = Array.isArray(actors) ? actors.join(', ') : actors;
    var newLine = '      ' + taskText + ': ' + score + ': ' + actorsStr;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function deleteElement(text, lineNum) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    if (/^section\s+/.test(trimmed)) {
      var endIdx = lines.length;
      for (var j = idx + 1; j < lines.length; j++) {
        if (/^\s*section\s+/.test(lines[j])) { endIdx = j; break; }
      }
      lines.splice(idx, endIdx - idx);
      return lines.join('\n');
    }
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }

  function updateSection(text, lineNum, newName) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    lines[idx] = indent + 'section ' + newName;
    return lines.join('\n');
  }

  function updateTask(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = lines[idx].trim().match(/^(.+?):\s*(-?\d+(?:\.\d+)?)\s*:\s*(.+)$/);
    if (!m) return text;
    var t = m[1].trim(), s = m[2], a = m[3].trim();
    if (field === 'text') t = value;
    else if (field === 'score') s = value;
    else if (field === 'actors') a = Array.isArray(value) ? value.join(', ') : value;
    lines[idx] = indent + t + ': ' + s + ': ' + a;
    return lines.join('\n');
  }

  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var sections = parsedData.elements.filter(function(e) { return e.kind === 'section'; });
    var tasks = parsedData.elements.filter(function(e) { return e.kind === 'task'; });

    if (!selData || selData.length === 0) {
      var secOpts = sections.map(function(s) { return { value: s.id, label: s.id }; });
      if (secOpts.length === 0) secOpts = [{ value: '', label: '（セクションを先に追加）' }];

      var sectionsList = '';
      for (var si = 0; si < sections.length; si++) {
        var s = sections[si];
        var childCount = tasks.filter(function(t) { return t.parentId === s.id; }).length;
        sectionsList += P.listItemHtml({
          label: s.label, sublabel: '(' + childCount + ' tasks)',
          selectClass: 'jr-select-section', deleteClass: 'jr-delete-section',
          dataElementId: s.id, dataLine: s.line,
        });
      }
      if (!sectionsList) sectionsList = P.emptyListHtml('（セクションなし）');

      var tasksList = '';
      for (var ti = 0; ti < tasks.length; ti++) {
        var t = tasks[ti];
        tasksList += P.listItemHtml({
          label: t.text + ' (' + t.score + ')',
          sublabel: '[' + (t.parentId || '?') + '] ' + t.actors.join(', '),
          selectClass: 'jr-select-task', deleteClass: 'jr-delete-task',
          dataElementId: t.id, dataLine: t.line, mono: true,
        });
      }
      if (!tasksList) tasksList = P.emptyListHtml('（タスクなし）');

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Journey</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">Title 設定</label>' +
          P.fieldHtml('Title', 'jr-title', parsedData.meta.title || '') +
          P.primaryButtonHtml('jr-set-title-btn', 'Title 適用') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">セクションを追加</label>' +
          P.fieldHtml('Name', 'jr-add-sec-name', '') +
          P.primaryButtonHtml('jr-add-sec-btn', '+ セクション追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">タスクを追加</label>' +
          P.selectFieldHtml('Section', 'jr-add-t-section', secOpts) +
          P.fieldHtml('Text', 'jr-add-t-text', '', '例: Check email') +
          P.fieldHtml('Score (-5〜5)', 'jr-add-t-score', '3') +
          P.fieldHtml('Actors (カンマ区切り)', 'jr-add-t-actors', '', '例: Me, Pet') +
          P.primaryButtonHtml('jr-add-t-btn', '+ タスク追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">セクション一覧</label>' +
          '<div>' + sectionsList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">タスク一覧</label>' +
          '<div>' + tasksList + '</div>' +
        '</div>';

      P.bindEvent('jr-set-title-btn', 'click', function() {
        window.MA.history.pushHistory();
        ctx.setMmdText(setTitle(ctx.getMmdText(), document.getElementById('jr-title').value.trim()));
        ctx.onUpdate();
      });
      P.bindEvent('jr-add-sec-btn', 'click', function() {
        var n = document.getElementById('jr-add-sec-name').value.trim();
        if (!n) { alert('Name は必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addSection(ctx.getMmdText(), n));
        ctx.onUpdate();
      });
      P.bindEvent('jr-add-t-btn', 'click', function() {
        var sec = document.getElementById('jr-add-t-section').value;
        var txt = document.getElementById('jr-add-t-text').value.trim();
        var sc = document.getElementById('jr-add-t-score').value.trim();
        var act = document.getElementById('jr-add-t-actors').value.trim();
        if (!sec || !txt || !sc || !act) { alert('全項目が必要です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addTask(ctx.getMmdText(), sec, txt, sc, act));
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'jr-select-section', 'section');
      P.bindSelectButtons(propsEl, 'jr-select-task', 'task');
      P.bindDeleteButtons(propsEl, 'jr-delete-section', ctx, deleteElement);
      P.bindDeleteButtons(propsEl, 'jr-delete-task', ctx, deleteElement);
      return;
    }

    if (selData.length === 1) {
      var sel = selData[0];
      if (sel.type === 'section') {
        var sec = null;
        for (var sj = 0; sj < sections.length; sj++) if (sections[sj].id === sel.id) { sec = sections[sj]; break; }
        if (!sec) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">セクションが見つかりません</p>'; return; }
        propsEl.innerHTML =
          P.panelHeaderHtml(sec.label) +
          P.fieldHtml('Name', 'jr-edit-sec-name', sec.label) +
          P.dangerButtonHtml('jr-edit-sec-delete', 'セクション削除');
        var secLine = sec.line;
        document.getElementById('jr-edit-sec-name').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateSection(ctx.getMmdText(), secLine, this.value));
          ctx.onUpdate();
        });
        P.bindEvent('jr-edit-sec-delete', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteElement(ctx.getMmdText(), secLine));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        });
        return;
      }
      if (sel.type === 'task') {
        var t = null;
        for (var tj = 0; tj < tasks.length; tj++) if (tasks[tj].id === sel.id) { t = tasks[tj]; break; }
        if (!t) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">タスクが見つかりません</p>'; return; }
        propsEl.innerHTML =
          P.panelHeaderHtml(t.text) +
          '<div style="margin-bottom:8px;color:var(--text-secondary);font-size:11px;">セクション: ' + escHtml(t.parentId || '?') + '</div>' +
          P.fieldHtml('Text', 'jr-edit-t-text', t.text) +
          P.fieldHtml('Score', 'jr-edit-t-score', String(t.score)) +
          P.fieldHtml('Actors (カンマ区切り)', 'jr-edit-t-actors', t.actors.join(', ')) +
          P.dangerButtonHtml('jr-edit-t-delete', 'タスク削除');
        var tLine = t.line;
        document.getElementById('jr-edit-t-text').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateTask(ctx.getMmdText(), tLine, 'text', this.value));
          ctx.onUpdate();
        });
        document.getElementById('jr-edit-t-score').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateTask(ctx.getMmdText(), tLine, 'score', this.value));
          ctx.onUpdate();
        });
        document.getElementById('jr-edit-t-actors').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateTask(ctx.getMmdText(), tLine, 'actors', this.value));
          ctx.onUpdate();
        });
        P.bindEvent('jr-edit-t-delete', 'click', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(deleteElement(ctx.getMmdText(), tLine));
          window.MA.selection.clearSelection();
          ctx.onUpdate();
        });
        return;
      }
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'journey',
    displayName: 'Journey',
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'journey'; },
    parse: parseJourney,
    parseJourney: parseJourney,
    template: function() {
      return [
        'journey',
        '    title 一日の作業',
        '    section 午前',
        '      起床: 3: 私',
        '      朝食: 5: 私, 家族',
        '    section 午後',
        '      会議: 2: 私, 同僚',
        '      実装: 4: 私',
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
        if (kind === 'section') return addSection(text, props.name);
        if (kind === 'task') return addTask(text, props.section, props.text, props.score, props.actors);
        return text;
      },
      delete: function(text, lineNum) { return deleteElement(text, lineNum); },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        if (field === 'title') return setTitle(text, value);
        if (opts.kind === 'section') return updateSection(text, lineNum, value);
        return updateTask(text, lineNum, field, value);
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
    setTitle: setTitle, addSection: addSection, addTask: addTask,
    deleteElement: deleteElement, updateSection: updateSection, updateTask: updateTask,
  };
})();
