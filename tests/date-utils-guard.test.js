'use strict';
// date-utils に不正な日付を渡したときの振る舞い。
//
// 3種類の壊れ方をしていた:
//
//   addDays(null, 3)          → "1970-01-04"      黙って epoch から数える
//   addDays(undefined, 3)     → RangeError        呼び出し元が落ちる
//   addDays("9999-99-99", 3)  → RangeError        DATE_RE は通る形なのに
//   daysBetween(null, d)      → 20517             epoch からの日数
//
// 実害の例: gantt の `after` 依存タスクは startDate が null。バーをドラッグすると
// `addDays(null, delta)` が 1970-01-04 を返し、**タスクが1970年に飛ぶ**。
// after 参照も同時に消えるので、依存関係ごと壊れる。エラーは出ない。
//
// 方針は仕様 F9 と同じ: **解決できないなら黙って別の値を作らず、null を返す**。
// 例外で落ちるのも、1970年を作るのも、どちらも呼び出し側が気づけない。

var D = window.MA.dateUtils;

describe('addDays: 不正入力', function() {
  test('DU-1: 正しい日付は従来どおり', function() {
    expect(D.addDays('2026-03-01', 3)).toBe('2026-03-04');
    expect(D.addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('DU-2: null は 1970 を作らず null', function() {
    expect(D.addDays(null, 3)).toBeNull();
  });

  test('DU-3: undefined / 空文字で例外を投げない', function() {
    expect(function() { D.addDays(undefined, 3); }).not.toThrow();
    expect(function() { D.addDays('', 3); }).not.toThrow();
    expect(D.addDays(undefined, 3)).toBeNull();
    expect(D.addDays('', 3)).toBeNull();
  });

  test('DU-4: 形は日付でも実在しない日は null', function() {
    // DATE_RE (\d{4}-\d{2}-\d{2}) は通ってしまう形
    expect(D.addDays('9999-99-99', 3)).toBeNull();
    expect(D.addDays('2026-13-45', 3)).toBeNull();
  });

  test('DU-5: 日付でない文字列は null', function() {
    expect(D.addDays('abc', 3)).toBeNull();
    expect(D.addDays('10d', 3)).toBeNull();
    expect(D.addDays('after t1', 3)).toBeNull();
  });

  test('DU-6: days が数値でなければ null', function() {
    expect(D.addDays('2026-03-01', NaN)).toBeNull();
    expect(D.addDays('2026-03-01', undefined)).toBeNull();
  });
});

describe('daysBetween: 不正入力', function() {
  test('DU-7: 正しい日付は従来どおり', function() {
    expect(D.daysBetween('2026-03-01', '2026-03-05')).toBe(4);
    expect(D.daysBetween('2026-03-05', '2026-03-01')).toBe(-4);
  });

  test('DU-8: null は epoch からの日数を返さない', function() {
    expect(D.daysBetween(null, '2026-03-05')).toBeNull();
    expect(D.daysBetween('2026-03-01', null)).toBeNull();
  });

  test('DU-9: 実在しない日は null', function() {
    expect(D.daysBetween('9999-99-99', '2026-03-05')).toBeNull();
  });

  test('DU-10: 日付でない文字列は null', function() {
    expect(D.daysBetween('10d', '2026-03-05')).toBeNull();
    expect(D.daysBetween('', '2026-03-05')).toBeNull();
  });
});
