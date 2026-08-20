'use strict';
// オーバーレイの座標変換。
//
// flowchart の buildOverlay は getBBox() の値をそのまま矩形にしていた。
// getBBox は要素自身の座標系での箱を返し、mermaid はノードを
// transform="translate(...)" で配置するので、**4ノードすべてのオーバーレイが
// (-48,-29) に重なっていた**。DOM 上はもっともらしく見えるのに画面では完全に
// 別の場所で、一番上の矩形しか押せず、しかもそれが全ノードの代理をしていた。

var jsdom = require('jsdom');
var dom = new jsdom.JSDOM('<!DOCTYPE html><html><body></body></html>');
var _prevMA = global.window && global.window.MA;
global.window = dom.window;
global.document = dom.window.document;
if (_prevMA) global.window.MA = _prevMA;
require('../src/ui/overlay-geom.js');
var G = window.MA.overlayGeom;

// jsdom は getBBox も getScreenCTM も持たないので、必要な形だけ自前で組む。
// 行列は SVGMatrix と同じ意味 (a,b,c,d,e,f) で、multiply / inverse だけ実装する。
function mat(a, b, c, d, e, f) {
  return {
    a: a, b: b, c: c, d: d, e: e, f: f,
    multiply: function(o) {
      return mat(
        this.a * o.a + this.c * o.b,
        this.b * o.a + this.d * o.b,
        this.a * o.c + this.c * o.d,
        this.b * o.c + this.d * o.d,
        this.a * o.e + this.c * o.f + this.e,
        this.b * o.e + this.d * o.f + this.f
      );
    },
    inverse: function() {
      var det = this.a * this.d - this.b * this.c;
      if (!det) throw new Error('singular');
      return mat(this.d / det, -this.b / det, -this.c / det, this.a / det,
        (this.c * this.f - this.d * this.e) / det,
        (this.b * this.e - this.a * this.f) / det);
    },
  };
}
function ident() { return mat(1, 0, 0, 1, 0, 0); }

function fakeSvg(ctm) {
  return {
    getScreenCTM: function() { return ctm; },
    createSVGPoint: function() {
      return {
        x: 0, y: 0,
        matrixTransform: function(m) {
          return { x: m.a * this.x + m.c * this.y + m.e, y: m.b * this.x + m.d * this.y + m.f };
        },
      };
    },
  };
}
function fakeEl(bbox, ctm) {
  return { getBBox: function() { return bbox; }, getScreenCTM: function() { return ctm; } };
}

describe('boxInSvgSpace', function() {
  test('OG-1: 親の translate を反映する', function() {
    // ノードは自分の原点まわりに -48..48 の箱を持ち、(200, 100) へ配置されている
    var svg = fakeSvg(ident());
    var el = fakeEl({ x: -48, y: -29, width: 96, height: 58 }, mat(1, 0, 0, 1, 200, 100));
    var b = G.boxInSvgSpace(svg, el);
    expect(b.x).toBe(152);
    expect(b.y).toBe(71);
    expect(b.width).toBe(96);
    expect(b.height).toBe(58);
  });

  test('OG-2: 生の bbox をそのまま返してはいけない', function() {
    var svg = fakeSvg(ident());
    var el = fakeEl({ x: -48, y: -29, width: 96, height: 58 }, mat(1, 0, 0, 1, 200, 100));
    expect(G.boxInSvgSpace(svg, el).x).not.toBe(-48);
  });

  test('OG-3: ルート側の変換を打ち消す', function() {
    // ルートSVG自体が (10,20) にあり2倍で表示されていても、
    // 返るのは viewBox 座標系の値
    var svg = fakeSvg(mat(2, 0, 0, 2, 10, 20));
    var el = fakeEl({ x: 0, y: 0, width: 50, height: 20 }, mat(2, 0, 0, 2, 210, 220));
    var b = G.boxInSvgSpace(svg, el);
    expect(b.x).toBe(100);
    expect(b.y).toBe(100);
    expect(b.width).toBe(50);
    expect(b.height).toBe(20);
  });

  test('OG-4: 回転していても軸平行の外接矩形を返す', function() {
    // 90度回転: (a,b,c,d) = (0,1,-1,0)
    var svg = fakeSvg(ident());
    var el = fakeEl({ x: 0, y: 0, width: 10, height: 4 }, mat(0, 1, -1, 0, 100, 100));
    var b = G.boxInSvgSpace(svg, el);
    expect(b.width).toBe(4);
    expect(b.height).toBe(10);
  });

  test('OG-5: CTM が取れなければ null (生 bbox で代用しない)', function() {
    var svg = fakeSvg(ident());
    expect(G.boxInSvgSpace(svg, fakeEl({ x: 0, y: 0, width: 1, height: 1 }, null))).toBeNull();
    expect(G.boxInSvgSpace(fakeSvg(null), fakeEl({ x: 0, y: 0, width: 1, height: 1 }, ident()))).toBeNull();
  });

  test('OG-6: 引数が欠けても落ちない', function() {
    expect(G.boxInSvgSpace(null, null)).toBeNull();
    expect(G.boxInSvgSpace(fakeSvg(ident()), {})).toBeNull();
  });
});

describe('idFromSvgNodeId', function() {
  test('OG-7: flowchart-A-0 から A を取る', function() {
    expect(G.idFromSvgNodeId('flowchart-A-0', 'flowchart')).toBe('A');
  });

  test('OG-8: ID にハイフンがあっても壊れない', function() {
    // '-' で split すると 'my' になってしまう
    expect(G.idFromSvgNodeId('flowchart-my-node-12', 'flowchart')).toBe('my-node');
  });

  test('OG-9: 形式が違えば null', function() {
    expect(G.idFromSvgNodeId('flowchart-A', 'flowchart')).toBeNull();
    expect(G.idFromSvgNodeId('state-A-0', 'flowchart')).toBeNull();
    expect(G.idFromSvgNodeId('', 'flowchart')).toBeNull();
    expect(G.idFromSvgNodeId(null, 'flowchart')).toBeNull();
  });

  test('OG-10: 末尾の数字だけを落とす', function() {
    expect(G.idFromSvgNodeId('flowchart-A1-0', 'flowchart')).toBe('A1');
  });
});

describe('hitRect', function() {
  test('OG-11: 余白を足した矩形になる', function() {
    var r = G.hitRect(document, { x: 10, y: 20, width: 30, height: 40 },
      { id: 'a', kind: 'node', line: 3 });
    expect(r.getAttribute('x')).toBe('8');
    expect(r.getAttribute('y')).toBe('18');
    expect(r.getAttribute('width')).toBe('34');
    expect(r.getAttribute('height')).toBe('44');
  });

  test('OG-12: クリック処理が使う属性を必ず付ける', function() {
    // app.js の overlay ハンドラは data-element-kind と data-element-id の
    // 両方が揃って初めて選択する。片方欠けると「押しても何も起きない」に戻る
    var r = G.hitRect(document, { x: 0, y: 0, width: 1, height: 1 },
      { id: 'b', kind: 'block', line: 2 });
    expect(r.getAttribute('data-element-id')).toBe('b');
    expect(r.getAttribute('data-element-kind')).toBe('block');
    expect(r.getAttribute('data-line')).toBe('2');
  });

  test('OG-13: 選択中だけ枠線を出す', function() {
    var on = G.hitRect(document, { x: 0, y: 0, width: 1, height: 1 },
      { id: 'a', kind: 'node', selected: true });
    var off = G.hitRect(document, { x: 0, y: 0, width: 1, height: 1 },
      { id: 'a', kind: 'node', selected: false });
    expect(on.getAttribute('stroke')).toBe('#7ee787');
    expect(off.getAttribute('stroke')).toBe('none');
  });

  test('OG-14: 幅が負にならない', function() {
    var r = G.hitRect(document, { x: 0, y: 0, width: 0, height: 0 },
      { id: 'a', kind: 'node', pad: 0 });
    expect(r.getAttribute('width')).toBe('0');
  });
});
