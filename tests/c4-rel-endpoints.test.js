'use strict';
// リレーション追加フォームの From / To に境界が並んでいた。境界を端点にした Rel は
// mermaid.parse を通るのに mermaid.render が
// "Cannot read properties of undefined (reading 'x')" で落ちる ——
// 存在しない id を指したときとまったく同じ壊れ方をする。
//
// 実機 (mermaid v11.13.0) で確認したのは以下のすべてで NG:
//   自分を囲む境界 / 兄弟の境界 / 境界から境界 / トップレベル要素から境界 /
//   Container_Boundary
// つまり「この形なら通る」という例外は無い。選択肢に出す理由が無い。
//
// 選べるままだと、プルダウンで境界を選んで「+ リレーション追加」を押すだけで
// 描画不能な図ができあがり、UI 側には何の警告も出ない。
var jsdom = require('jsdom');
var dom = new jsdom.JSDOM('<!DOCTYPE html><html><body><div id="props-content"></div></body></html>');
var _prevMA = global.window && global.window.MA;
global.window = dom.window;
global.document = dom.window.document;
if (_prevMA) global.window.MA = _prevMA;

var c4 = window.MA.modules.c4;

var TEXT = [
  'C4Container',
  '    title T',
  '    Person(dev, "開発者")',
  '    Container_Boundary(ecu, "車載ECU") {',
  '        Container(cpu, "メインCPU", "C")',
  '        System_Boundary(inner, "内側") {',
  '            System(sub, "サブ")',
  '        }',
  '    }',
  ''
].join('\n');

// 何も選択していない状態でパネルを描くと、追加フォームが出る。
function renderAddForm() {
  var host = document.getElementById('props-content');
  host.innerHTML = '';
  c4.renderProps([], c4.parseC4(TEXT), host, {
    getMmdText: function() { return TEXT; },
    setMmdText: function() {},
    onUpdate: function() {}
  });
  return host;
}

function optionValues(selectId) {
  var sel = document.getElementById(selectId);
  if (!sel) return null;
  return Array.prototype.map.call(sel.querySelectorAll('option'), function(o) {
    return o.getAttribute('value');
  });
}

describe('リレーションの端点に境界を出さない', function() {
  test('R1: From / To の選択肢に境界の id が無い', function() {
    renderAddForm();
    var from = optionValues('c4-add-rel-from');
    var to = optionValues('c4-add-rel-to');
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();
    expect(from.indexOf('ecu')).toBe(-1);
    expect(from.indexOf('inner')).toBe(-1);
    expect(to.indexOf('ecu')).toBe(-1);
    expect(to.indexOf('inner')).toBe(-1);
  });

  test('R2: 境界でない要素は入れ子の奥にあっても選べる', function() {
    renderAddForm();
    var from = optionValues('c4-add-rel-from');
    expect(from.indexOf('dev')).toBeGreaterThan(-1);
    expect(from.indexOf('cpu')).toBeGreaterThan(-1);
    expect(from.indexOf('sub')).toBeGreaterThan(-1);
  });

  test('R3: 親境界の選択肢のほうは境界を出し続ける（別の用途なので巻き添えにしない）', function() {
    renderAddForm();
    var parent = optionValues('c4-add-parent');
    expect(parent.indexOf('ecu')).toBeGreaterThan(-1);
    expect(parent.indexOf('inner')).toBeGreaterThan(-1);
  });

  test('R4: 境界しか無い図では「要素を先に追加」だけが出る', function() {
    var host = document.getElementById('props-content');
    host.innerHTML = '';
    var onlyBoundaries = 'C4Context\n    title T\n    System_Boundary(b, "B") {\n    }\n';
    c4.renderProps([], c4.parseC4(onlyBoundaries), host, {
      getMmdText: function() { return onlyBoundaries; },
      setMmdText: function() {},
      onUpdate: function() {}
    });
    var from = optionValues('c4-add-rel-from');
    expect(from.length).toBe(1);
    expect(from[0]).toBe('');
  });
});
