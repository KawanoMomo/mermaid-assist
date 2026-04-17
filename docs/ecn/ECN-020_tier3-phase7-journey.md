# ECN-020: Tier3 Phase 7 — User Journey 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.9.0
- **対象コミット**: `31a85d0`, `6ecfd31`
- **影響ファイル**: src/modules/journey.js, src/core/parser-utils.js, mermaid-assist.html, tests/journey-*.test.js, tests/e2e/journey-basic.spec.js, tests/run-tests.js

## コンテキスト

Tier3 Phase 7。User Journey (section × task × actors) 対応。UX 設計やワークフロー可視化に利用可能。

## 対策

DiagramModule v2:
- section / task (text / score / actors)
- setTitle / addSection / addTask / deleteElement (section cascade) / updateTask
- UI: Title + Section + Task 追加フォーム + 詳細パネル 2種

## 結果

- 269 unit + 8 E2E passed
- visual sweep PASS (multi section / negative scores / cross-switch)
- v1.9.0 リリース
