'use strict';
// ガントの「概観 / 詳細」は片道だった。
//
// 概観 → ＋ か － → 詳細、に抜けるが、**戻る手段は Fit ボタンだけ**。しかも表示は
// 「詳細」ではなく「90%」なので、いまどちらのモードにいるのかも読み取れない
// (「詳細」という語が画面のどこにも出なかった)。
//
// さらに詳細モードはチャートを自然幅で描き直すので、「－（縮小）」を押すと図は
// かえって広がる (実測: SVG 幅 788px → 1560px、5タスク中2本が画面外)。
//
// ツールバーを横に伸ばさずに往復させるため、倍率表示そのものをスイッチにした。
const path = require('path');
const { test, expect } = require('@playwright/test');

const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);
const DOC = ['gantt', '    title 開発計画', '    dateFormat YYYY-MM-DD',
  '    section 設計', '    要件定義 :a1, 2026-04-01, 30d', '    基本設計 :a2, after a1, 40d',
  '    section 実装', '    コーディング :b1, after a2, 60d', ''].join(NL);

const probe = () => {
  const z = document.getElementById('zoom-display');
  const svg = document.querySelector('#preview-svg svg');
  const c = document.getElementById('preview-container');
  return {
    label: z.textContent,
    aria: z.getAttribute('aria-label'),
    disabled: z.disabled,
    svgW: svg ? Math.round(parseFloat(svg.getAttribute('width')) || 0) : null,
    fitsWidth: (svg && c) ? svg.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1 : null,
  };
};

async function setup(page) {
  page.on('dialog', (d) => d.dismiss());
  await page.goto(HTML_URL);
  await page.waitForFunction(() => window.MA && window.MA.modules && window.MA.modules.gantt);
  await page.selectOption('#diagram-type', 'gantt');
  await page.waitForTimeout(500);
  await page.fill('#editor', DOC);
  await page.waitForTimeout(1600);
}

test.describe('gantt: 概観と詳細を往復できる', () => {
  test('倍率表示を押すと概観 ⇄ 詳細を往復する', async ({ page }) => {
    await setup(page);
    const a = await page.evaluate(probe);
    expect(a.label).toBe('概観');
    expect(a.fitsWidth).toBe(true);

    await page.click('#zoom-display');
    await page.waitForTimeout(1000);
    const b = await page.evaluate(probe);
    // 「詳細」という語が画面に出る (以前は「90%」としか出なかった)
    expect(b.label).toContain('詳細');
    expect(b.svgW).toBeGreaterThan(a.svgW);

    await page.click('#zoom-display');
    await page.waitForTimeout(1000);
    const c = await page.evaluate(probe);
    // Fit を探さなくても戻れる
    expect(c.label).toBe('概観');
    expect(c.svgW).toBe(a.svgW);
    expect(c.fitsWidth).toBe(true);
  });

  test('支援技術にもモードと戻り方が伝わる', async ({ page }) => {
    await setup(page);
    expect((await page.evaluate(probe)).aria).toContain('概観');
    await page.click('#zoom-display');
    await page.waitForTimeout(1000);
    expect((await page.evaluate(probe)).aria).toContain('概観に戻ります');
  });

  test('ガント以外では押せない（Fit が既定倍率を持っている）', async ({ page }) => {
    await setup(page);
    await page.selectOption('#diagram-type', 'flowchart');
    await page.waitForTimeout(500);
    await page.fill('#editor', 'flowchart TD' + NL + '  a[A] --> b[B]' + NL);
    await page.waitForTimeout(1300);
    const s = await page.evaluate(probe);
    expect(s.disabled).toBe(true);
    expect(s.label).toBe('100%');
  });

  test('「－」で詳細へ抜けたとき、何が起きたかと戻り方が出る', async ({ page }) => {
    await setup(page);
    await page.click('#btn-zoom-out');
    await page.waitForTimeout(600);
    const bar = await page.evaluate(() => document.getElementById('status-info').textContent);
    expect(bar).toContain('詳細表示');
    expect(bar).toContain('概観に戻ります');
  });
});
