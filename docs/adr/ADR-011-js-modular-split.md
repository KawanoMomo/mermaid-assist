# ADR-011: JS外部分割によるモジュール構造

**Status:** Accepted
**Date:** 2026-04-14
**Project:** 05_MermaidAssist

## Context

Tier1 マルチ図形対応に伴い、`mermaid-assist.html` 単一ファイル（約2400行）
の規模が拡大する。1ファイルでの管理は次の問題を生む:
- AIエージェントの編集精度低下（コンテキスト超過）
- レビュー難航
- 並列開発困難

一方、配布の手軽さ（ブラウザでHTML開くだけで動作、ビルド不要）は維持したい。

## Decision

JSを `src/{core,ui,modules}/*.js` に分割し、`mermaid-assist.html` から
`<script src="...">` で個別読み込み。バンドラー導入はせず、グローバル
名前空間 `window.MA` で各モジュール間の参照を統一する。

## Consequences

### Positive
- ファイル単位の責務明確化、可読性向上
- AIエージェントの編集精度改善
- ビルドステップ不要、配布シンプル
- 既存テストランナーは複数JS連結で対応

### Negative
- スクリプト読み込み順序の管理が必要
- グローバル名前空間汚染（`MA` 1つ）
- ES modules的な依存解決を持たない

### Neutral
- 必要になればバンドラー導入は容易（ADR-015で検討予定）
