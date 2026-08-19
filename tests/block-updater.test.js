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

// ── 入れ子 group ──────────────────────────────────────────────────────────
describe('deleteBlock: 入れ子 group', function() {
  var NESTED = [
    'block-beta',        // 1
    '  block:outer',     // 2
    '    block:inner',   // 3
    '      a',           // 4
    '    end',           // 5
    '    b',             // 6
    '  end',             // 7
    '  c',               // 8
    ''
  ].join('\n');

  test('B1: 外側 group 削除で内側 group・子 block・end 2つがすべて消える', function() {
    var p = block.parseBlock(NESTED);
    var outer = p.elements.filter(function(e) { return e.id === 'outer'; })[0];
    var out = block.deleteBlock(NESTED, outer.line, 'outer');
    expect(out).not.toContain('block:outer');
    expect(out).not.toContain('block:inner');
    expect(out.split('\n').filter(function(l) { return l.trim() === 'end'; }).length).toBe(0);
    expect(out).toContain('c');
  });

  test('B2: 内側 group のみ削除で外側 group と end は保持される', function() {
    var p = block.parseBlock(NESTED);
    var inner = p.elements.filter(function(e) { return e.id === 'inner'; })[0];
    var out = block.deleteBlock(NESTED, inner.line, 'inner');
    expect(out).toContain('block:outer');
    expect(out).not.toContain('block:inner');
    expect(out.split('\n').filter(function(l) { return l.trim() === 'end'; }).length).toBe(1);
    expect(out).toContain('b');
  });

  test('B6: ネストなし group の削除は従来どおり (regression)', function() {
    var t = 'block-beta\n  block:g1\n    inner\n  end\n  z\n';
    var p = block.parseBlock(t);
    var g = p.elements.filter(function(e) { return e.id === 'g1'; })[0];
    var out = block.deleteBlock(t, g.line, 'g1');
    expect(out).not.toContain('block:g1');
    expect(out).not.toContain('inner');
    expect(out.split('\n').filter(function(l) { return l.trim() === 'end'; }).length).toBe(0);
    expect(out).toContain('z');
  });
});

describe('deleteBlock: 削除範囲内を参照するリンクのカスケード', function() {
  test('B4: 範囲内の子 block を参照するリンクも削除される', function() {
    var t = [
      'block-beta',
      '  block:outer',
      '    block:inner',
      '      a',
      '    end',
      '  end',
      '  c',
      '  a --> c',
      '  c --> c',
      ''
    ].join('\n');
    var p = block.parseBlock(t);
    var outer = p.elements.filter(function(e) { return e.id === 'outer'; })[0];
    var out = block.deleteBlock(t, outer.line, 'outer');
    expect(out).not.toContain('a --> c');
    expect(out).toContain('c --> c');
  });

  test('B5: 範囲内の group id を参照するリンクも削除される', function() {
    var t = [
      'block-beta',
      '  block:outer',
      '    block:inner',
      '      a',
      '    end',
      '  end',
      '  c',
      '  inner --> c',
      ''
    ].join('\n');
    var p = block.parseBlock(t);
    var outer = p.elements.filter(function(e) { return e.id === 'outer'; })[0];
    var out = block.deleteBlock(t, outer.line, 'outer');
    expect(out).not.toContain('inner --> c');
    expect(out).toContain('c');
  });
});

describe('addNestedBlock: 入れ子 group がある親への追加', function() {
  test('B3: 親自身の end の直前 (入れ子の外) に挿入される', function() {
    var t = [
      'block-beta',        // 1
      '  block:outer',     // 2
      '    block:inner',   // 3
      '      a',           // 4
      '    end',           // 5
      '  end',             // 6
      ''
    ].join('\n');
    var out = block.addNestedBlock(t, 'outer', 'newb', 'New');
    var lines = out.split('\n');
    var innerEndIdx = -1, outerEndIdx = -1, newIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('newb') >= 0) newIdx = i;
    }
    // 最後の end が outer の end
    for (var j = lines.length - 1; j >= 0; j--) {
      if (lines[j].trim() === 'end') { if (outerEndIdx === -1) outerEndIdx = j; else { innerEndIdx = j; break; } }
    }
    expect(newIdx).toBeGreaterThan(innerEndIdx); // 内側 end より後
    expect(newIdx).toBeLessThan(outerEndIdx);    // 外側 end より前
  });
});
