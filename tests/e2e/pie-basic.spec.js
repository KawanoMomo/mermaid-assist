// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchToPie(page) {
  await page.locator('#diagram-type').selectOption('pie');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Pie: Switching', () => {
  test('switches to Pie template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToPie(page);
    expect(await editorText(page)).toContain('pie');
  });

  test('Pie renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToPie(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('property panel shows pie UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToPie(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#pie-add-btn')).toBeVisible();
    await expect(page.locator('#pie-set-title-btn')).toBeVisible();
    await expect(page.locator('#pie-show-data')).toBeVisible();
  });
});

test.describe('Pie Operations', () => {
  test('set title updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToPie(page);
    await page.waitForTimeout(500);
    await page.locator('#pie-title').fill('売上構成');
    await page.locator('#pie-set-title-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('title 売上構成');
  });

  test('add slice updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToPie(page);
    await page.waitForTimeout(500);
    await page.locator('#pie-add-label').fill('New');
    await page.locator('#pie-add-value').fill('42');
    await page.locator('#pie-add-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('"New" : 42');
  });

  test('showData checkbox toggles', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToPie(page);
    await page.waitForTimeout(500);
    await page.locator('#pie-show-data').check();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('showData');
  });

  test('slice detail panel + update value', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToPie(page);
    await page.waitForTimeout(800);
    await page.locator('.pie-select-slice').first().click();
    await page.waitForTimeout(400);
    await page.locator('#pie-edit-value').fill('99');
    await page.locator('#pie-edit-value').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain(' : 99');
  });

  test('delete slice', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToPie(page);
    await page.waitForTimeout(800);
    const before = await editorText(page);
    await page.locator('.pie-delete-slice').first().click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after.split('\n').length).toBeLessThan(before.split('\n').length);
  });
});
