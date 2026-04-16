# ECN-006: Phase 0 — JS モジュール分割

- **ステータス**: 適用済
- **種別**: 改善
- **バージョン**: v0.5.0
- **対象コミット**: `162cbcd` ... `c0bd3d2`
- **影響ファイル**: `src/{core,ui,modules}/*.js`, `mermaid-assist.html`, `tests/run-tests.js`
- **関連ADR**: ADR-011, ADR-012, ADR-013, ADR-014

## コンテキスト

Tier1 マルチ図形対応に向け、`mermaid-assist.html` 単一ファイル（約2400行）の規模が問題化。AIエージェントの編集精度・レビュー難航・並列開発困難。一方、配布の手軽さ（ブラウザでHTML開くだけ）は維持したい。

## 対策

JS を `src/{core,ui,modules}/*.js` に分割し、`<script src="...">` で個別読み込み。バンドラー導入はせず、グローバル名前空間 `window.MA` で各モジュール間参照を統一（ADR-011）。

作成モジュール:
- `src/core/`: date-utils, html-utils, text-updater, parser-utils, history, selection, connection-mode（スケルトン）
- `src/ui/`: properties (binders)
- `src/modules/`: gantt（Gantt専用ロジック全部移行）

DiagramModule v2 インターフェースを設計（ADR-012）: `operations: {add, delete, update, moveUp, moveDown, connect}` の共通プリミティブ、`groups` フィールドでサブ要素表現（ADR-014）。Connection Mode の枠組みも追加（ADR-013、Phase 1+ で使用）。

ADR-011〜014 を新規追加。

## 結果

- 既存 35 unit + 90 E2E テスト全合格を維持（機能変更ゼロ）
- `mermaid-assist.html` ~2400行 → `src/app.js` 1490行 + 9 ファイル分散
- v0.5.0 リリース
- Tier1 Phase 1-5 への基盤完成
