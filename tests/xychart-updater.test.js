'use strict';
var xy = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.xychartBeta) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.xychartBeta);

describe('setTitle', function() {
  test('inserts title', function() { expect(xy.setTitle('xychart-beta\n', 'X')).toContain('title "X"'); });
});
describe('setHorizontal', function() {
  test('enables horizontal', function() { expect(xy.setHorizontal('xychart-beta\n', true)).toContain('xychart-beta horizontal'); });
  test('disables horizontal', function() { expect(xy.setHorizontal('xychart-beta horizontal\n', false)).not.toContain('horizontal'); });
});
describe('setXAxisCategories', function() {
  test('sets categories', function() { expect(xy.setXAxisCategories('xychart-beta\n', '', 'a, b, c')).toContain('x-axis [a, b, c]'); });
});
describe('setYAxis', function() {
  test('sets y-axis with label', function() { expect(xy.setYAxis('xychart-beta\n', 'Y', '0', '50')).toContain('y-axis "Y" 0 --> 50'); });
});
describe('addSeries', function() {
  test('adds bar', function() { expect(xy.addSeries('xychart-beta\n', 'bar', '10, 20, 30')).toContain('bar [10, 20, 30]'); });
  test('adds line', function() { expect(xy.addSeries('xychart-beta\n', 'line', '1, 2')).toContain('line [1, 2]'); });
});
describe('updateSeries', function() {
  test('updates values', function() {
    var t = 'xychart-beta\n    bar [10, 20]\n';
    var p = xy.parseXY(t);
    var out = xy.updateSeries(t, p.elements[0].line, 'values', '50, 60');
    expect(out).toContain('bar [50, 60]');
  });
  test('updates kind', function() {
    var t = 'xychart-beta\n    bar [10, 20]\n';
    var p = xy.parseXY(t);
    var out = xy.updateSeries(t, p.elements[0].line, 'kind', 'line');
    expect(out).toContain('line [10, 20]');
  });
});
