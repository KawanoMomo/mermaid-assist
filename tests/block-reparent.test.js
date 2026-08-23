'use strict';
// FEAT-903: 既にあるブロックの親グループを変えられるようにする (block)。
//
// block は `block:<id> ... end` の**中に置く位置**で親を表すので
// (`addNestedBlock` が `lines.splice(endIdx, 0, ...)` で入れる)、付け替えは
// 値の書き換えでは成立せず**行を動かす**。architecture だけが `in <親>` という
// 行の属性で、書き換えで済んでいた。
//
// 各テストは**動いたことを先に確かめる**。動かなければ親も変わらないので、
// 親を確かめる検査まで通ってしまう (c4 で実際にそう読み違えた)。
var bl = (global.window && global.window.MA && global.window.MA.modules || {}).blockBeta;
var NL = String.fromCharCode(10);
var PC = String.fromCharCode(37, 37);

var D = ['block-beta', '  a["外A"]', '  block:g1', '    b["中B"]', '  end',
  '  block:g2', '    c["中C"]', '  end'].join(NL);

function el(t, id) {
  var r = null;
  bl.parse(t).elements.forEach(function(e) { if (e.id === id) r = e; });
  return r;
}
function indentOf(line) { return (line.match(/^(\s*)/) || ['', ''])[1]; }

describe('block: 親グループの付け替え', function() {
  test('外にあるブロックをグループへ入れる', function() {
    var out = bl.moveBlockToGroup(D, el(D, 'a').line, 'g1');
    expect(out).not.toBe(D);
    expect(el(out, 'a').parentId).toBe('g1');
  });

  test('グループから外へ出す', function() {
    var out = bl.moveBlockToGroup(D, el(D, 'b').line, '');
    expect(out).not.toBe(D);
    expect(el(out, 'b').parentId).toBeNull();
  });

  test('グループごと別のグループへ入れる', function() {
    var out = bl.moveBlockToGroup(D, el(D, 'g1').line, 'g2');
    expect(out).not.toBe(D);
    expect(el(out, 'g1').parentId).toBe('g2');
    expect(el(out, 'b').parentId).toBe('g1');   // 中身は付いて来る
  });

  test('自分の中へは入れられない (循環)', function() {
    expect(bl.moveBlockToGroup(D, el(D, 'g1').line, 'g1')).toBe(D);
  });

  test('いまと同じグループを選んでも本文を変えない', function() {
    // 子が2つある状態で測る。1つだと、抜いて end の直前に入れ直す実装でも
    // 同じ本文になり、早期に戻す判断が効いていなくても通ってしまう。
    var d = ['block-beta', '  block:g1', '    b["B"]', '    c["C"]', '  end'].join(NL);
    expect(bl.moveBlockToGroup(d, el(d, 'b').line, 'g1')).toBe(d);
  });

  test('1行に複数並ぶときは動かさない', function() {
    // 行ごと動かすと隣のブロックまで連れて行く。黙って巻き込むより動かさない。
    var d = ['block-beta', '  a["A"] b["B"]', '  block:g1', '  end'].join(NL);
    expect(bl.parse(d).elements.filter(function(e) { return e.line === 2; }).length).toBe(2);
    expect(bl.moveBlockToGroup(d, 2, 'g1')).toBe(d);
  });

  test('移した先の字下げが、そこにいる仲間と揃う', function() {
    // 字下げは解析の結果を変えないので、親だけを見る検査では通ってしまう。
    // 深さが変わる向き (一番外 → グループの中) で測る。
    var out = bl.moveBlockToGroup(D, el(D, 'a').line, 'g2');
    expect(out).not.toBe(D);
    var L = out.split(NL), moved = null, sibling = null;
    L.forEach(function(l) {
      if (l.indexOf('a["外A"]') >= 0) moved = l;
      if (l.indexOf('c["中C"]') >= 0) sibling = l;
    });
    expect(indentOf(moved)).toBe(indentOf(sibling));
  });

  test('説明コメントも一緒に運ぶ', function() {
    var d = ['block-beta', '  ' + PC + ' Aのメモ', '  a["外A"]', '  block:g1', '  end'].join(NL);
    var out = bl.moveBlockToGroup(d, el(d, 'a').line, 'g1');
    expect(out).not.toBe(d);
    expect(el(out, 'a').parentId).toBe('g1');
    var L = out.split(NL).map(function(x) { return x.trim(); });
    expect(L[L.indexOf('a["外A"]') - 1]).toBe(PC + ' Aのメモ');
  });

  test('存在しないグループを渡されたら本文を変えない', function() {
    expect(bl.moveBlockToGroup(D, el(D, 'a').line, 'いない')).toBe(D);
  });
});

describe('UI-084 空になったグループを残さない', function() {
  // 空の `block:g1 ... end` を残すと **mermaid が描けず「Error」になる**。
  // 自前の解析は通るので単体では見えず、描画の状態を見て初めて出た。
  // 削除は付け替えより前からこの形で、**私の変更とは無関係の既存欠陥**。
  test('グループの最後の1件を消すとグループごと消える', function() {
    var d = ['block-beta', '  a["A"]', '  block:g1', '    b["B"]', '  end'].join(NL);
    var out = bl.operations['delete'](d, el(d, 'b').line, { id: 'b', kind: 'block' });
    expect(out).not.toContain('b["B"]');      // 消えたことを先に確かめる
    expect(out).not.toContain('block:g1');
    expect(out).toContain('a["A"]');          // 関係ない要素は残る
  });

  test('中身が残っているグループは消さない', function() {
    var d = ['block-beta', '  block:g1', '    b["B"]', '    c["C"]', '  end'].join(NL);
    var out = bl.operations['delete'](d, el(d, 'b').line, { id: 'b', kind: 'block' });
    expect(out).not.toContain('b["B"]');
    expect(out).toContain('block:g1');
    expect(out).toContain('c["C"]');
  });

  test('付け替えで中身が全部出て行ったグループも畳む', function() {
    var d = ['block-beta', '  block:g1', '    b["B"]', '  end', '  block:g2', '    c["C"]', '  end'].join(NL);
    var out = bl.moveBlockToGroup(d, el(d, 'b').line, 'g2');
    expect(out).not.toBe(d);
    expect(el(out, 'b').parentId).toBe('g2');
    expect(out).not.toContain('block:g1');
  });
});
