// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');

// 仕様 (2026-04-14 Tier1 design) は「エッジは connection mode で接続」
// 「クリック2回でエッジ作成 共通機構 / 全モジュールから利用」と書いていたが、
// `core/connection-mode.js` は**一度も呼ばれていなかった**。
// 20モジュールすべてが operations.connect() を持っているのに、
// キャンバスからは到達できず、線を引くにはプロパティパネルの
// From / To 2つのドロップダウン + ボタンで5操作かかっていた。
const CASES = [
  ['flowchart',     'sel-node-connect',   'A',        'E',        /A\s*-->\s*E/],
  ['classDiagram',  'sel-class-connect',  'Animal',   'Dog',      /Animal.*Dog/],
  ['erDiagram',     'sel-ent-connect',    'CUSTOMER', 'ORDER',    /CUSTOMER\s+\|\|--o\{\s+ORDER/],
  ['stateDiagram',  'sel-state-connect',  'Idle',     'Running',  /Idle\s+-->\s+Running/],
  ['block-beta',    'block-edit-connect', 'a',        'c',        /a\s*-->\s*c/],
];

test.describe('接続モード: 図の上でクリック2回でエッジを引く', () => {
  for (const [type, btnId, from, to, expectRe] of CASES) {
    test(`${type}: ${from} → ${to} を繋げる`, async ({ page }) => {
      page.on('dialog', d => d.accept());
      await page.goto(HTML_URL);
      await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
      await page.waitForTimeout(600);
      await page.locator('#diagram-type').selectOption(type);
      await page.waitForTimeout(1600);
      const before = await page.locator('#editor').inputValue();

      await page.locator(`#overlay-layer [data-element-id="${from}"]`).click({ force: true });
      await page.waitForTimeout(700);
      await expect(page.locator('#' + btnId)).toHaveCount(1);
      await page.locator('#' + btnId).click();
      await page.waitForTimeout(600);
      await page.locator(`#overlay-layer [data-element-id="${to}"]`).click({ force: true });
      await page.waitForTimeout(1300);

      const after = await page.locator('#editor').inputValue();
      expect(after).not.toBe(before);
      expect(after).toMatch(expectRe);
      // 追加した結果が mermaid を壊していないこと。
      // er はラベルを省略できず `A ||--o{ B` が Parse error になるので、
      // ここが通ることが実際の回帰防止になっている
      expect(await page.locator('#status-parse').textContent()).toBe('OK');
    });
  }

  test('自分自身へは繋がない', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
    await page.waitForTimeout(600);
    await page.locator('#diagram-type').selectOption('flowchart');
    await page.waitForTimeout(1600);
    const before = await page.locator('#editor').inputValue();

    await page.locator('#overlay-layer [data-element-id="A"]').click({ force: true });
    await page.waitForTimeout(700);
    await page.locator('#sel-node-connect').click();
    await page.waitForTimeout(600);
    await page.locator('#overlay-layer [data-element-id="A"]').click({ force: true });
    await page.waitForTimeout(1200);

    expect(await page.locator('#editor').inputValue()).toBe(before);
  });
});

// 接続モードを自分で実装したあと、自分で敵対検証して見つけた欠陥の回帰防止。
//
// 第1周: 図種を切り替えてもモードが残り、flowchart の A から block の b へ
//        `A --> b` という、その図に存在しない要素を名指しする線が引けた。
//        Escape で抜ける手段が無く、モードに入ったことが画面のどこにも出なかった。
// 第2周: 接続モード中に矢印キーで選択が動き、緑枠が「編集中」と言いながら
//        ステータスは「相手をクリック」と言う状態になった。
//        始点をエディタから消しても線が引け、消したはずの要素が復活した。
test.describe('接続モードの抜け道と状態', () => {
  async function ready(page, type) {
    page.on('dialog', d => d.accept());
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
    await page.waitForTimeout(600);
    await page.locator('#diagram-type').selectOption(type);
    await page.waitForTimeout(1600);
  }
  async function startFrom(page, id) {
    await page.locator(`#overlay-layer [data-element-id="${id}"]`).click({ force: true });
    await page.waitForTimeout(700);
    await page.locator('#sel-node-connect').click();
    await page.waitForTimeout(600);
  }
  const inMode = (page) => page.evaluate(() => window.MA.connectionMode.isInConnectionMode());

  test('図種を切り替えるとモードが解除される', async ({ page }) => {
    await ready(page, 'flowchart');
    await startFrom(page, 'A');
    expect(await inMode(page)).toBe(true);

    await page.locator('#diagram-type').selectOption('block-beta');
    await page.waitForTimeout(1800);
    expect(await inMode(page)).toBe(false);

    // 別の図の要素をクリックしても線は引かれない
    const before = await page.locator('#editor').inputValue();
    await page.locator('#overlay-layer [data-element-id="b"]').click({ force: true });
    await page.waitForTimeout(1200);
    expect(await page.locator('#editor').inputValue()).toBe(before);
  });

  test('Escape でモードを抜けられる', async ({ page }) => {
    await ready(page, 'flowchart');
    const status0 = await page.locator('#status-info').textContent();
    await startFrom(page, 'A');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    expect(await inMode(page)).toBe(false);
    expect(await page.locator('#status-info').textContent()).toBe(status0);
  });

  test('モードに入ったことがステータスバーに出る', async ({ page }) => {
    await ready(page, 'flowchart');
    await startFrom(page, 'A');
    const s = await page.locator('#status-info').textContent();
    expect(s).toContain('接続モード');
    expect(s).toContain('A');
    expect(s).toContain('Escape');
  });

  test('モード中は矢印キーで選択が動かない', async ({ page }) => {
    await ready(page, 'flowchart');
    await startFrom(page, 'A');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => window.MA.selection.getSelected())).toEqual([]);
    expect(await inMode(page)).toBe(true);
  });

  test('始点が消えていたら線を引かない', async ({ page }) => {
    await ready(page, 'flowchart');
    await startFrom(page, 'A');
    const t = await page.locator('#editor').inputValue();
    await page.evaluate((x) => {
      const ed = document.getElementById('editor');
      ed.value = x.split('\n').filter(l => !/^\s*A\[/.test(l)).join('\n');
      ed.dispatchEvent(new Event('input'));
    }, t);
    await page.waitForTimeout(1600);
    const mid = await page.locator('#editor').inputValue();

    await page.locator('#overlay-layer [data-element-id="E"]').click({ force: true });
    await page.waitForTimeout(1300);

    expect(await page.locator('#editor').inputValue()).toBe(mid);
    // 拒否したあとモードがぶら下がらない
    expect(await inMode(page)).toBe(false);
  });

  test('引いた線を Undo 1回で取り消せる', async ({ page }) => {
    await ready(page, 'flowchart');
    const before = await page.locator('#editor').inputValue();
    await startFrom(page, 'A');
    await page.locator('#overlay-layer [data-element-id="E"]').click({ force: true });
    await page.waitForTimeout(1300);
    expect(await page.locator('#editor').inputValue()).not.toBe(before);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1000);
    expect(await page.locator('#editor').inputValue()).toBe(before);
  });
});
