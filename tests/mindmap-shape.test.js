'use strict';
// mindmap の文字を変えても形状が失われないこと。
//
// A 区分83件の抜き取り再検証 (Y8) の途中で見つかった。
// A27「形状記号を含むラベルの前半が黙って消える」は今も直っていたが、
// **別の欠陥がその隣にあった**。
//
// 契約入口が `updateNodeText(text, line, opts.text || value, opts.shape || value)` と
// 書かれており、`field='text'` で呼ぶと **新しい文字が形状として渡っていた**。
// shapeToText は知らない形状名を既定として扱うので、文字を変えるだけで形状が消える。
//
//   root((組み込み設計))  →  root新しい根
//
// `root` の接頭辞が文字に食い込んで、mindmap の根の指定ごと別物になっていた。
// エラーは出ないので、図の見た目が変わったことにしか気付けない。

var K = window.MA.modules.mindmap;

function lineOf(t, n) { return t.split('\n')[n - 1]; }

describe('mindmap: 文字を変えても形状が残る', function() {
  var t = K.template();
  function root() { return K.parse(t).elements[0]; }
  function child() { return K.parse(t).elements[1]; }

  test('MS-1: root の円形状が残る', function() {
    var el = root();
    var out = K.operations.update(t, el.line, 'text', '新しい根', { kind: el.kind, id: el.id });
    expect(lineOf(out, el.line)).toContain('root((新しい根))');
  });

  test('MS-2: root の指定 (接頭辞) が残る', function() {
    var el = root();
    var out = K.operations.update(t, el.line, 'text', '新しい根', { kind: el.kind, id: el.id });
    expect(K.parse(out).elements[0].shape).toBe('circle');
    expect(K.parse(out).elements[0].text).toBe('新しい根');
  });

  test('MS-3: 記号入りの文字でも形状が残る', function() {
    var el = root();
    var out = K.operations.update(t, el.line, 'text', '設計(詳細)', { kind: el.kind, id: el.id });
    var after = K.parse(out).elements[0];
    expect(after.shape).toBe('circle');
    expect(after.text).toBe('設計(詳細)');
  });

  test('MS-4: 形状を持たない節はそのまま', function() {
    var el = child();
    var out = K.operations.update(t, el.line, 'text', 'ハード', { kind: el.kind, id: el.id });
    expect(lineOf(out, el.line).trim()).toBe('ハード');
  });

  test('MS-5: 記号入りなら囲む (A27 の挙動は維持)', function() {
    var el = child();
    var out = K.operations.update(t, el.line, 'text', '設計(詳細)', { kind: el.kind, id: el.id });
    var after = K.parse(out).elements.filter(function(e) { return e.line === el.line; })[0];
    expect(after.text).toBe('設計(詳細)');
  });

  test('MS-6: 形状だけ変えると文字は残る', function() {
    var el = root();
    var out = K.operations.update(t, el.line, 'shape', 'hexagon', { kind: el.kind, id: el.id });
    expect(K.parse(out).elements[0].text).toBe('組み込み設計');
    expect(K.parse(out).elements[0].shape).toBe('hexagon');
  });

  test('MS-7: 形状を明示すれば変えられる (updateNodeText 直呼び)', function() {
    var el = root();
    expect(lineOf(K.updateNodeText(t, el.line, 'X', 'hexagon'), el.line)).toContain('root{{X}}');
  });
});
