'use strict';
// owner 批評(TICKET-owner-20261109-0028-4、junior 場面 2 手順 2 の早回し):
//   「仕様レビューは 11/16 から」— パネルの開始日欄だけを 11-13 → 11-16 にする。
// 直す前: 本文は `仕様レビュー :k2, 2026-11-16, 2026-11-14` の 1 行差分、ステータスは OK、
//         バーは幅 0 で図から消え、何も知らされなかった。
// 期待: G1 = 開始日欄の操作は k2 の 1 行だけを変え、終了日は書いたとおりに残る /
//       ステータス行が「仕様レビュー」を名指しして逆転を知らせ、終了日を直すと消える /
//       G2 = どの段階でも mermaid が図を描ける。
const { test, expect } = require('@playwright/test');
const H = require('./_helpers');

test('owner-20261109-0028: 開始日を終了日より後にすると名指しで知らされ、直すと消える', async ({ page, browser }, testInfo) => {
  await H.openApp(page);
  await H.openFixture(page, 'owner-span-review.mmd');
  await expect(page.locator('#status-parse')).toHaveText(/OK/);
  await expect(page.locator('#status-info')).not.toContainText('終了日が開始日より前');

  await page.locator('#overlay-layer .overlay-bar[data-task-id="k2"]').click();
  await expect(page.locator('#prop-id')).toHaveValue('k2');
  await expect(page.locator('#prop-start')).toHaveValue('2026-11-13');
  await expect(page.locator('#prop-end')).toHaveValue('2026-11-14');

  const steps = [];
  async function step(name, fn, expected) {
    const before = await H.editorText(page);
    const ms = await H.timedRender(page, fn);
    const after = await H.editorText(page);
    const d = H.lineDiff(before, after);
    expect(d.removed.length, name).toBe(1);
    expect(d.added.map((l) => l.trim()), name).toEqual([expected]);
    expect(ms, name + ': 描画が通らない').not.toBeNull();
    const r = await H.renderWithMermaid(browser, after);
    expect(r.render, name + ': mermaid が描けない').toBe('OK');
    steps.push({ name, ms, lines: d.lines });
    return after;
  }

  // 1. 開始日だけを後ろへ。終了日は勝手に動かさない
  await step('start-after-end', async () => {
    await page.locator('#prop-start').fill('2026-11-16');
  }, '仕様レビュー :k2, 2026-11-16, 2026-11-14');
  await expect(page.locator('#status-info')).toContainText(
    '終了日が開始日より前: 「仕様レビュー」(2026-11-16 開始 / 2026-11-14 終了)');
  await page.screenshot({ path: testInfo.outputPath('owner-inverted.png') });

  // 2. 終了日を直すと指摘が消える
  await page.locator('#overlay-layer .overlay-bar[data-task-id="k2"]').waitFor({ state: 'attached' });
  await expect(page.locator('#prop-id')).toHaveValue('k2');
  const last = await step('fix-end', async () => {
    await page.locator('#prop-end').fill('2026-11-18');
  }, '仕様レビュー :k2, 2026-11-16, 2026-11-18');
  await expect(page.locator('#status-info')).not.toContainText('終了日が開始日より前');

  // 押していない行は 1 行も動いていない
  const orig = require('fs').readFileSync(require('path').join(H.FIXTURES, 'owner-span-review.mmd'), 'utf8');
  const total = H.lineDiff(orig.trimEnd(), last.trimEnd());
  expect(total.lines).toBe(1);

  H.record(testInfo, 'renderMs', Math.max.apply(null, steps.map((s) => s.ms || 0)));
  H.record(testInfo, 'diffLines', Math.max.apply(null, steps.map((s) => s.lines)));
});
