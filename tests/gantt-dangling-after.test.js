'use strict';
// UI-047: `after` の指す先が存在しなくても「OK」と表示される。
//
// mermaid は警告を出さず、解決できない `after` を任意の位置に置く。
// resolveSpan もそこで黙って `prevEnd` に落ちるので、図は描かれる。
// **タスクの id を書き換えた直後**に一番当たりやすく、Git にコミットして
// レビューに出るまで気付けない。
//
// 実測 (直す前 / 後):
//   `after NOSUCH` → status-info「タスク: 2 | セクション: 1」
//                  → 「… | 依存先が無い: 「実装」→ NOSUCH」
//
// `after` は空白区切りで複数を取れる (改名処理が split しているのと同じ)
// ので、片方だけ欠けている場合も拾う。
var G = window.MA.modules.gantt;
var NL = String.fromCharCode(10);

function parse(lines) {
  return G.parse(lines.join(NL));
}

describe('宙に浮いた依存を数える', function() {
  test('依存先が揃っていれば 0 件', function() {
    var p = parse(['gantt', '    dateFormat YYYY-MM-DD', '    section S',
      '    設計 :t1, 2026-03-01, 10d',
      '    実装 :t2, after t1, 10d']);
    expect(G.danglingAfter(p).length).toBe(0);
  });

  test('存在しない id を指していたら拾う', function() {
    var p = parse(['gantt', '    dateFormat YYYY-MM-DD', '    section S',
      '    設計 :t1, 2026-03-01, 10d',
      '    実装 :t2, after NOSUCH, 10d']);
    var d = G.danglingAfter(p);
    expect(d.length).toBe(1);
    expect(d[0].missing).toBe('NOSUCH');
    // どのタスクかが分からないと、数百行の図では探せない
    expect(d[0].label).toBe('実装');
  });

  test('複数指定のうち片方だけ欠けていても拾う', function() {
    var p = parse(['gantt', '    dateFormat YYYY-MM-DD', '    section S',
      '    設計 :t1, 2026-03-01, 10d',
      '    実装 :t2, after t1 GHOST, 10d']);
    var d = G.danglingAfter(p);
    expect(d.length).toBe(1);
    expect(d[0].missing).toBe('GHOST');
  });

  test('タスクが無い / after が無い文書でも壊れない', function() {
    expect(G.danglingAfter(null).length).toBe(0);
    expect(G.danglingAfter({}).length).toBe(0);
    var p = parse(['gantt', '    dateFormat YYYY-MM-DD', '    section S',
      '    設計 :t1, 2026-03-01, 10d']);
    expect(G.danglingAfter(p).length).toBe(0);
  });

  test('id を改名すると宙に浮く — 一番当たりやすい経路', function() {
    var text = ['gantt', '    dateFormat YYYY-MM-DD', '    section S',
      '    設計 :t1, 2026-03-01, 10d',
      '    実装 :t2, after t1, 10d'].join(NL);
    // 依存元だけを書き換える (改名の追従が効かなかった場合の姿)
    var broken = text.replace(':t1, 2026-03-01', ':renamed, 2026-03-01');
    var d = G.danglingAfter(G.parse(broken));
    expect(d.length).toBe(1);
    expect(d[0].missing).toBe('t1');
  });
});
