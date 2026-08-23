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

test.describe('gantt: セクションを動かした後も居場所が残る', () => {
  const DOC = ['gantt', '    title 開発計画', '    dateFormat YYYY-MM-DD',
    '    section 設計', '    要件定義 :a1, 2026-04-01, 10d',
    '    section 実装', '    コーディング :b1, after a1, 20d',
    '    section 検証', '    単体試験 :c1, after b1, 8d', ''].join('\n');

  async function setup(page) {
    await load(page);
    await page.selectOption('#diagram-type', 'gantt');
    await page.waitForTimeout(600);
    await page.fill('#editor', DOC);
    await page.waitForTimeout(1500);
  }

  test('↑ を続けて押してもフォーカスが body へ落ちない', async ({ page }) => {
    // 実測 (直す前): 押した直後に body へ飛び、同じ ↑ に戻るまで Tab 17回。
    // 「検証を一番上へ」(↑2回) が `Enter → Tab×17 → Enter` になっていた。
    await setup(page);
    await page.evaluate(() => document.querySelectorAll('.prop-section-up')[2].focus());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    const one = await page.evaluate(() => ({
      isBody: document.activeElement === document.body,
      aria: document.activeElement.getAttribute('aria-label'),
    }));
    expect(one.isBody).toBe(false);
    expect(one.aria).toContain('検証');

    // 2回目で先頭に着く。先頭の ↑ は無効になるので、同じ行の別のボタンへ寄る。
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    const two = await page.evaluate(() => ({
      isBody: document.activeElement === document.body,
      aria: document.activeElement.getAttribute('aria-label'),
      text: document.getElementById('editor').value,
    }));
    expect(two.isBody).toBe(false);
    expect(two.aria).toContain('検証');
    // 実際に一番上へ動いている
    expect(two.text.indexOf('section 検証') < two.text.indexOf('section 設計')).toBe(true);
  });

  test('先頭の ↑ と末尾の ↓ は無効になる', async ({ page }) => {
    // 押しても無言で何も起きないボタンは、壊れているのか端にいるのか区別がつかない。
    await setup(page);
    const state = await page.evaluate(() => {
      const ups = Array.prototype.slice.call(document.querySelectorAll('.prop-section-up'));
      const downs = Array.prototype.slice.call(document.querySelectorAll('.prop-section-down'));
      return { ups: ups.map(b => b.disabled), downs: downs.map(b => b.disabled) };
    });
    expect(state.ups[0]).toBe(true);
    expect(state.ups[state.ups.length - 1]).toBe(false);
    expect(state.downs[0]).toBe(false);
    expect(state.downs[state.downs.length - 1]).toBe(true);
  });

  test('gantt のボタンにも名前と 24px の標的サイズがある', async ({ page }) => {
    // gantt は共有の listItemHtml を通らないので、他の20図種に入れた a11y が
    // ここだけ素通りしていた。実測 (直す前): 19x20.2px / aria-label は null。
    await setup(page);
    const btns = await page.evaluate(() => {
      const sel = '.prop-section-up, .prop-section-down, .prop-section-delete, .prop-task-delete, .prop-task-select';
      return Array.prototype.slice.call(document.querySelectorAll(sel)).map(b => {
        const r = b.getBoundingClientRect();
        return { aria: b.getAttribute('aria-label'), w: r.width, h: r.height };
      });
    });
    expect(btns.length).toBeGreaterThan(0);
    for (const b of btns) {
      expect(b.aria).not.toBeNull();
      expect(b.w >= 24).toBe(true);
      expect(b.h >= 24).toBe(true);
    }
  });
});
