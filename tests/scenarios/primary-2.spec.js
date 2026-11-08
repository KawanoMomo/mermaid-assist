'use strict';
// 台本 primary(設計者)場面 1・手順 2:
//   flowchart でノード SpiDrv の ID を QspiDrv に改名し、エッジ・他の行が追従するか、
//   接頭辞を共有する Spi / SpiDrvInit と同名ラベル「SpiDrv」が巻き込まれないかを差分で見る。
// 再現: CRLF の .mmd を開く → 図の上で SpiDrv を押す → ID 欄を QspiDrv にして確定 → .mmd を保存。
// 期待: G1 = 動くのは SpiDrv を ID として書いた行だけ(宣言・エッジ 3 本・style)で、
//       各行は ID の箇所だけが変わる。改行コードは CRLF のまま / G2 = 描画が通る。
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const H = require('./_helpers');

const CRLF = '\r\n';

test('primary-2: flowchart の ID 改名が参照に伝播し、接頭辞を巻き込まない', async ({ page }, testInfo) => {
  // primary の図は CRLF で保存されている
  const src = fs.readFileSync(path.join(H.FIXTURES, 'primary-flow-spi.mmd'), 'utf8').replace(/\r?\n/g, CRLF);
  const inPath = testInfo.outputPath('primary-flow-spi.mmd');
  fs.writeFileSync(inPath, src);

  await H.openApp(page);
  await H.openFixture(page, inPath);
  await expect(page.locator('#diagram-type')).toHaveValue('flowchart');
  const before = await H.editorText(page);

  // 図の上で SpiDrv を押す
  await page.locator('#overlay-layer [data-element-id="SpiDrv"]').first().click({ force: true });
  const idField = page.locator('#sel-node-id');
  await expect(idField).toBeVisible();
  await expect(idField).toHaveValue('SpiDrv');

  const ms = await H.timedRender(page, async () => {
    await idField.fill('QspiDrv');
    await idField.press('Enter');
  });
  const after = await H.editorText(page);
  const d = H.lineDiff(before, after);

  // G1: 動いたのは SpiDrv を ID として持つ行だけ。ID の箇所以外は 1 文字も変わらない
  expect(d.removed).toEqual([
    '    SpiDrv[SpiDrv]',
    '    Spi --> SpiDrv',
    '    SpiDrv --> SpiDrvInit',
    '    Check -->|いいえ| SpiDrv',
    '    style SpiDrv fill:#eef',
  ]);
  expect(d.added).toEqual([
    '    QspiDrv[SpiDrv]',
    '    Spi --> QspiDrv',
    '    QspiDrv --> SpiDrvInit',
    '    Check -->|いいえ| QspiDrv',
    '    style QspiDrv fill:#eef',
  ]);
  // 接頭辞を共有する ID は残る
  expect(after).toContain('Start[開始] --> Spi' + '\n');
  expect(after).toContain('Spi[SPI 初期化]');
  expect(after).toContain('SpiDrvInit[SpiDrv 初期化]');
  expect(after).not.toMatch(/QspiDrvInit|Qspi\[/);

  // G2: 描画が通る
  expect(ms).not.toBeNull();
  await expect(page.locator('#status-parse')).toHaveText(/OK/);
  await page.screenshot({ path: testInfo.outputPath('primary-2-renamed.png') });

  // 保存した .mmd は CRLF のまま(LF が混ざらない)で、差分は同じ 5 行
  const saved = await H.saveMmd(page, testInfo.outputPath('primary-flow-spi.after.mmd'));
  const crlf = saved.split(CRLF).length - 1;
  const lone = saved.split('\n').length - 1 - crlf;
  expect(crlf).toBeGreaterThan(0);
  expect(lone).toBe(0);
  expect(H.lineDiff(src, saved).lines).toBe(5);

  H.record(testInfo, 'renderMs', ms);
  H.record(testInfo, 'diffLines', d.lines);
});

// 同じ手順を、ラベル定義が参照より後ろにある図(primary の flow-1 の書き方)で。
// SpiDrv は `Spi[SPI 初期化] --> SpiDrv` で先に参照され、次の行で定義される。
// 以前はこの参照行に旧 ID をラベルとして書き足していた(`--> QspiDrv[SpiDrv]`、
// 押していない字が増える二重定義)。期待: 差分 4 行が ID の置換だけ。
test('primary-2: 定義より前に参照がある図でも、改名は ID の置換だけ', async ({ page }, testInfo) => {
  const src = fs.readFileSync(path.join(H.FIXTURES, 'primary-flow-spi-late.mmd'), 'utf8').replace(/\r?\n/g, CRLF);
  const inPath = testInfo.outputPath('primary-flow-spi-late.mmd');
  fs.writeFileSync(inPath, src);

  await H.openApp(page);
  await H.openFixture(page, inPath);
  await expect(page.locator('#diagram-type')).toHaveValue('flowchart');
  const before = await H.editorText(page);

  await page.locator('#overlay-layer [data-element-id="SpiDrv"]').first().click({ force: true });
  const idField = page.locator('#sel-node-id');
  await expect(idField).toHaveValue('SpiDrv');

  const ms = await H.timedRender(page, async () => {
    await idField.fill('QspiDrv');
    await idField.press('Enter');
  });
  const after = await H.editorText(page);
  const d = H.lineDiff(before, after);

  expect(d.removed).toEqual([
    '    Spi[SPI 初期化] --> SpiDrv',
    '    SpiDrv[SpiDrv] --> SpiDrvInit',
    '    Check -->|いいえ| SpiDrv',
    '    style SpiDrv fill:#eef',
  ]);
  expect(d.added).toEqual([
    '    Spi[SPI 初期化] --> QspiDrv',
    '    QspiDrv[SpiDrv] --> SpiDrvInit',
    '    Check -->|いいえ| QspiDrv',
    '    style QspiDrv fill:#eef',
  ]);
  // 同名ラベル「SpiDrv」は定義行の 1 か所だけ
  expect(after.match(/\[SpiDrv\]/g)).toHaveLength(1);

  expect(ms).not.toBeNull();
  await expect(page.locator('#status-parse')).toHaveText(/OK/);
  await page.screenshot({ path: testInfo.outputPath('primary-2-late-renamed.png') });

  H.record(testInfo, 'renderMs', ms);
  H.record(testInfo, 'diffLines', d.lines);
});
