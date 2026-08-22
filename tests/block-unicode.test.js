'use strict';
// block-beta の日本語ブロック id。
//
// mermaid は日本語の id を受け付けて正しく描く
// (v11.13 実測: `受信["受信部"]` で図形11個・文字も出る)。
// ところが parser は `[A-Za-z_]` 始まりでしか拾っていなかったので、
// **要素が1件も出ず、一覧も重ね合わせも空になっていた**。
//
// erDiagram (A59) / sequence (A80) と同じ「述語の非対称」で3例目。
//
// 見つけ方が今までと違う。C 区分 (検証の仕組み) の再検証で
// 「r16 は片方向しか見ていない」と分かり、逆向き
// (図にあるのにパネルに無い) を r16 に足したら出た。
// 記録には「逆は r2 / r11 が個別に見ている」とあったが、A59 も A80 も
// 手作業で見つけており、**その記録が誤りだった**。

var B = window.MA.modules.blockBeta;

describe('blockBeta: 日本語のブロック id', function() {
  var jp = 'block-beta\n  columns 3\n  受信["受信部"] 判定["判定部"] 保存["保存部"]\n  受信 --> 判定\n';

  test('BU-1: 日本語 id のブロックが一覧に出る', function() {
    expect(B.parse(jp).elements.map(function(e) { return e.id; }))
      .toEqual(['受信', '判定', '保存']);
  });

  test('BU-2: ラベルを取り違えない', function() {
    var by = {};
    B.parse(jp).elements.forEach(function(e) { by[e.id] = e.label; });
    expect(by['受信']).toBe('受信部');
    expect(by['保存']).toBe('保存部');
  });

  test('BU-3: リンクの両端も日本語で拾える', function() {
    var rels = B.parse(jp).relations || [];
    expect(rels.length).toBe(1);
    expect(rels[0].from).toBe('受信');
    expect(rels[0].to).toBe('判定');
  });

  test('BU-4: ひな形 (英数字) の解釈は変わらない', function() {
    expect(B.parse(B.template()).elements.map(function(e) { return e.id; }))
      .toEqual(['a', 'b', 'c']);
  });

  test('BU-5: 装飾行を幽霊ブロックにしない (A34 の挙動を維持)', function() {
    var t = 'block-beta\n  columns 2\n  a["A"] b["B"]\n  style a fill:#f00\n' +
            '  classDef x fill:#0f0\n  click a "http://x"\n';
    expect(B.parse(t).elements.map(function(e) { return e.id; })).toEqual(['a', 'b']);
  });

  test('BU-6: 菱形と六角を2つに割らない (A35 の挙動を維持)', function() {
    var t = 'block-beta\n  columns 2\n  c{"判定"} d{{"六角"}}\n';
    expect(B.parse(t).elements.map(function(e) { return e.id; })).toEqual(['c', 'd']);
  });

  test('BU-7: 日本語 id を消しても他が巻き添えにならない', function() {
    var el = B.parse(jp).elements.filter(function(e) { return e.id === '判定'; })[0];
    var out = B.operations['delete'](jp, el.line, { kind: el.kind, id: '判定' });
    var ids = B.parse(out).elements.map(function(e) { return e.id; });
    expect(ids).not.toContain('判定');
    expect(ids).toContain('受信');
    expect(ids).toContain('保存');
  });
});
