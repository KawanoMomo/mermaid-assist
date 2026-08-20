'use strict';
// class / er / state の要素削除。
//
// 3つとも「その要素が最初に現れた行を消す」実装だった。どの図種も要素は
// **行を共有する**ので、これは押した要素以外を壊す:
//
//   classDiagram  `class Animal {` の行だけ消え、中身の +String name / } が
//                 孤立して構文が壊れる
//   erDiagram     CUSTOMER も ORDER も宣言行は関係行 (`CUSTOMER ||--o{ ORDER`)。
//                 CUSTOMER の ✕ で**関係行が消えるだけ**、CUSTOMER { ... } は残る
//   stateDiagram  Idle の ✕ で `[*] --> Idle` が消えるだけ。Idle は他の遷移から
//                 参照されているので図に残り続ける
//
// いずれも「押したのに消えない」「押していないものが消える」で、
// #7 (block) / #10 (flowchart) と同じアーキタイプ。

var C = window.MA.modules.classDiagram;
var E = window.MA.modules.erDiagram;
var S = window.MA.modules.state;

function idsOf(mod, text) {
  return mod.parse(text).elements.map(function(e) { return e.id; });
}
function relsOf(mod, text) {
  return mod.parse(text).relations.map(function(r) { return r.from + '>' + r.to; });
}

describe('classDiagram: クラス削除', function() {
  var src = 'classDiagram\n    class Animal {\n        +String name\n        +makeSound() void\n    }\n' +
            '    class Dog\n    Animal <|-- Dog\n';

  test('DC-1: 押したクラスが消える', function() {
    expect(idsOf(C, C.deleteClass(src, 2, 'Animal'))).toEqual(['Dog']);
  });

  test('DC-2: ブロックの中身が孤立しない', function() {
    var out = C.deleteClass(src, 2, 'Animal');
    expect(out).not.toContain('+String name');
    expect(out).not.toContain('+makeSound()');
  });

  test('DC-3: そのクラスを含む関係行が消える', function() {
    expect(relsOf(C, C.deleteClass(src, 2, 'Animal'))).toEqual([]);
  });

  test('DC-4: 残るクラスは無傷', function() {
    expect(C.deleteClass(src, 2, 'Animal')).toContain('class Dog');
  });

  test('DC-5: ブロックを持たないクラスも消える', function() {
    expect(idsOf(C, C.deleteClass(src, 6, 'Dog'))).toEqual(['Animal']);
  });

  test('DC-6: 前方一致する別クラスを巻き込まない', function() {
    var t = 'classDiagram\n    class Ani\n    class Animal\n    Ani <|-- Animal\n';
    expect(idsOf(C, C.deleteClass(t, 2, 'Ani'))).toEqual(['Animal']);
  });

  test('DC-7: 前方一致する別クラス同士の関係は残る', function() {
    // DC-6 だけだと、関係の判定を前方一致に緩めても落ちない。
    // 対象と無関係な `Animal --> Anibase` のような関係が巻き添えになる形を見る
    var t = 'classDiagram\n    class Ani\n    class Animal\n    class Anibase\n' +
            '    Animal <|-- Anibase\n';
    var out = C.deleteClass(t, 2, 'Ani');
    expect(relsOf(C, out)).toEqual(['Animal>Anibase']);
    expect(idsOf(C, out).sort()).toEqual(['Anibase', 'Animal']);
  });
});

describe('erDiagram: エンティティ削除', function() {
  var src = 'erDiagram\n    CUSTOMER ||--o{ ORDER : places\n' +
            '    CUSTOMER {\n        string name\n    }\n' +
            '    ORDER {\n        int id PK\n    }\n';

  test('DE-1: 押したエンティティが消える', function() {
    expect(idsOf(E, E.deleteEntity(src, 2, 'CUSTOMER'))).toEqual(['ORDER']);
  });

  test('DE-2: 属性ブロックごと消える', function() {
    var out = E.deleteEntity(src, 2, 'CUSTOMER');
    expect(out).not.toContain('string name');
    expect(out).toContain('int id PK');
  });

  test('DE-3: そのエンティティを含む関係行が消える', function() {
    expect(relsOf(E, E.deleteEntity(src, 2, 'CUSTOMER'))).toEqual([]);
  });

  test('DE-4: もう一方を消しても同じように動く', function() {
    var out = E.deleteEntity(src, 2, 'ORDER');
    expect(idsOf(E, out)).toEqual(['CUSTOMER']);
    expect(out).toContain('string name');
  });

  test('DE-5: 前方一致する別エンティティを巻き込まない', function() {
    var t = 'erDiagram\n    CUST ||--o{ CUSTOMER : x\n    CUST {\n        int a\n    }\n' +
            '    CUSTOMER {\n        int b\n    }\n';
    var out = E.deleteEntity(t, 2, 'CUST');
    expect(idsOf(E, out)).toEqual(['CUSTOMER']);
    expect(out).toContain('int b');
  });
});

describe('stateDiagram: 状態削除', function() {
  var src = 'stateDiagram-v2\n    [*] --> Idle\n    Idle --> Running : start\n' +
            '    Running --> Idle : stop\n    Running --> [*]\n';

  test('DS-1: 押した状態が消える', function() {
    expect(idsOf(S, S.deleteState(src, 2, 'Idle'))).toEqual(['Running']);
  });

  test('DS-2: その状態に繋がる遷移が消える', function() {
    var out = S.deleteState(src, 2, 'Idle');
    expect(out).not.toContain('Idle');
  });

  test('DS-3: 無関係な遷移は残る', function() {
    expect(S.deleteState(src, 2, 'Idle')).toContain('Running --> [*]');
  });

  test('DS-4: もう一方を消しても同じように動く', function() {
    var out = S.deleteState(src, 3, 'Running');
    expect(idsOf(S, out)).toEqual(['Idle']);
    expect(out).toContain('[*] --> Idle');
  });

  test('DS-5: 宣言行を持つ状態も消える', function() {
    var t = 'stateDiagram-v2\n    state "待機中" as Idle\n    [*] --> Idle\n    Idle --> Run\n';
    var out = S.deleteState(t, 2, 'Idle');
    expect(out).not.toContain('Idle');
    expect(out).not.toContain('待機中');
  });

  test('DS-6: 前方一致する別状態を巻き込まない', function() {
    var t = 'stateDiagram-v2\n    [*] --> Idl\n    Idl --> Idle\n    Idle --> [*]\n';
    var out = S.deleteState(t, 2, 'Idl');
    expect(idsOf(S, out)).toEqual(['Idle']);
  });
});
