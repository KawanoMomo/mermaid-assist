'use strict';
var block = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.blockBeta)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.blockBeta);
var P = (typeof window !== 'undefined' && window.MA && window.MA.properties)
  || (global.window && global.window.MA && global.window.MA.properties);

// block-beta は 1 行に複数ブロックを書くのが標準形。行番号だけでは対象を特定できない。
var T = 'block-beta\n  columns 3\n  a["Sensor"] b["MCU"] c["Actuator"]\n  a --> b\n  b --> c\n';

describe('D1: 1行に複数ブロックがある行の削除', function() {
  test('D1a: 2番目のブロックを消すと2番目だけが消える', function() {
    var out = block.deleteBlock(T, 3, 'b');
    expect(out).toContain('a["Sensor"]');
    expect(out).toContain('c["Actuator"]');
    expect(out).not.toContain('b["MCU"]');
  });

  test('D1b: 3番目のブロックを消すと3番目だけが消える', function() {
    var out = block.deleteBlock(T, 3, 'c');
    expect(out).toContain('a["Sensor"]');
    expect(out).toContain('b["MCU"]');
    expect(out).not.toContain('c["Actuator"]');
  });

  test('D1c: deletionImpact も指定した id を対象にする', function() {
    var p = block.parseBlock(T);
    var bEl = p.elements.filter(function(e) { return e.id === 'b'; })[0];
    var impact = block.deletionImpact(T, bEl);
    // b を消すと b 本体 + a-->b + b-->c の 2 リンク
    expect(impact.elements).toBe(1);
    expect(impact.relations).toBe(2);
  });
});

// bindDeleteButtons が data-element-id を deleteFn に渡すこと。
// これを渡さないと、モジュール側は行番号から対象を引くしかなく、
// 1行複数ブロックでは必ず先頭が選ばれてしまう。
describe('D2: bindDeleteButtons が要素IDを渡す', function() {
  function fakeBtn(attrs) {
    var handlers = {};
    return {
      getAttribute: function(n) { return attrs[n] === undefined ? null : attrs[n]; },
      addEventListener: function(ev, fn) { handlers[ev] = fn; },
      click: function() { if (handlers.click) handlers.click.call(this); },
    };
  }
  function fakeProps(btns) {
    return { querySelectorAll: function() { return btns; } };
  }

  test('D2a: deleteFn の第3引数に data-element-id が渡る', function() {
    var seen = null;
    var btn = fakeBtn({ 'data-line': '3', 'data-element-id': 'b' });
    var ctx = { getMmdText: function() { return T; }, setMmdText: function() {}, onUpdate: function() {} };
    P.bindDeleteButtons(fakeProps([btn]), 'x', ctx, function(t, ln, arg3) {
      seen = { ln: ln, arg3: arg3 };
      return t;
    });
    btn.click();
    expect(seen.ln).toBe(3);
    expect(seen.arg3).toBe('b');
  });

  test('D2b: useEndLine のときは従来どおり end-line が第3引数', function() {
    var seen = null;
    var btn = fakeBtn({ 'data-line': '2', 'data-end-line': '5', 'data-element-id': 'zzz' });
    var ctx = { getMmdText: function() { return T; }, setMmdText: function() {}, onUpdate: function() {} };
    P.bindDeleteButtons(fakeProps([btn]), 'x', ctx, function(t, ln, arg3) {
      seen = { ln: ln, arg3: arg3 };
      return t;
    }, true);
    btn.click();
    expect(seen.arg3).toBe(5);
  });
});
