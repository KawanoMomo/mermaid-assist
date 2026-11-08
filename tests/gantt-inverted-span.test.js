'use strict';
// TICKET-owner-20261109-0028-4: 開始日を終了日より後にしても知らせず、バーが幅 0 で消える。
//
// パネルの開始日欄だけを後ろへ動かすと `仕様レビュー :k2, 2026-11-16, 2026-11-14` の
// 1 行差分になり、ステータスは「OK」、図からはバーが見えなくなった。
// 宙に浮いた依存(B29)と同じステータス行の指摘で、どのタスクかを名指しして出す。
// 本文は書いたとおりに残す(勝手に終了日を動かさない)。
var G = window.MA.modules.gantt;
var NL = String.fromCharCode(10);

function parse(lines) {
  return G.parse(lines.join(NL));
}
var HEAD = ['gantt', '    dateFormat YYYY-MM-DD', '    section S'];

describe('期間が逆転したタスクを名指しする', function() {
  test('開始日だけを終了日より後にしたタスクを拾う', function() {
    var p = parse(HEAD.concat([
      '    要件定義 :k1, 2026-11-09, 2026-11-13',
      '    仕様レビュー :k2, 2026-11-16, 2026-11-14']));
    var d = G.invertedSpans(p);
    expect(d.length).toBe(1);
    expect(d[0].label).toBe('仕様レビュー');
    expect(d[0].id).toBe('k2');
    expect(d[0].start).toBe('2026-11-16');
    expect(d[0].end).toBe('2026-11-14');
  });

  test('正しい順・同じ日・期間指定は拾わない', function() {
    var p = parse(HEAD.concat([
      '    A :a1, 2026-11-09, 2026-11-13',
      '    B :a2, 2026-11-13, 2026-11-13',
      '    C :a3, 2026-11-14, 3d',
      '    D :a4, after a1, 2d']));
    expect(G.invertedSpans(p).length).toBe(0);
  });

  test('複数あればすべて拾う(書いた順)', function() {
    var p = parse(HEAD.concat([
      '    A :a1, 2026-11-20, 2026-11-10',
      '    B :a2, 2026-11-09, 2026-11-12',
      '    C :a3, 2026-12-01, 2026-11-30']));
    var d = G.invertedSpans(p);
    expect(d.map(function(x) { return x.id; })).toEqual(['a1', 'a3']);
  });

  test('after で決まる開始より前の終了日も拾う(after と混在)', function() {
    var p = parse(HEAD.concat([
      '    設計 :t1, 2026-11-09, 2026-11-20',
      '    実装 :t2, after t1, 2026-11-15',
      '    試験 :t3, after t1, 2026-11-25']));
    var d = G.invertedSpans(p);
    expect(d.length).toBe(1);
    expect(d[0].id).toBe('t2');
    expect(d[0].start).toBe('2026-11-20');
  });

  test('after が期間指定の先を指しても終わりを解決して比べる', function() {
    var p = parse(HEAD.concat([
      '    設計 :t1, 2026-11-09, 10d',
      '    実装 :t2, after t1, 2026-11-15']));
    var d = G.invertedSpans(p);
    expect(d.length).toBe(1);
    expect(d[0].start).toBe('2026-11-19');
  });

  test('after が複数なら一番遅い終わりから始まる', function() {
    var p = parse(HEAD.concat([
      '    A :a1, 2026-11-09, 2026-11-12',
      '    B :b1, 2026-11-09, 2026-11-20',
      '    C :c1, after a1 b1, 2026-11-15']));
    var d = G.invertedSpans(p);
    expect(d.length).toBe(1);
    expect(d[0].id).toBe('c1');
    expect(d[0].start).toBe('2026-11-20');
  });

  test('宙に浮いた依存は開始が決まらないので数えない(別の指摘に任せる)', function() {
    var p = parse(HEAD.concat([
      '    実装 :t2, after NOSUCH, 2026-11-15']));
    expect(G.invertedSpans(p).length).toBe(0);
  });

  test('タスクが無い文書でも壊れない', function() {
    expect(G.invertedSpans(null).length).toBe(0);
    expect(G.invertedSpans({}).length).toBe(0);
  });
});

describe('ステータス行に名指しで出す', function() {
  test('逆転したタスクの名前と日付が出る', function() {
    var p = parse(HEAD.concat([
      '    要件定義 :k1, 2026-11-09, 2026-11-13',
      '    仕様レビュー :k2, 2026-11-16, 2026-11-14']));
    var s = fns.statusInfoText(p, 'gantt');
    expect(s).toContain('終了日が開始日より前: 「仕様レビュー」(2026-11-16 開始 / 2026-11-14 終了)');
  });

  test('3 件以上は先頭 2 件とほか N 件', function() {
    var p = parse(HEAD.concat([
      '    A :a1, 2026-11-20, 2026-11-10',
      '    B :a2, 2026-11-21, 2026-11-10',
      '    C :a3, 2026-11-22, 2026-11-10']));
    var s = fns.statusInfoText(p, 'gantt');
    expect(s).toContain('「A」');
    expect(s).toContain('「B」');
    expect(s).not.toContain('「C」');
    expect(s).toContain('ほか1件');
  });

  test('直したら消える', function() {
    var p = parse(HEAD.concat([
      '    仕様レビュー :k2, 2026-11-16, 2026-11-18']));
    expect(fns.statusInfoText(p, 'gantt')).not.toContain('終了日が開始日より前');
  });
});
