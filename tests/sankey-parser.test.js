'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils) || (global.window && global.window.MA && global.window.MA.parserUtils);
var sk = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.sankeyBeta) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.sankeyBeta);

describe('detectDiagramType — sankey-beta', function() {
  test('detects sankey-beta', function() { expect(parserUtils.detectDiagramType('sankey-beta\n')).toBe('sankey-beta'); });
});

describe('parseSankey', function() {
  test('parses flow lines', function() {
    var r = sk.parseSankey('sankey-beta\n\nA,B,10\nB,C,5\n');
    expect(r.relations.length).toBe(2);
    expect(r.relations[0].from).toBe('A');
    expect(r.relations[0].to).toBe('B');
    expect(r.relations[0].value).toBe(10);
  });
  test('auto-registers nodes', function() {
    var r = sk.parseSankey('sankey-beta\n\nA,B,1\nC,D,2\n');
    expect(r.elements.length).toBe(4);
  });
  test('parses quoted source with spaces', function() {
    var r = sk.parseSankey("sankey-beta\n\n'Source A',Target,100\n");
    expect(r.relations[0].from).toBe('Source A');
  });
  test('parses decimal values', function() {
    var r = sk.parseSankey('sankey-beta\n\nA,B,3.14\n');
    expect(r.relations[0].value).toBe(3.14);
  });
});
