'use strict';
// 台本の scenario が共有する手。scenario は「ペルソナが GUI で行う 1 手順」を再現し、
// G1(押した対象だけが変わる)と G2(mermaid が実際に描ける)を期待に持つ。
//
// 計測値は testInfo.annotations に積み、scripts/verify.ps1 が summary.json に写す:
//   renderMs  … 操作から次の描画(#preview-svg の svg が差し替わり status が OK)までの ms
//   diffLines … 操作の前後で Mermaid 本文の動いた行数(LCS で取った削除と追加の多い方)
// 同じ種類を複数回積んだときは、summary.json では最大値を取る。
// テストが作るファイルは testInfo.outputPath()(test-results/ 配下)だけに置く。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const HTML_URL = 'file:///' + path.join(ROOT, 'mermaid-assist.html').split(path.sep).join('/');
const FIXTURES = path.join(__dirname, 'fixtures');

async function openApp(page) {
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await waitIdle(page);
}

// 描画が落ち着くまで待つ(status が「描画中…」でない)。
async function waitIdle(page) {
  await page.waitForFunction(() => {
    const s = document.getElementById('status-parse');
    return s && !/描画中/.test(s.textContent || '');
  }, null, { timeout: 20000 });
  await page.waitForTimeout(300);
}

// 操作 fn を行い、次の描画までの時間を返す。描画が起きない操作なら null。
async function timedRender(page, fn, timeout) {
  await page.evaluate(() => {
    const s = document.querySelector('#preview-svg svg');
    if (s) s.setAttribute('data-scn-old', '1');
  });
  const t0 = Date.now();
  await fn();
  try {
    await page.waitForFunction(() => {
      const s = document.querySelector('#preview-svg svg');
      const st = document.getElementById('status-parse');
      return s && !s.hasAttribute('data-scn-old') && st && /OK/.test(st.textContent || '');
    }, null, { timeout: timeout || 15000 });
  } catch (e) {
    return null;
  }
  const ms = Date.now() - t0;
  await page.waitForTimeout(200);
  return ms;
}

async function editorText(page) {
  return page.locator('#editor').inputValue();
}

// fixture(tests/scenarios/fixtures/ の .mmd)を「開く」から読み込む。
async function openFixture(page, name) {
  const file = path.isAbsolute(name) ? name : path.join(FIXTURES, name);
  await timedRender(page, () => page.locator('#file-input').setInputFiles(file), 20000);
  await waitIdle(page);
  return fs.readFileSync(file, 'utf8');
}

// Ctrl+S で .mmd を保存し、保存されたバイト列(文字列)を返す。
async function saveMmd(page, outPath) {
  await page.locator('#preview-pane').click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(200);
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.keyboard.press('Control+s'),
  ]);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await dl.saveAs(outPath);
  return fs.readFileSync(outPath, 'utf8');
}

// 行単位の差分。{ removed: [...], added: [...], lines: max(removed, added) }
function lineDiff(before, after) {
  const a = before.replace(/\r\n/g, '\n').split('\n');
  const b = after.replace(/\r\n/g, '\n').split('\n');
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const removed = [], added = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) removed.push(a[i++]);
    else added.push(b[j++]);
  }
  while (i < n) removed.push(a[i++]);
  while (j < m) added.push(b[j++]);
  return { removed, added, lines: Math.max(removed.length, added.length) };
}

function record(testInfo, type, value) {
  if (value === null || value === undefined) return;
  testInfo.annotations.push({ type, description: String(value) });
}

// 実ブラウザの mermaid で本文を描かせる(G2)。アプリの状態に触れないよう、
// lib/mermaid.min.js だけを読む新しいページで parse と render を行う。
async function renderWithMermaid(browser, text) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setContent('<!doctype html><html><body><div id="out"></div></body></html>');
  await page.addScriptTag({ path: path.join(ROOT, 'lib', 'mermaid.min.js') });
  const r = await page.evaluate(async (src) => {
    const brief = (e) => (e && e.message ? e.message : String(e)).split('\n')[0].slice(0, 200);
    const out = { parse: null, render: null, svgLen: 0, nodes: 0, texts: [] };
    window.mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
    try { await window.mermaid.parse(src); out.parse = 'OK'; } catch (e) { out.parse = 'ERR: ' + brief(e); }
    try {
      const res = await window.mermaid.render('scn' + Date.now(), src);
      out.render = 'OK';
      out.svgLen = res.svg.length;
      out.nodes = (res.svg.match(/<g[^>]*\sclass="node[\s"]/g) || []).length;
      out.texts = (res.svg.match(/>[^<]{1,80}</g) || []).map((t) => t.slice(1, -1).trim()).filter(Boolean);
    } catch (e) { out.render = 'ERR: ' + brief(e); }
    return out;
  }, text);
  await ctx.close();
  return r;
}

module.exports = {
  ROOT, HTML_URL, FIXTURES,
  openApp, waitIdle, timedRender, editorText, openFixture, saveMmd,
  lineDiff, record, renderWithMermaid,
};
