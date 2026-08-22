'use strict';
// UI-040: 絞り込んだあと、その行へ行くのに追加フォーム全体を通過する。
//
// 実測 (1366x768、40ノードを「受信処理37」で1行に絞ったあと):
//   絞り込み欄から Tab を押していくと
//   fc-direction → fc-add-node-id → …(追加フォーム全体)… → **14回目**でようやく
//   絞り込みで残った行の編集ボタンに着く。
//
// 「探す → 直す」は1日に何度も踏む流れなので、そのたびに14打鍵増える。
// 配置は変えず、Enter で残った最初の行へ飛ばす
// (絞り込み欄で Enter を押したら結果へ、は一般的な作法)。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);

async function setup(page) {
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.locator('#diagram-type').selectOption('flowchart');
  await page.waitForTimeout(1700);
  const L = ['flowchart TD'];
  for (let i = 0; i < 40; i++) L.push('    NODE' + i + '["受信処理' + i + '"]');
  await page.evaluate((x) => {
    const e = document.getElementById('editor');
    e.value = x; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, L.join(NL));
  await page.waitForTimeout(2500);
}
const focusInfo = (page) => page.evaluate(() => {
  const a = document.activeElement;
  const row = a && a.closest ? a.closest('.ma-list-row') : null;
  return { id: a ? (a.id || a.className || '') : '',
    inRow: !!row,
    hidden: row ? row.style.display === 'none' : null,
    text: row ? (row.textContent || '').replace(/\s+/g, ' ').trim() : '' };
});

test.describe('UI-040: 絞り込んだ行へ Enter で飛べる', () => {
  test('Enter 1回で残った行に着く', async ({ page }) => {
    test.setTimeout(90000);
    await setup(page);
    await page.locator('#ma-list-filter').click();
    await page.keyboard.type('受信処理37');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const f = await focusInfo(page);
    expect(f.inRow).toBe(true);
    expect(f.hidden).toBe(false);
    expect(f.text).toContain('受信処理37');
  });

  test('絞り込みが空でも先頭の行に着く', async ({ page }) => {
    test.setTimeout(90000);
    await setup(page);
    await page.locator('#ma-list-filter').click();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const f = await focusInfo(page);
    expect(f.inRow).toBe(true);
    expect(f.hidden).toBe(false);
  });

  test('一致が0件なら何も起きない (フォーカスは絞り込み欄のまま)', async ({ page }) => {
    test.setTimeout(90000);
    await setup(page);
    await page.locator('#ma-list-filter').click();
    await page.keyboard.type('該当しない語');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const f = await focusInfo(page);
    expect(f.inRow).toBe(false);
    expect(f.id).toBe('ma-list-filter');
  });
  // **この検査は元の壊れ方を再現できていない。**
  // 探索 (scratchpad/filter-all.js) では元の実装で gitGraph が3回とも失敗し、
  // 直した実装では成功する。しかし e2e では**元の実装でも通ってしまう** —
  // 育てる要素数・待ち時間を探索と揃えても再現しなかった。
  // したがってこの検査は「今21図種で効いている」ことは示すが、
  // **回帰を捕まえる保証は無い**。変異で確認済みとは書けない。
  //
  // 図種ごとにパネルの作り直しの起き方が違う。**flowchart で1回確かめただけでは
  // 足りなかった** — gitGraph では、キーを押した瞬間に捕まえた行が
  // 焦点を当てる時点で**文書から外れて**おり (実測: attached=false)、着かなかった。
  // その場で捕まえず、当てる瞬間に取り直す形にした。
  test('選択できる図種すべてで Enter が効く', async ({ page }) => {
    test.setTimeout(300000);
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await page.waitForTimeout(500);
    const types = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#diagram-type option')).map(o => o.value));
    const missed = [];
    for (const t of types) {
      await page.locator('#diagram-type').selectOption(t);
      await page.waitForTimeout(1500);
      // 絞り込み欄はしきい値を超えないと出ないので育てる
      await page.evaluate(() => {
        const txt0 = document.getElementById('editor').value;
        const mod = Object.values(window.MA.modules).find(m => m.detect && m.detect(txt0));
        if (!mod || !mod.operations || typeof mod.operations.add !== 'function') return;
        const parse = (t2) => { try { return mod.parse(t2).elements || []; } catch (e) { return []; } };
        let text = txt0, els = parse(text);
        const kinds = []; els.forEach(e => { if (kinds.indexOf(e.kind) < 0) kinds.push(e.kind); });
        let guard = 0;
        while (els.length < 30 && guard < 120) {
          guard++;
          const ends = els.map(e => e.name || e.id || e.label).filter(Boolean);
          let grew = false;
          for (const kind of kinds) {
            const nm = 'F' + els.length;
            const props = { name:nm, label:nm, text:nm, id:nm, title:nm, kind:kind,
              from:ends[0], to:ends[1]||ends[0], target:ends[0], reltype:'satisfies',
              section:ends[0], column:ends[0], period:nm, event:nm, icon:'server',
              score:3, reqType:'requirement', value:1, values:[1,2,3],
              x:0.5, y:0.5, startBit:0, endBit:0, parentLine:2, siblingLine:2, line:2 };
            let out; try { out = mod.operations.add(text, kind, props); } catch (e) { continue; }
            if (typeof out !== 'string' || out === text) continue;
            if (out.indexOf('undefined') >= 0) continue;
            const after = parse(out);
            if (after.length <= els.length) continue;
            text = out; els = after; grew = true; break;
          }
          if (!grew) break;
        }
        const ed = document.getElementById('editor');
        ed.value = text; ed.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForTimeout(2500);
      if ((await page.locator('#ma-list-filter').count()) === 0) continue;
      await page.locator('#ma-list-filter').click();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      const inRow = await page.evaluate(() => {
        const a = document.activeElement;
        return !!(a && a.closest && a.closest('.ma-list-row'));
      });
      if (!inRow) missed.push(t);
    }
    expect(missed).toEqual([]);
  });
});
