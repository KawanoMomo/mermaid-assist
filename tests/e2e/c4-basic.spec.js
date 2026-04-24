// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');
async function waitForRender(page) { await page.waitForSelector('#preview-svg svg', { timeout: 10000 }); await page.waitForTimeout(600); }
async function switchTo(page) { await page.locator('#diagram-type').selectOption('C4Context'); await page.waitForTimeout(1500); }
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('C4: Switching', () => {
  test('switches to C4 template', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page);
    expect(await editorText(page)).toContain('C4Context');
  });
  test('C4 renders SVG', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });
  test('panel shows C4 UI', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    await expect(page.locator('#c4-add-btn')).toBeVisible();
    await expect(page.locator('#c4-add-rel-btn')).toBeVisible();
    await expect(page.locator('#c4-set-variant')).toBeVisible();
  });
});

test.describe('C4 Operations', () => {
  test('set title', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#c4-title').fill('New Title');
    await page.locator('#c4-set-title').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('title New Title');
  });
  test('set variant to Container', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#c4-variant').selectOption('Container');
    await page.locator('#c4-set-variant').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('C4Container');
  });
  test('add Person element', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#c4-add-kind').selectOption('Person');
    await page.locator('#c4-add-id').fill('admin');
    await page.locator('#c4-add-label').fill('Admin');
    await page.locator('#c4-add-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('Person(admin, "Admin"');
  });
  test('add Rel between existing elements', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    await page.locator('#c4-add-rel-from').selectOption('user');
    await page.locator('#c4-add-rel-to').selectOption('sys');
    await page.locator('#c4-add-rel-label').fill('accesses');
    await page.locator('#c4-add-rel-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('Rel(user, sys, "accesses")');
  });
  test('update element label via detail', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    await page.locator('.c4-select-element').first().click();
    await page.waitForTimeout(400);
    await page.locator('#c4-edit-label').fill('NewLabel');
    await page.locator('#c4-edit-label').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('"NewLabel"');
  });
  test('delete element', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    const before = await editorText(page);
    await page.locator('.c4-delete-element').first().click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after.split('\n').length).toBeLessThan(before.split('\n').length);
  });
});
