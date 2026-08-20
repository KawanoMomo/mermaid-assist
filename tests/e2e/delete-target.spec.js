// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');

async function ready(page, type) {
  page.on('dialog', d => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.locator('#diagram-type').selectOption(type);
  await page.waitForTimeout(1600);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

// class / er / state の削除は「その要素が最初に現れた行」を消していた。
// どの図種も要素は行を共有する (関係行や遷移行が両端を宣言する) ので、
// 押した要素が残り、押していない関係が消えていた。
//
// ここは UI 経路 (一覧の ✕ → bindDeleteButtons → data-element-id) を通す。
// ユニットテストは関数を直接呼ぶので、id が渡っていない配線ミスを拾えない。
test.describe('一覧の ✕ が押した要素を消す', () => {
  test('classDiagram: Animal を消すと Animal だけ消える', async ({ page }) => {
    await ready(page, 'classDiagram');
    const del = page.locator('.cl-delete-class[data-element-id="Animal"]');
    await expect(del).toHaveCount(1);
    await del.click();
    await page.waitForTimeout(1200);

    const text = await page.locator('#editor').inputValue();
    expect(text).not.toContain('Animal');
    expect(text).toContain('class Dog');
    // ブロックの中身が孤立していない
    expect(text).not.toContain('+String name');
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
  });

  test('erDiagram: CUSTOMER を消すと CUSTOMER だけ消える', async ({ page }) => {
    await ready(page, 'erDiagram');
    const del = page.locator('.er-delete-entity[data-element-id="CUSTOMER"]');
    await expect(del).toHaveCount(1);
    await del.click();
    await page.waitForTimeout(1200);

    const text = await page.locator('#editor').inputValue();
    expect(text).not.toContain('CUSTOMER');
    expect(text).toContain('ORDER {');
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
  });

  test('stateDiagram: Idle を消すと Idle だけ消える', async ({ page }) => {
    await ready(page, 'stateDiagram');
    const del = page.locator('.st-delete-state[data-element-id="Idle"]');
    await expect(del).toHaveCount(1);
    await del.click();
    await page.waitForTimeout(1200);

    const text = await page.locator('#editor').inputValue();
    expect(text).not.toContain('Idle');
    expect(text).toContain('Running');
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
  });
});

// 並行レビュー (実UIを回すレビュアー) が見つけた、✕ を1回押すだけで
// status が Error になる3件。
test.describe('削除で図が壊れない', () => {
  async function deleteFirst(page, type) {
    page.on('dialog', d => d.accept());
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator('#diagram-type').selectOption(type);
    await page.waitForTimeout(1700);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const del = page.locator('#props-content button[class*="delete"]').first();
    await expect(del).toHaveCount(1);
    await del.click();
    await page.waitForTimeout(1400);
  }

  // ビット範囲は 0 から隙間なく並ぶ必要がある。先頭を消すと 16 から始まって
  // しまい mermaid が拒否していた。
  test('packet-beta: フィールドを消しても範囲に穴が空かない', async ({ page }) => {
    await deleteFirst(page, 'packet-beta');
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
    const text = await page.locator('#editor').inputValue();
    expect(text).toMatch(/^\s*0[-:]/m);   // 0 から始まる
  });

  // group を消しても `in api` が残り、存在しないグループを指していた。
  test('architecture-beta: グループを消すと in 参照も消える', async ({ page }) => {
    await deleteFirst(page, 'architecture-beta');
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
    const text = await page.locator('#editor').inputValue();
    expect(text).not.toContain('in api');
    // 中のサービスはグループから出るだけで残る
    expect(text).toContain('service db');
  });

  // ルートを消すと図が丸ごと消えて `mindmap` の1行だけになり Error だった。
  // 削除させないのが正しいので、ルート行には ✕ を出さない
  // (押せるのに何もしないボタンは、押せないと分かるより悪い)。
  test('mindmap: ルート行には削除ボタンが無い', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator('#diagram-type').selectOption('mindmap');
    await page.waitForTimeout(1700);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const rootRow = page.locator('#props-content button.mm-select-node').first();
    const rootId = await rootRow.getAttribute('data-element-id');
    expect(await page.locator('.mm-delete-node[data-element-id="' + rootId + '"]').count()).toBe(0);
    // 子ノードには出る
    expect(await page.locator('.mm-delete-node').count()).toBeGreaterThan(0);
  });

  test('mindmap: 子ノードを消しても図は壊れない', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator('#diagram-type').selectOption('mindmap');
    await page.waitForTimeout(1700);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await page.locator('.mm-delete-node').first().click();
    await page.waitForTimeout(1400);
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
    expect(await page.locator('#editor').inputValue()).toContain('root((');
  });
});
