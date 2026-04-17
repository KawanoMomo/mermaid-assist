# ECN-023: Tier3 Phase 10 — Sankey 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.12.0
- **対象コミット**: `508cdd8`, `67c8e20`, `eaf80cb`
- **影響ファイル**: src/modules/sankey.js, src/core/parser-utils.js, mermaid-assist.html, tests/sankey-*.test.js, tests/e2e/sankey-basic.spec.js, tests/run-tests.js

## コンテキスト

Tier3 Phase 10。Sankey Diagram (sankey-beta: source,target,value の CSV フロー) 対応。エネルギー収支・予算配分・コンバージョンフローなど多段の流量可視化に利用可能。

## 対策

DiagramModule v2:
- **コア要素**: flow (source, target, value)
- **meta**: なし (sankey-beta はヘッダ + CSV のシンプル文法)
- **operations**: addFlow / deleteFlow / updateFlow (from/to/value) / moveUp / moveDown
- **UI**: フロー追加フォーム (Source / Target / Value) + ノード一覧 (in/out 集計) + フロー一覧 (編集/削除)

## 結果

- 307 unit + 7 E2E passed
- visual sweep PASS (default / extended chain / decimals / cross-switch、console error 0)
- v1.12.0 リリース (Tier3 Phase 10 完了)
