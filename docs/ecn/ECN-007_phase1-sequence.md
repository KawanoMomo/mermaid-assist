# ECN-007: Phase 1 — Sequence Diagram 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v0.6.0
- **対象コミット**: `2556604`, `dcde0a0`
- **影響ファイル**: `src/modules/sequence.js`, `tests/sequence-*.test.js`, `tests/e2e/sequence-basic.spec.js`, `mermaid-assist.html`

## コンテキスト

Tier1 ロードマップに従い Sequence Diagram 対応を追加。組み込みエンジニアのプロトコル設計・通信シーケンス記述で頻出する図形のため優先度高。

## 対策

`src/modules/sequence.js` を DiagramModule v2 インターフェースで実装:

- **コア要素**: participant, actor, message
- **アローパターン全8種**: `->` `-->` `->>` `-->>` `-x` `--x` `-)` `--)`
- **サブ要素**: loop, alt/else, opt, par/and, note, autonumber
- **operations**: add (participant/message/note/block), delete, update, moveUp/Down, connect
- **groups モデル**: ブロック構造 (loop/alt/par/opt) を `parentId` でネスト管理
- **template()**: デフォルト Client/Server シーケンス

UI 側:
- `mermaid-assist.html` の図種 select に `<option value="sequenceDiagram">` 追加
- `app.js` の renderProps/buildOverlay ディスパッチで `currentModule.type === 'gantt'` 判定して 4-arg/2-arg を使い分け
- diagram-type select 切替で template ロード

## 結果

- 24 ユニット + 7 E2E テスト追加、合計 59 unit + 97 E2E 全 PASS
- v0.6.0 リリース
