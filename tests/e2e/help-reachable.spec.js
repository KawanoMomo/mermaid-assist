'use strict';
// ヘルプ (ショートカット一覧) に、**エディタからも届くこと**。
//
// 実測 (1366x768): エディタにカーソルがある状態で `?` を押すと、
// ヘルプは出ず本文に「?」が入っていた。`?` は本文に打てる文字なので
// これ自体は正しいが、**利用者が一番長くいる場所からヘルプを呼ぶ手段が
// 一つも無い**状態だった。F1 をどこでも効く経路として足した。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');

async function open(page) {
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(400);
}
const isOpen = (page) => page.evaluate(() => {
  const h = document.getElementById('shortcut-help');
  return h ? !h.hasAttribute('hidden') : null;
});

test.describe('UI-026: ヘルプにエディタからも届く', () => {
  test('エディタにカーソルがあるとき F1 でヘルプが出る', async ({ page }) => {
    await open(page);
    await page.locator('#editor').click();
    expect(await isOpen(page)).toBe(false);
    await page.keyboard.press('F1');
    await page.waitForTimeout(300);
    expect(await isOpen(page)).toBe(true);
  });

  test('エディタで ? を押しても本文に入るだけ (文字として打てる)', async ({ page }) => {
    await open(page);
    await page.locator('#editor').click();
    await page.keyboard.press('?');
    await page.waitForTimeout(300);
    expect(await isOpen(page)).toBe(false);
    expect(await page.locator('#editor').inputValue()).toContain('?');
  });

  test('図にフォーカスがあるときは ? でも F1 でも出る', async ({ page }) => {
    await open(page);
    await page.locator('#preview-pane').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('?');
    await page.waitForTimeout(300);
    expect(await isOpen(page)).toBe(true);
    await page.keyboard.press('F1');
    await page.waitForTimeout(300);
    expect(await isOpen(page)).toBe(false);
  });

  test('ヘルプに F1 と Tab が載っている', async ({ page }) => {
    await open(page);
    await page.keyboard.press('F1');
    await page.waitForTimeout(300);
    const t = await page.locator('#shortcut-help').textContent();
    expect(t).toContain('F1');
    expect(t).toContain('Tab');
  });
});
