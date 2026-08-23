'use strict';
// UI-069: 一覧で切れた名前を読む手段が無かった / UI-070: Fit が見える範囲を減らした。
//
// 実測 (直す前, 1366x768):
//   UI-069 名前欄は 123px しかなく "ComM_ChannelStateManager_MainFunction" は
//     "ComM_ChannelStat" までしか読めない。**先頭が共通で末尾だけ違う名前
//     (組込みの BSW 名は先頭共通が普通) を一覧で見分けられない**。
//     gantt.js:1158,1181 は自前の行に title を付けていたのに、41か所が通る
//     共有関数 properties.js:185 には無かった。同じ製品の中で不揃いだった。
//   UI-070 60要素の縦フローチャートで Fit を押すと 239% まで拡大し、
//     図の見えている割合が 8% → 3% に減った。"Fit" を押して見える範囲が
//     減るのは、どの読み方をしても擁護できない。
//     直す途中で 4要素の小さい図が 100% → 58% に悪化する別の顔も見つけた
//     (拡大後の高さを見ていなかった)。両方をここで押さえる。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);

const LONG = ['flowchart TD',
  '    N0["ComM_ChannelStateManager_MainFunction"]',
  '    N1["ComM_ChannelStateManager_Init"]',
  '    N0 --> N1'].join(NL);

function tall(n) {
  const l = ['flowchart TD'];
  for (let i = 0; i < n; i++) l.push('    M' + i + '["工程' + i + '"]');
  for (let i = 1; i < n; i++) l.push('    M' + (i - 1) + ' --> M' + i);
  return l.join(NL);
}

async function load(page) {
  page.on('dialog', (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(800);
}

async function edit(page, text) {
  await page.evaluate((x) => {
    const e = document.getElementById('editor');
    e.value = x; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await page.waitForTimeout(2600);
}

// 図がどれだけ見えているか (枠と図の重なり / 図の高さ)
const visibleRatio = (page) => page.evaluate(() => {
  const c = document.getElementById('preview-container');
  const svg = document.querySelector('#preview-svg svg');
  const cb = c.getBoundingClientRect(), sb = svg.getBoundingClientRect();
  const h = Math.max(0, Math.min(cb.bottom, sb.bottom) - Math.max(cb.top, sb.top));
  return Math.round(h / sb.height * 100);
});

test.describe('一覧の名前と Fit', () => {
  test('切れた名前はホバーで全体が読める', async ({ page }) => {
    await load(page);
    await edit(page, LONG);
    const rows = await page.evaluate(() => Array.from(
      document.querySelectorAll('#props-content .ma-list-row')).slice(0, 2).map((x) => {
        const d = x.firstElementChild;
        return { cut: d.scrollWidth > d.clientWidth + 1, title: d.title || '' };
      }));
    expect(rows.length).toBe(2);
    // 前提: この名前は実際に切れている (切れていないなら測定条件が壊れている)
    expect(rows[0].cut).toBe(true);
    // 切れた分を読む手段がある。**末尾まで含む**こと (先頭だけでは見分けられない)。
    //
    // 行の title は「名前 + 補足 (`(N0, rect)` など)」になったので完全一致では見ない。
    // ただし toContain には緩めない —— 名前が途中で切られていないことを担保したいので、
    // 先頭一致で固定する。`toContain` だと `ComM_Channel` だけ入っていても通ってしまい、
    // このテストが守りたかったもの (末尾まで読める) を守れなくなる。
    const startsWith = (s, p) => s.slice(0, p.length) === p;
    expect(startsWith(rows[0].title, 'ComM_ChannelStateManager_MainFunction')).toBe(true);
    expect(startsWith(rows[1].title, 'ComM_ChannelStateManager_Init')).toBe(true);
  });

  test('Fit を押して見える範囲が減らない — 縦長の図', async ({ page }) => {
    await load(page);
    await edit(page, tall(60));
    const before = await visibleRatio(page);
    await page.click('#btn-zoom-fit');
    await page.waitForTimeout(700);
    const after = await visibleRatio(page);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test('Fit を押して見える範囲が減らない — 収まっている小さい図', async ({ page }) => {
    // 縦長側だけ見ると「常に等倍にする」実装でも通ってしまう。
    // 小さい図は幅を活かして拡大しつつ、縦からはみ出さないこと。
    await load(page);
    await edit(page, tall(4));
    const before = await visibleRatio(page);
    expect(before).toBe(100);
    await page.click('#btn-zoom-fit');
    await page.waitForTimeout(700);
    expect(await visibleRatio(page)).toBe(100);
    // 幅を活かす役割は残っていること (等倍に固定する実装を弾く)
    const zoom = await page.evaluate(() => parseFloat(
      (document.getElementById('preview-svg').style.transform || 'scale(1)').replace(/[^0-9.]/g, '')));
    expect(zoom).toBeGreaterThan(1);
  });
});
