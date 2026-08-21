'use strict';
// 書き出したものを「他の場所へ持っていく」ときの成立条件。
//
// 数十〜数百枚を Git 管理し、設計書や wiki に貼る運用を前提にしている。
// 1枚だけ開いて眺めるぶんには気付かないが、**複数枚を並べた瞬間に壊れる**
// 種類の問題があった。
const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');

const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');

// 実務の形: .mmd をそれぞれ別のセッションで開いて書き出す
async function exportSvgFrom(browser, testInfo, name, text) {
  const mf = testInfo.outputPath(name + '.mmd');
  fs.writeFileSync(mf, text);
  const page = await browser.newPage({ acceptDownloads: true });
  page.on('dialog', d => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.locator('input[type="file"]').first().setInputFiles(mf);
  await page.waitForTimeout(2200);
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    (async () => {
      await page.locator('#btn-export').click();
      await page.waitForTimeout(250);
      await page.locator('#exp-svg').click();
    })(),
  ]);
  const f = testInfo.outputPath(name + '.svg');
  await dl.saveAs(f);
  await page.close();
  return fs.readFileSync(f, 'utf8');
}

test.describe('SVG の id が図ごとに一意', () => {
  // mermaid が付ける id は `mermaid-svg-<セッション内の連番>` で、別々のセッションで
  // 書き出した2枚が同じ id を持つ (実測: どちらも mermaid-svg-2)。
  // スタイルは `#mermaid-svg-2 .node rect { … }` の形で id に紐付いており、
  // 矢印マーカーの id も同じ接頭辞を使う。`url(#…)` は文書内で最初に見つかった
  // id を拾うので、2枚並べると2枚目の矢印が1枚目のマーカーを使う。
  test('別々のセッションで書き出した2枚の id が衝突しない', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const a = await exportSvgFrom(browser, testInfo, 'sensor',
      'flowchart TD\n    A[開始] --> B[処理]\n');
    const b = await exportSvgFrom(browser, testInfo, 'motor',
      'flowchart TD\n    X[入力] -.-> Y[検証]\n');

    const idOf = (s) => (s.match(/<svg[^>]*id="([^"]+)"/) || [])[1];
    expect(idOf(a)).toBe('ma-sensor');
    expect(idOf(b)).toBe('ma-motor');
    expect(idOf(a)).not.toBe(idOf(b));
  });

  test('スタイルとマーカーの参照も付け替わっている', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const a = await exportSvgFrom(browser, testInfo, 'sensor2',
      'flowchart TD\n    A[開始] --> B[処理]\n');
    // 旧 id が1つも残っていないこと (残ると自分のスタイルを受け取れない)
    expect(a.match(/mermaid-svg-\d+/g)).toBeNull();
    // 新しい id でスタイルが引かれていること
    expect((a.match(/#ma-sensor2/g) || []).length).toBeGreaterThan(10);
    // マーカー参照も新しい接頭辞
    expect(a).toContain('url(#ma-sensor2_');
  });

  test('2枚を1ページに並べても、それぞれ id で引けてマーカーが重複しない', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const a = await exportSvgFrom(browser, testInfo, 'sensor3',
      'flowchart TD\n    A[開始] --> B[処理]\n');
    const b = await exportSvgFrom(browser, testInfo, 'motor3',
      'flowchart TD\n    X[入力] -.-> Y[検証]\n');
    const page = await browser.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><body>' +
      a.replace(/^<\?xml[^>]*>/, '') + '<hr>' + b.replace(/^<\?xml[^>]*>/, '') + '</body>');
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('marker')).map(m => m.id);
      return {
        markers: ids.length,
        dup: ids.length - new Set(ids).size,
        a: !!document.getElementById('ma-sensor3'),
        b: !!document.getElementById('ma-motor3'),
      };
    });
    expect(r.markers).toBeGreaterThan(0);
    expect(r.dup).toBe(0);
    expect(r.a).toBe(true);
    expect(r.b).toBe(true);
    await page.close();
  });
});

test.describe('PNG の書き出し倍率', () => {
  // 等倍しか無く、設計書に貼って拡大や印刷をすると字がつぶれていた
  // (実測: viewBox 788x196 → PNG 788x196)。
  test('2倍で書き出すと画素数が2倍になり、ファイル名に @2x が付く', async ({ page }, testInfo) => {
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });

    const sizes = {};
    for (const [label, sel] of [['x1', '#exp-png'], ['x2', '#exp-png-2x']]) {
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        (async () => {
          await page.locator('#btn-export').click();
          await page.waitForTimeout(250);
          await page.locator(sel).click();
        })(),
      ]);
      const f = testInfo.outputPath(label + '.png');
      await dl.saveAs(f);
      const buf = fs.readFileSync(f);
      sizes[label] = { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), name: dl.suggestedFilename() };
    }
    expect(sizes.x2.w).toBe(sizes.x1.w * 2);
    expect(sizes.x2.h).toBe(sizes.x1.h * 2);
    expect(sizes.x1.name).not.toContain('@2x');
    expect(sizes.x2.name).toContain('@2x');
  });

  test('等倍の書き出しは今までどおりの寸法', async ({ page }, testInfo) => {
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    const vb = await page.evaluate(() => {
      const s = document.querySelector('#preview-svg svg');
      return { w: Math.round(s.viewBox.baseVal.width), h: Math.round(s.viewBox.baseVal.height) };
    });
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      (async () => {
        await page.locator('#btn-export').click();
        await page.waitForTimeout(250);
        await page.locator('#exp-png').click();
      })(),
    ]);
    const f = testInfo.outputPath('base.png');
    await dl.saveAs(f);
    const buf = fs.readFileSync(f);
    expect(buf.readUInt32BE(16)).toBe(vb.w);
    expect(buf.readUInt32BE(20)).toBe(vb.h);
  });
});
