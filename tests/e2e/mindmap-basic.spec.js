// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchToMM(page) {
  await page.locator('#diagram-type').selectOption('mindmap');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Mindmap: Switching', () => {
  test('switches to Mindmap template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToMM(page);
    expect(await editorText(page)).toContain('mindmap');
  });

  test('Mindmap renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToMM(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('property panel shows mindmap add UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToMM(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#mm-add-btn')).toBeVisible();
    await expect(page.locator('#mm-add-parent')).toBeVisible();
    await expect(page.locator('#mm-add-shape')).toBeVisible();
  });
});

test.describe('E49-E56: Mindmap Operations', () => {
  test('E49: add child node updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToMM(page);
    await page.waitForTimeout(500);
    // Template has root((組み込み設計))
    await page.locator('#mm-add-parent').selectOption({ index: 1 });  // first node
    await page.locator('#mm-add-text').fill('新機能');
    await page.locator('#mm-add-shape').selectOption('default');
    await page.locator('#mm-add-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('新機能');
  });

  test('E50: add square-shaped node', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToMM(page);
    await page.waitForTimeout(500);
    await page.locator('#mm-add-parent').selectOption({ index: 1 });
    await page.locator('#mm-add-text').fill('SquareNode');
    await page.locator('#mm-add-shape').selectOption('square');
    await page.locator('#mm-add-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('[SquareNode]');
  });

  test('E51: 6 shape options selectable', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToMM(page);
    await page.waitForTimeout(800);
    const opts = await page.locator('#mm-add-shape option').allTextContents();
    expect(opts).toContain('default');
    expect(opts).toContain('square');
    expect(opts).toContain('rounded');
    expect(opts).toContain('circle');
    expect(opts).toContain('bang');
    expect(opts).toContain('cloud');
    expect(opts).toContain('hexagon');
  });

  test('E52: vertical add form labels visible', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToMM(page);
    await page.waitForTimeout(800);
    expect(await page.locator('label:has-text("親ノード")').count()).toBeGreaterThan(0);
    expect(await page.locator('label:has-text("Text")').count()).toBeGreaterThan(0);
    expect(await page.locator('label:has-text("Shape")').count()).toBeGreaterThan(0);
  });

  test('E53: node detail panel opens on select', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToMM(page);
    await page.waitForTimeout(800);
    await page.locator('.mm-select-node').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('#mm-edit-text')).toBeVisible();
    await expect(page.locator('#mm-edit-indent')).toBeVisible();
    await expect(page.locator('#mm-edit-outdent')).toBeVisible();
  });

  test('E54: update text via detail panel', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToMM(page);
    await page.waitForTimeout(800);
    // Click second item (not the root) to avoid changing root
    const items = page.locator('.mm-select-node');
    await items.nth(1).click();
    await page.waitForTimeout(400);
    await page.locator('#mm-edit-text').fill('Renamed');
    await page.locator('#mm-edit-text').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('Renamed');
  });

  test('E55: indent node via detail panel', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToMM(page);
    await page.waitForTimeout(800);
    const textBefore = await editorText(page);
    // Select second top-level item to indent it
    const items = page.locator('.mm-select-node');
    await items.nth(2).click();  // deeper node
    await page.waitForTimeout(400);
    await page.locator('#mm-edit-indent').click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after).not.toBe(textBefore);
  });

  test('E56: delete node via list delete button', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToMM(page);
    await page.waitForTimeout(800);
    const textBefore = await editorText(page);
    const firstDelete = page.locator('.mm-delete-node').first();
    await firstDelete.click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after).not.toBe(textBefore);
  });
});
