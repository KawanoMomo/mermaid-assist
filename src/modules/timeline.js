'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.timeline = (function() {
  var TITLE_RE = /^title\s+(.+)$/;
  var SECTION_RE = /^section\s+(.+)$/;
  var PERIOD_RE = /^(.+?)\s*:\s*(.+)$/;  // period : events...

  function parseTimeline(text) {
    var result = { meta: { title: '' }, elements: [], relations: [] };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var periodCounter = 0;
    var currentSection = null;

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^timeline/.test(trimmed)) continue;

      var tm = trimmed.match(TITLE_RE);
      if (tm) { result.meta.title = tm[1].trim(); continue; }

      var sm = trimmed.match(SECTION_RE);
      if (sm) {
        currentSection = sm[1].trim();
        result.elements.push({ kind: 'section', id: currentSection, label: currentSection, line: lineNum });
        continue;
      }

      var pm = trimmed.match(PERIOD_RE);
      if (pm) {
        var period = pm[1].trim();
        var eventsPart = pm[2];
        var events = eventsPart.split(/\s*:\s*/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
        result.elements.push({
          kind: 'period', id: '__p_' + (periodCounter++),
          period: period, events: events,
          parentId: currentSection, line: lineNum,
        });
      }
    }
    return result;
  }

  // ── Updaters ──
  function setTitle(text, newTitle) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (TITLE_RE.test(lines[i].trim())) {
        var indent = lines[i].match(/^(\s*)/)[1];
        lines[i] = indent + 'title ' + newTitle;
        return lines.join('\n');
      }
    }
    // Insert after timeline header
    for (var j = 0; j < lines.length; j++) {
      if (/^timeline/.test(lines[j].trim())) {
        lines.splice(j + 1, 0, '    title ' + newTitle);
        return lines.join('\n');
      }
    }
    lines.unshift('    title ' + newTitle);
    return lines.join('\n');
  }

  function addSection(text, name) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, '    section ' + name);
    return lines.join('\n');
  }

  function addPeriod(text, sectionName, periodText, firstEvent) {
    var lines = text.split('\n');
    // Find target section block
    var secIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      var tm = lines[i].trim().match(/^section\s+(.+)$/);
      if (tm && tm[1].trim() === sectionName) { secIdx = i; break; }
    }
    if (secIdx < 0) return text;
    // Find end of section (next section or end of file)
    var insertAt = lines.length;
    for (var j = secIdx + 1; j < lines.length; j++) {
      if (/^\s*section\s+/.test(lines[j])) { insertAt = j; break; }
    }
    while (insertAt > secIdx + 1 && lines[insertAt - 1].trim() === '') insertAt--;
    var newLine = '      ' + periodText + ' : ' + (firstEvent || '');
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }

  function addEventToPeriod(text, lineNum, eventText) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var line = lines[idx];
    var trimmed = line.trim();
    if (!/:/.test(trimmed)) return text;
    lines[idx] = line.replace(/\s*$/, '') + ' : ' + eventText;
    return lines.join('\n');
  }

  function _isPeriodLine(trimmed) {
    if (!trimmed) return false;
    if (trimmed.indexOf('%%') === 0) return false;
    if (/^(timeline|title\s|section\s)/i.test(trimmed)) return false;
    return /:/.test(trimmed);
  }

  function _movePeriodStep(text, lineNum, direction) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var target = idx + direction;
    while (target >= 0 && target < lines.length) {
      var t = lines[target].trim();
      if (!t || t.indexOf('%%') === 0) { target += direction; continue; }
      if (_isPeriodLine(t)) {
        var tmp = lines[idx];
        lines[idx] = lines[target];
        lines[target] = tmp;
        return lines.join('\n');
      }
      return text;
    }
    return text;
  }

  function movePeriodUp(text, lineNum) { return _movePeriodStep(text, lineNum, -1); }
  function movePeriodDown(text, lineNum) { return _movePeriodStep(text, lineNum, 1); }

  function deleteElement(text, lineNum) {
    // For section: delete the section line + all its periods until next section
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
    // period or title line: delete single line
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

  function updatePeriod(text, lineNum, field, value, eventIndex) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var trimmed = lines[idx].trim();
    var m = trimmed.match(/^(.+?)\s*:\s*(.+)$/);
    if (!m) return text;
    var period = m[1].trim();
    var events = m[2].split(/\s*:\s*/).map(function(s) { return s.trim(); });

    if (field === 'period') {
      period = value;
    } else if (field === 'event' && typeof eventIndex === 'number') {
      events[eventIndex] = value;
    }

    lines[idx] = indent + period + ' : ' + events.join(' : ');
    return lines.join('\n');
  }

  function deleteEvent(text, lineNum, eventIndex) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var trimmed = lines[idx].trim();
    var m = trimmed.match(/^(.+?)\s*:\s*(.+)$/);
    if (!m) return text;
    var period = m[1].trim();
    var events = m[2].split(/\s*:\s*/).map(function(s) { return s.trim(); });
    if (eventIndex < 0 || eventIndex >= events.length) return text;
    events.splice(eventIndex, 1);
    if (events.length === 0) {
      // Delete whole line (no events left)
      lines.splice(idx, 1);
    } else {
      lines[idx] = indent + period + ' : ' + events.join(' : ');
    }
    return lines.join('\n');
  }

  // ── UI ──
  function renderProps(selData, parsedData, propsEl, ctx) {
    if (!propsEl) return;
    var escHtml = window.MA.htmlUtils.escHtml;
    var P = window.MA.properties;
    var sections = parsedData.elements.filter(function(e) { return e.kind === 'section'; });
    var periods = parsedData.elements.filter(function(e) { return e.kind === 'period'; });

    if (!selData || selData.length === 0) {
      var secOpts = sections.map(function(s) { return { value: s.id, label: s.id }; });
      if (secOpts.length === 0) secOpts = [{ value: '', label: '（セクションを先に追加）' }];

      var periodOpts = periods.map(function(p) { return { value: String(p.line), label: (p.parentId || 'top') + ': ' + p.period }; });
      if (periodOpts.length === 0) periodOpts = [{ value: '', label: '（ピリオドを先に追加）' }];

      var sectionsList = '';
      for (var si = 0; si < sections.length; si++) {
        var s = sections[si];
        var childCount = periods.filter(function(p) { return p.parentId === s.id; }).length;
        sectionsList += P.listItemHtml({
          label: s.label, sublabel: '(' + childCount + ' periods)',
          selectClass: 'tl-select-section', deleteClass: 'tl-delete-section',
          dataElementId: s.id, dataLine: s.line,
        });
      }
      if (!sectionsList) sectionsList = P.emptyListHtml('（セクションなし）');

      var periodsList = '';
      for (var pi = 0; pi < periods.length; pi++) {
        var p = periods[pi];
        periodsList += P.listItemHtml({
          label: p.period + ': ' + p.events.join(' / '),
          sublabel: '(' + (p.parentId || 'top') + ')',
          selectClass: 'tl-select-period', deleteClass: 'tl-delete-period',
          dataElementId: p.id, dataLine: p.line, mono: true,
        });
      }
      if (!periodsList) periodsList = P.emptyListHtml('（ピリオドなし）');

      var currentTitle = parsedData.meta && parsedData.meta.title ? parsedData.meta.title : '';

      propsEl.innerHTML =
        '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Timeline</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">Title 設定</label>' +
          P.fieldHtml('Title', 'tl-title', currentTitle) +
          P.primaryButtonHtml('tl-set-title-btn', 'Title 適用') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">セクションを追加</label>' +
          P.fieldHtml('Name', 'tl-add-sec-name', '') +
          P.primaryButtonHtml('tl-add-sec-btn', '+ セクション追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">ピリオドを追加</label>' +
          P.selectFieldHtml('Section', 'tl-add-p-section', secOpts) +
          P.fieldHtml('Period', 'tl-add-p-period', '', '例: 2026-04-01') +
          P.fieldHtml('Event', 'tl-add-p-event', '', '初期イベント') +
          P.primaryButtonHtml('tl-add-p-btn', '+ ピリオド追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">イベントを既存ピリオドに追加</label>' +
          P.selectFieldHtml('Period', 'tl-add-ev-period', periodOpts) +
          P.fieldHtml('Event', 'tl-add-ev-text', '') +
          P.primaryButtonHtml('tl-add-ev-btn', '+ イベント追加') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">セクション一覧</label>' +
          '<div>' + sectionsList + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">ピリオド一覧</label>' +
          '<div>' + periodsList + '</div>' +
        '</div>';

      P.bindEvent('tl-set-title-btn', 'click', function() {
        var v = document.getElementById('tl-title').value.trim();
        window.MA.history.pushHistory();
        ctx.setMmdText(setTitle(ctx.getMmdText(), v));
        ctx.onUpdate();
      });
      P.bindEvent('tl-add-sec-btn', 'click', function() {
        var n = document.getElementById('tl-add-sec-name').value.trim();
        if (!n) { alert('Name は必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addSection(ctx.getMmdText(), n));
        ctx.onUpdate();
      });
      P.bindEvent('tl-add-p-btn', 'click', function() {
        var sec = document.getElementById('tl-add-p-section').value;
        var period = document.getElementById('tl-add-p-period').value.trim();
        var event = document.getElementById('tl-add-p-event').value.trim();
        if (!sec || !period) { alert('Section と Period は必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addPeriod(ctx.getMmdText(), sec, period, event));
        ctx.onUpdate();
      });
      P.bindEvent('tl-add-ev-btn', 'click', function() {
        var pl = document.getElementById('tl-add-ev-period').value;
        var ev = document.getElementById('tl-add-ev-text').value.trim();
        if (!pl || !ev) { alert('Period と Event は必須です'); return; }
        window.MA.history.pushHistory();
        ctx.setMmdText(addEventToPeriod(ctx.getMmdText(), parseInt(pl, 10), ev));
        ctx.onUpdate();
      });

      P.bindSelectButtons(propsEl, 'tl-select-section', 'section');
      P.bindSelectButtons(propsEl, 'tl-select-period', 'period');
      P.bindDeleteButtons(propsEl, 'tl-delete-section', ctx, deleteElement);
      P.bindDeleteButtons(propsEl, 'tl-delete-period', ctx, deleteElement);
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
          P.fieldHtml('Name', 'tl-edit-sec-name', sec.label) +
          P.actionBarHtml('tl-edit-sec', {
            insertBefore: false, insertAfter: false,
            move: false, delete: true,
            labels: { delete: 'セクション削除' },
          });

        var secLine = sec.line;
        document.getElementById('tl-edit-sec-name').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updateSection(ctx.getMmdText(), secLine, this.value));
          ctx.onUpdate();
        });
        P.bindActionBar('tl-edit-sec', {
          'delete': function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(deleteElement(ctx.getMmdText(), secLine));
            window.MA.selection.clearSelection();
            ctx.onUpdate();
          },
        });
        return;
      }

      if (sel.type === 'period') {
        var per = null;
        for (var pj = 0; pj < periods.length; pj++) if (periods[pj].id === sel.id) { per = periods[pj]; break; }
        if (!per) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">ピリオドが見つかりません</p>'; return; }

        var eventsHtml = '';
        for (var ei = 0; ei < per.events.length; ei++) {
          eventsHtml += '<div style="display:flex;gap:4px;margin-bottom:4px;">' +
            '<input id="tl-edit-ev-' + ei + '" type="text" value="' + escHtml(per.events[ei]) + '" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:11px;">' +
            '<button class="tl-edit-ev-delete" data-event-index="' + ei + '" style="background:var(--danger);color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;">×</button>' +
            '</div>';
        }

        propsEl.innerHTML =
          P.panelHeaderHtml(per.period) +
          '<div style="margin-bottom:8px;color:var(--text-secondary);font-size:11px;">セクション: ' + escHtml(per.parentId || 'top') + '</div>' +
          P.fieldHtml('Period', 'tl-edit-p-period', per.period) +
          '<div style="margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">Events</label>' +
            eventsHtml +
          '</div>' +
          P.actionBarHtml('tl-edit-p', {
            insertBefore: false, insertAfter: false,
            move: true, delete: true,
            labels: { delete: 'ピリオド削除' },
          });

        var perLine = per.line;
        document.getElementById('tl-edit-p-period').addEventListener('change', function() {
          window.MA.history.pushHistory();
          ctx.setMmdText(updatePeriod(ctx.getMmdText(), perLine, 'period', this.value));
          ctx.onUpdate();
        });
        for (var ek = 0; ek < per.events.length; ek++) {
          (function(idx) {
            var inputEl = document.getElementById('tl-edit-ev-' + idx);
            if (inputEl) {
              inputEl.addEventListener('change', function() {
                window.MA.history.pushHistory();
                ctx.setMmdText(updatePeriod(ctx.getMmdText(), perLine, 'event', this.value, idx));
                ctx.onUpdate();
              });
            }
          })(ek);
        }
        var delBtns = propsEl.querySelectorAll('.tl-edit-ev-delete');
        for (var db = 0; db < delBtns.length; db++) {
          delBtns[db].addEventListener('click', function() {
            var idx = parseInt(this.getAttribute('data-event-index'), 10);
            window.MA.history.pushHistory();
            ctx.setMmdText(deleteEvent(ctx.getMmdText(), perLine, idx));
            ctx.onUpdate();
          });
        }
        P.bindActionBar('tl-edit-p', {
          up: function() {
            var newText = movePeriodUp(ctx.getMmdText(), perLine);
            if (newText === ctx.getMmdText()) return;
            window.MA.history.pushHistory();
            ctx.setMmdText(newText);
            window.MA.selection.setSelected([{ type: 'period', id: per.id }]);
            ctx.onUpdate();
          },
          down: function() {
            var newText = movePeriodDown(ctx.getMmdText(), perLine);
            if (newText === ctx.getMmdText()) return;
            window.MA.history.pushHistory();
            ctx.setMmdText(newText);
            window.MA.selection.setSelected([{ type: 'period', id: per.id }]);
            ctx.onUpdate();
          },
          'delete': function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(deleteElement(ctx.getMmdText(), perLine));
            window.MA.selection.clearSelection();
            ctx.onUpdate();
          },
        });
        return;
      }
    }

    propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
  }

  return {
    type: 'timeline',
    displayName: 'Timeline',
    detect: function(text) { return window.MA.parserUtils.detectDiagramType(text) === 'timeline'; },
    parse: parseTimeline,
    parseTimeline: parseTimeline,
    template: function() {
      return [
        'timeline',
        '    title プロジェクト計画',
        '    section Q1',
        '      2026-01 : キックオフ',
        '      2026-02 : 要件定義',
        '    section Q2',
        '      2026-04 : 設計',
        '      2026-05 : 実装',
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
        if (kind === 'period') return addPeriod(text, props.section, props.period, props.event);
        if (kind === 'event') return addEventToPeriod(text, props.line, props.event);
        return text;
      },
      delete: function(text, lineNum) { return deleteElement(text, lineNum); },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        if (opts.kind === 'section') return updateSection(text, lineNum, value);
        if (opts.kind === 'period') return updatePeriod(text, lineNum, field, value, opts.eventIndex);
        if (field === 'title') return setTitle(text, value);
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
    setTitle: setTitle, addSection: addSection, addPeriod: addPeriod, addEventToPeriod: addEventToPeriod,
    deleteElement: deleteElement, updateSection: updateSection, updatePeriod: updatePeriod, deleteEvent: deleteEvent,
    movePeriodUp: movePeriodUp,
    movePeriodDown: movePeriodDown,
  };
})();
