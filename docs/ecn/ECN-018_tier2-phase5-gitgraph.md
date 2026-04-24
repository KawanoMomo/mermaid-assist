# ECN-018: Tier2 Phase 5 — Gitgraph 対応 (Tier2 完備)

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.7.0 (**Tier2 完備マイルストーン**)
- **対象コミット**: `96ffeec`, `f073ff5`, `183268a`
- **影響ファイル**: `src/modules/gitgraph.js`, `src/core/parser-utils.js`, `mermaid-assist.html`, `tests/gitgraph-*.test.js`, `tests/e2e/gitgraph-basic.spec.js`, `tests/run-tests.js`
- **関連 ADR**: ADR-011, ADR-012, ADR-014, ADR-015, ADR-016
- **関連 spec**: Phase 5 design (25 REQ) / test-spec (25 EV/TC)

## コンテキスト

Tier2 Phase 5 (最終)。GitFlow・ブランチ戦略の説明図に用いる Mermaid Gitgraph を Tier1 同等粒度で対応。v1.7.0 は **Tier2 完備** を意味する (Gantt + Sequence + Flowchart + State + Class + ER + Requirement + Block + Timeline + Mindmap + Gitgraph = 全 11 図形対応)。

## 対策

DiagramModule v2:

- **コア要素**: commit (id/type/tag), branch, checkout, merge (target/tag), cherry-pick (id)
- **commit type 3種**: NORMAL / REVERSE / HIGHLIGHT
- **operations**: addCommit / addBranch / addCheckout / addMerge / addCherryPick / updateCommit / updateBranch / updateCheckout / updateMerge / updateCherryPick / deleteLine / moveUp/Down
- **connect**: なし (Git 操作は merge/cherry-pick で表現)
- **UI**: 5 縦並び追加フォーム (Commit / Branch / Checkout / Merge / Cherry-pick) + kind 別詳細パネル

parse は逐次・現在ブランチを track (checkout/branch で更新)。

## 結果

- **ユニット**: 247 passed (Phase 4 時点 222 + Gitgraph 25 新規)
- **E2E**: 13 passed (E57-E66 + 3 switching)
- **system-tester**: 25 REQ / 25 EV / 25 TC, coverage 100%
- **visual sweep**: PASS (basic + 3 commit types + cherry-pick + cross-switch 全通過)
- **GitFlow シナリオ MCP**: PASS (4-branch 構成 × 16 lines を UI のみで完成、target byte-equivalent)
- v1.7.0 リリース (**Tier2 完備**)

## 教訓

1. **Gitgraph parse の現在ブランチ追跡**: `checkout` / `branch` で currentBranch を書き換える state machine が必要。パースが複雑になる他図形と異なるパターン。
2. **commit の args 任意順序**: `commit id: "x" type: NORMAL tag: "y"` で key/value 組み合わせが任意順序。key: value 正規表現で parse する方が堅牢。
3. **formatCommit の minimal output**: NORMAL type は出力省略が慣習 (`commit` とだけ書く方が短い)。UI で明示的に NORMAL を選んだ場合も default 扱いで省略。

## Tier2 完備記念 — 対応図形一覧 (全 11 図形)

| # | Diagram | Version | Phase | 主な用途 |
|---|---|---|---|---|
| 1 | Gantt | v0.1.0 | Tier1 | スケジュール |
| 2 | Sequence | v0.6.0 | Tier1 P1 | シーケンス設計 |
| 3 | Flowchart | v0.7.0 | Tier1 P2 | フロー・プロセス |
| 4 | State | v0.8.0 | Tier1 P3 | 状態遷移 |
| 5 | Class | v0.9.0 | Tier1 P4 | OO 設計 |
| 6 | ER | v1.0.0 | Tier1 P5 | DB 設計 |
| 7 | Requirement | v1.3.0 | Tier2 P1 | 要件管理 (IEC 61508) |
| 8 | Block | v1.4.0 | Tier2 P2 | HW 構成 |
| 9 | Timeline | v1.5.0 | Tier2 P3 | リリース計画 |
| 10 | Mindmap | v1.6.0 | Tier2 P4 | 設計ブレスト |
| 11 | Gitgraph | v1.7.0 | Tier2 P5 | GitFlow 説明 |
