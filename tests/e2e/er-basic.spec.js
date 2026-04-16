// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchToER(page) {
  await page.locator('#diagram-type').selectOption('erDiagram');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('ER: Switching', () => {
  test('switches to ER template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToER(page);
    expect(await editorText(page)).toContain('erDiagram');
  });

  test('ER renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToER(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('property panel shows ER UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToER(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#er-add-ent-btn')).toBeVisible();
    await expect(page.locator('#er-add-rel-btn')).toBeVisible();
  });
});

test.describe('ER: Operations', () => {
  test('adding entity updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToER(page);
    await page.waitForTimeout(500);
    await page.locator('#er-add-ent-id').fill('PRODUCT');
    await page.locator('#er-add-ent-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('PRODUCT {');
  });

  test('adding attribute updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToER(page);
    await page.waitForTimeout(500);
    await page.locator('#er-add-attr-entity').selectOption('CUSTOMER');
    await page.locator('#er-add-attr-type').fill('int');
    await page.locator('#er-add-attr-name').fill('age');
    await page.locator('#er-add-attr-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('int age');
  });

  test('adding relationship updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToER(page);
    await page.waitForTimeout(500);
    await page.locator('#er-add-rel-from').selectOption('CUSTOMER');
    await page.locator('#er-add-rel-to').selectOption('ORDER');
    await page.locator('#er-add-rel-label').fill('newrel');
    await page.locator('#er-add-rel-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('newrel');
  });
});

test.describe('E23-E24: ER add form unification', () => {
  test('E23: リレーションシップ追加フォームに From/Cards/To のラベル表示', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToER(page);
    await page.waitForTimeout(800);

    const fromLabel = await page.locator('label:has-text("From")').count();
    const lcLabel = await page.locator('label:has-text("Left card")').count();
    const rcLabel = await page.locator('label:has-text("Right card")').count();
    const toLabel = await page.locator('label:has-text("To")').count();
    expect(fromLabel).toBeGreaterThan(0);
    expect(lcLabel).toBeGreaterThan(0);
    expect(rcLabel).toBeGreaterThan(0);
    expect(toLabel).toBeGreaterThan(0);
  });

  test('E24: DB設計ミニ — 1 entity + attribute + 1 relationship', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToER(page);
    await page.waitForTimeout(500);

    await page.locator('#er-add-ent-id').fill('PRODUCT');
    await page.locator('#er-add-ent-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#er-add-attr-entity').selectOption('PRODUCT');
    await page.locator('#er-add-attr-type').fill('int');
    await page.locator('#er-add-attr-name').fill('id');
    await page.locator('#er-add-attr-key').selectOption('PK');
    await page.locator('#er-add-attr-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#er-add-rel-from').selectOption('PRODUCT');
    await page.locator('#er-add-rel-to').selectOption('CUSTOMER');
    await page.locator('#er-add-rel-label').fill('owned-by');
    await page.locator('#er-add-rel-btn').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('PRODUCT {');
    expect(text).toContain('int id PK');
    expect(text).toContain('PRODUCT ||--o{ CUSTOMER : owned-by');
  });
});
