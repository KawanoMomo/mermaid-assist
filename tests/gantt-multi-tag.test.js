'use strict';
// タスクの状態タグは 1 行に何個でも書ける(mermaid は先頭のタグを全部読む)。
//   結合テスト :crit, done, k6, 2026-11-25, 2026-11-27
// 先頭 1 つしか読まないと 2 つ目のタグを id、id を開始日、開始日を終了日と読み違え、
// ラベルに 1 文字足しただけで行が `結合テスト2 :crit, done, k6, 2026-11-25` になって
// 終了日が消え、mermaid は `Invalid date:k6` で図全体を拒んだ(TICKET-owner-20261109-0028-1)。
// どの更新でも、押した欄以外の字は 1 文字も変わらないこと(G1)を行単位で固定する。

var G = window.MA.modules.gantt;

var HEAD = 'gantt\n    dateFormat YYYY-MM-DD\n    section S\n';
var TWO = '    結合テスト :crit, done, k6, 2026-11-25, 2026-11-27';
var THREE = '    出荷判定 :active, crit, milestone, m9, 2026-11-30, 0d';
var AFTER2 = '    受入 :done, crit, k7, after k6, 2d';

function line4(text) { return text.split('\n')[3]; }

describe('parseGantt: 状態タグを全部タグとして読む', function() {
  test('MT-1: タグ 2 つの行で id・開始日・終了日がずれない', function() {
    var t = G.parseGantt(HEAD + TWO + '\n').tasks[0];
    expect(t.id).toBe('k6');
    expect(t.tags).toEqual(['crit', 'done']);
    expect(t.status).toBe('crit');
    expect(t.startDate).toBe('2026-11-25');
    expect(t.endDate).toBe('2026-11-27');
  });

  test('MT-2: タグ 3 つの行も同じ', function() {
    var t = G.parseGantt(HEAD + THREE + '\n').tasks[0];
    expect(t.id).toBe('m9');
    expect(t.tags).toEqual(['active', 'crit', 'milestone']);
    expect(t.startDate).toBe('2026-11-30');
    expect(t.endDate).toBe('0d');
  });

  test('MT-3: タグ 2 つ + after の行', function() {
    var t = G.parseGantt(HEAD + AFTER2 + '\n').tasks[0];
    expect(t.id).toBe('k7');
    expect(t.after).toBe('k6');
    expect(t.endDate).toBe('2d');
  });

  test('MT-4: 一覧(elements)の id がタグにならない', function() {
    var r = G.parseGantt(HEAD + TWO + '\n');
    var task = r.elements.filter(function(e) { return e.kind === 'task'; })[0];
    expect(task.id).toBe('k6');
  });
});

describe('updateTaskField / updateTaskDates: 押した欄だけが変わる(G1)', function() {
  test('MT-5: ラベル(タグ 2 つ)', function() {
    expect(line4(G.updateTaskField(HEAD + TWO, 4, 'label', '結合テスト2')))
      .toBe('    結合テスト2 :crit, done, k6, 2026-11-25, 2026-11-27');
  });

  test('MT-6: ラベル(タグ 3 つ)', function() {
    expect(line4(G.updateTaskField(HEAD + THREE, 4, 'label', '出荷')))
      .toBe('    出荷 :active, crit, milestone, m9, 2026-11-30, 0d');
  });

  test('MT-7: id(タグ 2 つ)。after の参照も追従し、そちらのタグも残る', function() {
    var out = G.updateTaskField(HEAD + TWO + '\n' + AFTER2, 4, 'id', 'it');
    expect(out.split('\n')[3]).toBe('    結合テスト :crit, done, it, 2026-11-25, 2026-11-27');
    expect(out.split('\n')[4]).toBe('    受入 :done, crit, k7, after it, 2d');
  });

  test('MT-8: 開始日だけ', function() {
    expect(line4(G.updateTaskDates(HEAD + TWO, 4, '2026-11-24', null)))
      .toBe('    結合テスト :crit, done, k6, 2026-11-24, 2026-11-27');
  });

  test('MT-9: 終了日だけ', function() {
    expect(line4(G.updateTaskDates(HEAD + TWO, 4, null, '2026-11-28')))
      .toBe('    結合テスト :crit, done, k6, 2026-11-25, 2026-11-28');
  });

  test('MT-10: 終了日だけ(タグ 3 つ)', function() {
    expect(line4(G.updateTaskDates(HEAD + THREE, 4, '2026-12-01', null)))
      .toBe('    出荷判定 :active, crit, milestone, m9, 2026-12-01, 0d');
  });

  test('MT-11: after を付ける(タグ 2 つ)', function() {
    var t = HEAD + '    設計 :d1, 2026-11-20, 3d\n' + TWO;
    expect(G.updateTaskField(t, 5, 'after', 'd1').split('\n')[4])
      .toBe('    結合テスト :crit, done, k6, after d1, 2026-11-27');
  });

  test('MT-12: after を外す(タグ 2 つ)', function() {
    var out = G.updateTaskField(HEAD + AFTER2, 4, 'after', '');
    expect(line4(out)).toBe('    受入 :done, crit, k7, 2d');
  });

  test('MT-13: operations.update のラベルも同じ', function() {
    expect(line4(G.operations.update(HEAD + TWO, 4, 'label', 'X')))
      .toBe('    X :crit, done, k6, 2026-11-25, 2026-11-27');
  });
});

describe('状態: 押したタグだけを付け外しする', function() {
  test('MT-14: タグを足すと他のタグは残る', function() {
    expect(line4(G.updateTaskField(HEAD + '    T :done, a1, 2026-11-01, 2d', 4, 'status', 'crit')))
      .toBe('    T :done, crit, a1, 2026-11-01, 2d');
  });

  test('MT-15: 既にあるタグを足しても変わらない', function() {
    expect(G.updateTaskField(HEAD + TWO, 4, 'status', 'done')).toBe(HEAD + TWO);
  });

  test('MT-16: status-off は押したタグだけを外す', function() {
    expect(line4(G.updateTaskField(HEAD + TWO, 4, 'status-off', 'crit')))
      .toBe('    結合テスト :done, k6, 2026-11-25, 2026-11-27');
    expect(line4(G.operations.update(HEAD + THREE, 4, 'status-off', 'active')))
      .toBe('    出荷判定 :crit, milestone, m9, 2026-11-30, 0d');
  });

  test('MT-17: none(null)は全部のタグを外す', function() {
    expect(line4(G.updateTaskField(HEAD + TWO, 4, 'status', null)))
      .toBe('    結合テスト :k6, 2026-11-25, 2026-11-27');
  });

  test('MT-18: タグを持つタスクを milestone にすると 0d、他のタグは残る', function() {
    expect(line4(G.updateTaskField(HEAD + TWO, 4, 'status', 'milestone')))
      .toBe('    結合テスト :crit, done, milestone, k6, 2026-11-25, 0d');
  });

  test('MT-19: milestone だけ外すと 1d に戻り、crit は残る', function() {
    expect(line4(G.updateTaskField(HEAD + THREE, 4, 'status-off', 'milestone')))
      .toBe('    出荷判定 :active, crit, m9, 2026-11-30, 1d');
  });

  test('MT-20: crit を外しても milestone の 0d は動かない', function() {
    expect(line4(G.updateTaskField(HEAD + THREE, 4, 'status-off', 'crit')))
      .toBe('    出荷判定 :active, milestone, m9, 2026-11-30, 0d');
  });
});
