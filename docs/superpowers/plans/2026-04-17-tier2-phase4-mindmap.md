# Tier2 Phase 4: Mindmap Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Mindmap モジュール実装、v1.6.0 リリース
**Branch:** `tier2/phase4-mindmap`

## Task 1: Branch + verify + parser + skeleton
- branch, Playwright verify mindmap render
- detect `mindmap` in parser-utils
- `src/modules/mindmap.js` skeleton with indent-based parse
  - parse: root node / child nodes at each indent level / shapes (6種) / icon lines / class
  - build `level` (indent/2), `parentId` via stack-based walk
- Unit tests ~8 cases
- Commit

## Task 2: Updaters
- addChild / addSibling / indent / outdent / updateText / updateShape / setIcon / deleteNode (cascade subtree) / moveUp/Down
- Unit tests ~10 cases
- Commit

## Task 3: renderProps
- Tree-style list (indented view) showing all nodes
- Add Child form (選択親 + Text + Shape)
- Add Sibling form (after tree, appears when selection is a node)
- 詳細: Text / Shape / Icon / indent/outdent ボタン / 削除
- Commit

## Task 4: HTML wire + E2E (E49-E56)
- option + script
- E2E: switch, render, add child, add sibling, indent, outdent, update shape, delete
- Commit

## Task 5: Visual sweep + embedded design scenario
- Visual: default + each shape + icon
- Scenario: 組み込み設計ブレスト (3 levels, multiple branches, 1 icon)
- Commit eval

## Task 6: ECN-017 + merge + v1.6.0 tag
