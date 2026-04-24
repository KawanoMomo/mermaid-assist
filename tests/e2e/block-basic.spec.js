// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchToBlock(page) {
  await page.locator('#diagram-type').selectOption('block-beta');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Block: Switching', () => {
  test('switches to Block template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToBlock(page);
    expect(await editorText(page)).toContain('block-beta');
  });

  test('Block renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToBlock(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('property panel shows block add UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToBlock(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#block-add-btn')).toBeVisible();
    await expect(page.locator('#block-add-link-btn')).toBeVisible();
    await expect(page.locator('#block-set-cols-btn')).toBeVisible();
  });
});

test.describe('E33-E40: Block Operations', () => {
  test('E33: adding block updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToBlock(page);
    await page.waitForTimeout(500);
    await page.locator('#block-add-id').fill('newblock');
    await page.locator('#block-add-label').fill('New Block');
    await page.locator('#block-add-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('newblock["New Block"]');
  });

  test('E34: adding link updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToBlock(page);
    await page.waitForTimeout(500);
    // Template has a, b, c
    await page.locator('#block-add-link-from').selectOption('a');
    await page.locator('#block-add-link-to').selectOption('c');
    await page.locator('#block-add-link-label').fill('bypass');
    await page.locator('#block-add-link-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('a -- "bypass" --> c');
  });

  test('E35: setting columns updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToBlock(page);
    await page.waitForTimeout(500);
    await page.locator('#block-set-cols').fill('5');
    await page.locator('#block-set-cols-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('columns 5');
  });

  test('E36: adding group updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToBlock(page);
    await page.waitForTimeout(500);
    await page.locator('#block-add-group-id').fill('mygroup');
    await page.locator('#block-add-group-btn').click();
    await page.waitForTimeout(500);
    const t = await editorText(page);
    expect(t).toContain('block:mygroup');
    expect(t).toContain('end');
  });

  test('E37: 3 vertical form labels visible (From/To/ラベル)', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToBlock(page);
    await page.waitForTimeout(800);
    expect(await page.locator('label:has-text("From")').count()).toBeGreaterThan(0);
    expect(await page.locator('label:has-text("To")').count()).toBeGreaterThan(0);
    expect(await page.locator('label:has-text("ラベル")').count()).toBeGreaterThan(0);
  });

  test('E38: block select opens detail panel', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToBlock(page);
    await page.waitForTimeout(800);
    await page.locator('.block-select-block[data-element-id="a"]').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('#block-edit-id')).toBeVisible();
    await expect(page.locator('#block-edit-label')).toBeVisible();
  });

  test('E39: update block label via detail panel', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToBlock(page);
    await page.waitForTimeout(800);
    await page.locator('.block-select-block[data-element-id="a"]').first().click();
    await page.waitForTimeout(400);
    await page.locator('#block-edit-label').fill('Renamed');
    await page.locator('#block-edit-label').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('a["Renamed"]');
  });

  test('E40: delete link via list panel', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToBlock(page);
    await page.waitForTimeout(800);
    const before = await editorText(page);
    expect(before).toContain('a --> b');
    await page.locator('.block-delete-link').first().click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after).not.toContain('a --> b');
  });
});
