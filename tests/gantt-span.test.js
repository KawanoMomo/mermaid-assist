'use strict';
var gantt = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.gantt)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.gantt);

function span(text) {
  var r = gantt.resolveSpan(gantt.parseGantt(text));
  return r ? r.days : 0;
}

describe('resolveSpan: duration と after を解決して実期間を出す', function() {
  test('R1: 明示的な日付だけ', function() {
    var t = 'gantt\n    section S\n    A :a1, 2026-04-01, 2026-04-15\n';
    expect(span(t)).toBe(14);
  });

  test('R2: duration 指定を解決する', function() {
    var t = 'gantt\n    section S\n    A :a1, 2026-04-01, 10d\n';
    expect(span(t)).toBe(10);
  });

  test('R3: after チェーンを解決する — mermaid で最も一般的な書き方', function() {
    var t = 'gantt\n    section S\n    A :a1, 2026-01-01, 365d\n    B :a2, after a1, 365d\n';
    // 730日。以前は ISO 日付が1個しか無いため span=1 に潰れていた
    expect(span(t)).toBe(730);
  });

  test('R4: 開始日省略は直前タスクの終了に続く', function() {
    var t = 'gantt\n    section S\n    A :a1, 2026-04-01, 10d\n    B :a2, 5d\n';
    expect(span(t)).toBe(15);
  });

  test('R5: 週・月・年の単位も解決する', function() {
    expect(span('gantt\n    section S\n    A :a1, 2026-01-01, 2w\n')).toBe(14);
    expect(span('gantt\n    section S\n    A :a1, 2026-01-01, 3M\n')).toBeGreaterThan(85);
    expect(span('gantt\n    section S\n    A :a1, 2026-01-01, 1y\n')).toBeGreaterThan(360);
  });

  test('R6: 起点となる日付が1つも無ければ null', function() {
    var t = 'gantt\n    section S\n    A :a1, after x, 5d\n    B :a2, after a1, 3d\n';
    expect(gantt.resolveSpan(gantt.parseGantt(t))).toBeNull();
  });

  test('R7: 存在しない after 参照は無視して続行する', function() {
    var t = 'gantt\n    section S\n    A :a1, 2026-04-01, 10d\n    B :a2, after ghost, 5d\n';
    // ghost は解決できないので B は直前の終了に続く扱い
    expect(span(t)).toBe(15);
  });

  test('R8: マイルストーン (0d) が期間を壊さない', function() {
    var t = 'gantt\n    section S\n    A :a1, 2026-04-01, 10d\n    G :milestone, m1, 2026-04-11, 0d\n    B :b1, after a1, 10d\n';
    expect(span(t)).toBe(20);
  });

  test('R9: タスクが無ければ null', function() {
    expect(gantt.resolveSpan(gantt.parseGantt('gantt\n'))).toBeNull();
    expect(gantt.resolveSpan(null)).toBeNull();
  });

  test('R10: 解決した最早と最遅を返す', function() {
    var t = 'gantt\n    section S\n    A :a1, 2026-04-01, 10d\n    B :a2, after a1, 5d\n';
    var r = gantt.resolveSpan(gantt.parseGantt(t));
    expect(r.min).toBe('2026-04-01');
    expect(r.max).toBe('2026-04-16');
  });
});
