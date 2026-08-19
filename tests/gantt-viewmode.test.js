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
