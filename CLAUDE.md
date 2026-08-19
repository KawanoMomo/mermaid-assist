# CLAUDE.md

## プロジェクト概要

MermaidAssist — Mermaid記法のGUI編集ツール。Mermaidテキストをソースオブトゥルースとし、GUIで直感的に編集可能。Tier1としてGantt + Sequence/Flowchart/State/Class/ER対応を進行中。

## 技術スタック

- 単一HTML配布 (mermaid-assist.html)、ビルドステップなし
- JS外部分割 src/{core,ui,modules}/*.js + window.MA 名前空間 (ADR-011)
- mermaid.js v11 (lib/mermaid.min.js、MITライセンス) で SVG描画
- SVGオーバーレイ層 (ADR-008) で透明な操作要素を重畳

## アーキテクチャ

- DiagramModule v2 インターフェース (ADR-012) で図形拡張可能
- Mermaidテキスト → モジュールparse → 構造化データ → プロパティパネル
- Mermaidテキスト → mermaid.js → SVG → オーバーレイ層 → 操作
- GUI操作 → 各モジュールoperations → Mermaidテキスト書き戻し
- ファイル構成:
  - `src/core/`: parser-utils, text-updater, history, selection, connection-mode, date-utils, html-utils
  - `src/ui/`: properties (toolbar/editor/preview/overlay/statusbar は次フェーズ)
  - `src/modules/`: gantt（v0.5.0時点）、sequence/flowchart/state/class/er を順次追加予定

## 開発コマンド

- ユニットテスト実行: `node tests/run-tests.js`
- E2Eテスト実行: `npx playwright test`
- 全テスト: `npm run test:all`
- ブラウザ確認: `mermaid-assist.html` をブラウザで開く

## 設計ドキュメント

- Tier1 設計仕様書: `docs/superpowers/specs/2026-04-14-tier1-diagrams-design.md`
- Phase 0 実装計画: `docs/superpowers/plans/2026-04-14-tier1-phase-0-refactor.md`
- 初版設計仕様書: `docs/superpowers/specs/2026-03-30-mermaid-assist-design.md`
- ADR: `docs/adr/` (ADR-011〜ADR-014 を含む)

## 検証証跡 (.eval) の取り扱い

visual sweep のスクリーンショットや evaluator のレポートは `.eval/` に出力するが、
**リポジトリにはコミットしない**(2026-08-18 方針変更、`.gitignore` で除外済み)。

- 実機スクリーンショット検証そのものは従来どおり必須(ワークスペース CLAUDE.md の禁止事項)。
  変わったのは「証跡をgit管理するかどうか」だけで、検証ゲートは緩めていない
- plan / ECN に検証結果を書く場合は、スクショを添付するのではなく
  **判定(PASS/FAIL)・console error 件数・確認した観点**をテキストで残す
- 新しい plan を書くときに `git add .eval/...` の手順を入れないこと
- 2026-08-18 以前のコミット履歴には `.eval/v1.1.0`〜`v1.17.0` の証跡が残っている(履歴書き換えはしない)
