'use strict';
// 他セッションのレビュー (critic-master / critic-ux / probe-*) が挙げた指摘のうち、
// 現在のコードで**まだ生きている**ことを実測で確認したものを固定する。
//
// 指摘は commit e14dac7 に対するもので、その後の作業で解消したものも多い。
// 解消済みを直したことにしないため、1件ずつ再現を取ってから起票した。

var K = window.MA.modules.kanban;
var B = window.MA.modules.blockBeta;
var F = window.MA.modules.flowchart;
var C = window.MA.modules.c4;

describe('kanban: 同名カラムへのカード追加', function() {
  // probe-update の指摘。addCard がカラムを**ラベル文字列の一致**で探すので、
  // 同名カラムが2つあると常に先頭側へ入る。利用者が2つ目を選んでも、
  // 選んだカラムにはカードが増えない (無言の誤操作)。
  var src = 'kanban\n    Todo\n        [Task A]\n    Done\n        [Task B]\n    Todo\n        [Task C]\n';

  test('PR-1: 行を指定すると、その行のカラムに入る', function() {
    var out = K.addCard(src, 'Todo', 'New Card', '', 6);
    var lines = out.split('\n');
    var added = -1;
    for (var i = 0; i < lines.length; i++) if (lines[i].indexOf('New Card') >= 0) added = i;
    // 6行目 (index 5) の Todo 配下 = Task C の直後
    expect(added).toBeGreaterThan(5);
  });

  test('PR-2: 行を渡さない旧来の呼び方は先頭一致のまま (後方互換)', function() {
    var out = K.addCard(src, 'Todo', 'New Card', '');
    expect(out.indexOf('New Card')).toBeGreaterThan(0);
  });
});

describe('block: 装飾行を要素として拾わない', function() {
  // critic-ux UI-005。style / classDef / class / click は mermaid の装飾行で、
  // ブロックではない。一覧に出ると ✕ で装飾が消え、リンクの端点候補にも
  // `fill` や `f9f` が並ぶ。既存の .mmd を GUI で開いた瞬間に起きる。
  test('PR-3: style 行がブロック一覧に出ない', function() {
    var t = 'block-beta\n  columns 2\n  a["A"]\n  b["B"]\n  a --> b\n  style a fill:#f9f\n';
    var ids = B.parse(t).elements.map(function(e) { return e.id; });
    expect(ids).toEqual(['a', 'b']);
  });

  test('PR-4: classDef / class / click も同様', function() {
    var t = 'block-beta\n  columns 2\n  a["A"]\n  classDef hot fill:#f00\n  class a hot\n  click a callback\n';
    var ids = B.parse(t).elements.map(function(e) { return e.id; });
    expect(ids).toEqual(['a']);
  });

  test('PR-5: 装飾行は本文に残る (消さない)', function() {
    var t = 'block-beta\n  columns 2\n  a["A"]\n  style a fill:#f9f\n';
    var el = B.parse(t).elements[0];
    var out = B.deleteBlock(t, el.line, el.id);
    expect(out).toContain('style a fill:#f9f');
  });

  test('PR-6: 菱形 {"..."} が2つに割れない', function() {
    var t = 'block-beta\n  columns 3\n  a["Sensor"]\n  c{"Actuator"}\n  a --> c\n';
    var ids = B.parse(t).elements.map(function(e) { return e.id; });
    expect(ids).toEqual(['a', 'c']);
  });
});

describe('flowchart: エッジ記法の網羅', function() {
  // critic-master m-3。`o--o` `x--x` `<-->` を知らないので、`A o--o B` の
  // 左辺を `A o` という**存在しないノード**として拾っていた。
  test('PR-7: o--o が幽霊ノードを作らない', function() {
    var t = 'flowchart TD\n    A[Start]\n    A o--o B\n    C[Z]\n';
    var ids = F.parse(t).elements.map(function(e) { return e.id; });
    expect(ids).toEqual(['A', 'B', 'C']);
  });

  test('PR-8: x--x / <--> も同じ', function() {
    var ids1 = F.parse('flowchart TD\n    A x--x B\n').elements.map(function(e) { return e.id; });
    expect(ids1).toEqual(['A', 'B']);
    var ids2 = F.parse('flowchart TD\n    A <--> B\n').elements.map(function(e) { return e.id; });
    expect(ids2).toEqual(['A', 'B']);
  });
});

describe('flowchart: ノードの上下移動', function() {
  // critic-master m-2。直上がエッジ行だと `_isNodeLine` が false になり、
  // 移動が無言で空振りする。flowchart で最も普通の書き方 (ノードをエッジ行に
  // インラインで書く) がそれに当たるので、↑ が常に死ぬ。
  var src = 'flowchart TD\n    A[Start] --> B[Mid]\n    C[Other]\n    D[Last]\n';

  test('PR-9: 直上がエッジ行でも上へ動く', function() {
    var C2 = F.parse(src).elements.filter(function(e) { return e.id === 'C'; })[0];
    var out = F.moveNodeUp(src, C2.line);
    expect(out).not.toBe(src);
    var lines = out.split('\n');
    expect(lines[1].trim()).toBe('C[Other]');
  });

  test('PR-10: 動かしても要素の集合は変わらない', function() {
    var before = F.parse(src).elements.map(function(e) { return e.id; }).sort().join(',');
    var C2 = F.parse(src).elements.filter(function(e) { return e.id === 'C'; })[0];
    var after = F.parse(F.moveNodeUp(src, C2.line)).elements.map(function(e) { return e.id; }).sort().join(',');
    expect(after).toBe(before);
  });

  test('PR-11: 先頭にいるノードを上へ動かしても壊れない', function() {
    var t = 'flowchart TD\n    A[Start]\n    B[Next]\n';
    var A = F.parse(t).elements[0];
    expect(F.moveNodeUp(t, A.line)).toBe(t);
  });
});

describe('CRLF 文書への挿入', function() {
  // critic-master m-6。CRLF の文書に挿入した行だけ \r を持たない。
  // mermaid は通るが、ファイルに書き出すと diff にノイズが乗る。
  test('PR-12: c4 の追加で改行コードが混ざらない', function() {
    var crlf = ['C4Context', '    title T', '    Person(u, "U")'].join('\r\n');
    var out = C.addElement(crlf, 'System', 's', 'S');
    // \r を伴わない \n が無いこと
    expect(/[^\r]\n/.test(out)).toBe(false);
  });

  test('PR-13: LF 文書は LF のまま', function() {
    var lf = ['C4Context', '    title T', '    Person(u, "U")'].join('\n');
    var out = C.addElement(lf, 'System', 's', 'S');
    expect(out.indexOf('\r')).toBe(-1);
  });
});
