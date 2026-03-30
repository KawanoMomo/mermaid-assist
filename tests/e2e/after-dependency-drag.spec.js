// @ts-check
// ═══════════════════════════════════════════════════════════════════════════
//  after依存タスクのドラッグ時negative widthバグ再現テスト
//  a1を右にドラッグ → a2(after a1)の開始がa2の終了日を超える → 負の幅
// ═══════════════════════════════════════════════════════════════════════════
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}

async function editorText(page) {
  return page.locator('#editor').inputValue();
}

test.describe('after依存タスクのドラッグ', () => {

  test('a1を右に大きくドラッグしても negative width エラーが出ない', async ({ page }) => {
    // Collect ALL console errors during the test
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await page.goto(HTML_URL);
    await waitForRender(page);

    // Default content: a2 has "after a1, 2026-04-25"
    // If we drag a1 far right so a1 ends after 2026-04-25, a2 gets negative duration
    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const box = await bar.boundingBox();
    if (!box) throw new Error('bar a1 not found');

    // Drag a1 far to the right (200px ≈ several weeks)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // Move in steps to trigger throttled re-renders
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(
        box.x + box.width / 2 + (i + 1) * 30,
        box.y + box.height / 2
      );
      await page.waitForTimeout(120); // trigger 100ms throttled render
    }
    await page.mouse.up();
    await page.waitForTimeout(1000);

    // Check for negative width errors
    const negativeErrors = errors.filter(e =>
      e.includes('negative') || e.includes('Negative') || e.includes('A negative value')
    );
    expect(negativeErrors).toHaveLength(0);
  });

  test('a1を右にドラッグした後、a2の日付が破綻していない', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const box = await bar.boundingBox();
    if (!box) throw new Error('bar a1 not found');

    // Drag a1 far to the right
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);

    const text = await editorText(page);

    // a2 should either:
    // (a) still have after a1 with an end date >= a1's end date, OR
    // (b) have been converted to explicit dates that don't conflict
    // In any case, if a2 has explicit dates, start < end must hold
    const a2Match = text.match(/:a2,\s*(\d{4}-\d{2}-\d{2}),\s*(\d{4}-\d{2}-\d{2})/);
    if (a2Match) {
      const start = new Date(a2Match[1]);
      const end = new Date(a2Match[2]);
      expect(end.getTime()).toBeGreaterThanOrEqual(start.getTime());
    }

    // If a2 still uses "after a1", check that a1's end < a2's end
    const afterMatch = text.match(/:a2,\s*after a1,\s*(\d{4}-\d{2}-\d{2})/);
    const a1Match = text.match(/:a1,\s*\d{4}-\d{2}-\d{2},\s*(\d{4}-\d{2}-\d{2})/);
    if (afterMatch && a1Match) {
      const a1End = new Date(a1Match[1]);
      const a2End = new Date(afterMatch[1]);
      expect(a2End.getTime()).toBeGreaterThanOrEqual(a1End.getTime());
    }
  });
});
