'use strict';
// 版の隣に出す「コードの指紋」(E13 / UI-059)。
//
// `#status-version` は VERSION の値で、リリース(タグ)のたびに揃える。だが版が同じでも
// 中身は違い得る(作者の実測: 74 コミット遅れていた間、画面はずっと 1.2.0 だった)。
// ビルド工程の無い単一 HTML なので、コミットハッシュを埋め込む手段が無い。
// そこで「いま読み込まれているコード」そのものから指紋を取る:
//   window.MA 配下の関数のソース(Function.prototype.toString は ES2019 以降ソースの
//   切り出しそのもの)と <style> の中身を、キー順に並べて FNV-1a 32bit を 2 本取る。
// 同じコードなら必ず同じ値、関数を 1 文字でも直せば変わる。リリース時の指紋は
// `node scripts/version.js fingerprint` で取れるので、報告された指紋と突き合わせれば
// 「v1.17.0 そのもの」か「v1.17.0 から先の別の中身」かが分かる。
//
// このファイルは mermaid-assist.html の src/ の最後(app.js の後)で読む。
// 全モジュールが window.MA に登録し終え、利用者が何も操作していない時点の値を取るため。
window.MA = window.MA || {};
window.MA.buildId = (function() {
  function fnv1a(str, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function hex8(n) { return ('0000000' + n.toString(16)).slice(-8); }

  // 名前空間を辿って関数のソースを集める。状態(配列・DOM・Map 等)は辿らない:
  // 指紋は「コード」を表すもので、読み込み後に変わる値を混ぜると同じ版で揺れる。
  function collect(root, maxDepth) {
    var parts = [];
    var seen = [];
    (function walk(obj, prefix, depth) {
      if (!obj || seen.indexOf(obj) !== -1) return;
      seen.push(obj);
      var keys = Object.keys(obj).sort();
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (prefix === '' && k === 'buildId') continue;   // 自分自身は数えない
        var d = Object.getOwnPropertyDescriptor(obj, k);
        if (!d || !('value' in d)) continue;              // getter は呼ばない
        var v = d.value;
        if (typeof v === 'function') {
          var src;
          try { src = Function.prototype.toString.call(v); } catch (e) { src = '?'; }
          parts.push(prefix + k + '=' + src);
        } else if (v && typeof v === 'object' && depth < maxDepth) {
          var proto = Object.getPrototypeOf(v);
          if (proto === Object.prototype || proto === null) walk(v, prefix + k + '.', depth + 1);
        }
      }
    })(root, '', 0);
    return parts;
  }

  // ns: 名前空間(既定 window.MA)、styles: 混ぜる文字列の配列(既定は <style> の中身)
  function compute(ns, styles) {
    var parts = collect(ns, 3);
    var css = styles || [];
    var text = parts.join('\n') + '\n--style--\n' + css.join('\n');
    return hex8(fnv1a(text, 2166136261)) + hex8(fnv1a(text, 0x9747b28c)).slice(0, 4);
  }

  function styleTexts() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return [];
    var list = document.querySelectorAll('style');
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(list[i].textContent || '');
    return out;
  }

  var fingerprint = compute(window.MA, styleTexts());

  function show() {
    if (typeof document === 'undefined' || !document.getElementById) return;
    var el = document.getElementById('status-build');
    if (!el) return;
    el.textContent = '#' + fingerprint;
    var ver = document.getElementById('status-version');
    el.title = 'コードの指紋。同じ版でも中身が違えば変わる。不具合を報告するときは版(' +
      (ver ? ver.textContent : '') + ')と一緒に添えてください';
  }
  show();

  return { fingerprint: fingerprint, compute: compute, fnv1a: fnv1a };
})();
