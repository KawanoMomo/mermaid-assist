// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');

// 仕様 (2026-04-14 Tier1 design) は「エッジは connection mode で接続」
// 「クリック2回でエッジ作成 共通機構 / 全モジュールから利用」と書いていたが、
// `core/connection-mode.js` は**一度も呼ばれていなかった**。
// 20モジュールすべてが operations.connect() を持っているのに、
// キャンバスからは到達できず、線を引くにはプロパティパネルの
// From / To 2つのドロップダウン + ボタンで5操作かかっていた。
const CASES = [
  ['flowchart',     'sel-node-connect',   'A',        'E',        /A\s*-->\s*E/],
  ['classDiagram',  'sel-class-connect',  'Animal',   'Dog',      /Animal.*Dog/],
  ['erDiagram',     'sel-ent-connect',    'CUSTOMER', 'ORDER',    /CUSTOMER\s+\|\|--o\{\s+ORDER/],
  ['stateDiagram',  'sel-state-connect',  'Idle',     'Running',  /Idle\s+-->\s+Running/],
  ['block-beta',    'block-edit-connect', 'a',        'c',        /a\s*-->\s*c/],
];

test.describe('接続モード: 図の上でクリック2回でエッジを引く', () => {
  for (const [type, btnId, from, to, expectRe] of CASES) {
    test(`${type}: ${from} → ${to} を繋げる`, async ({ page }) => {
      page.on('dialog', d => d.accept());
      await page.goto(HTML_URL);
      await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
      await page.waitForTimeout(600);
      await page.locator('#diagram-type').selectOption(type);
      await page.waitForTimeout(1600);
      const before = await page.locator('#editor').inputValue();

      await page.locator(`#overlay-layer [data-element-id="${from}"]`).click({ force: true });
      await page.waitForTimeout(700);
      await expect(page.locator('#' + btnId)).toHaveCount(1);
      await page.locator('#' + btnId).click();
      await page.waitForTimeout(600);
      await page.locator(`#overlay-layer [data-element-id="${to}"]`).click({ force: true });
      await page.waitForTimeout(1300);

      const after = await page.locator('#editor').inputValue();
      expect(after).not.toBe(before);
      expect(after).toMatch(expectRe);
      // 追加した結果が mermaid を壊していないこと。
      // er はラベルを省略できず `A ||--o{ B` が Parse error になるので、
      // ここが通ることが実際の回帰防止になっている
      expect(await page.locator('#status-parse').textContent()).toBe('OK');
    });
  }

  test('自分自身へは繋がない', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
    await page.waitForTimeout(600);
    await page.locator('#diagram-type').selectOption('flowchart');
    await page.waitForTimeout(1600);
    const before = await page.locator('#editor').inputValue();

    await page.locator('#overlay-layer [data-element-id="A"]').click({ force: true });
    await page.waitForTimeout(700);
    await page.locator('#sel-node-connect').click();
    await page.waitForTimeout(600);
    await page.locator('#overlay-layer [data-element-id="A"]').click({ force: true });
    await page.waitForTimeout(1200);

    expect(await page.locator('#editor').inputValue()).toBe(before);
  });
});
