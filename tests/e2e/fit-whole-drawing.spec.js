// @ts-check
// Fit ボタンは図全体をプレビューに入れる(TICKET-owner-20261109-0028-3)。
//
// 以前は幅だけで合わせていたので、縦長の flowchart(TD の鎖 111 ノード、自然サイズ
// 374 x 34530)で Fit を押すと 300% になり、ノード 2 つしか見えなかった。
// 期待: 幅と高さの小さい方の倍率に合わせる / Fit では 100% を超えない /
// 下限は 25%(全ズーム共通の最小。これに当たる図は幅が収まり、倍率が 25% になる)。
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');

function chain(dir, n) {
  const L = ['flowchart ' + dir];
  for (let i = 1; i < n; i++) L.push(`    N${i}[処理${i}] --> N${i + 1}`);
  return L.join('\n') + '\n';
}

async function openText(page, testInfo, name, text) {
  const f = testInfo.outputPath(name);
  fs.writeFileSync(f, text);
  await page.locator('#file-input').setInputFiles(f);
  await page.waitForFunction(() => {
    const s = document.getElementById('status-parse');
    return s && /OK/.test(s.textContent || '');
  }, null, { timeout: 30000 });
  await page.waitForTimeout(800);
}

async function measure(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('#preview-svg svg');
    const box = document.getElementById('preview-container');
    const r = svg.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    return {
      w: r.width, h: r.height, W: box.clientWidth, H: box.clientHeight,
      left: r.left - b.left, top: r.top - b.top,
      zoom: document.getElementById('zoom-display') ? document.getElementById('zoom-display').textContent : '',
    };
  });
}

async function zoomInThenFit(page) {
  // 拡大した状態から Fit を押しても全体に戻ること
  for (let i = 0; i < 3; i++) await page.locator('#btn-zoom-in').click();
  await page.locator('#btn-zoom-fit').click();
  await page.waitForTimeout(400);
}

test.describe('Fit は図全体をプレビューに入れる', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await page.waitForTimeout(600);
  });

  test('縦長(TD の鎖 111)は下限 25% で止まり、幅は収まり、拡大しない', async ({ page }, testInfo) => {
    await openText(page, testInfo, 'tall.mmd', chain('TD', 111));
    await zoomInThenFit(page);
    const m = await measure(page);
    expect(m.zoom).toBe('25%');
    expect(m.w).toBeLessThanOrEqual(m.W + 1);
    // 図の先頭が見えている(スクロールが残っていない)
    expect(m.top).toBeGreaterThanOrEqual(-1);
    await page.screenshot({ path: testInfo.outputPath('fit-tall.png') });
  });

  test('縦長(TD の鎖 20)は縦横とも収まり、100% を超えない', async ({ page }, testInfo) => {
    await openText(page, testInfo, 'tall20.mmd', chain('TD', 20));
    await zoomInThenFit(page);
    const m = await measure(page);
    expect(m.w).toBeLessThanOrEqual(m.W + 1);
    expect(m.h).toBeLessThanOrEqual(m.H + 1);
    expect(parseInt(m.zoom, 10)).toBeLessThanOrEqual(100);
    expect(parseInt(m.zoom, 10)).toBeGreaterThan(25);
    // 縦が制約なので縦をほぼ使い切る
    expect(m.h / m.H).toBeGreaterThan(0.85);
  });

  test('横長(LR の鎖 111)は縦横とも収まる(または下限 25%)', async ({ page }, testInfo) => {
    await openText(page, testInfo, 'wide.mmd', chain('LR', 111));
    await zoomInThenFit(page);
    const m = await measure(page);
    if (m.zoom === '25%') {
      expect(m.h).toBeLessThanOrEqual(m.H + 1);
    } else {
      expect(m.w).toBeLessThanOrEqual(m.W + 1);
      expect(m.h).toBeLessThanOrEqual(m.H + 1);
    }
    expect(m.left).toBeGreaterThanOrEqual(-1);
    await page.screenshot({ path: testInfo.outputPath('fit-wide.png') });
  });

  test('小さい図(ノード 3)は 100% のまま収まり、拡大しない', async ({ page }, testInfo) => {
    await openText(page, testInfo, 'small.mmd', 'flowchart TD\n    A[開始] --> B[処理]\n    B --> C[終了]\n');
    await zoomInThenFit(page);
    const m = await measure(page);
    expect(m.zoom).toBe('100%');
    expect(m.w).toBeLessThanOrEqual(m.W + 1);
    expect(m.h).toBeLessThanOrEqual(m.H + 1);
    await page.screenshot({ path: testInfo.outputPath('fit-small.png') });
  });
});
