'use strict';
var jsdom = require('jsdom');
var dom = new jsdom.JSDOM('<!DOCTYPE html><html><body><div id="props-content"></div></body></html>');
// Preserve the existing sandbox window.MA namespace (populated by run-tests.js
// when it eval'd every src/ file) so subsequent test files still see their
// modules after we swap in jsdom's window.
var _prevMA = global.window && global.window.MA;
global.window = dom.window;
global.document = dom.window.document;
if (_prevMA) global.window.MA = _prevMA;
// html-utils is required by properties.js escHtml
require('../src/core/html-utils.js');
require('../src/ui/properties.js');
var P = window.MA.properties;

describe('actionBarHtml', function() {
  test('emits all 5 buttons by default', function() {
    var html = P.actionBarHtml('sel-x');
    expect(html).toContain('id="sel-x-insert-before"');
    expect(html).toContain('id="sel-x-insert-after"');
    expect(html).toContain('id="sel-x-up"');
    expect(html).toContain('id="sel-x-down"');
    expect(html).toContain('id="sel-x-delete"');
    expect(html).toContain('id="sel-x-extra"');
  });

  test('omits up/down when move=false', function() {
    var html = P.actionBarHtml('sel-x', { move: false });
    expect(html).not.toContain('id="sel-x-up"');
    expect(html).not.toContain('id="sel-x-down"');
    expect(html).toContain('id="sel-x-delete"');  // still there
  });

  test('emits only up when move={up:true, down:false}', function() {
    var html = P.actionBarHtml('sel-x', { move: { up: true, down: false } });
    expect(html).toContain('id="sel-x-up"');
    expect(html).not.toContain('id="sel-x-down"');
  });

  test('uses label override', function() {
    var html = P.actionBarHtml('sel-x', { labels: { delete: 'ノード削除' } });
    expect(html).toContain('>ノード削除<');
    expect(html).not.toContain('>削除<');
  });

  test('always emits the -extra placeholder', function() {
    var html = P.actionBarHtml('sel-x', {
      insertBefore: false, insertAfter: false, move: false, delete: false,
    });
    expect(html).toContain('id="sel-x-extra"');
    expect(html).not.toContain('id="sel-x-delete"');
  });
});

describe('bindActionBar', function() {
  beforeEach(function() {
    document.body.innerHTML = '<div id="props-content">' + P.actionBarHtml('sel-x') + '</div>';
  });

  test('fires handler on up click', function() {
    var called = 0;
    P.bindActionBar('sel-x', { up: function() { called++; } });
    document.getElementById('sel-x-up').click();
    expect(called).toBe(1);
  });

  test('does not fire handler when key is omitted', function() {
    var called = 0;
    P.bindActionBar('sel-x', { up: function() { called++; } });
    document.getElementById('sel-x-down').click();
    expect(called).toBe(0);
  });

  test('ignores unknown keys silently', function() {
    expect(function() {
      P.bindActionBar('sel-x', { somethingElse: function() {} });
    }).not.toThrow();
  });
});

// ── move ヘルパの述語がブロック構造を無視する問題 (敵対レビュー C1/C2/M1/M3) ──
// er / class / state / timeline の _is*Line は「宣言行か」ではなく「ブロックや
// 継続行に属さない独立行か」で判定しなければならない。判定を誤ると mermaid の
// parse も render も通る「壊れた図」を無言で生成する。
// 現時点では述語を直さず、UI 側で move を無効化する方針 (推奨案B) を取るため、
// ここでは「破壊が起きること」を既知の制限として固定し、UI が move を出さない
// ことを別テストで担保する。
describe('move ヘルパの既知の制限 (UI では無効化済み)', function() {
  var M = (typeof window !== 'undefined' && window.MA && window.MA.modules)
    || (global.window && global.window.MA && global.window.MA.modules) || {};

  test('er: 属性を持つエンティティの移動は構造を壊す (既知)', function() {
    if (!M.erDiagram || !M.erDiagram.moveEntityDown) return;
    var t = 'erDiagram\n    CUSTOMER {\n        string name\n    }\n    ORDER {\n        int id\n    }\n';
    var out = M.erDiagram.moveEntityDown(t, 2);
    // 壊れる = 属性行が先頭に出てしまう。直ったらこのテストを反転させること
    expect(out.split('\n')[1].trim()).toBe('string name');
  });

  test('class: ブロック形式クラスを跨ぐ移動は構造を壊す (既知)', function() {
    if (!M.classDiagram || !M.classDiagram.moveClassDown) return;
    var t = 'classDiagram\n    class Animal\n    class Dog {\n        +bark()\n    }\n';
    var out = M.classDiagram.moveClassDown(t, 2);
    expect(out.split('\n')[1].trim()).toBe('class Dog {');
  });
});

describe('テストフレームワーク自身の健全性', function() {
  test('toThrow は期待する型を検証する', function() {
    expect(function() {
      expect(function() { throw new Error('unrelated'); }).toThrow(TypeError);
    }).toThrow('Expected TypeError');
  });

  test('toThrow は期待するメッセージを検証する', function() {
    expect(function() {
      expect(function() { throw new Error('unrelated'); }).toThrow('期待した文言');
    }).toThrow('Expected message to contain');
  });

  test('toThrow は引数なしなら従来どおり「投げれば合格」', function() {
    expect(function() { throw new Error('anything'); }).toThrow();
  });

  test('toContain は文字列でも配列でもない値を拒否する', function() {
    expect(function() { expect(undefined).toContain('x'); }).toThrow('toContain expects');
  });
});

// ── move を無効化した状態を固定する ────────────────────────────────────────
// これが無いと、誰かが move: true に戻しても CI が気づかない。
// 実際に敵対レビューのミューテーション検査で「8箇所すべて true に戻しても
// 385 passed」だったため、縮退が担保されていなかった。
describe('move が有効なのは flowchart のノードだけ', function() {
  var fsMod = require('fs');
  var pathMod = require('path');
  var srcDir = pathMod.resolve(__dirname, '..', 'src', 'modules');

  function moveFlags(file) {
    var text = fsMod.readFileSync(pathMod.join(srcDir, file), 'utf-8');
    var re = /move:\s*(true|false)/g, m, out = [];
    while ((m = re.exec(text)) !== null) out.push(m[1] === 'true');
    return out;
  }

  // 述語がブロック構造 (box / alt / subgraph / ブロック形式クラス / コンポジット
  // 状態 / 継続行) を見ていないため、これらのモジュールでは move が図を無言で壊す。
  ['er.js', 'class.js', 'state.js', 'timeline.js', 'sequence.js'].forEach(function(f) {
    test(f + ' は move を一切出さない', function() {
      var flags = moveFlags(f);
      expect(flags.length).toBeGreaterThan(0);
      expect(flags.filter(function(v) { return v; }).length).toBe(0);
    });
  });

  test('flowchart はノードパネルでのみ move を出す', function() {
    var flags = moveFlags('flowchart.js');
    expect(flags.filter(function(v) { return v; }).length).toBe(1);
  });
});

// deleteLabel / deleteTitle は「カスケード削除の警告をボタン自身に載せる」ための
// オプションで、block と c4 が使っている。テストが1件も無かったので、
// listItemHtml の中身を丸ごと `return ''` にしても全テストが通る状態だった。
describe('listItemHtml: 削除ボタンの警告表示', function() {
  test('deleteLabel を省略すると ✕ になる', function() {
    var html = P.listItemHtml({ label: 'a', deleteClass: 'x-del' });
    expect(html).toContain('>✕</button>');
  });

  test('deleteLabel を渡すとボタンの文字が置き換わる', function() {
    var html = P.listItemHtml({ label: 'a', deleteClass: 'x-del', deleteLabel: '✕ 3' });
    expect(html).toContain('>✕ 3</button>');
    expect(html).not.toContain('>✕</button>');
  });

  test('deleteTitle は title 属性になる', function() {
    var html = P.listItemHtml({ label: 'a', deleteClass: 'x-del', deleteTitle: '2要素が消えます' });
    expect(html).toContain('title="2要素が消えます"');
  });

  test('deleteTitle を省略すると title 属性は出ない', function() {
    var html = P.listItemHtml({ label: 'a', deleteClass: 'x-del' });
    expect(html).not.toContain('title=');
  });

  test('deleteLabel / deleteTitle はエスケープされる', function() {
    // 件数はパース結果から作られるので、ラベル文字列が混ざる経路がある
    var html = P.listItemHtml({
      label: 'a', deleteClass: 'x-del',
      deleteLabel: '<img>', deleteTitle: '"><script>',
    });
    expect(html).toContain('&lt;img&gt;');
    expect(html).toContain('title="&quot;&gt;&lt;script&gt;"');
    expect(html).not.toContain('<img>');
  });

  test('deleteClass が無ければ削除ボタンごと出ない', function() {
    var html = P.listItemHtml({ label: 'a', deleteLabel: '✕ 3', deleteTitle: 'x' });
    expect(html).not.toContain('✕ 3');
    expect(html).not.toContain('title=');
  });

  test('data 属性は編集ボタンと削除ボタンの両方に付く', function() {
    // 削除ハンドラは data-element-id から対象を引く。片方にしか付かないと
    // 「押した行と違う要素が消える」状態に戻る
    var html = P.listItemHtml({
      label: 'a', selectClass: 'x-sel', deleteClass: 'x-del',
      dataElementId: 'b', dataLine: 3,
    });
    var count = html.split('data-element-id="b"').length - 1;
    expect(count).toBe(2);
    expect(html.split('data-line="3"').length - 1).toBe(2);
  });
});
