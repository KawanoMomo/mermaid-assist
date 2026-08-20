'use strict';
var fns = (typeof global !== 'undefined' && global.fns) || {};

describe('Gantt 概観/詳細モード: 軸粒度の決定', function() {
  test('3ヶ月以下は週刻み', function() {
    expect(fns.ganttAxisFor(30).tickInterval).toBe('1week');
    expect(fns.ganttAxisFor(92).tickInterval).toBe('1week');
    expect(fns.ganttAxisFor(30).axisFormat).toBe('%m/%d');
  });

  test('2年以下は月刻みで年を出す', function() {
    expect(fns.ganttAxisFor(93).tickInterval).toBe('1month');
    expect(fns.ganttAxisFor(730).tickInterval).toBe('1month');
    // 実機で10年チャートのラベルが全部 01/01 になり判別不能だったため、
    // 年をラベルに含めるのが必須
    expect(fns.ganttAxisFor(730).axisFormat).toBe('%Y/%m');
  });

  test('それ以上は3ヶ月刻み', function() {
    expect(fns.ganttAxisFor(731).tickInterval).toBe('3month');
    expect(fns.ganttAxisFor(3650).tickInterval).toBe('3month');
    expect(fns.ganttAxisFor(3650).axisFormat).toBe('%Y/%m');
  });
});

describe('Gantt 概観/詳細モード: 期間の算出', function() {
  test('タスクが無ければ 0', function() {
    expect(fns.ganttSpanDays(null)).toBe(0);
    expect(fns.ganttSpanDays({ tasks: [] })).toBe(0);
  });

  test('最早開始から最遅終了までを日数で返す', function() {
    var p = { tasks: [
      { startDate: '2026-04-01', endDate: '2026-04-15' },
      { startDate: '2026-04-10', endDate: '2026-05-15' },
    ] };
    expect(fns.ganttSpanDays(p)).toBe(44);
  });

  test('日付が解決できないタスクだけなら 0', function() {
    // after 依存や duration 形式は startDate/endDate が埋まらない
    expect(fns.ganttSpanDays({ tasks: [{ startDate: null, endDate: '5d' }] })).toBe(0);
  });

  test('1日でも 0 にはしない (幅計算の分母になるため)', function() {
    var p = { tasks: [{ startDate: '2026-04-01', endDate: '2026-04-01' }] };
    expect(fns.ganttSpanDays(p)).toBe(1);
  });
});

describe('Gantt 詳細モードの幅', function() {
  test('DETAIL_PX_PER_DAY が定数として公開されている', function() {
    expect(typeof fns.DETAIL_PX_PER_DAY).toBe('number');
    expect(fns.DETAIL_PX_PER_DAY).toBeGreaterThan(0);
  });
});

// ── 敵対レビュー指摘 C-2 / C-3 ────────────────────────────────────────────
// parsed.tasks[].startDate / endDate は生文字列で、'5d' や '0d' が混ざる。
// 文字列比較で最大値を取ると '5d' > '2026-04-25' が true になり、そこから
// daysBetween が NaN → span が 1 日に潰れる。詳細モードが概観モードと同じ幅に
// なり、さらに ganttAxisFor(1) が '1week' を返すため 10 年チャートに週目盛が
// 強制されて軸が過密になる (master より悪化する退行)。
describe('C-2: duration 記法の混入で期間が潰れない', function() {
  test('endDate が duration でも解決して期間に含める', function() {
    var p = { tasks: [
      { id: 't1', startDate: '2026-04-01', endDate: '2026-04-15' },
      { id: 't2', startDate: '2026-04-16', endDate: '5d' },
    ] };
    // 04-16 + 5d = 04-21 まで。04-01 から 20 日。
    // 当初は「duration を除外する」応急処置だったが、resolveSpan で解決するように
    // 根治したので、除外ではなく解決した値が正しい
    expect(fns.ganttSpanDays(p)).toBe(20);
  });

  test('startDate が duration のタスクも除外する', function() {
    var p = { tasks: [
      { startDate: '5d', endDate: '3d' },
      { startDate: '2026-04-01', endDate: '2026-04-11' },
    ] };
    expect(fns.ganttSpanDays(p)).toBe(10);
  });

  test('after 依存だけの図は 0 (幅は概観幅にフォールバック)', function() {
    var p = { tasks: [
      { startDate: null, endDate: '5d', after: 'a1' },
      { startDate: null, endDate: '3d', after: 'a2' },
    ] };
    expect(fns.ganttSpanDays(p)).toBe(0);
  });

  test('長期プロジェクトに duration が混ざっても期間が潰れない', function() {
    var p = { tasks: [
      { startDate: '2026-01-01', endDate: '2036-01-01' },
      { startDate: '2026-02-01', endDate: '9d' },
    ] };
    // 10年 = 3653日。'9d' に奪われて 1 になってはいけない
    expect(fns.ganttSpanDays(p)).toBeGreaterThan(3000);
  });

  test('C-3: 期間が正しければ 10 年チャートは 3month 目盛になる', function() {
    var p = { tasks: [
      { startDate: '2026-01-01', endDate: '2036-01-01' },
      { startDate: '2026-02-01', endDate: '9d' },
    ] };
    expect(fns.ganttAxisFor(fns.ganttSpanDays(p)).tickInterval).toBe('3month');
  });
});
