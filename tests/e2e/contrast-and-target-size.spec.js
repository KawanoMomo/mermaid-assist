'use strict';
// コントラストと標的サイズに、テストが1本も無かった。
//
// 敵対レビューのミューテーション検査で以下がすべて **SURVIVED** (1125 passed, 0 failed):
//   `--accent-red` を元の #f74a4a に戻す
//   primary ボタンの文字色を #fff に戻す
//   `min-height:24px` / `min-width:24px` を削る
//
// コミットメッセージに数値を丁寧に残していても、誰かが「見た目が地味だから」と
// 戻したとき CI は何も言わない。実際に描画された色とサイズで固定する。
//
// ユニットテストでは CSS 変数が解決されず要素も配置されないので、ここは E2E で
// しか押さえられない。
const path = require('path');
const { test, expect } = require('@playwright/test');

const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);

// WCAG 2.x の相対輝度とコントラスト比。
const CONTRAST = `(() => {
  function lum(rgb) {
    const c = rgb.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function parse(s) { const m = String(s).match(/(\\d+(?:\\.\\d+)?)/g); return m ? m.slice(0, 3).map(Number) : null; }
  // 背景が透明なら親を辿る。ボタンの地は自前で持っているが、文字色の相手は行の地。
  function bgOf(el) {
    let n = el;
    while (n) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return c;
      n = n.parentElement;
    }
    return 'rgb(13, 17, 23)';
  }
  return { lum, parse, bgOf, ratio(a, b) { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); } };
})()`;

async function load(page) {
  await page.goto(HTML_URL);
  await page.waitForFunction(() => window.MA && window.MA.modules && window.MA.modules.c4);
  await page.selectOption('#diagram-type', 'C4Context');
  await page.waitForTimeout(500);
  await page.fill('#editor', [
    'C4Container',
    '    title 車載システム',
    '    Person(dev, "開発者")',
    '    Container_Boundary(ecu, "車載ECU") {',
    '        Container(cpu, "メインCPU", "C")',
    '        Container(sens, "センサ入力", "C")',
    '    }',
    '    Rel(dev, cpu, "設定")',
    '',
  ].join(NL));
  await page.waitForTimeout(1500);
}

test.describe('コントラストと標的サイズ (WCAG AA)', () => {
  test('削除ボタン: 白文字が 4.5:1 以上、地が行に対して 3:1 以上', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(`(() => {
      const C = ${CONTRAST};
      const b = document.querySelector('button[class*="c4-delete"]');
      if (!b) return null;
      const cs = getComputedStyle(b);
      const rowBg = C.bgOf(b.parentElement);
      return {
        text: C.ratio(C.parse(cs.color), C.parse(cs.backgroundColor)),
        surface: C.ratio(C.parse(cs.backgroundColor), C.parse(rowBg)),
      };
    })()`);
    expect(r).not.toBeNull();
    // 直す前は 3.48:1 だった。1.4.3 (AA) は 4.5:1。
    expect(r.text).toBeGreaterThanOrEqual(4.5);
    // ボタンの地と行の地の差。1.4.11 (AA) は 3:1。
    expect(r.surface).toBeGreaterThanOrEqual(3);
  });

  test('primary ボタン: 文字が 4.5:1 以上', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(`(() => {
      const C = ${CONTRAST};
      const b = document.querySelector('#c4-add-btn') || document.querySelector('#props-content button[id^="c4-add"]');
      if (!b) return null;
      const cs = getComputedStyle(b);
      return C.ratio(C.parse(cs.color), C.parse(cs.backgroundColor));
    })()`);
    expect(r).not.toBeNull();
    // 直す前は白文字で 3.02:1 だった。
    expect(r).toBeGreaterThanOrEqual(4.5);
  });

  test('placeholder が 4.5:1 以上', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(`(() => {
      const C = ${CONTRAST};
      const el = document.querySelector('#props-content input[placeholder]');
      if (!el) return null;
      const ph = getComputedStyle(el, '::placeholder').color;
      const bg = getComputedStyle(el).backgroundColor;
      return C.ratio(C.parse(ph), C.parse(bg));
    })()`);
    expect(r).not.toBeNull();
    // 指定しないと Chromium の既定が使われ 3.30:1 になる。
    expect(r).toBeGreaterThanOrEqual(4.5);
  });

  test('一覧の操作ボタンはすべて 24x24 以上 (2.5.8)', async ({ page }) => {
    await load(page);
    const small = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#props-content .ma-list-row button').forEach((b) => {
        const r = b.getBoundingClientRect();
        if (r.width < 24 || r.height < 24) {
          out.push({ cls: b.className, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 });
        }
      });
      return out;
    });
    // 直す前は削除 20.2x17.3 / 編集 33.3x19.3 だった。
    expect(small).toEqual([]);
  });

  test('gantt の一覧ボタンも 24x24 以上 (共有ヘルパを通らない図種)', async ({ page }) => {
    await page.goto(HTML_URL);
    await page.waitForFunction(() => window.MA && window.MA.modules && window.MA.modules.gantt);
    await page.selectOption('#diagram-type', 'gantt');
    await page.waitForTimeout(500);
    await page.fill('#editor', [
      'gantt', '    title 開発計画', '    dateFormat YYYY-MM-DD',
      '    section 設計', '    要件定義 :a1, 2026-04-01, 10d',
      '    section 実装', '    コーディング :b1, after a1, 20d', '',
    ].join(NL));
    await page.waitForTimeout(1500);
    const small = await page.evaluate(() => {
      const sel = '.prop-section-up, .prop-section-down, .prop-section-delete, .prop-task-delete, .prop-task-select';
      const out = [];
      document.querySelectorAll(sel).forEach((b) => {
        const r = b.getBoundingClientRect();
        if (r.width < 24 || r.height < 24) out.push({ cls: b.className, w: r.width, h: r.height });
      });
      return out;
    });
    // 直す前は 19x20.2px だった。
    expect(small).toEqual([]);
  });
});
