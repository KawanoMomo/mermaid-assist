'use strict';
// UI-041 / G9: 書き出した図の線が白地でほとんど見えない。
//
// 画面は暗いテーマなので線は明るい。PNG は白で塗るため、明るい線が白地に
// 乗って消える。直すのは**線だけ**でよい (ノードは暗い塗りなので文字は読める)。
//
// 実測 (書き出した PNG の、線に最も多く使われた色のコントラスト比):
//   flowchart        1.61 (204,204,204) → 7.11 (88,88,88)
//   sequenceDiagram  1.61 (204,204,204) → 5.41 (106,106,106)
//   timeline         1.50 (211,211,211) → 5.10 (110,110,110)
//   全21図種で 7図種が改善、悪化は 0。
//
// **測り方の注意**: 上書きは style で行う必要がある。mermaid は SVG の中に
// <style> を持っており、CSS は presentation attribute に勝つ。
// 実測: 属性で rgb(0,0,0) を入れても描画色は rgb(211,211,211) のままだった。
// **属性を書いて、書いた属性を読み返して「直った」と読むと必ず外す**ので、
// このテストは**書き出した PNG の画素**で確かめる。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);

const FLOW = ['flowchart TD', '    A["設計"] --> B{"判定"}',
  '    B -->|OK| C["実装"]', '    B -->|NG| D["手戻り"]'].join(NL);

// 白地に焼いた PNG の、線に最も多く使われた色とそのコントラスト比
async function dominantLine(page, useDarken) {
  return page.evaluate((use) => new Promise((res) => {
    const lum = (r, g, b) => {
      const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const svg = document.querySelector('#preview-svg svg');
    if (!svg) return res(null);
    const clone = svg.cloneNode(true);
    if (use) darkenLinesForExport(svg, clone);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width * 2; c.height = img.height * 2;
      const cx = c.getContext('2d');
      cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, c.width, c.height);
      cx.drawImage(img, 0, 0, c.width, c.height);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      const hist = {};
      for (let i = 0; i < d.length; i += 4) {
        const R = d[i], G = d[i + 1], B = d[i + 2], A = d[i + 3];
        if (A < 200) continue;
        if (R > 246 && G > 246 && B > 246) continue;   // 白地
        if (R < 50 && G < 50 && B < 50) continue;      // ノードの塗り
        const k = R + ',' + G + ',' + B; hist[k] = (hist[k] || 0) + 1;
      }
      const top = Object.entries(hist).sort((a, b) => b[1] - a[1])[0];
      if (!top) return res(null);
      const [R, G, B] = top[0].split(',').map(Number);
      res({ color: top[0], ratio: 1.05 / (lum(R, G, B) + 0.05) });
    };
    img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(new XMLSerializer().serializeToString(clone));
  }), useDarken);
}

async function load(page, text) {
  page.on('dialog', (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.evaluate((x) => {
    const e = document.getElementById('editor');
    e.value = x; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await page.waitForTimeout(2400);
}

test.describe('書き出した図の線が白地で見える', () => {
  test('flowchart の線が白地で読める濃さになる', async ({ page }) => {
    await load(page, FLOW);
    const before = await dominantLine(page, false);
    const after = await dominantLine(page, true);
    expect(before).not.toBe(null);
    expect(after).not.toBe(null);
    // 直す前は白地でほとんど見えない
    expect(before.ratio).toBeLessThan(3.0);
    // 直した後は通常の文字と同じ水準
    expect(after.ratio).toBeGreaterThanOrEqual(4.5);
  });

  // 上の試験は関数を直接呼んでいるので、**書き出し経路に繋がっているか**は
  // 見ていない。実際に呼び出し側を殺しても落ちなかった (変異で確認済み)。
  // ここは `svgToCanvas` という本物の経路を通す。
  test('本物の書き出し経路を通しても濃くなる', async ({ page }) => {
    await load(page, FLOW);
    const r = await page.evaluate(() => new Promise((res) => {
      const lum = (r2, g, b) => {
        const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r2) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      svgToCanvas(false, function(canvas) {
        const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        const hist = {};
        for (let i = 0; i < d.length; i += 4) {
          const R = d[i], G = d[i + 1], B = d[i + 2], A = d[i + 3];
          if (A < 200) continue;
          if (R > 246 && G > 246 && B > 246) continue;
          if (R < 50 && G < 50 && B < 50) continue;
          const k = R + ',' + G + ',' + B; hist[k] = (hist[k] || 0) + 1;
        }
        const top = Object.entries(hist).sort((a, b) => b[1] - a[1])[0];
        if (!top) return res(null);
        const [R, G, B] = top[0].split(',').map(Number);
        res({ color: top[0], ratio: 1.05 / (lum(R, G, B) + 0.05) });
      }, 2);
    }));
    expect(r).not.toBe(null);
    expect(r.ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('もともと濃い図は変えない', async ({ page }) => {
    // xychart の線は 51,51,51 で最初から読める。触ると別の問題になる。
    await load(page, ['xychart-beta', '    title "測定"', '    x-axis [a, b, c]',
      '    y-axis "値" 0 --> 10', '    bar [3, 5, 7]'].join(NL));
    const before = await dominantLine(page, false);
    const after = await dominantLine(page, true);
    expect(before).not.toBe(null);
    expect(before.ratio).toBeGreaterThanOrEqual(4.5);
    // 変えていないこと (色そのものが同じ)
    expect(after.color).toBe(before.color);
  });

  test('透過で書き出すときは色を変えない', async ({ page }) => {
    // 貼る先の地色が分からないので、透過では触らない
    await load(page, FLOW);
    // mermaid 自身も inline style を持つので、`[style*=stroke]` を数えると
    // 元からある分を数えてしまう (この判定式で1度外した)。
    // **こちらが付けた !important だけ**を数える。
    const counts = await page.evaluate(() => {
      const svg = document.querySelector('#preview-svg svg');
      const count = (el) => {
        let n = 0;
        el.querySelectorAll('*').forEach((e) => {
          if (e.style && e.style.getPropertyPriority('stroke') === 'important') n++;
        });
        return n;
      };
      const plain = svg.cloneNode(true);          // 透過の経路: 触らない
      const darkened = svg.cloneNode(true);
      darkenLinesForExport(svg, darkened);        // 白地の経路: 触る
      return { plain: count(plain), darkened: count(darkened) };
    });
    expect(counts.plain).toBe(0);
    // 触る経路では実際に付いていること (0 なら「触らない」を確かめられていない)
    expect(counts.darkened).toBeGreaterThan(0);
  });
});

// UI-050: 書き出しで色を差し替えたことを言う。
// 画面と同じものが出ると思っている人にとって色が変わるのは予期しない挙動で、
// 線色を意図して設定した図では、なぜ違うのか分からない。
//
// あわせて、**幅0の線は数えない**。描かれていないので色を変えても見た目は
// 変わらず、「何本濃くしたか」の数だけが過大になる
// (実測: xychart の棒の輪郭が幅0で3本数えられ、19本 → 16本に訂正)。
test.describe('書き出しで色を変えたことを言う', () => {
  test('白地の書き出しでは本数つきで告げる', async ({ page }) => {
    await load(page, FLOW);
    await page.evaluate(() => new Promise((r) => { svgToCanvas(false, () => r(), 1); }));
    await page.waitForTimeout(400);
    const msg = await page.locator('#status-info').textContent();
    expect(msg).toContain('濃くしました');
    expect(/線\d+本/.test(msg)).toBe(true);
    // 画面の色のまま出す方法も併せて示す
    expect(msg).toContain('透過');
  });

  test('透過の書き出しでは黙る', async ({ page }) => {
    await load(page, FLOW);
    await page.evaluate(() => new Promise((r) => { svgToCanvas(true, () => r(), 1); }));
    await page.waitForTimeout(400);
    const msg = await page.locator('#status-info').textContent();
    expect(msg).not.toContain('濃くしました');
  });

  test('幅0の線は数えない', async ({ page }) => {
    // xychart の棒は stroke-width:0 の輪郭を持つ。描かれていないので対象外。
    await load(page, ['xychart-beta', '    title "測定"', '    x-axis [a, b, c]',
      '    y-axis "値" 0 --> 10', '    bar [3, 5, 7]'].join(NL));
    const r = await page.evaluate(() => {
      const svg = document.querySelector('#preview-svg svg');
      let zero = 0;
      svg.querySelectorAll('*').forEach((e) => {
        const cs = getComputedStyle(e);
        if (cs.stroke && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) === 0) zero++;
      });
      return { zero: zero, changed: darkenLinesForExport(svg, svg.cloneNode(true)) };
    });
    // 幅0の線が実際に存在する図でないと、この試験は何も確かめていない
    expect(r.zero).toBeGreaterThan(0);
    // 変えた本数に幅0の分が混ざっていないこと
    expect(r.changed).toBe(16);
  });
});
