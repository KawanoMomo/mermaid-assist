'use strict';
// architecture のラベルに日本語を入れる。
//
// 見送り欄 (E7) にはこう書いてあった。
//
//   > architecture の日本語ラベル / sequence 別名の `;`
//   > mermaid v11.13 の制約。**引用囲みも効かないことを実測済み**
//
// **記録の方が誤っていた。** 実測すると引用符で通る:
//
//   service a(server)["設計"]  → 「設計」を描画 (v11.13)
//
// architecture-beta は組込みのシステム構成図そのもので、日本語が書けないのは
// 実務上大きな制約だった。「直せない制限」として2ラウンド放置していた。
//
// sequence の別名の `;` は記録どおり引用符でも通らない (こちらは訂正なし)。

var A = window.MA.modules.architectureBeta;

describe('architectureBeta: 日本語ラベル', function() {
  var t = A.template();
  function firstEl() { return A.parse(t).elements[0]; }

  test('AL-1: 日本語ラベルに引用符が付く', function() {
    var el = firstEl();
    var out = A.operations.update(t, el.line, 'label', '設計対象', { kind: el.kind, id: el.id });
    expect(out).toContain('["設計対象"]');
  });

  test('AL-2: 読み直すと引用符が外れる (入れた文字と一致する)', function() {
    var el = firstEl();
    var out = A.operations.update(t, el.line, 'label', '設計対象', { kind: el.kind, id: el.id });
    var after = A.parse(out).elements.filter(function(e) { return e.id === el.id; })[0];
    expect(after.label).toBe('設計対象');
  });

  test('AL-3: 半角英数字だけのラベルには引用符を付けない', function() {
    var el = firstEl();
    var out = A.operations.update(t, el.line, 'label', 'API GW', { kind: el.kind, id: el.id });
    expect(out).toContain('[API GW]');
    expect(out).not.toContain('["API GW"]');
  });

  test('AL-4: 既に引用符付きの値を二重に囲まない', function() {
    var el = firstEl();
    var out = A.operations.update(t, el.line, 'label', '"既に囲み"', { kind: el.kind, id: el.id });
    expect(out).not.toContain('""既に囲み""');
  });

  test('AL-5: 追加時も引用符が付く', function() {
    var out = A.addService(t, 'sensor', 'server', 'センサ入力', '');
    expect(out).toContain('["センサ入力"]');
    expect(A.parse(out).elements.filter(function(e) { return e.id === 'sensor'; })[0].label)
      .toBe('センサ入力');
  });

  test('AL-6: ひな形の解釈は変わらない', function() {
    var labels = A.parse(t).elements.map(function(e) { return e.label; });
    expect(labels).toContain('Storage');
    expect(labels).toContain('Server');
  });
});

describe('診断: architecture のラベル', function() {
  var D = window.MA.diagnose;

  test('AL-7: 引用符なしの日本語は「引用符で囲って」と言う', function() {
    var msg = D.diagnose('architecture-beta\n  service a(server)[設計]\n', new Error('x'));
    expect(msg).toContain('引用符で囲って');
  });

  test('AL-8: 引用符付きなら何も言わない', function() {
    expect(D.diagnose('architecture-beta\n  service a(server)["設計"]\n', new Error('x'))).toBe('');
  });

  test('AL-9: " を含むラベルは表せないと言う', function() {
    // architecture は &quot; を文字どおり描くので、逃がしても直らない。
    // 本文に &quot; が居る = こちらが逃がした印。
    var msg = D.diagnose('architecture-beta\n  service a(server)["&quot;引用&quot;付き"]\n', null);
    expect(msg).toContain('" を含められません');
  });
});
