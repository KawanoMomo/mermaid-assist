'use strict';
// UI-039: CRLF の .mmd を開いて保存すると LF に変換され、git の差分が
// ファイル全体になる。
//
// `<textarea>` の値は**ブラウザが LF に正規化する** (HTML の仕様) ので、
// 何もしなければ必ず LF になる。Windows で作った図を1つ触るたびに
// 全行が書き換わり、レビューで中身が読めなくなる。
//
// 実測 (直す前 / 後):
//   CRLF を開いて1行足して保存 → CRLF 0 / LF 6  →  CRLF 5 / LF 0
//   LF   を開いて1行足して保存 → CRLF 0 / LF 5  →  変わらず
const path = require('path');
const fs = require('fs');
const os = require('os');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const LF = String.fromCharCode(10);
const CRLF = String.fromCharCode(13) + LF;

async function openSaveCount(page, eol, tag) {
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(500);
  const src = ['flowchart TD', '    A["a"]', '    B["b"]', '    A --> B'].join(eol) + eol;
  const inPath = path.join(os.tmpdir(), 'eol-in-' + tag + '.mmd');
  fs.writeFileSync(inPath, src);
  await page.locator('#file-input').setInputFiles(inPath);
  await page.waitForTimeout(1800);
  // 開いて直して保存、が実務の形
  await page.evaluate(() => {
    const ed = document.getElementById('editor');
    ed.value = ed.value + String.fromCharCode(10) + '    C["c"]';
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(1300);
  await page.locator('#preview-pane').click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(300);
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.keyboard.press('Control+s'),
  ]);
  const out = path.join(os.tmpdir(), 'eol-out-' + tag + '.mmd');
  await dl.saveAs(out);
  const saved = fs.readFileSync(out, 'utf8');
  const cnt = (s, n) => s.split(n).length - 1;
  const crlf = cnt(saved, CRLF);
  return { crlf: crlf, lone: cnt(saved, LF) - crlf, text: saved };
}

test.describe('UI-039: 開いたファイルの改行コードを保つ', () => {
  test('CRLF のファイルは CRLF のまま保存される', async ({ page }) => {
    test.setTimeout(90000);
    const r = await openSaveCount(page, CRLF, 'crlf');
    expect(r.crlf).toBeGreaterThan(0);
    expect(r.lone).toBe(0);
  });

  test('LF のファイルは LF のまま保存される', async ({ page }) => {
    test.setTimeout(90000);
    const r = await openSaveCount(page, LF, 'lf');
    expect(r.crlf).toBe(0);
    expect(r.lone).toBeGreaterThan(0);
  });

  test('足した行も同じ改行コードで書かれる (混在しない)', async ({ page }) => {
    test.setTimeout(90000);
    const r = await openSaveCount(page, CRLF, 'mix');
    // 混在していれば LF 単独が1つ以上残る
    expect(r.lone).toBe(0);
    expect(r.text).toContain('C["c"]');
  });
});
