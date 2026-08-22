'use strict';
// UI-031: 人が打つ速さだと、1打鍵ごとに図全体を描き直していた。
//
// requestAnimationFrame は**同じフレームの中**しかまとめない。
// 毎秒5文字 (200ms 間隔) で打つと合流せず、毎回描き直す。
//
// 実測 (1366x768、10文字打つ間に UI が固まった合計):
//
//   要素    前        後
//     10      0ms      0ms
//     50    797ms    789ms   (1回 80ms。描き直しが軽いので待たない)
//    200   4988ms    524ms   (10回 → 1回)
//    400  14718ms   1409ms   (10回 → 1回)
//
// 待ち時間は**前回の描き直しに実際かかった時間**から決める。固定値だと
// 軽い図で無駄に遅くなるか、重い図で効かないかのどちらかになる
// (150ms 固定では 200ms 間隔の打鍵に1回も合流しない)。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);

function flow(n) {
  const L = ['flowchart TD'];
  for (let i = 0; i < n; i++) L.push('    N' + i + '["ノード' + i + '"]');
  for (let i = 1; i < n; i++) L.push('    N' + (i - 1) + ' --> N' + i);
  return L.join(NL);
}
const setText = (page, t) => page.evaluate((txt) => {
  const e = document.getElementById('editor');
  e.value = txt; e.dispatchEvent(new Event('input', { bubbles: true }));
}, t);

// ページ内でフレームの途切れを数える (外から測ると自分が止まって測れない)
async function watchFrames(page) {
  await page.evaluate(() => {
    window.__gaps = []; window.__last = performance.now();
    const tick = () => {
      const now = performance.now();
      const d = now - window.__last;
      if (d > 50) window.__gaps.push(Math.round(d));
      window.__last = now;
      window.__raf = requestAnimationFrame(tick);
    };
    window.__raf = requestAnimationFrame(tick);
  });
}
const stopFrames = (page) => page.evaluate(() => {
  cancelAnimationFrame(window.__raf);
  return window.__gaps;
});

test.describe('UI-031: 人の速さで打っても描き直しがまとまる', () => {
  test('200要素に10文字打つと描き直しは数回以内に収まる', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await setText(page, flow(200));
    await page.waitForTimeout(4000);
    await page.locator('#editor').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('%% ');
    await page.waitForTimeout(2500);
    await watchFrames(page);
    for (let i = 0; i < 10; i++) { await page.keyboard.type('a'); await page.waitForTimeout(200); }
    await page.waitForTimeout(6000);
    const gaps = await stopFrames(page);
    // まとまっていれば、重い停止 (200ms超) は数回で済む
    const heavy = gaps.filter(g => g > 200);
    expect(heavy.length).toBeLessThanOrEqual(3);
  });

  test('小さい図では待たない (即座に反映される)', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await setText(page, flow(3));
    await page.waitForTimeout(2000);
    const t0 = Date.now();
    await setText(page, flow(4));
    await page.waitForFunction(() => {
      const s = document.getElementById('status-info');
      return s && /要素: 4/.test(s.textContent || '');
    }, null, { timeout: 20000 });
    // 待ちを入れていないので、300ms も待たずに反映される
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  test('打ち終われば図は最新の内容になる', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await setText(page, flow(200));
    await page.waitForTimeout(4000);
    await page.locator('#editor').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('    NX["最後の追加"]');
    await page.waitForFunction(() => {
      const s = document.getElementById('status-info');
      return s && /要素: 201/.test(s.textContent || '');
    }, null, { timeout: 60000 });
    const txt = await page.evaluate(() => (document.getElementById('preview-svg').textContent || ''));
    expect(txt).toContain('最後の追加');
  });
});
