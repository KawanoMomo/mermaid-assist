'use strict';
// FEAT-903: 既にある要素の親を変えられるようにする (c4)。
//
// 実測 (作る前): 付け替えの欄があるのは21図種中 architecture の1つだけだった。
// c4 は `System_Boundary(...) { }` の**中に置く位置**で親を表すので
// (`addElement` が `insertAt = parent.endLine - 1` で入れる)、付け替えは
// 値の書き換えでは成立せず**行を動かす**ことになる。architecture だけが
// `in <親>` という行の属性で、書き換えで済んでいた。
//
// 各テストは**動いたことを先に確かめる**。最初これを書かずに測り、境界の
// 種類を間違えて何も動いていない状態を「通った」と読んだ。動かなければ
// 親も変わらないので、親を確かめる検査まで通ってしまう。
var M = (global.window && global.window.MA && global.window.MA.modules) || {};
var NL = String.fromCharCode(10);
var PC = String.fromCharCode(37, 37);
var c4 = M.c4;

// b1 に子を2つ置く。1つだと**動かした側が空になって畳まれる**ため、
// 「要素が消えていない」の検査が畳みと区別できなくなる (下に別テストを置く)。
var DOC = ['C4Context',
  '    Person(user, "User")',
  '    System_Boundary(b1, "内側A") {',
  '        System(s1, "系1")',
  '        System(s3, "系3")',
  '    }',
  '    System_Boundary(b2, "内側B") {',
  '        System(s2, "系2")',
  '    }'].join(NL);

function elOf(parsed, id) {
  var r = null;
  parsed.elements.forEach(function(e) { if (e.id === id) r = e; });
  return r;
}
function parentOf(text, id) {
  var p = c4.parse(text);
  var e = elOf(p, id);
  var b = e && c4.enclosingBoundary(p, e);
  return b ? b.id : null;
}

describe('c4: 親境界の付け替え', function() {
  test('要素を別の境界へ移す', function() {
    var out = c4.moveElementToBoundary(DOC, elOf(c4.parse(DOC), 's1').line, 'b2');
    expect(out).not.toBe(DOC);                 // 動いたことを先に確かめる
    expect(parentOf(out, 's1')).toBe('b2');
    expect(c4.parse(out).elements.length).toBe(c4.parse(DOC).elements.length);
  });

  test('一番外へ出せる', function() {
    var out = c4.moveElementToBoundary(DOC, elOf(c4.parse(DOC), 's1').line, '');
    expect(out).not.toBe(DOC);
    expect(parentOf(out, 's1')).toBeNull();
    expect(c4.parse(out).elements.length).toBe(c4.parse(DOC).elements.length);
  });

  test('境界を中身ごと別の境界へ移す', function() {
    var out = c4.moveElementToBoundary(DOC, elOf(c4.parse(DOC), 'b1').line, 'b2');
    expect(out).not.toBe(DOC);
    expect(parentOf(out, 'b1')).toBe('b2');
    expect(parentOf(out, 's1')).toBe('b1');    // 中身は付いて来る
  });

  test('中身が全部出て行った境界は畳まれる', function() {
    // 空の `System_Boundary(b1, "A") { }` を残すと **mermaid が描けず Error** になる。
    // 自前の解析は通るので単体では見えず、e2e で描画の状態を見て初めて出た。
    // 畳むのは削除経路 (deleteElementLine / deleteBoundary) と同じ約束。
    var d = ['C4Context',
      '    System_Boundary(b1, "A") {',
      '        System(s1, "系1")',
      '    }',
      '    System_Boundary(b2, "B") {',
      '        System(s2, "系2")',
      '    }'].join(NL);
    var out = c4.moveElementToBoundary(d, elOf(c4.parse(d), 's1').line, 'b2');
    expect(out).not.toBe(d);
    expect(parentOf(out, 's1')).toBe('b2');
    expect(elOf(c4.parse(out), 'b1')).toBeNull();   // 空になった b1 は残らない
    expect(out).not.toContain('System_Boundary(b1');
  });

  test('自分の中へは入れられない (循環)', function() {
    // 境界を自分の子孫の中に入れると `{ }` の対応が壊れ、図が出なくなる
    var b1 = elOf(c4.parse(DOC), 'b1');
    expect(c4.moveElementToBoundary(DOC, b1.line, 'b1')).toBe(DOC);
  });

  test('いま属している境界と同じものを選んでも本文を変えない', function() {
    // **子が2つある境界で測る**。子が1つだと、抜いて閉じ括弧の直前に入れ直す
    // 実装でも同じ本文になり、早期に戻す判断が効いていなくても通ってしまう。
    var d = ['C4Context',
      '    System_Boundary(b1, "A") {',
      '        System(s1, "系1")',
      '        System(s2, "系2")',
      '    }'].join(NL);
    var s1 = elOf(c4.parse(d), 's1');
    expect(c4.moveElementToBoundary(d, s1.line, 'b1')).toBe(d);
  });

  test('移した先の字下げが、そこにいる仲間と揃う', function() {
    // 字下げは解析の結果を変えないので、親だけを見る検査では通ってしまう。
    // ただし**Git の差分には出る**ので、揃わないと受け取る側が読む対象になる。
    // **深さが変わる向きで測る**。同じ深さ同士 (境界→境界) だと、字下げを
    // 付け直さない実装でも元の字下げが偶然一致し、検査が通ってしまう。
    // 一番外 (4字) から境界の中 (8字) へ動かす。
    var out = c4.moveElementToBoundary(DOC, elOf(c4.parse(DOC), 'user').line, 'b2');
    expect(out).not.toBe(DOC);
    expect(parentOf(out, 'user')).toBe('b2');
    var L = out.split(NL);
    var moved = null, sibling = null;
    L.forEach(function(l) {
      if (l.indexOf('Person(user,') >= 0) moved = l;
      if (l.indexOf('System(s2,') >= 0) sibling = l;
    });
    var indentOf = function(l) { return (l.match(/^(\s*)/) || ['', ''])[1]; };
    expect(indentOf(moved)).toBe(indentOf(sibling));
  });

  test('説明コメントも一緒に運ぶ', function() {
    var d = ['C4Context',
      '    System_Boundary(b1, "A") {',
      '        ' + PC + ' 系1のメモ',
      '        System(s1, "系1")',
      '    }',
      '    System_Boundary(b2, "B") {',
      '        System(s2, "系2")',
      '    }'].join(NL);
    var out = c4.moveElementToBoundary(d, elOf(c4.parse(d), 's1').line, 'b2');
    expect(out).not.toBe(d);
    expect(parentOf(out, 's1')).toBe('b2');
    var L = out.split(NL).map(function(x) { return x.trim(); });
    expect(L[L.indexOf('System(s1, "系1")') - 1]).toBe(PC + ' 系1のメモ');
  });

  test('存在しない境界を渡されたら本文を変えない', function() {
    var s1 = elOf(c4.parse(DOC), 's1');
    expect(c4.moveElementToBoundary(DOC, s1.line, 'いない')).toBe(DOC);
  });
});
