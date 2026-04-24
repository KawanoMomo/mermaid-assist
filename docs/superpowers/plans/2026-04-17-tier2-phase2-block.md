# Tier2 Phase 2: Block Diagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Block Diagram モジュール `src/modules/block.js` を実装し v1.4.0 をリリース。

**Architecture:** Flowchart モジュールを骨格として流用、DiagramModule v2 準拠、properties helpers + 縦並び form (ECN-013)、Phase 1 で確立した auto-quote pattern 踏襲 (label に空白含む場合)。

**Branch:** `tier2/phase2-block`

---

## ファイル構成

- Create: `src/modules/block.js`, `tests/block-parser.test.js`, `tests/block-updater.test.js`, `tests/e2e/block-basic.spec.js`
- Modify: `src/core/parser-utils.js` (detect), `mermaid-assist.html` (option + script), `tests/run-tests.js` (sourceFiles)
- Docs: `docs/ecn/ECN-015_tier2-phase2-block.md`, update `docs/ecn/README.md`
- Eval: `.eval/v1.4.0/visual-sweep-v1.4.0/`, `.eval/v1.4.0/usecase-ecu-hw/`

## Task 1: Branch + mermaid verify + detect + skeleton

- Create branch `tier2/phase2-block` from master
- Quick Playwright verification of `block-beta` rendering (headless, 1 basic diagram)
- Add `detect` for `block-beta` in `src/core/parser-utils.js`
- Create `src/modules/block.js` skeleton with parse (block standalone / nested / columns / link)
- Register in `tests/run-tests.js` sourceFiles
- Commit: "feat(block): module skeleton + parse"

**parse output shape:**
```js
{ meta: { columns: N }, elements: [{ kind: 'block'|'group', id, label, parentId, line }], relations: [{ id, from, to, label, line }] }
```

## Task 2: Updaters

- `addBlock(text, id, label)` — append at end, preserves indentation for context
- `addNestedBlock(text, parentId, id, label)` — insert inside parent's `block:parent ... end` (create group if parent is standalone)
- `addLink(text, from, to, label)` — append `A --> B` or `A -- label --> B`
- `deleteElement(text, lineNum, blockId)` — remove block + cascade links referencing blockId
- `deleteLink(text, lineNum)` — remove single line
- `updateBlockLabel(text, lineNum, newLabel)` — handle label in brackets
- `updateLink(text, lineNum, field, value)` — from/to/label
- `setColumns(text, n)` — ensure `columns N` present, replace if already exists
- Unit tests (~15 cases)
- Commit: "feat(block): updaters"

## Task 3: renderProps (list + detail)

- List view: 3 sections (Add Block / Add Link / Set Columns) + 2 lists (blocks / links)
- Add forms: ECN-013/ADR-015 縦並び pattern
- Block detail: Name / Label / 削除 / ↑↓
- Link detail: From / To / Label / 削除
- Uses `var P = window.MA.properties` alias (ECN-013 教訓)
- Commit: "feat(block): renderProps"

## Task 4: HTML wire + E2E

- HTML option `<option value="block-beta">Block</option>` (or appropriate type)
- HTML script `<script src="src/modules/block.js"></script>`
- E2E `tests/e2e/block-basic.spec.js` (~8 cases: switch, render, 3 add forms, update, delete, vertical labels)
- Commit: "chore+test: HTML wire + E2E block"

## Task 5: Visual sweep + ECU HW scenario

- evaluator: `127.0.0.1:8765/mermaid-assist.html`, `Network.clearBrowserCache` first
  - default template render, console 0
  - columns 1 / 2 / 3 / 4 render
  - nested block render
  - link with/without label render
- ECU HW scenario: Sensor (3 blocks) + MCU (1 block, nested into `block:mcu`) + Actuator (2 blocks) + 6 links
- Commit eval artifacts

## Task 6: ECN-015 + v1.4.0 release

- Write ECN-015 
- Update `docs/ecn/README.md`
- master merge, v1.4.0 tag (local only, push defer)
- Commit docs
