'use strict';
// UI-042: 要素を選んでも、それが本文の何行目か分からない。
//
// 実測 (1366x768、150ノードの図で「ノード120」= 122行目 を選んだあと):
//   エディタが見せている行  1〜34行目
//   カーソルの位置          151行目 (末尾)
//   パネルの行番号          無し
// → DSL を直接編集する使い方では「選ぶ → その行を直す」が流れなので、
//   毎回自分で探すことになる。
//
// 自動でスクロールはしない。追加や削除のあとにも選択は起きるので、
// **打っている最中に画面が飛ぶ**のは以前 gantt で問題になった形。押したときだけ飛ぶ。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);

async function bigFlow(page, n) {
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.locator('#diagram-type').selectOption('flowchart');
  await page.waitForTimeout(1700);
  const L = ['flowchart TD'];
  for (let i = 0; i < n; i++) L.push('    N' + i + '["ノード' + i + '"]');
  await page.evaluate((x) => {
    const e = document.getElementById('editor');
    e.value = x; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, L.join(NL));
  await page.waitForTimeout(2800);
}

test.describe('UI-042: 選んだ要素の行へ飛べる', () => {
  test('行番号が出て、押すとその行に着く', async ({ page }) => {
    test.setTimeout(120000);
    await bigFlow(page, 150);
    await page.locator('#ma-list-filter').click();
    await page.keyboard.type('ノード120');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);

    const btn = page.locator('#ma-goto-line-btn');
    expect(await btn.count()).toBe(1);
    expect((await btn.textContent()).trim()).toContain('122');

    await btn.click();
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const ed = document.getElementById('editor');
      const lh = parseFloat(getComputedStyle(ed).lineHeight) || 18;
      const first = Math.floor(ed.scrollTop / lh) + 1;
      return { caretLine: ed.value.slice(0, ed.selectionStart).split(String.fromCharCode(10)).length,
        picked: ed.value.slice(ed.selectionStart, ed.selectionEnd).trim(),
        first: first, last: first + Math.floor(ed.clientHeight / lh) - 1 };
    });
    expect(r.caretLine).toBe(122);
    expect(r.picked).toContain('ノード120');
    expect(122).toBeGreaterThanOrEqual(r.first);
    expect(122).toBeLessThanOrEqual(r.last);
  });

  test('選択を外すと消える', async ({ page }) => {
    test.setTimeout(120000);
    await bigFlow(page, 20);
    await page.locator('#props-content .ma-list-row button').first().click();
    await page.waitForTimeout(800);
    expect(await page.locator('#ma-goto-line-btn').count()).toBe(1);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    expect(await page.locator('#ma-goto-line-btn').count()).toBe(0);
  });

  test('選んでいないときは出ない (打っている最中に画面が飛ばない)', async ({ page }) => {
    test.setTimeout(120000);
    await bigFlow(page, 20);
    expect(await page.locator('#ma-goto-line-btn').count()).toBe(0);
    // 本文を打っても勝手にスクロールしない
    const before = await page.evaluate(() => document.getElementById('editor').scrollTop);
    await page.evaluate(() => {
      const e = document.getElementById('editor');
      e.value = e.value + String.fromCharCode(10) + '    NX["追加"]';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => document.getElementById('editor').scrollTop);
    expect(after).toBe(before);
  });
});
