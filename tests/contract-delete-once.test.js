'use strict';
// 契約の削除は「押した要素と、それだけのために存在していたもの」を**1回で**消す。
//
// r2 (削除検査) には逃げ道が2つあった。
//   `&& !lineGone`      … 何かの行が消えていれば見逃す
//   `&& !stillReferenced` … 名前が本文のどこかに残っていれば見逃す
// どちらも「導出される要素 (sankey のノード) で誤検出を出さないため」に付けた
// ものだったが、**どの行が消えたかを問わない**ので、間違った行を消しても通った。
//
// 実際 erDiagram はエンティティを押すと関係行だけが消え、本体のブロックが残る。
// mermaid は参照だけで要素を作るので、一覧から消えても図には残る。
// それでも r2 は 21/21 で「指摘0件」を報告していた。
//
// 述語を「1回で消えること」に変えたら、class / er / sankey で本物が出た。

var M = window.MA.modules;

function deleteOnce(mod, id) {
  var t = mod.template();
  var el = (mod.parse(t).elements || []).filter(function(e) { return e.id === id; })[0];
  if (!el) throw new Error('要素が見つからない: ' + id);
  return mod.operations['delete'](t, el.line, { kind: el.kind, id: el.id });
}

describe('erDiagram: エンティティは1回で消える', function() {
  test('DO-1: 宣言ブロックが残らない', function() {
    var out = deleteOnce(M.erDiagram, 'CUSTOMER');
    expect(M.erDiagram.parse(out).elements.map(function(e) { return e.id; })).not.toContain('CUSTOMER');
    expect(out).not.toContain('CUSTOMER');
  });

  test('DO-2: 関係行も落ちる', function() {
    var out = deleteOnce(M.erDiagram, 'CUSTOMER');
    expect(out).not.toContain('||--o{');
  });

  test('DO-3: 巻き添えを出さない', function() {
    var out = deleteOnce(M.erDiagram, 'CUSTOMER');
    expect(M.erDiagram.parse(out).elements.map(function(e) { return e.id; })).toContain('ORDER');
  });
});

describe('classDiagram: クラスは1回で消える', function() {
  test('DO-4: 宣言ブロックが残らない', function() {
    var out = deleteOnce(M.classDiagram, 'Animal');
    expect(M.classDiagram.parse(out).elements.map(function(e) { return e.id; })).not.toContain('Animal');
  });

  test('DO-5: 巻き添えを出さない', function() {
    var out = deleteOnce(M.classDiagram, 'Dog');
    expect(M.classDiagram.parse(out).elements.map(function(e) { return e.id; })).toContain('Animal');
  });
});

describe('sankeyBeta: ノードは1回で消える', function() {
  // sankey のノードは宣言されない。流れの両端から導出される。
  // そのため「ノードの行」を1本消しても、他の流れがまだ名前を挙げていれば残る。
  // flowchart がノードと一緒にエッジを落とすのと同じ約束にした。
  test('DO-6: そのノードを端点に持つ流れがすべて落ちる', function() {
    var out = deleteOnce(M.sankeyBeta, 'Product_A');
    var r = M.sankeyBeta.parse(out);
    expect(r.elements.map(function(e) { return e.id; })).not.toContain('Product_A');
    expect(r.relations.filter(function(f) {
      return f.from === 'Product_A' || f.to === 'Product_A';
    }).length).toBe(0);
  });

  test('DO-7: 無関係な流れは残る', function() {
    var t = M.sankeyBeta.template();
    var beforeRel = M.sankeyBeta.parse(t).relations.length;
    var out = deleteOnce(M.sankeyBeta, 'Product_A');
    var afterRel = M.sankeyBeta.parse(out).relations.length;
    expect(afterRel).toBeGreaterThan(0);
    expect(afterRel).toBeLessThan(beforeRel);
  });

  test('DO-8: 流れの削除は今までどおり1行だけ消す', function() {
    var t = M.sankeyBeta.template();
    var f0 = M.sankeyBeta.parse(t).relations[0];
    var out = M.sankeyBeta.operations['delete'](t, f0.line, { kind: 'flow', id: f0.id });
    expect(out.split('\n').length).toBe(t.split('\n').length - 1);
  });
});

describe('横断: 同定できる要素は契約の削除1回で消える', function() {
  // 「1回で消える」を全図種で押さえる。同定できない要素 (gitGraph の無名コミット、
  // timeline の period のように id も name も label も text も無いもの) は
  // 残存を判定できないので対象外。除外したことは r2 が件数で出す。
  Object.keys(M).forEach(function(key) {
    var mod = M[key];
    if (!mod || !mod.template || !mod.parse || !mod.operations) return;
    if (typeof mod.operations['delete'] !== 'function') return;

    test(key + ': 1回で消える', function() {
      var t = mod.template();
      var els = mod.parse(t).elements || [];
      els.forEach(function(el) {
        var ident = el.label || el.name || el.text ||
          (el.id && String(el.id).indexOf('__') !== 0 ? el.id : null);
        if (!ident) return;   // 同定できない要素は対象外
        var out;
        try {
          out = mod.operations['delete'](t, el.line, { kind: el.kind, id: el.id, blockId: el.id });
        } catch (e) { return; }
        if (!out || out === t) return;   // 削除対象外の行
        var after = mod.parse(out).elements || [];
        var same = after.filter(function(e2) {
          return (e2.label || e2.name || e2.text || e2.id) === ident;
        });
        expect(same.length).toBeLessThan(
          els.filter(function(e2) { return (e2.label || e2.name || e2.text || e2.id) === ident; }).length);
      });
    });
  });
});
