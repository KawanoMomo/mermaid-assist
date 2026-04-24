// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');
async function waitForRender(page) { await page.waitForSelector('#preview-svg svg', { timeout: 10000 }); await page.waitForTimeout(600); }
async function switchTo(page) { await page.locator('#diagram-type').selectOption('architecture-beta'); await page.waitForTimeout(1500); }
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Architecture: Switching', () => {
  test('switches to Architecture template', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page);
    expect(await editorText(page)).toContain('architecture-beta');
  });
  test('Architecture renders SVG', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page);
    await expect(page.locator('#preview-svg svg').first()).toBeVisible();
  });
  test('panel shows Architecture UI', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    await expect(page.locator('#arch-add-g-btn')).toBeVisible();
    await expect(page.locator('#arch-add-s-btn')).toBeVisible();
    await expect(page.locator('#arch-add-e-btn')).toBeVisible();
  });
});

test.describe('Architecture Operations', () => {
  test('add group', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#arch-add-g-id').fill('newg');
    await page.locator('#arch-add-g-label').fill('NewGroup');
    await page.locator('#arch-add-g-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('group newg(cloud)[NewGroup]');
  });
  test('add service with parent', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#arch-add-s-id').fill('svc1');
    await page.locator('#arch-add-s-icon').selectOption('server');
    await page.locator('#arch-add-s-label').fill('SvcX');
    await page.locator('#arch-add-s-parent').selectOption('api');
    await page.locator('#arch-add-s-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('service svc1(server)[SvcX] in api');
  });
  test('add edge', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#arch-add-e-from').selectOption('db');
    await page.locator('#arch-add-e-to').selectOption('gateway');
    await page.locator('#arch-add-e-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('db:');
  });
  test('update service label', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    await page.locator('.arch-select-service').first().click();
    await page.waitForTimeout(400);
    await page.locator('#arch-edit-label').fill('Renamed');
    await page.locator('#arch-edit-label').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('[Renamed]');
  });
  test('delete edge', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    const before = await editorText(page);
    await page.locator('.arch-delete-edge').first().click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after.split('\n').length).toBeLessThan(before.split('\n').length);
  });
});
