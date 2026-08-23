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
// 見出しは「flowchart のノードだけ」だったが、G1 で class.js が契約経路
// (operations.moveUp) に載せ替えられて再び有効になっている。中のテストは更新
// されていたのに見出しだけが古い主張のまま残っていた。
describe('move を出すのは flowchart のノードと class のクラスだけ', function() {
  var fsMod = require('fs');
  var pathMod = require('path');
  var srcDir = pathMod.resolve(__dirname, '..', 'src', 'modules');

  function moveFlags(file) {
    var text = fsMod.readFileSync(pathMod.join(srcDir, file), 'utf-8');
    var re = /move:\s*(true|false)/g, m, out = [];
    while ((m = re.exec(text)) !== null) out.push(m[1] === 'true');
    return out;
  }

  // 述語がブロック構造 (box / alt / subgraph / コンポジット状態 / 継続行) を
  // 見ていないため、これらのモジュールでは move が図を無言で壊す。
  //
  // **class.js はこの一覧から外した (G1、2026-08-22)。**
  // 止めていた理由は `_moveClassStep` の `_is*Line` がブロック形式のクラスを
  // 他クラスの本体に飲み込ませることだったが、UI を契約経路
  // (`operations.moveUp` → `moveElementLine`) に差し替えて解消した。
  // 実測 (`class Animal {…} class Dog {…} class Cat {…}` で Dog を上へ):
  //   古い経路 → **変化なし** (空振り) / 契約経路 → Dog,Animal,Cat にブロックごと移動
  //
  // er.js / state.js は**外していない**。要素の `line` が宣言行ではなく
  // 関係行を指しており (実測: er は両方 line=2 の関係行、state は遷移行)、
  // 動かしても並びが変わらない。
  ['er.js', 'state.js', 'timeline.js', 'sequence.js'].forEach(function(f) {
    test(f + ' は move を一切出さない', function() {
      var flags = moveFlags(f);
      expect(flags.length).toBeGreaterThan(0);
      expect(flags.filter(function(v) { return v; }).length).toBe(0);
    });
  });

  test('class.js はクラスパネルでのみ move を出す', function() {
    var flags = moveFlags('class.js');
    // クラスパネルだけ true。関連パネルは false のまま
    expect(flags.filter(function(v) { return v; }).length).toBe(1);
  });

  test('class.js の move は契約経路を呼ぶ', function() {
    var fs2 = require('fs');
    var p2 = require('path');
    var text = fs2.readFileSync(p2.resolve(__dirname, '..', 'src', 'modules', 'class.js'), 'utf-8');
    // 空振りした古い実装をパネルから呼んでいないこと
    expect(/var newText = moveClassUp\(/.test(text)).toBe(false);
    expect(/var newText = moveClassDown\(/.test(text)).toBe(false);
    expect(/classDiagram\.operations\.moveUp\(/.test(text)).toBe(true);
    expect(/classDiagram\.operations\.moveDown\(/.test(text)).toBe(true);
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
    // deleteTitle が渡すのは動作の説明だけで、どの行かは listItemHtml が付ける。
    var html = P.listItemHtml({ label: 'a', deleteClass: 'x-del', deleteTitle: '削除すると 2 要素が消えます' });
    expect(html).toContain('title="「a」を削除すると 2 要素が消えます"');
  });

  test('deleteTitle を渡してもラベルが二重にならない', function() {
    // 既定値に行ラベルを含めたうえで、その前にもう一度ラベルを前置していたため
    // 「a」「a」を削除 と読み上げられていた。この関数を通る 41 か所のうち
    // deleteTitle を渡すのは 5 か所だけなので、既定側が壊れると影響は全経路に及ぶ。
    var withTitle = P.listItemHtml({ label: 'a', deleteClass: 'x-del', deleteTitle: '削除' });
    var withoutTitle = P.listItemHtml({ label: 'a', deleteClass: 'x-del' });
    [withTitle, withoutTitle].forEach(function(html) {
      var m = html.match(/aria-label="([^"]*)"[^>]*>✕</);
      expect(m).not.toBeNull();
      expect(m[1]).toBe('「a」を削除');
      expect(m[1].indexOf('「a」「a」')).toBe(-1);
    });
  });

  // 以前はここで「省略すると title は出ない」を固定していた。
  // 一覧行の削除ボタンは記号 (✕) だけなので、title が無いと何が消えるのか
  // 読み取れない。R7 (一貫性) がこれを発見可能性の欠陥として指摘したため、
  // 省略時はラベルから既定の説明を作る仕様に変えた。
  test('deleteTitle を省略するとラベルから既定の説明が入る', function() {
    var html = P.listItemHtml({ label: 'a', deleteClass: 'x-del' });
    expect(html).toContain('title=');
    expect(html).toContain('「a」を削除');
  });

  test('deleteLabel / deleteTitle はエスケープされる', function() {
    // 件数はパース結果から作られるので、ラベル文字列が混ざる経路がある
    var html = P.listItemHtml({
      label: 'a', deleteClass: 'x-del',
      deleteLabel: '<img>', deleteTitle: '"><script>',
    });
    expect(html).toContain('&lt;img&gt;');
    expect(html).toContain('title="「a」を&quot;&gt;&lt;script&gt;"');
    expect(html).not.toContain('<img>');
    expect(html).not.toContain('<script>');
  });

  test('deleteClass が無ければ削除ボタンごと出ない', function() {
    var html = P.listItemHtml({ label: 'a', deleteLabel: '✕ 3', deleteTitle: 'x' });
    expect(html).not.toContain('✕ 3');
    // 元は `not.toContain('title=')` だったが、**行のどこにも title が無いこと**を
    // 見ていた。UI-069 で名前欄に title を足した (切れた名前をホバーで読むため)
    // ので、この書き方では意図しない所に反応する。
    // 見たいのは「**削除ボタンの** title が漏れないこと」なので、値で見る。
    expect(html).not.toContain('title="x"');
    expect(html).not.toContain('<button');
    // aria-label はボタンにしか付かないので、ボタンが出ていないことの裏付けになる。
    expect(html).not.toContain('aria-label=');
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

// ── 削除ボタンの警告表示の配線 ─────────────────────────────────────────────
// deletionImpact 自体は手厚くテストされているのに、その結果を UI に出す経路には
// テストが無く、ミューテーション検査で delLabel / delTitle を無効化しても全通過
// していた (SURVIVED)。カスケード削除の唯一の警告なので固定する。
describe('listItemHtml: 支援技術に届く名前', function() {
  // master 側の describe が deleteLabel / deleteTitle の中身を固定しているので、
  // ここは「支援技術から見た名前」だけを見る。title は button の名前にならず
  // (中身のテキスト `✕5` が名前になる)、カスケード削除の件数が読み上げに
  // 一切現れなかったので、aria-label 側を固定する。
  test('W4: 件数は説明 (aria-describedby) に入り、名前は識別だけを持つ', function() {
    // title と aria-label を同一文字列にしていたとき、Chromium は「名前に採用されな
    // かった title」を description に回すため name と description がバイト一致し、
    // 支援技術が同じ全文を2回読んでいた (20要素の C4 で削除ボタン39個すべてが
    // description === name。実測)。
    // 名前 = 識別、説明 = 件数、に分ける。
    var html = P.listItemHtml({ label: 'foo', deleteClass: 'x-del', deleteLabel: '✕5', deleteTitle: '削除すると 3 要素が消えます' });
    var aria = html.match(/aria-label="([^"]*)"[^>]*>✕5</);
    expect(aria).not.toBeNull();
    expect(aria[1]).toBe('「foo」を削除');
    // 件数は消えていない。describedby の指す先に入っている。
    var by = html.match(/aria-describedby="([^"]*)"/);
    expect(by).not.toBeNull();
    var span = html.match(new RegExp('<span id="' + by[1] + '"[^>]*>([^<]*)</span>'));
    expect(span).not.toBeNull();
    expect(span[1]).toContain('3 要素が消えます');
  });

  test('W4b: 名前と説明が同じ文字列にならない', function() {
    // これが起きると支援技術が同じ全文を2回読む。
    function nameAndDesc(opts) {
      var html = P.listItemHtml(opts);
      var aria = html.match(/aria-label="([^"]*)"[^>]*>✕/);
      var by = html.match(/aria-describedby="([^"]*)"/);
      var title = html.match(/<button [^>]*class="x-del"[^>]*title="([^"]*)"/) ||
        html.match(/title="([^"]*)"[^>]*class="x-del"/);
      var desc = null;
      if (by) {
        var span = html.match(new RegExp('<span id="' + by[1] + '"[^>]*>([^<]*)</span>'));
        desc = span && span[1];
      } else if (title) {
        // describedby が無い場合、Chromium は title を description に回す。
        desc = title[1];
      }
      return { name: aria && aria[1], desc: desc };
    }
    // 警告あり
    var a = nameAndDesc({ label: 'foo', deleteClass: 'x-del', deleteLabel: '✕5', deleteTitle: '削除すると 3 要素が消えます' });
    expect(a.name).not.toBeNull();
    expect(a.name === a.desc).toBe(false);
    // 警告なし (この関数を通る 41 か所のうち 36 か所)。title を付けないので
    // description そのものが生まれない。
    var b = nameAndDesc({ label: 'foo', deleteClass: 'x-del' });
    expect(b.name).toBe('「foo」を削除');
    expect(b.desc).toBe(null);
  });

  test('W4c: 行ラベルの先頭空白は名前に持ち込まない', function() {
    // mindmap は階層を表すために行ラベルの先頭に空白を積む。そのまま名前にすると
    // 「␣␣␣␣子ノード」を削除 と読み上げられる。
    var html = P.listItemHtml({ label: '    子ノード', deleteClass: 'x-del', selectClass: 'x-sel' });
    var del = html.match(/aria-label="([^"]*)"[^>]*>✕/);
    var sel = html.match(/aria-label="([^"]*)"[^>]*>編集</);
    expect(del[1]).toBe('「子ノード」を削除');
    expect(sel[1]).toBe('「子ノード」を編集');
  });

  test('W5: 編集ボタンも行ごとに違う名前を持つ', function() {
    // 「編集」が12個すべて同名だと、支援技術のボタン一覧では選べない。
    //
    // 見るのはボタンの aria-label だけ。行の文字列にラベルが出るのは aria-label と
    // 無関係に当たり前なので、html 全体で contain していた版は selAria を空に
    // しても通ってしまった (ミューテーションで SURVIVED)。
    function ariaOf(label) {
      var m = P.listItemHtml({ label: label, selectClass: 'x-sel' })
        .match(/aria-label="([^"]*)"[^>]*>編集</);
      return m && m[1];
    }
    expect(ariaOf('受注')).not.toBeNull();
    expect(ariaOf('受注')).toContain('受注');
    expect(ariaOf('在庫')).toContain('在庫');
    expect(ariaOf('受注') === ariaOf('在庫')).toBe(false);
  });

  test('W6: ラベルと入力欄が for で結び付く', function() {
    // 付けないと placeholder が名前に流用され、Tech と Description がどちらも
    // 「省略可」という同じ名前になる。
    expect(P.fieldHtml('ラベル', 'x-label', '')).toContain('for="x-label"');
    expect(P.selectFieldHtml('親境界', 'x-parent', [])).toContain('for="x-parent"');
  });

});

// 「行の全文を title で読めるようにする」はここにまとめる。
// 同じ内容の W7 が2つの describe に重複していた (重複 describe の整理が中途だった)。
describe('一覧行の全文を title で読めるようにする', function() {
  test('W7: ラベルと補足が title に入る', function() {
    // `(in 親ID)` は行末にあるので真っ先に切れる。名前だけでは足りない。
    var html = P.listItemHtml({ label: 'core0 ("メインCPUコア")', sublabel: '(in cpu_group)', deleteClass: 'x' });
    var m = html.match(/<div title="([^"]*)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toContain('core0');
    expect(m[1]).toContain('cpu_group');
  });

  test('W8: 補足が無くてもラベルは title に入る', function() {
    var html = P.listItemHtml({ label: 'ext', deleteClass: 'x' });
    var m = html.match(/<div title="([^"]*)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toContain('ext');
  });
});
