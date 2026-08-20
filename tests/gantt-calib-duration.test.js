'use strict';
// 較正が duration 記法のタスクを扱えるか。
//
// mermaid gantt で最も普通の書き方はこれ:
//
//     設計 :t1, 2026-03-01, 10d
//     実装 :t2, after t1, 10d
//
// 較正は「終了日が YYYY-MM-DD であること」を条件にしていたので、この図では
// pxPerDay が 0 のままになる。**バーもハンドルも描かれるのに、掴んでも
// 何も起きない。** 理由の表示も無い。
//
// 2タスク較正の方も「開始日が両方とも日付」が条件なので、after を使う図は
// 対象外。つまり duration + after という定番の組み合わせが丸ごと落ちる。

var G = window.MA.modules.gantt;

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

describe('較正: duration 記法', function() {
  test('CD-1: 終了日が 10d でも pxPerDay が出る', function() {
    // 設計 03-01 から 10日、バー幅 200px → 20px/日
    var texts = [fakeText('設計', { x: 5, y: 53.5, width: 30, height: 12 })];
    var rects = [fakeRect({ class: 'task task0 ' }, { x: 75, y: 50, width: 200, height: 20 })];
    var parsed = G.parseGantt('gantt\n    dateFormat YYYY-MM-DD\n    section S\n' +
      '    設計 :t1, 2026-03-01, 10d\n');
    G.calibrateScale(fakeSvg(rects, texts, 718), parsed);
    var c = G.getCalibration();
    expect(c.pxPerDay).toBe(20);
    expect(c.originX).toBe(75);
    expect(c.baseDate).toBe('2026-03-01');
  });

  test('CD-2: 週/月の単位も日数に直す', function() {
    var texts = [fakeText('設計', { x: 5, y: 53.5, width: 30, height: 12 })];
    var rects = [fakeRect({ class: 'task task0 ' }, { x: 75, y: 50, width: 140, height: 20 })];
    var parsed = G.parseGantt('gantt\n    dateFormat YYYY-MM-DD\n    section S\n' +
      '    設計 :t1, 2026-03-01, 2w\n');
    G.calibrateScale(fakeSvg(rects, texts, 718), parsed);
    // 2週 = 14日、140px → 10px/日
    expect(G.getCalibration().pxPerDay).toBe(10);
  });

  test('CD-3: 日付が2つある従来のケースは変わらない', function() {
    var texts = [
      fakeText('設計', { x: 5, y: 53.5, width: 30, height: 12 }),
      fakeText('実装', { x: 5, y: 77.5, width: 30, height: 12 }),
    ];
    var rects = [
      fakeRect({ class: 'task task0 ' }, { x: 75, y: 50, width: 100, height: 20 }),
      fakeRect({ class: 'task task0 ' }, { x: 175, y: 74, width: 200, height: 20 }),
    ];
    var parsed = G.parseGantt('gantt\n    dateFormat YYYY-MM-DD\n    section S\n' +
      '    設計 :t1, 2026-03-01, 2026-03-06\n    実装 :t2, 2026-03-06, 2026-03-16\n');
    G.calibrateScale(fakeSvg(rects, texts, 718), parsed);
    // 開始日の差 5日で x が 100px 離れている → 20px/日
    expect(G.getCalibration().pxPerDay).toBe(20);
  });

  test('CD-4: 解決できない終了日では較正しない', function() {
    var texts = [fakeText('設計', { x: 5, y: 53.5, width: 30, height: 12 })];
    var rects = [fakeRect({ class: 'task task0 ' }, { x: 75, y: 50, width: 200, height: 20 })];
    var parsed = G.parseGantt('gantt\n    dateFormat YYYY-MM-DD\n    section S\n' +
      '    設計 :t1, 2026-03-01, なにか\n');
    G.calibrateScale(fakeSvg(rects, texts, 718), parsed);
    // 推測でスケールを作るより、較正しない方が安全
    expect(G.getCalibration().pxPerDay).toBe(0);
  });

  test('CD-5: 0 日は較正に使わない (0除算)', function() {
    var texts = [fakeText('納品', { x: 5, y: 53.5, width: 30, height: 12 })];
    var rects = [fakeRect({ class: 'task task0 ' }, { x: 75, y: 50, width: 20, height: 20 })];
    var parsed = G.parseGantt('gantt\n    dateFormat YYYY-MM-DD\n    section S\n' +
      '    納品 :m1, 2026-03-01, 0d\n');
    G.calibrateScale(fakeSvg(rects, texts, 718), parsed);
    expect(G.getCalibration().pxPerDay).toBe(0);
  });
});
