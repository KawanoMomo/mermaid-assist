'use strict';
// ID リネームが参照側にカスケードすることの検証。
//
// 6モジュールが同じ欠陥を共有していた: 宣言行の id だけを書き換え、その id を
// 参照している行 (Rel / edge / message / after / checkout など) を放置する。
// 結果は mermaid のダイアグラム種別ごとに異なるが、どれも壊れている:
//
//   c4          parse OK / render 例外        → プレビューが消える
//   architecture parse ERR                    → 明示エラー
//   gitgraph     parse ERR                    → 明示エラー
//   flowchart    parse OK / render OK         → 幽霊ノードが増える (無言)
//   sequence     parse OK / render OK         → 幽霊participantが増える (無言)
//   gantt        parse OK / render OK         → バーが数ヶ月ずれる (無言)
//
// requirement.js の updateName だけが以前からカスケードを実装していた。
//
// 各モジュールに「ラベル・テキスト中に旧IDと同じ文字列がある」ケースを必ず入れて
// いるのは、素朴な全文置換で通ってしまうテストを避けるため。

var M = window.MA.modules;

describe('C4: 要素IDのリネーム', function() {
  var src = [
    'C4Context',
    '  title 決済',
    '  Person(user, "利用者", "user と呼ぶ")',
    '  System(sys, "基幹")',
    '  Rel(user, sys, "利用")',
    '  Rel(sys, user, "通知")',
  ].join('\n');

  test('R-C4-1: Rel の from/to が追従する', function() {
    var out = M.c4.updateElement(src, 3, 'id', 'customer').split('\n');
    expect(out[4]).toBe('  Rel(customer, sys, "利用")');
    expect(out[5]).toBe('  Rel(sys, customer, "通知")');
  });

  test('R-C4-2: 説明文中の "user" は書き換えない', function() {
    var out = M.c4.updateElement(src, 3, 'id', 'customer').split('\n');
    expect(out[2]).toContain('user と呼ぶ');
  });

  test('R-C4-3: id 以外のフィールド更新では他行を触らない', function() {
    var out = M.c4.updateElement(src, 3, 'label', 'エンドユーザ').split('\n');
    expect(out[4]).toBe('  Rel(user, sys, "利用")');
  });
});

describe('flowchart: ノードIDのリネーム', function() {
  var src = [
    'flowchart TD',
    '    A[A で始まる処理]',
    '    B[処理]',
    '    A --> B',
    '    B -.-> A',
  ].join('\n');

  test('R-FC-1: エッジの両辺が追従する', function() {
    var out = M.flowchart.updateNode(src, 2, 'id', 'Start').split('\n');
    expect(out[3]).toBe('    Start --> B');
    expect(out[4]).toBe('    B -.-> Start');
  });

  test('R-FC-2: ラベル中の "A" は書き換えない', function() {
    var out = M.flowchart.updateNode(src, 2, 'id', 'Start').split('\n');
    expect(out[1]).toBe('    Start[A で始まる処理]');
  });

  test('R-FC-3: 前方一致する別ノードを巻き込まない', function() {
    var t = 'flowchart TD\n    A[a]\n    AB[ab]\n    A --> AB\n';
    var out = M.flowchart.updateNode(t, 2, 'id', 'Z').split('\n');
    expect(out[3]).toBe('    Z --> AB');
  });
});

describe('sequence: participant ID のリネーム', function() {
  var src = [
    'sequenceDiagram',
    '    participant A as A端末',
    '    participant B as サーバ',
    '    A->>B: 要求',
    '    activate B',
    '    B-->>A: 応答',
    '    deactivate B',
    '    Note over A,B: A と B の会話',
  ].join('\n');

  test('R-SQ-1: メッセージの from/to が追従する', function() {
    var out = M.sequence.updateParticipant(src, 2, 'id', 'Client').split('\n');
    expect(out[3]).toBe('    Client->>B: 要求');
    expect(out[5]).toBe('    B-->>Client: 応答');
  });

  test('R-SQ-2: Note over の対象が追従する', function() {
    var out = M.sequence.updateParticipant(src, 2, 'id', 'Client').split('\n');
    expect(out[7]).toBe('    Note over Client,B: A と B の会話');
  });

  test('R-SQ-3: activate/deactivate の対象が追従する', function() {
    var out = M.sequence.updateParticipant(src, 3, 'id', 'Server').split('\n');
    expect(out[4]).toBe('    activate Server');
    expect(out[6]).toBe('    deactivate Server');
  });

  test('R-SQ-4: エイリアスとメッセージ本文は書き換えない', function() {
    var out = M.sequence.updateParticipant(src, 2, 'id', 'Client').split('\n');
    expect(out[1]).toBe('    participant Client as A端末');
    expect(out[7]).toContain('A と B の会話');
  });
});

describe('gantt: タスクIDのリネーム', function() {
  var src = [
    'gantt',
    '    dateFormat YYYY-MM-DD',
    '    section 開発',
    '    設計 t1 :t1, 2026-03-01, 5d',
    '    実装 :impl, after t1, 10d',
    '    検証 :v1, after impl, 3d',
  ].join('\n');

  test('R-GA-1: after の参照が追従する', function() {
    var out = M.gantt.updateTaskField(src, 4, 'id', 'design').split('\n');
    expect(out[4]).toContain('after design');
  });

  test('R-GA-2: タスク名中の "t1" は書き換えない', function() {
    var out = M.gantt.updateTaskField(src, 4, 'id', 'design').split('\n');
    expect(out[3]).toContain('設計 t1 :');
  });

  test('R-GA-3: 無関係な after は触らない', function() {
    var out = M.gantt.updateTaskField(src, 4, 'id', 'design').split('\n');
    expect(out[5]).toContain('after impl');
  });
});

describe('architecture: サービスIDのリネーム', function() {
  var src = [
    'architecture-beta',
    '    group api(cloud)[API Group]',
    '    service db(database)[db を持つ] in api',
    '    service disk(disk)[Disk] in api',
    '    db:R -- L:disk',
  ].join('\n');

  test('R-AR-1: エッジの両辺が追従する', function() {
    var out = M.architectureBeta.updateElement(src, 3, 'id', 'store').split('\n');
    expect(out[4]).toBe('    store:R -- L:disk');
  });

  test('R-AR-2: group をリネームすると in 参照が追従する', function() {
    var out = M.architectureBeta.updateElement(src, 2, 'id', 'cloudgrp').split('\n');
    expect(out[2]).toContain(' in cloudgrp');
    expect(out[3]).toContain(' in cloudgrp');
  });

  test('R-AR-3: ラベル中の "db" は書き換えない', function() {
    var out = M.architectureBeta.updateElement(src, 3, 'id', 'store').split('\n');
    expect(out[2]).toContain('[db を持つ]');
  });
});

describe('gitgraph: ブランチ名のリネーム', function() {
  var src = [
    'gitGraph',
    '  commit',
    '  branch dev',
    '  checkout dev',
    '  commit id: "dev の作業"',
    '  checkout main',
    '  merge dev',
  ].join('\n');

  test('R-GG-1: checkout/merge が追従する', function() {
    var out = M.gitGraph.updateBranch(src, 3, 'feature').split('\n');
    expect(out[3]).toBe('  checkout feature');
    expect(out[6]).toBe('  merge feature');
  });

  test('R-GG-2: commit の id 文字列は書き換えない', function() {
    var out = M.gitGraph.updateBranch(src, 3, 'feature').split('\n');
    expect(out[4]).toContain('"dev の作業"');
  });

  test('R-GG-3: 他ブランチの checkout は触らない', function() {
    var out = M.gitGraph.updateBranch(src, 3, 'feature').split('\n');
    expect(out[5]).toBe('  checkout main');
  });
});

// 前方一致・部分一致で別要素を巻き込まないこと。
// これが無いと「参照側を素朴に部分文字列置換する」実装でも上のテストが全部通る。
describe('リネームが前方一致する別要素を巻き込まない', function() {
  test('R-X-C4: user のリネームが user2 を巻き込まない', function() {
    var t = 'C4Context\n  Person(user, "A")\n  Person(user2, "B")\n  Rel(user, user2, "x")\n';
    var out = M.c4.updateElement(t, 2, 'id', 'client').split('\n');
    expect(out[3]).toBe('  Rel(client, user2, "x")');
  });

  test('R-X-SQ: A のリネームが AB を巻き込まない', function() {
    var t = 'sequenceDiagram\n    participant A\n    participant AB\n    A->>AB: x\n    activate AB\n';
    var out = M.sequence.updateParticipant(t, 2, 'id', 'Z').split('\n');
    expect(out[3]).toBe('    Z->>AB: x');
    expect(out[4]).toBe('    activate AB');
  });

  test('R-X-GA: t1 のリネームが t10 を巻き込まない', function() {
    var t = 'gantt\n    dateFormat YYYY-MM-DD\n    section S\n    a :t1, 2026-03-01, 5d\n' +
            '    b :t10, 2026-03-01, 5d\n    c :c1, after t10, 3d\n';
    var out = M.gantt.updateTaskField(t, 4, 'id', 'zzz').split('\n');
    expect(out[5]).toContain('after t10');
  });

  test('R-X-AR: db のリネームが db2 を巻き込まない', function() {
    var t = 'architecture-beta\n    service db(database)[A]\n    service db2(database)[B]\n    db2:R -- L:db\n';
    var out = M.architectureBeta.updateElement(t, 2, 'id', 'store').split('\n');
    expect(out[3]).toBe('    db2:R -- L:store');
  });

  test('R-X-GG: dev のリネームが dev2 を巻き込まない', function() {
    var t = 'gitGraph\n  commit\n  branch dev\n  branch dev2\n  checkout dev2\n  merge dev\n';
    var out = M.gitGraph.updateBranch(t, 3, 'feature').split('\n');
    expect(out[4]).toBe('  checkout dev2');
    expect(out[5]).toBe('  merge feature');
  });

  test('R-X-FC: 複数参照がすべて追従する', function() {
    var t = 'flowchart TD\n    A[x]\n    B[y]\n    C[z]\n    A --> B\n    A --> C\n    C --> A\n';
    var out = M.flowchart.updateNode(t, 2, 'id', 'Z').split('\n');
    expect(out[4]).toBe('    Z --> B');
    expect(out[5]).toBe('    Z --> C');
    expect(out[6]).toBe('    C --> Z');
  });
});

// 上の describe だけでは、次の2つの変異が生き残った:
//   - architecture の edge で from 側だけ / to 側だけ判定を緩めても検出できない
//   - c4 で Rel のラベルまで書き換えても検出できない (ラベル == 旧ID のケースが無い)
// どちらもテストの穴だったので、変異が必ず落ちる形に補強する。
describe('リネーム: 変異で落ちなかった穴の補強', function() {
  test('R-Y-AR: エッジの from 側・to 側の両方で完全一致が要る', function() {
    var t = 'architecture-beta\n    service db(database)[A]\n    service db2(database)[B]\n' +
            '    db:R -- L:db2\n    db2:T -- B:db\n';
    var out = M.architectureBeta.updateElement(t, 2, 'id', 'store').split('\n');
    expect(out[3]).toBe('    store:R -- L:db2');
    expect(out[4]).toBe('    db2:T -- B:store');
  });

  test('R-Y-C4: Rel のラベルが旧IDと同じでも書き換えない', function() {
    var t = 'C4Context\n  Person(user, "利用者")\n  System(sys, "基幹")\n' +
            '  Rel(user, sys, "user", "user")\n';
    var out = M.c4.updateElement(t, 2, 'id', 'client').split('\n');
    expect(out[3]).toBe('  Rel(client, sys, "user", "user")');
  });

  test('R-Y-FC: エッジラベルが旧IDと同じでも書き換えない', function() {
    var t = 'flowchart TD\n    A[x]\n    B[y]\n    A -->|A| B\n';
    var out = M.flowchart.updateNode(t, 2, 'id', 'Z').split('\n');
    expect(out[3]).toBe('    Z -->|A| B');
  });

  test('R-Y-SQ: メッセージ本文が旧IDと同じでも書き換えない', function() {
    var t = 'sequenceDiagram\n    participant A\n    participant B\n    A->>B: A\n';
    var out = M.sequence.updateParticipant(t, 2, 'id', 'Z').split('\n');
    expect(out[3]).toBe('    Z->>B: A');
  });
});
