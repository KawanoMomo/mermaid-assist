'use strict';
// state の ID 変更。
//
// R18 (キーボード完結) の走査を4図種から全21図種に広げたら出てきた。
// パネルには ID 欄 (`sel-state-id`) が出ているのに、**イベントが1つも
// 繋がっていなかった**。打鍵しても本文は変わらず、エラーも出ない。
// 欄があるのに効かないのは、欄が無いより悪い。効いたと思って先へ進んでしまう。
//
// 他の図種 (flowchart / block / sequence / c4 / requirement / class / er) は
// ID 欄を持ち、変更すると参照側も追従する。state だけが取り残されていた。
//
// 参照の追従が要るのは削除と同じ理由。宣言だけ変えると遷移行が古い ID を指した
// まま残り、mermaid は参照だけで状態を作るので**幽霊状態が生える**。

var S = window.MA.modules.state;

describe('state: 状態 ID の変更', function() {
  var src = 'stateDiagram-v2\n    [*] --> Idle\n    Idle --> Running : start\n' +
            '    Running --> Idle : stop\n    Running --> [*]\n';

  test('SI-1: 遷移の端点が両側とも追従する', function() {
    var out = S.updateStateId(src, 'Idle', '待機');
    expect(out).toContain('[*] --> 待機');
    expect(out).toContain('待機 --> Running : start');
    expect(out).toContain('Running --> 待機 : stop');
  });

  test('SI-2: 幽霊状態が生えない', function() {
    var ids = S.parse(S.updateStateId(src, 'Idle', '待機')).elements
      .map(function(e) { return e.id; }).sort();
    expect(ids).toEqual(['Running', '待機']);
  });

  test('SI-3: 遷移のラベルは巻き添えにならない', function() {
    var out = S.updateStateId(src, 'Idle', '待機');
    expect(out).toContain(': start');
    expect(out).toContain(': stop');
  });

  test('SI-4: 別名宣言の as 側が追従し、ラベルは変わらない', function() {
    var t = 'stateDiagram-v2\n    state "実行中" as Running\n    [*] --> Running\n';
    var out = S.updateStateId(t, 'Running', 'Active');
    expect(out).toContain('state "実行中" as Active');
    expect(out).toContain('[*] --> Active');
  });

  test('SI-5: コンポジット状態の宣言も追従する', function() {
    var t = 'stateDiagram-v2\n    state Active {\n        [*] --> Sub\n    }\n    [*] --> Active\n';
    var out = S.updateStateId(t, 'Active', '稼働');
    expect(out).toContain('state 稼働 {');
    expect(out).toContain('[*] --> 稼働');
  });

  test('SI-6: fork/join の宣言も追従する', function() {
    var t = 'stateDiagram-v2\n    state F <<fork>>\n    [*] --> F\n';
    var out = S.updateStateId(t, 'F', 'Split');
    expect(out).toContain('state Split <<fork>>');
    expect(out).toContain('[*] --> Split');
  });

  test('SI-7: note の宛先も追従する', function() {
    var t = 'stateDiagram-v2\n    [*] --> Idle\n    note right of Idle : 初期状態\n';
    var out = S.updateStateId(t, 'Idle', '待機');
    expect(out).toContain('note right of 待機 : 初期状態');
  });

  test('SI-8: 既にある ID へは変えない (黙って統合させない)', function() {
    expect(S.updateStateId(src, 'Idle', 'Running')).toBe(src);
  });

  test('SI-9: 空の ID は拒否する', function() {
    expect(S.updateStateId(src, 'Idle', '')).toBe(src);
    expect(S.updateStateId(src, 'Idle', '   ')).toBe(src);
  });

  test('SI-10: [*] へは変えない (擬似状態と衝突する)', function() {
    expect(S.updateStateId(src, 'Idle', '[*]')).toBe(src);
  });

  test('SI-11: 前方一致で他の状態を巻き込まない', function() {
    var t = 'stateDiagram-v2\n    [*] --> Idle\n    Idle --> IdleWait\n';
    var out = S.updateStateId(t, 'Idle', 'X');
    expect(out).toContain('X --> IdleWait');
    expect(out).not.toContain('XWait');
  });

  test('SI-12: 契約入口 (operations.update) から id を変えられる', function() {
    var el = S.parse(src).elements[0];
    var out = S.operations.update(src, el.line, 'id', '待機', { kind: 'state', id: el.id });
    expect(S.parse(out).elements.map(function(e) { return e.id; })).toContain('待機');
  });

  test('SI-13: 契約入口で label は今までどおりラベルに付く', function() {
    var el = S.parse(src).elements[0];
    var out = S.operations.update(src, el.line, 'label', '待機中', { kind: 'state', id: el.id });
    var after = S.parse(out).elements.filter(function(e) { return e.id === 'Idle'; })[0];
    expect(after.label).toBe('待機中');
  });
});
