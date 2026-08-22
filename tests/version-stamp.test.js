'use strict';
// UI-044 / FEAT-001: 画面に版が出ておらず、どの版を動かしているか分からない。
//
// 実測: 画面テキストに `\d+\.\d+\.\d+` 形式が1つも無く、
// `[id*=version]` / `[class*=version]` 要素も存在しなかった。
// その結果、利用者から「ガントのバーが動かない」と報告を受けたとき、
// **どの版の話かを特定するのに調査の大半を費やした**
// (作業ツリーが origin/master より74コミット遅れていた)。
//
// 単一HTMLでビルド工程が無いので、版は HTML に直書きするしかない。
// **人が VERSION と HTML の2箇所を揃え続けるのは必ず失敗する**ので、
// 一致を機械が数える。ここが落ちたら「版を上げたのに画面が古い」ということ。
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var htmlPath = path.join(ROOT, 'mermaid-assist.html');
var versionPath = path.join(ROOT, 'VERSION');

describe('版の刻印', function() {
  test('VERSION ファイルがある', function() {
    expect(fs.existsSync(versionPath)).toBe(true);
    var v = fs.readFileSync(versionPath, 'utf8').trim();
    expect(/^\d+\.\d+\.\d+$/.test(v)).toBe(true);
  });

  test('画面の版が VERSION と一致する', function() {
    var v = fs.readFileSync(versionPath, 'utf8').trim();
    var html = fs.readFileSync(htmlPath, 'utf8');
    var m = html.match(/id="status-version"[^>]*>v?([\d.]+)</);
    // 要素が無ければ、そもそも画面に版が出ていない
    expect(m).not.toBe(null);
    expect(m[1]).toBe(v);
  });

  test('版を出す要素が1つだけ', function() {
    var html = fs.readFileSync(htmlPath, 'utf8');
    var all = html.match(/id="status-version"/g) || [];
    // 2つあると、どちらが本物か分からなくなる
    expect(all.length).toBe(1);
  });
});
