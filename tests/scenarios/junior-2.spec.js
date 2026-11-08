'use strict';
// 台本 junior(新人 PM)場面 2・手順 2:
//   先輩の指摘で done / active / crit を付けて外し、ラベルを直す。
// 再現: 状態タグを 2 つ持つタスク(`結合テスト :crit, done, k6, ...`)のある .mmd を開く →
// バーを押す → パネルの ID・日付・状態がその行どおりに出る → ラベルを直す →
// crit だけを外す → crit を付け直す。
// 期待: G1 = どの操作でも本文は押した欄の 1 行だけが変わり、終了日も他のタグも残る /
//       G2 = 操作のたびに mermaid が図を描ける(状態タグを 1 つしか読まないと
//       `Invalid date:k6` で図全体が描けなくなっていた)。
const { test, expect } = require('@playwright/test');
const H = require('./_helpers');

test('junior-2: crit と done を持つタスクのラベルと状態を直す', async ({ page, browser }, testInfo) => {
  await H.openApp(page);
  await H.openFixture(page, 'junior-plan-tags.mmd');
  await expect(page.locator('#status-parse')).toHaveText(/OK/);

  let clicks = 0;
  await page.locator('#overlay-layer .overlay-bar[data-task-id="k6"]').click();
  clicks++;

  // パネルは行どおり: ID は k6、開始日・終了日は日付、crit と done が点いている
  await expect(page.locator('#prop-id')).toHaveValue('k6');
  await expect(page.locator('#prop-start')).toHaveValue('2026-11-25');
  await expect(page.locator('#prop-end')).toHaveValue('2026-11-27');
  await expect(page.locator('.prop-status-btn[data-status="crit"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.prop-status-btn[data-status="done"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.prop-status-btn[data-status="active"]')).toHaveAttribute('aria-pressed', 'false');

  const steps = [];
  async function step(name, fn, expected) {
    const before = await H.editorText(page);
    const ms = await H.timedRender(page, fn);
    const after = await H.editorText(page);
    const d = H.lineDiff(before, after);
    expect(d.removed.length, name).toBe(1);
    expect(d.added.map((l) => l.trim()), name).toEqual([expected]);
    expect(ms, name + ': 描画が通らない').not.toBeNull();
    await expect(page.locator('#status-parse')).toHaveText(/OK/);
    const r = await H.renderWithMermaid(browser, after);
    expect(r.render, name + ': mermaid が描けない').toBe('OK');
    steps.push({ name, ms, lines: d.lines });
    return after;
  }

  // 1. ラベルを直す(Tab で確定)。終了日も crit / done も消えない
  await step('label', async () => {
    await page.locator('#prop-label').fill('結合テスト2');
    await page.keyboard.press('Tab');
    clicks += 2;
  }, '結合テスト2 :crit, done, k6, 2026-11-25, 2026-11-27');

  // 2. crit だけを外す。done は残る
  // 選択は操作の後も残る(バーをもう一度押すと選択が外れる)
  await expect(page.locator('#prop-id')).toHaveValue('k6');
  await step('crit-off', async () => {
    await page.locator('.prop-status-btn[data-status="crit"]').click();
    clicks++;
  }, '結合テスト2 :done, k6, 2026-11-25, 2026-11-27');

  // 3. crit を付け直す。done は残る
  await expect(page.locator('#prop-id')).toHaveValue('k6');
  await expect(page.locator('.prop-status-btn[data-status="crit"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.prop-status-btn[data-status="done"]')).toHaveAttribute('aria-pressed', 'true');
  const last = await step('crit-on', async () => {
    await page.locator('.prop-status-btn[data-status="crit"]').click();
    clicks++;
  }, '結合テスト2 :done, crit, k6, 2026-11-25, 2026-11-27');

  // 押していない行は 1 行も動いていない
  const orig = require('fs').readFileSync(require('path').join(H.FIXTURES, 'junior-plan-tags.mmd'), 'utf8');
  // (末尾の改行の有無は開くときの扱いなので比べない)
  const total = H.lineDiff(orig.trimEnd(), last.trimEnd());
  expect(total.lines).toBe(1);
  await expect(page.locator('#preview-svg svg')).toContainText('結合テスト2');
  await page.screenshot({ path: testInfo.outputPath('junior-2-tags.png') });

  H.record(testInfo, 'renderMs', Math.max.apply(null, steps.map((s) => s.ms || 0)));
  H.record(testInfo, 'diffLines', Math.max.apply(null, steps.map((s) => s.lines)));
  H.record(testInfo, 'clicks', clicks);
});
