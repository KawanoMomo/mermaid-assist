# ADR-012: DiagramModule v2 インターフェース

**Status:** Accepted
**Date:** 2026-04-14
**Project:** 05_MermaidAssist

## Context

v0.4.0 までの DiagramModule (ADR-009) は Gantt 専用に設計されており、
他図形（Flowchart, Sequence等）では編集プリミティブの共通化が困難だった。
Tier1 マルチ図形対応に向けて統一インターフェースが必要。

## Decision

DiagramModule v2 として以下を標準化:
- `operations: { add, delete, update, moveUp, moveDown, connect }` を共通
  プリミティブとして定義
- `parse()` の戻り値に `groups` フィールドを追加（subgraph, composite
  state, loop/alt 等のサブ要素表現）
- `template()` を追加（新規作成時のひな型生成）

実装上の補足: Phase 0 では Gantt の純粋関数のみを `src/modules/gantt.js`
に移動。`buildOverlay` `renderProps` などUIメソッドはDOM依存が強いため
当面は `src/app.js` に残置。Phase 1 で Sequence モジュールを追加する際に
共通化点を発見しつつ完全な v2 インターフェースに移行する。

## Consequences

### Positive
- 全図形モジュールが同一インターフェースで実装できる方向性が定まった
- UI層（properties.js）が統一APIで動作可能
- 新図形追加時の認知負荷低減

### Negative
- Gantt の既存 `updateText(text, change)` は互換のため残置
- `connect` は Gantt では使わないが noop 実装が必要
- Phase 0 時点では UI メソッドの完全分離は未達（漸進的に対応）
