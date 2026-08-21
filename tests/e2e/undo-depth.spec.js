'use strict';
// UI-028: Ctrl+Z を押しすぎると自分が編集を始める前まで無言で戻る。
//
// 実測: 図を開いて90文字打ち、Ctrl+Z を押し続けると起動時のひな形
// (「after b1, 2026-05-15」を含む gantt) まで戻っていた。合図は
// `src/app.js` の工具列ボタンの無効化だけで、文字表示は無い。
// キーボードで押している人は工具列を見ていない。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);

async function open(page) {
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(400);
}
const setText = (page, t) => page.evaluate((txt) => {
  const e = document.getElementById('editor');
  e.value = txt; e.dispatchEvent(new Event('input', { bubbles: true }));
}, t);

test.describe('UI-028: 元に戻すの残り段数が画面に出る', () => {
  test('Ctrl+Z を押すと残り段数がステータスに出る', async ({ page }) => {
    await open(page);
    await setText(page, 'flowchart TD' + NL + '    A["あ"]');
    await page.waitForTimeout(900);
    await setText(page, 'flowchart TD' + NL + '    A["あ"]' + NL + '    B["い"]');
    await page.waitForTimeout(900);
    await page.locator('#preview-pane').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    const s = await page.locator('#status-info').textContent();
    expect(s).toContain('元に戻しました');
    expect(s).toMatch(/戻せる: \d+/);
    expect(s).toMatch(/やり直せる: [1-9]\d*/);
  });

  test('これ以上戻せないときはそう言う', async ({ page }) => {
    await open(page);
    await page.locator('#preview-pane').click({ position: { x: 5, y: 5 } });
    for (let i = 0; i < 40; i++) await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    const s = await page.locator('#status-info').textContent();
    expect(s).toContain('これ以上戻せません');
    expect(s).toContain('戻せる: 0');
  });

  test('Ctrl+Y でやり直すと段数が入れ替わる', async ({ page }) => {
    await open(page);
    await setText(page, 'flowchart TD' + NL + '    A["あ"]');
    await page.waitForTimeout(900);
    await setText(page, 'flowchart TD' + NL + '    A["あ"]' + NL + '    B["い"]');
    await page.waitForTimeout(900);
    await page.locator('#preview-pane').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const before = await page.locator('#status-info').textContent();
    const undoN = Number((before.match(/戻せる: (\d+)/) || [])[1]);
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(400);
    const after = await page.locator('#status-info').textContent();
    expect(after).toContain('やり直しました');
    expect(Number((after.match(/戻せる: (\d+)/) || [])[1])).toBe(undoN + 1);
  });
});
