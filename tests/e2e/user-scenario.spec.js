// @ts-check
// ═══════════════════════════════════════════════════════════════════════════
//  ユーザーシナリオテスト — スケジュール管理者の観点
//  「プロジェクトのガントチャートを作成・編集・管理する人」として
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
  const bar = page.locator(`#overlay-layer .overlay-bar[data-task-id="${taskId}"]`);
  if (await bar.count() === 0) throw new Error(`bar ${taskId} not found in overlay`);
  await bar.click();
  await page.waitForTimeout(150);
}

async function escapeSelection(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
}

// ═══════════════════════════════════════════════════════════════════════════
//  シナリオ1: ゼロからスケジュールを作る
// ═══════════════════════════════════════════════════════════════════════════

test.describe('シナリオ1: 新規スケジュール作成', () => {
  test('空のガントから3セクション・6タスクのスケジュールを構築する', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // Step 1: エディタをクリアして最小限のガントから開始
    await page.locator('#editor').fill('gantt\n    title ECU開発スケジュール\n    dateFormat YYYY-MM-DD\n    axisFormat %m/%d\n');
    await page.locator('#editor').dispatchEvent('input');
    await page.waitForTimeout(1000);
    await escapeSelection(page);

    // Step 2: セクション「要件定義」を追加
    await page.locator('#prop-add-sec-name').fill('要件定義');
    await page.locator('#prop-add-sec-btn').click();
    await page.waitForTimeout(500);

    let text = await editorText(page);
    expect(text).toContain('section 要件定義');

    // Step 3: タスクを追加（要件定義フェーズ）
    await escapeSelection(page);
    await page.locator('#prop-add-label').fill('要件ヒアリング');
    await page.locator('#prop-add-id').fill('req1');
    await page.locator('#prop-add-start').fill('2026-04-01');
    await page.locator('#prop-add-end').fill('2026-04-14');
    await page.locator('#prop-add-btn').click();
    await page.waitForTimeout(500);

    text = await editorText(page);
    expect(text).toContain('要件ヒアリング');
    expect(text).toContain('req1');

    // Step 4: もう1つタスク追加
    await escapeSelection(page);
    await page.locator('#prop-add-label').fill('要件書レビュー');
    await page.locator('#prop-add-id').fill('req2');
    await page.locator('#prop-add-start').fill('2026-04-15');
    await page.locator('#prop-add-end').fill('2026-04-25');
    await page.locator('#prop-add-btn').click();
    await page.waitForTimeout(500);

    // Step 5: セクション「設計」を追加
    await escapeSelection(page);
    await page.locator('#prop-add-sec-name').fill('設計');
    await page.locator('#prop-add-sec-btn').click();
    await page.waitForTimeout(500);

    // Step 6: 設計タスク追加
    await escapeSelection(page);
    await page.locator('#prop-add-label').fill('アーキテクチャ設計');
    await page.locator('#prop-add-id').fill('des1');
    await page.locator('#prop-add-start').fill('2026-04-28');
    await page.locator('#prop-add-end').fill('2026-05-15');
    await page.locator('#prop-add-btn').click();
    await page.waitForTimeout(500);

    // Step 7: セクション「実装」を追加してタスク追加
    await escapeSelection(page);
    await page.locator('#prop-add-sec-name').fill('実装');
    await page.locator('#prop-add-sec-btn').click();
    await page.waitForTimeout(500);

    await escapeSelection(page);
    await page.locator('#prop-add-label').fill('コーディング');
    await page.locator('#prop-add-id').fill('impl1');
    await page.locator('#prop-add-start').fill('2026-05-18');
    await page.locator('#prop-add-end').fill('2026-06-30');
    await page.locator('#prop-add-btn').click();
    await page.waitForTimeout(500);

    await escapeSelection(page);
    await page.locator('#prop-add-label').fill('単体テスト');
    await page.locator('#prop-add-id').fill('impl2');
    await page.locator('#prop-add-start').fill('2026-06-01');
    await page.locator('#prop-add-end').fill('2026-07-10');
    await page.locator('#prop-add-btn').click();
    await page.waitForTimeout(500);

    // 最終確認: テキストに全要素が揃っている
    text = await editorText(page);
    expect(text).toContain('title ECU開発スケジュール');
    expect(text).toContain('section 要件定義');
    expect(text).toContain('section 設計');
    expect(text).toContain('section 実装');
    expect(text).toContain('要件ヒアリング');
    expect(text).toContain('要件書レビュー');
    expect(text).toContain('アーキテクチャ設計');
    expect(text).toContain('コーディング');
    expect(text).toContain('単体テスト');

    // SVGが描画されている
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  シナリオ2: スケジュール遅延の反映
// ═══════════════════════════════════════════════════════════════════════════

test.describe('シナリオ2: スケジュール遅延の反映', () => {
  test('タスクをドラッグして1週間後ろにずらす', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // a1 の元の日付を確認
    let text = await editorText(page);
    expect(text).toContain(':a1, 2026-04-01, 2026-04-15');

    // a1 バーをドラッグで右にずらす
    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const box = await bar.boundingBox();
    if (!box) throw new Error('bar a1 not found');

    // ドラッグ（右方向にある程度の距離）
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(800);

    // 日付が変わったことを確認
    text = await editorText(page);
    const match = text.match(/:a1,\s*(\d{4}-\d{2}-\d{2}),\s*(\d{4}-\d{2}-\d{2})/);
    expect(match).toBeTruthy();
    // 開始日が2026-04-01より後
    expect(new Date(match[1]).getTime()).toBeGreaterThan(new Date('2026-04-01').getTime());
    // 期間（日数）は概ね維持されている（±2日の誤差許容）
    const origDuration = 14;
    const newDuration = (new Date(match[2]) - new Date(match[1])) / (1000 * 60 * 60 * 24);
    expect(Math.abs(newDuration - origDuration)).toBeLessThanOrEqual(2);
  });

  test('タスクの終了日を延長する（右ハンドル）', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const handle = page.locator('#overlay-layer .resize-handle[data-task-id="a1"][data-handle="right"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('right handle not found');

    await page.mouse.move(box.x + 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(800);

    const text = await editorText(page);
    const match = text.match(/:a1,\s*2026-04-01,\s*(\d{4}-\d{2}-\d{2})/);
    expect(match).toBeTruthy();
    // 終了日が元の4/15より後
    expect(new Date(match[1]).getTime()).toBeGreaterThan(new Date('2026-04-15').getTime());
  });

  test('遅延したタスクにcritステータスを付けて目立たせる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    await page.locator('.prop-status-btn[data-status="crit"]').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toMatch(/:crit,\s*a1/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  シナリオ3: 完了タスクのマーク
// ═══════════════════════════════════════════════════════════════════════════

test.describe('シナリオ3: 完了タスクのマーク', () => {
  test('タスクをdoneに設定し、テキストに反映される', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    await page.locator('.prop-status-btn[data-status="done"]').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toMatch(/:done,\s*a1/);
  });

  test('doneを解除してnoneに戻す', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // まずdoneに設定
    await clickBar(page, 'a1');
    await page.locator('.prop-status-btn[data-status="done"]').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('done');

    // noneに戻す
    await page.locator('.prop-status-btn[data-status=""]').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).not.toContain('done');
    expect(text).toContain(':a1,');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  シナリオ4: マイルストーン設定
// ═══════════════════════════════════════════════════════════════════════════

test.describe('シナリオ4: マイルストーン', () => {
  test('タスクをmilestoneに変更しテキストに反映', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    await page.locator('.prop-status-btn[data-status="milestone"]').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('milestone');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  シナリオ5: 間違えた操作の取り消し
// ═══════════════════════════════════════════════════════════════════════════

test.describe('シナリオ5: 操作ミスのリカバリ', () => {
  test('タスクを誤って削除 → Undoで復元', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const before = await editorText(page);
    expect(before).toContain(':a1,');

    // 削除
    await clickBar(page, 'a1');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    expect(await editorText(page)).not.toContain(':a1,');

    // Undo
    await page.locator('#btn-undo').click();
    await page.waitForTimeout(500);

    const after = await editorText(page);
    expect(after).toContain(':a1,');
  });

  test('ドラッグで日付を変えすぎた → Undoで元に戻す', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const before = await editorText(page);

    // 大きくドラッグ
    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const box = await bar.boundingBox();
    if (!box) throw new Error('bar not found');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(600);

    expect(await editorText(page)).not.toBe(before);

    // Undo
    await page.locator('#btn-undo').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toBe(before);
  });

  test('複数回のUndoで連続操作を巻き戻す', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const original = await editorText(page);

    // 操作1: ステータス変更
    await clickBar(page, 'a1');
    await page.locator('.prop-status-btn[data-status="crit"]').click();
    await page.waitForTimeout(300);

    // 操作2: 別タスク削除
    await clickBar(page, 'b1');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // Undo 2回
    await page.locator('#btn-undo').click();
    await page.waitForTimeout(300);
    await page.locator('#btn-undo').click();
    await page.waitForTimeout(300);

    expect(await editorText(page)).toBe(original);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  シナリオ6: スケジュールの再編成
// ═══════════════════════════════════════════════════════════════════════════

test.describe('シナリオ6: スケジュール再編成', () => {
  test('不要なタスクを一括削除', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // a1 と b1 を複数選択
    await clickBar(page, 'a1');
    await page.keyboard.down('Shift');
    await clickBar(page, 'b1');
    await page.keyboard.up('Shift');
    await page.waitForTimeout(100);

    // 一括削除
    await page.locator('#batch-delete-btn').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).not.toContain(':a1,');
    expect(text).not.toContain(':b1,');
    // 他のタスクは残っている
    expect(text).toContain('gantt');
  });

  test('タスクをコピーして別の日程にペースト', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const before = await editorText(page);

    await clickBar(page, 'a1');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(800);

    const after = await editorText(page);
    // 元のa1がある
    expect(after).toContain(':a1,');
    // コピーされた新タスク（t prefix）がある
    expect(after).toContain('要件分析');
    // テキスト行数が増えている
    expect(after.split('\n').length).toBeGreaterThan(before.split('\n').length);
  });

  test('タスク名をプロパティパネルで変更', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    await clickBar(page, 'a1');
    const labelInput = page.locator('#prop-label');
    await labelInput.fill('要件分析（改訂版）');
    await labelInput.press('Enter');
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('要件分析（改訂版）');
    expect(text).not.toMatch(/^\s*要件分析\s+:/m);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  シナリオ7: グローバル設定の変更
// ═══════════════════════════════════════════════════════════════════════════

test.describe('シナリオ7: チャート設定の変更', () => {
  test('タイトルを変更する', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await escapeSelection(page);

    await page.locator('#prop-global-title').fill('AUTOSAR ECU v2.0');
    await page.locator('#prop-global-title').dispatchEvent('change');
    await page.waitForTimeout(500);

    expect(await editorText(page)).toContain('title AUTOSAR ECU v2.0');
  });

  test('axisFormatを変更して日付表示を変える', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await escapeSelection(page);

    await page.locator('#prop-axisformat-preset').selectOption('%Y/%m/%d');
    await page.waitForTimeout(500);

    expect(await editorText(page)).toContain('axisFormat %Y/%m/%d');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  シナリオ8: 表示の調整
// ═══════════════════════════════════════════════════════════════════════════

test.describe('シナリオ8: 表示の調整', () => {
  test('ズームアウトして全体を俯瞰 → ズームインして詳細確認', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // Fitで全体表示
    await page.locator('#btn-zoom-fit').click();
    const fitZoom = parseInt(await page.locator('#zoom-display').textContent());

    // ズームイン5回
    for (let i = 0; i < 5; i++) {
      await page.locator('#btn-zoom-in').click();
    }
    const zoomedIn = parseInt(await page.locator('#zoom-display').textContent());
    expect(zoomedIn).toBeGreaterThan(fitZoom);

    // SVGがまだ見えている
    await expect(page.locator('#preview-svg svg')).toBeVisible();

    // Fitに戻る
    await page.locator('#btn-zoom-fit').click();
    const backToFit = parseInt(await page.locator('#zoom-display').textContent());
    expect(backToFit).toBe(fitZoom);
  });

  test('ペインリサイザーでプロパティパネルを広げる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const propsPane = page.locator('#props-pane');
    const wBefore = (await propsPane.boundingBox()).width;

    const resizer = page.locator('#resizer-right');
    const rBox = await resizer.boundingBox();
    await page.mouse.move(rBox.x + 2, rBox.y + rBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(rBox.x - 100, rBox.y + rBox.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const wAfter = (await propsPane.boundingBox()).width;
    expect(wAfter).toBeGreaterThan(wBefore + 50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  シナリオ9: セクション管理
// ═══════════════════════════════════════════════════════════════════════════

test.describe('シナリオ9: セクション管理', () => {
  test('新しいセクションを追加して表示を確認', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await escapeSelection(page);

    await page.locator('#prop-add-sec-name').fill('結合テスト');
    await page.locator('#prop-add-sec-btn').click();
    await page.waitForTimeout(800);

    const text = await editorText(page);
    expect(text).toContain('section 結合テスト');

    // SVGに反映されている（エラーなく描画）
    await expect(page.locator('#preview-svg svg')).toBeVisible();
    const status = await page.locator('#status-parse').textContent();
    expect(status).toContain('OK');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  シナリオ10: エディタ直接編集との連携
// ═══════════════════════════════════════════════════════════════════════════

test.describe('シナリオ10: テキスト直接編集', () => {
  test('エディタで直接タスクを追加し、プレビューとオーバーレイに反映される', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // エディタのテキスト末尾に新タスクを追記
    const text = await editorText(page);
    const newText = text + '\n    直接追加タスク :direct1, 2026-07-01, 2026-07-15\n';
    await page.locator('#editor').fill(newText);
    await page.locator('#editor').dispatchEvent('input');
    await page.waitForTimeout(1500);

    // SVGが再描画されている
    await expect(page.locator('#preview-svg svg')).toBeVisible();

    // オーバーレイにdirect1がある
    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="direct1"]');
    const count = await bar.count();
    expect(count).toBe(1);
  });
});
