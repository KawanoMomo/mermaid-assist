'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils) || (global.window && global.window.MA && global.window.MA.parserUtils);
var rd = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.radarBeta) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.radarBeta);

describe('detectDiagramType — radar-beta', function() {
  test('detects radar-beta', function() { expect(parserUtils.detectDiagramType('radar-beta\n')).toBe('radar-beta'); });
});

describe('parseRadar', function() {
  test('parses title', function() {
    var r = rd.parseRadar('radar-beta\n    title "Skills"\n');
    expect(r.meta.title).toBe('Skills');
  });
  test('parses min/max', function() {
    var r = rd.parseRadar('radar-beta\n    min 0\n    max 10\n');
    expect(r.meta.min).toBe(0);
    expect(r.meta.max).toBe(10);
  });
  test('parses axes', function() {
    var r = rd.parseRadar('radar-beta\n    axis a["A"], b["B"], c["C"]\n');
    expect(r.meta.axes.length).toBe(3);
    expect(r.meta.axes[0].id).toBe('a');
    expect(r.meta.axes[0].label).toBe('A');
  });
  test('parses curve', function() {
    var r = rd.parseRadar('radar-beta\n    curve x["X"]{1, 2, 3}\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].id).toBe('x');
    expect(r.elements[0].label).toBe('X');
    expect(r.elements[0].values).toEqual([1, 2, 3]);
  });
});
