'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils)
  || (global.window && global.window.MA && global.window.MA.parserUtils);
var mm = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.mindmap)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.mindmap);

describe('detectDiagramType — mindmap', function() {
  test('detects mindmap keyword', function() {
    expect(parserUtils.detectDiagramType('mindmap\n')).toBe('mindmap');
  });
});

describe('parseMindmap — basic hierarchy', function() {
  test('parses root and children', function() {
    var r = mm.parseMindmap('mindmap\n  root((Central))\n    Child1\n    Child2\n');
    expect(r.elements.length).toBe(3);
    expect(r.elements[0].parentId).toBeNull();
    expect(r.elements[1].parentId).toBe(r.elements[0].id);
    expect(r.elements[2].parentId).toBe(r.elements[0].id);
  });

  test('parses deep nesting', function() {
    var r = mm.parseMindmap('mindmap\n  root\n    A\n      B\n        C\n');
    expect(r.elements.length).toBe(4);
    expect(r.elements[3].parentId).toBe(r.elements[2].id);
    expect(r.elements[3].level).toBe(4);
  });
});

describe('parseMindmap — shapes', function() {
  test('parses circle', function() {
    var r = mm.parseMindmap('mindmap\n  X((Circle))\n');
    expect(r.elements[0].shape).toBe('circle');
    expect(r.elements[0].text).toBe('Circle');
  });
  test('parses square', function() {
    var r = mm.parseMindmap('mindmap\n  X[Square]\n');
    expect(r.elements[0].shape).toBe('square');
    expect(r.elements[0].text).toBe('Square');
  });
  test('parses rounded', function() {
    var r = mm.parseMindmap('mindmap\n  X(Round)\n');
    expect(r.elements[0].shape).toBe('rounded');
    expect(r.elements[0].text).toBe('Round');
  });
  test('parses hexagon', function() {
    var r = mm.parseMindmap('mindmap\n  X{{Hex}}\n');
    expect(r.elements[0].shape).toBe('hexagon');
    expect(r.elements[0].text).toBe('Hex');
  });
  test('parses default (plain text)', function() {
    var r = mm.parseMindmap('mindmap\n  Plain Text\n');
    expect(r.elements[0].shape).toBe('default');
    expect(r.elements[0].text).toBe('Plain Text');
  });
});

describe('parseMindmap — icon and class', function() {
  test('attaches icon to preceding node', function() {
    var r = mm.parseMindmap('mindmap\n  Alpha\n    ::icon(fa fa-book)\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].icon).toBe('fa fa-book');
  });
  test('attaches class to preceding node', function() {
    var r = mm.parseMindmap('mindmap\n  Alpha\n    :::highlight\n');
    expect(r.elements[0].className).toBe('highlight');
  });
});
