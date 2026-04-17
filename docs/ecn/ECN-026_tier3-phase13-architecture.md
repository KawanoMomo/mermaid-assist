# ECN-026: Tier3 Phase 13 — Architecture Diagram 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.15.0
- **対象コミット**: `9602fc0`, (test/docs commits follow)
- **影響ファイル**: src/modules/architecture.js, src/core/parser-utils.js, mermaid-assist.html, tests/architecture-parser.test.js, tests/architecture-updater.test.js, tests/e2e/architecture-basic.spec.js, tests/run-tests.js

## コンテキスト

Tier3 Phase 13。Architecture Diagram (architecture-beta) 対応。クラウド/ネットワークアーキテクチャの group / service / edge 構造を Mermaid で記述し、GUI 編集可能に。group/service は icon (cloud/database/disk/server/internet) + ラベル + 親グループ (入れ子) をサポート、edge は T/B/L/R の4方向サイド指定による接続を表現。

## 対策

DiagramModule v2:
- **コア要素**: group (id, icon, label, parentId), service (id, icon, label, parentId), edge (from, fromSide, to, toSide)
- **ICONS**: cloud / database / disk / server / internet
- **SIDES**: T / B / L / R
- **operations**: addGroup / addService / addEdge / updateElement (group|service 共通) / updateEdge / deleteLine / moveUp / moveDown / connect
- **UI**: グループ追加 (ID / Icon / Label / 親グループ) / サービス追加 (ID / Icon / Label / 親グループ) / エッジ追加 (From / From side / To side / To) / 一覧 (グループ / サービス / エッジ、選択・削除付き) / 選択編集 (ID / Icon / Label / 親グループ / 削除)
- **template**: API Cluster group + db/disk1/server/gateway services + 3 edges (db:L--R:server / disk1:T--B:server / gateway:R--L:server)

## 結果

- 344 unit + 8 E2E (architecture-basic) passed、全体 E2E 253 passed
- visual sweep PASS (default template / multi-group nested / multiple icons / cross-switch、console error 0)
- v1.15.0 リリース (Tier3 Phase 13 完了)
