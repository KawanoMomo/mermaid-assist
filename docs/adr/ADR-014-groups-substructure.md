# ADR-014: サブ要素 (groups) のパース・編集モデル

**Status:** Accepted
**Date:** 2026-04-14
**Project:** 05_MermaidAssist

## Context

Mermaid の図形には階層構造を持つ要素がある:
- Flowchart: subgraph
- Sequence: loop, alt, par, opt
- State: composite state, fork/join
- Class: namespace

これらを統一形式でパース・編集する必要がある。

## Decision

ParsedData に `groups` 配列を追加:

```javascript
groups: [
  {
    kind: "subgraph"|"loop"|"alt"|"composite"|...,
    id: "...",
    line: ...,        // 開始行 (1-based)
    endLine: ...,     // 終了行 (end キーワード)
    label: "...",
    children: [...]   // 含まれる element ID
  }
]
```

## Consequences

### Positive
- 階層を持つ図形を統一表現できる
- ネスト構造の検証が共通ロジックで可能

### Negative
- ER 等のシンプルな図形では未使用フィールドとなる
- 行範囲（line, endLine）の整合性管理が必要
