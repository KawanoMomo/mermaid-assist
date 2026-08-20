'use strict';
// flowchart の削除。ユニットテストが1件も無かった。
//
// mermaid の flowchart は「エッジ行の中でノードを宣言する」のが標準形:
//
//     flowchart TD
//         A[開始] --> B[処理]
//         B --> C[判定]
//
// ノードの line はその宣言が現れた行になるので、A も B も line=2 を指す。
// deleteNode は行ごと消していたため、B の ✕ を押すと
//   - A が図から消える (ユーザは頼んでいない)
//   - B は残るがラベルを失い「処理」ではなく「B」になる
//   - A→B のエッジが消える
// という結果になっていた。押した要素も、約束した結果も出ていない。
// 件数の警告表示も無いので、消える前に気づく手がかりが無い。

var F = window.MA.modules.flowchart;

function idsAndLabels(text) {
  return F.parseFlowchart(text).elements.map(function(n) { return n.id + ':' + n.label; });
}
function edges(text) {
  return F.parseFlowchart(text).relations.map(function(e) { return e.from + '->' + e.to; });
}

describe('flowchart: ノード削除', function() {
  var src = 'flowchart TD\n    A[開始] --> B[処理]\n    B --> C[判定]\n    C --> D[終了]\n';

  test('FD-1: 指定したノードだけが消える', function() {
    var out = F.deleteNode(src, 2, 'B');
    expect(idsAndLabels(out)).toEqual(['A:開始', 'C:判定', 'D:終了']);
  });

  test('FD-2: 同じ行で宣言された別ノードのラベルが失われない', function() {
    var out = F.deleteNode(src, 2, 'B');
    expect(out).toContain('A[開始]');
  });

  test('FD-3: 削除したノードに繋がるエッジだけが消える', function() {
    var out = F.deleteNode(src, 2, 'B');
    expect(edges(out)).toEqual(['C->D']);
  });

  test('FD-4: 行頭のノードを消しても後続ノードが残る', function() {
    var out = F.deleteNode(src, 2, 'A');
    expect(idsAndLabels(out)).toEqual(['B:処理', 'C:判定', 'D:終了']);
    expect(edges(out)).toEqual(['B->C', 'C->D']);
  });

  test('FD-5: 単独宣言行のノードは行ごと消える', function() {
    var t = 'flowchart TD\n    A[開始]\n    B[処理]\n    A --> B\n';
    var out = F.deleteNode(t, 2, 'A');
    expect(idsAndLabels(out)).toEqual(['B:処理']);
    expect(edges(out)).toEqual([]);
  });

  test('FD-6: 前方一致する別ノードを巻き込まない', function() {
    var t = 'flowchart TD\n    A[a] --> AB[ab]\n    AB --> ABC[abc]\n';
    var out = F.deleteNode(t, 2, 'A');
    expect(idsAndLabels(out)).toEqual(['AB:ab', 'ABC:abc']);
  });

  test('FD-6b: 単独宣言行でも前方一致で巻き込まない', function() {
    // FD-6 はエッジ行だけを見ているので、単独宣言行の判定を前方一致に緩めても
    // 落ちなかった。宣言行だけの図で同じことを確かめる
    var t = 'flowchart TD\n    A[a]\n    AB[ab]\n    ABC[abc]\n';
    var out = F.deleteNode(t, 2, 'A');
    expect(idsAndLabels(out)).toEqual(['AB:ab', 'ABC:abc']);
  });

  test('FD-8: 同じノードが2本のエッジで宣言されていても宣言は1行だけ復元する', function() {
    // 復元をそのまま出すと A[a] が2行できる。mermaid は通すが、削除が
    // 触っていない行を増やして差分を汚す
    var t = 'flowchart TD\n    A[a] --> B[b]\n    A[a] --> C[c]\n';
    var out = F.deleteNode(t, 2, 'B');
    expect(out.split('\n').filter(function(l) { return l.trim() === 'A[a]'; }).length).toBe(0);
    expect(idsAndLabels(out)).toEqual(['A:a', 'C:c']);
  });

  test('FD-8b: 往復するエッジを消しても宣言は1本だけ復元される', function() {
    // 2本のエッジがどちらも B[b] を宣言しているので、素朴に復元すると
    // B[b] が2行できる。生き残った行に宣言が無いケースなので、
    // 「他所に宣言があるか」だけを見ていると防げない
    var t = 'flowchart TD\n    A[a] --> B[b]\n    B[b] --> A[a]\n';
    var out = F.deleteNode(t, 2, 'A');
    expect(out.split('\n').filter(function(l) { return l.trim() === 'B[b]'; }).length).toBe(1);
    expect(idsAndLabels(out)).toEqual(['B:b']);
  });

  test('FD-9: 残る宣言が無いノードは宣言行が1本だけ復元される', function() {
    var t = 'flowchart TD\n    A[a] --> B[b]\n    A --> C[c]\n    A --> D[d]\n';
    var out = F.deleteNode(t, 2, 'A');
    expect(idsAndLabels(out)).toEqual(['B:b', 'C:c', 'D:d']);
    expect(out.split('\n').filter(function(l) { return l.trim() === 'B[b]'; }).length).toBe(1);
  });

  test('FD-7: class / style / click の参照も外れる', function() {
    var t = 'flowchart TD\n    A[a] --> B[b]\n    class A,B hot\n    style A fill:#f00\n';
    var out = F.deleteNode(t, 2, 'A');
    expect(out).not.toContain('style A');
    expect(out).toContain('class B hot');
  });
});

describe('flowchart: エッジ削除', function() {
  var src = 'flowchart TD\n    A[開始] --> B[処理]\n    B --> C[判定]\n';

  test('FE-1: エッジを消してもノードのラベルが残る', function() {
    var out = F.deleteEdge(src, 2);
    expect(idsAndLabels(out)).toEqual(['A:開始', 'B:処理', 'C:判定']);
    expect(edges(out)).toEqual(['B->C']);
  });

  test('FE-2: 宣言を持たない側は余計な行を増やさない', function() {
    var t = 'flowchart TD\n    A[開始]\n    B[処理]\n    A --> B\n';
    var out = F.deleteEdge(t, 4);
    expect(out).toBe('flowchart TD\n    A[開始]\n    B[処理]\n');
  });
});

describe('flowchart: 削除の影響件数', function() {
  var src = 'flowchart TD\n    A[開始] --> B[処理]\n    B --> C[判定]\n    C --> D[終了]\n';

  test('FI-1: ノード削除の影響を数えられる', function() {
    var el = F.parseFlowchart(src).elements.filter(function(n) { return n.id === 'B'; })[0];
    var impact = F.deletionImpact(src, el);
    expect(impact.elements).toBe(1);
    expect(impact.relations).toBe(2);
  });

  test('FI-2: 依存の無いノードは 1 要素 0 エッジ', function() {
    var t = 'flowchart TD\n    A[開始]\n    B[処理]\n';
    var el = F.parseFlowchart(t).elements.filter(function(n) { return n.id === 'A'; })[0];
    var impact = F.deletionImpact(t, el);
    expect(impact.elements).toBe(1);
    expect(impact.relations).toBe(0);
  });

  test('FI-3: サブグラフは中身とその外部エッジまで数える', function() {
    var t = 'flowchart TD\n    subgraph G[群]\n    X[x]\n    Y[y]\n    end\n    X --> Z[z]\n';
    var sg = F.parseFlowchart(t).groups.filter(function(g) { return g.kind === 'subgraph'; })[0];
    var impact = F.deletionImpact(t, sg);
    // X と Y が消え、Z は残る。X --> Z のエッジも道連れになる
    expect(impact.elements).toBe(2);
    expect(impact.relations).toBe(1);
  });
});

describe('flowchart: サブグラフ削除', function() {
  // 中身ごと消すので、外に伸びていたエッジも道連れになる。放置すると mermaid が
  // 消したはずのメンバーをラベル無しのノードとして描き直すので、
  // 「箱とラベルだけ消えて幽霊が残る」状態になっていた。
  var src = 'flowchart TD\n    subgraph G[群]\n    X[x]\n    Y[y]\n    end\n    X --> Z[z]\n';

  test('FS-1: メンバーが幽霊として残らない', function() {
    expect(idsAndLabels(F.deleteSubgraph(src, 2, 5))).toEqual(['Z:z']);
  });

  test('FS-2: 外側のノードはラベルを保つ', function() {
    expect(F.deleteSubgraph(src, 2, 5)).toContain('Z[z]');
  });

  test('FS-3: 宙に浮くエッジが残らない', function() {
    expect(edges(F.deleteSubgraph(src, 2, 5))).toEqual([]);
  });

  test('FS-4: 無関係なノードとエッジは触らない', function() {
    var t = 'flowchart TD\n    subgraph G[群]\n    X[x]\n    end\n    P[p] --> Q[q]\n';
    var out = F.deleteSubgraph(t, 2, 4);
    expect(idsAndLabels(out)).toEqual(['P:p', 'Q:q']);
    expect(edges(out)).toEqual(['P->Q']);
  });
});
