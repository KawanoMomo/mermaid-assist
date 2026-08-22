'use strict';
// FEAT-011: 構文が壊れたとき、どの行が悪いか分からない。
//
// 実測 (直す前): 6種類の構文誤りすべてで、帯は
// 「図を描けませんでした — 表示しているのは直前に描けた図です」だけ。
// 行番号が出ず、全体を目で追う羽目になる。
//
// **mermaid は行番号を返している** のに、こちらが捨てていた:
//   message: "Parse error on line 6: ...^ Expecting 'SQE', ..."
//   hash.loc.first_line: 5
//
// 外部でも同じ不満が挙がっている:「括弧の位置がずれると、問題を指し示さない
// 不可解な失敗になる」(2026-08-22 確認)。
//
// 実測 (直した後):
//   5行目で誤る      → 「5 行目へ」/ 押すと5行目を選択してエディタに焦点
//   括弧の閉じ忘れ(2行) → 「2 行目へ」(本文の末尾より先は指さない)
//   図種名の誤り      → 行番号を**出さない** (mermaid が返さないので推測しない)
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);

async function load(page, lines) {
  page.on('dialog', (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.evaluate((x) => {
    const e = document.getElementById('editor');
    e.value = x; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, lines.join(NL));
  await page.waitForTimeout(2600);
}

const label = (page) => page.evaluate(() => {
  const b = document.getElementById('parse-error-goto');
  return b ? b.textContent.trim() : null;
});

test.describe('壊れた行を指す', () => {
  test('5行目の誤りは 5 行目を指し、押すとそこへ飛ぶ', async ({ page }) => {
    await load(page, ['flowchart TD', '    A["A"] --> B["B"]', '    B --> C["C"]',
      '    C --> D["D"]', '    D --> E["E"']);
    expect(await label(page)).toBe('5 行目へ');

    const r = await page.evaluate(() => {
      document.getElementById('parse-error-goto').click();
      const ed = document.getElementById('editor');
      return {
        line: ed.value.slice(0, ed.selectionStart).split(String.fromCharCode(10)).length,
        picked: ed.value.slice(ed.selectionStart, ed.selectionEnd).trim(),
        focused: document.activeElement === ed,
      };
    });
    expect(r.line).toBe(5);
    // 壊れている行そのものを掴むこと (隣の行では直しに行けない)
    expect(r.picked).toContain('D --> E');
    // 押した後すぐ打てること
    expect(r.focused).toBe(true);
  });

  test('本文の末尾より先は指さない', async ({ page }) => {
    // 閉じ括弧の欠落は入力の終端で気付かれるので、mermaid は末尾より
    // 1つ先の行を返す。2行の文書で「3 行目へ」と出すと押した先が無い。
    await load(page, ['flowchart TD', '    A["設計" --> B["実装"]']);
    expect(await label(page)).toBe('2 行目へ');
  });

  test('mermaid が行を返さないときは行番号を出さない', async ({ page }) => {
    // 推測で行を指さない。間違った行へ飛ばすのは、飛ばさないより悪い。
    await load(page, ['flowchrt TD', '    A["設計"] --> B["実装"]']);
    expect(await label(page)).toBe(null);
    // ただしエラーであることは伝わる
    const shown = await page.evaluate(() => {
      const b = document.getElementById('parse-error-banner');
      return b && !b.hidden ? b.textContent.trim() : '';
    });
    expect(shown).toContain('描けませんでした');
  });

  test('直ったらボタンは残らない', async ({ page }) => {
    await load(page, ['flowchart TD', '    A["A"] --> B["B"]', '    B --> C["C"'] );
    expect(await label(page)).not.toBe(null);
    // 直す
    await page.evaluate((x) => {
      const e = document.getElementById('editor');
      e.value = x; e.dispatchEvent(new Event('input', { bubbles: true }));
    }, ['flowchart TD', '    A["A"] --> B["B"]', '    B --> C["C"]'].join(NL));
    await page.waitForTimeout(2600);
    // 隠すだけだと古い行番号を指すボタンが DOM に残る
    expect(await label(page)).toBe(null);
  });
});
