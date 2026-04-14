# ADR-013: Connection Mode による汎用エッジ作成

**Status:** Accepted
**Date:** 2026-04-14
**Project:** 05_MermaidAssist

## Context

Flowchart, Sequence, Class, State, ER の各図形でエッジ/関係/遷移を
GUI で作成する操作が必要。図形ごとに操作モデルを変えると学習負荷が高い。

## Decision

クリック2回でソース→ターゲット指定するConnection Modeを共通機構として
`src/core/connection-mode.js` に実装。各図形モジュールの
`operations.connect(text, fromId, toId, props)` を呼び出す。

API:
- `startConnectionMode(srcType, srcId, onComplete)` — モード突入
- `cancelConnectionMode()` — Esc等で中断
- `notifyTarget(targetType, targetId)` — overlay click handlerから呼ぶ
- `isInConnectionMode()` — モード状態取得
- `getSource()` — ソース要素取得

## Consequences

### Positive
- 全図形で統一の接続操作
- カーソル変化等のUIフィードバックを共通化可能
- 単独テスト容易（モード状態を持つだけ）

### Negative
- モード状態管理が必要（active/inactive）
- 誤操作時のキャンセル経路（Esc, 別要素クリック）を全図形で考慮必要
