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

test.describe('E15-E16: Sequence add form unification', () => {
  test('E15: メッセージ追加フォームに From/Arrow/To のラベル表示', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToSequence(page);
    await page.waitForTimeout(800);

    // labels exist for from/arrow/to selects
    const fromLabel = await page.locator('label:has-text("From")').count();
    const arrowLabel = await page.locator('label:has-text("Arrow")').count();
    const toLabel = await page.locator('label:has-text("To")').count();
    expect(fromLabel).toBeGreaterThan(0);
    expect(arrowLabel).toBeGreaterThan(0);
    expect(toLabel).toBeGreaterThan(0);
  });

  test('E16: OAuthミニシナリオ — 新参加者追加 + 3メッセージ追加', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToSequence(page);
    await page.waitForTimeout(500);

    // Add User
    await page.locator('#seq-add-part-id').fill('User');
    await page.locator('#seq-add-part-label').fill('User');
    await page.locator('#seq-add-part-btn').click();
    await page.waitForTimeout(300);

    // Add AuthServer
    await page.locator('#seq-add-part-id').fill('AuthServer');
    await page.locator('#seq-add-part-label').fill('AuthServer');
    await page.locator('#seq-add-part-btn').click();
    await page.waitForTimeout(300);

    // Add 3 messages
    await page.locator('#seq-add-msg-from').selectOption('User');
    await page.locator('#seq-add-msg-to').selectOption('A');
    await page.locator('#seq-add-msg-arrow').selectOption('->>');
    await page.locator('#seq-add-msg-label').fill('認可開始');
    await page.locator('#seq-add-msg-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#seq-add-msg-from').selectOption('A');
    await page.locator('#seq-add-msg-to').selectOption('AuthServer');
    await page.locator('#seq-add-msg-arrow').selectOption('->>');
    await page.locator('#seq-add-msg-label').fill('認可リクエスト');
    await page.locator('#seq-add-msg-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#seq-add-msg-from').selectOption('AuthServer');
    await page.locator('#seq-add-msg-to').selectOption('A');
    await page.locator('#seq-add-msg-arrow').selectOption('-->>');
    await page.locator('#seq-add-msg-label').fill('認可コード');
    await page.locator('#seq-add-msg-btn').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('participant User');
    expect(text).toContain('participant AuthServer');
    expect(text).toContain('認可開始');
    expect(text).toContain('認可リクエスト');
    expect(text).toContain('認可コード');
  });
});
