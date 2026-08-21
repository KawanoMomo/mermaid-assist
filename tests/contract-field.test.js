'use strict';
// 契約 (ADR-012 operations.update) の、これまで誰も見ていなかった側。
//
// r12 は「違う値を渡したら必ず変わること」を見ている。**変わらない欄は死んでいる**
// という観点で、これは正しい。ただし逆向き —— 知らない field を渡したときに
// **変わってはいけない** —— を見る観点が無かった。
//
// 実測すると 6 図種 24 通りが違反していた。中でも requirement は渡された field を
// そのまま `field: value` として本文に書き込んでいたので、パネルに無い field 名が
// 一度でも来ると mermaid が知らないキーが本文に入り、**その図は以後 parse を
// 通らなくなる**。エラーは編集の瞬間ではなく描画時に出るので、原因が結び付かない。
//
// これらは r11 (特殊文字) を関数名の表から契約ベースに書き換えた副産物として出た。
// 表に載っていた 6 図種しか見ていなかったので、17 図種は未検査のまま「0 件」だった。

var M = window.MA.modules;

// 実装に無いことがまず確実な field 名。
var BOGUS = ['__zzz_unknown__', 'frobnicate', 'label_', 'xyzzy'];

describe('契約: 知らない field は本文を変えない', function() {
  Object.keys(M).forEach(function(key) {
    var mod = M[key];
    if (!mod || !mod.template || !mod.parse || !mod.operations) return;
    if (typeof mod.operations.update !== 'function') return;

    test(key + ': 知らない field で本文が変わらない', function() {
      var t = mod.template();
      var els = mod.parse(t).elements || [];
      if (!els.length) return;
      els.slice(0, 3).forEach(function(el) {
        BOGUS.forEach(function(f) {
          var out = mod.operations.update(t, el.line, f, 'ZZ', { kind: el.kind, id: el.id });
          expect(out).toBe(t);
        });
      });
    });
  });
});

describe('requirement: ブロックごとに使えるキーが違う', function() {
  var R = M.requirementDiagram;
  var t = R.template();

  test('CF-1: requirement に label: を書かない (図が壊れる)', function() {
    expect(R.operations.update(t, 3, 'label', 'ZZ', { kind: 'requirement' })).toBe(t);
  });

  test('CF-2: requirement の text: は書ける', function() {
    expect(R.operations.update(t, 3, 'text', 'ZZ', { kind: 'requirement' })).not.toBe(t);
  });

  test('CF-3: element に text: は書けない (element は type/docref だけ)', function() {
    expect(R.operations.update(t, 10, 'text', 'ZZ', { kind: 'element' })).toBe(t);
  });

  test('CF-4: element の docref: は書ける', function() {
    expect(R.operations.update(t, 10, 'docref', 'x.c', { kind: 'element' })).not.toBe(t);
  });
});

describe('契約: 識別子は opts.id で渡せる', function() {
  // ADR-012 の識別子は opts.id。block だけ opts.blockId、requirement だけ
  // opts.elementName / opts.oldName という独自キーを要求していたので、
  // 契約どおり opts.id で呼ぶと**黙って空振り**していた。
  test('CF-5: block: opts.id でラベルを更新できる', function() {
    var B = M.blockBeta;
    var t = B.template();
    var el = B.parse(t).elements[0];
    expect(B.operations.update(t, el.line, 'label', 'ZZ', { kind: el.kind, id: el.id })).not.toBe(t);
  });

  test('CF-6: block: 従来の opts.blockId も通る', function() {
    var B = M.blockBeta;
    var t = B.template();
    var el = B.parse(t).elements[0];
    expect(B.operations.update(t, el.line, 'label', 'ZZ', { kind: el.kind, blockId: el.id })).not.toBe(t);
  });

  test('CF-7: block: opts.id で削除できる', function() {
    var B = M.blockBeta;
    var t = B.template();
    var el = B.parse(t).elements[0];
    expect(B.operations.delete(t, el.line, { kind: el.kind, id: el.id })).not.toBe(t);
  });
});

describe('state: 状態のラベルは遷移のラベルを書き換えない', function() {
  // stateDiagram では状態は遷移行で宣言されるのが普通 (`[*] --> Idle`)。
  // 分岐が opts.kind ではなく行に '-->' があるかで判定されていたので、
  // **状態を選んでラベルを変えると矢印のラベルが書き換わっていた**。
  // 状態の名前は変わらず、矢印に覚えの無い文字が出る。エラーは出ない。
  var S = M.state;
  var t = S.template();

  test('CF-8: 状態のラベルが状態に付く', function() {
    var el = S.parse(t).elements[0];
    var out = S.operations.update(t, el.line, 'label', '設計対象', { kind: 'state', id: el.id });
    var after = S.parse(out).elements.filter(function(e) { return e.id === el.id; })[0];
    expect(after.label).toBe('設計対象');
  });

  test('CF-9: 他の遷移のラベルが巻き添えにならない', function() {
    var el = S.parse(t).elements[0];
    var out = S.operations.update(t, el.line, 'label', '設計対象', { kind: 'state', id: el.id });
    expect(out).toContain('Idle --> Running : start');
    expect(out).toContain('Running --> Idle : stop');
  });

  test('CF-10: 遷移の更新は今までどおり効く', function() {
    var rels = S.parse(t).relations || [];
    if (!rels.length) return;
    var out = S.operations.update(t, rels[0].line, 'label', 'ZZ', { kind: 'transition' });
    expect(out).not.toBe(t);
  });
});
