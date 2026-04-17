# v1.16.0 Visual Sweep Report — Kanban Board

## 概要
- 実施日: 2026-04-17
- 対象: Tier3 Phase 14 Kanban Board (kanban)
- 最終判定: PASS

## EV 結果
| EV | シナリオ | 結果 |
|---|---|---|
| EV1 | Default template (Todo / InProgress / Done の 3 カラム + 4 カード) | PASS |
| EV2 | Many cards per column (Todo 5 / InProgress 4 / Done 4 の計 13 カード) | PASS |
| EV3 | Card with meta (assigned / ticket / priority 付きカード 4 枚) | PASS |
| EV4 | Cross-switch (kanban -> gantt -> kanban) | PASS |

## console error: 0 (favicon除く)

## 特記事項
- EV1: デフォルト `kanban` テンプレート (Todo / InProgress / Done の 3 カラム + 4 カード) が左→右に並列描画。各カラムはヘッダラベル + 下部カード領域で構成され、Todo=マゼンタ / InProgress=ティール / Done=ブラウン系のアクセント配色で識別容易。右パネル Kanban UI は「カラムを追加 (Name)」「カードを追加 (Column / Text / Meta)」「カラム一覧 (カード数付き・編集/削除ボタン)」「カード一覧 (カラム名バッジ付き・編集/削除ボタン)」の 4 セクションを正しく表示。
- EV2: カラムあたり 4〜5 カードを投入しても SVG プレビュー側で各カラムがカード枚数に応じて縦伸長し、全カードが破綻なく描画。右パネル「カラム一覧」が `Todo (5 cards) / InProgress (4 cards) / Done (4 cards)` と正確にカウント、カード一覧も 13 件列挙 (スクロール対応)。
- EV3: `id[Label]@{assigned: '...', ticket: '...', priority: '...'}` 構文で 4 枚のメタ付きカードを投入。SVG プレビュー側でカード本文に ticket ID (DOC-12 / UI-48 / CORE-7 / REL-1) と assigned 名 (alice / bob / carol / dan) が 2 段で描画されることを確認。
- EV4: kanban -> gantt 切替時に右パネル Properties が Gantt UI (タスク一覧 / セクション一覧 / グローバル設定) に完全遷移し、さらに kanban に戻すと元のデフォルトテンプレート (8 行 editor / Todo 2 + InProgress 1 + Done 1 の計 4 カード) が完全復元。Properties パネルも Kanban UI (カラム/カード 追加フォーム + 一覧) に復帰。
- UI: カラム追加 (Name) / カード追加 (Column / Text / Meta) / 選択編集 (カラム Name / カード Text / Meta / 削除) / カラム削除 (カスケード) / カード削除 のパネル階層 OK。

## 結論
PASS. v1.16.0 として Kanban Board (kanban) 対応完了。
