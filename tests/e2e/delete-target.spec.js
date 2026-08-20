// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');

async function ready(page, type) {
  page.on('dialog', d => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.locator('#diagram-type').selectOption(type);
  await page.waitForTimeout(1600);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

// class / er / state の削除は「その要素が最初に現れた行」を消していた。
// どの図種も要素は行を共有する (関係行や遷移行が両端を宣言する) ので、
// 押した要素が残り、押していない関係が消えていた。
//
// ここは UI 経路 (一覧の ✕ → bindDeleteButtons → data-element-id) を通す。
// ユニットテストは関数を直接呼ぶので、id が渡っていない配線ミスを拾えない。
test.describe('一覧の ✕ が押した要素を消す', () => {
  test('classDiagram: Animal を消すと Animal だけ消える', async ({ page }) => {
    await ready(page, 'classDiagram');
    const del = page.locator('.cl-delete-class[data-element-id="Animal"]');
    await expect(del).toHaveCount(1);
    await del.click();
    await page.waitForTimeout(1200);

    const text = await page.locator('#editor').inputValue();
    expect(text).not.toContain('Animal');
    expect(text).toContain('class Dog');
    // ブロックの中身が孤立していない
    expect(text).not.toContain('+String name');
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
  });

  test('erDiagram: CUSTOMER を消すと CUSTOMER だけ消える', async ({ page }) => {
    await ready(page, 'erDiagram');
    const del = page.locator('.er-delete-entity[data-element-id="CUSTOMER"]');
    await expect(del).toHaveCount(1);
    await del.click();
    await page.waitForTimeout(1200);

    const text = await page.locator('#editor').inputValue();
    expect(text).not.toContain('CUSTOMER');
    expect(text).toContain('ORDER {');
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
  });

  test('stateDiagram: Idle を消すと Idle だけ消える', async ({ page }) => {
    await ready(page, 'stateDiagram');
    const del = page.locator('.st-delete-state[data-element-id="Idle"]');
    await expect(del).toHaveCount(1);
    await del.click();
    await page.waitForTimeout(1200);

    const text = await page.locator('#editor').inputValue();
    expect(text).not.toContain('Idle');
    expect(text).toContain('Running');
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
  });
});
