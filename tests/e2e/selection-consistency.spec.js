// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');

async function ready(page) {
  page.on('dialog', d => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(800);
}
const selected = (page) => page.evaluate(() => window.MA.selection.getSelected());
const panel = (page) => page.locator('#props-content').textContent();

// 編集したあとに選択が古い要素を指したままになっていた。
//
//   要素を選択 → その行をエディタから消す
//     → 選択は消えた id を指し続け、パネルは「タスクが見つかりません」で固まる
//   要素を選択 → ID をリネーム
//     → 選択は旧 id のまま。**自分でリネームしただけでパネルが使えなくなる**
test.describe('選択の整合', () => {
  test('選択した要素を消すと選択も外れる', async ({ page }) => {
    await ready(page);
    await page.locator('#overlay-layer .overlay-bar').first().click({ force: true });
    await page.waitForTimeout(700);
    expect((await selected(page)).length).toBe(1);

    const text = await page.locator('#editor').inputValue();
    await page.evaluate((t) => {
      const ed = document.getElementById('editor');
      ed.value = t;
      ed.dispatchEvent(new Event('input'));
    }, text.split('\n').filter(l => !/:a1,/.test(l)).join('\n'));
    await page.waitForTimeout(1500);

    expect(await selected(page)).toEqual([]);
    expect(await panel(page)).not.toContain('見つかりません');
  });

  test('ID をリネームすると選択が新しい ID へ移る', async ({ page }) => {
    await ready(page);
    await page.locator('#overlay-layer .overlay-bar').first().click({ force: true });
    await page.waitForTimeout(700);

    const idIn = page.locator('#prop-id');
    await expect(idIn).toHaveCount(1);
    await idIn.fill('renamed1');
    await idIn.blur();
    await page.waitForTimeout(1500);

    expect(await selected(page)).toEqual([{ type: 'task', id: 'renamed1' }]);
    // パネルはそのタスクを表示し続ける (編集を続けられる)
    expect(await panel(page)).not.toContain('見つかりません');
    expect(await panel(page)).toContain('ラベル');
  });

  test('セクション選択は名前で保たれる', async ({ page }) => {
    await ready(page);
    // セクションは id を持たず name で選択される。
    // 「存在しない選択を落とす」処理が name を見ていないと、
    // セクションを選ぶたびに即座に外れてしまう
    await page.evaluate(() => {
      window.MA.selection.setSelected([{ type: 'section', id: '要件定義' }]);
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const ed = document.getElementById('editor');
      ed.value = ed.value + '\n';
      ed.dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(1500);

    expect(await selected(page)).toEqual([{ type: 'section', id: '要件定義' }]);
  });

  test('図種を切り替えると前の図の選択が残らない', async ({ page }) => {
    await ready(page);
    await page.locator('#overlay-layer .overlay-bar').first().click({ force: true });
    await page.waitForTimeout(700);
    expect((await selected(page)).length).toBe(1);

    await page.locator('#diagram-type').selectOption('flowchart');
    await page.waitForTimeout(1800);
    expect(await selected(page)).toEqual([]);
  });
});
