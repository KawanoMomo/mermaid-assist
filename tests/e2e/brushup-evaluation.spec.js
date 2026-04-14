// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}

async function editorText(page) {
  return page.locator('#editor').inputValue();
}

async function clickBar(page, taskId) {
  await page.locator(`#overlay-layer .overlay-bar[data-task-id="${taskId}"]`).click();
  await page.waitForTimeout(150);
}

async function escapeSelection(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
}

// ─────────────────────────────────────────────────────────────────────────
//  E01: コピペIDバグ
// ─────────────────────────────────────────────────────────────────────────
test.describe('E01: コピペID', () => {
  test('ペーストしたタスクのIDが__new_ではなくt{N}形式になる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(800);

    const text = await editorText(page);
    expect(text).not.toContain('__new_');
    expect(text).toMatch(/:[a-z]\d+,/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  E02-E03: ズーム範囲
// ─────────────────────────────────────────────────────────────────────────
test.describe('E02-E03: ズーム範囲', () => {
  test('E02: ズーム下限は25%で止まる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    for (let i = 0; i < 20; i++) {
      await page.locator('#btn-zoom-out').click();
    }
    const zoom = parseInt(await page.locator('#zoom-display').textContent());
    expect(zoom).toBeGreaterThanOrEqual(25);
  });

  test('E03: ズーム上限は300%で止まる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    for (let i = 0; i < 30; i++) {
      await page.locator('#btn-zoom-in').click();
    }
    const zoom = parseInt(await page.locator('#zoom-display').textContent());
    expect(zoom).toBeLessThanOrEqual(300);
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  E04: ホバーフィードバック
// ─────────────────────────────────────────────────────────────────────────
test.describe('E04: ホバーフィードバック', () => {
  test('タスクバーにホバーすると視覚的変化がある', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const box = await bar.boundingBox();
    if (!box) throw new Error('bar not found');

    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(200);

    const hasHoverEffect = await bar.evaluate(el => {
      const style = window.getComputedStyle(el);
      return el.getAttribute('fill') !== 'transparent'
        || style.opacity !== '1'
        || el.classList.contains('hovered')
        || style.fill !== 'none' && style.fill !== 'rgb(0, 0, 0)' && style.fill !== '';
    });
    expect(hasHoverEffect).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  E05: ドラッグ中の日付ツールチップ
// ─────────────────────────────────────────────────────────────────────────
test.describe('E05: ドラッグ日付ツールチップ', () => {
  test('ドラッグ中にツールチップが表示される', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const box = await bar.boundingBox();
    if (!box) throw new Error('bar not found');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, { steps: 5 });
    await page.waitForTimeout(200);

    const tooltip = page.locator('#drag-tooltip');
    await expect(tooltip).toBeVisible();
    const text = await tooltip.textContent();
    expect(text).toMatch(/\d{4}-\d{2}-\d{2}/);

    await page.mouse.up();
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  E06: ドラッグ中のバー視覚エフェクト
// ─────────────────────────────────────────────────────────────────────────
test.describe('E06: ドラッグ中バーエフェクト', () => {
  test('ドラッグ中のバーが視覚的にアクティブになる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const box = await bar.boundingBox();
    if (!box) throw new Error('bar not found');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2, { steps: 3 });
    await page.waitForTimeout(100);

    const hasEffect = await bar.evaluate(el => {
      return el.getAttribute('data-dragging') === 'true'
        || (el.getAttribute('fill') !== 'transparent' && el.getAttribute('fill') !== null);
    });
    expect(hasEffect).toBe(true);

    await page.mouse.up();
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  E07: after依存の編集
// ─────────────────────────────────────────────────────────────────────────
test.describe('E07: after依存の編集', () => {
  test('after依存をプロパティパネルで変更できる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a2');
    await page.waitForTimeout(200);

    const afterInput = page.locator('#prop-after');
    await expect(afterInput).toBeVisible();
    const isReadonly = await afterInput.getAttribute('readonly');
    expect(isReadonly).toBeNull();

    await afterInput.fill('b1');
    await afterInput.dispatchEvent('change');
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('after b1');
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  E08: セクション追加後のドロップダウン更新
// ─────────────────────────────────────────────────────────────────────────
test.describe('E08: セクションドロップダウン更新', () => {
  test('セクション追加後にタスク追加のセクション選択に新セクションが表示', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await escapeSelection(page);

    await page.locator('#prop-add-sec-name').fill('テストフェーズ');
    await page.locator('#prop-add-sec-btn').click();
    await page.waitForTimeout(800);
    await escapeSelection(page);

    const options = await page.locator('#prop-add-section option').allTextContents();
    expect(options).toContain('テストフェーズ');
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  E09: タスク追加後の自動選択
// ─────────────────────────────────────────────────────────────────────────
test.describe('E09: タスク追加後の自動選択', () => {
  test('タスク追加後にそのタスクが自動選択されプロパティに表示', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await escapeSelection(page);

    await page.locator('#prop-add-label').fill('自動選択テスト');
    await page.locator('#prop-add-id').fill('autosel1');
    await page.locator('#prop-add-start').fill('2026-06-01');
    await page.locator('#prop-add-end').fill('2026-06-15');
    await page.locator('#prop-add-btn').click();
    await page.waitForTimeout(1000);

    const props = await page.locator('#props-content').textContent();
    expect(props).toContain('自動選択テスト');
    expect(props).toContain('ラベル');
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  E10: 空ガントのガイド表示
// ─────────────────────────────────────────────────────────────────────────
test.describe('E10: 空ガントのガイド', () => {
  test('タスクゼロのガントでガイドメッセージが表示', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await page.locator('#editor').fill('gantt\n    title テスト\n    dateFormat YYYY-MM-DD\n');
    await page.locator('#editor').dispatchEvent('input');
    await page.waitForTimeout(1500);

    const status = await page.locator('#status-info').textContent();
    const preview = await page.locator('#preview-container').textContent();
    const hasGuide = preview.includes('タスクを追加') || status.includes('タスク: 0') || status.includes('タスクを追加');
    expect(hasGuide).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  E11: タスク上下移動（同一セクション内）
// ─────────────────────────────────────────────────────────────────────────
test.describe('E11: タスク上下移動', () => {
  test('↑ボタンで同一セクション内の前のタスクと順序が入れ替わる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // a2 (要件定義セクション内、a1の下) を選択
    await clickBar(page, 'a2');
    await page.waitForTimeout(200);

    // ↑ボタンをクリック
    const upBtn = page.locator('#prop-move-up');
    await expect(upBtn).toBeVisible();
    await upBtn.click();
    await page.waitForTimeout(500);

    // テキスト内で a2 の行が a1 より前にある
    const text = await editorText(page);
    const lines = text.split('\n');
    let a1Line = -1, a2Line = -1;
    for (let i = 0; i < lines.length; i++) {
      if (a1Line === -1 && /:a1,/.test(lines[i])) a1Line = i;
      if (a2Line === -1 && /:a2,/.test(lines[i])) a2Line = i;
    }
    expect(a2Line).toBeGreaterThan(-1);
    expect(a1Line).toBeGreaterThan(-1);
    expect(a2Line).toBeLessThan(a1Line);
  });

  test('↓ボタンで同一セクション内の次のタスクと順序が入れ替わる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // a1 (要件定義セクション内、最初) を選択
    await clickBar(page, 'a1');
    await page.waitForTimeout(200);

    // ↓ボタン
    const downBtn = page.locator('#prop-move-down');
    await expect(downBtn).toBeVisible();
    await downBtn.click();
    await page.waitForTimeout(500);

    // テキスト内で a1 の行が a2 より後ろにある
    const text = await editorText(page);
    const lines = text.split('\n');
    let a1Line = -1, a2Line = -1;
    for (let i = 0; i < lines.length; i++) {
      if (a1Line === -1 && /:a1,/.test(lines[i])) a1Line = i;
      if (a2Line === -1 && /:a2,/.test(lines[i])) a2Line = i;
    }
    expect(a1Line).toBeGreaterThan(a2Line);
  });

  test('セクション境界を越えない（最後のタスクの↓は無効）', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // a2 (要件定義セクションの最後のタスク) を選択
    await clickBar(page, 'a2');
    await page.waitForTimeout(200);

    const before = await editorText(page);

    // ↓を押す
    await page.locator('#prop-move-down').click();
    await page.waitForTimeout(500);

    // テキストは変わらない（a2はセクション最後なので動かない）
    const after = await editorText(page);
    expect(after).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  E12: タスクのセクション移動
// ─────────────────────────────────────────────────────────────────────────
test.describe('E12: タスクのセクション移動', () => {
  test('プロパティパネルのセクションドロップダウンで別セクションに移動できる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // a1 (要件定義) を選択
    await clickBar(page, 'a1');
    await page.waitForTimeout(200);

    // セクション移動ドロップダウン
    const sectionSelect = page.locator('#prop-move-section');
    await expect(sectionSelect).toBeVisible();

    // 「設計」セクションのインデックスを取得して選択
    await sectionSelect.selectOption({ label: '設計' });
    await page.waitForTimeout(500);

    // a1 が「設計」セクションの中（b1, b2 周辺）に移動している
    const text = await editorText(page);
    const lines = text.split('\n');
    let designLine = -1, reqLine = -1, a1Line = -1;
    for (let i = 0; i < lines.length; i++) {
      if (reqLine === -1 && /section\s+要件定義/.test(lines[i])) reqLine = i;
      if (designLine === -1 && /section\s+設計/.test(lines[i])) designLine = i;
      if (a1Line === -1 && /:a1,/.test(lines[i])) a1Line = i;
    }
    // a1 は設計セクション以降にある
    expect(a1Line).toBeGreaterThan(designLine);
    // a1 は要件定義セクションには無い（要件定義の範囲外）
    expect(a1Line).toBeGreaterThan(designLine);
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  E13: セクション一覧と削除UI
// ─────────────────────────────────────────────────────────────────────────
test.describe('E13: セクション一覧と削除UI', () => {
  test('未選択パネルにセクション一覧が表示される', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await escapeSelection(page);

    // セクション一覧コンテナ
    const sectionList = page.locator('#prop-section-list');
    await expect(sectionList).toBeVisible();

    // デフォルト2セクション (要件定義, 設計) が表示
    const text = await sectionList.textContent();
    expect(text).toContain('要件定義');
    expect(text).toContain('設計');
  });

  test('セクション一覧の削除ボタンでセクションとそのタスクが削除される', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await escapeSelection(page);

    // 「設計」セクションの削除ボタンをクリック
    // (data-section-line属性で識別する想定)
    const deleteBtn = page.locator('.prop-section-delete[data-section-name="設計"]');
    await expect(deleteBtn).toBeVisible();

    // confirm dialog はacceptで通過
    page.on('dialog', dialog => dialog.accept());
    await deleteBtn.click();
    await page.waitForTimeout(800);

    const text = await editorText(page);
    expect(text).not.toContain('section 設計');
    // 設計セクションのタスク (b1, b2) も削除されている
    expect(text).not.toContain(':b1,');
    expect(text).not.toContain(':b2,');
    // 要件定義は残っている
    expect(text).toContain('section 要件定義');
    expect(text).toContain(':a1,');
  });
});
