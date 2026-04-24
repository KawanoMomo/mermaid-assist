// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchToJourney(page) {
  await page.locator('#diagram-type').selectOption('journey');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Journey: Switching', () => {
  test('switches to Journey template', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchToJourney(page);
    expect(await editorText(page)).toContain('journey');
  });
  test('Journey renders SVG', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchToJourney(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });
  test('property panel shows journey UI', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchToJourney(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#jr-set-title-btn')).toBeVisible();
    await expect(page.locator('#jr-add-sec-btn')).toBeVisible();
    await expect(page.locator('#jr-add-t-btn')).toBeVisible();
  });
});

test.describe('Journey Operations', () => {
  test('set title updates text', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchToJourney(page);
    await page.waitForTimeout(500);
    await page.locator('#jr-title').fill('新しい旅');
    await page.locator('#jr-set-title-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('title 新しい旅');
  });
  test('add section updates text', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchToJourney(page);
    await page.waitForTimeout(500);
    await page.locator('#jr-add-sec-name').fill('夕方');
    await page.locator('#jr-add-sec-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('section 夕方');
  });
  test('add task updates text', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchToJourney(page);
    await page.waitForTimeout(500);
    await page.locator('#jr-add-t-section').selectOption('午前');
    await page.locator('#jr-add-t-text').fill('運動');
    await page.locator('#jr-add-t-score').fill('4');
    await page.locator('#jr-add-t-actors').fill('私');
    await page.locator('#jr-add-t-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('運動: 4: 私');
  });
  test('task detail + update score', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchToJourney(page);
    await page.waitForTimeout(800);
    await page.locator('.jr-select-task').first().click();
    await page.waitForTimeout(400);
    await page.locator('#jr-edit-t-score').fill('9');
    await page.locator('#jr-edit-t-score').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain(': 9: ');
  });
  test('delete section cascades tasks', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchToJourney(page);
    await page.waitForTimeout(800);
    const before = await editorText(page);
    await page.locator('.jr-delete-section').first().click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after.split('\n').length).toBeLessThan(before.split('\n').length);
    expect(after).not.toContain('section 午前');
  });
});
