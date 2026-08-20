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

// ── C-4: 概観モードの細いバーで別タスクの rect を掴まない ─────────────────
// 実測 (仕様書): 3年スパン (1.31px/日) でバー幅が [19, 0, 2, 19] になり、
// `width >= 3` フィルタで細バーが脱落 → y近傍マッチ (行間24px に対し閾値30px) が
// 3件目のタスクに4件目の rect を割り当てた。細いタスクをドラッグすると
// **別タスクの日付が書き換わる**。無反応より悪い。
describe('C-4: 行をまたいだ rect の誤割当を起こさない', function() {
  var ROW = 24; // 行間

  function rowsFor(specs) {
    // specs: [{label, rectWidth|null}] — rectWidth が null なら rect を出さない
    var texts = [], rects = [];
    specs.forEach(function(s, i) {
      var y = i * ROW;
      texts.push(fakeText(s.label, { x: 5, y: y + 6, width: 40, height: 12 }));
      if (s.rectWidth !== null) {
        rects.push(fakeRect({ class: 'task' }, { x: 100 + i * 30, y: y + 2, width: s.rectWidth, height: 20 }));
      }
    });
    return { texts: texts, rects: rects };
  }

  test('C4a: 細くて候補から漏れたタスクは null になり、隣の rect を奪わない', function() {
    // T3 のバーが細すぎて候補に入らない状況
    var r = rowsFor([
      { label: 'T1', rectWidth: 19 },
      { label: 'T2', rectWidth: 19 },
      { label: 'T3', rectWidth: null },  // 候補なし
      { label: 'T4', rectWidth: 19 },
    ]);
    var parsed = { tasks: [
      { label: 'T1', startDate: '2026-04-01', endDate: '2026-04-02', status: null },
      { label: 'T2', startDate: '2026-04-03', endDate: '2026-04-04', status: null },
      { label: 'T3', startDate: '2026-04-05', endDate: '2026-04-06', status: null },
      { label: 'T4', startDate: '2026-04-07', endDate: '2026-04-08', status: null },
    ] };
    gantt.calibrateScale(fakeSvg(r.rects, r.texts, 1000), parsed);
    var bars = gantt.getCalibration().barRects;
    expect(bars.length).toBe(4);
    // T3 は rect が無いので null。T4 の rect を奪ってはいけない
    expect(bars[2]).toBeNull();
    expect(bars[3]).not.toBeNull();
  });

  test('C4b: 各タスクは自分の行の rect を掴む', function() {
    var r = rowsFor([
      { label: 'A', rectWidth: 19 },
      { label: 'B', rectWidth: 19 },
      { label: 'C', rectWidth: 19 },
    ]);
    var parsed = { tasks: [
      { label: 'A', startDate: '2026-04-01', endDate: '2026-04-02', status: null },
      { label: 'B', startDate: '2026-04-03', endDate: '2026-04-04', status: null },
      { label: 'C', startDate: '2026-04-05', endDate: '2026-04-06', status: null },
    ] };
    gantt.calibrateScale(fakeSvg(r.rects, r.texts, 1000), parsed);
    var bars = gantt.getCalibration().barRects;
    // x は 100, 130, 160 の順に並ぶはず (行がずれていない証拠)
    expect(bars[0].x).toBe(100);
    expect(bars[1].x).toBe(130);
    expect(bars[2].x).toBe(160);
  });

  test('C4c: 幅の細いバーでも自分の行の rect なら掴む', function() {
    var r = rowsFor([
      { label: 'A', rectWidth: 19 },
      { label: 'B', rectWidth: 2 },   // 細いが自分の行にある
      { label: 'C', rectWidth: 19 },
    ]);
    var parsed = { tasks: [
      { label: 'A', startDate: '2026-04-01', endDate: '2026-04-02', status: null },
      { label: 'B', startDate: '2026-04-03', endDate: '2026-04-04', status: null },
      { label: 'C', startDate: '2026-04-05', endDate: '2026-04-06', status: null },
    ] };
    gantt.calibrateScale(fakeSvg(r.rects, r.texts, 1000), parsed);
    var bars = gantt.getCalibration().barRects;
    expect(bars[1]).not.toBeNull();
    expect(bars[1].x).toBe(130);
  });
});

// 概観モードではチャートがコンテナ幅で描き直されるので、
// 「幅がチャートの95%未満なら候補」という相対しきい値が section 背景を通す。
// 実測: コンテナ幅 718px で描くと section 背景は 680.5px、しきい値は 682.1px。
// 結果、先頭タスクのオーバーレイが x=0 w=680.5 (チャートほぼ全幅) になり、
//   - 掴む位置がタスク本体 (x=75 w=181) と一致しない
//   - ドラッグしても日付が1日も動かない
// という状態になっていた。詳細モードでは幅 1056px でしきい値 1003px を
// 背景 (1018.5px) が上回るため、たまたま表面化していなかった。
describe('ADR-010 較正: section 背景をタスクと取り違えない', function() {
  // 実測の幾何をそのまま使う。要点は section 背景とタスク矩形の yCenter が
  // 完全に同値 (どちらも 60.0) になること。距離が並ぶので DOM 順で先に来る
  // 背景が勝ってしまう。
  //   section section0  x=0   y=48 w=680.5 h=24  yC=60.0
  //   task task0        x=75  y=50 w=181   h=20  yC=60.0
  //   ラベル 要件分析                              yC=59.5
  function section(w, y) {
    return fakeRect({ class: 'section section0' }, { x: 0, y: y, width: w, height: 24 });
  }
  function taskRect(x, w, y) {
    return fakeRect({ class: 'task task0 ' }, { x: x, y: y, width: w, height: 20 });
  }

  function calibrate(chartWidth, sectionWidth) {
    var texts = [
      fakeText('設計', { x: 5, y: 53.5, width: 30, height: 12 }),
      fakeText('実装', { x: 5, y: 77.5, width: 30, height: 12 }),
    ];
    var rects = [
      section(sectionWidth, 48),
      section(sectionWidth, 72),
      taskRect(75, 100, 50),
      taskRect(175, 200, 74),
    ];
    var parsed = gantt.parseGantt(
      'gantt\n    dateFormat YYYY-MM-DD\n    section S\n' +
      '    設計 :t1, 2026-04-01, 2026-04-06\n' +
      '    実装 :t2, 2026-04-06, 2026-04-16\n');
    gantt.calibrateScale(fakeSvg(rects, texts, chartWidth), parsed);
    return gantt.getCalibration();
  }

  test('概観幅でも section 背景を掴まない', function() {
    // 680.5 / 718 = 0.948 で、旧しきい値 0.95 をすり抜けていた幅
    var c = calibrate(718, 680.5);
    expect(c.barRects[0].x).toBe(75);
    expect(c.barRects[0].width).toBe(100);
  });

  test('詳細幅でも同じ結果になる', function() {
    var c = calibrate(1056, 1018.5);
    expect(c.barRects[0].x).toBe(75);
    expect(c.barRects[0].width).toBe(100);
  });

  test('背景が細くてもタスクを優先する', function() {
    // 幅で弾く方式だと、背景がタスクより細い図では守れない
    var c = calibrate(718, 90);
    expect(c.barRects[0].x).toBe(75);
  });

  test('pxPerDay が概観と詳細で同じ計算式になる', function() {
    // 設計 5日で 100px → 20px/日
    expect(calibrate(718, 680.5).pxPerDay).toBe(20);
    expect(calibrate(1056, 1018.5).pxPerDay).toBe(20);
  });
});

// クラスで拾えているのに幾何フィルタを重ねると、
// 「プロジェクト全体に伸びる1本のタスク」や「細く描かれたバー」が
// 候補から落ちて掴めなくなる。クラスで特定できた時点で幾何の推測は要らない。
describe('ADR-010 較正: クラスで拾えたら幾何で弾かない', function() {
  function calib(rects, texts, width, mmd) {
    gantt.calibrateScale(fakeSvg(rects, texts, width), gantt.parseGantt(mmd));
    return gantt.getCalibration();
  }

  test('チャート全幅に伸びるタスクも掴める', function() {
    // 幅 690/718 = 96% で、旧しきい値 95% を超える
    var mmd = 'gantt\n    dateFormat YYYY-MM-DD\n    section S\n' +
      '    通期 :t1, 2026-01-01, 2026-12-31\n';
    var c = calib(
      [fakeRect({ class: 'task task0 ' }, { x: 14, y: 50, width: 690, height: 20 })],
      [fakeText('通期', { x: 5, y: 53.5, width: 30, height: 12 })],
      718, mmd);
    expect(c.barRects[0].width).toBe(690);
  });

  test('高さの薄いバーも掴める', function() {
    var mmd = 'gantt\n    dateFormat YYYY-MM-DD\n    section S\n' +
      '    薄い :t1, 2026-04-01, 2026-04-06\n';
    var c = calib(
      [fakeRect({ class: 'task task0 ' }, { x: 75, y: 55, width: 100, height: 6 })],
      [fakeText('薄い', { x: 5, y: 53.5, width: 12, height: 12 })],
      718, mmd);
    expect(c.barRects[0].x).toBe(75);
  });

  test('taskText のような別クラスは拾わない', function() {
    // mermaid はラベル側に taskText / taskTextOutsideRight を使う。
    // 部分一致にすると、それらが rect に付いた瞬間に掴む対象が変わる
    var mmd = 'gantt\n    dateFormat YYYY-MM-DD\n    section S\n' +
      '    設計 :t1, 2026-04-01, 2026-04-06\n';
    var c = calib(
      [fakeRect({ class: 'taskTextOutsideRight' }, { x: 0, y: 50, width: 600, height: 20 }),
       fakeRect({ class: 'task task0 ' }, { x: 75, y: 50, width: 100, height: 20 })],
      [fakeText('設計', { x: 5, y: 53.5, width: 30, height: 12 })],
      718, mmd);
    expect(c.barRects[0].x).toBe(75);
    expect(c.barRects[0].width).toBe(100);
  });
});
