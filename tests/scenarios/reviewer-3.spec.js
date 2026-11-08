'use strict';
// 台本 reviewer(レビュー担当)手順 3:
//   primary の after の .mmd を実ブラウザの mermaid で描かせ、例外・要素数の増減を確かめる(G2)。
// 再現: primary-2 と同じ操作(SpiDrv → QspiDrv の改名)を GUI で行って保存した .mmd を after とし、
//       before / after を lib/mermaid.min.js だけを読んだ別のページで parse と render にかける。
// 期待: G2 = before も after も parse / render が通る。ID の改名なので図のノード数と
//       見える文字は変わらない(参照が切れると mermaid は黙って幽霊ノードを足す)。
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const H = require('./_helpers');

test('reviewer-3: 改名後の .mmd が mermaid で描け、ノードが増減しない', async ({ page, browser }, testInfo) => {
  const src = fs.readFileSync(path.join(H.FIXTURES, 'primary-flow-spi.mmd'), 'utf8').replace(/\r?\n/g, '\r\n');
  const inPath = testInfo.outputPath('before.mmd');
  fs.writeFileSync(inPath, src);

  // primary の出力を作る(GUI で改名して保存)
  await H.openApp(page);
  await H.openFixture(page, inPath);
  await page.locator('#overlay-layer [data-element-id="SpiDrv"]').first().click({ force: true });
  await expect(page.locator('#sel-node-id')).toHaveValue('SpiDrv');
  await page.locator('#sel-node-id').fill('QspiDrv');
  await page.locator('#sel-node-id').press('Enter');
  await H.waitIdle(page);
  const after = await H.saveMmd(page, testInfo.outputPath('after.mmd'));
  expect(after).toContain('QspiDrv');

  // reviewer の手: 実ブラウザの mermaid で before / after を描く
  const t0 = Date.now();
  const rb = await H.renderWithMermaid(browser, src);
  const ra = await H.renderWithMermaid(browser, after);
  const ms = Date.now() - t0;

  expect(rb.parse).toBe('OK');
  expect(rb.render).toBe('OK');
  expect(ra.parse).toBe('OK');
  expect(ra.render).toBe('OK');
  // 見える文字(ノードとエッジのラベル)は改名で変わらない = 幽霊ノードが無い
  expect([...ra.texts].sort()).toEqual([...rb.texts].sort());
  expect(rb.nodes).toBeGreaterThan(0);
  expect(ra.nodes).toBe(rb.nodes);
  // ID は図に出ない。出ていれば改名で切れた参照が幽霊ノードになっている
  expect(ra.texts).not.toContain('QspiDrv');

  H.record(testInfo, 'renderMs', ms);
  H.record(testInfo, 'diffLines', H.lineDiff(src, after).lines);
});
