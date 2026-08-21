'use strict';
// 「追加」に日本語の名前を入れる。
//
// これまでの実描画の網は **改名と削除にしか掛かっていなかった**
// (tests/gen-rename-cases.js / gen-delete-cases.js)。
// 一番最初にやる操作である追加に網が無く、そこに欠陥が溜まっていた。
//
// 実測 (mermaid v11.13):
//
//   branch 機能A          → Lexer error      branch "機能A"        → OK
//   追加見本: [0.5, 0.5]  → Lexical error    "追加見本": [0.5,0.5] → OK
//   requirement 受信要求  → Lexical error    requirement "受信要求" → OK
//
// いずれも「引用符で囲えば通る」形。**mermaid の制限だと記録していたが誤り**
// だった (A83 と同じ)。逆に radar / architecture の識別子は引用符でも通らない
// ので、そちらは本当に mermaid 側の制限 (r23 が実測して区別している)。

var G = window.MA.modules.gitGraph;
var Q = window.MA.modules.quadrantChart;

describe('gitGraph: 日本語のブランチ名', function() {
  var base = 'gitGraph\n    commit id: "init"\n';

  test('AU-1: 追加すると引用符が付く', function() {
    var out = G.operations.add(base, 'branch', { name: '機能A' });
    expect(out).toContain('branch "機能A"');
  });

  test('AU-2: 半角のブランチ名には引用符を付けない', function() {
    var out = G.operations.add(base, 'branch', { name: 'feature/x' });
    expect(out).toContain('branch feature/x');
    expect(out).not.toContain('"feature/x"');
  });

  test('AU-3: 読み直すと引用符が外れる', function() {
    var out = G.operations.add(base, 'branch', { name: '機能A' });
    var br = G.parse(out).elements.filter(function(e) { return e.kind === 'branch'; })[0];
    expect(br.name).toBe('機能A');
  });

  test('AU-4: checkout / merge も引用符付きで書かれ、読み直せる', function() {
    var out = G.operations.add(base, 'branch', { name: '機能A' });
    out = G.operations.add(out, 'commit', { id: 'c2' });
    out = G.operations.add(out, 'checkout', { target: 'main' });
    out = G.operations.add(out, 'merge', { target: '機能A' });
    expect(out).toContain('merge "機能A"');
    var mg = G.parse(out).elements.filter(function(e) { return e.kind === 'merge'; })[0];
    expect(mg.target).toBe('機能A');
  });

  test('AU-5: 日本語へ改名すると checkout / merge の参照も追従する', function() {
    var out = G.operations.add(base, 'branch', { name: 'feat' });
    out = G.operations.add(out, 'commit', { id: 'c2' });
    out = G.operations.add(out, 'checkout', { target: 'main' });
    out = G.operations.add(out, 'merge', { target: 'feat' });
    var br = G.parse(out).elements.filter(function(e) { return e.kind === 'branch'; })[0];
    var after = G.operations.update(out, br.line, 'name', '機能A', { kind: 'branch' });
    expect(after).toContain('branch "機能A"');
    expect(after).toContain('merge "機能A"');
    expect(after).not.toContain('merge feat');
  });

  test('AU-6: 日本語から半角へ戻すと引用符が外れる', function() {
    var out = G.operations.add(base, 'branch', { name: '機能A' });
    var br = G.parse(out).elements.filter(function(e) { return e.kind === 'branch'; })[0];
    var after = G.operations.update(out, br.line, 'name', 'feat', { kind: 'branch' });
    expect(after).toContain('branch feat');
    expect(after).not.toContain('"feat"');
  });
});

describe('quadrantChart: 日本語の点名', function() {
  var t = Q.template();

  test('AU-7: 追加すると引用符が付く', function() {
    var out = Q.operations.add(t, 'point', { label: '試作品', x: 0.5, y: 0.5 });
    expect(out).toContain('"試作品": [0.5, 0.5]');
  });

  test('AU-8: 半角の点名には引用符を付けない', function() {
    var out = Q.operations.add(t, 'point', { label: 'Item A', x: 0.5, y: 0.5 });
    expect(out).toContain('Item A: [0.5, 0.5]');
  });

  test('AU-9: 読み直すと引用符が外れる (書き換えても重ならない)', function() {
    var out = Q.operations.add(t, 'point', { label: '試作品', x: 0.5, y: 0.5 });
    var pt = Q.parse(out).elements.filter(function(e) { return e.label === '試作品'; })[0];
    expect(pt && pt.label).toBe('試作品');
    var again = Q.operations.update(out, pt.line, 'label', '試作品', {});
    expect(again).toContain('"試作品": [0.5, 0.5]');
    expect(again).not.toContain('""');
  });
});
