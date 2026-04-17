'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils) || (global.window && global.window.MA && global.window.MA.parserUtils);
var xy = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.xychartBeta) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.xychartBeta);

describe('detectDiagramType — xychart-beta', function() {
  test('detects xychart-beta', function() { expect(parserUtils.detectDiagramType('xychart-beta\n')).toBe('xychart-beta'); });
});

describe('parseXY', function() {
  test('parses title', function() {
    var r = xy.parseXY('xychart-beta\n    title "My Chart"\n');
    expect(r.meta.title).toBe('My Chart');
  });
  test('parses horizontal', function() {
    var r = xy.parseXY('xychart-beta horizontal\n');
    expect(r.meta.horizontal).toBe(true);
  });
  test('parses x-axis categories', function() {
    var r = xy.parseXY('xychart-beta\n    x-axis [jan, feb, mar]\n');
    expect(r.meta.xAxisCategories.length).toBe(3);
    expect(r.meta.xAxisCategories[0]).toBe('jan');
  });
  test('parses y-axis range with label', function() {
    var r = xy.parseXY('xychart-beta\n    y-axis "Val" 0 --> 100\n');
    expect(r.meta.yAxisLabel).toBe('Val');
    expect(r.meta.yAxisMin).toBe(0);
    expect(r.meta.yAxisMax).toBe(100);
  });
  test('parses bar series', function() {
    var r = xy.parseXY('xychart-beta\n    bar [10, 20, 30]\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].kind).toBe('bar');
    expect(r.elements[0].values).toEqual([10, 20, 30]);
  });
  test('parses line series', function() {
    var r = xy.parseXY('xychart-beta\n    line [1.5, 2.5, 3.5]\n');
    expect(r.elements[0].kind).toBe('line');
    expect(r.elements[0].values).toEqual([1.5, 2.5, 3.5]);
  });
});
