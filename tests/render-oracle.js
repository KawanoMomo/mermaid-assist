'use strict';
// mermaid の実描画オラクル。
//
// ユニットテストは「テキストがこう書き変わること」しか見ない。だが mermaid では
//   mermaid.parse が OK でも mermaid.render が例外を投げる
//   parse も render も OK なのに図の意味が変わっている (要素が増える / バーが動く)
// という壊れ方があり、テキストレベルの assert では素通りする。実際 471件の
// ユニットテストと269件の e2e が全緑のまま、6モジュールで「ID をリネームすると
// 参照が壊れる」欠陥が残っていた。
//
// このオラクルは lib/mermaid.min.js を実ブラウザに読み込み、各ケースについて
//   parse / render の成否、テキストノード、gantt のバー幾何
// を返す。before/after の2件を並べて比較するのが基本的な使い方。
//
// 使い方:
//   node tests/render-oracle.js tests/render-cases/rename-cascade.json
//   node tests/render-oracle.js <cases.json> --json     生の JSON を出す
//
// cases.json は [{ name, text }, ...]。name を "<何か>/before" と "<何か>/after"
// にしておくと、レポートが対で並ぶので差分を読みやすい。
//
// 【重要】ケースごとにページを作り直している。
// mermaid はダイアグラム種別ごとにモジュールレベルの状態 (gantt のタスク登録など)
// を持っていて、同一ページで連続 render すると前のケースで登録された id が次の
// ケースから見えてしまう。存在しない id を参照しているのに正しく解決される、という
// 偽の GREEN が出る。実際このオラクルの初版はそれで gantt の測定値を誤らせた。

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 9517;

function createServer() {
  return http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html><body><div id="out"></div>' +
        '<script src="/lib/mermaid.min.js"></script></body></html>');
      return;
    }
    const f = path.join(ROOT, url);
    if (!f.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    try {
      res.writeHead(200, { 'Content-Type': url.endsWith('.js') ? 'text/javascript' : 'text/plain' });
      res.end(fs.readFileSync(f));
    } catch (e) { res.writeHead(404); res.end('not found'); }
  });
}

async function runCases(cases) {
  const server = createServer();
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch();
  const results = [];
  try {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      // ケース間の状態漏れを断つため毎回新しいページを開く (冒頭の注意書き参照)
      const page = await browser.newPage();
      await page.goto('http://127.0.0.1:' + PORT + '/');
      await page.waitForFunction(() => typeof window.mermaid !== 'undefined');
      await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' }));
      const r = await page.evaluate(async ({ text, id }) => {
        const out = { parse: null, render: null, svgLen: 0, text: '', rects: '' };
        const brief = (e) => (e && e.message ? e.message : String(e)).split('\n')[0].slice(0, 160);
        try { await window.mermaid.parse(text); out.parse = 'OK'; }
        catch (e) { out.parse = 'ERR: ' + brief(e); }
        try {
          const res = await window.mermaid.render('oracle' + id, text);
          out.render = 'OK';
          out.svgLen = res.svg.length;
          out.text = (res.svg.match(/>[^<]{1,60}</g) || []).join('')
            .replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
          // gantt のバーは「エラーなく描けたが位置が変わった」を見るのに要る
          out.rects = (res.svg.replace(/\s+/g, ' ').match(/<rect [^>]*class="task[^"]*"[^>]*>/g) || [])
            .map((t) => ((t.match(/id="([^"]*)"/) || [])[1] || '?') + '@' +
                        ((t.match(/ x="([-0-9.]+)"/) || [])[1]) + '+' +
                        ((t.match(/ width="([-0-9.]+)"/) || [])[1])).join(' ');
        } catch (e) { out.render = 'ERR: ' + brief(e); }
        return out;
      }, { text: c.text, id: i });
      results.push(Object.assign({ name: c.name }, r));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  return results;
}

// before/after の対を突き合わせる。
// 期待は「リネーム以外は何も変わらない」なので、
//   after で render が壊れた       → FAIL
//   after で描画テキストが変わった  → FAIL (要素が増減した / 中身が化けた)
//   after で gantt のバー位置が動いた → FAIL (依存が切れて日付が飛んだ)
// を判定する。after 側にだけ現れてよい差分は id 名そのものなので、比較対象からは
// ケース定義の allowTextChange / allowRectChange で明示的に外せる。
function comparePairs(results, cases) {
  const byName = {};
  results.forEach(r => { byName[r.name] = r; });
  const opts = {};
  cases.forEach(c => { opts[c.name] = c; });
  const failures = [];
  Object.keys(byName).forEach((name) => {
    if (!/\/after$/.test(name)) return;
    const base = name.replace(/\/after$/, '/before');
    const a = byName[name], b = byName[base];
    if (!b) return;
    const o = opts[name] || {};
    if (a.render !== 'OK') failures.push(name + ': render が失敗 → ' + a.render);
    if (b.render === 'OK' && a.render === 'OK') {
      if (!o.allowTextChange && a.text !== b.text) {
        failures.push(name + ': 描画テキストが変わった\n      before: ' + b.text + '\n      after : ' + a.text);
      }
      if (!o.allowRectChange && stripIds(a.rects) !== stripIds(b.rects)) {
        failures.push(name + ': ガントのバー位置が変わった\n      before: ' + b.rects + '\n      after : ' + a.rects);
      }
    }
  });
  return failures;
}

// バーの id はリネームで当然変わるので、比較からは外して位置と幅だけを見る
function stripIds(rects) {
  return rects.split(' ').map(s => s.replace(/^[^@]*@/, '')).join(' ');
}

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node tests/render-oracle.js <cases.json> [--json]');
    process.exit(2);
  }
  const cases = JSON.parse(fs.readFileSync(file, 'utf8'));
  const results = await runCases(cases);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(results, null, 1));
    process.exit(0);
  }
  results.forEach(r => {
    const ok = r.parse === 'OK' && r.render === 'OK';
    console.log('  ' + (ok ? '✓' : '✗') + ' ' + r.name);
    if (!ok) console.log('      parse=' + r.parse + '\n      render=' + r.render);
  });
  const failures = comparePairs(results, cases);
  console.log('');
  if (failures.length) {
    failures.forEach(f => console.log('  ✗ ' + f));
    console.log('\n  ' + failures.length + ' 件の描画差分\n');
    process.exit(1);
  }
  console.log('  描画差分なし (' + results.length + ' ケース)\n');
})();
