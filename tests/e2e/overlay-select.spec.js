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
  for (const [type, expectLabel] of [
    ['flowchart', 'Start'], ['block-beta', 'a'], ['classDiagram', 'Animal'],
    ['erDiagram', 'CUSTOMER'], ['stateDiagram', 'Idle'], ['requirementDiagram', 'sample_req'],
    ['architecture-beta', 'db'], ['C4Context', 'user'],
  ]) {
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

// 選択したときに、その要素だけに枠が出ること。
// requirementDiagram は SVG の id (name) と要素の id フィールドが別物なので、
// 判定を el.id でやると「クリックした要素は選択されていない」ことになり
// 枠が永久に出ない。
test.describe('選択のハイライト', () => {
  for (const type of ['flowchart', 'block-beta', 'classDiagram', 'erDiagram',
                      'stateDiagram', 'requirementDiagram', 'architecture-beta',
                      'C4Context']) {
    test(`${type}: クリックした要素だけに枠が出る`, async ({ page }) => {
      await ready(page, type);
      const els = page.locator('#overlay-layer [data-element-id]');
      expect(await els.count()).toBeGreaterThan(0);
      await els.first().click({ force: true });
      await page.waitForTimeout(900);
      const outlined = await page.evaluate(() =>
        [...document.querySelectorAll('#overlay-layer [data-element-id]')]
          .filter(r => r.getAttribute('stroke') !== 'none').length);
      expect(outlined).toBe(1);
    });
  }
});

// C4 は要素を識別できる属性を出さない (class は全部同じ、id は無い)。
// 手がかりはラベルだけなので、同じラベルが2つあると区別できない。
// 出現順で決め打つと mermaid の実装変更や Boundary のネストで壊れ、
// **間違った要素を選ぶ**。それは選べないことより悪いので、
// ラベルが一意な要素だけ当たり判定を作る。
test.describe('C4: ラベルが重複する要素は当たり判定を作らない', () => {
  async function overlayIds(page, text) {
    await page.evaluate((t) => {
      const ed = document.getElementById('editor');
      ed.value = t;
      ed.dispatchEvent(new Event('input'));
    }, text);
    await page.waitForTimeout(1800);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    return page.evaluate(() =>
      [...document.querySelectorAll('#overlay-layer [data-element-id]')]
        .map(r => r.getAttribute('data-element-id')));
  }

  test('ラベルが全部異なれば全要素が対象になる', async ({ page }) => {
    await ready(page, 'C4Context');
    const ids = await overlayIds(page,
      'C4Context\n  Person(u1, "利用者A")\n  Person(u2, "利用者B")\n  System(s, "基幹")\n');
    expect(ids.sort()).toEqual(['s', 'u1', 'u2']);
  });

  test('ラベルが重複する要素だけ外れる', async ({ page }) => {
    await ready(page, 'C4Context');
    const ids = await overlayIds(page,
      'C4Context\n  Person(u1, "利用者")\n  Person(u2, "利用者")\n  System(s, "基幹")\n');
    // 同じ id が2度出る (= 別要素が同じものを指す) ことは決して起きない
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['s']);
  });
});
