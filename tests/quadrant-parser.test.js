'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils) || (global.window && global.window.MA && global.window.MA.parserUtils);
var qd = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.quadrantChart) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.quadrantChart);

describe('detectDiagramType — quadrantChart', function() {
  test('detects quadrantChart', function() { expect(parserUtils.detectDiagramType('quadrantChart\n')).toBe('quadrantChart'); });
});

describe('parseQuadrant', function() {
  test('parses title + axes', function() {
    var r = qd.parseQuadrant('quadrantChart\n    title T\n    x-axis L --> R\n    y-axis B --> Top\n');
    expect(r.meta.title).toBe('T');
    expect(r.meta.xAxisLeft).toBe('L'); expect(r.meta.xAxisRight).toBe('R');
    expect(r.meta.yAxisBottom).toBe('B'); expect(r.meta.yAxisTop).toBe('Top');
  });
  test('parses 4 quadrant labels', function() {
    var r = qd.parseQuadrant('quadrantChart\n    quadrant-1 A\n    quadrant-2 B\n    quadrant-3 C\n    quadrant-4 D\n');
    expect(r.meta.q1).toBe('A'); expect(r.meta.q2).toBe('B'); expect(r.meta.q3).toBe('C'); expect(r.meta.q4).toBe('D');
  });
  test('parses data point', function() {
    var r = qd.parseQuadrant('quadrantChart\n    MyPoint: [0.3, 0.6]\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].label).toBe('MyPoint');
    expect(r.elements[0].x).toBe(0.3);
    expect(r.elements[0].y).toBe(0.6);
  });
});
