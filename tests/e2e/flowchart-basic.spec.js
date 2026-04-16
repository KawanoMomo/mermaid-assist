// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchToFlowchart(page) {
  await page.locator('#diagram-type').selectOption('flowchart');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Flowchart: Switching', () => {
  test('switches to flowchart template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToFlowchart(page);
    const text = await editorText(page);
    expect(text).toContain('flowchart');
  });

  test('flowchart renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToFlowchart(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('property panel shows flowchart UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToFlowchart(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#fc-add-node-btn')).toBeVisible();
    await expect(page.locator('#fc-add-edge-btn')).toBeVisible();
  });
});

test.describe('Flowchart: Operations', () => {
  test('adding node updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToFlowchart(page);
    await page.waitForTimeout(500);
    await page.locator('#fc-add-node-id').fill('Z');
    await page.locator('#fc-add-node-label').fill('Extra');
    await page.locator('#fc-add-node-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('Z[Extra]');
  });

  test('changing direction updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToFlowchart(page);
    await page.waitForTimeout(500);
    await page.locator('#fc-direction').selectOption('LR');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('flowchart LR');
  });

  test('adding edge updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToFlowchart(page);
    await page.waitForTimeout(500);
    await page.locator('#fc-add-edge-from').selectOption('A');
    await page.locator('#fc-add-edge-to').selectOption('E');
    await page.locator('#fc-add-edge-arrow').selectOption('-->');
    await page.locator('#fc-add-edge-btn').click();
    await page.waitForTimeout(500);
    const t = await editorText(page);
    expect(t).toContain('A --> E');
  });

  test('adding subgraph updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToFlowchart(page);
    await page.waitForTimeout(500);
    await page.locator('#fc-add-sg-id').fill('G1');
    await page.locator('#fc-add-sg-label').fill('Group');
    await page.locator('#fc-add-sg-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('subgraph G1 [Group]');
  });
});
