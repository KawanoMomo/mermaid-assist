'use strict';
// ER 図の日本語エンティティ名。
//
// 実測 (mermaid v11.13): 次の図は mermaid が正しく描く。
//
//     erDiagram
//         顧客 ||--o{ 注文 : places
//
// ところがこちらの parser はエンティティ名を `[A-Za-z_][A-Za-z0-9_-]*` で拾って
// いたので、**要素を1件も返さなかった**。図はプレビューに出ているのに、一覧は空、
// 重ね合わせも出ず、クリックしても何も選べない。日本語で設計書を書く人にとっては
// 「このツールは自分の図に反応しない」という壊れ方になる。
//
// r16 (件数の一致) は英数字のテンプレートしか流していなかったので気付けず、
// r11 (特殊文字) は描画だけを見て一覧に残るかを見ていなかった。
// mermaid が真とするものをこちらが偽としている「述語の非対称」。

var E = window.MA.modules.erDiagram;

describe('erDiagram: 日本語・引用符付きのエンティティ名', function() {
  test('EU-1: 日本語のエンティティが一覧に出る', function() {
    var t = 'erDiagram\n    顧客 ||--o{ 注文 : places\n    顧客 {\n        string name\n    }\n';
    var ids = E.parse(t).elements.map(function(e) { return e.id; });
    expect(ids).toContain('顧客');
    expect(ids).toContain('注文');
  });

  test('EU-2: 日本語でも関係が拾える', function() {
    var t = 'erDiagram\n    顧客 ||--o{ 注文 : places\n';
    var rels = E.parse(t).relations;
    expect(rels.length).toBe(1);
    expect(rels[0].from).toBe('顧客');
    expect(rels[0].to).toBe('注文');
  });

  test('EU-3: 引用符付きの名前は引用符を外して持つ', function() {
    var t = 'erDiagram\n    "設計(詳細)" ||--o{ ORDER : places\n    "設計(詳細)" {\n        string name\n    }\n';
    var ids = E.parse(t).elements.map(function(e) { return e.id; });
    expect(ids).toContain('設計(詳細)');
  });

  test('EU-4: ハイフン入りの名前も拾う', function() {
    var t = 'erDiagram\n    モジュール-1 ||--o{ ORDER : places\n';
    expect(E.parse(t).elements.map(function(e) { return e.id; })).toContain('モジュール-1');
  });

  test('EU-5: 既存の英数字テンプレートは今までどおり', function() {
    var r = E.parse(E.template());
    expect(r.elements.map(function(e) { return e.id; }).sort()).toEqual(['CUSTOMER', 'ORDER']);
    expect(r.relations.length).toBe(1);
  });

  test('EU-6: 記号を含む名前に改名すると引用符が付く', function() {
    var t = E.template();
    var el = E.parse(t).elements[0];
    var out = E.operations.update(t, el.line, 'label', '設計(詳細)', { kind: el.kind, id: el.id });
    expect(out).toContain('"設計(詳細)"');
    expect(E.parse(out).elements.map(function(e) { return e.id; })).toContain('設計(詳細)');
  });

  test('EU-7: 日本語だけの名前には余分な引用符を付けない', function() {
    var t = E.template();
    var el = E.parse(t).elements[0];
    var out = E.operations.update(t, el.line, 'label', '顧客', { kind: el.kind, id: el.id });
    expect(out).not.toContain('"顧客"');
    expect(E.parse(out).elements.map(function(e) { return e.id; })).toContain('顧客');
  });
});

describe('quadrantChart: 記号を含む点の名前', function() {
  // 点の名前は `名前: [x, y]` の左側にそのまま置かれる。英数字と空白以外が入ると
  // 字句解析が落ちるので引用符で囲う。「設計(詳細)」「配列[0]」のような実務の
  // 名前はこれが無いと図が出ない。
  var Q = window.MA.modules.quadrantChart;

  test('QU-1: 括弧入りの名前で本文が引用符付きになる', function() {
    var t = Q.template();
    var el = Q.parse(t).elements[0];
    var out = Q.operations.update(t, el.line, 'label', '設計(詳細)', { kind: el.kind, id: el.id });
    expect(out).toContain('"設計(詳細)"');
  });

  test('QU-2: 英数字だけの名前には引用符を付けない', function() {
    var t = Q.template();
    var el = Q.parse(t).elements[0];
    var out = Q.operations.update(t, el.line, 'label', 'Campaign X', { kind: el.kind, id: el.id });
    expect(out).toContain('Campaign X: [');
    expect(out).not.toContain('"Campaign X"');
  });

  test('QU-3: 既に引用符付きの値を二重に囲まない', function() {
    var t = Q.template();
    var el = Q.parse(t).elements[0];
    var out = Q.operations.update(t, el.line, 'label', '"既に囲み"', { kind: el.kind, id: el.id });
    expect(out).not.toContain('""既に囲み""');
  });
});
