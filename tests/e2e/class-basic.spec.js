// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchToClass(page) {
  await page.locator('#diagram-type').selectOption('classDiagram');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Class: Switching', () => {
  test('switches to class template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToClass(page);
    expect(await editorText(page)).toContain('classDiagram');
  });

  test('class renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToClass(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('property panel shows class UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToClass(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#cl-add-class-btn')).toBeVisible();
    await expect(page.locator('#cl-add-rel-btn')).toBeVisible();
  });
});

test.describe('Class: Operations', () => {
  test('adding class updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToClass(page);
    await page.waitForTimeout(500);
    await page.locator('#cl-add-class-id').fill('Cat');
    await page.locator('#cl-add-class-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('class Cat');
  });

  test('adding relation updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToClass(page);
    await page.waitForTimeout(500);
    await page.locator('#cl-add-rel-from').selectOption('Dog');
    await page.locator('#cl-add-rel-to').selectOption('Animal');
    await page.locator('#cl-add-rel-arrow').selectOption('-->');
    await page.locator('#cl-add-rel-label').fill('extends2');
    await page.locator('#cl-add-rel-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('Dog --> Animal');
  });

  test('adding member updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToClass(page);
    await page.waitForTimeout(500);
    await page.locator('#cl-add-mem-class').selectOption('Animal');
    await page.locator('#cl-add-mem-name').fill('age');
    await page.locator('#cl-add-mem-type').fill('int');
    await page.locator('#cl-add-mem-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('Animal : +age int');
  });

  test('adding namespace updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToClass(page);
    await page.waitForTimeout(500);
    await page.locator('#cl-add-ns-id').fill('NS1');
    await page.locator('#cl-add-ns-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('namespace NS1');
  });
});

test.describe('E21-E22: Class add form unification', () => {
  test('E21: 関連追加フォームに From/Arrow/To のラベル表示', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToClass(page);
    await page.waitForTimeout(800);

    const fromLabel = await page.locator('label:has-text("From")').count();
    const arrowLabel = await page.locator('label:has-text("Arrow")').count();
    const toLabel = await page.locator('label:has-text("To")').count();
    expect(fromLabel).toBeGreaterThan(0);
    expect(arrowLabel).toBeGreaterThan(0);
    expect(toLabel).toBeGreaterThan(0);
  });

  test('E22: ECドメインミニ — 2 classes + 1 relation', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToClass(page);
    await page.waitForTimeout(500);

    await page.locator('#cl-add-class-id').fill('Customer');
    await page.locator('#cl-add-class-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#cl-add-class-id').fill('Order');
    await page.locator('#cl-add-class-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#cl-add-rel-from').selectOption('Customer');
    await page.locator('#cl-add-rel-arrow').selectOption('-->');
    await page.locator('#cl-add-rel-to').selectOption('Order');
    await page.locator('#cl-add-rel-label').fill('places');
    await page.locator('#cl-add-rel-btn').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('class Customer');
    expect(text).toContain('class Order');
    expect(text).toContain('Customer --> Order : places');
  });
});
