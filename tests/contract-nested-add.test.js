'use strict';
// A115: 入れ子への追加が、契約経路だけ落ちていた / 字下げが文書に従わなかった。
//
// c4 の `operations.add` は `addElement` を**引数1つ足りない**形で呼んでいて、
// `parentId` が常に undefined だった。UI パネル (c4-add-btn) は parent を
// 渡しているので画面からは正しく入る。契約どおり呼ぶと**黙ってトップレベル**に
// 出る。「UI 経路だけ実装して契約経路を忘れる」型の17例目。
//
// あわせて、入れ子の字下げが**固定幅**で、文書の流儀を見ていなかった。
// 実測 (直す前 / 後): 既存の子が 8 の文書に、c4 は 4 / block は 2 で足していた。
//   c4    8 → 4  (-4)   →  8
//   block 8 → 2  (-6)   →  8
// 図は描けるが、Git 差分では隣と揃っていない行がそのまま見える。
var M = window.MA.modules;
var NL = String.fromCharCode(10);

function indentOf(line) {
  return line.length - line.replace(/^[ \t]*/, '').length;
}

// 子の字下げ幅を変えた文書を作る。pad=2 と pad=4 で、実装が固定値を
// 使っていれば必ずどちらかで揃わなくなる。
function nestedDocs(pad) {
  var p = new Array(pad + 1).join(' ');
  var q = new Array(pad * 2 + 1).join(' ');
  return {
    c4: {
      text: ['C4Context', p + 'Enterprise_Boundary(B1, "B1") {',
        q + 'Person(u, "U", "d")', p + '}'].join(NL),
      kind: 'Person',
      props: { id: 'NEW', label: 'NEW', parentId: 'B1' },
      childIndent: pad * 2,
    },
    blockBeta: {
      text: ['block-beta', p + 'block:G1', q + 'a["A"]', p + 'end'].join(NL),
      kind: 'nested',
      props: { id: 'NEW', label: 'NEW', parentId: 'G1' },
      childIndent: pad * 2,
    },
  };
}

describe('入れ子への追加は契約経路でも効き、文書の字下げに従う', function() {
  [2, 4].forEach(function(pad) {
    var D = nestedDocs(pad);
    Object.keys(D).forEach(function(key) {
      var mod = M[key];
      if (!mod || !mod.operations || typeof mod.operations.add !== 'function') return;
      var d = D[key];

      test(key + ': 字下げ幅' + pad + ' の文書で、親の中に入る', function() {
        var out = mod.operations.add(d.text, d.kind, d.props);
        expect(typeof out).toBe('string');
        expect(out).not.toBe(d.text);
        var after = out.split(NL);
        // 足した行を探す
        var added = null;
        for (var i = 0; i < after.length; i++) {
          if (after[i].indexOf('NEW') >= 0) { added = after[i]; break; }
        }
        expect(added).not.toBe(null);
        // 親の閉じより前 = 中に入っている。閉じ行の位置で見る。
        var closeIdx = -1;
        for (var j = 0; j < after.length; j++) {
          var t = after[j].trim();
          if (t === '}' || t === 'end') { closeIdx = j; break; }
        }
        var addedIdx = after.indexOf(added);
        expect(closeIdx).toBeGreaterThan(-1);
        expect(addedIdx).toBeLessThan(closeIdx);
      });

      test(key + ': 字下げ幅' + pad + ' の文書で、既存の子と揃う', function() {
        var out = mod.operations.add(d.text, d.kind, d.props);
        var after = out.split(NL);
        var added = null;
        for (var i = 0; i < after.length; i++) {
          if (after[i].indexOf('NEW') >= 0) { added = after[i]; break; }
        }
        expect(added).not.toBe(null);
        expect(indentOf(added)).toBe(d.childIndent);
      });
    });
  });
});
