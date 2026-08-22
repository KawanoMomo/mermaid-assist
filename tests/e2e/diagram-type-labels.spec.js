'use strict';
// UI-071: UI 全体は日本語なのに、図種21件だけ mermaid の英語識別子だった。
//
// 実測 (直す前): ペルソナが使う語で引けるか試したところ
//   状態遷移 / タイミング / 構成 / 階層 / ブロック / クラス / シーケンス /
//   要求 / ガント / パケット の **10語すべてで該当0件**。
// 「状態遷移図を描きたい」人は mermaid がそれを "State" と呼ぶことを
// 知らないと選べない。群分けも検索欄も無い21件の一覧から探すことになる。
//
// 英語名は mermaid の記法と1対1で対応する (エディタ本文に出る語) ため残し、
// 目的の語を添える方針にした。
//
// **添えた副作用も押さえる**: 日本語を足したら select が 121px → 286px に
// なり、800x600 で画面外に出た (ツールバーは右詰めなので増えた分だけ外へ出る)。
// max-width: min(190px, 15vw) で抑えた。狭い画面での回帰をここで防ぐ。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');

// ペルソナが「これを描きたい」と思ったときに使う語
const WORDS = ['状態遷移', '構成', '階層', 'ブロック', 'クラス',
  'シーケンス', '要求', 'ガント', 'パケット', '時系列'];

async function load(page) {
  page.on('dialog', (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(700);
}

test.describe('図種を目的の語から選べる', () => {
  test('目的の語がすべて図種名から引ける', async ({ page }) => {
    await load(page);
    const texts = await page.evaluate(() => Array.from(
      document.getElementById('diagram-type').options).map((o) => o.text));
    expect(texts.length).toBe(21);
    const missing = WORDS.filter((w) => !texts.some((t) => t.indexOf(w) >= 0));
    expect(missing).toEqual([]);
  });

  test('mermaid の記法に対応する英語名が消えていない', async ({ page }) => {
    // 日本語だけにすると、エディタ本文の語と対応が付かなくなる
    await load(page);
    const pairs = await page.evaluate(() => Array.from(
      document.getElementById('diagram-type').options).map((o) => ({ v: o.value, t: o.text })));
    for (const p of pairs) {
      expect(p.t).toMatch(/[A-Za-z]/);
    }
    expect(pairs.find((p) => p.v === 'stateDiagram').t).toContain('State');
    expect(pairs.find((p) => p.v === 'C4Context').t).toContain('C4');
  });

  test('狭い画面でも図種の選択が画面内に収まる', async ({ page }) => {
    // 日本語を添えた副作用で 800x600 で画面外に出た回帰を防ぐ
    for (const [w, h] of [[800, 600], [1024, 768], [1366, 768]]) {
      await page.setViewportSize({ width: w, height: h });
      await load(page);
      const r = await page.evaluate(() => {
        const s = document.getElementById('diagram-type');
        const b = s.getBoundingClientRect();
        return { inView: b.right <= innerWidth + 1 && b.left >= -1,
          hScroll: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      expect(r.inView, w + 'x' + h + ' で図種の選択が画面外').toBe(true);
      expect(r.hScroll, w + 'x' + h + ' で横スクロールが出た').toBe(false);
    }
  });
});
