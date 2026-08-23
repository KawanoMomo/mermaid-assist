'use strict';
// FEAT-903: 見出し行で区切る図種の親の付け替え (journey / kanban / timeline)。
//
// これらは `section 名前` や列名の**見出し行**で区切り、その下に並ぶ行が
// 中身になる。括弧も `end` も無いので、付け替えは「行を目当ての見出しの塊の
// 末尾へ動かす」ことになる (`textUpdater.moveLineIntoBlock`)。
//
// c4 / block と違い、**空になった見出しは畳まない**。実測すると空の section /
// 列を残しても mermaid は描けるので、利用者が作った見出しを勝手に消す理由が無い。
//
// 各テストは**動いたことを先に確かめる**。動かなければ親も変わらないので、
// 親を確かめる検査まで通ってしまう。
var M = (global.window && global.window.MA && global.window.MA.modules) || {};
var NL = String.fromCharCode(10);
var PC = String.fromCharCode(37, 37);

describe('journey: タスクを別のセクションへ', function() {
  var jr = M.journey;
  var D = ['journey', '  title 旅', '  section 準備', '    調べる: 5: 私',
    '  section 実行', '    作る: 3: 私'].join(NL);
  function task(t, sec) {
    var r = null;
    jr.parse(t).elements.forEach(function(e) { if (e.kind === 'task' && e.parentId === sec) r = e; });
    return r;
  }

  test('移すと親が変わる', function() {
    var out = jr.moveTaskToSection(D, task(D, '準備').line, '実行');
    expect(out).not.toBe(D);
    var moved = null;
    jr.parse(out).elements.forEach(function(e) { if (/調べる/.test(e.text || '')) moved = e; });
    expect(moved.parentId).toBe('実行');
  });

  test('空になったセクションは残す', function() {
    // 空の section を残しても図は描ける (実測)。作った見出しを勝手に消さない。
    var out = jr.moveTaskToSection(D, task(D, '準備').line, '実行');
    expect(out).toContain('section 準備');
  });

  test('存在しないセクションを渡されたら本文を変えない', function() {
    expect(jr.moveTaskToSection(D, task(D, '準備').line, 'いない')).toBe(D);
  });

  test('説明コメントも一緒に運ぶ', function() {
    var d = ['journey', '  section 準備', '    ' + PC + ' メモ', '    調べる: 5: 私',
      '  section 実行', '    作る: 3: 私'].join(NL);
    var out = jr.moveTaskToSection(d, task(d, '準備').line, '実行');
    expect(out).not.toBe(d);
    var L = out.split(NL).map(function(x) { return x.trim(); });
    var i = -1;
    L.forEach(function(x, n) { if (/調べる/.test(x)) i = n; });
    expect(L[i - 1]).toBe(PC + ' メモ');
  });
});

describe('kanban: カードを別の列へ', function() {
  var kb = M.kanban;

  test('移すと列が変わる', function() {
    var D = kb.template();
    var c = null;
    kb.parse(D).elements.forEach(function(e) { if (e.kind === 'card' && e.parentId === 'Todo' && !c) c = e; });
    var out = kb.moveCardToColumn(D, c.line, 'Done');
    expect(out).not.toBe(D);
    var moved = null;
    kb.parse(out).elements.forEach(function(e) { if (e.kind === 'card' && e.text === c.text) moved = e; });
    expect(moved.parentId).toBe('Done');
  });

  test('存在しない列を渡されたら本文を変えない', function() {
    var D = kb.template();
    var c = null;
    kb.parse(D).elements.forEach(function(e) { if (e.kind === 'card' && !c) c = e; });
    expect(kb.moveCardToColumn(D, c.line, 'いない')).toBe(D);
  });
});

describe('timeline: ピリオドを別のセクションへ', function() {
  var tl = M.timeline;
  // 継続行つき。`2020 : 開始` の次の `     : 資金調達` は同じピリオドの続きで、
  // 1行だけ動かすと取り残されて**別のピリオドの一部として読まれる**。
  var D = ['timeline', '  title 年表', '  section 前期',
    '    2020 : 開始', '         : 資金調達', '    2021 : 拡大',
    '  section 後期', '    2022 : 上場'].join(NL);
  function period(t, p) {
    var r = null;
    tl.parse(t).elements.forEach(function(e) { if (e.kind === 'period' && e.period === p) r = e; });
    return r;
  }

  test('継続行も一緒に運ぶ', function() {
    var out = tl.movePeriodToSection(D, period(D, '2020').line, '後期');
    expect(out).not.toBe(D);
    expect(period(out, '2020').parentId).toBe('後期');
    var L = out.split(NL);
    var i = -1;
    L.forEach(function(l, n) { if (/2020/.test(l)) i = n; });
    expect(L[i + 1].indexOf('資金調達')).toBeGreaterThan(-1);
  });

  test('継続行の字下げ (本体より深い) を保つ', function() {
    // 揃えて潰すと見た目が変わり、Git 差分に出る。
    var out = tl.movePeriodToSection(D, period(D, '2020').line, '後期');
    var L = out.split(NL);
    var i = -1;
    L.forEach(function(l, n) { if (/2020/.test(l)) i = n; });
    var ind = function(l) { return (l.match(/^(\s*)/) || ['', ''])[1].length; };
    expect(ind(L[i + 1])).toBeGreaterThan(ind(L[i]));
  });

  test('存在しないセクションを渡されたら本文を変えない', function() {
    expect(tl.movePeriodToSection(D, period(D, '2020').line, 'いない')).toBe(D);
  });
});
