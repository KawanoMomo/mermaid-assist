// 削除した直後にフォーカスが body へ落ちていた。
//
// 実測: 100要素の図で `c50` の ✕ を押すと、隣の `c51` の ✕ へ戻るまで **Tab 120回**。
// パネルは innerHTML で作り直されるので、押したボタンごと DOM から消える。
// 「支援技術のボタン一覧から選べるようにする」ために名前を入れたのに、選んだ直後に
// 居場所を失っていた (WCAG 2.4.3 Focus Order)。
//
// ユニットテストでは jsdom にフォーカス管理が無く、パネルの作り直しも起きないので、
// ここは E2E でしか固定できない。
const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');

async function load(page) {
  await page.goto(FILE);
  await page.waitForFunction(() => window.MA && window.MA.modules && window.MA.modules.c4);
}

test.describe('削除した後もキーボードの居場所が残る', () => {
  test('一覧の ✕ を押すと、次の行の ✕ にフォーカスが移る', async ({ page }) => {
    await load(page);
    await page.selectOption('#diagram-type', 'C4Context');
    await page.waitForTimeout(500);
    const lines = ['C4Container', '    title T'];
    for (let i = 0; i < 40; i++) lines.push(`    Container(c${i}, "Node_${i}", "C")`);
    await page.fill('#editor', lines.join('\n') + '\n');
    await page.waitForTimeout(1500);

    await page.evaluate(() => document.querySelectorAll('button.c4-delete-element')[20].focus());
    const before = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
    expect(before).toContain('c20');

    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    const after = await page.evaluate(() => {
      const a = document.activeElement;
      const list = Array.prototype.slice.call(document.querySelectorAll('button.c4-delete-element'));
      return { isBody: a === document.body, aria: a ? a.getAttribute('aria-label') : null, idx: list.indexOf(a), len: list.length };
    });
    // body に落ちていない。消した位置に繰り上がった行の ✕ にいる。
    expect(after.isBody).toBe(false);
    expect(after.len).toBe(39);
    expect(after.idx).toBe(20);
    expect(after.aria).toContain('c21');
  });

  test('最後の行を消したときは、繰り上がりが無いので手前の行へ寄る', async ({ page }) => {
    await load(page);
    await page.selectOption('#diagram-type', 'C4Context');
    await page.waitForTimeout(500);
    await page.fill('#editor', 'C4Container\n    title T\n    Container(a, "A", "C")\n    Container(b, "B", "C")\n    Container(c, "C", "C")\n');
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const l = document.querySelectorAll('button.c4-delete-element');
      l[l.length - 1].focus();
    });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    const after = await page.evaluate(() => {
      const a = document.activeElement;
      const list = Array.prototype.slice.call(document.querySelectorAll('button.c4-delete-element'));
      return { isBody: a === document.body, aria: a ? a.getAttribute('aria-label') : null, idx: list.indexOf(a), len: list.length };
    });
    expect(after.isBody).toBe(false);
    expect(after.len).toBe(2);
    expect(after.idx).toBe(1);
    expect(after.aria).toContain('"B"');
  });
});
