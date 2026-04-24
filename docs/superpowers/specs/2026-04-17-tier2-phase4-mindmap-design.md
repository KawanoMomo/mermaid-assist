# Tier2 Phase 4: Mindmap Design Spec

- **作成日**: 2026-04-17
- **ステータス**: 承認済
- **対象バージョン**: v1.6.0

## ゴール

Mermaid Mindmap を Tier1 同等粒度で対応。機能設計ブレスト・構造検討に利用可能。

## 構文サンプル

```
mindmap
  root((組み込み設計))
    ハードウェア
      MCU[ARM Cortex-M4]
      Sensor
        温度
        圧力
    ソフトウェア
      FreeRTOS
      Communication
        CAN
        UART
    テスト
      ::icon(fa fa-flask)
      単体テスト
      結合テスト
```

## スコープ

### 対応要素
- **root**: ルートノード (最上位、通常 `((text))` 形式)
- **node**: 子ノード (インデントで階層表現)
- **shape**: 6種 — default / `[text]` square / `(text)` rounded / `((text))` circle / `))text((` bang / `)text(` cloud / `{{text}}` hexagon
- **icon**: `::icon(fa fa-xxx)` 形式 (ノード内の子行として)
- **class**: `:::className` (スタイリング用、parse のみ対応、UI 編集は外す)

### 対応 operations
- `add-child`: 選択ノードの子として新規追加
- `add-sibling`: 選択ノードの兄弟として追加
- `indent`: インデント +2 (深化 — より深い子に)
- `outdent`: インデント -2 (浅化 — 親と同レベルへ)
- `update-text-shape-icon`: テキスト / shape / icon の書き換え
- `delete`: ノード削除 (子ノードも一緒に削除)
- `moveUp / moveDown`: 同階層内の順序入替
- `connect`: なし (tree 構造固定)

## アーキテクチャ

- 新規 `src/modules/mindmap.js`
- 新規パターン: indent-based parse → tree 構造へ復元
- properties helpers + 縦並びフォーム

## データモデル

```js
{
  meta: {},
  elements: [
    { kind: 'node', id: '__n0', text: '組み込み設計', shape: 'circle', parentId: null, level: 0, icon: '', line: N },
    { kind: 'node', id: '__n1', text: 'ハードウェア', shape: 'default', parentId: '__n0', level: 1, line: N },
    { kind: 'node', id: '__n2', text: 'MCU', shape: 'square', parentId: '__n1', level: 2, line: N, label: 'ARM Cortex-M4' },
  ],
  relations: [],  // unused for mindmap
}
```

## UI

- Add 追加フォーム (縦並び): `[親ノード select] [Text] [Shape select 6種] [+ 子追加]`
- Add sibling (選択中ノードがある場合のみ visible): `[Text] [Shape select] [+ 兄弟追加]`
- ノード一覧 (tree 表示、indent で階層を視覚化)
- 詳細パネル: `[Text] [Shape select] [Icon input] [indent/outdent] [削除][↑][↓]`

## テスト設計

- Unit ~15 cases (parse: indent levels / shapes / icon + updater: add/indent/outdent/delete/move)
- E2E ~8 cases (E49-E56)
- system-tester 100%
- visual sweep: default + 各 shape + icon 表示
- シナリオ: 組み込み設計ブレスト (3階層、複数ブランチ、1 icon)

## 完了基準

全テスト PASS、system-tester 100%、visual sweep 0 error、シナリオ PASS、ECN-017、v1.6.0 tag。
