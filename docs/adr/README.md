# Architecture Decision Records (ADR)

このプロジェクトの技術的意思決定の履歴。各ADRは「なぜ」を記録し、将来同じ状況に直面したときの判断材料とする。

## 一覧

| # | タイトル | カテゴリ | ステータス | 日付 |
|---|---|---|---|---|
| [011](ADR-011-js-modular-split.md) | JS外部分割によるモジュール構造 | アーキテクチャ | 承認 | 2026-04-14 |
| [012](ADR-012-diagram-module-v2.md) | DiagramModule v2 インターフェース | インターフェース | 承認 | 2026-04-14 |
| [013](ADR-013-connection-mode.md) | Connection Mode による汎用エッジ作成 | インタラクション | 承認 | 2026-04-14 |
| [014](ADR-014-groups-substructure.md) | サブ要素 (groups) のパース・編集モデル | インターフェース | 承認 | 2026-04-14 |
| [015](ADR-015-vertical-relation-form.md) | リレーション系追加フォーム縦1列レイアウト | UI/UX | 承認 | 2026-04-16 |
| [016](ADR-016-system-tester-integration.md) | system-tester エージェント連携によるテスト設計トレーサビリティ | エージェント運用 | 承認 | 2026-04-16 |
| [017](ADR-017-mermaid-parser-auto-quote.md) | Mermaid parser に対する auto-quote 戦略 | インターフェース | 承認 | 2026-04-17 |
| [018](ADR-018-module-registry-merge.md) | モジュールレジストリの merge 戦略 | アーキテクチャ | 承認 | 2026-04-17 |
| [019](ADR-019-evaluator-cache-clear.md) | Evaluator の CDP cache clear プロトコル | エージェント運用 | 承認 | 2026-04-17 |

## 命名規則

`ADR-NNN-kebab-case-title.md` (NNN は3桁ゼロ埋め、001 から連番)

注意: ADR-001 〜 ADR-010 はワークスペース共通で他プロジェクトで使用済みのため、本プロジェクトは ADR-011 から開始。

## カテゴリ

[categories.md](categories.md) を参照。

## テンプレート

[000-template.md](000-template.md) を使用。
