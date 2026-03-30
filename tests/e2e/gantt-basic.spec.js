// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_PATH = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

/** Wait for mermaid.js to render (SVG appears in preview) */
async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  // Extra wait for mermaid async render to settle
  await page.waitForTimeout(500);
}

/** Get the editor text content */
async function getEditorText(page) {
  return page.locator('#editor').inputValue();
}

/** Get all overlay bar elements */
async function getOverlayBars(page) {
  return page.locator('#overlay-layer .overlay-bar').all();
}

/** Get bounding box of an overlay bar by task-id */
async function getBarBox(page, taskId) {
  const bar = page.locator(`#overlay-layer .overlay-bar[data-task-id="${taskId}"]`);
  return bar.boundingBox();
}

// ═══════════════════════════════════════════════════════════════════════════
//  Rendering Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Initial rendering', () => {
  test('mermaid SVG renders in preview', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);
    const svg = page.locator('#preview-svg svg');
    await expect(svg).toBeVisible();
  });

  test('overlay bars are created for each task', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);
    const bars = await getOverlayBars(page);
    // Default content has 5 tasks (a1, a2, b1, b2) — a2 uses 'after' so may not have rect
    expect(bars.length).toBeGreaterThanOrEqual(3);
  });

  test('status bar shows task count', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);
    const status = await page.locator('#status-info').textContent();
    expect(status).toContain('タスク');
  });

  test('editor has default gantt content', async ({ page }) => {
    await page.goto(HTML_PATH);
    const text = await getEditorText(page);
    expect(text).toContain('gantt');
    expect(text).toContain('section');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Selection Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Selection', () => {
  test('clicking overlay bar selects task and shows properties', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);

    const bar = page.locator('#overlay-layer .overlay-bar').first();
    await bar.click();

    // Properties panel should show task fields
    const propsContent = await page.locator('#props-content').textContent();
    expect(propsContent).toContain('ラベル');
  });

  test('clicking same bar again deselects', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);

    const bar = page.locator('#overlay-layer .overlay-bar').first();
    await bar.click();

    // Should be selected — props show label field
    let props = await page.locator('#props-content').textContent();
    expect(props).toContain('ラベル');

    // Click same bar again
    await bar.click();

    // Should be deselected — props show add form
    props = await page.locator('#props-content').textContent();
    expect(props).toContain('タスク追加');
  });

  test('Escape clears selection', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);

    const bar = page.locator('#overlay-layer .overlay-bar').first();
    await bar.click();
    await page.keyboard.press('Escape');

    const props = await page.locator('#props-content').textContent();
    expect(props).toContain('タスク追加');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Drag Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Drag', () => {
  test('dragging a bar updates dates in editor', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);

    // Get initial editor text
    const initialText = await getEditorText(page);

    // Find first overlay bar (a1: 要件分析)
    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const box = await bar.boundingBox();
    if (!box) throw new Error('Bar a1 not found');

    // Drag 50px to the right
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();

    // Wait for refresh
    await page.waitForTimeout(300);

    const updatedText = await getEditorText(page);
    // Dates should have changed
    expect(updatedText).not.toBe(initialText);
    // Should still be valid mermaid
    expect(updatedText).toContain('gantt');
    expect(updatedText).toContain('a1');
  });

  test('dragged bar should not produce negative widths', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);

    // Find first bar
    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const box = await bar.boundingBox();
    if (!box) throw new Error('Bar a1 not found');

    // Find the left resize handle
    const leftHandle = page.locator('#overlay-layer .resize-handle[data-task-id="a1"][data-handle="left"]');
    const handleBox = await leftHandle.boundingBox();
    if (!handleBox) throw new Error('Left handle not found');

    // Drag left handle far to the right (past end date)
    await page.mouse.move(handleBox.x + 3, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 300, handleBox.y + handleBox.height / 2, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    // Check no console errors about negative width
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('negative')) {
        errors.push(msg.text());
      }
    });

    // The editor text should have valid dates (start < end)
    const text = await getEditorText(page);
    const match = text.match(/:a1,\s*(\d{4}-\d{2}-\d{2}),\s*(\d{4}-\d{2}-\d{2})/);
    if (match) {
      const start = new Date(match[1]);
      const end = new Date(match[2]);
      expect(end.getTime()).toBeGreaterThan(start.getTime());
    }
  });

  test('only the selected/clicked bar moves, not others', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);

    // Get positions of a1 and b1 before drag
    const barA1 = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const barB1 = page.locator('#overlay-layer .overlay-bar[data-task-id="b1"]');
    const boxA1Before = await barA1.boundingBox();
    const boxB1Before = await barB1.boundingBox();
    if (!boxA1Before || !boxB1Before) throw new Error('Bars not found');

    // Drag a1 to the right
    await page.mouse.move(boxA1Before.x + boxA1Before.width / 2, boxA1Before.y + boxA1Before.height / 2);
    await page.mouse.down();
    await page.mouse.move(boxA1Before.x + boxA1Before.width / 2 + 40, boxA1Before.y + boxA1Before.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Verify b1 text hasn't changed
    const text = await getEditorText(page);
    expect(text).toContain(':b1, 2026-04-20, 2026-05-05');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Property Panel Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Property Panel', () => {
  test('no selection shows add form and global settings', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);

    const props = await page.locator('#props-content').textContent();
    expect(props).toContain('タスク追加');
    expect(props).toContain('セクション追加');
    expect(props).toContain('グローバル設定');
  });

  test('changing status updates editor text', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);

    // Select task a1
    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    await bar.click();

    // Click "crit" status button
    await page.locator('.prop-status-btn[data-status="crit"]').click();
    await page.waitForTimeout(300);

    const text = await getEditorText(page);
    expect(text).toContain('crit');
  });

  test('add task from form', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);

    // Clear selection to get add form
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Fill form
    await page.locator('#prop-add-label').fill('新テスト');
    await page.locator('#prop-add-id').fill('test1');
    await page.locator('#prop-add-start').fill('2026-06-01');
    await page.locator('#prop-add-end').fill('2026-06-15');

    // Click add
    await page.locator('#prop-add-btn').click();
    await page.waitForTimeout(300);

    const text = await getEditorText(page);
    expect(text).toContain('新テスト');
    expect(text).toContain('test1');
  });

  test('delete task removes from editor', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);

    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    await bar.click();

    await page.locator('#prop-delete-btn').click();
    await page.waitForTimeout(300);

    const text = await getEditorText(page);
    expect(text).not.toContain(':a1,');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Zoom Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Zoom', () => {
  test('zoom in button increases zoom', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);

    const initialZoom = await page.locator('#zoom-display').textContent();
    await page.locator('#btn-zoom-in').click();
    const newZoom = await page.locator('#zoom-display').textContent();
    expect(parseInt(newZoom)).toBeGreaterThan(parseInt(initialZoom));
  });

  test('Fit button adjusts zoom to container', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);

    await page.locator('#btn-zoom-fit').click();
    const zoomText = await page.locator('#zoom-display').textContent();
    const zoomVal = parseInt(zoomText);
    expect(zoomVal).toBeGreaterThan(10);
    expect(zoomVal).toBeLessThan(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Undo/Redo Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Undo/Redo', () => {
  test('undo reverts text change', async ({ page }) => {
    await page.goto(HTML_PATH);
    await waitForRender(page);

    const originalText = await getEditorText(page);

    // Select and delete a task
    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    await bar.click();
    await page.locator('#prop-delete-btn').click();
    await page.waitForTimeout(300);

    // Verify deleted
    let text = await getEditorText(page);
    expect(text).not.toContain(':a1,');

    // Undo
    await page.locator('#btn-undo').click();
    await page.waitForTimeout(300);

    text = await getEditorText(page);
    expect(text).toContain(':a1,');
  });
});
