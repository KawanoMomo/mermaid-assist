'use strict';
// 項目3 (タスクの連続入力) と 項目5 (マイルストーン) のうち、DOM に依存しない層。
//
// 仕様 docs/superpowers/specs/2026-08-18-gantt-ui-improvements-design.md の
// 「前タスク」の定義とフォールバック表、および ID 採番の衝突回避に対応する。
//
// 日付演算は F9 のとおり素通しすると例外死または 1970-01-01 が入る。
// 4形式 (日付 / duration / after / 空) すべてで例外を出さないことを固定する。

var G = window.MA.modules.gantt;

describe('nextTaskId: 既存IDと衝突しない採番', function() {
  test('AT-1: 既存が無ければ t1', function() {
    expect(G.nextTaskId('gantt\n    section S\n')).toBe('t1');
  });

  test('AT-2: t1 があれば t2', function() {
    expect(G.nextTaskId('gantt\n    section S\n    a :t1, 2026-03-01, 5d\n')).toBe('t2');
  });

  test('AT-3: 連番に穴があっても既存を避ける', function() {
    // t2 を再利用すると after t2 の参照先が変わる
    var t = 'gantt\n    section S\n    a :t1, 2026-03-01, 5d\n    b :t3, after t1, 5d\n';
    expect(G.nextTaskId(t)).toBe('t2');
  });

  test('AT-4: t1..t3 が埋まっていれば t4', function() {
    var t = 'gantt\n    section S\n' +
      '    a :t1, 2026-03-01, 5d\n    b :t2, after t1, 5d\n    c :t3, after t2, 5d\n';
    expect(G.nextTaskId(t)).toBe('t4');
  });

  test('AT-5: t 以外の ID は邪魔しない', function() {
    var t = 'gantt\n    section S\n    a :design, 2026-03-01, 5d\n';
    expect(G.nextTaskId(t)).toBe('t1');
  });
});

describe('nextStartDate: 日程の自動送り', function() {
  var base = 'gantt\n    dateFormat YYYY-MM-DD\n    section 開発\n';

  test('AT-6: 前タスクの終了日を次の開始日にする', function() {
    var t = base + '    設計 :t1, 2026-03-01, 2026-03-10\n';
    expect(G.nextStartDate(t, 0)).toBe('2026-03-10');
  });

  test('AT-7: 前タスクが無ければ null (空欄にする)', function() {
    expect(G.nextStartDate(base, 0)).toBeNull();
  });

  test('AT-8: 終了日が duration なら null', function() {
    // 解決値を推測して静かに誤った日付を入れるより、空で出す
    var t = base + '    設計 :t1, 2026-03-01, 5d\n';
    expect(G.nextStartDate(t, 0)).toBeNull();
  });

  test('AT-9: 開始日が after なら null', function() {
    var t = base + '    設計 :t1, 2026-03-01, 2026-03-10\n' +
                   '    実装 :t2, after t1, 2026-03-20\n';
    // 最終タスクの開始が after なので送れない
    expect(G.nextStartDate(t, 0)).toBeNull();
  });

  test('AT-10: セクション内の最終タスクを見る', function() {
    var t = base + '    設計 :t1, 2026-03-01, 2026-03-10\n' +
                   '    実装 :t2, 2026-03-10, 2026-03-25\n';
    expect(G.nextStartDate(t, 0)).toBe('2026-03-25');
  });

  test('AT-11: 別セクションのタスクは見ない', function() {
    var t = base + '    設計 :t1, 2026-03-01, 2026-03-10\n' +
      '    section 検証\n';
    expect(G.nextStartDate(t, 1)).toBeNull();
  });

  test('AT-12: セクション指定が -1 でも例外を出さない', function() {
    var t = base + '    設計 :t1, 2026-03-01, 2026-03-10\n';
    expect(function() { G.nextStartDate(t, -1); }).not.toThrow();
  });

  test('AT-13: 空文字を渡しても例外を出さない', function() {
    expect(function() { G.nextStartDate('', 0); }).not.toThrow();
    expect(G.nextStartDate('', 0)).toBeNull();
  });

  test('AT-13b: 開始位置に duration が来ていても null', function() {
    // `設計 :t1, 5d, 2026-03-10` は startDate が '5d' になる。
    // 非 null なので「前タスクが無い」判定では弾けず、形式チェックが要る
    var t = base + '    設計 :t1, 5d, 2026-03-10\n';
    expect(G.nextStartDate(t, 0)).toBeNull();
  });
});

describe('nextDurationDays: 期間の維持', function() {
  var base = 'gantt\n    dateFormat YYYY-MM-DD\n    section 開発\n';

  test('AT-14: 前タスクの日数を返す', function() {
    var t = base + '    設計 :t1, 2026-03-01, 2026-03-10\n';
    expect(G.nextDurationDays(t, 0)).toBe(9);
  });

  test('AT-15: 解決できなければ null', function() {
    expect(G.nextDurationDays(base + '    設計 :t1, 2026-03-01, 5d\n', 0)).toBeNull();
    expect(G.nextDurationDays(base, 0)).toBeNull();
  });

  test('AT-15b: 形は日付でも実在しない日なら null', function() {
    // DATE_RE は \d{4}-\d{2}-\d{2} なので 9999-99-99 も通る。
    // daysBetween は NaN を返すので、そのまま次の開始日に足すと
    // Invalid Date から 1970-01-01 が生まれる (F9)
    var t = base + '    設計 :t1, 9999-99-99, 2026-03-10\n';
    expect(G.nextDurationDays(t, 0)).toBeNull();
  });
});

describe('addTask: マイルストーン', function() {
  var base = 'gantt\n    dateFormat YYYY-MM-DD\n    section 開発\n    設計 :t1, 2026-03-01, 5d\n';

  test('AT-16: status を渡すと meta の先頭に入る', function() {
    var out = G.addTask(base, 0, 'リリース', 'm1', '2026-04-01', '0d', 'milestone');
    expect(out.split('\n')[4]).toBe('    リリース :milestone, m1, 2026-04-01, 0d');
  });

  test('AT-17: status 省略時は従来どおり', function() {
    var out = G.addTask(base, 0, '実装', 't2', '2026-03-06', '2026-03-20');
    expect(out.split('\n')[4]).toBe('    実装 :t2, 2026-03-06, 2026-03-20');
  });

  test('AT-18: milestoneLine が 0d を必ず付ける', function() {
    // F7: mermaid は `:milestone, id, 日付` だけだと期間を解決できない
    expect(G.milestoneMeta('m1', '2026-04-01')).toBe('milestone, m1, 2026-04-01, 0d');
  });

  test('AT-19: マイルストーンを足しても既存タスクは変わらない', function() {
    var out = G.addTask(base, 0, 'リリース', 'm1', '2026-04-01', '0d', 'milestone');
    expect(out).toContain('    設計 :t1, 2026-03-01, 5d');
  });
});

// 項目5: status を唯一の真とする以上、status を milestone にした時点で
// 行の形もマイルストーンの形 (F7: 0d が必須) にならないと、
// 「マイルストーンにしたのに描かれない」状態になる。
describe('updateTaskField: status=milestone の正規化', function() {
  var base = 'gantt\n    dateFormat YYYY-MM-DD\n    section S\n';

  test('AT-20: milestone にすると終了日が 0d になる', function() {
    var t = base + '    設計 :t1, 2026-03-01, 2026-03-10\n';
    expect(G.updateTaskField(t, 4, 'status', 'milestone').split('\n')[3])
      .toBe('    設計 :milestone, t1, 2026-03-01, 0d');
  });

  test('AT-21: 終了日が duration でも 0d に揃える', function() {
    var t = base + '    設計 :t1, 2026-03-01, 5d\n';
    expect(G.updateTaskField(t, 4, 'status', 'milestone').split('\n')[3])
      .toBe('    設計 :milestone, t1, 2026-03-01, 0d');
  });

  test('AT-22: milestone を解除すると 1d のタスクになる', function() {
    // 0d のまま普通のタスクに戻すと幅ゼロのバーになって画面から消える。
    // かといって終了日を落とすと `納品 :m1, 2026-04-01` になり、
    // mermaid は id を日付と読んで図全体を拒否する (Invalid date:m1)。
    // 「0d が消えていること」だけを見るテストはその出力でも通ってしまい、
    // 実描画オラクルで初めて落ちた。
    var t = base + '    納品 :milestone, m1, 2026-04-01, 0d\n';
    expect(G.updateTaskField(t, 4, 'status', null).split('\n')[3])
      .toBe('    納品 :m1, 2026-04-01, 1d');
  });

  test('AT-23: milestone のまま他のフィールドを変えても 0d は保つ', function() {
    var t = base + '    納品 :milestone, m1, 2026-04-01, 0d\n';
    expect(G.updateTaskField(t, 4, 'label', 'リリース').split('\n')[3])
      .toBe('    リリース :milestone, m1, 2026-04-01, 0d');
  });

  test('AT-24: milestone の日付変更で 0d が消えない', function() {
    var t = base + '    納品 :milestone, m1, 2026-04-01, 0d\n';
    expect(G.updateTaskDates(t, 4, '2026-05-01', null).split('\n')[3])
      .toBe('    納品 :milestone, m1, 2026-05-01, 0d');
  });

  test('AT-22b: 0d でないマイルストーンを解除しても終了日を捨てない', function() {
    // 手書きで `:milestone, m1, 2026-04-01, 2026-04-05` と書いてある場合、
    // 解除で 1d に潰すとユーザの入力を消すことになる
    var t = base + '    納品 :milestone, m1, 2026-04-01, 2026-04-05\n';
    expect(G.updateTaskField(t, 4, 'status', null).split('\n')[3])
      .toBe('    納品 :m1, 2026-04-01, 2026-04-05');
  });

  test('AT-25: done など他のステータスは 0d を持ち込まない', function() {
    var t = base + '    設計 :t1, 2026-03-01, 2026-03-10\n';
    expect(G.updateTaskField(t, 4, 'status', 'done').split('\n')[3])
      .toBe('    設計 :done, t1, 2026-03-01, 2026-03-10');
  });
});

// テンプレートから axisFormat 行を外したので、「行が無い = 期間に合わせて自動」
// という状態が普通に発生する。プロパティパネルはこれを名前のある選択肢として
// 見せる必要があり、そこから他のプリセットへ／プリセットから自動へ、
// 双方向に行き来できないといけない。
describe('removeGlobalSetting: 自動に戻す', function() {
  var withAf = 'gantt\n    title P\n    dateFormat YYYY-MM-DD\n    axisFormat %m/%d\n\n    section S\n    a :t1, 2026-04-01, 5d\n';

  test('GA-1: axisFormat 行を消せる', function() {
    var out = G.removeGlobalSetting(withAf, 'axisFormat');
    expect(G.parseGantt(out).axisFormat).toBe('');
    expect(out).not.toContain('axisFormat');
  });

  test('GA-2: 他の行は消さない', function() {
    var out = G.removeGlobalSetting(withAf, 'axisFormat');
    expect(out).toContain('title P');
    expect(out).toContain('dateFormat YYYY-MM-DD');
    expect(out).toContain('a :t1, 2026-04-01, 5d');
  });

  test('GA-3: 元から無ければ何も変わらない', function() {
    var t = 'gantt\n    dateFormat YYYY-MM-DD\n    section S\n    a :t1, 2026-04-01, 5d\n';
    expect(G.removeGlobalSetting(t, 'axisFormat')).toBe(t);
  });

  test('GA-4: 前方一致する別の行を巻き込まない', function() {
    // 'dateFormat' は 'Format' を含むが、キーは行頭からの完全一致で見る
    var out = G.removeGlobalSetting(withAf, 'Format');
    expect(out).toBe(withAf);
  });

  test('GA-5: 自動に戻してから再度指定できる', function() {
    var off = G.removeGlobalSetting(withAf, 'axisFormat');
    var on = G.updateGlobalSetting(off, 'axisFormat', '%Y/%m');
    expect(G.parseGantt(on).axisFormat).toBe('%Y/%m');
  });
});
