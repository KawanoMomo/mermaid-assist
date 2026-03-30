// @ts-check
// ═══════════════════════════════════════════════════════════════════════════
//  MermaidAssist 設計仕様書準拠テスト
//  Based on: docs/superpowers/specs/2026-03-30-mermaid-assist-design.md
// ═══════════════════════════════════════════════════════════════════════════
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
  await page.waitForTimeout(100);
}

async function propsText(page) {
  return page.locator('#props-content').textContent();
}

// ═══════════════════════════════════════════════════════════════════════════
//  仕様 2.1: データフロー — Mermaidテキストがソースオブトゥルース
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Spec 2.1: ソースオブトゥルース', () => {
  test('エディタのテキスト変更がプレビューに反映される', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // Replace editor content with minimal gantt
    await page.locator('#editor').fill('gantt\n    title Test\n    section S\n    Only Task :x1, 2026-01-01, 2026-01-10\n');
    // Trigger input event since fill() may not fire it
    await page.locator('#editor').dispatchEvent('input');
    await page.waitForTimeout(1500);

    // SVG should re-render with new content
    const svg = page.locator('#preview-svg svg');
    await expect(svg).toBeVisible();

    // Verify the title changed in the rendered SVG
    const svgText = await page.locator('#preview-svg svg').innerHTML();
    expect(svgText).toContain('Test');
  });

  test('GUI操作（ステータス変更）がエディタテキストに書き戻される', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    await page.locator('.prop-status-btn[data-status="crit"]').click();
    await page.waitForTimeout(300);

    const text = await editorText(page);
    expect(text).toContain('crit');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  仕様 3.5: GUI操作→テキスト更新 (6操作)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Spec 3.5: GUI操作→テキスト更新', () => {
  test('バー全体ドラッグ: 開始日・終了日が同時変更', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const before = await editorText(page);
    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const box = await bar.boundingBox();
    if (!box) throw new Error('bar a1 not found');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(600);

    const after = await editorText(page);
    expect(after).not.toBe(before);
    // a1 line should still have two dates
    const match = after.match(/:a1,\s*(\d{4}-\d{2}-\d{2}),\s*(\d{4}-\d{2}-\d{2})/);
    expect(match).toBeTruthy();
    // Both dates should have shifted from original 2026-04-01, 2026-04-15
    expect(match[1]).not.toBe('2026-04-01');
    expect(match[2]).not.toBe('2026-04-15');
  });

  test('バー左端ドラッグ: 開始日のみ変更、終了日は不変', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const handle = page.locator('#overlay-layer .resize-handle[data-task-id="a1"][data-handle="left"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('left handle not found');

    await page.mouse.move(box.x + 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 30, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(600);

    const text = await editorText(page);
    const match = text.match(/:a1,\s*(\d{4}-\d{2}-\d{2}),\s*(\d{4}-\d{2}-\d{2})/);
    expect(match).toBeTruthy();
    expect(match[1]).not.toBe('2026-04-01'); // start changed
    expect(match[2]).toBe('2026-04-15');     // end unchanged
  });

  test('バー右端ドラッグ: 終了日のみ変更、開始日は不変', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const handle = page.locator('#overlay-layer .resize-handle[data-task-id="a1"][data-handle="right"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('right handle not found');

    await page.mouse.move(box.x + 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(600);

    const text = await editorText(page);
    const match = text.match(/:a1,\s*(\d{4}-\d{2}-\d{2}),\s*(\d{4}-\d{2}-\d{2})/);
    expect(match).toBeTruthy();
    expect(match[1]).toBe('2026-04-01');     // start unchanged
    expect(match[2]).not.toBe('2026-04-15'); // end changed
  });

  test('プロパティパネルでラベル変更', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    await page.locator('#prop-label').fill('変更後ラベル');
    await page.locator('#prop-label').press('Enter');
    await page.waitForTimeout(300);

    const text = await editorText(page);
    expect(text).toContain('変更後ラベル');
  });

  test('タスク追加ボタン: セクション末尾に追加', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    const before = await editorText(page);
    const taskCountBefore = (before.match(/:\w+,/g) || []).length;

    await page.locator('#prop-add-label').fill('追加タスク');
    await page.locator('#prop-add-id').fill('add1');
    await page.locator('#prop-add-start').fill('2026-07-01');
    await page.locator('#prop-add-end').fill('2026-07-15');
    await page.locator('#prop-add-btn').click();
    await page.waitForTimeout(300);

    const after = await editorText(page);
    expect(after).toContain('追加タスク');
    expect(after).toContain('add1');
  });

  test('タスク削除: 該当行が削除される', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    await page.locator('#prop-delete-btn').click();
    await page.waitForTimeout(300);

    const text = await editorText(page);
    expect(text).not.toContain(':a1,');
    expect(text).toContain('gantt'); // rest of file preserved
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  仕様 3.5追加: 日付は YYYY-MM-DD, YYYY-MM-DD 形式で書き戻し
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Spec 3.5: 書き込み時正規化 (ADR-006)', () => {
  test('ドラッグ後の日付がYYYY-MM-DD形式で書き戻される', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const box = await bar.boundingBox();
    if (!box) throw new Error('bar not found');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(600);

    const text = await editorText(page);
    // a1 should have explicit date format
    const match = text.match(/:a1,\s*(\d{4}-\d{2}-\d{2}),\s*(\d{4}-\d{2}-\d{2})/);
    expect(match).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  仕様 4.1: 画面レイアウト (3ペイン)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Spec 4.1: 画面レイアウト', () => {
  test('3ペイン構成: editor, preview, properties が表示されている', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await expect(page.locator('#editor-pane')).toBeVisible();
    await expect(page.locator('#preview-pane')).toBeVisible();
    await expect(page.locator('#props-pane')).toBeVisible();
  });

  test('ツールバーが表示されている', async ({ page }) => {
    await page.goto(HTML_URL);
    await expect(page.locator('#toolbar')).toBeVisible();
    await expect(page.locator('#btn-open')).toBeVisible();
    await expect(page.locator('#btn-save')).toBeVisible();
    await expect(page.locator('#btn-undo')).toBeVisible();
    await expect(page.locator('#btn-redo')).toBeVisible();
    await expect(page.locator('#btn-zoom-in')).toBeVisible();
    await expect(page.locator('#btn-zoom-out')).toBeVisible();
    await expect(page.locator('#btn-export')).toBeVisible();
  });

  test('ステータスバーにタスク数・セクション数・期間が表示される', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const status = await page.locator('#status-info').textContent();
    expect(status).toContain('タスク');
    expect(status).toContain('セクション');
  });

  test('ペインリサイザーでエディタ幅を変更できる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const resizer = page.locator('#resizer-left');
    const editorPane = page.locator('#editor-pane');
    const wBefore = (await editorPane.boundingBox()).width;

    const rBox = await resizer.boundingBox();
    await page.mouse.move(rBox.x + 2, rBox.y + rBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(rBox.x + 100, rBox.y + rBox.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const wAfter = (await editorPane.boundingBox()).width;
    expect(wAfter).toBeGreaterThan(wBefore + 50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  仕様 4.2: プロパティパネル 4状態
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Spec 4.2: プロパティパネル状態遷移', () => {
  test('未選択: タスク追加フォーム + セクション追加 + グローバル設定', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    const props = await propsText(page);
    expect(props).toContain('タスク追加');       // task add
    expect(props).toContain('セクション追加');   // section add
    expect(props).toContain('グローバル設定');   // global settings
  });

  test('タスク1件選択: 全フィールド表示', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    const props = await propsText(page);
    expect(props).toContain('ラベル');
    expect(props).toContain('ID');
    expect(props).toContain('開始日');
    expect(props).toContain('終了日');
    expect(props).toContain('ステータス');
    // Status buttons: none, done, active, crit, milestone
    await expect(page.locator('.prop-status-btn[data-status="crit"]')).toBeVisible();
    await expect(page.locator('.prop-status-btn[data-status="milestone"]')).toBeVisible();
    // Delete button
    await expect(page.locator('#prop-delete-btn')).toBeVisible();
  });

  test('タスク複数選択: 一括操作', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    await page.keyboard.down('Shift');
    await clickBar(page, 'b1');
    await page.keyboard.up('Shift');

    const props = await propsText(page);
    expect(props).toContain('選択中');
    // Batch operations
    await expect(page.locator('#batch-delete-btn')).toBeVisible();
  });

  // Note: セクション選択はオーバーレイからの選択パスがないため、テキストベースで検証
});

// ═══════════════════════════════════════════════════════════════════════════
//  仕様 4.3: キーボードショートカット
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Spec 4.3: キーボードショートカット', () => {
  test('Ctrl+Z / Ctrl+Y: Undo / Redo', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const original = await editorText(page);
    await clickBar(page, 'a1');
    await page.locator('#prop-delete-btn').click();
    await page.waitForTimeout(300);

    expect(await editorText(page)).not.toContain(':a1,');

    // Undo via keyboard (click preview first to unfocus editor)
    await page.locator('#preview-container').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);

    expect(await editorText(page)).toContain(':a1,');

    // Redo
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(300);
    expect(await editorText(page)).not.toContain(':a1,');
  });

  test('Delete: 選択タスク削除', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    expect(await editorText(page)).not.toContain(':a1,');
  });

  test('Escape: 選択解除', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    expect(await propsText(page)).toContain('ラベル');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    expect(await propsText(page)).toContain('タスク追加');
  });

  test('Ctrl+A: 全タスク選択', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // Focus preview area (not editor)
    await page.locator('#preview-container').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(100);

    const props = await propsText(page);
    expect(props).toContain('選択中');
  });

  test('Ctrl+C / Ctrl+V: コピー＆ペースト', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const before = await editorText(page);
    const taskCount = (before.match(/:[\w]+,\s*\d{4}/g) || []).length;

    await clickBar(page, 'a1');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(600);

    const after = await editorText(page);
    // Should have one more task than before
    const newCount = (after.match(/:[\w_]+,\s*\d{4}/g) || []).length;
    expect(newCount).toBeGreaterThan(taskCount);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  仕様 4.4: ズーム & スクロール
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Spec 4.4: ズーム', () => {
  test('ズームイン/アウトボタン', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const initial = parseInt(await page.locator('#zoom-display').textContent());
    await page.locator('#btn-zoom-in').click();
    const after = parseInt(await page.locator('#zoom-display').textContent());
    expect(after).toBeGreaterThan(initial);
  });

  test('Fitボタンでコンテナ幅にフィット', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // Zoom in a lot first
    for (let i = 0; i < 5; i++) await page.locator('#btn-zoom-in').click();
    const zoomed = parseInt(await page.locator('#zoom-display').textContent());

    await page.locator('#btn-zoom-fit').click();
    const fit = parseInt(await page.locator('#zoom-display').textContent());
    expect(fit).toBeLessThan(zoomed);
  });

  test('Ctrl+ホイールでズーム', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const initial = parseInt(await page.locator('#zoom-display').textContent());
    await page.locator('#preview-container').dispatchEvent('wheel', {
      deltaY: -100, ctrlKey: true,
    });
    await page.waitForTimeout(100);
    const after = parseInt(await page.locator('#zoom-display').textContent());
    expect(after).toBeGreaterThan(initial);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  仕様 5: Undo/Redo (max 80)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Spec 5: Undo/Redo', () => {
  test('Undoボタンで直前の操作を取り消し', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    await page.locator('.prop-status-btn[data-status="done"]').click();
    await page.waitForTimeout(300);
    expect(await editorText(page)).toContain('done');

    await page.locator('#btn-undo').click();
    await page.waitForTimeout(300);
    expect(await editorText(page)).not.toContain('done');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  仕様追加: セクション管理
// ═══════════════════════════════════════════════════════════════════════════

test.describe('セクション管理', () => {
  test('セクション追加', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    await page.locator('#prop-add-sec-name').fill('新セクション');
    await page.locator('#prop-add-sec-btn').click();
    await page.waitForTimeout(300);

    expect(await editorText(page)).toContain('section 新セクション');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  仕様追加: グローバル設定
// ═══════════════════════════════════════════════════════════════════════════

test.describe('グローバル設定', () => {
  test('title変更がテキストに反映', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    await page.locator('#prop-global-title').fill('新タイトル');
    await page.locator('#prop-global-title').dispatchEvent('change');
    await page.waitForTimeout(300);

    expect(await editorText(page)).toContain('title 新タイトル');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  仕様追加: milestone ステータス
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Milestone', () => {
  test('milestoneステータスをGUIで設定できる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    await page.locator('.prop-status-btn[data-status="milestone"]').click();
    await page.waitForTimeout(300);

    expect(await editorText(page)).toContain('milestone');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  ドラッグの健全性チェック
// ═══════════════════════════════════════════════════════════════════════════

test.describe('ドラッグ健全性', () => {
  test('ドラッグでstart > endにならない (左ハンドル)', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const handle = page.locator('#overlay-layer .resize-handle[data-task-id="a1"][data-handle="left"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('handle not found');

    // Drag far to the right (past end)
    await page.mouse.move(box.x + 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 500, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(600);

    const text = await editorText(page);
    const match = text.match(/:a1,\s*(\d{4}-\d{2}-\d{2}),\s*(\d{4}-\d{2}-\d{2})/);
    if (match) {
      expect(new Date(match[2]).getTime()).toBeGreaterThanOrEqual(new Date(match[1]).getTime());
    }
  });

  test('ドラッグでstart > endにならない (右ハンドル)', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const handle = page.locator('#overlay-layer .resize-handle[data-task-id="a1"][data-handle="right"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('handle not found');

    // Drag far to the left (past start)
    await page.mouse.move(box.x + 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 500, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(600);

    const text = await editorText(page);
    const match = text.match(/:a1,\s*(\d{4}-\d{2}-\d{2}),\s*(\d{4}-\d{2}-\d{2})/);
    if (match) {
      expect(new Date(match[2]).getTime()).toBeGreaterThanOrEqual(new Date(match[1]).getTime());
    }
  });

  test('他のタスクのテキストが変更されない', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const before = await editorText(page);
    const b1Match = before.match(/:b1,\s*([^\n]+)/);
    const b1Before = b1Match ? b1Match[1] : '';

    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const box = await bar.boundingBox();
    if (!box) throw new Error('bar not found');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(600);

    const after = await editorText(page);
    const b1MatchAfter = after.match(/:b1,\s*([^\n]+)/);
    const b1After = b1MatchAfter ? b1MatchAfter[1] : '';
    expect(b1After).toBe(b1Before);
  });

  test('ブラウザコンソールにnegative widthエラーがない', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('negative')) {
        errors.push(msg.text());
      }
    });

    await page.goto(HTML_URL);
    await waitForRender(page);

    // Resize left handle far right
    const handle = page.locator('#overlay-layer .resize-handle[data-task-id="a1"][data-handle="left"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('handle not found');

    await page.mouse.move(box.x + 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);

    const negErrors = errors.filter(e => e.includes('negative') || e.includes('Negative'));
    expect(negErrors).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  エクスポート (仕様 7) — ダウンロードはヘッドレスで検証困難なため機能存在チェック
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Spec 7: エクスポート', () => {
  test('Exportメニューに全形式が存在する', async ({ page }) => {
    await page.goto(HTML_URL);
    await page.locator('#btn-export').click();
    await expect(page.locator('#exp-svg')).toBeVisible();
    await expect(page.locator('#exp-png')).toBeVisible();
    await expect(page.locator('#exp-png-transparent')).toBeVisible();
    await expect(page.locator('#exp-clipboard')).toBeVisible();
  });
});
