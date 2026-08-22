'use strict';
// UI-040: 絞り込んだあと、その行へ行くのに追加フォーム全体を通過する。
//
// 実測 (1366x768、40ノードを「受信処理37」で1行に絞ったあと):
//   絞り込み欄から Tab を押していくと
//   fc-direction → fc-add-node-id → …(追加フォーム全体)… → **14回目**でようやく
//   絞り込みで残った行の編集ボタンに着く。
//
// 「探す → 直す」は1日に何度も踏む流れなので、そのたびに14打鍵増える。
// 配置は変えず、Enter で残った最初の行へ飛ばす
// (絞り込み欄で Enter を押したら結果へ、は一般的な作法)。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);

async function setup(page) {
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.locator('#diagram-type').selectOption('flowchart');
  await page.waitForTimeout(1700);
  const L = ['flowchart TD'];
  for (let i = 0; i < 40; i++) L.push('    NODE' + i + '["受信処理' + i + '"]');
  await page.evaluate((x) => {
    const e = document.getElementById('editor');
    e.value = x; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, L.join(NL));
  await page.waitForTimeout(2500);
}
const focusInfo = (page) => page.evaluate(() => {
  const a = document.activeElement;
  const row = a && a.closest ? a.closest('.ma-list-row') : null;
  return { id: a ? (a.id || a.className || '') : '',
    inRow: !!row,
    hidden: row ? row.style.display === 'none' : null,
    text: row ? (row.textContent || '').replace(/\s+/g, ' ').trim() : '' };
});

test.describe('UI-040: 絞り込んだ行へ Enter で飛べる', () => {
  test('Enter 1回で残った行に着く', async ({ page }) => {
    test.setTimeout(90000);
    await setup(page);
    await page.locator('#ma-list-filter').click();
    await page.keyboard.type('受信処理37');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const f = await focusInfo(page);
    expect(f.inRow).toBe(true);
    expect(f.hidden).toBe(false);
    expect(f.text).toContain('受信処理37');
  });

  test('絞り込みが空でも先頭の行に着く', async ({ page }) => {
    test.setTimeout(90000);
    await setup(page);
    await page.locator('#ma-list-filter').click();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const f = await focusInfo(page);
    expect(f.inRow).toBe(true);
    expect(f.hidden).toBe(false);
  });

  test('一致が0件なら何も起きない (フォーカスは絞り込み欄のまま)', async ({ page }) => {
    test.setTimeout(90000);
    await setup(page);
    await page.locator('#ma-list-filter').click();
    await page.keyboard.type('該当しない語');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const f = await focusInfo(page);
    expect(f.inRow).toBe(false);
    expect(f.id).toBe('ma-list-filter');
  });
});
