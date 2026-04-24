# Tier 2: Action-bar Helper + Overlay-Selected CSS Common-UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Sequence module's hard-coded `↑前に挿入 / ↓後に挿入 / ↑上へ / ↓下へ / 削除` action-bar and `.overlay-*.selected` CSS into shared `window.MA.properties` helpers and common CSS, then apply the result to flowchart / state / class / er / timeline with `move + delete` (insertBefore/insertAfter deferred to Tier 4 with modal forms).

**Architecture:**
- Two new helpers on `window.MA.properties`: `actionBarHtml(idPrefix, opts)` emits the HTML; `bindActionBar(idPrefix, handlers)` wires click events. `<prefix>-extra` placeholder is always emitted for module-specific extensions.
- mermaid-assist.html gains a generic `#overlay-layer [class*="overlay-"].selected` CSS rule plus `.action-btn` / `.action-btn-danger` / `.action-bar-row` / `.action-bar-extra` styles so all modules share the look.
- Sequence is refactored first (regression-safe proof of the helpers), then flowchart / state / class / er / timeline migrate one PR each. Each target module also gains a simple `move<Kind>Up/Down(text, lineNum)` pair that swaps with the previous/next line of the same kind (Tier 3 will refactor to shared safe-move helpers).

**Tech Stack:**
- JavaScript ES5 (existing codebase convention, no build step)
- jsdom for unit tests (`tests/run-tests.js`)
- Playwright MCP for visual verification
- Python `http.server` for local preview (existing dev workflow)

**Scope note on insertBefore/insertAfter:**
The spec lists `insertBefore: true / insertAfter: true` for each module, but those buttons require a modal insert form (equivalent of Sequence's `_showInsertForm`) that does not yet exist in the 5 target modules. Tier 2 ships the helper API supporting those options (for Sequence to use) and wires `insertBefore: false / insertAfter: false` in flowchart / state / class / er / timeline. Tier 4 adds module-specific modal forms and flips those flags to true.

---

## File Structure

**Create:**
- `tests/properties.test.js` — unit tests for the two new helpers

**Modify:**
- `src/ui/properties.js` — add `actionBarHtml`, `bindActionBar`, export both (~80 lines added)
- `mermaid-assist.html` — add common CSS rules and `.action-bar-row` / `.action-btn` / `.action-btn-danger` styles (~25 lines added)
- `src/modules/sequence.js` — replace 4 hand-rolled action-bars (participant / message / note / group) with helper calls (~-40 lines net)
- `src/modules/flowchart.js` — add `moveNodeUp/Down`, wire action-bar on `sel-node` and `sel-edge` panels
- `src/modules/state.js` — add `moveStateUp/Down`, wire action-bar on `sel-state` and `sel-tr` panels
- `src/modules/class.js` — add `moveClassUp/Down`, wire action-bar on `sel-class` and `sel-rel` panels
- `src/modules/er.js` — add `moveEntityUp/Down`, wire action-bar on `sel-ent` and `sel-rel` panels
- `src/modules/timeline.js` — add `movePeriodUp/Down`, wire action-bar on `tl-edit-sec` and `tl-edit-p` panels

**Commits / PR boundaries:**
- **PR-α**: helpers + CSS + properties tests + Sequence migration (tasks 1–11)
- **PR-β1**: flowchart (tasks 12–14)
- **PR-β2**: state (tasks 15–17)
- **PR-β3**: class (tasks 18–20)
- **PR-β4**: er (tasks 21–23)
- **PR-β5**: timeline (tasks 24–26)
- **Final**: rebase, combined Playwright sweep, PR descriptions (task 27)

---

## Task 1: Branch setup

**Files:**
- Create: none (git operation)

- [ ] **Step 1: Verify PR #1 branch is up to date**

Run: `cd E:/00_Git/05_MermaidAssist && git branch --show-current && git status`
Expected: on `feat/selection-toggle-consistency`, clean tree

- [ ] **Step 2: Create a dedicated branch off current work**

```bash
cd E:/00_Git/05_MermaidAssist
git checkout -b feat/tier2-action-bar-common-ui
```

Expected: switched to new branch

- [ ] **Step 3: Baseline unit test count**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected output contains: `371 passed, 0 failed`

---

## Task 2: Write failing test — `actionBarHtml` emits all 5 buttons

**Files:**
- Create: `tests/properties.test.js`

- [ ] **Step 1: Create the test file with the first failing test**

Content of `tests/properties.test.js`:
```js
'use strict';
var jsdom = require('jsdom');
var dom = new jsdom.JSDOM('<!DOCTYPE html><html><body><div id="props-content"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
// html-utils is required by properties.js escHtml
require('../src/core/html-utils.js');
require('../src/ui/properties.js');
var P = window.MA.properties;

describe('actionBarHtml', function() {
  test('emits all 5 buttons by default', function() {
    var html = P.actionBarHtml('sel-x');
    expect(html).toContain('id="sel-x-insert-before"');
    expect(html).toContain('id="sel-x-insert-after"');
    expect(html).toContain('id="sel-x-up"');
    expect(html).toContain('id="sel-x-down"');
    expect(html).toContain('id="sel-x-delete"');
    expect(html).toContain('id="sel-x-extra"');
  });
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js tests/properties.test.js 2>&1 | tail -20`
Expected: fails with `TypeError: P.actionBarHtml is not a function`

---

## Task 3: Implement `actionBarHtml` minimally

**Files:**
- Modify: `src/ui/properties.js`

- [ ] **Step 1: Add `actionBarHtml` above the `return` block in `properties.js`**

Locate the comment `// ── Event binding helpers ────────────────────────────────────────────────` (around line 129). Insert **before** that comment:

```js
  // ── Action bar (selected-element UX) ─────────────────────────────────────
  // Emits the standard 5-button row (↑前に挿入 / ↓後に挿入 / ↑上へ / ↓下へ /
  // 削除) used by every module's selected-element panel. The matching event
  // hookup is provided by bindActionBar below.
  //
  // opts (all optional, default true for booleans):
  //   insertBefore : boolean
  //   insertAfter  : boolean
  //   move         : boolean | { up: boolean, down: boolean }
  //   delete       : boolean
  //   labels       : { insertBefore?, insertAfter?, up?, down?, delete? }
  //
  // The <prefix>-extra div is ALWAYS emitted so modules can append module-
  // specific buttons at a stable DOM location. See ADR-020 / ADR-022.
  function actionBarHtml(idPrefix, opts) {
    opts = opts || {};
    var labels = opts.labels || {};
    var moveUp = true, moveDown = true;
    if (opts.move === false) { moveUp = false; moveDown = false; }
    else if (opts.move && typeof opts.move === 'object') {
      moveUp = opts.move.up !== false;
      moveDown = opts.move.down !== false;
    }
    var insertBefore = opts.insertBefore !== false;
    var insertAfter = opts.insertAfter !== false;
    var includeDelete = opts.delete !== false;

    var html = '';
    if (insertBefore || insertAfter) {
      html += '<div class="action-bar-row" data-action-bar-row="insert">';
      if (insertBefore) {
        html += '<button id="' + idPrefix + '-insert-before" class="action-btn">' +
                escHtml(labels.insertBefore || '↑ この前に挿入') + '</button>';
      }
      if (insertAfter) {
        html += '<button id="' + idPrefix + '-insert-after" class="action-btn">' +
                escHtml(labels.insertAfter || '↓ この後に挿入') + '</button>';
      }
      html += '</div>';
    }
    if (moveUp || moveDown) {
      html += '<div class="action-bar-row" data-action-bar-row="move">';
      if (moveUp) {
        html += '<button id="' + idPrefix + '-up" class="action-btn">' +
                escHtml(labels.up || '↑ 上へ') + '</button>';
      }
      if (moveDown) {
        html += '<button id="' + idPrefix + '-down" class="action-btn">' +
                escHtml(labels.down || '↓ 下へ') + '</button>';
      }
      html += '</div>';
    }
    html += '<div id="' + idPrefix + '-extra" class="action-bar-extra"></div>';
    if (includeDelete) {
      html += '<button id="' + idPrefix + '-delete" class="action-btn-danger">' +
              escHtml(labels.delete || '削除') + '</button>';
    }
    return html;
  }
```

- [ ] **Step 2: Export `actionBarHtml` from the public API**

Locate the `return { ... }` block (~line 193). Add `actionBarHtml: actionBarHtml,` inside the object, grouped with the other HTML builders:

```js
    primaryButtonHtml: primaryButtonHtml,
    dangerButtonHtml: dangerButtonHtml,
    actionBarHtml: actionBarHtml,
    // Event helpers
    bindEvent: bindEvent,
```

- [ ] **Step 3: Run the test to confirm it passes**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js tests/properties.test.js 2>&1 | tail -5`
Expected: `1 passed, 0 failed`

---

## Task 4: Add remaining `actionBarHtml` tests (opts variants)

**Files:**
- Modify: `tests/properties.test.js`

- [ ] **Step 1: Add 4 more tests**

Append inside `describe('actionBarHtml', ...)` block, before its closing `});`:

```js
  test('omits up/down when move=false', function() {
    var html = P.actionBarHtml('sel-x', { move: false });
    expect(html).not.toContain('id="sel-x-up"');
    expect(html).not.toContain('id="sel-x-down"');
    expect(html).toContain('id="sel-x-delete"');  // still there
  });

  test('emits only up when move={up:true, down:false}', function() {
    var html = P.actionBarHtml('sel-x', { move: { up: true, down: false } });
    expect(html).toContain('id="sel-x-up"');
    expect(html).not.toContain('id="sel-x-down"');
  });

  test('uses label override', function() {
    var html = P.actionBarHtml('sel-x', { labels: { delete: 'ノード削除' } });
    expect(html).toContain('>ノード削除<');
    expect(html).not.toContain('>削除<');
  });

  test('always emits the -extra placeholder', function() {
    var html = P.actionBarHtml('sel-x', {
      insertBefore: false, insertAfter: false, move: false, delete: false,
    });
    expect(html).toContain('id="sel-x-extra"');
    expect(html).not.toContain('id="sel-x-delete"');
  });
```

- [ ] **Step 2: Run the tests to confirm they pass**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js tests/properties.test.js 2>&1 | tail -10`
Expected: `5 passed, 0 failed`

---

## Task 5: Write failing test — `bindActionBar`

**Files:**
- Modify: `tests/properties.test.js`

- [ ] **Step 1: Append bindActionBar describe block**

Append at the very end of `tests/properties.test.js`:

```js
describe('bindActionBar', function() {
  beforeEach(function() {
    document.body.innerHTML = '<div id="props-content">' + P.actionBarHtml('sel-x') + '</div>';
  });

  test('fires handler on up click', function() {
    var called = 0;
    P.bindActionBar('sel-x', { up: function() { called++; } });
    document.getElementById('sel-x-up').click();
    expect(called).toBe(1);
  });

  test('does not fire handler when key is omitted', function() {
    var called = 0;
    P.bindActionBar('sel-x', { up: function() { called++; } });
    document.getElementById('sel-x-down').click();
    expect(called).toBe(0);
  });

  test('ignores unknown keys silently', function() {
    expect(function() {
      P.bindActionBar('sel-x', { somethingElse: function() {} });
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to confirm failure**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js tests/properties.test.js 2>&1 | tail -10`
Expected: fails with `TypeError: P.bindActionBar is not a function`

---

## Task 6: Implement `bindActionBar`

**Files:**
- Modify: `src/ui/properties.js`

- [ ] **Step 1: Add `bindActionBar` after `actionBarHtml`**

Directly after the `function actionBarHtml(...)` block (still above the `// ── Event binding helpers ──` comment), insert:

```js
  // bindActionBar: connect click handlers to the buttons that actionBarHtml
  // emitted for the same idPrefix. Handlers are optional — missing keys simply
  // skip the bind (no error). Unknown keys are ignored for forward-compat.
  //
  // Recognised keys → id suffix:
  //   insertBefore → -insert-before
  //   insertAfter  → -insert-after
  //   up           → -up
  //   down         → -down
  //   delete       → -delete
  function bindActionBar(idPrefix, handlers) {
    handlers = handlers || {};
    var map = {
      insertBefore: '-insert-before',
      insertAfter: '-insert-after',
      up: '-up',
      down: '-down',
      'delete': '-delete',
    };
    for (var key in map) {
      if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
      var fn = handlers[key];
      if (typeof fn !== 'function') continue;
      bindEvent(idPrefix + map[key], 'click', fn);
    }
  }
```

- [ ] **Step 2: Export `bindActionBar`**

Locate the `return { ... }` block, add after `bindEvent`:

```js
    bindEvent: bindEvent,
    bindActionBar: bindActionBar,
    bindAllByClass: bindAllByClass,
```

- [ ] **Step 3: Run tests to confirm they pass**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js tests/properties.test.js 2>&1 | tail -10`
Expected: `8 passed, 0 failed`

- [ ] **Step 4: Run the full test suite to confirm no regression**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed` (371 pre-existing + 8 new)

---

## Task 7: Commit helpers

**Files:**
- git commit

- [ ] **Step 1: Stage and commit helpers + tests**

```bash
cd E:/00_Git/05_MermaidAssist
git add src/ui/properties.js tests/properties.test.js
git commit -m "feat(properties): actionBarHtml + bindActionBar helpers

Add the shared 5-button action bar (insert before / after / move up /
down / delete) plus an always-present <prefix>-extra placeholder for
module-specific extensions, matching ADR-020 / ADR-022. bindActionBar
wires click handlers for whichever keys the caller supplies and
silently ignores missing or unknown keys (forward-compat).

tests/properties.test.js:
- 5 tests covering default / move=false / partial move / label override
  / always-on extra placeholder
- 3 tests covering bindActionBar click dispatch, skip-when-missing,
  ignore-unknown-key

Existing suite 371 → 379 passing."
```

- [ ] **Step 2: Confirm test count**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed`

---

## Task 8: Add common CSS to `mermaid-assist.html`

**Files:**
- Modify: `mermaid-assist.html`

- [ ] **Step 1: Read current CSS around `#overlay-layer .overlay-bar`**

Run: `cd E:/00_Git/05_MermaidAssist && grep -n "overlay-message.selected\|overlay-bar {" mermaid-assist.html | head -5`
Expected: locate the existing Sequence-specific `.overlay-*.selected` rules to be replaced (around lines 353–372 from a prior commit).

- [ ] **Step 2: Replace enumerated `.overlay-*.selected` rules with generic block**

In `mermaid-assist.html`, find the block that looks like:

```css
#overlay-layer .overlay-message.selected,
#overlay-layer .overlay-note.selected,
#overlay-layer .overlay-group.selected,
#overlay-layer .overlay-participant-handle.selected {
  fill: rgba(126, 231, 135, 0.15) !important;
  stroke: #7ee787;
  stroke-width: 2;
  stroke-dasharray: 4 4;
}
#overlay-layer .overlay-message:hover,
#overlay-layer .overlay-note:hover,
#overlay-layer .overlay-group:hover {
  fill: rgba(124, 140, 248, 0.12) !important;
}
```

Replace with:

```css
/* Generic selected / hover feedback for any overlay-* element.
   Gantt uses .overlay-bar but does NOT add .selected, so this rule does
   not affect it. See ADR-021. */
#overlay-layer [class*="overlay-"].selected {
  fill: rgba(126, 231, 135, 0.15) !important;
  stroke: var(--accent-green, #7ee787);
  stroke-width: 2;
  stroke-dasharray: 4 4;
}
#overlay-layer [class*="overlay-"]:not(.selected):not(.overlay-bar):hover {
  fill: rgba(124, 140, 248, 0.12) !important;
}

/* Action-bar layout used by window.MA.properties.actionBarHtml. */
.action-bar-row {
  display: flex;
  gap: 4px;
  margin: 4px 0;
}
.action-bar-extra:not(:empty) {
  margin: 4px 0;
}
.action-btn {
  flex: 1;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}
.action-btn:hover {
  background: var(--bg-primary);
}
.action-btn-danger {
  width: 100%;
  background: var(--accent-red, #f74a4a);
  border: none;
  color: #fff;
  padding: 6px 10px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  margin-top: 4px;
}
.action-btn-danger:hover {
  filter: brightness(1.1);
}
```

- [ ] **Step 3: Commit CSS**

```bash
cd E:/00_Git/05_MermaidAssist
git add mermaid-assist.html
git commit -m "feat(ui): generic .overlay-*.selected CSS + action-bar styles

ADR-021: replace enumerated .overlay-message / .overlay-note /
.overlay-group / .overlay-participant-handle selected rules with a
single [class*=\"overlay-\"].selected selector. New overlay-* classes
added by future modules are covered automatically.

Gantt's .overlay-bar is excluded from the hover rule via :not; its
selected-state uses a different mechanism and does not set .selected.

ADR-020: add .action-btn / .action-btn-danger / .action-bar-row /
.action-bar-extra styles consumed by properties.actionBarHtml."
```

---

## Task 9: Refactor Sequence participant panel to use helpers

**Files:**
- Modify: `src/modules/sequence.js`

- [ ] **Step 1: Locate the participant action bar (~line 1008–1055)**

Run: `cd E:/00_Git/05_MermaidAssist && grep -n "sel-part-left\|sel-part-right\|sel-part-delete" src/modules/sequence.js`
Expected: matches around lines 1012, 1013, 1015, 1035, 1043, 1051.

- [ ] **Step 2: Replace the hand-rolled HTML for the participant panel**

Find the block ending with `props.dangerButtonHtml('sel-part-delete', '参加者削除');` inside the `if (selType === 'participant') { ... }` branch.

Replace the HTML construction lines that produced `← 左へ / 右へ → / 参加者削除` (including the surrounding `<div style="display:flex;gap:4px;margin:8px 0;">` and the `dangerButtonHtml` tail):

**Before:**
```js
propsEl.innerHTML =
  props.panelHeaderHtml(part.label) +
  props.selectFieldHtml('種別', 'sel-part-kind', [ ... ]) +
  fieldHtml('ID', 'sel-part-id', part.id) +
  fieldHtml('ラベル', 'sel-part-label', part.label) +
  '<div style="display:flex;gap:4px;margin:8px 0;">' +
    '<button id="sel-part-left" style="...">← 左へ</button>' +
    '<button id="sel-part-right" style="...">右へ →</button>' +
  '</div>' +
  props.dangerButtonHtml('sel-part-delete', '参加者削除');
```

**After:**
```js
propsEl.innerHTML =
  props.panelHeaderHtml(part.label) +
  props.selectFieldHtml('種別', 'sel-part-kind', [ ... ]) +
  fieldHtml('ID', 'sel-part-id', part.id) +
  fieldHtml('ラベル', 'sel-part-label', part.label) +
  props.actionBarHtml('sel-part', {
    insertBefore: false, insertAfter: false,
    move: true,
    delete: true,
    labels: { up: '← 左へ', down: '右へ →', delete: '参加者削除' },
  });
```

- [ ] **Step 3: Replace the matching `props.bindEvent(...)` calls with `bindActionBar`**

Find the three `props.bindEvent('sel-part-left', ...)`, `props.bindEvent('sel-part-right', ...)`, `props.bindEvent('sel-part-delete', ...)` calls.

Replace them with a single:

```js
props.bindActionBar('sel-part', {
  up: function() {
    var newText = moveParticipantUp(ctx.getMmdText(), part.line);
    if (newText === ctx.getMmdText()) return;
    window.MA.history.pushHistory();
    ctx.setMmdText(newText);
    window.MA.selection.setSelected([{ type: 'participant', id: part.id }]);
    ctx.onUpdate();
  },
  down: function() {
    var newText = moveParticipantDown(ctx.getMmdText(), part.line);
    if (newText === ctx.getMmdText()) return;
    window.MA.history.pushHistory();
    ctx.setMmdText(newText);
    window.MA.selection.setSelected([{ type: 'participant', id: part.id }]);
    ctx.onUpdate();
  },
  'delete': function() {
    window.MA.history.pushHistory();
    ctx.setMmdText(deleteParticipant(ctx.getMmdText(), part.line));
    window.MA.selection.clearSelection();
    ctx.onUpdate();
  },
});
```

**Important:** the button IDs change from `sel-part-left` / `sel-part-right` to `sel-part-up` / `sel-part-down` (helper's naming). This is a documented break in the internal IDs; no external code references them.

- [ ] **Step 4: Run full test suite**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed` (sequence-updater tests don't assert on these IDs)

- [ ] **Step 5: Commit**

```bash
cd E:/00_Git/05_MermaidAssist
git add src/modules/sequence.js
git commit -m "refactor(sequence): participant panel via actionBarHtml helper

Port the sel-part panel from hand-rolled HTML + three bindEvent calls
to actionBarHtml + bindActionBar. The two move buttons switch from
sel-part-left/right to sel-part-up/down (helper's canonical naming);
labels ← 左へ / 右へ → are preserved via labels override so the user-
visible text is unchanged."
```

---

## Task 10: Refactor Sequence message / note / group panels

**Files:**
- Modify: `src/modules/sequence.js`

- [ ] **Step 1: Message panel — replace HTML + binds**

Find the message panel (`if (selType === 'message')`). The current HTML ends with `props.dangerButtonHtml('sel-msg-delete', 'メッセージ削除');` and is preceded by two flex `<div>` rows for insert-before/after and up/down.

**Replace the 2 flex rows + dangerButton** with:

```js
+ props.actionBarHtml('sel-msg', {
    insertBefore: true, insertAfter: true, move: true, delete: true,
    labels: { delete: 'メッセージ削除' },
  })
```

Then **replace the 5 `props.bindEvent(...)` calls** (`sel-msg-insert-before`, `sel-msg-insert-after`, `sel-msg-up`, `sel-msg-down`, `sel-msg-delete`) with one `props.bindActionBar('sel-msg', { ... })` call that merges all the existing handler bodies verbatim (use key names: `insertBefore`, `insertAfter`, `up`, `down`, `'delete'`).

- [ ] **Step 2: Note panel — replace HTML + binds**

Find the note panel (`if (selType === 'note')`). Replace the insert-before/after flex `<div>` + dangerButton with:

```js
+ props.actionBarHtml('sel-note', {
    insertBefore: true, insertAfter: true, move: false, delete: true,
    labels: { delete: '注釈削除' },
  })
```

Replace the 3 `props.bindEvent(...)` calls (`sel-note-insert-before`, `sel-note-insert-after`, `sel-note-delete`) with:

```js
props.bindActionBar('sel-note', {
  insertBefore: function() { _showInsertForm(ctx, note.line, 'before', 'message'); },
  insertAfter:  function() { _showInsertForm(ctx, note.line, 'after',  'message'); },
  'delete': function() {
    window.MA.history.pushHistory();
    ctx.setMmdText(window.MA.textUpdater.deleteLine(ctx.getMmdText(), note.line));
    window.MA.selection.clearSelection();
    ctx.onUpdate();
  },
});
```

- [ ] **Step 3: Group panel — replace delete button**

Find the group panel (`if (selType === 'group')`). Currently uses only `props.dangerButtonHtml('sel-grp-delete', ...)`.

Replace with:

```js
+ props.actionBarHtml('sel-grp', {
    insertBefore: false, insertAfter: false, move: false, delete: true,
    labels: { delete: 'ブロック削除 (中身は保持)' },
  })
```

Replace the single `props.bindEvent('sel-grp-delete', 'click', ...)` with:

```js
props.bindActionBar('sel-grp', {
  'delete': function() {
    // (existing body preserved exactly)
  },
});
```

- [ ] **Step 4: Run full test suite**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
cd E:/00_Git/05_MermaidAssist
git add src/modules/sequence.js
git commit -m "refactor(sequence): message/note/group panels via actionBar helpers

Port sel-msg / sel-note / sel-grp action-bars to actionBarHtml +
bindActionBar. Handler bodies are preserved verbatim inside the new
bindActionBar call, only the HTML scaffolding and event registration
shape changes."
```

---

## Task 11: Visual regression — Sequence

**Files:**
- Create (ad-hoc): `.eval/tier2-action-bar/seq-participant.png`, `seq-message.png`, `seq-note.png`, `seq-group.png`

- [ ] **Step 1: Start dev server in background**

```bash
cd E:/00_Git/05_MermaidAssist
python -m http.server 8767 &
```

Expected: background process started on port 8767.

- [ ] **Step 2: Use Playwright MCP to exercise each Sequence selection and capture screenshot**

For each of the 4 selection kinds (participant / message / note / group):

1. Navigate to `http://127.0.0.1:8767/mermaid-assist.html?v=tier2-${TIMESTAMP}`
2. Switch diagram type to `sequenceDiagram`.
3. Load a sample DSL that exercises the kind (e.g., for group: `sequenceDiagram\n    A\n    B\n    alt ok\n        A->>B: x\n    end`).
4. Click the corresponding overlay rect to select.
5. Confirm the panel renders with the correct buttons + labels, and the overlay has the green dashed `.selected` highlight.
6. `mcp__playwright__browser_take_screenshot` → save to `.eval/tier2-action-bar/seq-<kind>.png`.

- [ ] **Step 3: Verify move + delete click behaviour for message**

Using `mcp__playwright__browser_click` or `mcp__playwright__browser_evaluate`:

1. Select a message, read its label.
2. Click `sel-msg-up` (the helper's new ID).
3. Verify the DSL text reordered and the panel still shows the same label (selection followed the move).
4. Click `sel-msg-delete`, verify the message line is gone and selection cleared.

- [ ] **Step 4: Commit screenshots**

```bash
cd E:/00_Git/05_MermaidAssist
git add .eval/tier2-action-bar/
git commit -m "test(visual): Sequence panels after action-bar refactor

Captures post-refactor snapshots of participant / message / note /
group edit panels plus move-up + delete click flows. No user-visible
regression versus pre-refactor."
```

- [ ] **Step 5: Stop dev server**

Kill the Python http.server background process.

---

## Task 12: PR-β1 flowchart — add `moveNode` helpers

**Files:**
- Modify: `src/modules/flowchart.js`

- [ ] **Step 1: Add `moveNodeUp` / `moveNodeDown` before `deleteNode`**

Locate `function deleteNode(text, lineNum)` (around line 252). Insert **before** it:

```js
  // moveNodeUp / moveNodeDown: swap with the previous / next line that is
  // also a node definition. Non-node lines (edges, subgraph boundaries,
  // blanks, comments) are skipped; if the nearest same-kind line does not
  // exist, the call is a no-op.
  function _isNodeLine(trimmed) {
    // Node definitions: "id[...]" or "id(...)" or "id{...}" or bare "id"
    // Edges contain arrow markers like -->, ---, -.-, etc.
    if (!trimmed) return false;
    if (trimmed.indexOf('%%') === 0) return false;
    if (/-->|---|-\.-|==>|===|--x|--o/.test(trimmed)) return false;  // edge
    if (/^(subgraph|end|flowchart|graph|direction|classDef|class\s|style\s|linkStyle|click\s)/i.test(trimmed)) return false;
    return /^\w/.test(trimmed);  // starts with an identifier
  }

  function _moveNodeStep(text, lineNum, direction) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var target = idx + direction;
    while (target >= 0 && target < lines.length) {
      var t = lines[target].trim();
      if (!t || t.indexOf('%%') === 0) { target += direction; continue; }
      if (_isNodeLine(t)) {
        var tmp = lines[idx];
        lines[idx] = lines[target];
        lines[target] = tmp;
        return lines.join('\n');
      }
      return text;  // hit a non-node line → no-op (Tier 3 may relax)
    }
    return text;
  }

  function moveNodeUp(text, lineNum) { return _moveNodeStep(text, lineNum, -1); }
  function moveNodeDown(text, lineNum) { return _moveNodeStep(text, lineNum, 1); }
```

- [ ] **Step 2: Export the new move functions**

Find `deleteNode: deleteNode,` in the `return { ... }` block (around line 735). Add:

```js
    deleteNode: deleteNode,
    moveNodeUp: moveNodeUp,
    moveNodeDown: moveNodeDown,
```

- [ ] **Step 3: Run tests** (nothing should break — no call-sites yet)

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed`

---

## Task 13: PR-β1 flowchart — wire action-bar on `sel-node`

**Files:**
- Modify: `src/modules/flowchart.js`

- [ ] **Step 1: Replace `sel-node-delete` dangerButton with actionBarHtml**

In the `if (selData.length === 1 && selData[0].type === 'node') { ... }` branch (around line 597), find:

```js
window.MA.properties.dangerButtonHtml('sel-node-delete', 'ノード削除');
```

Replace with:

```js
window.MA.properties.actionBarHtml('sel-node', {
  insertBefore: false, insertAfter: false,   // Tier 4: modal insert form
  move: true,
  delete: true,
  labels: { delete: 'ノード削除' },
})
```

- [ ] **Step 2: Replace the single delete bind with bindActionBar**

Find the existing `document.getElementById('sel-node-delete').addEventListener('click', ...)` (around line 630). Replace with:

```js
window.MA.properties.bindActionBar('sel-node', {
  up: function() {
    var newText = moveNodeUp(ctx.getMmdText(), node.line);
    if (newText === ctx.getMmdText()) return;
    window.MA.history.pushHistory();
    ctx.setMmdText(newText);
    window.MA.selection.setSelected([{ type: 'node', id: node.id }]);
    ctx.onUpdate();
  },
  down: function() {
    var newText = moveNodeDown(ctx.getMmdText(), node.line);
    if (newText === ctx.getMmdText()) return;
    window.MA.history.pushHistory();
    ctx.setMmdText(newText);
    window.MA.selection.setSelected([{ type: 'node', id: node.id }]);
    ctx.onUpdate();
  },
  'delete': function() {
    window.MA.history.pushHistory();
    ctx.setMmdText(deleteNode(ctx.getMmdText(), node.line));
    window.MA.selection.clearSelection();
    ctx.onUpdate();
  },
});
```

- [ ] **Step 3: Similarly wire `sel-edge` with move=false, delete=true**

In the `if (selData.length === 1 && selData[0].type === 'edge') { ... }` branch, replace:

```js
window.MA.properties.dangerButtonHtml('sel-edge-delete', 'エッジ削除');
```

with:

```js
window.MA.properties.actionBarHtml('sel-edge', {
  insertBefore: false, insertAfter: false,
  move: false,
  delete: true,
  labels: { delete: 'エッジ削除' },
})
```

Replace the `document.getElementById('sel-edge-delete').addEventListener('click', ...)` with:

```js
window.MA.properties.bindActionBar('sel-edge', {
  'delete': function() {
    window.MA.history.pushHistory();
    ctx.setMmdText(deleteEdge(ctx.getMmdText(), edge.line));
    window.MA.selection.clearSelection();
    ctx.onUpdate();
  },
});
```

- [ ] **Step 4: Run tests**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed`

---

## Task 14: PR-β1 flowchart — visual verification + commit

**Files:**
- Create: `.eval/tier2-action-bar/flowchart-node.png`, `flowchart-edge.png`

- [ ] **Step 1: Start dev server**

```bash
cd E:/00_Git/05_MermaidAssist && python -m http.server 8767 &
```

- [ ] **Step 2: Playwright MCP — flowchart node selection**

1. Navigate `http://127.0.0.1:8767/mermaid-assist.html?v=fc-${TIMESTAMP}`
2. Set diagram type to `flowchart`
3. Load sample DSL:
   ```
   flowchart TD
       A[Start]
       B[Middle]
       C[End]
       A --> B
       B --> C
   ```
4. Click node B overlay → verify panel has ↑上へ / ↓下へ / ノード削除 buttons, node B overlay has green dashed `.selected`.
5. Click ↑上へ → verify DSL reorders A and B.
6. Screenshot → `.eval/tier2-action-bar/flowchart-node.png`.

- [ ] **Step 3: Playwright MCP — flowchart edge selection**

1. On the same diagram, click an edge overlay.
2. Verify panel has エッジ削除 button (no move buttons), edge overlay has green `.selected`.
3. Screenshot → `.eval/tier2-action-bar/flowchart-edge.png`.

- [ ] **Step 4: Commit + push**

```bash
cd E:/00_Git/05_MermaidAssist
git add src/modules/flowchart.js .eval/tier2-action-bar/flowchart-*.png
git commit -m "feat(flowchart): action-bar on sel-node/sel-edge panels

Tier 2 PR-β1. sel-node gains ↑上へ / ↓下へ / ノード削除 via shared
helpers; sel-edge gets エッジ削除 (move=false since edge ordering is
not user-meaningful in flowchart). Module adds private moveNodeUp /
moveNodeDown that swap with the nearest same-kind line.

Insert-before/after deferred to Tier 4 (modal form port).

Visual: .eval/tier2-action-bar/flowchart-*.png captures panel + green
.selected highlight on node and edge."
git push -u origin feat/tier2-action-bar-common-ui
```

- [ ] **Step 5: Stop dev server**

---

## Task 15: PR-β2 state — add `moveStateUp/Down`

**Files:**
- Modify: `src/modules/state.js`

- [ ] **Step 1: Add move helpers (paste the same skeleton, adapted)**

Locate `function deleteState(text, lineNum)`. Insert before it:

```js
  function _isStateLine(trimmed) {
    if (!trimmed) return false;
    if (trimmed.indexOf('%%') === 0) return false;
    if (/-->|--x|-.->/.test(trimmed)) return false;  // transition
    if (/^(stateDiagram|state\s+"|direction|\[\*\]|note\s|}\s*$|{)/i.test(trimmed)) return false;
    return /^\w/.test(trimmed);
  }

  function _moveStateStep(text, lineNum, direction) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var target = idx + direction;
    while (target >= 0 && target < lines.length) {
      var t = lines[target].trim();
      if (!t || t.indexOf('%%') === 0) { target += direction; continue; }
      if (_isStateLine(t)) {
        var tmp = lines[idx];
        lines[idx] = lines[target];
        lines[target] = tmp;
        return lines.join('\n');
      }
      return text;
    }
    return text;
  }

  function moveStateUp(text, lineNum) { return _moveStateStep(text, lineNum, -1); }
  function moveStateDown(text, lineNum) { return _moveStateStep(text, lineNum, 1); }
```

- [ ] **Step 2: Export**

Add to the return object:

```js
    moveStateUp: moveStateUp,
    moveStateDown: moveStateDown,
```

- [ ] **Step 3: Run tests**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed`

---

## Task 16: PR-β2 state — wire action-bar on sel-state / sel-tr

**Files:**
- Modify: `src/modules/state.js`

- [ ] **Step 1: Replace `sel-state-delete` with actionBarHtml (move=true)**

Locate `P.dangerButtonHtml('sel-state-delete', '状態削除');` (around line 399). Replace with:

```js
P.actionBarHtml('sel-state', {
  insertBefore: false, insertAfter: false,
  move: true, delete: true,
  labels: { delete: '状態削除' },
})
```

Replace the corresponding `addEventListener('click', ...)` on `sel-state-delete` (and any existing move buttons) with `P.bindActionBar('sel-state', { up: ..., down: ..., 'delete': ... })` following the Task 13 pattern. Substitute `moveStateUp` / `moveStateDown` / `deleteState` / `state.line` / `state.id` / `type: 'state'`.

- [ ] **Step 2: Replace `sel-tr-delete` with actionBarHtml (move=false)**

Locate `P.dangerButtonHtml('sel-tr-delete', '遷移削除');` (around line 436). Replace with:

```js
P.actionBarHtml('sel-tr', {
  insertBefore: false, insertAfter: false,
  move: false, delete: true,
  labels: { delete: '遷移削除' },
})
```

Replace the corresponding delete click handler with `P.bindActionBar('sel-tr', { 'delete': function() { ... } })`.

- [ ] **Step 3: Run tests**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed`

---

## Task 17: PR-β2 state — visual verify + commit

**Files:**
- Create: `.eval/tier2-action-bar/state-state.png`, `state-transition.png`

- [ ] **Step 1: Playwright MCP — state selection**

Sample DSL:
```
stateDiagram-v2
    [*] --> S1
    S1 --> S2
    S2 --> [*]
```

Select S1 → verify panel + ↑上へ/↓下へ/状態削除 + green `.selected` highlight → screenshot.

- [ ] **Step 2: Playwright MCP — transition selection**

Select the `S1 --> S2` transition → verify 遷移削除 only + green `.selected` → screenshot.

- [ ] **Step 3: Commit + push**

```bash
cd E:/00_Git/05_MermaidAssist
git add src/modules/state.js .eval/tier2-action-bar/state-*.png
git commit -m "feat(state): action-bar on sel-state/sel-tr panels

Tier 2 PR-β2. sel-state: move + delete. sel-tr: delete only. Adds
moveStateUp / moveStateDown helpers that skip transitions and composite-
state braces so \"上へ/下へ\" stays within the state list."
git push
```

---

## Task 18: PR-β3 class — add `moveClassUp/Down`

**Files:**
- Modify: `src/modules/class.js`

- [ ] **Step 1: Add move helpers**

Before `function deleteClass`:

```js
  function _isClassLine(trimmed) {
    if (!trimmed) return false;
    if (trimmed.indexOf('%%') === 0) return false;
    if (/<\|--|--\|>|<--|-->|--\*|\*--|--o|o--|\.\.|\.\./.test(trimmed)) return false;  // relation
    if (/^(classDiagram|class\s+".*"|direction|note\s|}\s*$)/i.test(trimmed)) return false;
    return /^(class\s+\w|\w+\s*:)/i.test(trimmed);
  }

  function _moveClassStep(text, lineNum, direction) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var target = idx + direction;
    while (target >= 0 && target < lines.length) {
      var t = lines[target].trim();
      if (!t || t.indexOf('%%') === 0) { target += direction; continue; }
      if (_isClassLine(t)) {
        var tmp = lines[idx];
        lines[idx] = lines[target];
        lines[target] = tmp;
        return lines.join('\n');
      }
      return text;
    }
    return text;
  }

  function moveClassUp(text, lineNum) { return _moveClassStep(text, lineNum, -1); }
  function moveClassDown(text, lineNum) { return _moveClassStep(text, lineNum, 1); }
```

- [ ] **Step 2: Export**

Add to return object:

```js
    moveClassUp: moveClassUp,
    moveClassDown: moveClassDown,
```

- [ ] **Step 3: Run tests**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed`

---

## Task 19: PR-β3 class — wire action-bar on sel-class / sel-rel

**Files:**
- Modify: `src/modules/class.js`

- [ ] **Step 1: Replace `sel-class-delete`**

Find `props.dangerButtonHtml('sel-class-delete', 'クラス削除');` (around line 460). Replace with `props.actionBarHtml('sel-class', { insertBefore: false, insertAfter: false, move: true, delete: true, labels: { delete: 'クラス削除' } })`. Replace the matching click handler block with `props.bindActionBar('sel-class', { up, down, 'delete' })` calling `moveClassUp / moveClassDown / deleteClass` with `cls.line` / `cls.id` / `type: 'class'`.

- [ ] **Step 2: Replace `sel-rel-delete`**

Find `props.dangerButtonHtml('sel-rel-delete', '関連削除');` (around line 497). Replace with `props.actionBarHtml('sel-rel', { insertBefore: false, insertAfter: false, move: false, delete: true, labels: { delete: '関連削除' } })` and `props.bindActionBar('sel-rel', { 'delete': function() { ... } })`.

- [ ] **Step 3: Run tests**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed`

---

## Task 20: PR-β3 class — visual verify + commit

**Files:**
- Create: `.eval/tier2-action-bar/class-class.png`, `class-relation.png`

- [ ] **Step 1: Playwright MCP**

Sample DSL:
```
classDiagram
    class Animal
    class Dog
    Animal <|-- Dog
```

Select Animal → verify panel + move + delete + green highlight → screenshot. Select relation → 関連削除 only → screenshot.

- [ ] **Step 2: Commit + push**

```bash
cd E:/00_Git/05_MermaidAssist
git add src/modules/class.js .eval/tier2-action-bar/class-*.png
git commit -m "feat(class): action-bar on sel-class/sel-rel panels

Tier 2 PR-β3."
git push
```

---

## Task 21: PR-β4 er — add `moveEntityUp/Down`

**Files:**
- Modify: `src/modules/er.js`

- [ ] **Step 1: Add move helpers**

Before `function deleteEntity` (around line 115):

```js
  function _isEntityLine(trimmed) {
    if (!trimmed) return false;
    if (trimmed.indexOf('%%') === 0) return false;
    if (/\|\||}o|o{|\|\{|}\||\.\./.test(trimmed)) return false;  // relationship cardinality
    if (/^(erDiagram|}\s*$|{)/i.test(trimmed)) return false;
    return /^\w+\s*\{?\s*$/i.test(trimmed);
  }

  function _moveEntityStep(text, lineNum, direction) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var target = idx + direction;
    while (target >= 0 && target < lines.length) {
      var t = lines[target].trim();
      if (!t || t.indexOf('%%') === 0) { target += direction; continue; }
      if (_isEntityLine(t)) {
        var tmp = lines[idx];
        lines[idx] = lines[target];
        lines[target] = tmp;
        return lines.join('\n');
      }
      return text;
    }
    return text;
  }

  function moveEntityUp(text, lineNum) { return _moveEntityStep(text, lineNum, -1); }
  function moveEntityDown(text, lineNum) { return _moveEntityStep(text, lineNum, 1); }
```

- [ ] **Step 2: Export**

Add to return object:

```js
    moveEntityUp: moveEntityUp,
    moveEntityDown: moveEntityDown,
```

- [ ] **Step 3: Run tests**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed`

---

## Task 22: PR-β4 er — wire action-bar on sel-ent / sel-rel

**Files:**
- Modify: `src/modules/er.js`

- [ ] **Step 1: Replace `sel-ent-delete`**

Find `P.dangerButtonHtml('sel-ent-delete', 'エンティティ削除');` (around line 341). Replace with `P.actionBarHtml('sel-ent', { insertBefore: false, insertAfter: false, move: true, delete: true, labels: { delete: 'エンティティ削除' } })` and a matching `P.bindActionBar('sel-ent', { up, down, 'delete' })` using `moveEntityUp / moveEntityDown / deleteEntity` with `ent.line` / `ent.id` / `type: 'entity'`.

- [ ] **Step 2: Replace `sel-rel-delete`** (er's sel-rel, not class's)

Find `P.dangerButtonHtml('sel-rel-delete', 'リレーションシップ削除');` (around line 383). Replace with `P.actionBarHtml('sel-rel', { insertBefore: false, insertAfter: false, move: false, delete: true, labels: { delete: 'リレーションシップ削除' } })` + `P.bindActionBar('sel-rel', { 'delete': ... })`.

- [ ] **Step 3: Run tests**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed`

---

## Task 23: PR-β4 er — visual verify + commit

**Files:**
- Create: `.eval/tier2-action-bar/er-entity.png`, `er-relationship.png`

- [ ] **Step 1: Playwright MCP**

Sample DSL:
```
erDiagram
    CUSTOMER { string name }
    ORDER { int id }
    CUSTOMER ||--o{ ORDER : places
```

Select CUSTOMER → panel + move + delete + highlight → screenshot. Select relationship → delete only → screenshot.

- [ ] **Step 2: Commit + push**

```bash
cd E:/00_Git/05_MermaidAssist
git add src/modules/er.js .eval/tier2-action-bar/er-*.png
git commit -m "feat(er): action-bar on sel-ent/sel-rel panels

Tier 2 PR-β4."
git push
```

---

## Task 24: PR-β5 timeline — add `movePeriodUp/Down`

**Files:**
- Modify: `src/modules/timeline.js`

- [ ] **Step 1: Add move helpers**

Locate where periods are added/deleted (search `addPeriod` or similar). Before the delete function, insert:

```js
  function _isPeriodLine(trimmed) {
    if (!trimmed) return false;
    if (trimmed.indexOf('%%') === 0) return false;
    if (/^(timeline|title\s|section\s)/i.test(trimmed)) return false;
    return /:/.test(trimmed);  // timeline events have the form "2023 : Event text"
  }

  function _movePeriodStep(text, lineNum, direction) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var target = idx + direction;
    while (target >= 0 && target < lines.length) {
      var t = lines[target].trim();
      if (!t || t.indexOf('%%') === 0) { target += direction; continue; }
      if (_isPeriodLine(t)) {
        var tmp = lines[idx];
        lines[idx] = lines[target];
        lines[target] = tmp;
        return lines.join('\n');
      }
      return text;
    }
    return text;
  }

  function movePeriodUp(text, lineNum) { return _movePeriodStep(text, lineNum, -1); }
  function movePeriodDown(text, lineNum) { return _movePeriodStep(text, lineNum, 1); }
```

- [ ] **Step 2: Export**

Add to return object:

```js
    movePeriodUp: movePeriodUp,
    movePeriodDown: movePeriodDown,
```

- [ ] **Step 3: Run tests**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed`

---

## Task 25: PR-β5 timeline — wire action-bar on tl-edit-sec / tl-edit-p

**Files:**
- Modify: `src/modules/timeline.js`

- [ ] **Step 1: Replace `tl-edit-sec-delete` (section)** — `move: false`

Find `P.dangerButtonHtml('tl-edit-sec-delete', 'セクション削除');` (around line 301). Replace with:

```js
P.actionBarHtml('tl-edit-sec', {
  insertBefore: false, insertAfter: false,
  move: false, delete: true,
  labels: { delete: 'セクション削除' },
})
```

Replace its click handler with `P.bindActionBar('tl-edit-sec', { 'delete': function() { ... } })`.

- [ ] **Step 2: Replace `tl-edit-p-delete` (period)** — `move: true`

Find `P.dangerButtonHtml('tl-edit-p-delete', 'ピリオド削除');` (around line 339). Replace with:

```js
P.actionBarHtml('tl-edit-p', {
  insertBefore: false, insertAfter: false,
  move: true, delete: true,
  labels: { delete: 'ピリオド削除' },
})
```

Replace with `P.bindActionBar('tl-edit-p', { up, down, 'delete' })` using `movePeriodUp / movePeriodDown` and the existing period delete body. Use the period's identifier (likely `period.id` or an index) and `type: 'period'` to match the existing selection scheme (confirm by reading the surrounding code).

- [ ] **Step 3: Run tests**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed`

---

## Task 26: PR-β5 timeline — visual verify + commit

**Files:**
- Create: `.eval/tier2-action-bar/timeline-period.png`, `timeline-section.png`

- [ ] **Step 1: Playwright MCP**

Sample DSL:
```
timeline
    title History
    section 20th
        1903 : First flight
        1969 : Moon landing
    section 21st
        2008 : iPhone 3G
```

Select a period (e.g. `1903 : First flight`) → panel + move + delete + highlight → screenshot. Select a section header → delete only → screenshot.

- [ ] **Step 2: Commit + push**

```bash
cd E:/00_Git/05_MermaidAssist
git add src/modules/timeline.js .eval/tier2-action-bar/timeline-*.png
git commit -m "feat(timeline): action-bar on tl-edit-sec/tl-edit-p panels

Tier 2 PR-β5."
git push
```

---

## Task 27: Cross-module sweep + PR description

**Files:**
- git / GitHub PR

- [ ] **Step 1: Full regression run on all modules**

Start dev server, navigate to each of: sequenceDiagram / flowchart / stateDiagram-v2 / classDiagram / erDiagram / timeline. Load a minimal sample. Select each primary element type, confirm:
- `.selected` green dashed highlight appears on the overlay
- action-bar buttons render with correct labels
- ↑上へ / ↓下へ / 削除 each produce the expected DSL mutation (or the module's labelled equivalent ← 左へ / 右へ → for Sequence participant)

Take one consolidated screenshot per module showing a selected element.

- [ ] **Step 2: Full test suite**

Run: `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js 2>&1 | tail -2`
Expected: `379 passed, 0 failed`

- [ ] **Step 3: Push the branch (if not already) and open a PR on GitHub**

```bash
cd E:/00_Git/05_MermaidAssist
git push -u origin feat/tier2-action-bar-common-ui
gh pr create --base master --head feat/tier2-action-bar-common-ui \
  --title "Tier 2: action-bar helper + overlay-selected CSS 共通化" \
  --body "$(cat <<'EOF'
## Summary
Tier 2 の共通 UI 基盤実装 (spec: docs/superpowers/specs/2026-04-24-tier2-action-bar-common-ui-design.md)。

### PR-α (内包 commit a-g)
- \`window.MA.properties.actionBarHtml(idPrefix, opts)\` / \`bindActionBar(idPrefix, handlers)\` 追加 (ADR-020 / ADR-022)
- mermaid-assist.html に \`#overlay-layer [class*=\"overlay-\"].selected\` 汎用 CSS + action-bar styles 追加 (ADR-021)
- Sequence の participant / message / note / group action-bar を helper 経由に refactor
- tests/properties.test.js 新規 (8 件)

### PR-β1〜β5 (内包 commit h-o)
- flowchart sel-node / sel-edge
- state sel-state / sel-tr
- class sel-class / sel-rel
- er sel-ent / sel-rel
- timeline tl-edit-sec / tl-edit-p

全モジュールで move (対象がある kind のみ) + delete を helper 経由に統一。insertBefore / insertAfter は Tier 4 で modal insert form を各モジュールに足すタイミングで有効化予定 (helper は既に受け入れ可能)。

## Test plan
- [x] \`node tests/run-tests.js\` — 379 passed / 0 failed
- [x] Playwright MCP: Sequence 4 種 / flowchart 2 種 / state 2 種 / class 2 種 / er 2 種 / timeline 2 種 = 14 パネル確認済、スクショ \`.eval/tier2-action-bar/\` 保存
- [x] CSS regression: Gantt overlay-bar が緑点線化しないこと (\`.selected\` クラス非付与)

## Out of scope
- Tier 3: move safety / reselect helper の共通化 (別 spec)
- Tier 4: rich-label / multi-select wrap の他モジュール適用 (別 spec)
- Gantt: 既存 date-drag UI を尊重、対象外
EOF
)"
```

Expected: PR URL returned by `gh pr create`.

---

## Self-Review

**1. Spec coverage**
- ✅ `actionBarHtml` helper追加 → Task 3
- ✅ `bindActionBar` helper追加 → Task 6
- ✅ overlay-*.selected 汎用 CSS → Task 8
- ✅ Sequence 移行 → Tasks 9, 10
- ✅ flowchart/state/class/er/timeline 適用 → Tasks 12-26
- ✅ ADR-020/021/022 → 既にコミット e277e7a で導入済 (spec と同時)
- ✅ Out-of-scope の明記 (insertBefore/Afterは Tier 4、Gantt は対象外) → Plan 冒頭

**2. Placeholder scan**
- 検索: "TBD", "TODO" (plan内), "implement later" → 0 件 (Tier 4 と書かれている箇所は out-of-scope として明示済)

**3. Type consistency**
- `actionBarHtml` の opts キー (`insertBefore`, `insertAfter`, `move`, `delete`, `labels`) は Task 3 実装と Task 4/5/6/... の呼び出しで一貫
- `bindActionBar` の handlers キー (`insertBefore`, `insertAfter`, `up`, `down`, `delete`) も一貫
- 各モジュールの move 関数名 (`moveNodeUp`, `moveStateUp`, `moveClassUp`, `moveEntityUp`, `movePeriodUp`) は 12/15/18/21/24 で定義 → 13/16/19/22/25 の呼び出しと一致
- prefix 命名 (sel-node / sel-edge / sel-state / sel-tr / sel-class / sel-rel / sel-ent / sel-rel / tl-edit-sec / tl-edit-p) は ADR-022 の規則に沿う (`sel-rel` が class と er で重複するが、モジュール毎に独立レンダリングのため衝突しない)
