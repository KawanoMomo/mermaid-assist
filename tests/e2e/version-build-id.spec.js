'use strict';
// E13 / UI-059: ステータス行に版 (VERSION) とコードの指紋が並ぶ。
// 版が同じでも中身が違えば指紋が変わる (計算は src/core/build-id.js、unit は version-sync.test.js)。
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..');
const HTML_URL = 'file:///' + path.join(ROOT, 'mermaid-assist.html').split(path.sep).join('/');

test.describe('版とコードの指紋', () => {
  test('ステータス行に v{VERSION} と #指紋 が出て、開き直しても同じ', async ({ page }) => {
    const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await expect(page.locator('#status-version')).toHaveText('v' + ver);
    const build = page.locator('#status-build');
    await expect(build).toBeVisible();
    const first = (await build.textContent()).trim();
    expect(first).toMatch(/^#[0-9a-f]{12}$/);
    expect(first).toBe('#' + await page.evaluate(() => window.MA.buildId.fingerprint));
    expect(await build.getAttribute('title')).toContain('v' + ver);

    // 図種を替えて操作しても、開き直しても同じ値 (状態は指紋に入らない)
    await page.locator('#diagram-type').selectOption('flowchart');
    await page.waitForTimeout(800);
    expect((await build.textContent()).trim()).toBe(first);
    await page.reload();
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    expect((await page.locator('#status-build').textContent()).trim()).toBe(first);
  });
});
