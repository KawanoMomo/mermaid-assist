'use strict';
var gantt = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.gantt)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.gantt);

// 仕様: ブロック範囲は「section 行 〜 次の section 行の直前」。直前の空行は含めない。
// 入れ替え後に空行を正規化する。deleteSection は直前の空行も巻き込む非対称実装だが、
// そちらは既存挙動として温存し、moveSection はこの定義を採る。
var T = [
  'gantt',                                        // 1
  '    title P',                                  // 2
  '    dateFormat YYYY-MM-DD',                    // 3
  '',                                             // 4
  '    section 要件',                              // 5
  '    分析   :a1, 2026-04-01, 2026-04-10',        // 6
  '',                                             // 7
  '    section 設計',                              // 8
  '    基本   :b1, 2026-04-11, 2026-04-20',        // 9
  '    詳細   :b2, 2026-04-21, 2026-04-30',        // 10
  '',                                             // 11
  '    section 実装',                              // 12
  '    実装   :c1, 2026-05-01, 2026-05-20',        // 13
  ''
].join('\n');

function sectionOrder(text) {
  return text.split('\n')
    .filter(function(l) { return l.trim().indexOf('section ') === 0; })
    .map(function(l) { return l.trim().slice('section '.length); });
}

describe('moveSection: 順序の入れ替え', function() {
  test('S1: 下へ移動すると次のセクションと入れ替わる', function() {
    var p = gantt.parseGantt(T);
    var out = gantt.moveSection(T, p.sections[0].line, 1);
    expect(sectionOrder(out)).toEqual(['設計', '要件', '実装']);
  });

  test('S2: 上へ移動すると前のセクションと入れ替わる', function() {
    var p = gantt.parseGantt(T);
    var out = gantt.moveSection(T, p.sections[2].line, -1);
    expect(sectionOrder(out)).toEqual(['要件', '実装', '設計']);
  });

  test('S3: 先頭セクションの上移動は no-op', function() {
    var p = gantt.parseGantt(T);
    expect(gantt.moveSection(T, p.sections[0].line, -1)).toBe(T);
  });

  test('S4: 末尾セクションの下移動は no-op', function() {
    var p = gantt.parseGantt(T);
    expect(gantt.moveSection(T, p.sections[2].line, 1)).toBe(T);
  });

  test('S5: 不正な direction は no-op', function() {
    var p = gantt.parseGantt(T);
    expect(gantt.moveSection(T, p.sections[0].line, 0)).toBe(T);
    expect(gantt.moveSection(T, p.sections[0].line, 2)).toBe(T);
  });

  test('S6: 存在しない行番号は no-op', function() {
    expect(gantt.moveSection(T, 999, 1)).toBe(T);
  });
});

describe('moveSection: 配下タスクの随伴', function() {
  test('S7: セクションのタスクが一緒に移動する', function() {
    var p = gantt.parseGantt(T);
    var out = gantt.moveSection(T, p.sections[1].line, -1);
    var p2 = gantt.parseGantt(out);
    // 設計セクションが先頭になり、その配下に基本/詳細が付いてくる
    expect(p2.sections[0].name).toBe('設計');
    var inFirst = p2.tasks.filter(function(t) { return t.sectionIndex === 0; })
      .map(function(t) { return t.label; });
    expect(inFirst).toEqual(['基本', '詳細']);
  });

  test('S8: 移動してもタスクの総数が変わらない', function() {
    var p = gantt.parseGantt(T);
    var out = gantt.moveSection(T, p.sections[0].line, 1);
    expect(gantt.parseGantt(out).tasks.length).toBe(p.tasks.length);
  });

  test('S9: 移動してもタスクの日付が変わらない', function() {
    var p = gantt.parseGantt(T);
    var before = p.tasks.map(function(t) { return t.label + '@' + t.startDate + '-' + t.endDate; }).sort();
    var out = gantt.moveSection(T, p.sections[0].line, 1);
    var after = gantt.parseGantt(out).tasks
      .map(function(t) { return t.label + '@' + t.startDate + '-' + t.endDate; }).sort();
    expect(after).toEqual(before);
  });
});

describe('moveSection: 空行の正規化', function() {
  test('S10: セクション間の空行が1つに保たれる', function() {
    var p = gantt.parseGantt(T);
    var out = gantt.moveSection(T, p.sections[0].line, 1);
    // section 行の直前が必ず空行1つであること (連続空行が生じない)
    var lines = out.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim().indexOf('section ') === 0 && i >= 2) {
        expect(lines[i - 1].trim()).toBe('');
        expect(lines[i - 2].trim()).not.toBe('');
      }
    }
  });

  test('S11: 空行が無い図でも壊れない', function() {
    var t = 'gantt\n    section A\n    x :a, 2026-04-01, 2026-04-02\n    section B\n    y :b, 2026-04-03, 2026-04-04\n';
    var p = gantt.parseGantt(t);
    var out = gantt.moveSection(t, p.sections[0].line, 1);
    expect(sectionOrder(out)).toEqual(['B', 'A']);
    expect(gantt.parseGantt(out).tasks.length).toBe(2);
  });
});
