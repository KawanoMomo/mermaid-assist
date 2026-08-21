'use strict';
// class / er の名前変更。
//
// R18 (キーボード完結性) で「Tab 30回でもラベル欄に届かない」と出たので調べたら、
// **そもそも名前を変える手段が無かった**。選択時のパネルはクラス名を読み取り専用の
// 文字として出すだけで、入力欄がゼロ (実測)。erDiagram も同じ。
//
// 他の図種 (flowchart / block / sequence / c4 / state / requirement) は ID 欄を持ち、
// 変更すると参照側も追従する。class / er だけが取り残されていた。
// リネームは1日に何度も通る操作なので、テキストを直接触るしかないのは GUI ツール
// として成立していない。
//
// 参照の追従が要るのは削除と同じ理由。宣言だけ変えると関係行が古い名前を指したまま
// 残り、mermaid は参照だけで要素を作るので**幽霊クラスが生える**。

var C = window.MA.modules.classDiagram;
var E = window.MA.modules.erDiagram;

describe('classDiagram: クラス名の変更', function() {
  var src = 'classDiagram\n    class Animal {\n        +String name\n    }\n' +
            '    class Dog\n    Animal <|-- Dog\n    Dog : +bark() void\n';

  test('CR-1: 宣言が変わる', function() {
    var out = C.updateClassName(src, 2, 'Animal', 'Creature');
    expect(out).toContain('class Creature {');
    expect(out).not.toContain('class Animal');
  });

  test('CR-2: 関係の端点が追従する', function() {
    var out = C.updateClassName(src, 2, 'Animal', 'Creature');
    expect(out).toContain('Creature <|-- Dog');
  });

  test('CR-3: メンバ行の所有者も追従する', function() {
    var out = C.updateClassName(src, 5, 'Dog', 'Puppy');
    expect(out).toContain('Puppy : +bark() void');
    expect(out).toContain('Animal <|-- Puppy');
  });

  test('CR-4: 幽霊クラスが生えない', function() {
    var ids = C.parse(C.updateClassName(src, 2, 'Animal', 'Creature')).elements
      .map(function(e) { return e.id; }).sort();
    expect(ids).toEqual(['Creature', 'Dog']);
  });

  test('CR-5: 前方一致で他のクラスを巻き込まない', function() {
    var t = 'classDiagram\n    class Ani\n    class Animal\n    Ani <|-- Animal\n';
    var out = C.updateClassName(t, 2, 'Ani', 'X');
    expect(out).toContain('class Animal');
    expect(out).toContain('X <|-- Animal');
  });

  test('CR-6: 既にある名前へは変えない (黙って統合させない)', function() {
    expect(C.updateClassName(src, 2, 'Animal', 'Dog')).toBe(src);
  });

  test('CR-7: 空の名前は拒否する', function() {
    expect(C.updateClassName(src, 2, 'Animal', '')).toBe(src);
  });
});

describe('erDiagram: エンティティ名の変更', function() {
  var src = 'erDiagram\n    CUSTOMER {\n        string name\n    }\n' +
            '    ORDER {\n        int id\n    }\n    CUSTOMER ||--o{ ORDER : places\n';

  test('CR-8: 宣言が変わる', function() {
    var out = E.updateEntityName(src, 2, 'CUSTOMER', 'CLIENT');
    expect(out).toContain('CLIENT {');
    expect(out).not.toContain('CUSTOMER {');
  });

  test('CR-9: 関係の端点が追従する', function() {
    var out = E.updateEntityName(src, 2, 'CUSTOMER', 'CLIENT');
    expect(out).toContain('CLIENT ||--o{ ORDER : places');
  });

  test('CR-10: 幽霊エンティティが生えない', function() {
    var ids = E.parse(E.updateEntityName(src, 2, 'CUSTOMER', 'CLIENT')).elements
      .map(function(e) { return e.id; }).sort();
    expect(ids).toEqual(['CLIENT', 'ORDER']);
  });

  test('CR-11: 既にある名前へは変えない', function() {
    expect(E.updateEntityName(src, 2, 'CUSTOMER', 'ORDER')).toBe(src);
  });
});
