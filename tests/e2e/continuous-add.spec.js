// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_PATH = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');

// 項目3 の目的は「タスクを続けて何本も入れる」こと。
// 追加後にそのタスクを自動選択していたため、プロパティパネルが詳細表示に
// 切り替わって**追加フォームごと消えて**いた。実測でも追加直後に
// prop-add-label が存在せず、2本目を入れるには毎回 Escape で戻る必要があった。
test.describe('タスクの連続入力', () => {
  async function ready(page) {
    await page.goto(HTML_PATH);
    await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  test('追加してもフォームが残り、ラベル欄にフォーカスが戻る', async ({ page }) => {
    await ready(page);
    await page.locator('#prop-add-label').fill('工程1');
    await page.locator('#prop-add-start').fill('2026-05-20');
    await page.locator('#prop-add-label').press('Enter');
    await page.waitForTimeout(1300);

    await expect(page.locator('#prop-add-label')).toHaveCount(1);
    expect(await page.evaluate(() => document.activeElement && document.activeElement.id))
      .toBe('prop-add-label');
  });

  test('クリックせずに3本続けて入れられる', async ({ page }) => {
    await ready(page);
    await page.locator('#prop-add-label').fill('工程1');
    await page.locator('#prop-add-start').fill('2026-05-20');
    await page.locator('#prop-add-end').fill('2026-05-25');
    await page.locator('#prop-add-label').press('Enter');
    await page.waitForTimeout(1300);

    for (const n of [2, 3]) {
      await page.keyboard.type('工程' + n);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1300);
    }

    const text = await page.locator('#editor').inputValue();
    expect(text).toContain('工程1');
    expect(text).toContain('工程2');
    expect(text).toContain('工程3');
  });

  test('日程が前のタスクから自動で送られる', async ({ page }) => {
    await ready(page);
    await page.locator('#prop-add-label').fill('工程1');
    await page.locator('#prop-add-start').fill('2026-05-20');
    await page.locator('#prop-add-end').fill('2026-05-25');
    await page.locator('#prop-add-label').press('Enter');
    await page.waitForTimeout(1300);
    await page.keyboard.type('工程2');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1300);

    const text = await page.locator('#editor').inputValue();
    // 前タスクの終了日が次の開始日になり、期間 (5日) が維持される
    expect(text).toContain('2026-05-20, 2026-05-25');
    expect(text).toContain('2026-05-25, 2026-05-30');
  });

  test('ID が既存と衝突しない', async ({ page }) => {
    await ready(page);
    await page.locator('#prop-add-label').fill('工程1');
    await page.locator('#prop-add-start').fill('2026-05-20');
    await page.locator('#prop-add-end').fill('2026-05-25');
    await page.locator('#prop-add-label').press('Enter');
    await page.waitForTimeout(1300);
    await page.keyboard.type('工程2');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1300);

    const text = await page.locator('#editor').inputValue();
    const ids = (text.match(/:(t\d+),/g) || []).map(s => s.slice(1, -1));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
