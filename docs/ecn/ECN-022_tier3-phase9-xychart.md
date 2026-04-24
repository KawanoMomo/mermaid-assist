# ECN-022: Tier3 Phase 9 — XY Chart 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.11.0
- **対象コミット**: `dcae791`, `<P9-2 commits>`
- **影響ファイル**: src/modules/xychart.js, src/core/parser-utils.js, mermaid-assist.html, tests/xychart-*.test.js, tests/e2e/xychart-basic.spec.js, tests/run-tests.js

## コンテキスト

Tier3 Phase 9。XY Chart (xychart-beta: bar + line シリーズ × X/Y軸) 対応。時系列メトリクス・売上・計測値など 2軸グラフの可視化に利用可能。

## 対策

DiagramModule v2:
- **コア要素**: series (kind: bar|line, values)
- **meta**: title, horizontal, xAxisLabel, xAxisCategories, xAxisMin/Max, yAxisLabel, yAxisMin/Max
- **operations**: addSeries / deleteSeries / updateSeries (kind/values) / setTitle / setHorizontal / setXAxisCategories / setXAxisRange / setYAxis / moveUp/Down
- **UI**: Title + horizontal toggle + X軸ラベル/カテゴリ/範囲 + Y軸ラベル/範囲 + シリーズ追加フォーム + シリーズ詳細パネル

## 結果

- 297 unit + 8 E2E passed
- visual sweep PASS (default / bar only / horizontal / cross-switch、console error 0)
- v1.11.0 リリース (Tier3 Phase 9 完了)
