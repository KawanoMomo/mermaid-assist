'use strict';
// E13 / UI-059: 版の正本を VERSION 1 つにし、残り(package.json・package-lock.json・画面)を導く。
// 版が同じでも中身が違うことは「コードの指紋」(src/core/build-id.js)で分かるようにする。
//
// 直す前の実測: VERSION 1.2.0 / package.json 1.0.0 / package-lock.json 1.0.0 / git の最新タグ v1.17.0。
// 画面と VERSION の一致だけはテストで固定されていた (version-stamp.test.js) が、残りは誰も見ていなかった。
var fs = require('fs');
var os = require('os');
var path = require('path');
var vm = require('vm');

var ROOT = path.resolve(__dirname, '..');
var V = require(path.join(ROOT, 'scripts', 'version.js'));

function tmpCopy() {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-version-'));
  ['VERSION', 'package.json', 'package-lock.json', 'mermaid-assist.html'].forEach(function(f) {
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  });
  return dir;
}

function loadBuildId(ns, styles) {
  var src = fs.readFileSync(path.join(ROOT, 'src', 'core', 'build-id.js'), 'utf8');
  var win = { MA: ns };
  vm.runInNewContext(src, { window: win, document: undefined, Math: Math, Object: Object, Function: Function });
  return win.MA.buildId;
}

describe('版の正本 (VERSION) と派生 3 箇所', function() {
  test('VERSION / package.json / package-lock.json / #status-version が同じ値', function() {
    var r = V.check(ROOT);
    expect(r.problems).toEqual([]);
    expect(r.values['package.json']).toBe(r.values.VERSION);
    expect(r.values['package-lock.json']).toBe(r.values.VERSION);
    expect(r.values['mermaid-assist.html']).toBe(r.values.VERSION);
  });

  test('1 箇所だけずれると check が名指しする', function() {
    var dir = tmpCopy();
    var p = path.join(dir, 'package.json');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/("version"\s*:\s*")[^"]*/, '$19.9.9'));
    var r = V.check(dir);
    expect(r.problems.length).toBe(1);
    expect(r.problems[0]).toContain('package.json');
  });

  test('set で 4 箇所が揃い、それぞれ 1 行だけ変わる', function() {
    var dir = tmpCopy();
    var before = {};
    ['VERSION', 'package.json', 'package-lock.json', 'mermaid-assist.html'].forEach(function(f) {
      before[f] = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
    });
    V.sync(dir, '9.8.7');
    var r = V.check(dir);
    expect(r.problems).toEqual([]);
    expect(r.values.VERSION).toBe('9.8.7');
    expect(r.values['mermaid-assist.html']).toBe('9.8.7');
    // 依存の version は触らない (package-lock.json は先頭と packages[""] の 2 行だけ)
    var expectLines = { 'VERSION': 1, 'package.json': 1, 'package-lock.json': 2, 'mermaid-assist.html': 1 };
    Object.keys(expectLines).forEach(function(f) {
      var after = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
      expect(after.length).toBe(before[f].length);
      var changed = 0;
      for (var i = 0; i < after.length; i++) if (after[i] !== before[f][i]) changed++;
      expect(changed).toBe(expectLines[f]);
    });
  });

  test('x.y.z でない版は書かない', function() {
    var dir = tmpCopy();
    expect(function() { V.sync(dir, 'v1.18'); }).toThrow();
    expect(V.check(dir).problems).toEqual([]);
  });
});

describe('コードの指紋 (src/core/build-id.js)', function() {
  function ns(body) {
    return {
      core: { add: new Function('a', 'b', body || 'return a + b;'), name: 'x' },
      modules: { gantt: { parse: function parse(t) { return t.split('\n'); } } },
    };
  }

  test('同じコードなら同じ指紋 (12 桁の 16 進)', function() {
    var a = loadBuildId(ns()).fingerprint;
    var b = loadBuildId(ns()).fingerprint;
    expect(a).toBe(b);
    expect(/^[0-9a-f]{12}$/.test(a)).toBe(true);
  });

  test('関数を 1 文字直すと指紋が変わる', function() {
    var a = loadBuildId(ns('return a + b;')).fingerprint;
    var b = loadBuildId(ns('return a - b;')).fingerprint;
    expect(a).not.toBe(b);
  });

  test('<style> の中身も指紋に入る', function() {
    var B = loadBuildId(ns());
    expect(B.compute(ns(), ['#a{color:red}'])).not.toBe(B.compute(ns(), ['#a{color:blue}']));
  });

  test('キーの登録順や状態の値では変わらない', function() {
    var B = loadBuildId(ns());
    var x = ns(); var y = ns();
    var reordered = { modules: y.modules, core: y.core };
    x.state = { count: 1, items: [1, 2] };
    reordered.state = { count: 99, items: [] };
    expect(B.compute(x, [])).toBe(B.compute(reordered, []));
  });

  test('画面に指紋を出す欄があり、build-id.js は app.js の後で読む', function() {
    var html = fs.readFileSync(path.join(ROOT, 'mermaid-assist.html'), 'utf8');
    expect((html.match(/id="status-build"/g) || []).length).toBe(1);
    var iApp = html.indexOf('src="src/app.js"');
    var iId = html.indexOf('src="src/core/build-id.js"');
    expect(iApp).toBeGreaterThan(-1);
    expect(iId).toBeGreaterThan(iApp);
  });
});
