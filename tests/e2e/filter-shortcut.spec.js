'use strict';
// UI-063: 定数コストで目的の要素に届く経路があるのに、線形コストの経路だけが
// 案内に出ていた。
//
// 実測 (flowchart、目的の要素まで):
//
//   要素数 |  ↑↓ で辿る | 絞り込み
//   -------|------------|---------
//       20 |      18 手 |    6 手
//       60 |      50 手 |    6 手
//      120 |    **98 手** |  **6 手**
//
// 絞り込みは「欄へ行く + 打つ + Enter」なので**要素数によらず一定**。
// 1日100回なら 9200 手の差になる。
//
// `/` で欄へ飛べるようにし、案内文にも書いた。
// 欄は一覧が 12 行を超えたときだけ出るので、出ていないときはそう言う。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);

function doc(n) {
  const l = ['flowchart TD'];
  for (let i = 0; i < n; i++) l.push('    N' + i + '["工程' + i + '"]');
  for (let i = 1; i < n; i++) l.push('    N' + (i - 1) + ' --> N' + i);
  return l.join(NL);
}

const where = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return (a && (a.id || a.tagName) || '(なし)').toString();
});

async function loadAndEnterDiagram(page, n) {
  page.on('dialog', (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.evaluate((x) => {
    const e = document.getElementById('editor');
    e.value = x; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, doc(n));
  await page.waitForTimeout(2800);
  await page.evaluate(() => document.getElementById('editor').focus());
  await page.keyboard.press('Escape');   // 図へ (A117)
  await page.waitForTimeout(400);
}

test.describe('絞り込みへ / で飛べる', () => {
  test('一覧が長いとき、/ で絞り込み欄へ移り Enter で行に着く', async ({ page }) => {
    await loadAndEnterDiagram(page, 120);
    const before = await page.evaluate(() => document.getElementById('editor').value.length);

    await page.keyboard.press('/');
    await page.waitForTimeout(400);
    expect(await where(page)).toBe('ma-list-filter');
    // 本文に「/」が入っていないこと
    expect(await page.evaluate(() => document.getElementById('editor').value.length)).toBe(before);

    await page.keyboard.type('工程96');
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const row = await page.evaluate(() => {
      const a = document.activeElement;
      const r = a && a.closest ? a.closest('.ma-list-row') : null;
      return r ? (r.textContent || '').replace(/\s+/g, ' ').trim() : null;
    });
    expect(row).not.toBe(null);
    expect(row).toContain('工程96');
  });

  test('一覧が短いときは、欄が無いことを言う', async ({ page }) => {
    // 黙って何も起きないのが一番困る。無いなら無いと言う。
    await loadAndEnterDiagram(page, 5);
    await page.keyboard.press('/');
    await page.waitForTimeout(400);
    // 欄が無いので焦点は動かない
    expect(await where(page)).toBe('preview-pane');
    const msg = await page.locator('#status-info').textContent();
    expect(msg).toContain('絞り込み欄は出ていません');
    expect(msg).toContain('↑↓');
  });

  test('図へ移ったときの案内に、定数コストの経路が入っている', async ({ page }) => {
    // `↑↓` だけを名指ししていたので、120要素で98手かかる方だけが目に入っていた
    await loadAndEnterDiagram(page, 120);
    const msg = await page.locator('#status-info').textContent();
    expect(msg).toContain('/ で絞り込み');
    // 既存の案内も消えていないこと
    expect(msg).toContain('↑↓');
    expect(msg).toContain('E ');
  });

  test('ヘルプ表に / が載っている', async ({ page }) => {
    // 書いていない操作は探せない
    await loadAndEnterDiagram(page, 20);
    const row = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#shortcut-help-table tr')];
      const hit = rows.find((r) => (r.querySelector('td') || {}).textContent === '/');
      return hit ? hit.textContent.replace(/\s+/g, ' ').trim() : null;
    });
    expect(row).not.toBe(null);
    expect(row).toContain('絞り込み');
  });

  test('入力欄にいるときは / が文字として入る', async ({ page }) => {
    // ショートカットが入力を奪うと、パスや日付が打てなくなる
    await loadAndEnterDiagram(page, 20);
    await page.keyboard.press('/');           // 絞り込み欄へ
    await page.waitForTimeout(300);
    await page.keyboard.type('a/b');
    await page.waitForTimeout(200);
    const v = await page.evaluate(() => document.getElementById('ma-list-filter').value);
    expect(v).toBe('a/b');
  });
});
