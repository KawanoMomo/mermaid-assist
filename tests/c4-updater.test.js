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

  test('U7: 内側の境界だけ削除しても外側に兄弟が残っていれば外側は保持される', function() {
    var t = [
      'C4Context',
      '    System_Boundary(outer, "外") {',
      '        System_Boundary(inner, "内") {',
      '            System(s1, "S")',
      '        }',
      '        System(sib, "兄弟")',
      '    }',
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var i = p.elements.filter(function(e) { return e.id === 'inner'; })[0];
    var out = c4.deleteBoundary(t, i.line, i.endLine);
    expect(out).toContain('System_Boundary(outer, "外") {');
    expect(out).toContain('System(sib, "兄弟")');
    expect(out).not.toContain('inner');
    expect(out.split('\n').filter(function(l) { return l.trim() === '}'; }).length).toBe(1);
  });

  test('U8: 内側の境界が外側の唯一の中身なら外側も畳まれる', function() {
    // 空の境界は mermaid が描画できないため、外側を残すと不正な図になる
    var t = [
      'C4Context',
      '    System_Boundary(outer, "外") {',
      '        System_Boundary(inner, "内") {',
      '            System(s1, "S")',
      '        }',
      '    }',
      '    Person(u, "U")',
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var i = p.elements.filter(function(e) { return e.id === 'inner'; })[0];
    var out = c4.deleteBoundary(t, i.line, i.endLine);
    expect(out).not.toContain('System_Boundary');
    expect(out.split('\n').filter(function(l) { return l.trim() === '}'; }).length).toBe(0);
    expect(out).toContain('Person(u, "U")');
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

describe('%% の引用符内外', function() {
  test('N1: ラベル中の %% を行末コメントと誤認しない', function() {
    var t = [
      'C4Context',
      '    System_Boundary(b1, "進捗 50%% 済") {',
      '        System(s1, "S")',
      '    }',
      '    Person(u, "U")',
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    expect(b.endLine).toBe(4);
    var out = c4.deleteBoundary(t, b.line, b.endLine);
    expect(out).not.toContain('}');
    expect(out).toContain('Person(u, "U")');
  });
});

describe('{ を次行に書く形式', function() {
  var T = [
    'C4Context',                        // 1
    '    System_Boundary(b1, "X")',     // 2
    '    {',                            // 3
    '        System(s1, "S")',          // 4
    '    }',                            // 5
    '    Person(u, "U")',               // 6
    ''
  ].join('\n');

  test('C3a: 境界として認識され endLine が対応する } を指す', function() {
    var p = c4.parseC4(T);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    expect(b.isBoundary).toBe(true);
    expect(b.endLine).toBe(5);
  });

  test('C3b: 削除で { } が孤児化しない', function() {
    var p = c4.parseC4(T);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    var out = c4.deleteBoundary(T, b.line, b.endLine);
    expect(out).not.toContain('{');
    expect(out).not.toContain('}');
    expect(out).toContain('Person(u, "U")');
  });
});

describe('プレースホルダ id の衝突', function() {
  test('M1: 既存 id と衝突しない子要素 id を生成する', function() {
    var t1 = c4.addElement('C4Context\n', 'System_Boundary', 'b1', '境界1');
    var t2 = c4.addElement(t1, 'System_Boundary', 'b1_sys', '境界2');
    var p = c4.parseC4(t2);
    var ids = p.elements.map(function(e) { return e.id; });
    var seen = {}, dup = [];
    ids.forEach(function(id) { if (seen[id]) dup.push(id); seen[id] = true; });
    expect(dup.length).toBe(0);
  });
});

describe('行末コメント付き要素と (n 要素を含む)', function() {
  test('M2a: 行末コメント付きの要素行も parse される', function() {
    var t = 'C4Context\n    System(a, "A") %% メモ\n    Person(u, "U")\n';
    var p = c4.parseC4(t);
    var ids = p.elements.map(function(e) { return e.id; });
    expect(ids).toContain('a');
  });

  test('M2b: 行末コメント付きのリレーション行も parse される', function() {
    var t = 'C4Context\n    System(a, "A")\n    Person(u, "U")\n    Rel(u, a, "uses") %% メモ\n';
    var p = c4.parseC4(t);
    expect(p.relations.length).toBe(1);
  });
});

describe('Kind セレクタのフォールバック', function() {
  test('m1: 候補に無い kind でも先頭が誤選択されない', function() {
    // ELEMENT_KINDS を境界/非境界で絞ったとき、選択中の kind が候補から漏れても
    // 表示が Person に化けないこと。kindOptionsFor が選択中の kind を必ず含む。
    var opts = c4.kindOptionsFor('Person', false);
    var selected = opts.filter(function(o) { return o.selected; });
    expect(selected.length).toBe(1);
    expect(selected[0].value).toBe('Person');
    var optsB = c4.kindOptionsFor('System_Boundary', true);
    var selB = optsB.filter(function(o) { return o.selected; });
    expect(selB[0].value).toBe('System_Boundary');
  });
});

describe('operations API の境界対応', function() {
  var T = [
    'C4Context',
    '    System_Boundary(b1, "X") {',
    '        System(s1, "S")',
    '    }',
    '    Person(u, "U")',
    ''
  ].join('\n');

  test('M3a: operations.delete が境界行なら範囲削除する', function() {
    var out = c4.operations.delete(T, 2);
    expect(out).not.toContain('System_Boundary');
    expect(out).not.toContain('}');
    expect(out).toContain('Person(u, "U")');
  });

  test('M3b: operations.moveUp/moveDown は境界行では何もしない', function() {
    expect(c4.operations.moveUp(T, 2)).toBe(T);
    expect(c4.operations.moveDown(T, 2)).toBe(T);
  });

  test('M3c: operations.delete が非境界要素でも空境界を残さない', function() {
    var out = c4.operations.delete(T, 3);
    expect(out).not.toContain('System_Boundary');
    expect(out).toContain('Person(u, "U")');
  });
});

describe('ラベル中の丸括弧・行末コメントの保存', function() {
  test('P1: 要素の descr 編集でラベル中の ) が切り詰められない', function() {
    var t = 'C4Context\n    System(s1, "決済 (Core)")\n';
    var p = c4.parseC4(t);
    var out = c4.updateElement(t, p.elements[0].line, 'descr', '説明');
    expect(out).toContain('System(s1, "決済 (Core)", "説明")');
  });

  test('P2: リレーションの tech 編集でラベル中の ) が切り詰められない', function() {
    var t = 'C4Context\n    Rel(a, b, "呼出 (同期)")\n';
    var p = c4.parseC4(t);
    var out = c4.updateRel(t, p.relations[0].line, 'tech', 'HTTP');
    expect(out).toContain('Rel(a, b, "呼出 (同期)", "HTTP")');
  });

  test('P3: 行末コメント付きの要素を編集してもコメントが残る', function() {
    var t = 'C4Context\n    System(s1, "A") %% メモ\n';
    var p = c4.parseC4(t);
    var out = c4.updateElement(t, p.elements[0].line, 'label', 'B');
    expect(out).toContain('System(s1, "B")');
    expect(out).toContain('%% メモ');
  });

  // mermaid は開き { の後のコメントを受理しない (実機確認済み) ので、境界行に
  // コメントを付ける入力はそもそも不正。閉じ } の後のコメントは受理される。
  test('P4: 境界の label 編集で閉じ } の行末コメントが無傷', function() {
    var t = 'C4Context\n    System_Boundary(b1, "X") {\n        System(s1, "S")\n    } %% 終了\n';
    var p = c4.parseC4(t);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    var out = c4.updateElement(t, b.line, 'label', 'Y');
    expect(out).toContain('System_Boundary(b1, "Y") {');
    expect(out).toContain('} %% 終了');
  });

  test('P6: 境界の中の行末コメント付き要素を編集しても構造が壊れない', function() {
    var t = 'C4Context\n    System_Boundary(b1, "X") {\n        System(s1, "A") %% メモ\n    }\n';
    var p = c4.parseC4(t);
    var s = p.elements.filter(function(e) { return e.id === 's1'; })[0];
    var out = c4.updateElement(t, s.line, 'label', 'B');
    expect(out).toContain('System(s1, "B") %% メモ');
    expect(out).toContain('System_Boundary(b1, "X") {');
    expect(out.split('\n').filter(function(l) { return l.trim() === '}'; }).length).toBe(1);
  });

  test('P5: 行末コメント付きのリレーションを編集してもコメントが残る', function() {
    var t = 'C4Context\n    Rel(a, b, "old") %% 備考\n';
    var p = c4.parseC4(t);
    var out = c4.updateRel(t, p.relations[0].line, 'label', 'new');
    expect(out).toContain('Rel(a, b, "new")');
    expect(out).toContain('%% 備考');
  });
});

// ── ユーザーレビュー指摘への対応 ─────────────────────────────────────────
describe('A6: 他の境界種別のサポート', function() {
  test('A6a: Container_Boundary が parse され境界として認識される', function() {
    var t = 'C4Container\n    Container_Boundary(b1, "ECU内部") {\n        Container(c1, "App", "C")\n    }\n';
    var p = c4.parseC4(t);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    expect(b.kind).toBe('Container_Boundary');
    expect(b.isBoundary).toBe(true);
    expect(b.endLine).toBe(4);
  });

  test('A6b: Enterprise_Boundary も同様', function() {
    var t = 'C4Context\n    Enterprise_Boundary(e1, "社内") {\n        System(s1, "S")\n    }\n';
    var p = c4.parseC4(t);
    var b = p.elements.filter(function(e) { return e.id === 'e1'; })[0];
    expect(b.isBoundary).toBe(true);
  });

  test('A6c: Container_Boundary を追加できる', function() {
    var out = c4.addElement('C4Container\n', 'Container_Boundary', 'b1', 'ECU内部');
    expect(out).toContain('Container_Boundary(b1, "ECU内部") {');
    var p = c4.parseC4(out);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    expect(b.isBoundary).toBe(true);
  });
});

describe('A2: 境界の中へ要素を追加する', function() {
  var T = [
    'C4Context',                            // 1
    '    Person(u, "User")',                // 2
    '    System_Boundary(b1, "境界") {',     // 3
    '        System(s1, "既存")',            // 4
    '    }',                                // 5
    ''
  ].join('\n');

  test('A2a: parentId を指定すると境界の中に入る', function() {
    var out = c4.addElement(T, 'System', 'newone', '新規', '', '', 'b1');
    var lines = out.split('\n');
    var bIdx = -1, closeIdx = -1, newIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('System_Boundary(b1') >= 0) bIdx = i;
      if (lines[i].trim() === '}') closeIdx = i;
      if (lines[i].indexOf('newone') >= 0) newIdx = i;
    }
    expect(newIdx).toBeGreaterThan(bIdx);
    expect(newIdx).toBeLessThan(closeIdx);
  });

  test('A2b: parentId 無しなら従来どおりトップレベル', function() {
    var out = c4.addElement(T, 'System', 'top', 'トップ');
    var lines = out.split('\n');
    var closeIdx = -1, newIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '}') closeIdx = i;
      if (lines[i].indexOf('top') >= 0) newIdx = i;
    }
    expect(newIdx).toBeGreaterThan(closeIdx);
  });

  test('A2c: 境界に本物の要素を足してからプレースホルダを消すと境界が残る', function() {
    // ユーザーレビュー A1 の「箱を作る→中身を入れ替える」フローが成立すること
    var t = c4.addElement('C4Context\n', 'System_Boundary', 'b1', '車載ECU');
    var withReal = c4.addElement(t, 'System', 'ecu_main', 'メインCPU', '', '', 'b1');
    var p = c4.parseC4(withReal);
    var ph = p.elements.filter(function(e) { return e.id === 'b1_sys'; })[0];
    var out = c4.deleteElementLine(withReal, ph.line);
    expect(out).toContain('System_Boundary(b1, "車載ECU") {');
    expect(out).toContain('ecu_main');
    expect(out).not.toContain('b1_sys');
  });
});

describe('A4/A5: 削除で実際に消える行数', function() {
  test('A4a: deletionImpact が要素とリレーションの両方を数える', function() {
    var t = [
      'C4Context',
      '    Person(u, "User")',
      '    System_Boundary(b1, "B") {',
      '        System(s1, "S1")',
      '        System(s2, "S2")',
      '    }',
      '    Rel(u, s1, "a")',
      '    Rel(u, s2, "b")',
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    var impact = c4.deletionImpact(t, b);
    // 境界自身 + 中の2要素 = 3。「消える総数」を返すので境界も含む
    expect(impact.elements).toBe(3);
    expect(impact.relations).toBe(2);
  });

  test('A4b: 連鎖して外側まで消える場合も数に含む', function() {
    var t = [
      'C4Context',
      '    System_Boundary(outer, "外") {',
      '        System_Boundary(inner, "内") {',
      '            System(s1, "S")',
      '        }',
      '    }',
      '    Person(u, "U")',
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var i = p.elements.filter(function(e) { return e.id === 'inner'; })[0];
    var impact = c4.deletionImpact(t, i);
    // inner + s1 + 空になって連鎖で畳まれる outer = 3
    expect(impact.elements).toBe(3);
  });
});

describe('ラベル中の二重引用符', function() {
  // mermaid は素の " も \" も受理せず、#quot; だけを " として描画する (実機確認)
  test('Q1: 追加時に " が #quot; へ変換される', function() {
    var out = c4.addElement('C4Context\n', 'System', 'x', 'いわゆる "Core"');
    expect(out).toContain('System(x, "いわゆる #quot;Core#quot;")');
  });

  test('Q2: 編集時も同様', function() {
    var t = 'C4Context\n    System(s1, "元", "説明")\n';
    var p = c4.parseC4(t);
    var out = c4.updateElement(t, p.elements[0].line, 'label', 'いわゆる "Core"');
    expect(out).toContain('"いわゆる #quot;Core#quot;"');
  });

  test('Q3: parse は #quot; を " に戻すのでパネル表示は素のまま', function() {
    var t = 'C4Context\n    System(s1, "いわゆる #quot;Core#quot;")\n';
    var p = c4.parseC4(t);
    expect(p.elements[0].label).toBe('いわゆる "Core"');
  });

  test('Q4: 編集を往復しても引用符が失われない', function() {
    var t = c4.addElement('C4Context\n', 'System', 'x', 'いわゆる "Core"');
    var p = c4.parseC4(t);
    var out = c4.updateElement(t, p.elements[0].line, 'descr', '新説明');
    var p2 = c4.parseC4(out);
    expect(p2.elements[0].label).toBe('いわゆる "Core"');
  });

  test('Q5: リレーションのラベルでも同様', function() {
    var out = c4.addRel('C4Context\n', 'Rel', 'a', 'b', '"同期" 呼出');
    expect(out).toContain('#quot;同期#quot; 呼出');
    var p = c4.parseC4(out);
    expect(p.relations[0].label).toBe('"同期" 呼出');
  });
});
