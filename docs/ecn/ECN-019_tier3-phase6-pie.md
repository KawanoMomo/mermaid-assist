# ECN-019: Tier3 Phase 6 — Pie Chart 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.8.0
- **対象コミット**: db89a43, <P6-2 commits>
- **影響ファイル**: src/modules/pie.js, src/core/parser-utils.js, mermaid-assist.html, tests/pie-*.test.js, tests/e2e/pie-basic.spec.js, tests/run-tests.js
- **関連 ADR**: ADR-011, ADR-012, ADR-014, ADR-015, ADR-016

## コンテキスト

Tier3 開始 (10 図形対応予定)。Phase 6 = Pie Chart — シンプルな円グラフ。プロジェクト工数・構成比可視化の基本ツール。

## 対策

DiagramModule v2:
- **コア要素**: slice ("label" : value)
- **meta**: title, showData
- **operations**: addSlice / deleteSlice / updateSlice (label/value) / setTitle / setShowData / moveUp/Down
- **UI**: Title 設定 + showData checkbox + スライス追加フォーム + 詳細パネル

## 結果

- **ユニット**: 259 passed (Tier2 完備 247 + Pie 12 新規)
- **E2E**: 8 passed
- **visual sweep**: PASS (default + 5 slices + showData + cross-switch、console error 0)
- **シナリオ**: プロジェクト工数内訳 PASS
- v1.8.0 リリース
