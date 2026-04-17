'use strict';
var block = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.blockBeta)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.blockBeta);

describe('addBlock', function() {
  test('adds bare id when label same as id', function() {
    var out = block.addBlock('block-beta\n', 'x', 'x');
    expect(out).toContain('  x');
  });
  test('adds id["label"] when label differs', function() {
    var out = block.addBlock('block-beta\n', 'x', 'Alpha');
    expect(out).toContain('  x["Alpha"]');
  });
});

describe('addNestedBlock', function() {
  test('inserts inside block:parent before end', function() {
    var t = 'block-beta\n  block:g1\n    inner1\n  end\n';
    var out = block.addNestedBlock(t, 'g1', 'inner2', '');
    expect(out).toContain('inner2');
    expect(out.indexOf('inner2')).toBeLessThan(out.indexOf('end'));
  });
});

describe('addLink', function() {
  test('plain link', function() {
    var out = block.addLink('block-beta\n', 'a', 'b', '');
    expect(out).toContain('a --> b');
  });
  test('link with label', function() {
    var out = block.addLink('block-beta\n', 'a', 'b', 'triggers');
    expect(out).toContain('a -- "triggers" --> b');
  });
});

describe('deleteBlock', function() {
  test('removes sole block on line (deletes line)', function() {
    var t = 'block-beta\n  a["Alpha"]\n';
    var parsed = block.parseBlock(t);
    var out = block.deleteBlock(t, parsed.elements[0].line, 'a');
    expect(out).not.toContain('a["Alpha"]');
  });
  test('removes block token from multi-token line', function() {
    var t = 'block-beta\n  a["A"] b["B"] c["C"]\n';
    var parsed = block.parseBlock(t);
    var out = block.deleteBlock(t, parsed.elements[0].line, 'b');
    expect(out).toContain('a["A"]');
    expect(out).toContain('c["C"]');
    expect(out).not.toContain('b["B"]');
  });
  test('removes group block:ID ... end', function() {
    var t = 'block-beta\n  block:g1\n    inner\n  end\n';
    var parsed = block.parseBlock(t);
    var grp = parsed.elements.filter(function(e) { return e.kind === 'group'; })[0];
    var out = block.deleteBlock(t, grp.line, 'g1');
    expect(out).not.toContain('block:g1');
    expect(out).not.toContain('end');
  });
  test('cascade removes links referencing deleted block', function() {
    var t = 'block-beta\n  a["A"] b["B"]\n  a --> b\n';
    var parsed = block.parseBlock(t);
    var out = block.deleteBlock(t, parsed.elements[0].line, 'a');
    expect(out).not.toContain('a --> b');
  });
});

describe('deleteLink', function() {
  test('removes link line', function() {
    var t = 'block-beta\n  a["A"] b["B"]\n  a --> b\n';
    var parsed = block.parseBlock(t);
    var out = block.deleteLink(t, parsed.relations[0].line);
    expect(out).not.toContain('a --> b');
  });
});

describe('updateBlockLabel', function() {
  test('updates label to new value', function() {
    var t = 'block-beta\n  x["Old"]\n';
    var parsed = block.parseBlock(t);
    var out = block.updateBlockLabel(t, parsed.elements[0].line, 'x', 'New');
    expect(out).toContain('x["New"]');
    expect(out).not.toContain('x["Old"]');
  });
  test('removes label when empty', function() {
    var t = 'block-beta\n  x["Old"]\n';
    var parsed = block.parseBlock(t);
    var out = block.updateBlockLabel(t, parsed.elements[0].line, 'x', '');
    expect(out).not.toContain('"Old"');
    expect(out).toContain('x');
  });
});

describe('updateLink', function() {
  test('updates link label', function() {
    var t = 'block-beta\n  a --> b\n';
    var parsed = block.parseBlock(t);
    var out = block.updateLink(t, parsed.relations[0].line, 'label', 'triggers');
    expect(out).toContain('a -- "triggers" --> b');
  });
  test('updates from', function() {
    var t = 'block-beta\n  a --> b\n';
    var parsed = block.parseBlock(t);
    var out = block.updateLink(t, parsed.relations[0].line, 'from', 'c');
    expect(out).toContain('c --> b');
  });
});

describe('setColumns', function() {
  test('sets columns when none exists', function() {
    var out = block.setColumns('block-beta\n  a\n', 3);
    expect(out).toContain('columns 3');
  });
  test('replaces existing columns value', function() {
    var out = block.setColumns('block-beta\n  columns 2\n  a\n', 5);
    expect(out).toContain('columns 5');
    expect(out).not.toContain('columns 2');
  });
});

describe('operations.moveUp/moveDown/connect', function() {
  test('moveUp swaps lines', function() {
    var out = block.operations.moveUp('A\nB\nC\n', 2);
    expect(out.split('\n')[0]).toBe('B');
    expect(out.split('\n')[1]).toBe('A');
  });
  test('connect creates link', function() {
    var out = block.operations.connect('block-beta\n', 'a', 'b');
    expect(out).toContain('a --> b');
  });
});
