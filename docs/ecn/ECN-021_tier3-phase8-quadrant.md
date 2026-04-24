# ECN-021: Tier3 Phase 8 — Quadrant Chart 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.10.0
- **対象コミット**: `fb9c281`, `<P8-2 commits>`
- **影響ファイル**: src/modules/quadrant.js, src/core/parser-utils.js, mermaid-assist.html, tests/quadrant-*.test.js, tests/e2e/quadrant-basic.spec.js, tests/run-tests.js

## コンテキスト

Tier3 Phase 8。Quadrant Chart (2 軸 × 4 象限 + 点プロット) 対応。施策/タスクの優先度マトリクス可視化に利用可能。

## 対策

DiagramModule v2:
- **コア要素**: point (label : [x, y])
- **meta**: title, xAxisLeft/Right, yAxisBottom/Top, q1-q4
- **operations**: addPoint / deletePoint / updatePoint (label/x/y) / setTitle / setXAxis / setYAxis / setQuadrantLabel / moveUp/Down
- **UI**: Title + X/Y軸 + 象限ラベル + ポイント追加フォーム + 詳細パネル

## 結果

- 281 unit + 8 E2E passed
- visual sweep PASS (default / 10 points / alt axes / cross-switch、console error 0)
- テンプレートは ASCII ラベルに調整 (mermaid v11 quadrantChart パーサが非ASCII 非クォートを拒否するため)
- v1.10.0 リリース
