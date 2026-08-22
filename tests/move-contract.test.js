'use strict';
// 並べ替えの契約。
//
// `operations.moveUp` / `moveDown` は素の行入れ替えを呼んでいた。
// 行番号が1より大きいことしか見ていないので、**先頭の要素を上へ動かすと
// 図の宣言行と入れ替わって図が消える**。実測 (mermaid v11.13):
//
//   flowchart TD                     A[Start] --> B{Decision}
//       A[Start] --> B{Decision}  →  flowchart TD
//   → No diagram type detected
//
// パネルの経路 (flowchart の _moveNodeStep) は入れ替え先が動かせる行かを
// 見ていたので壊れない。**UI だけ動いて契約が壊れている形の15例目。**
//
// 実描画の網は r24 が持つ。ここでは「宣言行を巻き込まない」ことだけを
// 全図種で押さえる (実描画を待たずに落ちるように)。

var M = window.MA.modules;
var NL = String.fromCharCode(10);

describe('並べ替え: 図の宣言行を巻き込まない', function() {
  Object.keys(M).forEach(function(key) {
    var mod = M[key];
    if (!mod || !mod.template || !mod.parse || !mod.operations) return;
    if (typeof mod.operations.moveUp !== 'function') return;

    test(key + ': 先頭の要素を上へ動かしても1行目が変わらない', function() {
      var t = mod.template();
      var els = [];
      try { els = mod.parse(t).elements || []; } catch (e) { els = []; }
      if (!els.length) return;
      var head = t.split(NL)[0];
      var first = els.slice().sort(function(a, b) { return a.line - b.line; })[0];
      var out = mod.operations.moveUp(t, first.line, { kind: first.kind, id: first.id });
      expect(out.split(NL)[0]).toBe(head);
    });

    test(key + ': 末尾の要素を下へ動かしても1行目が変わらない', function() {
      var t = mod.template();
      var els = [];
      try { els = mod.parse(t).elements || []; } catch (e) { els = []; }
      if (!els.length) return;
      var head = t.split(NL)[0];
      var last = els.slice().sort(function(a, b) { return a.line - b.line; })[els.length - 1];
      var out = mod.operations.moveDown(t, last.line, { kind: last.kind, id: last.id });
      expect(out.split(NL)[0]).toBe(head);
    });
  });
});

describe('並べ替え: 要素の数を変えない', function() {
  Object.keys(M).forEach(function(key) {
    var mod = M[key];
    if (!mod || !mod.template || !mod.parse || !mod.operations) return;
    if (typeof mod.operations.moveDown !== 'function') return;

    test(key + ': 動かしても要素数が同じ', function() {
      var t = mod.template();
      var els = [];
      try { els = mod.parse(t).elements || []; } catch (e) { els = []; }
      if (els.length < 2) return;
      var sorted = els.slice().sort(function(a, b) { return a.line - b.line; });
      var e = sorted[0];
      var out = mod.operations.moveDown(t, e.line, { kind: e.kind, id: e.id });
      var after = [];
      try { after = mod.parse(out).elements || []; } catch (err) { after = []; }
      expect(after.length).toBe(els.length);
    });
  });
});
