'use strict';
var gantt = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.gantt)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.gantt);

// calibrateScale は SVG を読むので、rect と text を模したスタブを組み立てる。
// getBBox は jsdom にも無いため、必要な形だけを自前で持つ。
function fakeRect(attrs, bbox) {
  return {
    getAttribute: function(n) { return attrs[n] === undefined ? null : attrs[n]; },
    getBBox: function() { return bbox; },
  };
}
function fakeText(content, bbox) {
  return { textContent: content, getBBox: function() { return bbox; } };
}
function fakeSvg(rects, texts, width) {
  return {
    viewBox: { baseVal: { width: width } },
    querySelectorAll: function(sel) {
      if (sel === 'rect') return rects;
      if (sel === 'text') return texts;
      return [];
    },
  };
}

describe('ADR-010 較正: マイルストーンを候補から除外する', function() {
  test('class に milestone を含む rect は除外される', function() {
    expect(gantt.isMilestoneRect(fakeRect({ class: 'task milestone crit' }, {}))).toBe(true);
  });

  test('通常のタスク rect は除外されない', function() {
    expect(gantt.isMilestoneRect(fakeRect({ class: 'task' }, {}))).toBe(false);
  });

  test('rotate 変換を持つ rect も除外される (class が無い手書きSVG向け)', function() {
    expect(gantt.isMilestoneRect(fakeRect({ transform: 'rotate(45 10 10)' }, {}))).toBe(true);
  });

  test('translate だけの rect は除外されない', function() {
    expect(gantt.isMilestoneRect(fakeRect({ transform: 'translate(5,5)' }, {}))).toBe(false);
  });

  test('null や属性なしでも落ちない', function() {
    expect(gantt.isMilestoneRect(null)).toBe(false);
    expect(gantt.isMilestoneRect(fakeRect({}, {}))).toBe(false);
  });

  // 本丸: マイルストーンの有無で pxPerDay が変わらないこと。
  // 実測ではマイルストーン1個で 19.267 → 18.571 に動き、無関係なタスクの
  // 逆算日付が 04-16 → 04-17 にずれていた。
  //
  // 再現の要点: マイルストーンは parsedData.tasks に**ラベル付きのタスクとして
  // 存在する**。ラベルの y 近傍で rect と照合されるため、除外しなければ
  // 回転した 20x20 の bbox がそのまま fit の入力に入る。
  test('マイルストーン混在で pxPerDay が変わらない', function() {
    var W = 1000;
    // 設計 04-01〜04-15 (14日), 実装 04-16〜05-15 (29日)
    // 原点 x=100, 20px/日 とすると 設計 x=100 w=280 / 実装 x=400 w=580
    var designText = fakeText('設計', { x: 10, y: 4, width: 40, height: 12 });
    var implText   = fakeText('実装', { x: 10, y: 64, width: 40, height: 12 });
    var gateText   = fakeText('ゲート', { x: 10, y: 34, width: 40, height: 12 });

    var designRect = fakeRect({ class: 'task' }, { x: 100, y: 0, width: 280, height: 20 });
    var implRect   = fakeRect({ class: 'task' }, { x: 400, y: 60, width: 580, height: 20 });
    // マイルストーンは 20x20 の回転矩形。x=370 は日付位置ではなく外接矩形の角
    var gateRect   = fakeRect({ class: 'task milestone', transform: 'rotate(45 380 40)' },
                              { x: 370, y: 30, width: 20, height: 20 });

    var tasksNoMs = [
      { label: '設計', startDate: '2026-04-01', endDate: '2026-04-15', status: null },
      { label: '実装', startDate: '2026-04-16', endDate: '2026-05-15', status: null },
    ];
    var tasksWithMs = [
      { label: '設計', startDate: '2026-04-01', endDate: '2026-04-15', status: null },
      { label: 'ゲート', startDate: '2026-04-15', endDate: '2026-04-15', status: 'milestone' },
      { label: '実装', startDate: '2026-04-16', endDate: '2026-05-15', status: null },
    ];

    gantt.calibrateScale(fakeSvg([designRect, implRect], [designText, implText], W),
                         { tasks: tasksNoMs });
    var without = gantt.getCalibration().pxPerDay;

    gantt.calibrateScale(fakeSvg([designRect, gateRect, implRect],
                                 [designText, gateText, implText], W),
                         { tasks: tasksWithMs });
    var withMilestone = gantt.getCalibration().pxPerDay;

    expect(withMilestone).toBe(without);
  });
});
