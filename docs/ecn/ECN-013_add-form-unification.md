# ECN-013: 追加フォーム縦並び統一 + system-tester 連携

- **ステータス**: 適用済
- **種別**: 改善
- **バージョン**: v1.2.0
- **対象コミット**: `d082e0d`, `10ea7f9`, `aefb5b2`, `3f21eeb`, `9186378`, `de1d941`, `6e051c5`, `e19d6f6`, `f34a81b`
- **影響ファイル**: `src/modules/{sequence,flowchart,state,class,er}.js`, `tests/e2e/*-basic.spec.js`
- **関連ADR**: ADR-015, ADR-016

## コンテキスト

実ユースケースで Sequence のメッセージ送信先指定が直感的でないという指摘。原因調査で以下が判明:

- 追加フォームの3〜4個のドロップダウンが横並び・ラベル無し
- 220px の property panel に対し画面外切れが発生
- 個別要素編集パネルは縦1列・ラベル付き → 追加と編集で UI が異なる

問題は5図形全てに存在（Sequence/Flowchart/State/Class/ER）。

## 対策

5モジュールのリレーション系追加フォームを縦1列・ラベル付きに統一（並列 worktree で改修）:

- Sequence: メッセージ追加 (From/Arrow/To/ラベル)
- Flowchart: エッジ追加 (From/Arrow/To/ラベル)
- State: 遷移追加 (From/To/イベント)
- Class: 関連追加 (From/Arrow/To/ラベル)
- ER: リレーションシップ追加 (From/Left card/Right card/To/ラベル)

`window.MA.properties.selectFieldHtml` ヘルパー流用（ECN-012 の成果）。element ID 不変のため既存 E2E と互換。

並列改修中に発見された不具合: state.js で agent が新規導入した `props.selectFieldHtml` が、既存 alias `var P = ...` と不整合で `props is undefined` ReferenceError 発生 → 即修正（commit `de1d941`）。

実験的に system-tester エージェント（ADR-016）を初導入し、spec から要件・評価項目・テストタスクを構造化抽出:
- 26 要件 / 32 評価項目 / 32 テストタスク / カバレッジ100% / 禁止語0
- E15-E24 (10件) を新規 E2E 追加
- 5シナリオ（OAuth/受注フロー/組み込み状態/ECドメイン/DB設計）を MCP 実機検証

## 結果

- 113 unit + 133 E2E 全 PASS（10件追加）
- 5シナリオ MCP visual sweep 全 PASS（console error 0）
- v1.2.0 リリース、GitHub プッシュ済み

教訓は ADR-015, ADR-016 にも記載（並列改修時の alias 統一、system-tester の workspace agent コピー要件、UI レイアウト統一の保守性メリット）。
