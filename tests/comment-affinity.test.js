'use strict';
// UI-083: 要素を消す/動かすと、その説明だったコメントが別の要素の説明になる。
//
// 実測 (直す前): `A["開始"]` の下に `%% 印B` を置いて B を消すと、
// `%% 印B` は残り、その下に来た `C["終了"]` の説明として読まれた。
// **コメントの件数は 2 → 2 のまま**なので、件数を見る検査はすべて通る。
// 付き先 (コメントの直後の非コメント行) を見て初めて出る。
//
// 決めたこと: **空行を挟まず要素の直上にあるコメントは、その要素の一部**として扱う。
// 空行が挟まっていれば見出し (`%% === 入力系 ===`) とみなし、置いて行く。
var TU = (global.window && global.window.MA && global.window.MA.textUpdater);
var M = (global.window && global.window.MA && global.window.MA.modules) || {};
var NL = String.fromCharCode(10);
var PC = String.fromCharCode(37, 37);

function lines(t) { return String(t).split(NL).map(function(x) { return x.trim(); }); }
// コメントが説明している行 = 直後の最初の非コメント行
function targetOf(t, key) {
  var L = String(t).split(NL);
  for (var i = 0; i < L.length; i++) if (L[i].indexOf(key) >= 0) {
    for (var j = i + 1; j < L.length; j++) if (L[j].trim() && L[j].indexOf(PC) !== 0 && L[j].trim().indexOf(PC) !== 0) return L[j].trim();
    return '(対象なし)';
  }
  return '(消えた)';
}

describe('UI-083 移動: 説明が要素に付いて行く', function() {
  var doc = ['flowchart TD', '    ' + PC + ' 印A', '    A["開始"]', '    ' + PC + ' 印B', '    B["処理"]', '    A --> B'].join(NL);

  test('上へ動かすと説明も一緒に動く', function() {
    var out = M.flowchart.operations.moveUp(doc, 5);
    var L = lines(out);
    var iA = L.indexOf('A["開始"]'), iB = L.indexOf('B["処理"]');
    // **動いたことを先に確かめる**。動かなければ説明も狂わないので、
    // 「保たれた」という結果が「何も起きなかった」を意味しうる。
    expect(iB).toBeLessThan(iA);
    expect(L[iB - 1]).toBe(PC + ' 印B');
    expect(L[iA - 1]).toBe(PC + ' 印A');
  });

  test('見出し (空行で区切られたコメント) は置いて行く', function() {
    var d2 = ['flowchart TD', '    ' + PC + ' === 入力系 ===', '', '    A["入力"]',
      '    ' + PC + ' 印B', '    B["処理"]', '    A --> B'].join(NL);
    var out = M.flowchart.operations.moveUp(d2, 6);
    var L = lines(out);
    expect(L.indexOf(PC + ' === 入力系 ===')).toBeLessThan(L.indexOf('B["処理"]'));
    expect(L[L.indexOf('B["処理"]') - 1]).toBe(PC + ' 印B');
  });

  test('コメントが無い文書でも今までどおり動く', function() {
    var d3 = ['flowchart TD', '    A["開始"]', '    B["処理"]', '    A --> B'].join(NL);
    var L = lines(M.flowchart.operations.moveUp(d3, 3));
    expect(L.indexOf('B["処理"]')).toBeLessThan(L.indexOf('A["開始"]'));
  });

  test('classDiagram でも同じ', function() {
    var d4 = ['classDiagram', '    ' + PC + ' 印A', '    class Animal', '    ' + PC + ' 印B', '    class Dog'].join(NL);
    var L = lines(M.classDiagram.operations.moveUp(d4, 5));
    var iA = L.indexOf('class Animal'), iB = L.indexOf('class Dog');
    expect(iB).toBeLessThan(iA);
    expect(L[iB - 1]).toBe(PC + ' 印B');
  });
});

describe('UI-083 削除: 説明も一緒に消える', function() {
  test('stripNotesAbove が直上のコメントだけを外す', function() {
    var d = ['flowchart TD', '    ' + PC + ' 印A', '    A["開始"]', '    ' + PC + ' 印B1',
      '    ' + PC + ' 印B2', '    B["処理"]'].join(NL);
    var r = TU.stripNotesAbove(d, 6);
    expect(r.lineNum).toBe(4);
    expect(r.text).not.toContain('印B1');
    expect(r.text).not.toContain('印B2');
    expect(r.text).toContain('印A');       // 別の要素の説明は残す
    expect(r.text).toContain('A["開始"]');
  });

  test('空行が挟まっていれば外さない (見出し)', function() {
    var d = ['flowchart TD', '    ' + PC + ' === 入力系 ===', '', '    A["入力"]'].join(NL);
    var r = TU.stripNotesAbove(d, 4);
    expect(r.lineNum).toBe(4);
    expect(r.text).toContain('=== 入力系 ===');
  });

  test('コメントが無ければ何も変えない', function() {
    var d = ['flowchart TD', '    A["開始"]'].join(NL);
    var r = TU.stripNotesAbove(d, 2);
    expect(r.text).toBe(d);
    expect(r.lineNum).toBe(2);
  });

  test('deleteLine は説明ごと消す', function() {
    var d = ['flowchart TD', '    ' + PC + ' 印A', '    A["開始"]', '    ' + PC + ' 印B', '    B["処理"]'].join(NL);
    var out = TU.deleteLine(d, 5);
    expect(out).not.toContain('印B');
    expect(out).toContain('印A');
    expect(out).toContain('A["開始"]');
    expect(out).not.toContain('B["処理"]');
  });

  test('id で消す経路 (契約) でも、先に外せば残らない', function() {
    // app.js の deleteSelectedElements と同じ並び: 先に外してから委譲する
    var d = ['flowchart TD', '    ' + PC + ' 印A', '    A["開始"]', '    ' + PC + ' 印B',
      '    B["処理"]', '    C["終了"]', '    A --> B', '    B --> C'].join(NL);
    var r = TU.stripNotesAbove(d, 5);
    var out = M.flowchart.operations['delete'](r.text, r.lineNum, { kind: 'node', id: 'B' });
    expect(out).not.toContain('印B');
    expect(out).toContain('印A');
    // 残った説明が別の要素に付け替わっていないこと
    expect(targetOf(out, '印A')).toBe('A["開始"]');
  });
});

describe('UI-083 移動: swapLines を直に呼ぶ図種', function() {
  // sequence / gantt / c4 は moveElementLine を通らず swapLines を直接呼ぶ。
  // elementBlocks を直しただけでは届かないので、swapLinesWithNotes を用意した。
  test('sequence の参加者', function() {
    var doc = ['sequenceDiagram', '    ' + PC + ' 印A', '    participant A as アルファ',
      '    ' + PC + ' 印B', '    participant B as ブラボー', '    A->>B: m1'].join(NL);
    var p = M.sequence.parse(doc);
    var els = p.elements.filter(function(e) { return e.kind === 'participant' || e.kind === 'actor'; });
    var L = lines(M.sequence.operations.moveUp(doc, els[1].line));
    var iA = L.indexOf('participant A as アルファ'), iB = L.indexOf('participant B as ブラボー');
    expect(iB).toBeLessThan(iA);           // 動いたことを先に確かめる
    expect(L[iB - 1]).toBe(PC + ' 印B');
    expect(L[iA - 1]).toBe(PC + ' 印A');
  });

  test('離れた2要素は説明ごと入れ替わる', function() {
    var d = ['flowchart TD', '    A["開始"]', '    ' + PC + ' 印B', '    B["処理"]'].join(NL);
    var L = lines(TU.swapLinesWithNotes(d, 2, 4));
    expect(L[L.indexOf('B["処理"]') - 1]).toBe(PC + ' 印B');
    expect(L.indexOf('B["処理"]')).toBeLessThan(L.indexOf('A["開始"]'));
  });

  test('要素と、その要素自身の説明を入れ替えようとしたら素の入れ替えに落とす', function() {
    // c4 の moveUp は隣の行と無条件に入れ替えるので、直上が説明のときこの形になる。
    // 説明ごと動かそうとすると自分自身と入れ替えることになり、範囲が重なる。
    // **壊すよりは今までどおりのほうがまし**として素の入れ替えに落とす。
    var d = ['flowchart TD', '    ' + PC + ' 印', '    B["処理"]'].join(NL);
    expect(TU.swapLinesWithNotes(d, 3, 2)).toBe(TU.swapLines(d, 3, 2));
  });

  test('説明が無ければ swapLinesWithNotes は swapLines と同じ', function() {
    var d = ['flowchart TD', '    A["開始"]', '    B["処理"]'].join(NL);
    expect(TU.swapLinesWithNotes(d, 2, 3)).toBe(TU.swapLines(d, 2, 3));
  });
});
