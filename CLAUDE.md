# CLAUDE.md

## プロジェクト概要

MermaidAssist — Mermaid記法のGUI編集ツール。Mermaidテキストをソースオブトゥルースとし、GUIで直感的に編集可能。初回リリースはガントチャートに対応。

## 技術スタック

- 単一HTMLファイル（mermaid-assist.html）
- バニラJS（フレームワーク無し）
- mermaid.js v11（lib/mermaid.min.js、MITライセンス）
- SVGオーバーレイ層によるインタラクション

## アーキテクチャ

- Mermaidテキスト → 独自パーサー → 構造化データ → プロパティパネル
- Mermaidテキスト → mermaid.js → SVG → オーバーレイ層 → ドラッグ操作
- GUI操作 → Regex Updater → Mermaidテキスト書き戻し
- 図種モジュール構造（DiagramModule）で拡張可能

## 開発コマンド

- テスト実行: `node tests/run-tests.js`
- ブラウザ確認: `mermaid-assist.html` をブラウザで開く

## 設計ドキュメント

- 設計仕様書: `docs/superpowers/specs/2026-03-30-mermaid-assist-design.md`
- 実装計画: `docs/superpowers/plans/2026-03-30-mermaid-assist-implementation.md`
- ADR: `E:\00_Git\docs\adr\` (ワークスペース共通)
