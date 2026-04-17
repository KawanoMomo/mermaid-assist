// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchTo(page) {
  await page.locator('#diagram-type').selectOption('quadrantChart');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Quadrant: Switching', () => {
  test('switches to Quadrant template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    expect(await editorText(page)).toContain('quadrantChart');
  });

  test('Quadrant renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('panel shows quadrant UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#qd-set-title')).toBeVisible();
    await expect(page.locator('#qd-add-btn')).toBeVisible();
    await expect(page.locator('#qd-set-quads')).toBeVisible();
  });
});

test.describe('Quadrant Operations', () => {
  test('set title', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await page.waitForTimeout(500);
    await page.locator('#qd-title').fill('New Title');
    await page.locator('#qd-set-title').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('title New Title');
  });

  test('set x-axis', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await page.waitForTimeout(500);
    await page.locator('#qd-xleft').fill('L2');
    await page.locator('#qd-xright').fill('R2');
    await page.locator('#qd-set-xaxis').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('x-axis L2 --> R2');
  });

  test('add point', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await page.waitForTimeout(500);
    await page.locator('#qd-add-label').fill('MyPt');
    await page.locator('#qd-add-x').fill('0.4');
    await page.locator('#qd-add-y').fill('0.7');
    await page.locator('#qd-add-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('MyPt: [0.4, 0.7]');
  });

  test('update point x', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await page.waitForTimeout(800);
    await page.locator('.qd-select-point').first().click();
    await page.waitForTimeout(400);
    await page.locator('#qd-edit-x').fill('0.9');
    await page.locator('#qd-edit-x').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('[0.9,');
  });

  test('delete point', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchTo(page);
    await page.waitForTimeout(800);
    const before = await editorText(page);
    await page.locator('.qd-delete-point').first().click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after.split('\n').length).toBeLessThan(before.split('\n').length);
  });
});
