'use strict';
var sk = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.sankeyBeta) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.sankeyBeta);

describe('addFlow', function() {
  test('adds CSV line', function() { expect(sk.addFlow('sankey-beta\n', 'A', 'B', '10')).toContain('A,B,10'); });
  test('quotes source with comma', function() {
    var out = sk.addFlow('sankey-beta\n', 'A,B', 'X', '5');
    expect(out).toContain("'AB',X,5");  // strip inner quotes/commas
  });
});

describe('updateFlow', function() {
  test('updates value', function() {
    var t = 'sankey-beta\n\nA,B,10\n';
    var p = sk.parseSankey(t);
    var out = sk.updateFlow(t, p.relations[0].line, 'value', '99');
    expect(out).toContain('A,B,99');
  });
  test('updates source', function() {
    var t = 'sankey-beta\n\nA,B,10\n';
    var p = sk.parseSankey(t);
    var out = sk.updateFlow(t, p.relations[0].line, 'from', 'X');
    expect(out).toContain('X,B,10');
  });
});

describe('parseCsvLine', function() {
  test('handles single-quoted field', function() {
    var fields = sk.parseCsvLine("'a b',c,10");
    expect(fields[0]).toBe('a b');
    expect(fields[1]).toBe('c');
    expect(fields[2]).toBe('10');
  });
});
