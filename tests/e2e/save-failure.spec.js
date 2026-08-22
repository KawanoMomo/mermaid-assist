'use strict';
// UI-067: 保存が失敗しても黙っていた / UI-065: 未保存の印が画面内に無かった。
//
// 保存は「押した」ことしか分からない操作で、**失敗が黙って起きると気付けない**。
// 気付かないまま作業を続け、閉じたときに全部失う (UI-064) のが最悪の並び。
//
// 実測 (直す前):
//   保存を失敗させると表示は「要素: 3 | 関連: 2」のままで、失敗を告げるものが
//   何も出なかった。`downloadAsFile()` が投げると `markSaved()` にも表示にも
//   到達せず終わる。上書き経路 (overwriteSaved) は try/catch を持っているのに、
//   **ダウンロード経路だけが無防備**だった。
//
// 未保存の印はタイトルバーには出るが、**タブを何枚も開く使い方では
// タイトルが省略されて見えない**。数十〜数百枚を扱う人ほどタブが多い。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);
const DOC = ['flowchart TD', '    A["設計"] --> B["実装"]'].join(NL);

const dirtyMark = (page) => page.evaluate(() => {
  const e = document.getElementById('status-dirty');
  return e ? { shown: !e.hidden && e.offsetHeight > 0, text: (e.textContent || '').trim() } : null;
});

async function load(page) {
  page.on('dialog', (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(800);
}

async function edit(page, text) {
  await page.evaluate((x) => {
    const e = document.getElementById('editor');
    e.value = x; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await page.waitForTimeout(2200);
}

test.describe('保存の成否が画面で分かる', () => {
  test('保存に失敗したら理由を言い、未保存の印を残す', async ({ page }) => {
    await load(page);
    await edit(page, DOC);
    expect((await dirtyMark(page)).shown).toBe(true);

    // 保存経路を失敗させる
    await page.evaluate(() => {
      URL.createObjectURL = function() { throw new Error('書けません'); };
    });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1200);

    const msg = await page.locator('#status-info').textContent();
    expect(msg).toContain('保存できませんでした');
    // 何が起きたかと、本文が無事であることの両方を言う
    expect(msg).toContain('書けません');
    expect(msg).toContain('本文はそのまま');

    // **印を消さない**。消すと「保存できた」と誤解する
    expect((await dirtyMark(page)).shown).toBe(true);
  });

  test('保存に成功したら印が消え、成功したと言う', async ({ page }) => {
    // 失敗側だけを見ると「常に印が残る」実装でも通ってしまう
    await load(page);
    await edit(page, DOC);
    expect((await dirtyMark(page)).shown).toBe(true);

    await page.locator('#preview-pane').click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.waitForTimeout(200);
    await Promise.all([
      page.waitForEvent('download', { timeout: 12000 }),
      page.keyboard.press('Control+s'),
    ]);
    await page.waitForTimeout(700);

    expect((await dirtyMark(page)).shown).toBe(false);
    const msg = await page.locator('#status-info').textContent();
    expect(msg).toContain('ダウンロードしました');
  });

  test('ひな形のままなら印は出ない', async ({ page }) => {
    // 常に出す実装だと印が情報を持たなくなる
    await load(page);
    expect((await dirtyMark(page)).shown).toBe(false);
  });

  test('未保存の印は画面の中にある', async ({ page }) => {
    // タイトルバーはタブが多いと見えない
    await load(page);
    await edit(page, DOC);
    const where = await page.evaluate(() => {
      const e = document.getElementById('status-dirty');
      const bar = document.getElementById('statusbar');
      return { inStatusBar: !!(bar && bar.contains(e)),
        titleHasMark: document.title.indexOf('●') === 0 };
    });
    // 画面内とタイトルの**両方**に出す (片方だけでは見落とす)
    expect(where.inStatusBar).toBe(true);
    expect(where.titleHasMark).toBe(true);
  });
});
