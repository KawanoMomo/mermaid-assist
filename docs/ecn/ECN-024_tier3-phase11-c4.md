# ECN-024: Tier3 Phase 11 — C4 Diagram 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.13.0
- **対象コミット**: `31d7a2a`, `b14fd62`
- **影響ファイル**: src/modules/c4.js, src/core/parser-utils.js, mermaid-assist.html, tests/c4-*.test.js, tests/e2e/c4-basic.spec.js, tests/run-tests.js

## コンテキスト

Tier3 Phase 11。C4 Diagram (C4Context / C4Container) 対応。ソフトウェアアーキテクチャの C4 モデル (Context / Container) を Mermaid で記述し、Person / System / System_Ext / Container / ContainerDb / ContainerQueue などの要素と Rel / BiRel / Rel_U/D/L/R などのリレーションを GUI で編集可能に。

## 対策

DiagramModule v2:
- **コア要素**: element (kind, id, label, tech?, descr?) / rel (kind, from, to, label, tech?)
- **meta**: title, variant (C4Context / C4Container)
- **operations**: setTitle / setVariant / addElement / addRel / updateElement / updateRel / deleteLine
- **UI**: Variant + Title セクション (variant セレクタ + title 入力) / 要素追加フォーム (Kind / ID / Label / Tech / Description) / リレーション追加フォーム (Kind / From / To / Label / Tech) / 要素一覧 (選択/削除) / リレーション一覧 (選択/削除) / 要素ディテール編集 (ラベル変更)

## 結果

- 323 unit + 9 E2E passed
- visual sweep PASS (default C4Context / C4Container+tech / multi-Rel+tech / cross-switch、console error 0)
- v1.13.0 リリース (Tier3 Phase 11 完了)
