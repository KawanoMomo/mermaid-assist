'use strict';
// state の ID 欄。
//
// パネルには ID 欄が出ているのに、イベントが1つも繋がっておらず**打鍵しても
// 何も起きなかった**。R18 (キーボード完結) の走査を4図種から全21図種に広げて
// 初めて出た。欄があるのに効かないのは、欄が無いより悪い。
const path = require('path');
const { test, expect } = require('@playwright/test');

const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');

async function openState(page) {
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.locator('#diagram-type').selectOption('stateDiagram');
  await page.waitForTimeout(1800);
}

async function selectFirstState(page) {
  const hit = page.locator('#overlay-layer [data-element-id]').first();
  await hit.click({ force: true });
  await page.waitForTimeout(600);
}

test.describe('state: ID 欄', () => {
  test('ID を変えると本文と一覧に反映される', async ({ page }) => {
    await openState(page);
    await selectFirstState(page);
    const field = page.locator('#sel-state-id');
    await expect(field).toBeVisible();

    await field.fill('待機');
    await field.blur();
    await page.waitForTimeout(1200);

    const text = await page.locator('#editor').inputValue();
    expect(text).toContain('待機');
    expect(text).not.toContain('Idle');
  });

  test('遷移の端点が両側とも追従する', async ({ page }) => {
    await openState(page);
    await selectFirstState(page);
    await page.locator('#sel-state-id').fill('待機');
    await page.locator('#sel-state-id').blur();
    await page.waitForTimeout(1200);

    const text = await page.locator('#editor').inputValue();
    expect(text).toContain('[*] --> 待機');
    expect(text).toContain('待機 --> Running : start');
    expect(text).toContain('Running --> 待機 : stop');
  });

  test('既にある ID にはできず、欄が元に戻る', async ({ page }) => {
    await openState(page);
    await selectFirstState(page);
    const before = await page.locator('#editor').inputValue();

    await page.locator('#sel-state-id').fill('Running');
    await page.locator('#sel-state-id').blur();
    await page.waitForTimeout(1000);

    expect(await page.locator('#editor').inputValue()).toBe(before);
    await expect(page.locator('#sel-state-id')).toHaveValue('Idle');
  });

  test('Ctrl+Z で元に戻せる', async ({ page }) => {
    await openState(page);
    const before = await page.locator('#editor').inputValue();
    await selectFirstState(page);
    await page.locator('#sel-state-id').fill('待機');
    await page.locator('#sel-state-id').blur();
    await page.waitForTimeout(1200);
    expect(await page.locator('#editor').inputValue()).not.toBe(before);

    await page.evaluate(() => window.MA.history.undo());
    await page.waitForTimeout(600);
    expect(await page.locator('#editor').inputValue()).toBe(before);
  });
});
