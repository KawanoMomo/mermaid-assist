# Tier2 Phase 2: Block Diagram Design Spec

- **作成日**: 2026-04-17
- **ステータス**: 承認済 (Tier2 ロードマップに基づく auto-approve)
- **対象バージョン**: v1.4.0
- **前提**: Tier2 Phase 1 完了 (v1.3.0)
- **関連 ADR**: ADR-011, ADR-012, ADR-014, ADR-015, ADR-016
- **関連 ECN**: ECN-014

## ゴール

Mermaid Block Diagram (`block-beta`) を Tier1 同等の操作粒度で対応し、組み込み実務 (ECU ハードウェア構成、システムブロック分割) で利用可能にする。

## スコープ

### 対応要素

- **block**: standalone ブロック / nested ブロック (入れ子)
- **columns**: レイアウト制御 (1〜N 列)
- **link**: 矢印リンク (`A --> B`、`A -- label --> B`)

### 対応 operations

- `add`: add-block (standalone) / add-nested-block / add-link
- `delete`: ブロック・リンク削除
- `update`: text / style 書き換え
- `moveUp / moveDown`: ブロック順序入替
- `connect`: Connection Mode 経由で矢印リンク作成

### 対象外

- `styles`, `classDef` 等のスタイリング文法 (将来)
- Architecture diagram (Tier3 候補)

## アーキテクチャ

- 新規: `src/modules/block.js` (DiagramModule v2)
- Flowchart モジュール (`src/modules/flowchart.js`) を近似パターンとして参照
- `window.MA.properties` 14 ヘルパー全面利用 (ECN-012)
- 縦並びラベル付き追加フォーム (ECN-013 / ADR-015)
- mermaid.js v11 の `block-beta` 描画 (Phase 開始時の動作確認で `block-beta` 文字列を lib から確認済み)

## Mermaid 構文サンプル

```
block-beta
  columns 3
  a["Sensor"] b["Controller"] c["Actuator"]
  a --> b
  b --> c
```

nested:
```
block-beta
  columns 2
  block:group1
    inner1 inner2
  end
  outer1
```

## データモデル

`parse(text)` 戻り値:

```js
{
  meta: { columns: 3 },
  elements: [
    { kind: 'block', id: 'a', label: 'Sensor', shape: 'square', parentId: null, line: N },
    { kind: 'group', id: 'group1', parentId: null, line: N },
    { kind: 'block', id: 'inner1', label: 'inner1', parentId: 'group1', line: N },
  ],
  relations: [
    { id: '__rel_0', from: 'a', to: 'b', label: '', line: N },
  ],
}
```

## UI / プロパティパネル構造

### 追加フォーム (縦並びラベル付き)

- Add Block: `[Name input] [Label input] [+ ボタン]` (※ Label 省略可、その場合 Name が表示)
- Add Link: 縦1列 `[From select] [To select] [Label input] [+ ボタン]`
- Set Columns: `[columns input] [適用]` (全体に1つ)

### 個別要素編集パネル

- **Block**: `[Name] [Label] [削除][↑][↓]`
- **Link**: `[From select] [To select] [Label] [削除]`

## テスト設計

### ユニットテスト (~18 cases)
- parse: block standalone / nested / columns / link with/without label / コメント
- updater: add / delete (cascade for links when block removed) / update / moveUp/Down / connect

### E2E (~8 cases, E33-E40)
- switch to block → template → SVG render
- add block / add nested (if supported by UI) / add link
- update label / delete
- vertical add form labels

### system-tester
`docs/superpowers/specs/2026-04-17-tier2-phase2-block-test-spec.md` に出力、REQ/EV/TC 100% カバレッジ。

### visual sweep
evaluator で実機スクリーンショット、console error 0。

### 実用シナリオ
ECU ハードウェア構成ブロック図 (e.g. Sensor/MCU/Actuator の3列構成、内部 block 含む)

## 完了基準

- 全 unit + E2E PASS
- system-tester 100% / 禁止語 0
- visual sweep PASS
- ECU HW構成シナリオ PASS
- ECN-015、master merge、v1.4.0 tag (push は Tier2 完備時にまとめて)
