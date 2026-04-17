'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils)
  || (global.window && global.window.MA && global.window.MA.parserUtils);

var tl = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.timeline)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.timeline);

describe('detectDiagramType — timeline', function() {
  test('detects timeline keyword', function() {
    expect(parserUtils.detectDiagramType('timeline\n')).toBe('timeline');
  });
});

describe('parseTimeline', function() {
  test('parses title', function() {
    var r = tl.parseTimeline('timeline\n    title My Plan\n');
    expect(r.meta.title).toBe('My Plan');
  });

  test('parses section', function() {
    var r = tl.parseTimeline('timeline\n    section Q1\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].kind).toBe('section');
    expect(r.elements[0].id).toBe('Q1');
  });

  test('parses period with single event', function() {
    var r = tl.parseTimeline('timeline\n    section A\n      2026-01 : alpha\n');
    var periods = r.elements.filter(function(e) { return e.kind === 'period'; });
    expect(periods.length).toBe(1);
    expect(periods[0].period).toBe('2026-01');
    expect(periods[0].events.length).toBe(1);
    expect(periods[0].events[0]).toBe('alpha');
    expect(periods[0].parentId).toBe('A');
  });

  test('parses period with multiple events', function() {
    var r = tl.parseTimeline('timeline\n    section A\n      2026-02 : beta : gamma\n');
    var periods = r.elements.filter(function(e) { return e.kind === 'period'; });
    expect(periods[0].events.length).toBe(2);
    expect(periods[0].events[0]).toBe('beta');
    expect(periods[0].events[1]).toBe('gamma');
  });

  test('parses two sections', function() {
    var r = tl.parseTimeline('timeline\n    section A\n      2026-01 : a\n    section B\n      2026-02 : b\n');
    var secs = r.elements.filter(function(e) { return e.kind === 'section'; });
    expect(secs.length).toBe(2);
  });
});
