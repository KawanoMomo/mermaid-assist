# Tier2 Phase 5: Gitgraph Design Spec

- **作成日**: 2026-04-17
- **ステータス**: 承認済
- **対象バージョン**: v1.7.0 (Tier2 完備)

## ゴール

Mermaid Gitgraph (`gitGraph`) を Tier1 同等粒度で対応。GitFlow/ブランチ戦略の説明図として利用可能。

## 構文サンプル

```
gitGraph
    commit id: "init"
    commit
    branch develop
    commit id: "v0.1"
    branch feature-login
    commit
    commit type: HIGHLIGHT tag: "milestone"
    checkout develop
    merge feature-login
    checkout main
    merge develop tag: "v1.0"
    cherry-pick id: "v0.1"
```

## スコープ

### 対応要素
- **commit**: id (任意), type (NORMAL/REVERSE/HIGHLIGHT), tag (任意)
- **branch**: ブランチ作成・切替 (`branch <name>`)
- **checkout**: ブランチ切替 (`checkout <name>`)
- **merge**: ブランチマージ (`merge <name> [tag:"x"] [type:HIGHLIGHT]`)
- **cherry-pick**: 既存 commit をピックアップ (`cherry-pick id:"x"`)

### 対応 operations
- `add-commit`: 現在 HEAD ブランチに commit を追加 (id/type/tag 指定可)
- `add-branch`: branch 作成
- `add-checkout`: checkout 行追加
- `add-merge`: merge 行追加
- `add-cherry-pick`: cherry-pick 追加
- `update-commit`: id/type/tag 書き換え
- `delete`: 任意行削除
- `moveUp / moveDown`: 行順序入替 (警告: 構文的に意味変わる可能性あり、同一ブランチ内 commit 順序入替を推奨)
- `connect`: なし (Git 操作は専用 merge / cherry-pick で表現)

### 対象外
- ブランチ表示色指定 (`%%{init: ...}%%`)
- 複雑な commit message 編集 (Mermaid Gitgraph の `commit` は id/type/tag のみ)

## アーキテクチャ

- 新規: `src/modules/gitgraph.js`
- 各行を kind='commit'/'branch'/'checkout'/'merge'/'cherry-pick' として要素化
- parse は逐次・現在ブランチを track
- UI: 5 追加フォーム + 詳細パネル (commit/branch/merge/cherry-pick)

## データモデル

```js
{
  meta: {},
  elements: [
    { kind: 'commit', id: 'init', commitType: 'NORMAL', tag: '', branch: 'main', line: N },
    { kind: 'branch', name: 'develop', fromBranch: 'main', line: N },
    { kind: 'checkout', target: 'develop', line: N },
    { kind: 'merge', target: 'feature-login', tag: '', mergeType: 'NORMAL', line: N },
    { kind: 'cherry-pick', id: 'v0.1', line: N },
  ],
  relations: [],
}
```

## UI

- 5 追加フォーム (縦並びラベル付き):
  - Add Commit: `[id (任意)] [type select] [tag (任意)] [+]`
  - Add Branch: `[name] [+]`
  - Add Checkout: `[target select] [+]`
  - Add Merge: `[target select] [tag (任意)] [+]`
  - Add Cherry-pick: `[id] [+]`
- 詳細パネル: 各行編集可能、削除可能

## テスト設計

- Unit ~15 cases
- E2E ~10 cases (E57-E66)
- system-tester 100%
- visual sweep: default + branches/merges/cherry-pick
- シナリオ: GitFlow 説明図 (main + develop + feature + release の4ブランチ構成)

## 完了基準

全テスト PASS、system-tester 100%、visual sweep 0 error、GitFlow シナリオ PASS、ECN-018、v1.7.0 tag (**Tier2 完備**)。
