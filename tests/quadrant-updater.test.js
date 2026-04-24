'use strict';
var qd = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.quadrantChart) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.quadrantChart);

describe('setTitle', function() {
  test('inserts title after header', function() { expect(qd.setTitle('quadrantChart\n', 'New')).toContain('title New'); });
  test('replaces existing', function() { expect(qd.setTitle('quadrantChart\n    title Old\n', 'X')).toContain('title X'); });
});
describe('setXAxis / setYAxis', function() {
  test('sets x-axis', function() { expect(qd.setXAxis('quadrantChart\n', 'L', 'R')).toContain('x-axis L --> R'); });
  test('sets y-axis', function() { expect(qd.setYAxis('quadrantChart\n', 'B', 'T')).toContain('y-axis B --> T'); });
});
describe('setQuadrantLabel', function() {
  test('sets quadrant 1', function() { expect(qd.setQuadrantLabel('quadrantChart\n', '1', 'Expand')).toContain('quadrant-1 Expand'); });
});
describe('addPoint', function() {
  test('adds point with coords', function() { expect(qd.addPoint('quadrantChart\n', 'Alpha', '0.3', '0.7')).toContain('Alpha: [0.3, 0.7]'); });
});
describe('updatePoint', function() {
  test('updates x', function() {
    var t = 'quadrantChart\n    Foo: [0.2, 0.5]\n';
    var p = qd.parseQuadrant(t);
    var out = qd.updatePoint(t, p.elements[0].line, 'x', '0.9');
    expect(out).toContain('Foo: [0.9, 0.5]');
  });
  test('updates label', function() {
    var t = 'quadrantChart\n    Old: [0.5, 0.5]\n';
    var p = qd.parseQuadrant(t);
    var out = qd.updatePoint(t, p.elements[0].line, 'label', 'New');
    expect(out).toContain('New: [0.5, 0.5]');
  });
});
