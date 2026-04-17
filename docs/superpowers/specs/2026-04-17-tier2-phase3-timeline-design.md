# Tier2 Phase 3: Timeline Design Spec

- **作成日**: 2026-04-17
- **ステータス**: 承認済 (Tier2 ロードマップ準拠)
- **対象バージョン**: v1.5.0
- **関連 ADR**: ADR-011, ADR-012, ADR-014, ADR-015, ADR-016

## ゴール

Mermaid Timeline を Tier1 同等の操作粒度で対応。リリース計画・開発スケジュールに利用可能。

## スコープ

### 対応要素
- **title**: 図のタイトル
- **section**: セクション (グループ区切り)
- **period**: 期間 (時刻・日付文字列など)
- **event**: period に紐付くイベント (複数可)

### 構文サンプル

```
timeline
    title プロジェクトリリース計画
    section Q1
      2026-01-15 : キックオフ
      2026-02-01 : 要件定義完了 : 設計開始
      2026-03-20 : 実装フェーズ開始
    section Q2
      2026-04-10 : プロトタイプ
      2026-05-15 : ベータリリース
```

### 対応 operations
- `add`: add-title / add-section / add-period / add-event (既存 period に追加)
- `delete`: title / section / period / event 削除
- `update`: 各フィールドのテキスト書き換え
- `moveUp / moveDown`: 順序入替 (時系列の意味を持つ)
- `connect`: なし (time-sequential なので)

### 対象外
- period → section の再ぶら下げ (move 操作は同一 section 内のみ)

## アーキテクチャ

- 新規: `src/modules/timeline.js` (DiagramModule v2)
- Gantt モジュールを section 管理パターンの参照
- properties helpers 利用、縦並びフォーム、auto-quote 不要 (timeline は quote 制約ゆるい)

## データモデル

```js
{
  meta: { title: '...' },
  elements: [
    { kind: 'section', id: 'Q1', label: 'Q1', line: N },
    { kind: 'period', id: 'p1', period: '2026-01-15', events: ['キックオフ'], parentId: 'Q1', line: N },
  ],
  relations: [],
}
```

## UI / プロパティパネル

- Title 設定: `[title input] [適用]`
- Add Section: `[name] [+]`
- Add Period: `[section select] [period text] [first event text] [+]`
- Add Event to period: `[period select] [event text] [+]`
- 詳細パネル: section / period (events list を含む) / event (個別)

## テスト設計

- Unit: ~15 cases (parse: title/section/period/event + updater: add/delete/update/move)
- E2E: ~8 cases (E41-E48)
- system-tester 100% coverage
- visual sweep: default + various section/period counts
- シナリオ: プロジェクトリリース計画 (3 section × 3-4 period, 複数 event)

## 完了基準

全テスト PASS、system-tester 100%、visual sweep 0 error、リリース計画シナリオ PASS、ECN-016、v1.5.0 tag。
