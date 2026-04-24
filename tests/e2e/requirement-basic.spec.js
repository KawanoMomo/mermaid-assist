// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchToReq(page) {
  await page.locator('#diagram-type').selectOption('requirementDiagram');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Requirement: Switching', () => {
  test('switches to Requirement template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    expect(await editorText(page)).toContain('requirementDiagram');
  });

  test('Requirement renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('property panel shows requirement add UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#req-add-req-btn')).toBeVisible();
    await expect(page.locator('#req-add-elem-btn')).toBeVisible();
    await expect(page.locator('#req-add-rel-btn')).toBeVisible();
  });
});

test.describe('E25-E32: Requirement Operations', () => {
  test('E25: adding requirement with reqType updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(500);
    await page.locator('#req-add-req-type').selectOption('functionalRequirement');
    await page.locator('#req-add-req-name').fill('myReq');
    await page.locator('#req-add-req-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('functionalRequirement myReq {');
  });

  test('E26: adding element updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(500);
    await page.locator('#req-add-elem-name').fill('ecu');
    await page.locator('#req-add-elem-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('element ecu {');
  });

  test('E27: adding relation with all 7 reltypes selectable', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(500);
    const opts = await page.locator('#req-add-rel-type option').allTextContents();
    expect(opts).toContain('contains');
    expect(opts).toContain('copies');
    expect(opts).toContain('derives');
    expect(opts).toContain('satisfies');
    expect(opts).toContain('verifies');
    expect(opts).toContain('refines');
    expect(opts).toContain('traces');
  });

  test('E28: add-relation creates the line', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(500);
    await page.locator('#req-add-elem-name').fill('elemA');
    await page.locator('#req-add-elem-btn').click();
    await page.waitForTimeout(300);
    await page.locator('#req-add-rel-from').selectOption('elemA');
    await page.locator('#req-add-rel-type').selectOption('verifies');
    await page.locator('#req-add-rel-to').selectOption('sample_req');
    await page.locator('#req-add-rel-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('elemA - verifies -> sample_req');
  });

  test('E29: vertical add form labels visible (From/Type/To)', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(800);
    expect(await page.locator('label:has-text("From")').count()).toBeGreaterThan(0);
    expect(await page.locator('label:has-text("Type")').count()).toBeGreaterThan(0);
    expect(await page.locator('label:has-text("To")').count()).toBeGreaterThan(0);
  });

  test('E30: 6 reqType selectable in add form', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(500);
    const opts = await page.locator('#req-add-req-type option').allTextContents();
    expect(opts).toContain('requirement');
    expect(opts).toContain('functionalRequirement');
    expect(opts).toContain('interfaceRequirement');
    expect(opts).toContain('performanceRequirement');
    expect(opts).toContain('physicalRequirement');
    expect(opts).toContain('designConstraint');
  });

  test('E31: rename element updates relation reference', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(800);
    await page.locator('.req-select-elem[data-element-id="sample_elem"]').first().click();
    await page.waitForTimeout(400);
    await page.locator('#req-edit-elem-name').fill('renamed_elem');
    await page.locator('#req-edit-elem-name').dispatchEvent('change');
    await page.waitForTimeout(500);
    const txt = await editorText(page);
    expect(txt).toContain('element renamed_elem');
    expect(txt).toContain('renamed_elem - satisfies -> sample_req');
  });

  test('E32: delete element cascades relation removal', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(800);
    await page.locator('.req-select-elem[data-element-id="sample_elem"]').first().click();
    await page.waitForTimeout(400);
    await page.locator('#req-edit-elem-delete').click();
    await page.waitForTimeout(500);
    const txt = await editorText(page);
    expect(txt).not.toContain('element sample_elem');
    expect(txt).not.toContain('sample_elem - satisfies');
  });
});
