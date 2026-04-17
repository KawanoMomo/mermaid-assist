// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');
async function waitForRender(page) { await page.waitForSelector('#preview-svg svg', { timeout: 10000 }); await page.waitForTimeout(600); }
async function switchTo(page) { await page.locator('#diagram-type').selectOption('sankey-beta'); await page.waitForTimeout(1500); }
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Sankey: Switching', () => {
  test('switches to Sankey template', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page);
    expect(await editorText(page)).toContain('sankey-beta');
  });
  test('Sankey renders SVG', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });
  test('panel shows Sankey UI', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    await expect(page.locator('#sk-add-btn')).toBeVisible();
  });
});

test.describe('Sankey Operations', () => {
  test('add flow', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#sk-add-src').fill('NewSrc');
    await page.locator('#sk-add-tgt').fill('NewTgt');
    await page.locator('#sk-add-val').fill('42');
    await page.locator('#sk-add-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('NewSrc,NewTgt,42');
  });
  test('update flow value', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    await page.locator('.sk-select-flow').first().click();
    await page.waitForTimeout(400);
    await page.locator('#sk-edit-val').fill('999');
    await page.locator('#sk-edit-val').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain(',999');
  });
  test('delete flow', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    const before = await editorText(page);
    await page.locator('.sk-delete-flow').first().click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after.split('\n').length).toBeLessThan(before.split('\n').length);
  });
  test('cross-switch console 0', async ({ page }) => {
    const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page);
    await page.waitForTimeout(800);
    await page.locator('#diagram-type').selectOption('gantt');
    await page.waitForTimeout(1500);
    await page.locator('#diagram-type').selectOption('sankey-beta');
    await page.waitForTimeout(1500);
    expect(errors.length).toBe(0);
  });
});
