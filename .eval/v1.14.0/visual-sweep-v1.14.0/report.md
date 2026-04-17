# v1.14.0 Visual Sweep Report — Packet Diagram

## 概要
- 実施日: 2026-04-17
- 対象: Tier3 Phase 12 Packet Diagram (packet-beta)
- 最終判定: PASS

## EV 結果
| EV | シナリオ | 結果 |
|---|---|---|
| EV1 | Default TCP header template (8 fields: Source Port / Destination Port / Sequence Number / Acknowledgment Number / Data Offset / Reserved / URG / ACK) | PASS |
| EV2 | Simple single-bit fields demo (Flag Byte, F0-F7 の 8 個の単一 bit) | PASS |
| EV3 | Large range + mixed (IPv4 Header 相当、12 フィールド / 0-159 bit 範囲) | PASS |
| EV4 | Cross-switch (packet-beta -> gantt -> packet-beta) | PASS |

## console error: 0 (favicon除く)

## 特記事項
- EV1: デフォルト TCP Header テンプレートで 8 フィールド (0-15: "Source Port" / 16-31: "Destination Port" / 32-63: "Sequence Number" / 64-95: "Acknowledgment Number" / 96-99: "Data Offset" / 100-105: "Reserved" / 106: "URG" / 107: "ACK") が正しく描画。パネル右側に Title 設定 / フィールドを追加 (開始 bit / 終了 bit / Label) / フィールド一覧 (編集/削除ボタン付き) が表示。プレビューには "TCP Header" タイトルとビット単位の矩形レイアウト
- EV2: 単一 bit フィールド 8 個 (0: "F0" から 7: "F7") が横一列に並ぶ Flag Byte レイアウト。フィールド一覧には各項目に `(1 bits)` 表記
- EV3: IPv4 Header 相当の 12 フィールドを 0-159 bit 範囲で混合配置 (4 bit の Version/IHL、8 bit の TTL/Protocol、16 bit の Total Length/Header Checksum、32 bit の Source IP/Destination IP など)。ビット幅に比例した矩形サイズでプレビュー描画、フィールド一覧も全項目表示
- EV4: packet-beta -> gantt -> packet-beta の往復でテンプレート完全復帰 (editor 10行、preview で TCP Header + 8 フィールド再現、Properties パネルも Packet UI に復帰)
- UI: Title 適用 / フィールド追加 (範囲/単一 bit 両対応) / フィールド一覧 (選択/削除) / フィールド詳細編集 (開始 bit / 終了 bit / Label / 削除) のパネル階層 OK

## 結論
PASS. v1.14.0 として Packet Diagram (packet-beta) 対応完了。
