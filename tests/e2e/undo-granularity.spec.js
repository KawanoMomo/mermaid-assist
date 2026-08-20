// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');

// エディタ入力の undo が1キーストローク単位だった。
// 実測: 29文字の行を打つと履歴が 27 件積まれ、戻すのに27回押す必要があった。
// MAX_HISTORY は 80 なので、80文字を超えて打つと編集前の状態が履歴から
// 押し出され、**元のテキストには二度と戻れなくなる**。
async function undoDepth(page) {
  return page.evaluate(() => {
    let n = 0;
    const snap = document.getElementById('editor').value;
    while (window.MA.history.canUndo() && n < 300) { window.MA.history.undo(); n++; }
    while (window.MA.history.canRedo()) window.MA.history.redo();
    document.getElementById('editor').value = snap;
    return n;
  });
}

test.describe('Undo の粒度', () => {
  test('連続した入力は1回の Undo でまとまって戻る', async ({ page }) => {
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
    await page.waitForTimeout(800);

    await page.locator('#editor').click();
    await page.locator('#editor').press('Control+End');
    await page.locator('#editor').type('\n    追記 :zz, 2026-06-01, 5d', { delay: 0 });
    await page.waitForTimeout(1500);

    expect(await undoDepth(page)).toBe(1);
  });

  test('人が打つ速度でもまとまる', async ({ page }) => {
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
    await page.waitForTimeout(800);

    await page.locator('#editor').click();
    await page.locator('#editor').press('Control+End');
    await page.locator('#editor').type('\n    a :x1, 2026-06-01, 5d', { delay: 80 });
    await page.waitForTimeout(1500);

    expect(await undoDepth(page)).toBe(1);
  });

  test('Undo 1回で入力前のテキストに戻る', async ({ page }) => {
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
    await page.waitForTimeout(800);
    const before = await page.locator('#editor').inputValue();

    await page.locator('#editor').click();
    await page.locator('#editor').press('Control+End');
    await page.locator('#editor').type('\n    追記 :zz, 2026-06-01, 5d', { delay: 0 });
    await page.waitForTimeout(1500);
    expect(await page.locator('#editor').inputValue()).not.toBe(before);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1200);
    expect(await page.locator('#editor').inputValue()).toBe(before);
  });

  test('入力を止めて再開したら別の Undo になる', async ({ page }) => {
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
    await page.waitForTimeout(800);

    await page.locator('#editor').click();
    await page.locator('#editor').press('Control+End');
    await page.locator('#editor').type('\n    a :x1, 2026-06-01, 5d', { delay: 0 });
    await page.waitForTimeout(1200);   // 手が止まった
    await page.locator('#editor').type('\n    b :x2, 2026-07-01, 5d', { delay: 0 });
    await page.waitForTimeout(1500);

    expect(await undoDepth(page)).toBe(2);
  });
});

// Ctrl+Z の意味がフォーカス位置で変わっていた。
// エディタ内ではブラウザの textarea ネイティブ undo に委ねていたので、
//   - エディタ内では文字単位、それ以外では操作単位
//   - GUI 操作 (プロパティパネル) の変更は、エディタにフォーカスがあると
//     Ctrl+Z で取り消せない
//   - ネイティブ undo が input を発火し、半分戻ったテキストがアプリの履歴に
//     積み直される
// という状態だった。
test.describe('Ctrl+Z の一貫性', () => {
  test('エディタにフォーカスがあっても1回で入力前に戻る', async ({ page }) => {
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
    await page.waitForTimeout(800);
    const before = await page.locator('#editor').inputValue();

    await page.locator('#editor').click();
    await page.locator('#editor').press('Control+End');
    await page.locator('#editor').type('\n    追記 :zz, 2026-06-01, 5d', { delay: 0 });
    await page.waitForTimeout(1500);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1200);
    expect(await page.locator('#editor').inputValue()).toBe(before);
  });

  test('GUI で変えた内容をエディタから Ctrl+Z で取り消せる', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
    await page.waitForTimeout(800);
    const before = await page.locator('#editor').inputValue();

    // プロパティパネルからラベルを変える
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(800);
    const label = page.locator('#prop-label');
    await expect(label).toHaveCount(1);
    // fill() は input と change を両方出す。change を明示的にもう一度
    // 投げると 1操作で履歴が2件積まれ、テストが実アプリと違う状態を見る
    await label.fill('変更後のラベル');
    await label.blur();
    await page.waitForTimeout(1000);
    expect(await page.locator('#editor').inputValue()).not.toBe(before);

    // エディタにフォーカスを移してから Ctrl+Z
    await page.locator('#editor').click();
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1200);
    expect(await page.locator('#editor').inputValue()).toBe(before);
  });
});
