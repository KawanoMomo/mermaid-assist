# ECN-025: Tier3 Phase 12 — Packet Diagram 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.14.0
- **対象コミット**: `6becf78`, (test/docs commits follow)
- **影響ファイル**: src/modules/packet.js, src/core/parser-utils.js, mermaid-assist.html, tests/packet-parser.test.js, tests/packet-updater.test.js, tests/e2e/packet-basic.spec.js, tests/run-tests.js

## コンテキスト

Tier3 Phase 12。Packet Diagram (packet-beta) 対応。ネットワークプロトコルヘッダ等のビットフィールドレイアウトを Mermaid で記述し、フィールド単位で GUI 編集可能に。単一 bit (`N: "label"`) とビット範囲 (`N-M: "label"`) の 2 形式をサポート。

## 対策

DiagramModule v2:
- **コア要素**: field (id, startBit, endBit, label)
- **meta**: title
- **operations**: setTitle / addField / updateField / deleteField / moveUp / moveDown
- **UI**: Title 設定 (title 入力 + 適用ボタン) / フィールド追加フォーム (開始 bit / 終了 bit / Label、範囲と単一 bit を start===end で統一) / フィールド一覧 (選択/削除ボタン) / フィールド詳細編集 (開始 bit / 終了 bit / Label / 削除)
- **template**: TCP Header (Source Port / Destination Port / Sequence Number / Acknowledgment Number / Data Offset / Reserved / URG / ACK)

## 結果

- 333 unit + 7 E2E (packet-basic) passed、全体 E2E 245 passed
- visual sweep PASS (default TCP Header / single-bit Flag Byte / IPv4 Header 12 fields / cross-switch、console error 0)
- v1.14.0 リリース (Tier3 Phase 12 完了)
