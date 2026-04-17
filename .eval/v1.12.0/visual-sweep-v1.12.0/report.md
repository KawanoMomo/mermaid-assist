# v1.12.0 Visual Sweep Report — Sankey

## 概要
- 実施日: 2026-04-17
- 対象: Tier3 Phase 10 Sankey (sankey-beta)
- 最終判定: PASS

## EV 結果
| EV | シナリオ | 結果 |
|---|---|---|
| EV1 | Default template (Sales -> Product_A/B -> Profit/Cost、6 flows) | PASS |
| EV2 | Extended 8-flow multi-level chain (Revenue -> DeptA/B -> Salary/Equipment/Profit) | PASS |
| EV3 | Numeric with decimals (12.5, 7.25, 10.75, 1.75, 5.5, 1.75) | PASS |
| EV4 | Cross-switch (sankey-beta -> gantt -> sankey-beta) | PASS |

## console error: 0 (favicon除く)

## 特記事項
- EV1: デフォルトテンプレートで Sankey 帯状フロー描画 OK。ノード一覧で Sales(out 180) / Product_A(100/100) / Product_B(80/80) / Profit(in 110) / Cost(in 70) と in/out 集計表示。フロー一覧 6件 (編集/削除ボタン付き)
- EV2: Revenue -> DeptA(500) / DeptB(300) から Salary / Equipment / Profit への多段チェーン描画。ノード集計が 800 出 / 500+300 経由 / Salary 300 + Equipment 230 + Profit 270 と整合
- EV3: 小数値 (12.5, 7.25, 10.75, 1.75, 5.5, 1.75) を正しく解析 & 集計 (End in 16.25 / Loss in 3.5)。帯幅も比率通り
- EV4: sankey-beta -> gantt -> sankey-beta の往復でテンプレート完全復帰 (editor 8行、preview/nodes/flows 再現)
- UI: フロー追加フォーム + ノード一覧 (in/out) + フロー一覧 (編集/削除) のパネル階層 OK

## 結論
PASS. v1.12.0 として Sankey 対応完了。
