// @ts-check
// UI-083: 要素を消す/動かすと、その説明だったコメントが別の要素の説明になる。
//
// ここは**実機の経路**を通す。単体は関数を直接呼ぶので、UI がどの実装に
// 委ねているかで結果が変わる部分を拾えない。実際、削除には3つの経路があり、
// **2つは行番号を見ない id 経路**で、textUpdater 側の処理が効かなかった:
//   1. Delete キー        → app.js deleteSelectedElements (契約)
//   2. 一覧の ✕           → properties.bindDeleteButtons (id で委譲)
//   3. パネルの「削除」    → モジュール内の deleteLine (行番号)
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);
const PC = String.fromCharCode(37, 37);

const DOC = [
  'flowchart TD',
  '    ' + PC + ' 印A: 開始の説明',
  '    A["開始"]',
  '    ' + PC + ' 印B: 処理の説明',
  '    B["処理"]',
  '    C["終了"]',
  '    A --> B',
  '    B --> C',
].join(NL);

async function ready(page) {
  page.on('dialog', d => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.evaluate((t) => {
    const e = document.getElementById('editor');
    e.value = t; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, DOC);
  await page.waitForTimeout(2000);
}

const editorText = (page) => page.locator('#editor').inputValue();

// コメントが説明している行 = 直後の最初の非コメント行
function targetOf(text, key) {
  const L = String(text).split(NL);
  for (let i = 0; i < L.length; i++) {
    if (L[i].indexOf(key) >= 0) {
      for (let j = i + 1; j < L.length; j++) {
        const t = L[j].trim();
        if (t && t.indexOf(PC) !== 0) return t;
      }
      return '(対象なし)';
    }
  }
  return '(消えた)';
}

test.describe('UI-083 消した要素の説明が残らない', () => {
  test('一覧の ✕ で消すと、その説明も消える', async ({ page }) => {
    await ready(page);
    const before = await editorText(page);
    expect(targetOf(before, '印B')).toBe('B["処理"]');

    const del = page.locator('.fc-delete-node[data-element-id="B"]');
    await expect(del).toHaveCount(1);
    await del.click();
    await page.waitForTimeout(1400);

    const after = await editorText(page);
    // 消した要素は消えている (消えていなければ以下の判定に意味が無い)
    expect(after).not.toContain('B["処理"]');
    expect(after).not.toContain('印B');
    // 別の要素の説明は残り、付き先も変わっていない
    expect(after).toContain('印A');
    expect(targetOf(after, '印A')).toBe('A["開始"]');
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
  });

  test('Delete キーで消しても同じ', async ({ page }) => {
    await ready(page);
    const sel = page.locator('.fc-select-node[data-element-id="B"]');
    await expect(sel).toHaveCount(1);
    await sel.click();
    await page.waitForTimeout(600);
    await page.locator('#preview-pane').click({ position: { x: 4, y: 4 } }).catch(() => {});
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(1400);

    const after = await editorText(page);
    expect(after).not.toContain('B["処理"]');
    expect(after).not.toContain('印B');
    expect(targetOf(after, '印A')).toBe('A["開始"]');
  });

  test('見出し (空行で区切られたコメント) は消さない', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await page.waitForTimeout(700);
    const doc = [
      'flowchart TD',
      '    ' + PC + ' === 入力系 ===',
      '',
      '    A["入力"]',
      '    B["処理"]',
      '    A --> B',
    ].join(NL);
    await page.evaluate((t) => {
      const e = document.getElementById('editor');
      e.value = t; e.dispatchEvent(new Event('input', { bubbles: true }));
    }, doc);
    await page.waitForTimeout(2000);

    const del = page.locator('.fc-delete-node[data-element-id="A"]');
    await expect(del).toHaveCount(1);
    await del.click();
    await page.waitForTimeout(1400);

    const after = await editorText(page);
    expect(after).not.toContain('A["入力"]');
    // 見出しは要素の説明ではないので残す
    expect(after).toContain('=== 入力系 ===');
  });
});
