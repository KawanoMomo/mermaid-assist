// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');

async function ready(page, type) {
  page.on('dialog', d => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
  if (type !== 'gantt') {
    await page.locator('#diagram-type').selectOption(type);
    await page.waitForTimeout(1600);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

// 図を直接クリックして選択できること。
//
// flowchart はオーバーレイの矩形を5つ作っていたのに、クリックしても何も
// 起きなかった。app.js の overlay ハンドラが data-element-kind を
// 'message' | 'note' | 'group' のホワイトリストでしか見ておらず、
// flowchart が出す 'node' は「空白をクリックした」扱いで選択解除に落ちていた。
// 「無い」より「あるように見えて動かない」方が悪い。
test.describe('オーバーレイのクリック選択', () => {
  for (const [type, expectLabel] of [['flowchart', 'Start'], ['block-beta', 'a']]) {
    test(`${type}: 図の要素をクリックすると選択される`, async ({ page }) => {
      await ready(page, type);
      const before = await page.locator('#props-content').textContent();

      const el = page.locator('#overlay-layer [data-element-id]').first();
      await expect(el).toHaveCount(1);
      await el.click({ force: true });
      await page.waitForTimeout(700);

      const after = await page.locator('#props-content').textContent();
      expect(after).not.toBe(before);
      expect(after).toContain(expectLabel);
    });
  }

  // 位置がずれていると「一番上に積まれた1枚が全要素の代理をする」状態になる。
  // 実測では flowchart の4ノードがすべて (-48,-29) に重なっていた。
  test('flowchart: オーバーレイがノードごとに別の場所に置かれる', async ({ page }) => {
    await ready(page, 'flowchart');
    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll('#overlay-layer [data-element-id]')].map(r => ({
        id: r.getAttribute('data-element-id'),
        x: Math.round(+r.getAttribute('x')),
        y: Math.round(+r.getAttribute('y')),
      })));
    expect(boxes.length).toBeGreaterThan(1);
    const spots = new Set(boxes.map(b => b.x + ',' + b.y));
    expect(spots.size).toBe(boxes.length);
  });

  // ラベルで照合していたので、同じラベルのノードが2つあると
  // 下のノードのオーバーレイが上のノードを指していた。
  test('flowchart: 同じラベルのノードが混ざっても別々の要素を指す', async ({ page }) => {
    await ready(page, 'flowchart');
    await page.evaluate(() => {
      const ed = document.getElementById('editor');
      ed.value = 'flowchart TD\n    A[確認] --> B[処理]\n    B --> C[確認]\n    C --> D[完了]\n';
      ed.dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(1800);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    const ids = await page.evaluate(() =>
      [...document.querySelectorAll('#overlay-layer [data-element-id]')]
        .map(r => r.getAttribute('data-element-id')));
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
  });

  // オーバーレイは図の上に重ねるので、位置が合っていなければ意味がない。
  test('block-beta: オーバーレイが描画されたブロックに重なる', async ({ page }) => {
    await ready(page, 'block-beta');
    const pairs = await page.evaluate(() => {
      const svg = document.querySelector('#preview-svg svg');
      const out = [];
      document.querySelectorAll('#overlay-layer [data-element-id]').forEach(r => {
        const id = r.getAttribute('data-element-id');
        const node = svg.querySelector('.node#' + CSS.escape(id));
        if (!node) return;
        const a = r.getBoundingClientRect(), b = node.getBoundingClientRect();
        out.push({ id: id, dx: Math.abs(a.x + a.width / 2 - (b.x + b.width / 2)),
                   dy: Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)) });
      });
      return out;
    });
    expect(pairs.length).toBeGreaterThan(0);
    for (const p of pairs) {
      // 中心のずれが数px以内 (hitRect の余白ぶんは中心に影響しない)
      expect(p.dx).toBeLessThan(4);
      expect(p.dy).toBeLessThan(4);
    }
  });
});
