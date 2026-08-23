// @ts-check
// UI-064: 未保存のまま閉じて開き直すと作業が全部消えていた。
//
// **決めたこと (案B)**: 黙って書き戻さず「前回の続きがあります。開きますか」と
// 確認してから復元する。黙って戻すと、**別の図を開いたつもりの人が前の図を見る**
// という A113 / A114 と同じ事故になるので、どの文書の続きかを名前で示す。
//
// 守ること (実装前に決めた3つ):
//   1. ひな形・起動時の見本のままなら提案しない
//   2. 復元しなかった退避はその場で捨てる (残すと毎回訊かれる)
//   3. 押されるまで本文に触らない
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);
const WORK = ['flowchart TD', '    A["未保存の作業"] --> B["続き"]'].join(NL);

async function open(page) {
  page.on('dialog', d => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(900);
}
async function edit(page, text) {
  await page.evaluate((t) => {
    const e = document.getElementById('editor');
    e.value = t; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await page.waitForTimeout(2400);
}
const draft = (page) => page.evaluate(() => localStorage.getItem('ma.draft.v1'));
const barState = (page) => page.evaluate(() => {
  const e = document.getElementById('restore-bar');
  const m = document.getElementById('restore-msg');
  return { shown: !!e && !e.hidden, msg: m ? (m.textContent || '') : '' };
});

test.describe('UI-064 前回の続きを確認してから復元する', () => {
  test('触っていない起動画面は退避しないし、訊きもしない', async ({ page }) => {
    // ここが崩れると、開くたび「続きがあります」と言われて合図が意味を失う
    await open(page);
    expect(await draft(page)).toBeNull();
    expect((await barState(page)).shown).toBe(false);
  });

  test('編集すると退避され、開き直すと名前付きで訊かれる', async ({ page, context }) => {
    await open(page);
    await edit(page, WORK);
    const d = await draft(page);
    expect(d).not.toBeNull();
    // **名前が入っていること**。どの文書の続きかを示す唯一の手掛かりで、
    // 実際ここが空文字になる不具合を実測で見つけた (window.name を拾っていた)。
    expect(JSON.parse(d).name).toMatch(/flowchart-\d{8}/);

    const page2 = await context.newPage();
    await open(page2);
    const st = await barState(page2);
    expect(st.shown).toBe(true);
    expect(st.msg).toContain('前回の続きがあります');
    expect(st.msg).toContain('.mmd');

    // **押されるまで本文に触らない**
    expect(await page2.locator('#editor').inputValue()).not.toContain('未保存の作業');
  });

  test('「開く」を押すと復元される', async ({ page, context }) => {
    await open(page);
    await edit(page, WORK);
    const page2 = await context.newPage();
    await open(page2);
    await page2.locator('#restore-open').click();
    await page2.waitForTimeout(1500);
    expect(await page2.locator('#editor').inputValue()).toContain('未保存の作業');
    expect(await page2.locator('#status-parse').textContent()).toBe('OK');
  });

  test('「捨てる」を押すと退避が消え、次に開いても訊かれない', async ({ page, context }) => {
    await open(page);
    await edit(page, WORK);
    const page2 = await context.newPage();
    await open(page2);
    // **押した直後**に確かめる。待ってから見ると、あとから走る描画が
    // どのみち消すので「捨てる」が効いているかを区別できない
    // (変異検査で「捨てるが消さない」を入れても落ちなかった)。
    await page2.locator('#restore-discard').click();
    expect(await draft(page2)).toBeNull();
    await page2.waitForTimeout(400);
    expect((await barState(page2)).shown).toBe(false);

    const page3 = await context.newPage();
    await open(page3);
    expect((await barState(page3)).shown).toBe(false);
  });

  test('保存すると退避は消える', async ({ page }) => {
    await open(page);
    await edit(page, WORK);
    expect(await draft(page)).not.toBeNull();

    await page.locator('#preview-pane').click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.waitForTimeout(200);
    await Promise.all([
      page.waitForEvent('download', { timeout: 12000 }),
      page.keyboard.press('Control+s'),
    ]);
    await page.waitForTimeout(1200);
    // 保存したら未保存ではなくなるので、退避を残す理由が無い
    expect(await draft(page)).toBeNull();
  });

  test('訊かれたまま答えずに閉じても、退避は残る', async ({ page, context }) => {
    // 開いただけで消してしまうと、確認バーを見たままタブを閉じた人は
    // 次に開いたとき何も残っていない。**答えるまでは捨てない。**
    // 変異検査で「捨てるが消さない」を入れても検査が落ちず、この穴に気付いた。
    await open(page);
    await edit(page, WORK);

    const page2 = await context.newPage();
    await open(page2);
    expect((await barState(page2)).shown).toBe(true);
    // 何も押さずに閉じる
    expect(await draft(page2)).not.toBeNull();
    await page2.close();

    const page3 = await context.newPage();
    await open(page3);
    expect((await barState(page3)).shown).toBe(true);   // まだ訊かれる
  });

  test('同じタブを再読み込みしただけなら訊かない', async ({ page }) => {
    // 再読み込みでは離脱確認が先に出て、利用者は「破棄」を選んでいる。
    // その直後に訊くのは**答えたばかりの人にもう一度訊く**ことになる。
    //
    // 実測: この区別が無いと、編集してから再読み込みする既存の e2e に確認バーが
    // 割り込み、全体の e2e が3回に1回ほど落ちていた (退避を書く間引きと
    // 再読み込みの競争)。**私の変更が他のテストを不安定にしていた。**
    await open(page);
    await edit(page, WORK);
    expect(await draft(page)).not.toBeNull();

    await page.goto(HTML_URL);            // 同じタブで開き直す
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await page.waitForTimeout(1000);
    expect((await barState(page)).shown).toBe(false);
    // **退避は消さない** — 別のタブで開き直したときには渡したい
    expect(await draft(page)).not.toBeNull();
  });

  test('別のタブで開き直したときは訊く', async ({ page, context }) => {
    // 同じタブを除外したせいで、本来の用途 (タブを閉じて開き直す) まで
    // 訊かなくなっていないことを確かめる
    await open(page);
    await edit(page, WORK);
    const page2 = await context.newPage();
    await open(page2);
    expect((await barState(page2)).shown).toBe(true);
  });
});
