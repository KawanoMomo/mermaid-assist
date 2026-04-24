// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');
async function waitForRender(page) { await page.waitForSelector('#preview-svg svg', { timeout: 10000 }); await page.waitForTimeout(600); }
async function switchTo(page) { await page.locator('#diagram-type').selectOption('packet-beta'); await page.waitForTimeout(1500); }
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Packet: Switching', () => {
  test('switches to Packet template', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page);
    expect(await editorText(page)).toContain('packet-beta');
  });
  test('Packet renders SVG', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });
  test('panel shows Packet UI', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    await expect(page.locator('#pk-add-btn')).toBeVisible();
    await expect(page.locator('#pk-set-title')).toBeVisible();
  });
});

test.describe('Packet Operations', () => {
  test('set title', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#pk-title').fill('UDP Packet');
    await page.locator('#pk-set-title').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('title "UDP Packet"');
  });
  test('add range field', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(500);
    await page.locator('#pk-add-start').fill('200');
    await page.locator('#pk-add-end').fill('215');
    await page.locator('#pk-add-label').fill('Checksum');
    await page.locator('#pk-add-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('200-215: "Checksum"');
  });
  test('update field label', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    await page.locator('.pk-select-field').first().click();
    await page.waitForTimeout(400);
    await page.locator('#pk-edit-label').fill('NewLabel');
    await page.locator('#pk-edit-label').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('"NewLabel"');
  });
  test('delete field', async ({ page }) => {
    await page.goto(HTML_URL); await waitForRender(page); await switchTo(page); await page.waitForTimeout(800);
    const before = await editorText(page);
    await page.locator('.pk-delete-field').first().click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after.split('\n').length).toBeLessThan(before.split('\n').length);
  });
});
