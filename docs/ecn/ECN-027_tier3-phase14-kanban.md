# ECN-027: Tier3 Phase 14 — Kanban Board 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.16.0
- **対象コミット**: `7b5ccf4`, (test/docs commits follow)
- **影響ファイル**: src/modules/kanban.js, src/core/parser-utils.js, mermaid-assist.html, tests/kanban-parser.test.js, tests/kanban-updater.test.js, tests/e2e/kanban-basic.spec.js, tests/run-tests.js

## コンテキスト

Tier3 Phase 14。Kanban Board (kanban) 対応。プロジェクト管理で広く使われる看板 (カラム/カード) 構造を Mermaid で記述し、GUI 編集可能に。カラムはタイトル (1 単語 ID)、カードはカラム配下のリスト項目として `[Text]` 形式で表現。カードには任意メタ情報 (assigned / ticket / priority) を `@{ ... }` で付与可能。

## 対策

DiagramModule v2:
- **コア要素**: column (id, label), card (id, text, meta, columnId)
- **card meta**: assigned / ticket / priority (任意キー)
- **operations**: addColumn / addCard / updateColumn / updateCard / deleteColumn (カスケード: カード自動除去) / deleteCard / moveUp / moveDown
- **UI**: カラム追加 (Name) / カード追加 (Column / Text / Meta) / カラム一覧 (カード数付き・編集/削除) / カード一覧 (カラム名バッジ付き・編集/削除) / 選択編集 (カラム Name / カード Text / Meta / 削除)
- **template**: Todo (Design spec / Research approach) + InProgress (Implement feature) + Done (Initial release) の計 4 カード

## 結果

- 354 unit + 8 E2E (kanban-basic) passed、全体 E2E 261 passed
- visual sweep PASS (default template / many cards / card with meta / cross-switch、console error 0)
- v1.16.0 リリース (Tier3 Phase 14 完了)
