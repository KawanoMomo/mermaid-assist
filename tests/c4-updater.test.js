'use strict';
var c4 = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.c4) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.c4);

describe('setTitle / setVariant', function() {
  test('sets title', function() { expect(c4.setTitle('C4Context\n', 'X')).toContain('title X'); });
  test('sets variant', function() { expect(c4.setVariant('C4Context\n', 'Container')).toContain('C4Container'); });
});
describe('addElement', function() {
  test('adds Person', function() { expect(c4.addElement('C4Context\n', 'Person', 'u', 'User', 'desc')).toContain('Person(u, "User", "desc")'); });
  test('adds Container with tech', function() { expect(c4.addElement('C4Context\n', 'Container', 'api', 'API', 'backend', 'Java')).toContain('Container(api, "API", "Java", "backend")'); });
});
describe('addRel', function() {
  test('adds Rel with label', function() { expect(c4.addRel('C4Context\n', 'Rel', 'a', 'b', 'uses')).toContain('Rel(a, b, "uses")'); });
  test('adds Rel with tech', function() { expect(c4.addRel('C4Context\n', 'Rel', 'a', 'b', 'calls', 'HTTP')).toContain('Rel(a, b, "calls", "HTTP")'); });
});
describe('updateElement', function() {
  test('updates label', function() {
    var t = 'C4Context\n    Person(u, "Old", "d")\n';
    var p = c4.parseC4(t);
    var out = c4.updateElement(t, p.elements[0].line, 'label', 'New');
    expect(out).toContain('Person(u, "New", "d")');
  });
});
describe('updateRel', function() {
  test('updates label', function() {
    var t = 'C4Context\n    Rel(a, b, "old")\n';
    var p = c4.parseC4(t);
    var out = c4.updateRel(t, p.relations[0].line, 'label', 'new');
    expect(out).toContain('Rel(a, b, "new")');
  });
});
describe('parseArgs', function() {
  test('handles quoted commas', function() {
    var args = c4.parseArgs('u, "Label, with, commas", "d"');
    expect(args.length).toBe(3);
    expect(args[1]).toBe('Label, with, commas');
  });
});

// ── System_Boundary (block syntax) ────────────────────────────────────────
describe('System_Boundary: 編集で { が失われない', function() {
  var TEXT = [
    'C4Context',
    '    System_Boundary(b1, "旧") {',
    '        System(s1, "Sys")',
    '    }',
    ''
  ].join('\n');

  test('U1: 境界の label を編集しても行末の { が保存される', function() {
    var p = c4.parseC4(TEXT);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    var out = c4.updateElement(TEXT, b.line, 'label', '新');
    expect(out).toContain('System_Boundary(b1, "新") {');
    // 閉じ } が孤立していないこと
    expect(out.split('\n').filter(function(l) { return l.trim() === '}'; }).length).toBe(1);
  });

  test('U2: 非境界要素の編集では { が付かない (regression)', function() {
    var p = c4.parseC4(TEXT);
    var s = p.elements.filter(function(e) { return e.id === 's1'; })[0];
    var out = c4.updateElement(TEXT, s.line, 'label', 'X');
    expect(out).toContain('System(s1, "X")');
    expect(out).not.toContain('System(s1, "X") {');
  });

  test('U6: 境界の id を編集しても { が保存される', function() {
    var p = c4.parseC4(TEXT);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    var out = c4.updateElement(TEXT, b.line, 'id', 'b9');
    expect(out).toContain('System_Boundary(b9, "旧") {');
  });
});

describe('deleteBoundary: 範囲削除', function() {
  test('U3: 境界行〜対応する } まで削除し、外の要素は無傷', function() {
    var t = [
      'C4Context',                              // 1
      '    Person(u, "User")',                  // 2
      '    System_Boundary(b1, "境界") {',       // 3
      '        System(s1, "Sys")',              // 4
      '    }',                                  // 5
      '    Rel(u, s1, "uses")',                 // 6
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    var out = c4.deleteBoundary(t, b.line, b.endLine);
    expect(out).not.toContain('System_Boundary');
    expect(out).not.toContain('System(s1');
    expect(out.split('\n').filter(function(l) { return l.trim() === '}'; }).length).toBe(0);
    expect(out).toContain('Person(u, "User")');
    // s1 は境界ごと消えたので、それを指すリレーションも残ってはいけない
    // (残すと mermaid がダングリング参照でパースエラーになる)
    expect(out).not.toContain('Rel(u, s1');
  });

  test('U4: 入れ子の境界があっても外側の対応する } まで正しく削除', function() {
    var t = [
      'C4Context',                                  // 1
      '    System_Boundary(outer, "外") {',          // 2
      '        System_Boundary(inner, "内") {',      // 3
      '            System(s1, "S")',                 // 4
      '        }',                                   // 5
      '    }',                                       // 6
      '    Person(u, "User")',                       // 7
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var o = p.elements.filter(function(e) { return e.id === 'outer'; })[0];
    var out = c4.deleteBoundary(t, o.line, o.endLine);
    expect(out).not.toContain('System_Boundary');
    expect(out).not.toContain('System(s1');
    expect(out.split('\n').filter(function(l) { return l.trim() === '}'; }).length).toBe(0);
    expect(out).toContain('Person(u, "User")');
  });

  test('U7: 内側の境界だけ削除すると外側は保持される', function() {
    var t = [
      'C4Context',
      '    System_Boundary(outer, "外") {',
      '        System_Boundary(inner, "内") {',
      '            System(s1, "S")',
      '        }',
      '    }',
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var i = p.elements.filter(function(e) { return e.id === 'inner'; })[0];
    var out = c4.deleteBoundary(t, i.line, i.endLine);
    expect(out).toContain('System_Boundary(outer, "外") {');
    expect(out).not.toContain('inner');
    expect(out.split('\n').filter(function(l) { return l.trim() === '}'; }).length).toBe(1);
  });
});

describe('addElement: System_Boundary', function() {
  test('U5: 境界追加で { } とプレースホルダ子要素が生成され、往復で isBoundary=true', function() {
    var out = c4.addElement('C4Context\n', 'System_Boundary', 'b1', 'API境界');
    expect(out).toContain('System_Boundary(b1, "API境界") {');
    expect(out.split('\n').filter(function(l) { return l.trim() === '}'; }).length).toBe(1);
    var p = c4.parseC4(out);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    expect(b.isBoundary).toBe(true);
    // mermaid v11 は空の境界を受理しないため、子要素が1つ必要
    var children = p.elements.filter(function(e) { return e.line > b.line && e.line < b.endLine; });
    expect(children.length).toBe(1);
  });
});

// ── mermaid が受理する構文で壊れないこと ──────────────────────────────────
describe('閉じ } の行末コメント', function() {
  var T = [
    'C4Context',                          // 1
    '    System_Boundary(b1, "x") {',     // 2
    '        System(s1, "S")',            // 3
    '    } %% close',                     // 4
    '    Person(u, "U")',                 // 5
    ''
  ].join('\n');

  test('A1: } %% close でも endLine が対応する行を指す', function() {
    var p = c4.parseC4(T);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    expect(b.endLine).toBe(4);
  });

  test('A2: } %% close の境界を削除しても孤立した } が残らない', function() {
    var p = c4.parseC4(T);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    var out = c4.deleteBoundary(T, b.line, b.endLine);
    expect(out).not.toContain('}');
    expect(out).not.toContain('System(s1');
    expect(out).toContain('Person(u, "U")');
  });
});

describe('空の境界を作らない', function() {
  test('A3: 境界の唯一の子を削除すると境界ごと消える', function() {
    var t = [
      'C4Context',
      '    System_Boundary(b1, "x") {',
      '        System(s1, "S")',
      '    }',
      '    Person(u, "U")',
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var s = p.elements.filter(function(e) { return e.id === 's1'; })[0];
    var out = c4.deleteElementLine(t, s.line);
    expect(out).not.toContain('System_Boundary');
    expect(out).not.toContain('}');
    expect(out).toContain('Person(u, "U")');
  });

  test('A4: 子が2つあるなら1つ消しても境界は残る', function() {
    var t = [
      'C4Context',
      '    System_Boundary(b1, "x") {',
      '        System(s1, "S")',
      '        System(s2, "T")',
      '    }',
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var s = p.elements.filter(function(e) { return e.id === 's1'; })[0];
    var out = c4.deleteElementLine(t, s.line);
    expect(out).toContain('System_Boundary(b1, "x") {');
    expect(out).toContain('System(s2, "T")');
    expect(out).not.toContain('System(s1');
  });

  test('A5: 入れ子境界が空になったら外側まで連鎖して消える', function() {
    var t = [
      'C4Context',
      '    Enterprise_Boundary(e, "外") {',
      '        System_Boundary(b1, "内") {',
      '            System(s1, "S")',
      '        }',
      '    }',
      '    Person(u, "U")',
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var s = p.elements.filter(function(e) { return e.id === 's1'; })[0];
    var out = c4.deleteElementLine(t, s.line);
    expect(out).not.toContain('Enterprise_Boundary');
    expect(out).not.toContain('System_Boundary');
    expect(out).not.toContain('}');
    expect(out).toContain('Person(u, "U")');
  });
});

describe('リレーションのカスケード', function() {
  test('R1: 要素を削除すると、それを参照するリレーションも消える', function() {
    var t = [
      'C4Context',
      '    Person(u, "User")',
      '    System(s1, "S")',
      '    Rel(u, s1, "uses")',
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var s = p.elements.filter(function(e) { return e.id === 's1'; })[0];
    var out = c4.deleteElementLine(t, s.line);
    expect(out).not.toContain('Rel(u, s1');
    expect(out).toContain('Person(u, "User")');
  });

  test('R2: 境界を範囲削除すると、中の要素を参照するリレーションも消える', function() {
    var t = [
      'C4Context',
      '    Person(u, "User")',
      '    System_Boundary(b1, "境界") {',
      '        System(s1, "S")',
      '    }',
      '    Rel(u, s1, "uses")',
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    var out = c4.deleteBoundary(t, b.line, b.endLine);
    expect(out).not.toContain('Rel(u, s1');
    expect(out).toContain('Person(u, "User")');
  });

  test('R3: 元から壊れているリレーションは巻き添えにしない', function() {
    var t = [
      'C4Context',
      '    Person(u, "User")',
      '    System(s1, "S")',
      '    Rel(u, ghost, "dangling")',
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var s = p.elements.filter(function(e) { return e.id === 's1'; })[0];
    var out = c4.deleteElementLine(t, s.line);
    expect(out).toContain('Rel(u, ghost, "dangling")');
  });

  test('R4: 無関係なリレーションは残る', function() {
    var t = [
      'C4Context',
      '    Person(u, "User")',
      '    System(s1, "S")',
      '    System(s2, "T")',
      '    Rel(u, s2, "keeps")',
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var s = p.elements.filter(function(e) { return e.id === 's1'; })[0];
    var out = c4.deleteElementLine(t, s.line);
    expect(out).toContain('Rel(u, s2, "keeps")');
  });
});
