'use strict';
// 台本 primary(設計者)場面 3・手順 4:
//   レビュー指摘の反映。ラベル直し 5 件とエッジ文言 2 件を行い、1 件ごとの差分が 1 行かを見る。
//   途中で Undo 1 回 → Redo 1 回で戻り方を見る。
// 再現: CRLF の flowchart を開く → 図の上でノードを押してラベル欄を書き換え Enter(5 件。同名ラベル
//   「SpiDrv」を持つ SpiDrv と「SpiDrv 初期化」を持つ SpiDrvInit を含む)→ 3 件目の後に Undo → Redo →
//   一覧の「編集」でエッジを選び、ラベル欄を書き換え Enter(2 件)。
// 期待: G1 = 1 件ごとに動くのは押した要素を書いた 1 行だけで、行の中は押した欄の字だけが変わる。
//       Undo 1 回で直前の 1 件だけが戻り、Redo 1 回で同じ本文に戻る。保存した .mmd は CRLF のまま 7 行差分 /
//       G2 = 操作のたびに mermaid が図を描ける。
//       操作コストは principles.md の上限(要素 30 以下の図で操作から描画まで 300ms)。
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const H = require('./_helpers');

const CRLF = '\r\n';
const RENDER_LIMIT_MS = 300;

test('primary-4: ラベル直し 5 件・エッジ文言 2 件が 1 件 1 行で、Undo 1 回 → Redo 1 回で戻る', async ({ page, browser }, testInfo) => {
  const src = fs.readFileSync(path.join(H.FIXTURES, 'primary-flow-labels.mmd'), 'utf8').replace(/\r?\n/g, CRLF);
  const inPath = testInfo.outputPath('primary-flow-labels.mmd');
  fs.writeFileSync(inPath, src);

  await H.openApp(page);
  await H.openFixture(page, inPath);
  await expect(page.locator('#diagram-type')).toHaveValue('flowchart');

  const steps = [];
  async function edit(name, field, value, removed, added) {
    const before = await H.editorText(page);
    const ms = await H.timedRender(page, async () => {
      await field.fill(value);
      await field.press('Enter');
    });
    const after = await H.editorText(page);
    const d = H.lineDiff(before, after);
    expect(d.removed, name).toEqual([removed]);
    expect(d.added, name).toEqual([added]);
    expect(ms, name + ': 描画が通らない').not.toBeNull();
    await expect(page.locator('#status-parse')).toHaveText(/OK/);
    const r = await H.renderWithMermaid(browser, after);
    expect(r.render, name + ': mermaid が描けない').toBe('OK');
    steps.push({ name, ms, lines: d.lines });
    return after;
  }

  async function relabelNode(id, oldLabel, value, removed, added) {
    await page.locator('#overlay-layer [data-element-id="' + id + '"]').first().click({ force: true });
    const field = page.locator('#sel-node-label');
    await expect(page.locator('#sel-node-id'), id).toHaveValue(id);
    await expect(field, id).toHaveValue(oldLabel);
    return edit(id, field, value, removed, added);
  }

  async function relabelEdge(oldLabel, value, removed, added) {
    // Escape で選択を外して一覧に戻り、エッジの行の「編集」で選ぶ
    await page.keyboard.press('Escape');
    const row = page.locator('.ma-list-row', { hasText: '|' + oldLabel + '|' });
    await expect(row, oldLabel).toHaveCount(1);
    await row.locator('.fc-select-edge').click();
    const field = page.locator('#sel-edge-label');
    await expect(field, oldLabel).toHaveValue(oldLabel);
    return edit('edge ' + oldLabel, field, value, removed, added);
  }

  // ラベル直し 1〜3
  await relabelNode('Init', '初期化', 'ハード初期化',
    '    Start[開始] --> Init[初期化]', '    Start[開始] --> Init[ハード初期化]');
  await relabelNode('Spi', 'SPI 初期化', 'SPI0 初期化',
    '    Init --> Spi[SPI 初期化]', '    Init --> Spi[SPI0 初期化]');
  const before3 = await H.editorText(page);
  // 同名ラベル「SpiDrv」— SpiDrvInit の「SpiDrv 初期化」は巻き込まない
  const after3 = await relabelNode('SpiDrv', 'SpiDrv', 'SPI ドライバ',
    '    Spi --> SpiDrv[SpiDrv]', '    Spi --> SpiDrv[SPI ドライバ]');
  expect(after3).toContain('    SpiDrv --> SpiDrvInit[SpiDrv 初期化]');

  // Undo 1 回で 3 件目だけが戻り、Redo 1 回で同じ本文に戻る
  const msUndo = await H.timedRender(page, () => page.locator('#btn-undo').click());
  expect(await H.editorText(page), 'Undo 1 回で直前の 1 件だけ戻る').toBe(before3);
  const msRedo = await H.timedRender(page, () => page.locator('#btn-redo').click());
  expect(await H.editorText(page), 'Redo 1 回で戻る').toBe(after3);
  expect(msUndo, 'Undo: 描画が通らない').not.toBeNull();
  expect(msRedo, 'Redo: 描画が通らない').not.toBeNull();
  steps.push({ name: 'undo', ms: msUndo, lines: 1 }, { name: 'redo', ms: msRedo, lines: 1 });

  // ラベル直し 4〜5
  await relabelNode('SpiDrvInit', 'SpiDrv 初期化', 'SPI ドライバ初期化',
    '    SpiDrv --> SpiDrvInit[SpiDrv 初期化]', '    SpiDrv --> SpiDrvInit[SPI ドライバ初期化]');
  await relabelNode('Done', '終了', '完了',
    '    Send --> Done[終了]', '    Send --> Done[完了]');

  // エッジ文言 2 件
  await relabelEdge('はい', '可',
    '    Check -->|はい| Send[送信]', '    Check -->|可| Send[送信]');
  const last = await relabelEdge('いいえ', '不可',
    '    Check -->|いいえ| Wait[待機]', '    Check -->|不可| Wait[待機]');
  await page.screenshot({ path: testInfo.outputPath('primary-4-relabeled.png') });

  // 押していない行(Wait --> Check、SpiDrvInit --> Check{送信可?})は動いていない
  expect(last).toContain('    Wait --> Check' + '\n');
  expect(last).toContain('    SpiDrvInit --> Check{送信可?}');

  // 保存した .mmd は CRLF のまま(LF が混ざらない)で、差分は直した 7 件分の 7 行
  const saved = await H.saveMmd(page, testInfo.outputPath('primary-flow-labels.after.mmd'));
  const crlf = saved.split(CRLF).length - 1;
  const lone = saved.split('\n').length - 1 - crlf;
  expect(crlf).toBeGreaterThan(0);
  expect(lone).toBe(0);
  expect(H.lineDiff(src, saved).lines).toBe(7);

  // 操作コスト(principles.md): 要素 30 以下の図で操作から描画まで 300ms 以内
  for (const s of steps) {
    expect(s.ms, s.name + ': 描画までの待ち').toBeLessThanOrEqual(RENDER_LIMIT_MS);
  }

  H.record(testInfo, 'renderMs', Math.max.apply(null, steps.map((s) => s.ms || 0)));
  H.record(testInfo, 'diffLines', Math.max.apply(null, steps.map((s) => s.lines)));
});
