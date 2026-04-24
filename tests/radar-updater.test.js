'use strict';
var rd = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.radarBeta) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.radarBeta);

describe('setTitle / setMin / setMax', function() {
  test('sets title', function() { expect(rd.setTitle('radar-beta\n', 'X')).toContain('title "X"'); });
  test('sets min', function() { expect(rd.setMin('radar-beta\n', '0')).toContain('min 0'); });
  test('sets max', function() { expect(rd.setMax('radar-beta\n', '10')).toContain('max 10'); });
});
describe('setAxes', function() {
  test('sets axis list', function() {
    var axes = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
    expect(rd.setAxes('radar-beta\n', axes)).toContain('axis a["A"], b["B"]');
  });
});
describe('addCurve', function() {
  test('adds curve', function() { expect(rd.addCurve('radar-beta\n', 'x', 'X', '1, 2, 3')).toContain('curve x["X"]{1, 2, 3}'); });
});
describe('updateCurve', function() {
  test('updates values', function() {
    var t = 'radar-beta\n    curve x["X"]{1, 2}\n';
    var p = rd.parseRadar(t);
    var out = rd.updateCurve(t, p.elements[0].line, 'values', '5, 6');
    expect(out).toContain('curve x["X"]{5, 6}');
  });
});
