// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchTo(page) {
  await page.locator('#diagram-type').selectOption('xychart-beta');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('XY: Switching', () => {
  test('switches to XY template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    expect(await editorText(page)).toContain('xychart-beta');
  });

  test('XY renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('panel shows XY UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#xy-set-title')).toBeVisible();
    await expect(page.locator('#xy-add-btn')).toBeVisible();
    await expect(page.locator('#xy-horizontal')).toBeVisible();
  });
});

test.describe('XY Operations', () => {
  test('set title', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await page.waitForTimeout(500);
    await page.locator('#xy-title').fill('Revenue Q1');
    await page.locator('#xy-set-title').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('title "Revenue Q1"');
  });

  test('toggle horizontal', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await page.waitForTimeout(500);
    await page.locator('#xy-horizontal').check();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('xychart-beta horizontal');
  });

  test('add line series', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await page.waitForTimeout(500);
    await page.locator('#xy-add-kind').selectOption('line');
    await page.locator('#xy-add-values').fill('100, 200, 300');
    await page.locator('#xy-add-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('line [100, 200, 300]');
  });

  test('update series values', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await page.waitForTimeout(800);
    await page.locator('.xy-select-series').first().click();
    await page.waitForTimeout(400);
    await page.locator('#xy-edit-values').fill('1, 2, 3');
    await page.locator('#xy-edit-values').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('[1, 2, 3]');
  });

  test('delete series', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await page.waitForTimeout(800);
    const before = await editorText(page);
    await page.locator('.xy-delete-series').first().click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after.split('\n').length).toBeLessThan(before.split('\n').length);
  });
});
