'use strict';
// 台本 primary(設計者)場面 3・手順 3:
//   レビュー指摘の反映。同名ラベル・接頭辞を共有する ID が混ざる flowchart(CRLF)で ID 改名を 3 件行い、
//   1 件ごとの差分行数と描画までの待ちを計る。接頭辞を共有する別 ID が巻き込まれないかを見る。
// 再現: CRLF の .mmd を開く → 図の上でノードを押す → ID 欄を書き換えて Enter → を 3 回 → .mmd を保存。
// 期待: G1 = 1 件ごとに動くのはその ID を書いた行だけで、行の中は ID の箇所だけが変わる
//       (Spi を改名しても SpiDrv / SpiDrvInit は無傷、Uart を改名しても UartTx は無傷、同名ラベルは変わらない)。
//       保存した .mmd は CRLF のままで、差分は 3 件の参照行の合計だけ /
//       G2 = 改名のたびに mermaid が図を描ける。
//       操作コストは principles.md の上限(要素 30 以下の図で操作から描画まで 300ms)。
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const H = require('./_helpers');

const CRLF = '\r\n';
const RENDER_LIMIT_MS = 300;

test('primary-3: ID 改名 3 件が 1 件ずつ参照行だけを動かし、接頭辞を巻き込まない', async ({ page, browser }, testInfo) => {
  const src = fs.readFileSync(path.join(H.FIXTURES, 'primary-flow-review.mmd'), 'utf8').replace(/\r?\n/g, CRLF);
  const inPath = testInfo.outputPath('primary-flow-review.mmd');
  fs.writeFileSync(inPath, src);

  await H.openApp(page);
  await H.openFixture(page, inPath);
  await expect(page.locator('#diagram-type')).toHaveValue('flowchart');

  const steps = [];
  async function rename(from, to, removed, added) {
    await page.locator('#overlay-layer [data-element-id="' + from + '"]').first().click({ force: true });
    const idField = page.locator('#sel-node-id');
    await expect(idField, from).toHaveValue(from);
    const before = await H.editorText(page);
    const ms = await H.timedRender(page, async () => {
      await idField.fill(to);
      await idField.press('Enter');
    });
    const after = await H.editorText(page);
    const d = H.lineDiff(before, after);
    // G1: その ID を書いた行だけが、ID の箇所だけ変わる
    expect(d.removed, from + ' → ' + to).toEqual(removed);
    expect(d.added, from + ' → ' + to).toEqual(added);
    // G2
    expect(ms, from + ' → ' + to + ': 描画が通らない').not.toBeNull();
    await expect(page.locator('#status-parse')).toHaveText(/OK/);
    const r = await H.renderWithMermaid(browser, after);
    expect(r.render, from + ' → ' + to + ': mermaid が描けない').toBe('OK');
    steps.push({ name: from + '→' + to, ms, lines: d.lines });
    return after;
  }

  // 1. Spi → SpiBus。SpiDrv / SpiDrvInit は接頭辞を共有するが動かない
  let text = await rename('Spi', 'SpiBus', [
    '    Start[開始] --> Spi',
    '    Spi[SPI 初期化]',
    '    Spi --> SpiDrv',
    '    style Spi fill:#eef',
  ], [
    '    Start[開始] --> SpiBus',
    '    SpiBus[SPI 初期化]',
    '    SpiBus --> SpiDrv',
    '    style SpiBus fill:#eef',
  ]);
  expect(text).toContain('    SpiDrv[SpiDrv]');
  expect(text).toContain('    SpiDrvInit[SpiDrv 初期化]');

  // 2. SpiDrvInit → SpiInit。SpiDrv(同名ラベル「SpiDrv」を持つ)は動かない
  text = await rename('SpiDrvInit', 'SpiInit', [
    '    SpiDrvInit[SpiDrv 初期化]',
    '    SpiDrv --> SpiDrvInit',
    '    SpiDrvInit --> Uart',
  ], [
    '    SpiInit[SpiDrv 初期化]',
    '    SpiDrv --> SpiInit',
    '    SpiInit --> Uart',
  ]);
  expect(text).toContain('    SpiDrv[SpiDrv]');
  expect(text).toContain('    SpiBus --> SpiDrv');

  // 3. Uart → Uart0。UartTx は接頭辞を共有するが動かない
  text = await rename('Uart', 'Uart0', [
    '    Uart[UART 初期化]',
    '    SpiInit --> Uart',
    '    Uart --> UartTx',
  ], [
    '    Uart0[UART 初期化]',
    '    SpiInit --> Uart0',
    '    Uart0 --> UartTx',
  ]);
  expect(text).toContain('    UartTx[UART 送信]');
  expect(text).toContain('    UartTx -->|完了| Done[終了]');
  expect(text).not.toMatch(/Uart0Tx|SpiBusDrv|SpiInitDrv/);
  await page.screenshot({ path: testInfo.outputPath('primary-3-renamed.png') });

  // 保存した .mmd は CRLF のまま(LF が混ざらない)で、差分は 3 件の参照行の合計(4 + 3 + 3 から 2 度動いた `SpiDrvInit --> Uart` の重なりを除いた 9 行)
  const saved = await H.saveMmd(page, testInfo.outputPath('primary-flow-review.after.mmd'));
  const crlf = saved.split(CRLF).length - 1;
  const lone = saved.split('\n').length - 1 - crlf;
  expect(crlf).toBeGreaterThan(0);
  expect(lone).toBe(0);
  expect(H.lineDiff(src, saved).lines).toBe(9);

  // 操作コスト(principles.md): 要素 30 以下の図で操作から描画まで 300ms 以内
  for (const s of steps) {
    expect(s.ms, s.name + ': 描画までの待ち').toBeLessThanOrEqual(RENDER_LIMIT_MS);
  }

  H.record(testInfo, 'renderMs', Math.max.apply(null, steps.map((s) => s.ms || 0)));
  H.record(testInfo, 'diffLines', Math.max.apply(null, steps.map((s) => s.lines)));
});
