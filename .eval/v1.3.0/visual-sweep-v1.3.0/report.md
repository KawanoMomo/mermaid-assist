# v1.3.0 Visual Sweep Report — Tier2 Phase 1 Requirement Diagram

## 概要

- **実施日**: 2026-04-17
- **対象**: Tier2 Phase 1 Requirement Diagram
- **最終判定**: **PASS** (fix後・キャッシュクリア後)

## 環境

- dev_server_url: `http://127.0.0.1:8765/mermaid-assist.html`
- 初回 commit: `d4a8359` (fix(requirement): auto-quote id/text/type/docref)
- 修正 commit: `577a106` (fix(app): merge missing methods from external modules into inline gantt)
- browser: Playwright default chromium

## 経緯

### 初回: FAIL
`TypeError: mod.template is not a function` が diagram-type 切替時 (gantt へ) に発生。EV-VS1〜EV-VS6 個別は全 PASS だが、クロス操作で console error 検出 → FAIL。

**Root cause**: `src/app.js:71-79` `_registerWindowModules` が既存スロットをスキップする実装だったため、inline `modules.gantt` (template 無し) が外部 `window.MA.modules.gantt` (template 有り) を上書き保護。

### Fix
`_registerWindowModules` を merge 方式に変更 (既存スロットに欠落プロパティを追加)。commit `577a106`。

### 再 sweep: PASS

| EV | シナリオ | 結果 |
|---|---|---|
| EV-VS-RETRY-1 | デフォルトテンプレート + property panel UI | PASS |
| EV-VS-RETRY-2 | 5連続切替 (req→gantt→seq→gantt→er→req) console error 0 | PASS |
| EV-VS-RETRY-3 | 6 reqType 全描画 | PASS |
| EV-VS-RETRY-4 | 7 reltype 全描画 | PASS |

DOM 確認:
- 6 reqType: `<<Requirement>>`, `<<Functional Requirement>>`, `<<Interface Requirement>>`, `<<Performance Requirement>>`, `<<Physical Requirement>>`, `<<Design Constraint>>` 全て foreignObject として存在
- 7 reltype: `«contains»`, `«copies»`, `«derives»`, `«satisfies»`, `«verifies»`, `«refines»`, `«traces»` 全てラベル描画

## console error 総数

- **Post-fix (authoritative)**: 0 件 (favicon.ico 404 除く)
- **Pre-cache-clear (artifact)**: 2 件 (Python http.server のキャッシュヘッダー欠落 + Playwright persistent context が古い app.js を配信。CDP `Network.clearBrowserCache` で解消)

## 証拠

### 初回 sweep (FAIL)
- `screenshots/ev-vs1-default-template.png` 〜 `ev-vs6b-relation-detail.png`
- `console.log`, `network.json`, `ev-vs3-reltype-evidence.txt`

### 再 sweep (PASS)
- `screenshots/retry-1-default-template.png`
- `screenshots/retry-2-post-cache-clear-req-to-gantt-PASS.png` (RETRY-2 primary)
- `screenshots/retry-2-full-sweep-final-requirement-PASS.png`
- `screenshots/retry-3-6-reqtypes-clean-PASS.png` (RETRY-3 primary)
- `screenshots/retry-4-7-reltypes-clean-PASS.png` (RETRY-4 primary)

## 推奨事項 (本 sweep 合否には影響しない)

1. `mermaid-assist.html` の `<script>` タグに cache-busting (`?v=<git-sha>`) を付与、または
2. dev server を `npx http-server -c-1` 等のキャッシュ無効サーバに変更
3. Evaluator プロトコルに sweep 開始時 `Network.clearBrowserCache` via CDP を追加

## 結論

**PASS**. v1.3.0 Phase 1 Requirement Diagram の全視覚要件が実機描画で確認された。Tier2 Phase 1 の visual verification gate (ADR-014 / feedback_visual_verification) クリア。

## 構造化 verdict

```json
{
  "sprint": "v1.3.0 / Tier2 Phase 1 / Requirement Diagram",
  "verdict": "PASS",
  "passed_evs": ["EV-VS-RETRY-1", "EV-VS-RETRY-2", "EV-VS-RETRY-3", "EV-VS-RETRY-4"],
  "failed_criteria": [],
  "console_errors_post_fix": 0,
  "fix_commits": ["577a106"]
}
```
