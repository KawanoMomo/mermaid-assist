'use strict';
// kanban のカードは `[本文]` と `id[本文]` の2通りで書ける。
//
// mermaid の正規表記は `id[本文]` で、`@{ assigned: '…' }` の割り当てを
// 付けるにはこの形が要る。ところが parser は `^\[` 始まりしか見ていなかったので、
// **id 付きのカードは行ごと消えていた** (列判定の indent にも掛からない)。
// mermaid は描くので、図には出るのに一覧にも重ね合わせにも出ない。
//
// 「見送り」と記録していた重ね合わせを実装しようとして見つかった。
// mermaid が SVG の id に何を使っているかを調べた副産物で、
// 観点を増やして出たものではない。

var K = window.MA.modules.kanban;

describe('kanban: id 付きのカード', function() {
  var src = 'kanban\n    設計 中\n        t1[やること]\n        [id無し]\n' +
            '    レビュー待ち\n        t2[確認]@{ assigned: \'a\' }\n';

  test('KC-1: id 付きのカードが一覧に出る', function() {
    var cards = K.parse(src).elements.filter(function(e) { return e.kind === 'card'; });
    expect(cards.length).toBe(3);
  });

  test('KC-2: DSL の id をそのまま持つ (mermaid が SVG に出すものと同じ)', function() {
    var ids = K.parse(src).elements.filter(function(e) { return e.kind === 'card'; })
      .map(function(e) { return e.id; });
    expect(ids).toContain('t1');
    expect(ids).toContain('t2');
  });

  test('KC-3: id の無いカードは今までどおり自動採番', function() {
    var c = K.parse(src).elements.filter(function(e) { return e.text === 'id無し'; })[0];
    expect(c).toBeDefined();
    expect(String(c.id).indexOf('__c_')).toBe(0);
  });

  test('KC-4: 本文とメタを取り違えない', function() {
    var c = K.parse(src).elements.filter(function(e) { return e.id === 't2'; })[0];
    expect(c.text).toBe('確認');
    expect(c.meta).toBe("@{ assigned: 'a' }");
  });

  test('KC-5: 所属する列を取り違えない', function() {
    var by = {};
    K.parse(src).elements.filter(function(e) { return e.kind === 'card'; })
      .forEach(function(e) { by[e.id] = e.parentId; });
    expect(by.t1).toBe('設計 中');
    expect(by.t2).toBe('レビュー待ち');
  });

  test('KC-6: ひな形 (id 無し) の解釈は変わらない', function() {
    var r = K.parse(K.template()).elements;
    expect(r.filter(function(e) { return e.kind === 'column'; }).length).toBe(3);
    expect(r.filter(function(e) { return e.kind === 'card'; }).length).toBe(4);
  });

  test('KC-7: id 付きカードも契約経由で消せる', function() {
    var el = K.parse(src).elements.filter(function(e) { return e.id === 't1'; })[0];
    var out = K.operations['delete'](src, el.line, { kind: 'card', id: 't1' });
    expect(K.parse(out).elements.map(function(e) { return e.id; })).not.toContain('t1');
    expect(K.parse(out).elements.map(function(e) { return e.id; })).toContain('t2');
  });
});
