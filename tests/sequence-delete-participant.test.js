'use strict';
// sequence: participant の削除。
//
// delete-by-id.test.js で class / er / state を id 認識に直したとき、
// sequence を取り残していた。sequence の participant も「宣言行を消すだけ」で、
// メッセージ (`A->>B: m`) が B を参照したまま残る。mermaid は参照だけで
// participant を暗黙に作るので、**一覧からは消えたのに図には残る**。
//
// パーサは宣言行を見て「B は無い」と言い、mermaid は参照を見て「B は在る」と言う。
// 同じ「存在する」に二つの述語が使われている、これまでと同じアーキタイプ。
//
// 規模が大きいほど当たりやすく、気付きにくい。R8 (100要素) で表に出た。

var seq = window.MA.modules.sequence;

function idsOf(text) {
  return seq.parse(text).elements
    .filter(function(e) { return e.kind === 'participant' || e.kind === 'actor'; })
    .map(function(e) { return e.id; });
}
// mermaid から見た「登場する participant」= 宣言 + メッセージの両端。
function renderedIds(text) {
  var found = {};
  seq.parse(text).elements.forEach(function(e) {
    if (e.kind === 'participant' || e.kind === 'actor') found[e.id] = true;
  });
  seq.parse(text).relations.forEach(function(r) {
    if (r.from) found[r.from] = true;
    if (r.to) found[r.to] = true;
  });
  return Object.keys(found).sort();
}

describe('sequence: participant を消したら図からも消える', function() {
  var src = 'sequenceDiagram\n    participant A\n    participant B\n    participant C\n' +
            '    A->>B: m1\n    B->>C: m2\n    A->>C: m3\n';

  test('SD-1: 押した participant が一覧から消える', function() {
    expect(idsOf(seq.deleteParticipant(src, 3, 'B'))).toEqual(['A', 'C']);
  });

  test('SD-2: 参照が残らない (図に描かれ続けない)', function() {
    expect(renderedIds(seq.deleteParticipant(src, 3, 'B'))).toEqual(['A', 'C']);
  });

  test('SD-3: 巻き添えを出さない — 無関係なメッセージは残る', function() {
    var out = seq.deleteParticipant(src, 3, 'B');
    expect(out).toContain('A->>C: m3');
    expect(out).not.toContain('m1');
    expect(out).not.toContain('m2');
  });

  test('SD-4: 前方一致で他人を巻き込まない', function() {
    var t = 'sequenceDiagram\n    participant B\n    participant BB\n    BB->>B: x\n    A->>BB: y\n';
    var out = seq.deleteParticipant(t, 2, 'B');
    expect(out).toContain('participant BB');
    expect(out).toContain('A->>BB: y');
    expect(out).not.toContain('BB->>B');
  });

  test('SD-5: 別名付き宣言でも id で消える', function() {
    var t = 'sequenceDiagram\n    participant A as アリス\n    participant B as ボブ\n    A->>B: x\n';
    var out = seq.deleteParticipant(t, 2, 'A');
    expect(out).not.toContain('アリス');
    expect(out).toContain('ボブ');
    expect(renderedIds(out)).toEqual(['B']);
  });

  test('SD-6: activate / deactivate も連れて行く', function() {
    var t = 'sequenceDiagram\n    participant A\n    participant B\n' +
            '    activate B\n    A->>B: x\n    deactivate B\n';
    var out = seq.deleteParticipant(t, 3, 'B');
    expect(out).not.toContain('activate B');
    expect(out).not.toContain('deactivate B');
  });

  test('SD-7: Note の対象が複数なら、消した相手だけ外して note は残す', function() {
    var t = 'sequenceDiagram\n    participant A\n    participant B\n' +
            '    Note over A,B: 両者\n    Note over B: Bだけ\n';
    var out = seq.deleteParticipant(t, 3, 'B');
    expect(out).toContain('Note over A: 両者');
    expect(out).not.toContain('Bだけ');
  });

  test('SD-8: id を渡さない旧来の呼び方は行削除のまま (後方互換)', function() {
    var t = 'sequenceDiagram\n    participant A\n    participant B\n    A->>B: x\n';
    var out = seq.deleteParticipant(t, 2);
    expect(out).not.toContain('participant A');
    expect(out).toContain('A->>B: x');
  });
});
