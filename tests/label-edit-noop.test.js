'use strict';
// ラベル欄が無言で効かない。
//
// ヘビーユーザ視点の定時レビューで出た Blocker。既定のひな形で最初のノードを
// 選び、ラベル欄を書き換えて確定しても、本文もプレビューも変わらない。
// エラーも出ないので、利用者は「入力が届いていないのか、保存し忘れたのか」を
// 切り分けられない。
//
// 原因:
//   flowchart.js の updateNode はエッジ行を検出すると
//     // Line has edge: only update label if field===label; otherwise no-op
//     return text;
//   と書かれている。コメントは「label なら更新する」と言っているが、コードは
//   無条件に返している。約束されていた分岐が実装されていない。
//   `A[Start] --> B{Decision}` のように**宣言がエッジ行にある**のは flowchart の
//   普通の書き方なので、ひな形の全ノードがこれに当たる。
//
//   state.js の updateStateLabel は `state X` / `state "L" as X` の宣言行しか
//   見ない。ひな形の状態は遷移 (`[*] --> Idle`) にしか現れないため宣言行が無く、
//   やはり無言で返る。
//
// どちらも「押した要素以外を触らない」を守った結果の no-op ではなく、
// **何もしない**。単体テストで「同じ値を書き戻して変化なし」を確かめる検査は、
// 何もしない実装でも通ってしまう (R1 がまさにそれで見逃した)。

var F = window.MA.modules.flowchart;
var S = window.MA.modules.state;

describe('flowchart: エッジ行にあるノードのラベル', function() {
  var src = 'flowchart TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[OK]\n    C --> D[End]\n';

  test('LN-1: 左辺のノードのラベルを変えられる', function() {
    var out = F.updateNode(src, 2, 'label', '開始', 'A');
    expect(out).toContain('A[開始]');
    expect(out).toContain('B{Decision}');
  });

  test('LN-2: 右辺のノードのラベルを変えられる', function() {
    var out = F.updateNode(src, 2, 'label', '判定', 'B');
    expect(out).toContain('B{判定}');
    expect(out).toContain('A[Start]');
  });

  test('LN-3: エッジラベルのある行でも右辺を変えられる', function() {
    var out = F.updateNode(src, 3, 'label', '成功', 'C');
    expect(out).toContain('C[成功]');
    expect(out).toContain('|Yes|');
  });

  test('LN-4: 形状も変えられる', function() {
    var out = F.updateNode(src, 2, 'shape', 'round', 'A');
    expect(out).not.toContain('A[Start]');
    expect(out).toContain('Start');
  });

  test('LN-5: ID を変えると参照も追従する', function() {
    var out = F.updateNode(src, 2, 'id', 'START', 'A');
    expect(out).toContain('START[Start]');
    expect(F.parse(out).elements.map(function(e) { return e.id; })).toContain('START');
    expect(F.parse(out).elements.map(function(e) { return e.id; })).not.toContain('A');
  });

  test('LN-6: その行に無い id を渡したら何もしない (取り違えない)', function() {
    expect(F.updateNode(src, 2, 'label', 'ズレ', 'C')).toBe(src);
  });

  test('LN-7: id を渡さない旧来の呼び方でも左辺を変える (後方互換)', function() {
    var out = F.updateNode(src, 2, 'label', '開始');
    expect(out).toContain('A[開始]');
  });

  test('LN-8: 前方一致で別のノードを掴まない', function() {
    var t = 'flowchart TD\n    AB[X] --> A[Y]\n';
    var out = F.updateNode(t, 2, 'label', 'Z', 'A');
    expect(out).toContain('AB[X]');
    expect(out).toContain('A[Z]');
  });
});

describe('state: 宣言行が無い状態のラベル', function() {
  var src = 'stateDiagram-v2\n    [*] --> Idle\n    Idle --> Running\n    Running --> [*]\n';

  test('LN-9: 遷移にしか現れない状態にもラベルを付けられる', function() {
    var out = S.updateStateLabel(src, 2, '待機中', 'Idle');
    expect(out).toContain('state "待機中" as Idle');
  });

  test('LN-10: 遷移はそのまま残る', function() {
    var out = S.updateStateLabel(src, 2, '待機中', 'Idle');
    expect(out).toContain('[*] --> Idle');
    expect(out).toContain('Idle --> Running');
  });

  test('LN-11: 二度目は宣言を増やさず書き換える', function() {
    var once = S.updateStateLabel(src, 2, '待機中', 'Idle');
    var line = S.parse(once).elements.filter(function(e) { return e.id === 'Idle'; })[0].line;
    var twice = S.updateStateLabel(once, line, '停止中', 'Idle');
    expect(twice).toContain('state "停止中" as Idle');
    expect(twice).not.toContain('待機中');
    expect(twice.split('as Idle').length - 1).toBe(1);
  });

  test('LN-12: 既に別名宣言がある場合は従来どおり書き換える', function() {
    var t = 'stateDiagram-v2\n    state "待機" as Idle\n    [*] --> Idle\n';
    var out = S.updateStateLabel(t, 2, '停止', 'Idle');
    expect(out).toContain('state "停止" as Idle');
  });
});
