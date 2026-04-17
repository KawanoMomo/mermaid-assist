'use strict';
var mm = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.mindmap)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.mindmap);

describe('addChild', function() {
  test('adds child below parent at +2 indent', function() {
    var t = 'mindmap\n  root\n';
    var parsed = mm.parseMindmap(t);
    var out = mm.addChild(t, parsed.elements[0].line, 'NewChild', 'default');
    expect(out).toContain('    NewChild');
  });

  test('adds child with shape', function() {
    var t = 'mindmap\n  root\n';
    var parsed = mm.parseMindmap(t);
    var out = mm.addChild(t, parsed.elements[0].line, 'Shape Node', 'square');
    expect(out).toContain('    [Shape Node]');
  });
});

describe('addSibling', function() {
  test('adds sibling at same indent', function() {
    var t = 'mindmap\n  root\n    Child1\n';
    var parsed = mm.parseMindmap(t);
    var child = parsed.elements[1];
    var out = mm.addSibling(t, child.line, 'Sibling', 'default');
    expect(out).toContain('    Sibling');
  });
});

describe('indentNode / outdentNode', function() {
  test('indent adds 2 spaces', function() {
    var t = 'mindmap\n  root\n  SecondRoot\n';
    var parsed = mm.parseMindmap(t);
    var out = mm.indentNode(t, parsed.elements[1].line);
    expect(out).toContain('    SecondRoot');
  });

  test('indent also shifts subtree', function() {
    var t = 'mindmap\n  root\n    A\n      B\n';
    var parsed = mm.parseMindmap(t);
    var a = parsed.elements[1];
    var out = mm.indentNode(t, a.line);
    expect(out).toContain('      A');
    expect(out).toContain('        B');
  });

  test('outdent removes 2 spaces', function() {
    var t = 'mindmap\n  root\n    Child\n';
    var parsed = mm.parseMindmap(t);
    var child = parsed.elements[1];
    var out = mm.outdentNode(t, child.line);
    expect(out).toContain('  Child');
    expect(out).not.toContain('    Child');
  });
});

describe('updateNodeText', function() {
  test('updates text keeping default shape', function() {
    var t = 'mindmap\n  root\n    Old\n';
    var parsed = mm.parseMindmap(t);
    var out = mm.updateNodeText(t, parsed.elements[1].line, 'New', 'default');
    expect(out).toContain('New');
    expect(out).not.toContain('Old');
  });

  test('updates shape', function() {
    var t = 'mindmap\n  root\n    X\n';
    var parsed = mm.parseMindmap(t);
    var out = mm.updateNodeText(t, parsed.elements[1].line, 'X', 'square');
    expect(out).toContain('[X]');
  });
});

describe('setIcon', function() {
  test('adds icon after node', function() {
    var t = 'mindmap\n  root\n    Alpha\n';
    var parsed = mm.parseMindmap(t);
    var out = mm.setIcon(t, parsed.elements[1].line, 'fa fa-book');
    expect(out).toContain('::icon(fa fa-book)');
  });

  test('replaces existing icon', function() {
    var t = 'mindmap\n  root\n    Alpha\n      ::icon(fa fa-book)\n';
    var parsed = mm.parseMindmap(t);
    var out = mm.setIcon(t, parsed.elements[1].line, 'fa fa-star');
    expect(out).toContain('::icon(fa fa-star)');
    expect(out).not.toContain('fa fa-book');
  });

  test('removes icon when empty', function() {
    var t = 'mindmap\n  root\n    Alpha\n      ::icon(fa fa-book)\n';
    var parsed = mm.parseMindmap(t);
    var out = mm.setIcon(t, parsed.elements[1].line, '');
    expect(out).not.toContain('::icon');
  });
});

describe('deleteNode', function() {
  test('removes node and its subtree', function() {
    var t = 'mindmap\n  root\n    A\n      B\n    C\n';
    var parsed = mm.parseMindmap(t);
    var a = parsed.elements[1];
    var out = mm.deleteNode(t, a.line);
    // A and B should be gone, but C should remain
    var lines = out.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    expect(lines.indexOf('A')).toBe(-1);
    expect(lines.indexOf('B')).toBe(-1);
    expect(lines.indexOf('C')).toBeGreaterThan(-1);
  });
});
