// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');
async function waitForRender(page) { await page.waitForSelector('#preview-svg svg', { timeout: 10000 }); await page.waitForTimeout(600); }
async function switchTo(page) { await page.locator('#diagram-type').selectOption('kanban'); await page.waitForTimeout(1500); }
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Kanban: Switching', () => {
  test('switches to Kanban template', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page);
    expect(await editorText(page)).toContain('kanban');
  });
  test('Kanban renders SVG', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page);
    await expect(page.locator('#preview-svg svg').first()).toBeVisible();
  });
  test('panel shows Kanban UI', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    await expect(page.locator('#kb-add-col-btn')).toBeVisible();
    await expect(page.locator('#kb-add-c-btn')).toBeVisible();
  });
});

test.describe('Kanban Operations', () => {
  test('add column', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#kb-add-col-name').fill('Review');
    await page.locator('#kb-add-col-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('Review');
  });
  test('add card to existing column', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#kb-add-c-col').selectOption('Todo');
    await page.locator('#kb-add-c-text').fill('New task X');
    await page.locator('#kb-add-c-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('[New task X]');
  });
  test('update card text', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    await page.locator('.kb-select-card').first().click();
    await page.waitForTimeout(400);
    await page.locator('#kb-edit-c-text').fill('RenamedTask');
    await page.locator('#kb-edit-c-text').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('[RenamedTask]');
  });
  test('delete card', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    const before = await editorText(page);
    await page.locator('.kb-delete-card').first().click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after.split('\n').length).toBeLessThan(before.split('\n').length);
  });
  test('delete column cascades cards', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    const before = await editorText(page);
    await page.locator('.kb-delete-col').first().click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after).not.toContain('Todo');
  });
});
