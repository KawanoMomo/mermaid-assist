'use strict';
// 宣言行を持たない参加者。
//
// `A->>B: 要求` だけ書けば mermaid は A と B を描く。実務では `participant` 行を
// 書かないほうがむしろ普通で、短く書けるのが利点。ところが parser は message 行から
// 参加者を登録していなかったので、**参加者が1人も一覧に出ず、選ぶことも
// 名前を変えることもできなかった** (実測: mermaid はアクターを8図形描くのに
// こちらの要素数は0)。
//
// さらに `operations.update` が行の中身だけで分岐していたので、
// 参加者を選んでラベルを変えると **メッセージの本文が書き換わっていた**
// (`A->>B: 要求` → `A->>B: 端末`)。state (A60) / flowchart (A56) と同じ形で3例目。
//
// 「見送り」欄の記録を疑って E6 (更新関数のシグネチャ) を実測したら、
// opts を受けない4引数のモジュールが8つあり、そのうち sequence で見つかった。

var S = window.MA.modules.sequence;
var IMPLICIT = 'sequenceDiagram\n    A->>B: 要求\n    B-->>A: 応答\n';

describe('sequence: 宣言行を持たない参加者', function() {
  test('SQ-1: メッセージ行から参加者を拾う', function() {
    var ids = S.parse(IMPLICIT).elements.map(function(e) { return e.id; }).sort();
    expect(ids).toEqual(['A', 'B']);
  });

  test('SQ-2: 導出したものだと分かる印が付く', function() {
    expect(S.parse(IMPLICIT).elements[0].implicit).toBe(true);
  });

  test('SQ-3: 明示の宣言があるほうを優先する', function() {
    var t = 'sequenceDiagram\n    participant A as 端末\n    A->>B: 要求\n';
    var els = S.parse(t).elements;
    var a = els.filter(function(e) { return e.id === 'A'; })[0];
    expect(a.label).toBe('端末');
    expect(!a.implicit).toBe(true);
  });

  test('SQ-4: 制御構造や activate を参加者と取り違えない', function() {
    var t = 'sequenceDiagram\n    A->>B: 要求\n    activate B\n    loop 3回\n      B-->>A: 応答\n    end\n    deactivate B\n';
    expect(S.parse(t).elements.map(function(e) { return e.id; }).sort()).toEqual(['A', 'B']);
  });

  test('SQ-5: ひな形 (明示宣言のみ) の解釈は変わらない', function() {
    var els = S.parse(S.template()).elements;
    expect(els.length).toBe(2);
    expect(!els[0].implicit).toBe(true);
  });
});

describe('sequence: 宣言行を持たない参加者の編集', function() {
  function first() { return S.parse(IMPLICIT).elements[0]; }

  test('SQ-6: ラベルを変えると宣言行ができる', function() {
    var el = first();
    var out = S.operations.update(IMPLICIT, el.line, 'label', '端末', { kind: 'participant', id: el.id });
    expect(out).toContain('participant A as 端末');
  });

  test('SQ-7: ラベルを変えてもメッセージの本文は変わらない', function() {
    var el = first();
    var out = S.operations.update(IMPLICIT, el.line, 'label', '端末', { kind: 'participant', id: el.id });
    expect(out).toContain('A->>B: 要求');
    expect(out).toContain('B-->>A: 応答');
  });

  test('SQ-8: ID を変えるとメッセージの端点が追従する', function() {
    var el = first();
    var out = S.operations.update(IMPLICIT, el.line, 'id', 'Client', { kind: 'participant', id: el.id });
    expect(out).toContain('Client->>B: 要求');
    expect(out).toContain('B-->>Client: 応答');
    expect(S.parse(out).elements.map(function(e) { return e.id; })).not.toContain('A');
  });

  test('SQ-9: 既にいる参加者へは変えない', function() {
    var el = first();
    expect(S.operations.update(IMPLICIT, el.line, 'id', 'B', { kind: 'participant', id: 'A' })).toBe(IMPLICIT);
  });

  test('SQ-10: 種別を変えると宣言行ができる', function() {
    var el = first();
    var out = S.operations.update(IMPLICIT, el.line, 'kind', 'actor', { kind: 'participant', id: el.id });
    expect(out).toContain('actor A');
  });

  test('SQ-11: メッセージのラベル変更は今までどおり', function() {
    var rel = S.parse(IMPLICIT).relations[0];
    var out = S.operations.update(IMPLICIT, rel.line, 'label', '新要求', { kind: 'message', id: rel.id });
    expect(out).toContain('A->>B: 新要求');
  });

  test('SQ-12: 明示宣言の参加者は今までどおり編集できる', function() {
    var t = S.template();
    var el = S.parse(t).elements[0];
    var out = S.operations.update(t, el.line, 'label', '端末', { kind: 'participant', id: el.id });
    expect(out).toContain('participant A as 端末');
  });
});

describe('sequence: 参加者の削除が図からも消す', function() {
  // deleteParticipant (id 認識) は前からあったのに、契約の入口が id を
  // 渡していなかった。単なる行削除だと宣言だけが消え、`A->>B: Request` が残る。
  // mermaid は参照だけで参加者を作るので、**一覧から消してもライフラインは
  // 図に残る** (しかもラベルを失って「A」に戻る)。
  //
  // state (A57) / flowchart (A57) / er (A67) / class (A68) と同じ形で、これで5例目。
  // 暗黙参加者を parse に載せたことで初めて r2 が捕まえられるようになった
  // (それまでは「消えたこと」を確認する相手が一覧に居なかった)。
  test('SQ-13: 宣言と参照が両方消える', function() {
    var t = S.template();
    var el = S.parse(t).elements[0];
    var out = S.operations['delete'](t, el.line, { kind: el.kind, id: el.id });
    expect(S.parse(out).elements.map(function(e) { return e.id; })).not.toContain('A');
    expect(out).not.toContain('A->>B');
    expect(out).not.toContain('B-->>A');
  });

  test('SQ-14: 巻き添えを出さない', function() {
    var t = S.template();
    var el = S.parse(t).elements[0];
    var out = S.operations['delete'](t, el.line, { kind: el.kind, id: el.id });
    expect(S.parse(out).elements.map(function(e) { return e.id; })).toContain('B');
    expect(out).toContain('participant B as Server');
  });

  test('SQ-15: 宣言行を持たない参加者も消せる', function() {
    var el = S.parse(IMPLICIT).elements[0];
    var out = S.operations['delete'](IMPLICIT, el.line, { kind: el.kind, id: el.id });
    expect(S.parse(out).elements.map(function(e) { return e.id; })).not.toContain('A');
  });

  test('SQ-16: メッセージの削除は今までどおり1行だけ', function() {
    var t = S.template();
    var rel = S.parse(t).relations[0];
    var out = S.operations['delete'](t, rel.line, { kind: 'message', id: rel.id });
    expect(out.split('\n').length).toBe(t.split('\n').length - 1);
  });
});
