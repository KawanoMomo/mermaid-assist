// @ts-check
// FEAT-903: 既にある要素の親を、パネルの欄で変えられる (c4 / block)。
//
// ここは**実機の経路**を通す。単体は関数を直接呼ぶので、パネルが欄を出して
// いなかったり、選んだ値が渡っていない配線ミスを拾えない。
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);

async function load(page, text) {
  page.on('dialog', d => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.evaluate((t) => {
    const e = document.getElementById('editor');
    e.value = t; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await page.waitForTimeout(2200);
}
const editorText = (page) => page.locator('#editor').inputValue();

test.describe('FEAT-903 パネルで親を変えられる', () => {
  test('c4: 要素を別の境界へ移す', async ({ page }) => {
    // b1 に子を2つ置く。1つだと**動かした側が空になって畳まれる**ため
    // (空の境界は mermaid が描けないので畳む約束)、「b1 から出た」の判定が
    // 畳みと区別できなくなる。
    const doc = ['C4Context',
      '    System_Boundary(b1, "内側A") {',
      '        System(s1, "系1")',
      '        System(s3, "系3")',
      '    }',
      '    System_Boundary(b2, "内側B") {',
      '        System(s2, "系2")',
      '    }'].join(NL);
    await load(page, doc);

    await page.locator('.c4-select-element[data-element-id="s1"]').first().click();
    await page.waitForTimeout(700);
    const sel = page.locator('#c4-edit-parent');
    await expect(sel).toHaveCount(1);
    // いまの親が選ばれていること (現在地が読める)
    expect(await sel.inputValue()).toBe('b1');

    await sel.selectOption('b2');
    await page.waitForTimeout(1400);

    const after = await editorText(page);
    const L = after.split(NL);
    const iS1 = L.findIndex(l => l.indexOf('System(s1,') >= 0);
    const iB2 = L.findIndex(l => l.indexOf('System_Boundary(b2,') >= 0);
    const iB1 = L.findIndex(l => l.indexOf('System_Boundary(b1,') >= 0);
    const iB1End = L.findIndex((l, n) => n > iB1 && l.trim() === '}');
    expect(iB1).toBeGreaterThan(-1);             // b1 は畳まれず残っている
    expect(iS1).toBeGreaterThan(iB2);            // b2 の中に来た
    expect(iS1).toBeGreaterThan(iB1End);         // b1 からは出た
    expect(after).toContain('System(s3,');       // 残した仲間はそのまま
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
  });

  test('block: ブロックを別のグループへ移す', async ({ page }) => {
    const doc = ['block-beta', '  a["外A"]', '  block:g1', '    b["中B"]', '  end'].join(NL);
    await load(page, doc);

    await page.locator('.block-select-block[data-element-id="a"]').first().click();
    await page.waitForTimeout(700);
    const sel = page.locator('#block-edit-parent');
    await expect(sel).toHaveCount(1);
    expect(await sel.inputValue()).toBe('');     // いまは一番外

    await sel.selectOption('g1');
    await page.waitForTimeout(1400);

    const after = await editorText(page);
    const L = after.split(NL);
    const iA = L.findIndex(l => l.indexOf('a["外A"]') >= 0);
    const iG1 = L.findIndex(l => l.indexOf('block:g1') >= 0);
    const iEnd = L.findIndex(l => l.trim() === 'end');
    expect(iA).toBeGreaterThan(iG1);
    expect(iA).toBeLessThan(iEnd);               // end より前 = グループの中
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
  });

  test('journey: タスクを別のセクションへ移す', async ({ page }) => {
    const doc = ['journey', '  title 旅', '  section 準備', '    調べる: 5: 私',
      '  section 実行', '    作る: 3: 私'].join(NL);
    await load(page, doc);
    await page.locator('.jr-select-task').first().click();
    await page.waitForTimeout(700);
    const sel = page.locator('#jr-edit-t-section');
    await expect(sel).toHaveCount(1);
    expect(await sel.inputValue()).toBe('準備');   // 現在地が読める

    await sel.selectOption('実行');
    await page.waitForTimeout(1400);

    const L = (await editorText(page)).split(NL);
    const iTask = L.findIndex(l => l.indexOf('調べる') >= 0);
    const iSec2 = L.findIndex(l => l.indexOf('section 実行') >= 0);
    expect(iTask).toBeGreaterThan(iSec2);
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
  });

  test('kanban: カードを別の列へ移す', async ({ page }) => {
    const doc = ['kanban', '    Todo', '        [調べる]', '    Done', '        [出す]'].join(NL);
    await load(page, doc);
    await page.locator('.kb-select-card').first().click();
    await page.waitForTimeout(700);
    const sel = page.locator('#kb-edit-c-column');
    await expect(sel).toHaveCount(1);
    expect(await sel.inputValue()).toBe('Todo');

    await sel.selectOption('Done');
    await page.waitForTimeout(1400);

    const L = (await editorText(page)).split(NL);
    const iCard = L.findIndex(l => l.indexOf('[調べる]') >= 0);
    const iDone = L.findIndex(l => l.trim() === 'Done');
    expect(iCard).toBeGreaterThan(iDone);
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
  });

  test('timeline: 継続行つきのピリオドを別のセクションへ移す', async ({ page }) => {
    const doc = ['timeline', '  title 年表', '  section 前期',
      '    2020 : 開始', '         : 資金調達', '    2021 : 拡大',
      '  section 後期', '    2022 : 上場'].join(NL);
    await load(page, doc);
    await page.locator('.tl-select-period').first().click();
    await page.waitForTimeout(700);
    const sel = page.locator('#tl-edit-p-section');
    await expect(sel).toHaveCount(1);
    expect(await sel.inputValue()).toBe('前期');

    await sel.selectOption('後期');
    await page.waitForTimeout(1400);

    const after = await editorText(page);
    const L = after.split(NL);
    const i2020 = L.findIndex(l => l.indexOf('2020') >= 0);
    const iSec2 = L.findIndex(l => l.indexOf('section 後期') >= 0);
    expect(i2020).toBeGreaterThan(iSec2);
    // 継続行が取り残されていない
    expect(L[i2020 + 1].indexOf('資金調達')).toBeGreaterThan(-1);
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
  });
});
