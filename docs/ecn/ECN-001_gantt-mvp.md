# ECN-001: Gantt MVP 初版

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v0.1.0
- **対象コミット**: `7a16ac3` ... `a467803`（初版〜brushup直前）
- **影響ファイル**: `mermaid-assist.html`, `tests/gantt-*.test.js`, `tests/e2e/*.spec.js`

## コンテキスト

Mermaid 記法のガントチャートを GUI で直感的に編集できるツールが必要。Mermaid テキストをソースオブトゥルースとし、編集結果を即座にテキストへ書き戻すアーキテクチャを構築する。

## 対策

単一HTMLファイル + バニラJS + mermaid.js v11 で 3ペイン UI（エディタ / プレビュー＋オーバーレイ / プロパティパネル）を実装:

- **独自パーサー**: Mermaid テキストから構造化データ抽出（`parseGantt`）
- **mermaid.js**: SVG プレビュー描画（MIT ライセンス、ローカル）
- **オーバーレイ層**: SVG 上に透明クリック要素を重畳（ADR-008）
- **Regex Updater**: GUI 操作を Mermaid テキストに書き戻し（ADR-006）
- **DiagramModule v1**: `parse / buildOverlay / renderProps / updateText / exportMmd` の5メソッド構造

機能セット: バードラッグ（移動・リサイズ）、プロパティパネル編集、エクスポート（mmd/SVG/PNG/clipboard）、Undo/Redo、キーボードショートカット、コピペ、セクション管理（追加・削除・milestone ステータス）。

## 結果

- 35 ユニットテスト + 71 E2E テスト 全合格
- 動作確認済み（Chrome）
- ファイル規模: 約 2400 行（後の Phase 0 で外部分割対象に）
