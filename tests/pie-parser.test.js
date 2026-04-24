'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils)
  || (global.window && global.window.MA && global.window.MA.parserUtils);
var pie = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.pie)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.pie);

describe('detectDiagramType — pie', function() {
  test('detects pie', function() {
    expect(parserUtils.detectDiagramType('pie\n')).toBe('pie');
  });
  test('detects pie with title', function() {
    expect(parserUtils.detectDiagramType('pie title X\n')).toBe('pie');
  });
});

describe('parsePie', function() {
  test('parses slices', function() {
    var r = pie.parsePie('pie title Test\n    "A" : 10\n    "B" : 20\n');
    expect(r.meta.title).toBe('Test');
    expect(r.elements.length).toBe(2);
    expect(r.elements[0].label).toBe('A');
    expect(r.elements[0].value).toBe(10);
  });
  test('parses showData', function() {
    var r = pie.parsePie('pie showData title X\n');
    expect(r.meta.showData).toBe(true);
    expect(r.meta.title).toBe('X');
  });
  test('parses decimal value', function() {
    var r = pie.parsePie('pie\n    "X" : 3.14\n');
    expect(r.elements[0].value).toBe(3.14);
  });
});
