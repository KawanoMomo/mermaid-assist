# ECN-028: Tier3 Phase 15 — Radar Chart 対応 (Tier3 完備)

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.17.0
- **対象コミット**: `c360a1a`, (test/docs commits follow)
- **影響ファイル**: src/modules/radar.js, src/core/parser-utils.js, mermaid-assist.html, tests/radar-parser.test.js, tests/radar-updater.test.js, tests/e2e/radar-basic.spec.js, tests/run-tests.js
- **マイルストーン**: **Tier3 完備 (全 10 図形 / 累計 21 図形対応)**

## コンテキスト

Tier3 Phase 15。Radar Chart (radar-beta) 対応。チーム評価やスキルアセスメントなどで多次元の比較を直感的に可視化する放射型チャートを Mermaid で記述し、GUI 編集可能に。軸はラベル付き ID、カーブは軸の値配列として `curve id["Label"]{v1, v2, ...}` で表現。Tier3 全 10 フェーズ (6〜15) の最終フェーズであり、本リリースをもって Tier3 完備 (累計 21 種対応) を達成。

## 対策

DiagramModule v2:
- **コア要素**: meta (title, min, max, axes[]), curve (id, label, values[])
- **axes**: `axis id1["Label1"], id2["Label2"], ...` (任意数)
- **operations**: setTitle / setMin / setMax / setAxes / addCurve / updateCurve / deleteCurve / moveUp / moveDown
- **UI**: 設定 (Title / Min / Max / 軸 id:label カンマ列) / カーブを追加 (ID / Label / Values) / カーブ一覧 (値プレビュー + 編集/削除) / 選択編集 (カーブ ID / Label / Values / 削除)
- **template**: "Skill Assessment" / 5 軸 (Comm / Strat / Lead / Vision / Tech) / Alice (85,90,75,95,80) + Bob (70,80,85,75,90) / min=0, max=100

## 結果

- 365 unit + 8 E2E (radar-basic) passed、全体 E2E 269 passed
- visual sweep PASS (default template / single curve / 6 curves overlap / cross-switch、console error 0)
- v1.17.0 リリース (Tier3 Phase 15 完了 / **Tier3 完備**)

## Tier3 総括 (Phase 6〜15)

| Phase | Diagram | ECN | Version |
|---|---|---|---|
| 6 | Pie Chart | ECN-019 | v1.8.0 |
| 7 | User Journey | ECN-020 | v1.9.0 |
| 8 | Quadrant Chart | ECN-021 | v1.10.0 |
| 9 | XY Chart | ECN-022 | v1.11.0 |
| 10 | Sankey | ECN-023 | v1.12.0 |
| 11 | C4 Diagram | ECN-024 | v1.13.0 |
| 12 | Packet Diagram | ECN-025 | v1.14.0 |
| 13 | Architecture Diagram | ECN-026 | v1.15.0 |
| 14 | Kanban Board | ECN-027 | v1.16.0 |
| 15 | **Radar Chart** | **ECN-028** | **v1.17.0** |

Tier3 10 フェーズ完了。累計対応図形 **21 種**:
- **Tier1 (6)**: Gantt / Sequence / Flowchart / State / Class / ER
- **Tier2 (5)**: Requirement / Block / Timeline / Mindmap / Gitgraph
- **Tier3 (10)**: Pie / Journey / Quadrant / XY / Sankey / C4 / Packet / Architecture / Kanban / Radar
