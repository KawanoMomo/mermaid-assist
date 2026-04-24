// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchToGG(page) {
  await page.locator('#diagram-type').selectOption('gitGraph');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Gitgraph: Switching', () => {
  test('switches to Gitgraph template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToGG(page);
    expect(await editorText(page)).toContain('gitGraph');
  });

  test('Gitgraph renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToGG(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('property panel shows gitgraph add UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToGG(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#gg-add-commit-btn')).toBeVisible();
    await expect(page.locator('#gg-add-branch-btn')).toBeVisible();
    await expect(page.locator('#gg-add-checkout-btn')).toBeVisible();
    await expect(page.locator('#gg-add-merge-btn')).toBeVisible();
    await expect(page.locator('#gg-add-cp-btn')).toBeVisible();
  });
});

test.describe('E57-E66: Gitgraph Operations', () => {
  test('E57: add bare commit', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToGG(page);
    await page.waitForTimeout(500);
    const before = await editorText(page);
    const countBefore = (before.match(/^\s*commit/gm) || []).length;
    await page.locator('#gg-add-commit-btn').click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    const countAfter = (after.match(/^\s*commit/gm) || []).length;
    expect(countAfter).toBe(countBefore + 1);
  });

  test('E58: add commit with id, type, tag', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToGG(page);
    await page.waitForTimeout(500);
    await page.locator('#gg-add-commit-id').fill('v1');
    await page.locator('#gg-add-commit-type').selectOption('HIGHLIGHT');
    await page.locator('#gg-add-commit-tag').fill('milestone');
    await page.locator('#gg-add-commit-btn').click();
    await page.waitForTimeout(500);
    const t = await editorText(page);
    expect(t).toContain('id: "v1"');
    expect(t).toContain('type: HIGHLIGHT');
    expect(t).toContain('tag: "milestone"');
  });

  test('E59: add branch', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToGG(page);
    await page.waitForTimeout(500);
    await page.locator('#gg-add-branch-name').fill('feature-x');
    await page.locator('#gg-add-branch-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('branch feature-x');
  });

  test('E60: add checkout', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToGG(page);
    await page.waitForTimeout(500);
    // Template has 'branch develop'; main is in dropdown too
    await page.locator('#gg-add-checkout-target').selectOption('develop');
    await page.locator('#gg-add-checkout-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('checkout develop');
  });

  test('E61: add merge with tag', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToGG(page);
    await page.waitForTimeout(500);
    // Template already has 'merge develop' at end; add another merge
    await page.locator('#gg-add-merge-target').selectOption('develop');
    await page.locator('#gg-add-merge-tag').fill('v2');
    await page.locator('#gg-add-merge-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('tag: "v2"');
  });

  test('E62: add cherry-pick', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToGG(page);
    await page.waitForTimeout(500);
    await page.locator('#gg-add-cp-id').selectOption('init');
    await page.locator('#gg-add-cp-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('cherry-pick id: "init"');
  });

  test('E63: 3 commit types selectable', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToGG(page);
    await page.waitForTimeout(500);
    const opts = await page.locator('#gg-add-commit-type option').allTextContents();
    expect(opts).toContain('NORMAL');
    expect(opts).toContain('REVERSE');
    expect(opts).toContain('HIGHLIGHT');
  });

  test('E64: vertical add form labels visible', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToGG(page);
    await page.waitForTimeout(800);
    expect(await page.locator('label:has-text("Commit を追加")').count()).toBeGreaterThan(0);
    expect(await page.locator('label:has-text("Branch を追加")').count()).toBeGreaterThan(0);
    expect(await page.locator('label:has-text("Merge を追加")').count()).toBeGreaterThan(0);
  });

  test('E65: commit detail panel + update id', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToGG(page);
    await page.waitForTimeout(800);
    // Template has 'commit id: "init"' as second line; click its select
    await page.locator('.gg-select-item').nth(1).click();
    await page.waitForTimeout(400);
    await expect(page.locator('#gg-edit-id')).toBeVisible();
    await page.locator('#gg-edit-id').fill('initial');
    await page.locator('#gg-edit-id').dispatchEvent('change');
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('id: "initial"');
  });

  test('E66: delete item via list', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToGG(page);
    await page.waitForTimeout(800);
    const before = await editorText(page);
    await page.locator('.gg-delete-item').first().click();
    await page.waitForTimeout(500);
    const after = await editorText(page);
    expect(after).not.toBe(before);
    expect(after.split('\n').length).toBeLessThan(before.split('\n').length);
  });
});
