'use strict';
var tl = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.timeline)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.timeline);

describe('setTitle', function() {
  test('sets title when none', function() {
    var out = tl.setTitle('timeline\n', 'New Title');
    expect(out).toContain('title New Title');
  });
  test('replaces existing title', function() {
    var out = tl.setTitle('timeline\n    title Old\n', 'New');
    expect(out).toContain('title New');
    expect(out).not.toContain('title Old');
  });
});

describe('addSection', function() {
  test('appends section', function() {
    var out = tl.addSection('timeline\n', 'Q3');
    expect(out).toContain('section Q3');
  });
});

describe('addPeriod', function() {
  test('inserts period under section', function() {
    var t = 'timeline\n    section A\n';
    var out = tl.addPeriod(t, 'A', '2026-01', 'init');
    expect(out).toContain('2026-01 : init');
  });
  test('inserts at end of correct section when multiple exist', function() {
    var t = 'timeline\n    section A\n      2026-01 : a\n    section B\n      2026-02 : b\n';
    var out = tl.addPeriod(t, 'A', '2026-01b', 'extra');
    var aIdx = out.indexOf('2026-01b');
    var bIdx = out.indexOf('section B');
    expect(aIdx).toBeLessThan(bIdx);
  });
});

describe('addEventToPeriod', function() {
  test('appends event to existing period line', function() {
    var t = 'timeline\n    section A\n      2026-01 : alpha\n';
    var parsed = tl.parseTimeline(t);
    var per = parsed.elements.filter(function(e) { return e.kind === 'period'; })[0];
    var out = tl.addEventToPeriod(t, per.line, 'beta');
    expect(out).toContain('2026-01 : alpha : beta');
  });
});

describe('deleteElement', function() {
  test('deletes section with its periods', function() {
    var t = 'timeline\n    section A\n      2026-01 : a\n      2026-02 : b\n    section B\n      2026-03 : c\n';
    var parsed = tl.parseTimeline(t);
    var sec = parsed.elements.filter(function(e) { return e.kind === 'section' && e.id === 'A'; })[0];
    var out = tl.deleteElement(t, sec.line);
    expect(out).not.toContain('section A');
    expect(out).not.toContain('2026-01');
    expect(out).toContain('section B');
    expect(out).toContain('2026-03');
  });
});

describe('updatePeriod', function() {
  test('updates period text', function() {
    var t = 'timeline\n    section A\n      2026-01 : alpha\n';
    var parsed = tl.parseTimeline(t);
    var per = parsed.elements.filter(function(e) { return e.kind === 'period'; })[0];
    var out = tl.updatePeriod(t, per.line, 'period', '2026-02');
    expect(out).toContain('2026-02 : alpha');
  });
  test('updates specific event by index', function() {
    var t = 'timeline\n    section A\n      2026-01 : alpha : beta\n';
    var parsed = tl.parseTimeline(t);
    var per = parsed.elements.filter(function(e) { return e.kind === 'period'; })[0];
    var out = tl.updatePeriod(t, per.line, 'event', 'BETA2', 1);
    expect(out).toContain('2026-01 : alpha : BETA2');
  });
});

describe('deleteEvent', function() {
  test('removes event from middle of period', function() {
    var t = 'timeline\n    section A\n      2026-01 : alpha : beta : gamma\n';
    var parsed = tl.parseTimeline(t);
    var per = parsed.elements.filter(function(e) { return e.kind === 'period'; })[0];
    var out = tl.deleteEvent(t, per.line, 1);
    expect(out).toContain('2026-01 : alpha : gamma');
    expect(out).not.toContain('beta');
  });
  test('removes whole line when last event removed', function() {
    var t = 'timeline\n    section A\n      2026-01 : alpha\n';
    var parsed = tl.parseTimeline(t);
    var per = parsed.elements.filter(function(e) { return e.kind === 'period'; })[0];
    var out = tl.deleteEvent(t, per.line, 0);
    expect(out).not.toContain('2026-01');
  });
});
