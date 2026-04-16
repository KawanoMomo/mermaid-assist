# ECN-008: Phase 2 — Flowchart Diagram 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v0.7.0
- **対象コミット**: `2f3cb0f`
- **影響ファイル**: `src/modules/flowchart.js`, `tests/flowchart-*.test.js`, `tests/e2e/flowchart-basic.spec.js`, `mermaid-assist.html`

## コンテキスト

業務フロー・処理フロー・状態判断ロジックなど用途が広い Flowchart を Tier1 第2弾として実装。Sequence の実装パターンを踏襲し、図形固有の構文（10種のノード形状、8種のエッジタイプ、subgraph）を取り込む。

## 対策

DiagramModule v2 で実装:

- **ノード形状 10種**: rect `[]`, round `()`, diamond `{}`, circle `((...))`, parallelogram `[/.../]`, parallelogram_alt `[\\...\\]`, asymmetric `>...]`, hexagon `{{...}}`, subroutine `[[...]]`, cylinder `[(...)]`
- **エッジタイプ 8種**: `-->` `---` `-.->` `-.-` `==>` `===` `--x` `--o`
- **direction**: TD / TB / BT / LR / RL
- **サブ要素**: subgraph（ネスト対応）, classDef, class
- **operations**: add (node/edge/subgraph/classDef), delete, update, moveUp/Down, connect, updateDirection

UI: `<option value="flowchart">` 追加、property panel に方向切替・shape選択・edge追加フォーム実装。

## 結果

- 20 ユニット + 7 E2E 追加、合計 79 unit + 104 E2E 全 PASS
- v0.7.0 リリース
