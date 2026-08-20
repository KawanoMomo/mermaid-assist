// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');

async function ready(page, type) {
  page.on('dialog', d => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
  if (type !== 'gantt') {
    await page.locator('#diagram-type').selectOption(type);
    await page.waitForTimeout(1600);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}
const head = async (page) =>
  (await page.locator('#props-content').textContent()).replace(/\s+/g, ' ').slice(0, 24);

// キーボードだけで要素を渡り歩けること。
// 以前は図の要素へ行く手段がマウスしか無く、12番目のノードを選ぶには
// 毎回それを図の中で探すか、プロパティ一覧をスクロールする必要があった。
test.describe('キーボードでの要素移動', () => {
  for (const type of ['gantt', 'flowchart', 'block-beta', 'classDiagram']) {
    test(`${type}: 矢印キーで次/前の要素へ移る`, async ({ page }) => {
      await ready(page, type);
      const first = await head(page);

      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(700);
      const a = await head(page);
      expect(a).not.toBe(first);

      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(700);
      const bb = await head(page);
      expect(bb).not.toBe(a);

      // 逆方向で戻る
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(700);
      expect(await head(page)).toBe(a);
    });
  }

  test('エディタに入力中は矢印キーを奪わない', async ({ page }) => {
    await ready(page, 'gantt');
    await page.locator('#editor').click();
    await page.locator('#editor').press('Home');
    const before = await page.locator('#props-content').textContent();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(500);
    // エディタのキャレット移動であって、選択は動かない
    expect(await page.locator('#props-content').textContent()).toBe(before);
  });

  test('入力欄にフォーカスがあるときも奪わない', async ({ page }) => {
    await ready(page, 'gantt');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(700);
    const selected = await head(page);
    const input = page.locator('#prop-label');
    if (await input.count()) {
      await input.click();
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(500);
      expect(await head(page)).toBe(selected);
    }
  });
});
