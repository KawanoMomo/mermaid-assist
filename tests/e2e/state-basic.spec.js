// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchToState(page) {
  await page.locator('#diagram-type').selectOption('stateDiagram');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('State: Switching', () => {
  test('switches to state template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToState(page);
    const text = await editorText(page);
    expect(text).toContain('stateDiagram');
  });

  test('state renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToState(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('property panel shows state UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToState(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#st-add-state-btn')).toBeVisible();
    await expect(page.locator('#st-add-tr-btn')).toBeVisible();
  });
});

test.describe('State: Operations', () => {
  test('adding state updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToState(page);
    await page.waitForTimeout(500);
    await page.locator('#st-add-state-id').fill('Paused');
    await page.locator('#st-add-state-label').fill('Paused');
    await page.locator('#st-add-state-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('state Paused');
  });

  test('adding transition updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToState(page);
    await page.waitForTimeout(500);
    await page.locator('#st-add-tr-from').selectOption('Idle');
    await page.locator('#st-add-tr-to').selectOption('Running');
    await page.locator('#st-add-tr-event').fill('go');
    await page.locator('#st-add-tr-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('go');
  });

  test('adding composite updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToState(page);
    await page.waitForTimeout(500);
    await page.locator('#st-add-comp-id').fill('SuperState');
    await page.locator('#st-add-comp-label').fill('Super');
    await page.locator('#st-add-comp-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('state "Super" as SuperState');
  });
});
