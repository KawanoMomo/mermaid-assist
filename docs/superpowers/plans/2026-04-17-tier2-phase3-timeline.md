# Tier2 Phase 3: Timeline Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Timeline モジュールを実装し v1.5.0 リリース。
**Branch:** `tier2/phase3-timeline`

## Task 1: Branch + verify + detect + parser + skeleton
- Create branch from master
- Verify mermaid timeline render (Playwright headless)
- Add `timeline` detect in parser-utils
- Create `src/modules/timeline.js` with parse (title/section/period/event)
- Register in run-tests.js
- Unit tests ~8 cases
- Commit "feat(timeline): skeleton + parse"

## Task 2: Updaters
- setTitle / addSection / addPeriod / addEvent (to period) / delete (title/section/period/event) / updateField / moveUp/Down
- Unit tests ~10 cases
- Commit "feat(timeline): updaters"

## Task 3: renderProps
- Title field
- Add Section / Add Period / Add Event forms (vertical, labeled)
- Detail panels (section / period / event)
- Commit "feat(timeline): renderProps"

## Task 4: HTML wire + E2E
- `<option value="timeline">Timeline</option>` and script tag
- E2E ~8 cases (E41-E48): switch, render, add section/period/event, update, delete, vertical labels
- Commit "chore+test: HTML wire + E2E timeline"

## Task 5: Visual sweep + release plan scenario
- evaluator visual sweep
- Project release plan scenario (3 sections × 3-4 periods)
- Commit eval artifacts

## Task 6: ECN-016 + merge + v1.5.0 tag
