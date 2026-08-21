'use strict';
// gantt の統一入口 (operations)。
//
// PL 診断の W1 で分かったこと: `operations.{add,update,delete,moveUp,moveDown}` という
// 統一入口は**既に20/21のモジュールが持っていた**。契約は最初からあり、使われて
// いなかっただけ。持っていないのは gantt だけで、しかも最も使う図種だった。
//
// 統一入口が無いと、呼び出し側とレビュー機構は関数名の表を手で持つことになる。
// 表から漏れたモジュールは検査対象から静かに外れる (ADR ドラフトに書いた懸念そのもの)。
// r1 / r12 が VALUE_FNS / FIELD_FNS の表を持っているのがまさにそれ。

var G = window.MA.modules.gantt;

describe('gantt: operations の統一入口', function() {
  var src = 'gantt\n    title P\n    dateFormat YYYY-MM-DD\n' +
            '    section S1\n    タスクA :a1, 2026-04-01, 3d\n    タスクB :a2, 2026-04-05, 2d\n';

  test('GO-1: operations が存在する', function() {
    expect(typeof G.operations).toBe('object');
    ['add', 'update', 'delete', 'moveUp', 'moveDown'].forEach(function(k) {
      expect(typeof G.operations[k]).toBe('function');
    });
  });

  test('GO-2: update でラベルを変えられる', function() {
    var t = G.parse(src).tasks[0];
    var out = G.operations.update(src, t.line, 'label', '変更後');
    expect(out).toContain('変更後');
    expect(out).not.toContain('タスクA');
  });

  test('GO-3: update で ID を変えられる', function() {
    var t = G.parse(src).tasks[0];
    var out = G.operations.update(src, t.line, 'id', 'zz1');
    expect(out).toContain(':zz1,');
  });

  test('GO-4: update で日付を変えられる', function() {
    var t = G.parse(src).tasks[0];
    var out = G.operations.update(src, t.line, 'startDate', '2026-05-01');
    expect(out).toContain('2026-05-01');
  });

  test('GO-5: セクション行なら名前を変える', function() {
    var sec = G.parse(src).sections[0];
    var out = G.operations.update(src, sec.line, 'name', 'S9');
    expect(out).toContain('section S9');
  });

  test('GO-6: add でタスクを足せる', function() {
    var out = G.operations.add(src, 'task', {
      label: '新規', id: 'n1', start: '2026-06-01', end: '2026-06-05', sectionIndex: 0,
    });
    expect(out).toContain('新規');
    expect(G.parse(out).tasks.length).toBe(3);
  });

  test('GO-7: delete でタスクを消せる', function() {
    var t = G.parse(src).tasks[1];
    var out = G.operations.delete(src, t.line);
    expect(G.parse(out).tasks.map(function(x) { return x.id; })).toEqual(['a1']);
  });

  test('GO-8: moveUp / moveDown が要素の集合を変えない', function() {
    var t = G.parse(src).tasks[1];
    var up = G.operations.moveUp(src, t.line);
    expect(G.parse(up).tasks.map(function(x) { return x.id; }).sort()).toEqual(['a1', 'a2']);
    var down = G.operations.moveDown(src, G.parse(src).tasks[0].line);
    expect(G.parse(down).tasks.map(function(x) { return x.id; }).sort()).toEqual(['a1', 'a2']);
  });

  test('GO-9: 知らない field は何もしない (無言で別のものを変えない)', function() {
    var t = G.parse(src).tasks[0];
    expect(G.operations.update(src, t.line, 'unknownField', 'x')).toBe(src);
  });

  test('GO-10: 全21モジュールが統一入口を持つ', function() {
    var mods = window.MA.modules;
    var missing = Object.keys(mods).filter(function(k) {
      var m = mods[k];
      return !(m && m.operations && typeof m.operations.update === 'function');
    });
    expect(missing).toEqual([]);
  });
});

describe('gantt: parse の返す形', function() {
  // W1 で発覚した最も重い取りこぼし。
  //
  // gantt.parse だけ `elements` を返さず `{title, dateFormat, axisFormat, sections, tasks}`
  // を返していた。並行レビュー機構は全体が `parse().elements` を前提にしているので、
  // **gantt は18観点すべてから静かに素通りしていた**。
  //
  // 実際に gantt の operations.update を無効化する変異を入れても r12 は0件のままだった。
  // 「表から漏れたモジュールは検査対象から静かに外れる」と ADR ドラフトに書いた懸念が、
  // 関数名の表ではなく**パースの返り値の形**で起きていた。
  //
  // 最も使う図種が、最も多くの検査から外れていたことになる。
  var G = window.MA.modules.gantt;

  test('GO-11: elements を返す', function() {
    var p = G.parse(G.template());
    expect(Array.isArray(p.elements)).toBe(true);
    expect(p.elements.length).toBeGreaterThan(0);
  });

  test('GO-12: elements の各要素が id と line を持つ', function() {
    G.parse(G.template()).elements.forEach(function(e) {
      expect(typeof e.id).toBe('string');
      expect(typeof e.line).toBe('number');
    });
  });

  test('GO-13: tasks / sections も従来どおり返す (後方互換)', function() {
    var p = G.parse(G.template());
    expect(Array.isArray(p.tasks)).toBe(true);
    expect(Array.isArray(p.sections)).toBe(true);
  });

  test('GO-14: elements はタスクとセクションの両方を含む', function() {
    var src = 'gantt\n    dateFormat YYYY-MM-DD\n    section S1\n    A :a1, 2026-04-01, 1d\n';
    var p = G.parse(src);
    var kinds = p.elements.map(function(e) { return e.kind; }).sort();
    expect(kinds).toEqual(['section', 'task']);
  });

  test('GO-15: 全21モジュールの parse が elements を返す', function() {
    var mods = window.MA.modules;
    var missing = Object.keys(mods).filter(function(k) {
      var m = mods[k];
      if (!m || !m.template || !m.parse) return false;
      try { return !Array.isArray(m.parse(m.template()).elements); } catch (e) { return true; }
    });
    expect(missing).toEqual([]);
  });
});

describe('flowchart: 統一入口が node と edge を取り違えない', function() {
  // r1 を契約ベースに書き換えて出てきた本物の欠陥。
  //
  // flowchart の operations.update は「行にエッジ記号があればエッジ」と判定していた。
  // `A[Start] --> B{Decision}` はノードの宣言とエッジが同じ行にあるので、A のラベルを
  // 変えようとすると **エッジのラベル** が付く (`A --> |新ラベル| B`)。
  //
  // updateNode は第5引数に id を受け取れるのに、入口が渡していなかった。
  // 「入口に必要なものを渡していない」形はこれで3件目 (A55 / block の blockId / これ)。
  var F = window.MA.modules.flowchart;
  var src = 'flowchart TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[OK]\n';

  test('FO-1: id を渡せばノードのラベルが変わる', function() {
    var out = F.operations.update(src, 2, 'label', '開始', { kind: 'node', id: 'A' });
    expect(out).toContain('A[開始]');
    expect(out).not.toContain('|開始|');
  });

  test('FO-2: 右辺のノードも変えられる', function() {
    var out = F.operations.update(src, 2, 'label', '判定', { kind: 'node', id: 'B' });
    expect(out).toContain('B{判定}');
  });

  test('FO-3: エッジを指定したときはエッジのラベルが変わる', function() {
    var out = F.operations.update(src, 3, 'label', 'はい', { kind: 'edge' });
    expect(out).toContain('|はい|');
  });

  test('FO-4: 同じ値の書き戻しで何も変わらない', function() {
    var els = F.parse(src).elements;
    els.forEach(function(el) {
      var out = F.operations.update(src, el.line, 'label', el.label, { kind: 'node', id: el.id });
      expect(F.parse(out).elements.map(function(x) { return x.id; }).join(',')).toBe(
        els.map(function(x) { return x.id; }).join(','));
    });
  });
});
