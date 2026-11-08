'use strict';
// 台本 junior(新人 PM)場面 1・手順 1:
//   mermaid-assist.html を開き、何も読まずに gantt の新規作成に辿り着けるか。
// 再現: 開く → 図の種類が最初から Gantt → 空の gantt(.mmd)を開く → 何も選ばずに
// プロパティパネルの追加フォームが見えている → セクションを 1 つ、タスクを 1 つ足す。
// 期待: G1 = 1 操作で本文が 1 行だけ増える / G2 = 足したタスクが図に描かれる。
const { test, expect } = require('@playwright/test');
const H = require('./_helpers');

test('junior-1: gantt を開いて新規作成に辿り着く', async ({ page }, testInfo) => {
  await H.openApp(page);
  await expect(page.locator('#diagram-type')).toHaveValue('gantt');

  await H.openFixture(page, 'junior-empty.mmd');
  const empty = await H.editorText(page);
  expect(empty).toContain('gantt');
  expect(empty).not.toContain('section');

  // 何も選ばずに、追加の入口がパネルに見えている
  await expect(page.locator('#prop-add-btn')).toBeVisible();
  await expect(page.locator('#prop-add-sec-name')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('junior-1-open.png') });

  // セクションを 1 つ足す → 中身のある行は 1 行だけ増える(セクションの前の空行は製品の書式)
  const before1 = await H.editorText(page);
  const ms1 = await H.timedRender(page, async () => {
    await page.locator('#prop-add-sec-name').fill('設計');
    await page.locator('#prop-add-sec-btn').click();
  });
  const after1 = await H.editorText(page);
  const d1 = H.lineDiff(before1, after1);
  expect(d1.removed).toEqual([]);
  const filled1 = d1.added.filter((l) => l.trim() !== '');
  expect(filled1.map((l) => l.trim())).toEqual(['section 設計']);
  expect(d1.added.length).toBeLessThanOrEqual(2);

  // タスクを 1 つ足す → 本文は 1 行だけ増える
  await expect(page.locator('#prop-add-label')).toBeVisible();
  await page.locator('#prop-add-label').fill('要件定義');
  await page.locator('#prop-add-id').fill('req');
  await page.locator('#prop-add-start').fill('2026-11-09');
  await page.locator('#prop-add-end').fill('2026-11-13');
  const before2 = await H.editorText(page);
  const ms2 = await H.timedRender(page, () => page.locator('#prop-add-btn').click());
  const after2 = await H.editorText(page);
  const d2 = H.lineDiff(before2, after2);
  expect(d2.removed).toEqual([]);
  expect(d2.added.length).toBe(1);
  expect(d2.added[0]).toContain('要件定義');
  expect(d2.added[0]).toContain('req');
  // 足した行はセクションの下に入る
  const lines = after2.split('\n').map((l) => l.trim());
  expect(lines.indexOf(d2.added[0].trim())).toBeGreaterThan(lines.indexOf('section 設計'));

  // G2: 描画が通り、足したタスクが図に出ている
  expect(ms2).not.toBeNull();
  await expect(page.locator('#status-parse')).toHaveText(/OK/);
  await expect(page.locator('#preview-svg svg')).toContainText('要件定義');
  await page.screenshot({ path: testInfo.outputPath('junior-1-added.png') });

  H.record(testInfo, 'renderMs', Math.max(ms1 || 0, ms2 || 0));
  H.record(testInfo, 'diffLines', Math.max(d1.lines, d2.lines));
});
