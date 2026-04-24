# Tier2 Phase 5: Gitgraph Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Gitgraph モジュール実装、v1.7.0 リリース (Tier2 完備)
**Branch:** `tier2/phase5-gitgraph`

## Task 1: Branch + verify + parser + skeleton
- branch, Playwright verify gitGraph render
- detect `gitGraph` in parser-utils
- `src/modules/gitgraph.js` with parse: commit (id/type/tag)、branch、checkout、merge、cherry-pick
- Track current branch through checkout/branch statements
- Unit tests ~10 cases
- Commit

## Task 2: Updaters
- addCommit (id/type/tag options)
- addBranch / addCheckout / addMerge (tag option) / addCherryPick
- updateCommit (id/type/tag)
- deleteLine
- moveUp/moveDown
- Unit tests ~10 cases
- Commit

## Task 3: renderProps
- 5 vertical add forms (commit / branch / checkout / merge / cherry-pick)
- Detail panels for each kind (editable id/type/tag/target as appropriate)
- List view showing all lines with kind badge
- Commit

## Task 4: HTML wire + E2E (E57-E66)
- option + script
- E2E: switch, render, 5 adds, update commit, delete
- Commit

## Task 5: Visual sweep + GitFlow scenario
- Visual: default + branch+merge + cherry-pick + commit type variations
- Scenario: 4-branch GitFlow (main/develop/feature/release) with commits/merges
- Commit eval

## Task 6: ECN-018 + merge + v1.7.0 tag (Tier2 完備)
