// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');
async function waitForRender(page) { await page.waitForSelector('#preview-svg svg', { timeout: 10000 }); await page.waitForTimeout(600); }
async function switchTo(page) { await page.locator('#diagram-type').selectOption('radar-beta'); await page.waitForTimeout(1500); }
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Radar: Switching', () => {
  test('switches to Radar template', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page);
    expect(await editorText(page)).toContain('radar-beta');
  });
  test('Radar renders SVG', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page);
    await expect(page.locator('#preview-svg svg').first()).toBeVisible();
  });
  test('panel shows Radar UI', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    await expect(page.locator('#rd-add-btn')).toBeVisible();
    await expect(page.locator('#rd-set-title')).toBeVisible();
  });
});

test.describe('Radar Operations', () => {
  test('set title', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#rd-title').fill('Team Skills');
    await page.locator('#rd-set-title').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('title "Team Skills"');
  });
  test('set min/max', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#rd-min').fill('0');
    await page.locator('#rd-max').fill('10');
    await page.locator('#rd-set-minmax').click();
    await page.waitForTimeout(500);
    const t = await editorText(page);
    expect(t).toContain('min 0');
    expect(t).toContain('max 10');
  });
  test('add curve', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#rd-add-id').fill('carol');
    await page.locator('#rd-add-label').fill('Carol');
    await page.locator('#rd-add-values').fill('60, 70, 80, 65, 90');
    await page.locator('#rd-add-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('curve carol["Carol"]{60, 70, 80, 65, 90}');
  });
  test('update curve values', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    await page.locator('.rd-select-curve').first().click();
    await page.waitForTimeout(400);
    await page.locator('#rd-edit-values').fill('10, 20, 30, 40, 50');
    await page.locator('#rd-edit-values').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('{10, 20, 30, 40, 50}');
  });
  test('delete curve', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    const before = await editorText(page);
    await page.locator('.rd-delete-curve').first().click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after.split('\n').length).toBeLessThan(before.split('\n').length);
  });
});
