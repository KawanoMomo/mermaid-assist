# 追加フォーム統一 + 実ユースケース検証 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tier1 全5図形のリレーション系追加フォームを縦1列・ラベル付きに統一し、実ユースケース（OAuth/受注フロー/状態遷移/ECドメイン/DB設計）でproperty panel単独操作を検証する。

**Architecture:** `window.MA.properties.selectFieldHtml` を活用して各モジュールの追加フォーム HTML を縦並びに置換。element ID 不変で既存 E2E と互換維持。新規 E2E (E15-E24) と MCP 検証で5シナリオの動作を確認。実験的に system-tester エージェントを使い spec から評価項目を生成しトレーサビリティを担保する。

**Tech Stack:** バニラJS、Playwright (E2E)、Node.js test runner (Unit)、MCP Playwright (visual sweep)、system-tester agent (test design)

**前提:** v1.1.0 (master), branch `ux/sequence-add-form-unification`、spec `docs/superpowers/specs/2026-04-16-add-form-unification-design.md`
**ベースライン:** 113 unit + 123 E2E pass

---

## 全体タスク構成

| Phase | 内容 | 並列可否 |
|---|---|---|
| **A** | 5モジュールの追加フォーム統一 (T1-T5) | 並列可 (worktree) |
| **B** | system-tester による評価設計 (T6) | A と並列可 |
| **C** | E2E テスト追加 E15-E24 (T7) | A 完了後 |
| **D** | MCP 実ユースケース検証 (T8-T12) | C 完了後 (1図形ずつ) |
| **E** | 不具合修正 + v1.2.0 リリース (T13) | D 完了後 |

---

## Task 1: Sequence メッセージ追加フォーム統一

**Files:**
- Modify: `E:/00_Git/05_MermaidAssist/src/modules/sequence.js`

**ベース:** 現状の `renderProps` の no-selection ブランチ内、メッセージ追加セクション。

- [ ] **Step 1: メッセージ追加セクションのHTML部を縦1列に変更**

`src/modules/sequence.js` の `renderProps` 関数内、`'メッセージを追加'` セクション全体を見つける。現在は以下のようなパターン:

```javascript
'<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
  '<label ...>メッセージを追加</label>' +
  '<div style="display:flex;gap:4px;margin-bottom:6px;">' +
    '<select id="seq-add-msg-from" ...>' + participantOpts + '</select>' +
    '<select id="seq-add-msg-arrow" ...>' + arrowOpts + '</select>' +
    '<select id="seq-add-msg-to" ...>' + participantOpts + '</select>' +
  '</div>' +
  fieldHtml('ラベル', 'seq-add-msg-label', '', 'Message') +
  P.primaryButtonHtml('seq-add-msg-btn', '+ メッセージ追加') +
'</div>'
```

これを以下に置換（option配列は `selectFieldHtml` の `[{value, label, selected}]` 形式に揃える）:

```javascript
P.sectionHeaderHtml('メッセージを追加') +
  P.selectFieldHtml('From', 'seq-add-msg-from', participants.map(function(p) { return { value: p.id, label: p.label }; })) +
  P.selectFieldHtml('Arrow', 'seq-add-msg-arrow', arrows.map(function(a) { return { value: a, label: a }; }), true) +
  P.selectFieldHtml('To', 'seq-add-msg-to', participants.map(function(p) { return { value: p.id, label: p.label }; })) +
  P.fieldHtml('ラベル', 'seq-add-msg-label', '', 'Message') +
  P.primaryButtonHtml('seq-add-msg-btn', '+ メッセージ追加') +
P.sectionFooterHtml()
```

**注意点:**
- `P` は既存の `var P = window.MA.properties;` を使用（既存コードに存在）
- 参加者が0人の場合 (`participants.length === 0`) は `participantOpts` が `<option value="">（参加者を先に追加）</option>` だった。これを `selectFieldHtml` 用に変換: `participants.length === 0 ? [{value: '', label: '（参加者を先に追加）'}] : participants.map(...)`
- `arrows` は `['->>','-->>','->','-->','-x','--x','-)','--)']` 既存定義を流用

- [ ] **Step 2: 既存ハンドラ bind 部は変更不要を確認**

`document.getElementById('seq-add-msg-btn').addEventListener('click', ...)` などの既存 bind コードはそのまま動作する（element ID 不変のため）。

- [ ] **Step 3: ユニットテスト + E2E 確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -3
```
Expected: 113 passed

```bash
cd "E:/00_Git/05_MermaidAssist" && npx playwright test tests/e2e/sequence-basic.spec.js --reporter=list 2>&1 | tail -10
```
Expected: 7 sequence tests pass

- [ ] **Step 4: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/modules/sequence.js
git commit -m "feat(sequence): vertical add-message form with From/Arrow/To labels

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Flowchart エッジ追加フォーム統一

**Files:**
- Modify: `E:/00_Git/05_MermaidAssist/src/modules/flowchart.js`

- [ ] **Step 1: エッジ追加セクションのHTML部を縦1列に変更**

`src/modules/flowchart.js` の `renderProps` 関数内、`'エッジを追加'` セクションを以下に置換:

```javascript
P.sectionHeaderHtml('エッジを追加') +
  P.selectFieldHtml('From', 'fc-add-edge-from', nodes.length === 0 ? [{value: '', label: '（ノードを先に追加）'}] : nodes.map(function(n) { return { value: n.id, label: n.label }; })) +
  P.selectFieldHtml('Arrow', 'fc-add-edge-arrow', arrows.map(function(a) { return { value: a, label: a }; }), true) +
  P.selectFieldHtml('To', 'fc-add-edge-to', nodes.length === 0 ? [{value: '', label: '（ノードを先に追加）'}] : nodes.map(function(n) { return { value: n.id, label: n.label }; })) +
  P.fieldHtml('ラベル', 'fc-add-edge-label', '', '') +
  P.primaryButtonHtml('fc-add-edge-btn', '+ エッジ追加') +
P.sectionFooterHtml()
```

`arrows` は既存の `['-->','---','-.->','-.-','==>','===','--x','--o']` を流用。

- [ ] **Step 2: テスト確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -3
npx playwright test tests/e2e/flowchart-basic.spec.js --reporter=list 2>&1 | tail -10
```

- [ ] **Step 3: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/modules/flowchart.js
git commit -m "feat(flowchart): vertical add-edge form with From/Arrow/To labels

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: State 遷移追加フォーム統一

**Files:**
- Modify: `E:/00_Git/05_MermaidAssist/src/modules/state.js`

- [ ] **Step 1: 遷移追加セクションのHTML部を縦1列に変更**

`src/modules/state.js` の `renderProps` 関数内、`'遷移を追加'` セクションを以下に置換:

```javascript
P.sectionHeaderHtml('遷移を追加') +
  P.selectFieldHtml('From', 'st-add-tr-from', [{value: '[*]', label: '[*] (start/end)'}].concat(states.map(function(s) { return { value: s.id, label: s.label }; }))) +
  P.selectFieldHtml('To', 'st-add-tr-to', [{value: '[*]', label: '[*] (start/end)'}].concat(states.map(function(s) { return { value: s.id, label: s.label }; }))) +
  P.fieldHtml('イベント', 'st-add-tr-event', '', 'click') +
  P.primaryButtonHtml('st-add-tr-btn', '+ 遷移追加') +
P.sectionFooterHtml()
```

- [ ] **Step 2: テスト確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -3
npx playwright test tests/e2e/state-basic.spec.js --reporter=list 2>&1 | tail -10
```

- [ ] **Step 3: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/modules/state.js
git commit -m "feat(state): vertical add-transition form with From/To labels

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Class 関連追加フォーム統一

**Files:**
- Modify: `E:/00_Git/05_MermaidAssist/src/modules/class.js`

- [ ] **Step 1: 関連追加セクションのHTML部を縦1列に変更**

`src/modules/class.js` の `renderProps` 関数内、`'関連を追加'` セクションを以下に置換:

```javascript
P.sectionHeaderHtml('関連を追加') +
  P.selectFieldHtml('From', 'cl-add-rel-from', classes.length === 0 ? [{value: '', label: '（クラスを先に追加）'}] : classes.map(function(c) { return { value: c.id, label: c.label }; })) +
  P.selectFieldHtml('Arrow', 'cl-add-rel-arrow', rels_arrows.map(function(a) { return { value: a, label: a + ' (' + relLabels[a] + ')' }; }), true) +
  P.selectFieldHtml('To', 'cl-add-rel-to', classes.length === 0 ? [{value: '', label: '（クラスを先に追加）'}] : classes.map(function(c) { return { value: c.id, label: c.label }; })) +
  P.fieldHtml('ラベル', 'cl-add-rel-label', '', '') +
  P.primaryButtonHtml('cl-add-rel-btn', '+ 関連追加') +
P.sectionFooterHtml()
```

`rels_arrows` と `relLabels` は既存定義を流用 (`['<|--','<|..','*--','o--','..>','-->','--']` と `{'<|--':'inheritance', ...}`)。

- [ ] **Step 2: テスト確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -3
npx playwright test tests/e2e/class-basic.spec.js --reporter=list 2>&1 | tail -10
```

- [ ] **Step 3: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/modules/class.js
git commit -m "feat(class): vertical add-relation form with From/Arrow/To labels

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: ER リレーションシップ追加フォーム統一

**Files:**
- Modify: `E:/00_Git/05_MermaidAssist/src/modules/er.js`

- [ ] **Step 1: リレーションシップ追加セクションを縦1列に変更**

`src/modules/er.js` の `renderProps` 関数内、`'リレーションシップを追加'` セクションを以下に置換:

```javascript
P.sectionHeaderHtml('リレーションシップを追加') +
  P.selectFieldHtml('From', 'er-add-rel-from', entities.length === 0 ? [{value: '', label: '（エンティティを先に追加）'}] : entities.map(function(e) { return { value: e.id, label: e.label }; })) +
  P.selectFieldHtml('Left card', 'er-add-rel-lc', cards.map(function(c) { return { value: c, label: c, selected: c === '||' }; }), true) +
  P.selectFieldHtml('Right card', 'er-add-rel-rc', cards.map(function(c) { return { value: c, label: c, selected: c === 'o{' }; }), true) +
  P.selectFieldHtml('To', 'er-add-rel-to', entities.length === 0 ? [{value: '', label: '（エンティティを先に追加）'}] : entities.map(function(e) { return { value: e.id, label: e.label }; })) +
  P.fieldHtml('ラベル', 'er-add-rel-label', '', 'has') +
  P.primaryButtonHtml('er-add-rel-btn', '+ リレーションシップ追加') +
P.sectionFooterHtml()
```

`cards` は既存の `['||','|o','}o','}|','o|','o{','|{']` を流用。

**注意:** デフォルト選択は `||` (Left) と `o{` (Right) — 元コードでは render後に `rcSelInit.value = 'o{'` していたが、`selectFieldHtml` の `selected: true` で設定可能なので、その後の `rcSelInit.value = 'o{';` 行は削除する。

- [ ] **Step 2: 不要になった rcSelInit 設定を削除**

`var rcSelInit = document.getElementById('er-add-rel-rc'); if (rcSelInit) rcSelInit.value = 'o{';` の2行を削除。

- [ ] **Step 3: テスト確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -3
npx playwright test tests/e2e/er-basic.spec.js --reporter=list 2>&1 | tail -10
```

- [ ] **Step 4: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/modules/er.js
git commit -m "feat(er): vertical add-relationship form with From/Cards/To labels

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: system-tester エージェントによる評価設計

**Files:**
- Input: `E:/00_Git/05_MermaidAssist/docs/superpowers/specs/2026-04-16-add-form-unification-design.md`
- Output: `E:/00_Git/05_MermaidAssist/docs/superpowers/specs/2026-04-16-add-form-unification-test-spec.md`

**目的:** 仕様書から要件・評価項目・テストタスクを構造的に抽出し、トレーサビリティを担保する。手動で書いた E2E (E15-E24) との整合確認にも使う。

- [ ] **Step 1: system-tester エージェントを起動**

Agent ツールで以下を呼び出し:

- subagent_type: `system-tester`
- model: `opus` (agent定義に合わせる)
- prompt: 以下の JSON 相当
  ```json
  {
    "spec_path": "E:/00_Git/05_MermaidAssist/docs/superpowers/specs/2026-04-16-add-form-unification-design.md",
    "output_path": "E:/00_Git/05_MermaidAssist/docs/superpowers/specs/2026-04-16-add-form-unification-test-spec.md",
    "target_name": "MermaidAssist 追加フォーム統一"
  }
  ```

- [ ] **Step 2: エージェント返却の JSON を確認**

```json
{
  "spec_path": "...",
  "output_path": "...",
  "req_count": N,
  "ev_count": M,
  "tc_count": K,
  "unresolved_count": 0,
  "coverage_ok": true
}
```

- `coverage_ok: false` の場合は出力 test-spec の `## 1. 未確定事項` を読んで対処
- `unresolved_count > 0` の場合は質問内容に1問1答で回答してから再生成

- [ ] **Step 3: 生成された test-spec.md を確認**

```bash
cat "E:/00_Git/05_MermaidAssist/docs/superpowers/specs/2026-04-16-add-form-unification-test-spec.md" | head -80
```

確認項目:
- 要件数が spec の規範的記述（「〜すること」「〜が表示される」等）と一致
- 各 EV の判定基準が観測可能（曖昧語が含まれないこと）
- トレーサビリティ表が完備

- [ ] **Step 4: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add docs/superpowers/specs/2026-04-16-add-form-unification-test-spec.md
git commit -m "docs: system-tester generated test spec for add form unification

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: E2E テスト E15-E24 追加

**Files:**
- Modify: `E:/00_Git/05_MermaidAssist/tests/e2e/sequence-basic.spec.js` (E15-E16)
- Modify: `E:/00_Git/05_MermaidAssist/tests/e2e/flowchart-basic.spec.js` (E17-E18)
- Modify: `E:/00_Git/05_MermaidAssist/tests/e2e/state-basic.spec.js` (E19-E20)
- Modify: `E:/00_Git/05_MermaidAssist/tests/e2e/class-basic.spec.js` (E21-E22)
- Modify: `E:/00_Git/05_MermaidAssist/tests/e2e/er-basic.spec.js` (E23-E24)

- [ ] **Step 1: Sequence E15-E16 を追加**

`tests/e2e/sequence-basic.spec.js` の末尾に以下を追加:

```javascript
test.describe('E15-E16: Sequence add form unification', () => {
  test('E15: メッセージ追加フォームに From/Arrow/To のラベルが表示される', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToSequence(page);
    await page.waitForTimeout(800);

    // <label> for From/Arrow/To exists adjacent to the selects
    const fromLabel = page.locator('label:has-text("From")').first();
    const arrowLabel = page.locator('label:has-text("Arrow")').first();
    const toLabel = page.locator('label:has-text("To")').first();
    await expect(fromLabel).toBeVisible();
    await expect(arrowLabel).toBeVisible();
    await expect(toLabel).toBeVisible();
  });

  test('E16: OAuthミニ — 4 participants + 3 messages を property panel から構築', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToSequence(page);
    await page.waitForTimeout(500);

    // Add User
    await page.locator('#seq-add-part-id').fill('User');
    await page.locator('#seq-add-part-label').fill('User');
    await page.locator('#seq-add-part-btn').click();
    await page.waitForTimeout(300);

    // Add AuthServer
    await page.locator('#seq-add-part-id').fill('AuthServer');
    await page.locator('#seq-add-part-label').fill('AuthServer');
    await page.locator('#seq-add-part-btn').click();
    await page.waitForTimeout(300);

    // Add ResourceServer
    await page.locator('#seq-add-part-id').fill('ResourceServer');
    await page.locator('#seq-add-part-label').fill('ResourceServer');
    await page.locator('#seq-add-part-btn').click();
    await page.waitForTimeout(300);

    // Add 3 messages
    await page.locator('#seq-add-msg-from').selectOption('User');
    await page.locator('#seq-add-msg-to').selectOption('A');  // existing Client
    await page.locator('#seq-add-msg-arrow').selectOption('->>');
    await page.locator('#seq-add-msg-label').fill('認可開始');
    await page.locator('#seq-add-msg-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#seq-add-msg-from').selectOption('A');
    await page.locator('#seq-add-msg-to').selectOption('AuthServer');
    await page.locator('#seq-add-msg-arrow').selectOption('->>');
    await page.locator('#seq-add-msg-label').fill('認可リクエスト');
    await page.locator('#seq-add-msg-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#seq-add-msg-from').selectOption('AuthServer');
    await page.locator('#seq-add-msg-to').selectOption('A');
    await page.locator('#seq-add-msg-arrow').selectOption('-->>');
    await page.locator('#seq-add-msg-label').fill('認可コード');
    await page.locator('#seq-add-msg-btn').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('participant User');
    expect(text).toContain('participant AuthServer');
    expect(text).toContain('participant ResourceServer');
    expect(text).toContain('認可開始');
    expect(text).toContain('認可リクエスト');
    expect(text).toContain('認可コード');
  });
});
```

- [ ] **Step 2: Flowchart E17-E18 を追加**

`tests/e2e/flowchart-basic.spec.js` の末尾に追加:

```javascript
test.describe('E17-E18: Flowchart add form unification', () => {
  test('E17: エッジ追加フォームに From/Arrow/To のラベル表示', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToFlowchart(page);
    await page.waitForTimeout(800);

    const fromLabel = page.locator('label:has-text("From")').first();
    const arrowLabel = page.locator('label:has-text("Arrow")').first();
    const toLabel = page.locator('label:has-text("To")').first();
    await expect(fromLabel).toBeVisible();
    await expect(arrowLabel).toBeVisible();
    await expect(toLabel).toBeVisible();
  });

  test('E18: 受注フローミニ — 3 nodes + 2 edges + direction LR', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToFlowchart(page);
    await page.waitForTimeout(500);

    // direction LR
    await page.locator('#fc-direction').selectOption('LR');
    await page.waitForTimeout(300);

    // Add 3 new nodes
    await page.locator('#fc-add-node-id').fill('Recv');
    await page.locator('#fc-add-node-label').fill('受注受付');
    await page.locator('#fc-add-node-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#fc-add-node-id').fill('Stock');
    await page.locator('#fc-add-node-label').fill('在庫確認');
    await page.locator('#fc-add-node-shape').selectOption('diamond');
    await page.locator('#fc-add-node-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#fc-add-node-id').fill('Ship');
    await page.locator('#fc-add-node-label').fill('出荷');
    await page.locator('#fc-add-node-shape').selectOption('rect');
    await page.locator('#fc-add-node-btn').click();
    await page.waitForTimeout(300);

    // Add 2 edges
    await page.locator('#fc-add-edge-from').selectOption('Recv');
    await page.locator('#fc-add-edge-to').selectOption('Stock');
    await page.locator('#fc-add-edge-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#fc-add-edge-from').selectOption('Stock');
    await page.locator('#fc-add-edge-to').selectOption('Ship');
    await page.locator('#fc-add-edge-label').fill('あり');
    await page.locator('#fc-add-edge-btn').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('flowchart LR');
    expect(text).toContain('Recv[受注受付]');
    expect(text).toContain('Stock{在庫確認}');
    expect(text).toContain('Ship[出荷]');
    expect(text).toContain('Recv --> Stock');
    expect(text).toContain('Stock --> |あり| Ship');
  });
});
```

- [ ] **Step 3: State E19-E20 を追加**

`tests/e2e/state-basic.spec.js` の末尾に追加:

```javascript
test.describe('E19-E20: State add form unification', () => {
  test('E19: 遷移追加フォームに From/To のラベル表示', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToState(page);
    await page.waitForTimeout(800);

    const fromLabel = page.locator('label:has-text("From")').first();
    const toLabel = page.locator('label:has-text("To")').first();
    await expect(fromLabel).toBeVisible();
    await expect(toLabel).toBeVisible();
  });

  test('E20: 状態遷移ミニ — 2 states + 2 transitions', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToState(page);
    await page.waitForTimeout(500);

    // Add states
    await page.locator('#st-add-state-id').fill('Booting');
    await page.locator('#st-add-state-label').fill('Booting');
    await page.locator('#st-add-state-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#st-add-state-id').fill('Error');
    await page.locator('#st-add-state-label').fill('Error');
    await page.locator('#st-add-state-btn').click();
    await page.waitForTimeout(300);

    // Add transitions
    await page.locator('#st-add-tr-from').selectOption('Booting');
    await page.locator('#st-add-tr-to').selectOption('Idle');
    await page.locator('#st-add-tr-event').fill('boot_complete');
    await page.locator('#st-add-tr-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#st-add-tr-from').selectOption('Running');
    await page.locator('#st-add-tr-to').selectOption('Error');
    await page.locator('#st-add-tr-event').fill('fault');
    await page.locator('#st-add-tr-btn').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('state Booting');
    expect(text).toContain('state Error');
    expect(text).toContain('boot_complete');
    expect(text).toContain('fault');
  });
});
```

- [ ] **Step 4: Class E21-E22 を追加**

`tests/e2e/class-basic.spec.js` の末尾に追加:

```javascript
test.describe('E21-E22: Class add form unification', () => {
  test('E21: 関連追加フォームに From/Arrow/To のラベル表示', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToClass(page);
    await page.waitForTimeout(800);

    const fromLabel = page.locator('label:has-text("From")').first();
    const arrowLabel = page.locator('label:has-text("Arrow")').first();
    const toLabel = page.locator('label:has-text("To")').first();
    await expect(fromLabel).toBeVisible();
    await expect(arrowLabel).toBeVisible();
    await expect(toLabel).toBeVisible();
  });

  test('E22: ECドメインミニ — 2 classes + 1 relation', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToClass(page);
    await page.waitForTimeout(500);

    await page.locator('#cl-add-class-id').fill('Customer');
    await page.locator('#cl-add-class-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#cl-add-class-id').fill('Order');
    await page.locator('#cl-add-class-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#cl-add-rel-from').selectOption('Customer');
    await page.locator('#cl-add-rel-arrow').selectOption('-->');
    await page.locator('#cl-add-rel-to').selectOption('Order');
    await page.locator('#cl-add-rel-label').fill('places');
    await page.locator('#cl-add-rel-btn').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('class Customer');
    expect(text).toContain('class Order');
    expect(text).toContain('Customer --> Order : places');
  });
});
```

- [ ] **Step 5: ER E23-E24 を追加**

`tests/e2e/er-basic.spec.js` の末尾に追加:

```javascript
test.describe('E23-E24: ER add form unification', () => {
  test('E23: リレーションシップ追加フォームに From/Cards/To のラベル表示', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToER(page);
    await page.waitForTimeout(800);

    const fromLabel = page.locator('label:has-text("From")').first();
    const lcLabel = page.locator('label:has-text("Left card")').first();
    const rcLabel = page.locator('label:has-text("Right card")').first();
    const toLabel = page.locator('label:has-text("To")').first();
    await expect(fromLabel).toBeVisible();
    await expect(lcLabel).toBeVisible();
    await expect(rcLabel).toBeVisible();
    await expect(toLabel).toBeVisible();
  });

  test('E24: DB設計ミニ — 2 entities + attribute + 1 relationship', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToER(page);
    await page.waitForTimeout(500);

    await page.locator('#er-add-ent-id').fill('PRODUCT');
    await page.locator('#er-add-ent-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#er-add-attr-entity').selectOption('PRODUCT');
    await page.locator('#er-add-attr-type').fill('int');
    await page.locator('#er-add-attr-name').fill('id');
    await page.locator('#er-add-attr-key').selectOption('PK');
    await page.locator('#er-add-attr-btn').click();
    await page.waitForTimeout(300);

    await page.locator('#er-add-rel-from').selectOption('PRODUCT');
    await page.locator('#er-add-rel-to').selectOption('CUSTOMER');
    await page.locator('#er-add-rel-label').fill('owned-by');
    await page.locator('#er-add-rel-btn').click();
    await page.waitForTimeout(500);

    const text = await editorText(page);
    expect(text).toContain('PRODUCT {');
    expect(text).toContain('int id PK');
    expect(text).toContain('PRODUCT ||--o{ CUSTOMER : owned-by');
  });
});
```

- [ ] **Step 6: 全 E2E 実行**

```bash
cd "E:/00_Git/05_MermaidAssist" && npx playwright test --reporter=list 2>&1 | tail -10
```
Expected: 123 既存 + 10 新規 = 133 passed

- [ ] **Step 7: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add tests/e2e/
git commit -m "test: add E15-E24 for unified add form labels and use-case mini scenarios

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: MCP 検証 — Sequence (OAuth 2.0 認可コードフロー)

**Files:**
- Output: `E:/00_Git/.eval/v1.2.0-usecase/sequence-oauth-final.png` + report 部分

- [ ] **Step 1: HTTPサーバー起動**

```bash
cd "E:/00_Git/05_MermaidAssist" && python -m http.server 8765
```
Run in background.

- [ ] **Step 2: MCP で開く + Sequence に切替**

```bash
mkdir -p "E:/00_Git/.eval/v1.2.0-usecase"
```

MCP:
- `mcp__playwright__browser_navigate` to `http://127.0.0.1:8765/mermaid-assist.html`
- `mcp__playwright__browser_evaluate` で diagram-type を `sequenceDiagram` に切替
- `mcp__playwright__browser_take_screenshot` 初期状態を保存

- [ ] **Step 3: spec の §4.1 シナリオを完全実行**

各メッセージ追加ごとにスクリーンショット (任意、最終のみで可):
1. デフォルトの2 messages + 2 participants 削除
2. 4 participants 追加
3. 9 messages 追加（spec §4.1 の表通り）
4. alt ブロック追加

- [ ] **Step 4: 最終スクリーンショット保存**

```
.eval/v1.2.0-usecase/sequence-oauth-final.png
```

- [ ] **Step 5: 観察結果を report に記録**

確認項目（spec §4.6 共通合格基準）:
- From/To 識別容易？
- 画面外切れ無し？
- 追加/編集レイアウト一致？
- Mermaid 反映正常？
- console エラー無し？

不具合があれば次の Task 13 で修正対象とする。

---

## Task 9: MCP 検証 — Flowchart (受注フロー)

(Task 8 と同パターン、Flowchart に切替えて spec §4.2 シナリオ実行)

- [ ] **Step 1**: Flowchart に切替
- [ ] **Step 2**: デフォルト全削除
- [ ] **Step 3**: 9 nodes + 9 edges 追加（spec §4.2 表通り）
- [ ] **Step 4**: direction LR に変更
- [ ] **Step 5**: スクリーンショット `.eval/v1.2.0-usecase/flowchart-order-final.png`
- [ ] **Step 6**: 観察結果を report に記録

---

## Task 10: MCP 検証 — State (組み込み状態)

- [ ] **Step 1**: State に切替
- [ ] **Step 2**: デフォルト全削除
- [ ] **Step 3**: 5 states + 9 transitions 追加（spec §4.3 表通り）
- [ ] **Step 4**: スクリーンショット `.eval/v1.2.0-usecase/state-embedded-final.png`
- [ ] **Step 5**: 観察結果を report に記録

---

## Task 11: MCP 検証 — Class (EC ドメイン)

- [ ] **Step 1**: Class に切替
- [ ] **Step 2**: デフォルト全削除
- [ ] **Step 3**: 4 classes + 8 members + 3 relations 追加（spec §4.4 表通り）
- [ ] **Step 4**: スクリーンショット `.eval/v1.2.0-usecase/class-domain-final.png`
- [ ] **Step 5**: 観察結果を report に記録

---

## Task 12: MCP 検証 — ER (EC DB 設計)

- [ ] **Step 1**: ER に切替
- [ ] **Step 2**: デフォルト全削除
- [ ] **Step 3**: 4 entities + 11 attributes + 3 relationships 追加（spec §4.5 表通り）
- [ ] **Step 4**: スクリーンショット `.eval/v1.2.0-usecase/er-db-final.png`
- [ ] **Step 5**: HTTPサーバー停止
- [ ] **Step 6**: 全シナリオの観察結果を統合 report に記録

```bash
# 統合 report
echo "# v1.2.0 Use Case Validation Report" > "E:/00_Git/05_MermaidAssist/.eval/v1.2.0-usecase/report.md"
# (Sequence/Flowchart/State/Class/ER の各観察結果を追記)
```

---

## Task 13: 不具合修正 + v1.2.0 リリース

- [ ] **Step 1: Task 8-12 で発見された不具合を修正**

各シナリオで観察された不具合（合格基準を満たさない箇所）を該当モジュールで修正。修正不要なら次へ。

- [ ] **Step 2: 全テスト最終実行**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -3
npx playwright test --reporter=list 2>&1 | tail -10
```
Expected: 113 unit + 133 E2E pass

- [ ] **Step 3: VERSION 更新**

```bash
echo "1.2.0" > "E:/00_Git/05_MermaidAssist/VERSION"
```

- [ ] **Step 4: report と eval をプロジェクトに取り込む**

```bash
cp -r "E:/00_Git/.eval/v1.2.0-usecase" "E:/00_Git/05_MermaidAssist/.eval/"
```

- [ ] **Step 5: コミット + master マージ + tag + push**

```bash
cd "E:/00_Git/05_MermaidAssist"
git add VERSION .eval/v1.2.0-usecase/
git commit -m "chore: bump version to 1.2.0 for add form unification

Tier1 全5図形のリレーション系追加フォームを縦1列・ラベル付きに統一。
5シナリオ (OAuth/受注フロー/組み込み状態/ECドメイン/DB設計) を
property panel のみで構築できることを MCP で実機検証。
113 unit + 133 E2E + system-tester 評価 全合格。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"

git checkout master
git merge --no-ff ux/sequence-add-form-unification -m "Merge ux/sequence-add-form-unification: unified add form (v1.2.0)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git tag -a v1.2.0 -m "v1.2.0 — Unified add form layout, 5 use case validations"
git push origin master
git push origin v1.2.0
```

---

## 並列実行戦略

### Phase A の並列化 (T1-T5)

T1-T5 は別モジュールへの修正で独立。worktree 分離で並列実行可能:
```
agent dispatch (background, isolation: worktree):
  T1 sequence
  T2 flowchart
  T3 state
  T4 class
  T5 er
```

各 worktree で commit → 完了後にメインブランチで merge。

### T6 (system-tester) は T1-T5 と並列可

system-tester は spec を読むだけで実装に依存しない。Phase A と並行起動可能。

### T7 (E2E追加) は Phase A 完了後

E2E はラベル表示と要素操作を確認するため、フォーム統一が完了している必要あり。

### T8-T12 (MCP検証) は1図形ずつ順次

ブラウザは1セッションなので順次実行。並列化しない。

## Self-Review

**Spec coverage check:**
- §3.2 図形別形式 → T1-T5 で各モジュール個別実装 ✓
- §4 検証ユースケース → T8-T12 で各シナリオMCP実機実行 ✓
- §5.2 E2E E15-E24 → T7 で全10件追加 ✓
- §6 リリースプラン v1.2.0 → T13 で実施 ✓
- system-tester 連携 → T6 で実行 ✓

**Type consistency check:**
- 全タスクで `P = window.MA.properties` を使用、ヘルパー名 (`selectFieldHtml`, `sectionHeaderHtml`, `fieldHtml`, `primaryButtonHtml`, `sectionFooterHtml`) は properties.js R1 に存在
- element ID 命名規則統一: `<prefix>-add-<thing>-<field>`
- arrow / cards 配列名は既存モジュール内の変数名を踏襲

**Placeholder scan:** なし（全タスクに具体的なコード/コマンド/期待値あり）

**スコープ確認:** 単一 implementation plan で実装可能。Tier1 全5図形のフォーム統一 + 検証で完結。
