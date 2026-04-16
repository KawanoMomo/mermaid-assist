# ECN-009: Phase 3 — State Diagram 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v0.8.0
- **対象コミット**: `5d3cb2b`
- **影響ファイル**: `src/modules/state.js`, `tests/state-*.test.js`, `tests/e2e/state-basic.spec.js`, `mermaid-assist.html`

## コンテキスト

組み込みエンジニアにとって State Diagram は最頻出図形の一つ（ステートマシン設計）。既存の `04_StableState` プロジェクトとは別軌道で、Mermaid 標準の `stateDiagram-v2` を Tier1 第3弾として実装。

## 対策

DiagramModule v2 で実装:

- **コア要素**: state, transition, `[*]` 擬似状態（start/end）
- **state タイプ**: simple, fork (`<<fork>>`), join (`<<join>>`), choice (`<<choice>>`)
- **サブ要素**: composite state（ネスト, `state X { ... }`）, note (`note left/right of`)
- **operations**: add (state/transition/composite/note), delete, update, moveUp/Down, connect

`stateDiagram` と `stateDiagram-v2` 両方の検出に対応（detectDiagramType の `indexOf('stateDiagram')`）。

## 結果

- 14 ユニット + 6 E2E 追加、合計 93 unit + 110 E2E 全 PASS
- v0.8.0 リリース
