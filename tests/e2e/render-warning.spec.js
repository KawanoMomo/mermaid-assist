'use strict';
// 描けたのに一部が落ちているときの警告帯。
//
// mermaid は必ず例外を投げるわけではない。kanban の列名に括弧を入れると
// parse は通り図も出るが、括弧の中だけが消える。利用者から見ると「入れたはずの
// 文字が図に無い」だけで、原因を知る手掛かりがどこにも出ていなかった。
// 失敗したときにだけ原因を言うのでは足りない。
const path = require('path');
const { test, expect } = require('@playwright/test');

const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');

async function setText(page, txt) {
  await page.evaluate((t) => {
    const ed = document.getElementById('editor');
    ed.value = t;
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  }, txt);
  await page.waitForTimeout(1200);
}

test.describe('描画警告帯', () => {
  test('列名に括弧を入れると警告帯が出る', async ({ page }) => {
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await setText(page, 'kanban\n    設計(詳細)\n        task1[やること]\n');

    const banner = page.locator('#parse-error-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('一部が反映されていません');
    await expect(banner).toContainText('列名');
    // エラーとは区別されること (図は出ている)
    await expect(banner).toHaveClass(/warn/);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('正しい本文に戻すと警告帯が消える', async ({ page }) => {
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await setText(page, 'kanban\n    設計(詳細)\n        task1[やること]\n');
    await expect(page.locator('#parse-error-banner')).toBeVisible();

    await setText(page, 'kanban\n    設計詳細\n        task1[やること]\n');
    await expect(page.locator('#parse-error-banner')).toBeHidden();
  });

  test('21図種のひな形では警告帯が出ない', async ({ page }) => {
    // 21図種を順に切り替えるので既定の 30 秒では足りない。
    test.setTimeout(180000);
    // 誤報が出る帯は無視されるようになる。ひな形は全て無警告であること。
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    const types = await page.locator('#diagram-type option').evaluateAll(
      (os) => os.map((o) => o.value));
    for (const t of types) {
      await page.locator('#diagram-type').selectOption(t);
      await page.waitForTimeout(1500);
      const shown = await page.locator('#parse-error-banner').isVisible();
      expect(shown, t + ' で警告帯が出ている').toBe(false);
    }
  });

  test('構文エラーの帯は今までどおり赤 (warn が付かない)', async ({ page }) => {
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await setText(page, 'gantt\n    dateFormat YYYY-MM-DD\n    section A\n    壊れた行 :::: ???\n');
    const banner = page.locator('#parse-error-banner');
    if (await banner.isVisible()) {
      await expect(banner).not.toHaveClass(/warn/);
    }
  });
});
