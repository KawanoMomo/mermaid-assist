# Engineering Change Notices (ECN)

Git 履歴から抽出した変更通知ログ。各 ECN は「何を・なぜ・どう変えたか・結果」を 1ファイルで記録。リリース粒度で構造化されている。

## 一覧

| # | タイトル | 種別 | バージョン | 日付 |
|---|---|---|---|---|
| [001](ECN-001_gantt-mvp.md) | Gantt MVP 初版 | 機能追加 | v0.1.0 | 2026-03-30 |
| [002](ECN-002_brushup-e01-e10.md) | Brushup E01-E10 — バグ修正 + UX 強化 | 不具合修正 + 改善 | v0.2.0 | 2026-04-14 |
| [003](ECN-003_task-section-management.md) | タスク順序操作・セクション管理 UI | 機能追加 | v0.3.0 | 2026-04-14 |
| [004](ECN-004_axisformat-preset.md) | axisFormat プリセットドロップダウン | 改善 | v0.4.0 | 2026-04-14 |
| [005](ECN-005_initial-public-release.md) | 初版 GitHub 公開（LICENSE + README） | プロセス改善 | v0.4.0 | 2026-04-14 |
| [006](ECN-006_phase0-modular-split.md) | Phase 0 — JS モジュール分割 | 改善 | v0.5.0 | 2026-04-14 |
| [007](ECN-007_phase1-sequence.md) | Phase 1 — Sequence Diagram 対応 | 機能追加 | v0.6.0 | 2026-04-14 |
| [008](ECN-008_phase2-flowchart.md) | Phase 2 — Flowchart Diagram 対応 | 機能追加 | v0.7.0 | 2026-04-14 |
| [009](ECN-009_phase3-state.md) | Phase 3 — State Diagram 対応 | 機能追加 | v0.8.0 | 2026-04-14 |
| [010](ECN-010_phase4-class.md) | Phase 4 — Class Diagram 対応 | 機能追加 | v0.9.0 | 2026-04-14 |
| [011](ECN-011_phase5-er-tier1-complete.md) | Phase 5 — ER Diagram 対応 + Tier1 完了 | 機能追加 | v1.0.0 | 2026-04-14 |
| [012](ECN-012_properties-helpers-dedupe.md) | properties.js ヘルパー集約リファクタ | 改善 | v1.1.0 | 2026-04-16 |
| [013](ECN-013_add-form-unification.md) | 追加フォーム縦並び統一 + system-tester 連携 | 改善 | v1.2.0 | 2026-04-16 |
| [014](ECN-014_tier2-phase1-requirement.md) | Tier2 Phase 1 — Requirement Diagram 対応 | 機能追加 | v1.3.0 | 2026-04-17 |
| [015](ECN-015_tier2-phase2-block.md) | Tier2 Phase 2 — Block Diagram 対応 | 機能追加 | v1.4.0 | 2026-04-17 |
| [016](ECN-016_tier2-phase3-timeline.md) | Tier2 Phase 3 — Timeline 対応 | 機能追加 | v1.5.0 | 2026-04-17 |
| [017](ECN-017_tier2-phase4-mindmap.md) | Tier2 Phase 4 — Mindmap 対応 | 機能追加 | v1.6.0 | 2026-04-17 |
| [018](ECN-018_tier2-phase5-gitgraph.md) | Tier2 Phase 5 — Gitgraph 対応 (Tier2 完備) | 機能追加 | v1.7.0 | 2026-04-17 |
| [019](ECN-019_tier3-phase6-pie.md) | Tier3 Phase 6 — Pie Chart 対応 | 機能追加 | v1.8.0 | 2026-04-17 |
| [020](ECN-020_tier3-phase7-journey.md) | Tier3 Phase 7 — User Journey 対応 | 機能追加 | v1.9.0 | 2026-04-17 |
| [021](ECN-021_tier3-phase8-quadrant.md) | Tier3 Phase 8 — Quadrant Chart 対応 | 機能追加 | v1.10.0 | 2026-04-17 |
| [022](ECN-022_tier3-phase9-xychart.md) | Tier3 Phase 9 — XY Chart 対応 | 機能追加 | v1.11.0 | 2026-04-17 |
| [023](ECN-023_tier3-phase10-sankey.md) | Tier3 Phase 10 — Sankey 対応 | 機能追加 | v1.12.0 | 2026-04-17 |
| [024](ECN-024_tier3-phase11-c4.md) | Tier3 Phase 11 — C4 Diagram 対応 | 機能追加 | v1.13.0 | 2026-04-17 |
| [025](ECN-025_tier3-phase12-packet.md) | Tier3 Phase 12 — Packet Diagram 対応 | 機能追加 | v1.14.0 | 2026-04-17 |

## 種別の凡例

- **機能追加**: 新規ユースケース対応
- **不具合修正**: 既存機能のバグ修正
- **改善**: 既存機能のUX/性能/保守性向上
- **プロセス改善**: ビルド・配布・運用面の改善

## テンプレート

`000-template.md` を使用。ファイル命名は `ECN-NNN_kebab-case.md`。

## 関連ドキュメント

- [ADR](../adr/README.md): 技術的意思決定の理由
- [Spec](../superpowers/specs/): 機能仕様書
- [Plan](../superpowers/plans/): 実装計画
