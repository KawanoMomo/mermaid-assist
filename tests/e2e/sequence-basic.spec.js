// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}

async function switchToSequence(page) {
  await page.locator('#diagram-type').selectOption('sequenceDiagram');
  await page.waitForTimeout(1500);
}

async function editorText(page) {
  return page.locator('#editor').inputValue();
}

test.describe('Sequence: Switching diagram type', () => {
  test('toolbar select switches to sequence template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToSequence(page);

    const text = await editorText(page);
    expect(text).toContain('sequenceDiagram');
    expect(text).toContain('participant');
  });

  test('sequence renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToSequence(page);

    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('property panel shows Sequence UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToSequence(page);

    // Wait for render + props panel build
    await page.waitForTimeout(800);

    // Should see add participant button
    await expect(page.locator('#seq-add-part-btn')).toBeVisible();
    await expect(page.locator('#seq-add-msg-btn')).toBeVisible();
  });
});

test.describe('Sequence: Add participant', () => {
  test('adding participant updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToSequence(page);
    await page.waitForTimeout(500);

    await page.locator('#seq-add-part-id').fill('C');
    await page.locator('#seq-add-part-label').fill('Carol');
    await page.locator('#seq-add-part-btn').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('participant C as Carol');
  });
});

test.describe('Sequence: Add message', () => {
  test('adding message updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToSequence(page);
    await page.waitForTimeout(500);

    // Default template has A (Client) and B (Server)
    await page.locator('#seq-add-msg-from').selectOption('A');
    await page.locator('#seq-add-msg-to').selectOption('B');
    await page.locator('#seq-add-msg-arrow').selectOption('->>');
    await page.locator('#seq-add-msg-label').fill('NewRequest');
    await page.locator('#seq-add-msg-btn').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('NewRequest');
  });
});

test.describe('Sequence: Autonumber', () => {
  test('toggling autonumber adds/removes the keyword', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToSequence(page);
    await page.waitForTimeout(500);

    await page.locator('#seq-autonumber').check();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('autonumber');

    await page.locator('#seq-autonumber').uncheck();
    await page.waitForTimeout(500);
    expect(await editorText(page)).not.toContain('autonumber');
  });
});

test.describe('Sequence: Add block', () => {
  test('adding loop block adds text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToSequence(page);
    await page.waitForTimeout(500);

    await page.locator('#seq-add-block-kind').selectOption('loop');
    await page.locator('#seq-add-block-label').fill('Retry');
    await page.locator('#seq-add-block-btn').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('loop Retry');
    expect(text).toContain('    end');
  });
});
