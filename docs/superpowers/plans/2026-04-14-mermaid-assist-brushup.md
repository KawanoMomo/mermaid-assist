# MermaidAssist ブラッシュアップ計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 実ユースケースベースの評価項目を定義し、Playwright実機検証で問題を可視化しながらバグ修正・UX改善を行う

**Architecture:** 評価テスト (evaluation spec) → 不合格項目を修正 → 再検証のループ。評価テストは既存テストとは別ファイルに作成し、ユーザー観点の品質基準を定義する

**Tech Stack:** Playwright (E2E評価), バニラJS (修正対象), Node.js (単体テスト)

**ベースライン:** ユニットテスト35件PASS, E2Eテスト71件PASS

---

## Sprint 1: 評価項目定義 + 初回評価

### Task 1: 実ユースケース評価テスト作成

**Files:**
- Create: `tests/e2e/brushup-evaluation.spec.js`

評価カテゴリと項目:

| # | カテゴリ | 評価項目 | 期待 |
|---|---------|---------|------|
| E01 | バグ | コピペで生成されるIDが`__new_`のままテキストに残らない | ペースト後のIDが`t{N}`形式 |
| E02 | バグ | ズーム下限が10%まで行ける（設計書は25%） | 最小25%で止まる |
| E03 | バグ | ズーム上限が500%まで行ける（設計書は300%） | 最大300%で止まる |
| E04 | UX | タスクバーにマウスホバーでハイライト表示 | opacity変化 or 枠線表示 |
| E05 | UX | ドラッグ中に日付ツールチップが表示される | ツールチップ要素が可視 |
| E06 | UX | ドラッグ中のバーが視覚的に区別できる | ドラッグ中バーに半透明エフェクト |
| E07 | UX | after依存をプロパティパネルで編集できる | `after`フィールドが入力可能 |
| E08 | 品質 | セクション追加時にプロパティパネルのセクションドロップダウンが即時更新 | 新セクションが選択肢に表示 |
| E09 | UX | タスク追加後に追加したタスクが自動選択される | プロパティパネルにそのタスク表示 |
| E10 | UX | 空のガントで「タスクを追加してください」的なガイドが表示 | プレビュー領域にガイド表示 |

- [ ] **Step 1: 評価テストファイルを作成**

```javascript
// tests/e2e/brushup-evaluation.spec.js
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
    // __new_ が含まれていないこと
    expect(text).not.toContain('__new_');
    // 代わりに t{数字} 形式のIDがあること
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

    // ズームアウトを20回クリック
    for (let i = 0; i < 20; i++) {
      await page.locator('#btn-zoom-out').click();
    }
    const zoom = parseInt(await page.locator('#zoom-display').textContent());
    expect(zoom).toBeGreaterThanOrEqual(25);
  });

  test('E03: ズーム上限は300%で止まる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // ズームインを30回クリック
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

    // ホバー前の状態を取得
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);

    // ホバー
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(200);

    // ホバー中のバーにhoverクラスまたはopacity変化がある
    const hasHoverEffect = await bar.evaluate(el => {
      const style = window.getComputedStyle(el);
      return el.getAttribute('fill') !== 'transparent'
        || style.opacity !== '1'
        || el.classList.contains('hovered');
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

    // ツールチップ要素が存在し可視
    const tooltip = page.locator('#drag-tooltip');
    await expect(tooltip).toBeVisible();
    // 日付情報が含まれている
    const text = await tooltip.textContent();
    expect(text).toMatch(/\d{4}-\d{2}-\d{2}/);

    await page.mouse.up();
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  E06: ドラッグ中のバー視覚エフェクト
// ─────────────────────────────────────────────────────────────────────────
test.describe('E06: ドラッグ中バーエフェクト', () => {
  test('ドラッグ中のバーが半透明になる', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="a1"]');
    const box = await bar.boundingBox();
    if (!box) throw new Error('bar not found');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2, { steps: 3 });
    await page.waitForTimeout(100);

    // ドラッグ中にバーが視覚的にアクティブ
    const hasEffect = await bar.evaluate(el => {
      return el.getAttribute('fill') !== 'transparent'
        || el.getAttribute('opacity') !== null;
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

    // a2 は after a1
    await clickBar(page, 'a2');
    await page.waitForTimeout(200);

    // after フィールドが編集可能（readonlyでない）
    const afterInput = page.locator('#prop-after');
    await expect(afterInput).toBeVisible();
    const isReadonly = await afterInput.getAttribute('readonly');
    expect(isReadonly).toBeNull();

    // 値を変更
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

    // セクション追加
    await page.locator('#prop-add-sec-name').fill('テストフェーズ');
    await page.locator('#prop-add-sec-btn').click();
    await page.waitForTimeout(800);
    await escapeSelection(page);

    // セクションドロップダウンに「テストフェーズ」が含まれる
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

    // プロパティパネルに追加したタスクの情報が表示
    const props = await page.locator('#props-content').textContent();
    expect(props).toContain('自動選択テスト');
    expect(props).toContain('ラベル'); // 個別選択画面
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  E10: 空ガントのガイド表示
// ─────────────────────────────────────────────────────────────────────────
test.describe('E10: 空ガントのガイド', () => {
  test('タスクゼロのガントでプレビューにガイドメッセージが表示', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);

    // エディタをタスクなしのganttに置換
    await page.locator('#editor').fill('gantt\n    title テスト\n    dateFormat YYYY-MM-DD\n');
    await page.locator('#editor').dispatchEvent('input');
    await page.waitForTimeout(1500);

    // ステータスバーにタスク0件 or ガイドが表示
    const status = await page.locator('#status-info').textContent();
    // タスクがないときの表示
    const preview = await page.locator('#preview-container').textContent();
    const hasGuide = preview.includes('タスクを追加') || status.includes('タスク: 0');
    expect(hasGuide).toBe(true);
  });
});
```

- [ ] **Step 2: 評価テストを実行して初回結果を確認**

Run: `cd E:/00_Git/05_MermaidAssist && npx playwright test tests/e2e/brushup-evaluation.spec.js --reporter=list`
Expected: 複数のFAIL（修正前なのでE01〜E10の大半が失敗する）

- [ ] **Step 3: 初回評価結果を記録**

FAILした項目を記録し、Sprint 2以降の修正対象を確定する。

---

## Sprint 2: バグ修正 (E01-E03)

### Task 2: コピペID修正 (E01)

**Files:**
- Modify: `mermaid-assist.html` (Ctrl+V ハンドラ、約L2190-2203)

- [ ] **Step 1: コピペ時のID生成を修正**

`__new_` → `t{addCounter}` に変更する。

```javascript
// mermaid-assist.html 内の Ctrl+V ハンドラ (約L2192)
// 変更前:
//   var newId = '__new_' + (++addCounter);
// 変更後:
      clipboard.forEach(function(t) {
        var newId = 't' + (++addCounter);
```

- [ ] **Step 2: テスト実行で確認**

Run: `npx playwright test tests/e2e/brushup-evaluation.spec.js -g "E01" --reporter=list`
Expected: PASS

- [ ] **Step 3: 既存テストが壊れていないか確認**

Run: `npx playwright test --reporter=list`
Expected: 全PASS（コピペテストのexpectが`__new_`を期待していた場合は修正）

- [ ] **Step 4: コミット**

```bash
git add mermaid-assist.html tests/
git commit -m "fix: copy-paste generates proper task IDs instead of __new_ prefix"
```

### Task 3: ズーム範囲修正 (E02-E03)

**Files:**
- Modify: `mermaid-assist.html` (setZoom関数、約L1743)

- [ ] **Step 1: setZoom のクランプ範囲を修正**

```javascript
// 変更前:
//   zoom = Math.max(0.1, Math.min(5.0, z));
// 変更後:
function setZoom(z) {
  zoom = Math.max(0.25, Math.min(3.0, z));
```

- [ ] **Step 2: テスト実行で確認**

Run: `npx playwright test tests/e2e/brushup-evaluation.spec.js -g "E02|E03" --reporter=list`
Expected: PASS

- [ ] **Step 3: 既存テストが壊れていないか確認**

Run: `npx playwright test --reporter=list`
Expected: 全PASS

- [ ] **Step 4: コミット**

```bash
git add mermaid-assist.html
git commit -m "fix: zoom range clamped to 25%-300% per design spec"
```

---

## Sprint 3: UXフィードバック改善 (E04-E06)

### Task 4: ホバーエフェクト (E04)

**Files:**
- Modify: `mermaid-assist.html` (CSS追加 + overlay bar属性)

- [ ] **Step 1: CSSにオーバーレイバーのホバースタイルを追加**

`<style>` セクション末尾（`</style>` の直前、約L345付近）に追加:

```css
/* ── Overlay hover effects ──────────────────────────────────────────────── */
#overlay-layer .overlay-bar {
  transition: fill 0.1s, opacity 0.1s;
}
#overlay-layer .overlay-bar:hover {
  fill: rgba(124, 140, 248, 0.15) !important;
  cursor: move;
}
```

- [ ] **Step 2: テスト実行で確認**

Run: `npx playwright test tests/e2e/brushup-evaluation.spec.js -g "E04" --reporter=list`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add mermaid-assist.html
git commit -m "feat: add hover highlight effect on task bars"
```

### Task 5: ドラッグ中の日付ツールチップ (E05)

**Files:**
- Modify: `mermaid-assist.html` (HTMLにツールチップ要素追加、ドラッグハンドラで表示/非表示制御)

- [ ] **Step 1: ツールチップHTML要素を追加**

`#statusbar` の直前（約L422）にツールチップ要素を追加:

```html
  <!-- Drag tooltip -->
  <div id="drag-tooltip" style="display:none; position:fixed; pointer-events:none; z-index:1000;
    background:var(--bg-secondary); border:1px solid var(--accent); color:var(--text-primary);
    font-family:var(--font-mono); font-size:11px; padding:4px 8px; border-radius:4px;
    box-shadow:0 2px 8px rgba(0,0,0,0.4); white-space:nowrap;"></div>
```

- [ ] **Step 2: ドラッグ中にツールチップを更新**

`document.addEventListener('mousemove'` ハンドラ内（約L2098付近、`refresh(true)` の前）にツールチップ更新を追加:

```javascript
      // Show drag tooltip near cursor
      var tooltipEl = document.getElementById('drag-tooltip');
      if (tooltipEl) {
        var currentParsed = parseGantt(mmdText);
        var dragTask = null;
        for (var dpi = 0; dpi < currentParsed.tasks.length; dpi++) {
          if (currentParsed.tasks[dpi].id === dragState.taskId) { dragTask = currentParsed.tasks[dpi]; break; }
        }
        if (dragTask) {
          var tipText = dragTask.startDate || '';
          if (dragTask.endDate && DATE_RE.test(dragTask.endDate)) {
            tipText += ' → ' + dragTask.endDate;
            var dur = daysBetween(dragTask.startDate, dragTask.endDate);
            tipText += ' (' + dur + '日)';
          }
          tooltipEl.textContent = tipText;
          tooltipEl.style.display = 'block';
          tooltipEl.style.left = (e.clientX + 16) + 'px';
          tooltipEl.style.top = (e.clientY - 30) + 'px';
        }
      }
```

- [ ] **Step 3: mouseup でツールチップを非表示にする**

`document.addEventListener('mouseup'` ハンドラ内（約L2134）に追加:

```javascript
      var tooltipEl = document.getElementById('drag-tooltip');
      if (tooltipEl) tooltipEl.style.display = 'none';
```

- [ ] **Step 4: テスト実行で確認**

Run: `npx playwright test tests/e2e/brushup-evaluation.spec.js -g "E05" --reporter=list`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add mermaid-assist.html
git commit -m "feat: show date tooltip near cursor during task drag"
```

### Task 6: ドラッグ中バーの視覚エフェクト (E06)

**Files:**
- Modify: `mermaid-assist.html` (ドラッグ開始時にバーのfillを変更、終了時に戻す)

- [ ] **Step 1: ドラッグ開始時にバーにエフェクトを適用**

`overlayEl.addEventListener('mousedown'` 内、`dragState = {` 設定直後（約L2025付近）:

```javascript
              // Visual feedback: highlight dragged bar
              var dragBarEl = overlayEl.querySelector('.overlay-bar[data-task-id="' + taskId + '"]');
              if (dragBarEl) {
                dragBarEl.setAttribute('fill', 'rgba(124, 140, 248, 0.3)');
                dragBarEl.setAttribute('data-dragging', 'true');
              }
```

- [ ] **Step 2: mouseup でエフェクトをクリア**

`document.addEventListener('mouseup'` 内、`dragState = null` の前に追加:

```javascript
      // Clear drag visual feedback
      var draggingBars = overlayEl.querySelectorAll('[data-dragging="true"]');
      for (var dbi = 0; dbi < draggingBars.length; dbi++) {
        draggingBars[dbi].setAttribute('fill', 'transparent');
        draggingBars[dbi].removeAttribute('data-dragging');
      }
```

- [ ] **Step 3: テスト実行で確認**

Run: `npx playwright test tests/e2e/brushup-evaluation.spec.js -g "E06" --reporter=list`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add mermaid-assist.html
git commit -m "feat: visual highlight on task bar during drag operation"
```

---

## Sprint 4: 操作性改善 (E07-E10)

### Task 7: after依存の編集対応 (E07)

**Files:**
- Modify: `mermaid-assist.html` (renderProps単一選択、updateTaskField)

- [ ] **Step 1: updateTaskField に after フィールドのサポートを追加**

`updateTaskField` 関数（約L643-662）に追加:

```javascript
  // 既存の if (field === 'id') { の後に追加:
  } else if (field === 'after') {
    if (value && value.trim()) {
      parsed.after = value.trim();
      parsed.startDate = null; // after指定時はstartDateをクリア
    } else {
      parsed.after = null;
    }
  }
```

- [ ] **Step 2: プロパティパネルの after フィールドを編集可能にする**

renderProps の単一タスク選択パネル（約L1322-1325）を修正:

```javascript
      // 変更前: readonly の after 表示
      // 変更後: 編集可能な after 入力フィールド
        '<div style="margin-bottom:8px;">' +
          '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">after依存</label>' +
          '<input id="prop-after" type="text" value="' + escHtml(task.after || '') + '" placeholder="タスクID (例: a1)" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;">' +
        '</div>' +
```

- [ ] **Step 3: after フィールドの change イベントをバインド**

`bindPropInput('prop-id', task.line, 'id');` の後に追加:

```javascript
      bindPropInput('prop-after', task.line, 'after');
```

- [ ] **Step 4: テスト実行で確認**

Run: `npx playwright test tests/e2e/brushup-evaluation.spec.js -g "E07" --reporter=list`
Expected: PASS

- [ ] **Step 5: 既存テストが壊れていないか確認**

Run: `npx playwright test --reporter=list`
Expected: 全PASS

- [ ] **Step 6: コミット**

```bash
git add mermaid-assist.html
git commit -m "feat: after dependency editable in property panel"
```

### Task 8: セクションドロップダウン即時更新 (E08)

**Files:**
- Modify: `mermaid-assist.html` (セクション追加ボタンのハンドラ)

- [ ] **Step 1: セクション追加後にrenderPropsを呼んでパネルを更新**

セクション追加ボタンのクリックハンドラ（約L1246-1256）で、`scheduleRefresh()` の後に selection をクリアして renderProps を再描画:

```javascript
        addSecBtn.addEventListener('click', function() {
          var name = document.getElementById('prop-add-sec-name').value.trim();
          if (!name) return;
          pushHistory();
          mmdText = addSection(mmdText, name);
          suppressSync = true;
          editorEl.value = mmdText;
          suppressSync = false;
          sel = []; // セクション追加後は選択解除して追加フォームに戻す
          syncLineNumbers();
          scheduleRefresh();
        });
```

これは既にselをクリアしていないだけなので、`sel = [];` を追加するだけ。
ただし refresh 完了後にrenderPropsが呼ばれるため、パース結果が更新された後にドロップダウンが再構築される。scheduleRefresh → refresh → renderProps のパイプラインで自動的に新セクションが反映される。

実際の問題は、セクション追加後に`scheduleRefresh()` が rAF なので即座に完了しない可能性がある点。テストでは800msの wait があるので問題にならない。

- [ ] **Step 2: テスト実行で確認**

Run: `npx playwright test tests/e2e/brushup-evaluation.spec.js -g "E08" --reporter=list`
Expected: PASS（既にパイプラインが正しく動作していれば）

- [ ] **Step 3: コミット（修正が必要だった場合）**

```bash
git add mermaid-assist.html
git commit -m "fix: section dropdown updates immediately after adding section"
```

### Task 9: タスク追加後の自動選択 (E09)

**Files:**
- Modify: `mermaid-assist.html` (タスク追加ボタンのハンドラ)

- [ ] **Step 1: タスク追加後に自動選択を設定**

タスク追加ボタンのクリックハンドラ（約L1226-1240）で、`scheduleRefresh()` の前にselを設定:

```javascript
          pushHistory();
          mmdText = addTask(mmdText, secIdx, label, id, start, end);
          sel = [{ type: 'task', id: id }]; // 追加したタスクを自動選択
          suppressSync = true;
          editorEl.value = mmdText;
          suppressSync = false;
          syncLineNumbers();
          scheduleRefresh();
```

- [ ] **Step 2: テスト実行で確認**

Run: `npx playwright test tests/e2e/brushup-evaluation.spec.js -g "E09" --reporter=list`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add mermaid-assist.html
git commit -m "feat: auto-select newly added task in property panel"
```

### Task 10: 空ガントのガイド表示 (E10)

**Files:**
- Modify: `mermaid-assist.html` (renderStatus関数)

- [ ] **Step 1: renderStatus でタスクゼロ時のメッセージを表示**

renderStatus 関数（約L1718-1733）を修正:

```javascript
function renderStatus() {
  if (!statusInfoEl) return;
  var info = '';
  if (parsed && parsed.tasks && parsed.tasks.length > 0) {
    info = 'タスク: ' + parsed.tasks.length;
    if (parsed.sections && parsed.sections.length > 0) info += ' | セクション: ' + parsed.sections.length;
    var dates = parsed.tasks.filter(function(t) { return t.startDate; }).map(function(t) { return t.startDate; });
    var endDates = parsed.tasks.filter(function(t) { return t.endDate && DATE_RE.test(t.endDate); }).map(function(t) { return t.endDate; });
    var allDates = dates.concat(endDates).sort();
    if (allDates.length >= 2) {
      info += ' | 期間: ' + allDates[0] + ' ~ ' + allDates[allDates.length - 1];
    }
  } else {
    info = 'タスク: 0 | プロパティパネルからタスクを追加してください';
  }
  statusInfoEl.textContent = info;
}
```

- [ ] **Step 2: テスト実行で確認**

Run: `npx playwright test tests/e2e/brushup-evaluation.spec.js -g "E10" --reporter=list`
Expected: PASS

- [ ] **Step 3: 既存テスト全体が壊れていないか確認**

Run: `npx playwright test --reporter=list`
Expected: 全PASS

- [ ] **Step 4: コミット**

```bash
git add mermaid-assist.html
git commit -m "feat: show guide message in status bar when no tasks exist"
```

---

## Sprint 5: 最終評価 + リグレッション確認

### Task 11: 全評価項目の最終検証

- [ ] **Step 1: 全評価テストを実行**

Run: `npx playwright test tests/e2e/brushup-evaluation.spec.js --reporter=list`
Expected: E01〜E10 全PASS

- [ ] **Step 2: 既存テスト全体のリグレッション確認**

Run: `npx playwright test --reporter=list`
Expected: 全PASS（71件 + 評価10件）

- [ ] **Step 3: ユニットテストのリグレッション確認**

Run: `node tests/run-tests.js`
Expected: 35 passed, 0 failed

- [ ] **Step 4: VERSIONを更新**

```
0.2.0
```

- [ ] **Step 5: コミット**

```bash
git add VERSION
git commit -m "chore: bump version to 0.2.0 for brushup release"
```
