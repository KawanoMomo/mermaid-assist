'use strict';
// 契約の kind の名前ずれ (G4)。
//
// `parse` が返す `element.kind` を、そのまま `operations.add` に渡せること。
// 一覧に出ている種類で足せないと、契約経由の呼び出しが**黙って空振り**する。
//
// 実測で見つかったずれ:
//   mindmap     一覧は 'node' / 追加は 'child' と 'sibling'
//   sankeyBeta  一覧は 'node' / 追加は 'flow'
//
// r8 が文書を育てるために契約経由で add を呼ぶようになって表面化した。
// それまでは app.js が各図種のパネルから直接呼んでいたので、誰も踏まなかった。
// 既存の呼び出しは変えず、一覧の kind を別名として受けるようにした。

var M = window.MA.modules;

describe('operations.add は parse が返す kind を受ける', function() {
  Object.keys(M).forEach(function(key) {
    var mod = M[key];
    if (!mod || !mod.template || !mod.parse || !mod.operations) return;
    if (typeof mod.operations.add !== 'function') return;

    test(key + ': 一覧に出ている種類で足せる', function() {
      var t = mod.template();
      var els = [];
      try { els = mod.parse(t).elements || []; } catch (e) { els = []; }
      if (!els.length) return;
      var kinds = [];
      els.forEach(function(e) { if (kinds.indexOf(e.kind) < 0) kinds.push(e.kind); });
      var ends = els.map(function(e) { return e.name || e.id || e.label; }).filter(Boolean);
      var grew = false;
      kinds.forEach(function(kind) {
        if (grew) return;
        // 半角にする。radar / architecture は識別子に日本語を受け付けない
        // (mermaid 側の制限。r23 が毎回実測して区別している)。
        // ここで見たいのは kind の名前が通るかであって、日本語ではない。
        var nm = 'zzAdded';
        var props = { name: nm, label: nm, text: nm, id: nm, title: nm, kind: kind,
          from: ends[0], to: ends[1] || ends[0], target: ends[0], reltype: 'satisfies',
          section: ends[0], column: ends[0], period: nm, event: nm, icon: 'server',
          score: 3, reqType: 'requirement', value: 1, values: [1, 2, 3],
          x: 0.5, y: 0.5, startBit: 0, endBit: 0 };
        var out;
        try { out = mod.operations.add(t, kind, props); } catch (e) { return; }
        if (typeof out !== 'string' || out === t) return;
        var after = [];
        try { after = mod.parse(out).elements || []; } catch (e) { after = []; }
        if (after.length > els.length) grew = true;
      });
      // 一覧に出ている種類のうち、少なくとも1つで足せること
      expect(grew).toBe(true);
    });
  });
});
