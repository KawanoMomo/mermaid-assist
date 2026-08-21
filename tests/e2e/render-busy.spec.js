'use strict';
// UI-027: 大きい図を描いている間、画面が固まったまま何も言わない。
//
// 実測 (1366x768, flowchart): 200要素 2.1秒 / 500要素 3.8秒 / 900要素 6.1秒。
// **その間 100ms 間隔のポーリングが1度もサンプルを取れない** = メインスレッドが
// 返らず、画面が一切更新されない。ステータスは前の値のまま、進行を示すものは無い。
//
// screencast で確かめたところ、貼った直後から 6096ms までフレームが1枚も来ず、
// その間 status-parse は前の値「OK」を表示し続けていた。
//
// 直したあとは +38ms のフレームに「描画中 …」が写っている
// (プレビューはまだ古い図のまま = 塗ってから重い処理へ入っている証拠)。
//
// スクリーンショット (Page.captureScreenshot) では確かめられない。
// **メインスレッドが塞がっている間は撮影要求そのものが返らず、
// 返ったときには描画が終わっている。** 塗られた瞬間を見るには
// コンポジタが押し出すフレーム (screencast) を受け取る必要がある。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);

async function open(page) {
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(400);
}
// status-parse の変化を DOM 側で記録する。ポーリングは塞がれて取れない。
async function watch(page) {
  await page.evaluate(() => {
    window.__st = [];
    const s = document.getElementById('status-parse');
    window.__st.push((s.textContent || '').trim());
    new MutationObserver(() => window.__st.push((s.textContent || '').trim()))
      .observe(s, { childList: true, characterData: true, subtree: true });
  });
}
function flow(n) {
  const L = ['flowchart TD'];
  for (let i = 0; i < n; i++) L.push('    N' + i + '["ノード' + i + '"]');
  for (let i = 1; i < n; i++) L.push('    N' + (i - 1) + ' --> N' + i);
  return L.join(NL);
}
const setText = (page, t) => page.evaluate((txt) => {
  const e = document.getElementById('editor');
  e.value = txt; e.dispatchEvent(new Event('input', { bubbles: true }));
}, t);

test.describe('UI-027: 重い図を描いている間、進んでいることが分かる', () => {
  test('600要素を貼ると「描画中」が出てから OK になる', async ({ page }) => {
    // 600要素の描画自体に数秒かかる。既定の30秒では足りない。
    test.setTimeout(150000);
    await open(page);
    await setText(page, flow(3));
    await page.waitForTimeout(1200);
    await watch(page);
    await setText(page, flow(600));
    // 記録の先頭は貼る前の「OK」なので、indexOf では常に0に当たって待てない。
    // **末尾が OK に戻ったこと**を待つ。
    await page.waitForFunction(() => {
      const a = window.__st || [];
      return a.length > 1 && a[a.length - 1] === 'OK';
    }, null, { timeout: 120000 });
    const st = await page.evaluate(() => window.__st);
    expect(st.join(',')).toContain('描画中');
    expect(st.indexOf('描画中 …') >= 0 || st.some(x => x.indexOf('描画中') >= 0)).toBe(true);
    // 「描画中」は OK より先に出る
    const busyAt = st.findIndex(x => x.indexOf('描画中') >= 0);
    const okAt = st.lastIndexOf('OK');
    expect(busyAt).toBeLessThan(okAt);
  });

  test('描き終わったら aria-busy が残らない', async ({ page }) => {
    test.setTimeout(150000);
    await open(page);
    await setText(page, flow(600));
    await page.waitForFunction(() => {
      const s = document.getElementById('status-parse');
      return s && (s.textContent || '').trim() === 'OK';
    }, null, { timeout: 90000 });
    await page.waitForTimeout(300);
    const busy = await page.evaluate(() =>
      document.getElementById('preview-svg').getAttribute('aria-busy'));
    expect(busy).toBe(null);
  });

  test('小さい図では「描画中」を出さない (毎打鍵ちらつかせない)', async ({ page }) => {
    await open(page);
    await setText(page, flow(3));
    await page.waitForTimeout(1200);
    await watch(page);
    await setText(page, flow(4));
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => window.__st);
    expect(st.some(x => x.indexOf('描画中') >= 0)).toBe(false);
  });

  test('描画中に本文を追い越して変えても、最後の内容が出る', async ({ page }) => {
    test.setTimeout(150000);
    await open(page);
    await setText(page, flow(3));
    await page.waitForTimeout(1200);
    setText(page, flow(600)).catch(() => {});
    await page.waitForTimeout(30);
    await setText(page, flow(5));
    // 重い図の描き直しが終わったあと、待ち時間 (最大800ms) を置いて
    // 最後の内容が描かれる。「OK になってから600ms」では届かない。
    await page.waitForFunction(() => {
      const s = document.getElementById('status-info');
      return s && /要素: 5(\D|$)/.test(s.textContent || '');
    }, null, { timeout: 90000 });
    const info = await page.locator('#status-info').textContent();
    expect(info).toContain('要素: 5');
  });
});
