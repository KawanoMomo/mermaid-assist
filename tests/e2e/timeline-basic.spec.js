// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchToTL(page) {
  await page.locator('#diagram-type').selectOption('timeline');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Timeline: Switching', () => {
  test('switches to Timeline template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToTL(page);
    expect(await editorText(page)).toContain('timeline');
  });

  test('Timeline renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToTL(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('property panel shows timeline add UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToTL(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#tl-set-title-btn')).toBeVisible();
    await expect(page.locator('#tl-add-sec-btn')).toBeVisible();
    await expect(page.locator('#tl-add-p-btn')).toBeVisible();
    await expect(page.locator('#tl-add-ev-btn')).toBeVisible();
  });
});

test.describe('E41-E48: Timeline Operations', () => {
  test('E41: setting title updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToTL(page);
    await page.waitForTimeout(500);
    await page.locator('#tl-title').fill('New Plan');
    await page.locator('#tl-set-title-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('title New Plan');
  });

  test('E42: adding section updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToTL(page);
    await page.waitForTimeout(500);
    await page.locator('#tl-add-sec-name').fill('Q3');
    await page.locator('#tl-add-sec-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('section Q3');
  });

  test('E43: adding period updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToTL(page);
    await page.waitForTimeout(500);
    // Template has Q1, Q2
    await page.locator('#tl-add-p-section').selectOption('Q1');
    await page.locator('#tl-add-p-period').fill('2026-03');
    await page.locator('#tl-add-p-event').fill('milestone');
    await page.locator('#tl-add-p-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('2026-03 : milestone');
  });

  test('E44: adding event to existing period', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToTL(page);
    await page.waitForTimeout(800);
    const periodOpts = await page.locator('#tl-add-ev-period option').count();
    expect(periodOpts).toBeGreaterThan(0);
    await page.locator('#tl-add-ev-period').selectOption({ index: 0 });
    await page.locator('#tl-add-ev-text').fill('extra event');
    await page.locator('#tl-add-ev-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('extra event');
  });

  test('E45: vertical add form labels visible', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToTL(page);
    await page.waitForTimeout(800);
    expect(await page.locator('label:has-text("Section")').count()).toBeGreaterThan(0);
    expect(await page.locator('label:has-text("Period")').count()).toBeGreaterThan(0);
    expect(await page.locator('label:has-text("Event")').count()).toBeGreaterThan(0);
  });

  test('E46: section select opens detail panel', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToTL(page);
    await page.waitForTimeout(800);
    await page.locator('.tl-select-section[data-element-id="Q1"]').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('#tl-edit-sec-name')).toBeVisible();
  });

  test('E47: rename section via detail panel', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToTL(page);
    await page.waitForTimeout(800);
    await page.locator('.tl-select-section[data-element-id="Q1"]').first().click();
    await page.waitForTimeout(400);
    await page.locator('#tl-edit-sec-name').fill('Phase1');
    await page.locator('#tl-edit-sec-name').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('section Phase1');
  });

  test('E48: delete section cascades its periods', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToTL(page);
    await page.waitForTimeout(800);
    await page.locator('.tl-delete-section').first().click();
    await page.waitForTimeout(500);
    const txt = await editorText(page);
    // Template had section Q1 with 2 periods; after delete none should remain referencing Q1
    expect(txt).not.toContain('section Q1');
  });
});
