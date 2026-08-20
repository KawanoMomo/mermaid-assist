'use strict';
// rich-label-editor は127行あるが、run-tests.js の sourceFiles に載っておらず
// ユニットテストが1件も無かった。読み込まれてすらいないので構文エラーすら
// 検出されない状態だった。
//
// そのまま読み直したところ、B/I/↵ を押すたびに入力位置が失われることが分かった:
// ツールバーは change を発火し、それが ctx.setMmdText → ctx.onUpdate →
// refresh → renderProps を回して、renderProps はプロパティパネルを innerHTML で
// 作り直す。編集中だった textarea は DOM から外れるので focus もキャレットも消える。
// 装飾を2つ付けるだけで「クリックし直して選択し直す」が毎回要る。

var jsdom = require('jsdom');
var dom = new jsdom.JSDOM('<!DOCTYPE html><html><body><div id="rle-host"></div></body></html>');
var _prevMA = global.window && global.window.MA;
global.window = dom.window;
global.document = dom.window.document;
if (_prevMA) global.window.MA = _prevMA;
require('../src/ui/rich-label-editor.js');
var R = window.MA.richLabelEditor;

// アプリと同じ順序で「ツールバー押下 → onChange → パネル再構築 → 再mount」を回す。
// container を毎回作り直すのは、renderProps が propsEl.innerHTML を差し替えるため
// rle のコンテナ要素自体が別ノードになるから。id だけが同じで残る。
function mountLoop(containerId, initialLabel) {
  var state = { label: initialLabel, mounts: 0, api: null };
  var host = document.body;
  function place() {
    var old = document.getElementById(containerId);
    if (old) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.id = containerId;
    host.appendChild(el);
    return el;
  }
  function doMount() {
    state.mounts++;
    var el = place();
    state.api = R.mount(el, state.label, function(v) {
      state.label = v;
      doMount();
    });
  }
  doMount();
  state.textarea = function() { return document.getElementById(containerId).querySelector('.rle-textarea'); };
  state.click = function(cls) {
    document.getElementById(containerId).querySelector(cls)
      .dispatchEvent(new window.Event('click'));
  };
  return state;
}

describe('richLabelEditor.mermaidToHtml', function() {
  test('RLE-1: 素のテキストはそのまま', function() {
    expect(R.mermaidToHtml('abc')).toBe('abc');
  });

  test('RLE-2: <b> <i> はタグとして復元される', function() {
    expect(R.mermaidToHtml('<b>太字</b>')).toBe('<b>太字</b>');
    expect(R.mermaidToHtml('<i>斜体</i>')).toBe('<i>斜体</i>');
  });

  test('RLE-3: <br/> と実改行はどちらも <br> になる', function() {
    expect(R.mermaidToHtml('A<br/>B')).toBe('A<br>B');
    expect(R.mermaidToHtml('A<br />B')).toBe('A<br>B');
    expect(R.mermaidToHtml('A\nB')).toBe('A<br>B');
  });

  test('RLE-4: 未対応タグはエスケープされる (プレビューは innerHTML に入る)', function() {
    expect(R.mermaidToHtml('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('RLE-5: 属性つきの <b> は復元しない', function() {
    // 復元してしまうと onmouseover などがそのまま innerHTML に入る
    expect(R.mermaidToHtml('<b onmouseover=x>y</b>'))
      .toBe('&lt;b onmouseover=x&gt;y&lt;/b&gt;');
  });

  test('RLE-6: 閉じていない <b> は復元しない', function() {
    expect(R.mermaidToHtml('<b>abc')).toBe('&lt;b&gt;abc');
  });

  test('RLE-7: 空・null は空文字', function() {
    expect(R.mermaidToHtml('')).toBe('');
    expect(R.mermaidToHtml(null)).toBe('');
  });
});

describe('richLabelEditor.insertWrapAtSelection', function() {
  function fakeTextarea(value, start, end) {
    var ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.value = value;
    ta.setSelectionRange(start, end);
    return ta;
  }

  test('RLE-8: 選択範囲を囲み、キャレットを閉じタグの手前に置く', function() {
    var ta = fakeTextarea('こんにちは世界', 0, 5);
    R.insertWrapAtSelection(ta, '<b>', '</b>');
    expect(ta.value).toBe('<b>こんにちは</b>世界');
    expect(ta.selectionStart).toBe(8);
  });

  test('RLE-9: 選択が無いときは空のタグ対を挿入する', function() {
    var ta = fakeTextarea('abc', 3, 3);
    R.insertWrapAtSelection(ta, '<i>', '</i>');
    expect(ta.value).toBe('abc<i></i>');
    expect(ta.selectionStart).toBe(6);
  });
});

describe('richLabelEditor: ツールバー押下で入力位置が失われない', function() {
  test('RLE-10: B を押すと DSL に反映される', function() {
    var s = mountLoop('rle-t1', 'こんにちは世界');
    s.textarea().setSelectionRange(0, 5);
    s.click('.rle-b');
    expect(s.label).toBe('<b>こんにちは</b>世界');
  });

  test('RLE-11: パネルが作り直されても focus が残る', function() {
    var s = mountLoop('rle-t2', 'こんにちは世界');
    var before = s.textarea();
    before.focus();
    before.setSelectionRange(0, 5);
    s.click('.rle-b');
    var after = s.textarea();
    // 再構築されたことを確かめたうえで focus を見る。同じノードのままなら
    // このテストは何も証明していない
    expect(after === before).toBe(false);
    expect(document.activeElement === after).toBe(true);
  });

  test('RLE-12: キャレットが閉じタグの手前に復元される', function() {
    var s = mountLoop('rle-t3', 'こんにちは世界');
    s.textarea().focus();
    s.textarea().setSelectionRange(0, 5);
    s.click('.rle-b');
    expect(s.textarea().selectionStart).toBe(8);
  });

  test('RLE-13: 続けて I を押しても位置が保たれる', function() {
    var s = mountLoop('rle-t4', 'abcdef');
    s.textarea().focus();
    s.textarea().setSelectionRange(0, 3);
    s.click('.rle-b');
    s.textarea().setSelectionRange(3, 6);   // <b>abc| の続きを選ぶ
    s.click('.rle-i');
    expect(s.label).toBe('<b><i>abc</i></b>def');
    expect(document.activeElement === s.textarea()).toBe(true);
  });

  test('RLE-14: ↵ は <br/> として DSL に入り、キャレットは改行の直後', function() {
    var s = mountLoop('rle-t5', 'AB');
    s.textarea().focus();
    s.textarea().setSelectionRange(1, 1);
    s.click('.rle-newline');
    expect(s.label).toBe('A<br/>B');
    // textarea 側は実改行で表示されるので位置は 2
    expect(s.textarea().value).toBe('A\nB');
    expect(s.textarea().selectionStart).toBe(2);
  });

  test('RLE-15b: 復元は1回きりで、後の再描画に持ち越さない', function() {
    // 記録した位置をクリアしないと、あとで無関係な理由でパネルが作り直された
    // ときに古いキャレットで focus を奪い返してしまう
    var s = mountLoop('rle-t7', 'abcdef');
    s.textarea().focus();
    s.textarea().setSelectionRange(0, 3);
    s.click('.rle-b');           // ここで復元が1回消費される
    s.textarea().blur();
    var mountsBefore = s.mounts;
    // ツールバーとは無関係な再描画を模す
    R.mount(document.getElementById('rle-t7'), s.label, function() {});
    expect(s.mounts).toBe(mountsBefore);
    expect(document.activeElement === document.getElementById('rle-t7').querySelector('.rle-textarea')).toBe(false);
  });

  test('RLE-15: 別コンテナの mount は復元位置を横取りしない', function() {
    var a = mountLoop('rle-t6', 'abcdef');
    a.textarea().focus();
    a.textarea().setSelectionRange(0, 3);
    a.click('.rle-b');
    var focusedAfterA = document.activeElement;
    // 別のパネルが開いた場合を模す
    var other = document.createElement('div');
    other.id = 'rle-other';
    document.body.appendChild(other);
    R.mount(other, 'zzz', function() {});
    expect(document.activeElement === focusedAfterA).toBe(true);
  });
});

describe('richLabelEditor: DSL との往復', function() {
  test('RLE-16: <br/> は textarea では実改行として見える', function() {
    var el = document.createElement('div');
    el.id = 'rle-rt1';
    document.body.appendChild(el);
    var api = R.mount(el, 'A<br/>B', function() {});
    expect(api.element.value).toBe('A\nB');
  });

  test('RLE-17: getValue は実改行を <br/> に戻す', function() {
    var el = document.createElement('div');
    el.id = 'rle-rt2';
    document.body.appendChild(el);
    var api = R.mount(el, 'A<br/>B', function() {});
    expect(api.getValue()).toBe('A<br/>B');
  });

  test('RLE-18: setValue も同じ変換を使う', function() {
    var el = document.createElement('div');
    el.id = 'rle-rt3';
    document.body.appendChild(el);
    var api = R.mount(el, '', function() {});
    api.setValue('X<br/>Y<br/>Z');
    expect(api.element.value).toBe('X\nY\nZ');
    expect(api.getValue()).toBe('X<br/>Y<br/>Z');
  });
});
