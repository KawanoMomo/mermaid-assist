'use strict';
// 台本 primary(設計者)場面 3・手順 6:
//   レビュー指摘 10 件を直した後に保存し、差分の行数(期待: 10 件分)と改行コードの混在を数える。
//   1 操作で 2 行以上動いたものは、動いた行が何かを確かめる。
// 再現: CRLF の flowchart を開く → 10 件を GUI で直す(_primary-review.js)→ Ctrl+S で保存 →
//   保存した .mmd を開き直してもう一度保存する。
// 期待: G1 = 保存した .mmd と元の .mmd の差分は 10 行(直した 10 件が触った行の和。改名は参照行の
//         2 行ずつで、ほかの 1 件が触る行と重なるので合計 10 行)。押していない行(UartTx --> Check{送信可?})は
//         元のまま。2 行以上動いた操作は改名 3 件だけで、動いた行はその ID の参照行。
//         改行コードは CRLF のまま LF が混ざらない。同じ本文からは同じバイト列が出る(開き直して保存しても同じ)/
//       G2 = 保存した本文を mermaid が描ける。
//       操作コストは principles.md の上限(要素 30 以下の図で操作から描画まで 300ms)。
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const H = require('./_helpers');
const R = require('./_primary-review');

const RENDER_LIMIT_MS = 300;

function eol(text) {
  const crlf = text.split(R.CRLF).length - 1;
  const lone = text.split('\n').length - 1 - crlf;
  const loneCr = text.split('\r').length - 1 - crlf;
  return { crlf, lone, loneCr };
}

test('primary-6: 10 件を直して保存すると差分は 10 行で、CRLF のまま混ざらない', async ({ page, browser }, testInfo) => {
  const src = await R.openReviewFixture(page, testInfo);
  const steps = await R.applyReviewFixes(page, browser);

  // 2 行以上動いた操作は改名だけで、動いた行はその ID の参照行
  const multi = steps.filter((s) => s.lines >= 2).map((s) => s.name);
  expect(multi).toEqual(R.FIXES.filter((f) => f.kind === 'rename').map((f) => f.kind + ' ' + f.from + ' → ' + f.to));
  for (const f of R.FIXES.filter((f) => f.kind === 'rename')) {
    for (const line of f.removed) expect(line, f.from + ' の参照行').toMatch(new RegExp('\\b' + f.from + '\\b'));
  }

  // 保存
  const outPath = testInfo.outputPath('primary-flow-review10.after.mmd');
  const saved = await H.saveMmd(page, outPath);
  const e = eol(saved);
  expect(e.crlf, 'CRLF のまま').toBeGreaterThan(0);
  expect(e.lone, 'LF が混ざらない').toBe(0);
  expect(e.loneCr, 'CR だけの行が無い').toBe(0);
  const d = H.lineDiff(src, saved);
  expect(d.lines, '差分は 10 件分').toBe(10);
  expect(d.removed.sort()).toEqual([].concat(...R.FIXES.map((f) => f.removed))
    .filter((l, i, a) => a.indexOf(l) === i)
    .filter((l) => src.replace(/\r\n/g, '\n').split('\n').includes(l)).sort());
  expect(saved).toContain('    UartTx --> Check{送信可?}' + R.CRLF);

  // G2: 保存した本文を mermaid が描ける
  const r = await H.renderWithMermaid(browser, saved);
  expect(r.render, '保存した .mmd を mermaid が描けない').toBe('OK');

  // 決定的: 開き直して何もせずに保存しても同じバイト列
  await H.openFixture(page, outPath);
  await expect(page.locator('#status-parse')).toHaveText(/OK/);
  const again = await H.saveMmd(page, testInfo.outputPath('primary-flow-review10.again.mmd'));
  expect(Buffer.from(again).equals(fs.readFileSync(outPath)), '開き直して保存しても同じバイト列').toBe(true);
  await page.screenshot({ path: testInfo.outputPath('primary-6-saved.png') });

  for (const s of steps) {
    expect(s.ms, s.name + ': 描画までの待ち').toBeLessThanOrEqual(RENDER_LIMIT_MS);
  }
  H.record(testInfo, 'renderMs', Math.max.apply(null, steps.map((s) => s.ms || 0)));
  H.record(testInfo, 'diffLines', Math.max.apply(null, steps.map((s) => s.lines)));
});
