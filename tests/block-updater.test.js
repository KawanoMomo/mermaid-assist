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
    expect(out.split('\n').filter(function(l) { return l.trim() === 'c'; }).length).toBe(1);
  });

  test('B2: 内側 group のみ削除で外側 group と end は保持される', function() {
    var p = block.parseBlock(NESTED);
    var inner = p.elements.filter(function(e) { return e.id === 'inner'; })[0];
    var out = block.deleteBlock(NESTED, inner.line, 'inner');
    expect(out).toContain('block:outer');
    expect(out).not.toContain('block:inner');
    expect(out.split('\n').filter(function(l) { return l.trim() === 'end'; }).length).toBe(1);
    expect(out.split('\n').filter(function(l) { return l.trim() === 'b'; }).length).toBe(1);
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
    expect(out.split('\n').filter(function(l) { return l.trim() === 'c'; }).length).toBe(1);
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

describe('group id の前方一致衝突', function() {
  var TWO = [
    'block-beta',       // 1
    '  block:g10',      // 2
    '    x',            // 3
    '  end',            // 4
    '  block:g1',       // 5
    '    y',            // 6
    '  end',            // 7
    ''
  ].join('\n');

  test('B7: addNestedBlock は g1 を指定したとき g10 に入れない', function() {
    var out = block.addNestedBlock(TWO, 'g1', 'newb', 'New');
    var lines = out.split('\n');
    var newIdx = -1, g1Idx = -1, g10Idx = -1;
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (t === 'block:g10') g10Idx = i;
      if (t === 'block:g1') g1Idx = i;
      if (lines[i].indexOf('newb') >= 0) newIdx = i;
    }
    expect(newIdx).toBeGreaterThan(g1Idx); // g1 の中に入っていること
    expect(g1Idx).toBeGreaterThan(g10Idx); // 前提: g10 が先にある
  });

  test('B8: deleteBlock は行番号と id が食い違っても前方一致で誤爆しない', function() {
    // 2行目は block:g10。blockId に g1 を渡しても group 扱いしてはいけない
    var out = block.deleteBlock(TWO, 2, 'g1');
    expect(out).toContain('block:g10');
    expect(out).toContain('x');
  });

  test('B9: columns 付き group でも id を完全一致で判定する', function() {
    var t = 'block-beta\n  block:g10 columns 2\n    x\n  end\n  block:g1\n    y\n  end\n';
    var out = block.addNestedBlock(t, 'g1', 'nb', 'NB');
    var lines = out.split('\n');
    var nbIdx = -1, g1Idx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim() === 'block:g1') g1Idx = i;
      if (lines[i].indexOf('nb') >= 0) nbIdx = i;
    }
    expect(nbIdx).toBeGreaterThan(g1Idx);
  });
});

// ── 列スパン構文 block:id:N / カスケードの精度 / 未閉じ group ──────────────
describe('列スパン構文 block:id:N', function() {
  test('C1: span group を削除しても以降の行が消えない', function() {
    var t = [
      'block-beta',        // 1
      '  columns 3',       // 2
      '  aa bb cc',        // 3
      '  block:grp:3',     // 4
      '    dd',            // 5
      '    ee',            // 6
      '  end',             // 7
      '  ff gg hh',        // 8
      ''
    ].join('\n');
    var out = block.deleteBlock(t, 4, 'grp');
    expect(out).not.toContain('block:grp');
    expect(out).not.toContain('dd');
    expect(out.split('\n').filter(function(l) { return l.trim() === 'end'; }).length).toBe(0);
    expect(out).toContain('ff gg hh');
    expect(out).toContain('aa bb cc');
  });

  test('C2: 内側が span 構文でも外側削除で残骸が出ない', function() {
    var t = [
      'block-beta',            // 1
      '  block:outer',         // 2
      '    block:inner:2',     // 3
      '      xx',              // 4
      '    end',               // 5
      '    yy',                // 6
      '  end',                 // 7
      '  zz',                  // 8
      ''
    ].join('\n');
    var out = block.deleteBlock(t, 2, 'outer');
    expect(out.split('\n').filter(function(l) { return l.trim() === 'end'; }).length).toBe(0);
    expect(out).not.toContain('yy');
    expect(out).not.toContain('xx');
    expect(out).toContain('zz');
  });

  test('C3: span group が parse で group として認識される', function() {
    var p = block.parseBlock('block-beta\n  block:grp:3\n    dd\n  end\n');
    var g = p.elements.filter(function(e) { return e.id === 'grp'; })[0];
    expect(g.kind).toBe('group');
  });
});

describe('リンクカスケードの精度', function() {
  test('M2: 未対応 shape のラベル語を id と誤認して範囲外リンクを消さない', function() {
    var t = [
      'block-beta',
      '  block:g1',
      '    dd{"Decision Node"}',
      '  end',
      '  Decision',
      '  Node',
      '  Decision --> Node',
      ''
    ].join('\n');
    var out = block.deleteBlock(t, 2, 'g1');
    expect(out).toContain('Decision --> Node');
  });

  test('M3: 同名 id が範囲外にも存在する場合はリンクを残す', function() {
    var t = [
      'block-beta',
      '  block:g1',
      '    aa',
      '  end',
      '  aa',
      '  bb',
      '  aa --> bb',
      ''
    ].join('\n');
    var out = block.deleteBlock(t, 2, 'g1');
    expect(out).toContain('aa --> bb');
  });

  test('M5: 元から壊れているリンクは削除で巻き添えにしない', function() {
    var t = [
      'block-beta',
      '  block:g1',
      '    aa',
      '  end',
      '  bb',
      '  ghost --> bb',
      ''
    ].join('\n');
    var out = block.deleteBlock(t, 2, 'g1');
    expect(out).toContain('ghost --> bb');
  });
});

describe('未閉じ group', function() {
  test('M4: end が無い group の削除で以降の行を巻き込まない', function() {
    var t = [
      'block-beta',
      '  aa',
      '  block:g1',
      '    bb',
      '  cc',
      '  dd',
      '  aa --> dd',
      ''
    ].join('\n');
    var out = block.deleteBlock(t, 3, 'g1');
    expect(out).not.toContain('block:g1');
    expect(out).toContain('cc');
    expect(out).toContain('dd');
    expect(out).toContain('aa --> dd');
  });
});

// ── ユーザーレビュー指摘 (B1/B2) ──────────────────────────────────────────
describe('B1: 入れ子への挿入インデント', function() {
  var T = [
    'block-beta',            // 1
    '  block:ecu',           // 2
    '    block:periph',      // 3
    '      uart["UART"]',    // 4
    '    end',               // 5
    '  end',                 // 6
    ''
  ].join('\n');

  test('B1a: 深さ2の group へ追加すると親より1段深いインデントになる', function() {
    var out = block.addNestedBlock(T, 'periph', 'can', 'CAN');
    var lines = out.split('\n');
    var canLine = lines.filter(function(l) { return l.indexOf('can') >= 0; })[0];
    var periphLine = lines.filter(function(l) { return l.trim() === 'block:periph'; })[0];
    var canIndent = canLine.match(/^(\s*)/)[1].length;
    var periphIndent = periphLine.match(/^(\s*)/)[1].length;
    expect(canIndent).toBe(periphIndent + 2);
  });

  test('B1b: 深さ1の group でも同じ規則', function() {
    var out = block.addNestedBlock(T, 'ecu', 'pwr', 'PWR');
    var lines = out.split('\n');
    var pwrLine = lines.filter(function(l) { return l.indexOf('pwr') >= 0; })[0];
    var ecuLine = lines.filter(function(l) { return l.trim() === 'block:ecu'; })[0];
    expect(pwrLine.match(/^(\s*)/)[1].length).toBe(ecuLine.match(/^(\s*)/)[1].length + 2);
  });

  test('B1c: 既存の子要素と同じインデントに揃う', function() {
    var out = block.addNestedBlock(T, 'periph', 'can', 'CAN');
    var lines = out.split('\n');
    var uart = lines.filter(function(l) { return l.indexOf('uart') >= 0; })[0];
    var can = lines.filter(function(l) { return l.indexOf('can') >= 0; })[0];
    expect(can.match(/^(\s*)/)[1].length).toBe(uart.match(/^(\s*)/)[1].length);
  });
});

describe('B2: 削除の影響件数', function() {
  test('B2a: deletionImpact が group 配下の要素とリンクを数える', function() {
    var t = [
      'block-beta',
      '  block:ecu',
      '    block:periph',
      '      uart["UART"]',
      '    end',
      '    cpu["CPU"]',
      '  end',
      '  ext["EXT"]',
      '  uart --> ext',
      ''
    ].join('\n');
    var p = block.parseBlock(t);
    var ecu = p.elements.filter(function(e) { return e.id === 'ecu'; })[0];
    var impact = block.deletionImpact(t, ecu);
    // ecu + periph + uart + cpu = 4 要素、uart --> ext = 1 リンク
    expect(impact.elements).toBe(4);
    expect(impact.relations).toBe(1);
  });

  test('B2b: 単独ブロックなら影響は自分だけ', function() {
    var t = 'block-beta\n  a["A"]\n  b["B"]\n';
    var p = block.parseBlock(t);
    var a = p.elements.filter(function(e) { return e.id === 'a'; })[0];
    var impact = block.deletionImpact(t, a);
    expect(impact.elements).toBe(1);
    expect(impact.relations).toBe(0);
  });
});

describe('B1d: インデント文字の追随', function() {
  var TAB = String.fromCharCode(9);

  test('タブでインデントされた図にはタブで足す', function() {
    var t = ['block-beta', TAB + 'block:ecu', TAB + TAB + 'block:periph',
             TAB + TAB + TAB + 'uart["UART"]', TAB + TAB + 'end', TAB + 'end', ''].join('\n');
    var out = block.addNestedBlock(t, 'periph', 'can', 'CAN');
    var lines = out.split('\n');
    var can = lines.filter(function(l) { return l.indexOf('can') >= 0; })[0];
    var uart = lines.filter(function(l) { return l.indexOf('uart') >= 0; })[0];
    // 既存の子と同じインデント文字列であること (混在させない)
    expect(can.match(/^(\s*)/)[1]).toBe(uart.match(/^(\s*)/)[1]);
  });

  test('スペースの図ではスペースのまま', function() {
    var t = 'block-beta\n  block:g\n    a["A"]\n  end\n';
    var out = block.addNestedBlock(t, 'g', 'x', 'X');
    var lines = out.split('\n');
    var x = lines.filter(function(l) { return l.indexOf('x[') >= 0; })[0];
    expect(x.match(/^(\s*)/)[1]).toBe('    ');
  });
});

describe('deletionImpactFrom は deletionImpact と一致する', function() {
  // 高速版は既存の parse から導出するため、正確版と食い違うと「述語の非対称」に
  // なる。代表的な形をすべて突き合わせて固定する。
  var CASES = [
    'block-beta\n  a["A"]\n  b["B"]\n',
    'block-beta\n  block:g1\n    a["A"]\n  end\n  b["B"]\n  a --> b\n',
    'block-beta\n  block:outer\n    block:inner\n      a["A"]\n    end\n    b["B"]\n  end\n  c["C"]\n  a --> c\n',
    'block-beta\n  columns 3\n  block:grp:3\n    d["D"]\n  end\n  e["E"]\n  d --> e\n',
    'block-beta\n  a["A"] b["B"] c["C"]\n  a --> b\n  b --> c\n',
    'block-beta\n  block:g1\n    x["X"]\n  end\n  x2["X2"]\n  x --> x2\n  x2 --> x2\n'
  ];

  CASES.forEach(function(t, ci) {
    test('ケース' + (ci + 1) + ': 全要素で一致', function() {
      var p = block.parseBlock(t);
      expect(p.elements.length).toBeGreaterThan(0);
      for (var i = 0; i < p.elements.length; i++) {
        var el = p.elements[i];
        var exact = block.deletionImpact(t, el);
        var fast = block.deletionImpactFrom(p, el, t);
        expect(fast.elements).toBe(exact.elements);
        expect(fast.relations).toBe(exact.relations);
      }
    });
  });
});
