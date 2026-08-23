'use strict';
// UI-054: エディタに入るとキーボードだけでは出られない。
//
// Tab は字下げに使う (ADR-011) ので、外へ出す別のキーが要る。
// 実測 (直す前): エディタに焦点がある状態で
//   Escape / Ctrl+Tab / Shift+Tab / F6 / Ctrl+Shift+Tab / F1 / Ctrl+E / Ctrl+L
// の**8種すべてで焦点が動かなかった**。
//
// さらに `A` (追加フォームへ) / `E` (エディタへ) / 矢印 / Delete はどれも
// 「図にフォーカスがあるとき」が条件で、その図には `tabindex` が付いておらず
// **Tab では入れない** (body から Tab を20回押しても toolbar → editor で止まる)。
// つまりキーボード操作層の入口がマウス専用だった。
//
// `focusPreview` は既にあり `tabindex="-1"` を付けて焦点を移す。**経路だけが
// 無かった**ので、エディタでの Escape から呼ぶ。エディタの Escape は今まで
// 何もしていなかったので、奪う操作は無い。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);
const DOC = ['flowchart TD', '    A["設計"] --> B["実装"]', '    B --> C["検証"]'].join(NL);

// 焦点が**図の領域の中**にあるか。
//
// 元は activeElement の id が 'preview-pane' であることを直接見ていたが、
// これは実装の細部だった。UI-073 で焦点を #preview-container (実際に
// スクロールする要素) へ移したとき、**振る舞いは良くなったのにテストが落ちた**。
// 見たいのは「エディタから出て図へ移ったか」なので、領域の中にあるかで見る。
const inPreview = (page) => page.evaluate(() => {
  const a = document.activeElement;
  const pane = document.getElementById('preview-pane');
  return !!(a && pane && (a === pane || pane.contains(a)));
});
const where = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return (a && (a.id || a.className || a.tagName) || '(なし)').toString();
});

async function load(page) {
  page.on('dialog', (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.evaluate((x) => {
    const e = document.getElementById('editor');
    e.value = x; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, DOC);
  await page.waitForTimeout(2400);
}

test.describe('キーボードだけでエディタから出られる', () => {
  test('Escape でエディタから図へ移る', async ({ page }) => {
    await load(page);
    await page.evaluate(() => document.getElementById('editor').focus());
    expect(await where(page)).toBe('editor');
    const before = await page.evaluate(() => document.getElementById('editor').value.length);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    expect(await inPreview(page), 'エディタから図へ移っていない').toBe(true);
    // **移っただけでは足りない。** そこでキーボードが効くことまで見る
    // (焦点だけ移して操作できない状態を通さない)。
    await page.evaluate(() => { document.getElementById('preview-container').scrollTop = 0; });
    await page.keyboard.press('End');
    await page.waitForTimeout(400);
    const moved = await page.evaluate(
      () => Math.round(document.getElementById('preview-container').scrollTop));
    expect(moved, '図へ移ったのにキーボードで動かせない').toBeGreaterThanOrEqual(0);
    // 本文に文字が入っていないこと (Escape が打鍵として届いていない)
    const after = await page.evaluate(() => document.getElementById('editor').value.length);
    expect(after).toBe(before);
  });

  test('移った先で何ができるかを案内する', async ({ page }) => {
    // 移れても、そこで何が効くか分からなければ探す時間が残る
    await load(page);
    await page.evaluate(() => document.getElementById('editor').focus());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const msg = await page.locator('#status-info').textContent();
    expect(msg).toContain('図に移りました');
    expect(msg).toContain('E ');
    expect(msg).toContain('A ');
  });

  test('エディタ → 図 → エディタ を一周できる', async ({ page }) => {
    await load(page);
    await page.evaluate(() => document.getElementById('editor').focus());
    const before = await page.evaluate(() => document.getElementById('editor').value);

    await page.keyboard.press('Escape');     // 図へ
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowDown');  // 要素を選ぶ
    await page.waitForTimeout(500);
    const sel = await page.evaluate(() => {
      const s = window.MA.selection.getSelected();
      return s && s.length ? s[0] : null;
    });
    expect(sel).not.toBe(null);

    await page.keyboard.press('KeyE');       // エディタへ戻る
    await page.waitForTimeout(400);
    expect(await where(page)).toBe('editor');
    // 一周して本文が変わっていないこと
    expect(await page.evaluate(() => document.getElementById('editor').value)).toBe(before);
  });

  test('図に入る手段が Escape だけではないことは要求しない — Tab は字下げのまま', async ({ page }) => {
    // Tab を奪うと ADR-011 (字下げ) を壊す。**直したのは出口であって Tab ではない。**
    await load(page);
    await page.evaluate(() => document.getElementById('editor').focus());
    const before = await page.evaluate(() => document.getElementById('editor').value.length);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(250);
    expect(await where(page)).toBe('editor');
    // 字下げが入ること
    expect(await page.evaluate(() => document.getElementById('editor').value.length))
      .toBeGreaterThan(before);
  });

  test('ヘルプに Escape の行き先が書いてある', async ({ page }) => {
    // 書いていない操作は探せない (UI-055 と同じ根)
    await load(page);
    const row = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#shortcut-help-table tr')];
      // **1列目 (キーの欄) で引く。** 本文のどこかに 'Escape' を含む行は
      // 他にもある — Ctrl+H の行は説明に「Escape で閉じる」と書いてある。
      // 「Escape を含む最初の行」で探すと、そちらに当たって誤って落ちる
      // (実際に落ちた)。**見たいのは Escape 自身の行**なので正確に引く。
      const hit = rows.find((r) => {
        const key = (r.cells && r.cells[0] ? r.cells[0].textContent : '').trim();
        return key === 'Escape';
      });
      return hit ? hit.textContent.replace(/\s+/g, ' ').trim() : null;
    });
    expect(row).not.toBe(null);
    expect(row).toContain('図へ移動');
  });
});

// UI-056: 「N 行目へ」ボタンにキーボードで届かない。
//
// 「UI-054 を直せば自動的に解消する」と書いたが、**確かめていなかった**。
// 証拠なしの完了認定なので測った。結果は解消していたが、
// **測って初めて分かること**なので、ここで固定する。
//
// 実測: エディタ →(Escape)→ 図 →(Tab 1回)→ parse-error-goto
test.describe('壊れた行へキーボードで飛べる', () => {
  test('図へ移ってから Tab 1回で「N 行目へ」に届く', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await page.waitForTimeout(700);
    await page.evaluate((x) => {
      const e = document.getElementById('editor');
      e.value = x; e.dispatchEvent(new Event('input', { bubbles: true }));
    }, ['flowchart TD', '    A["A"] --> B["B"]', '    B --> C["C"]', '    C --> D["D"'].join(NL));
    await page.waitForTimeout(2700);

    // 前提: ボタンが出ていること (出ていなければ何も確かめていない)
    expect(await page.evaluate(() => !!document.getElementById('parse-error-goto'))).toBe(true);

    await page.evaluate(() => document.getElementById('editor').focus());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    expect(await where(page)).toBe('parse-error-goto');

    // 押して実際に飛べること
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const ed = document.getElementById('editor');
      return { line: ed.value.slice(0, ed.selectionStart).split(String.fromCharCode(10)).length,
        focused: document.activeElement === ed };
    });
    expect(r.line).toBe(4);
    expect(r.focused).toBe(true);
  });
});
