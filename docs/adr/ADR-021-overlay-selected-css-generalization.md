# ADR-021: overlay 選択強調 CSS の汎用化

**状態**: 採択
**日付**: 2026-04-24
**関連 spec**: `docs/superpowers/specs/2026-04-24-tier2-action-bar-common-ui-design.md`

## 決定

`.overlay-message.selected`, `.overlay-note.selected`, `.overlay-group.selected`,
`.overlay-participant-handle.selected` を列挙していた CSS を、属性セレクタ
`#overlay-layer [class*="overlay-"].selected` に一本化する。

## 背景

Sequence モジュールだけで overlay-* クラスが 4 種類あり、今後他モジュールで
overlay-node / overlay-edge / overlay-state / overlay-entity などが追加される
見込み。列挙方式だと**新モジュールを足すたびに CSS を編集する必要**があり、
漏れると選択強調が出ないまま気付かれない。

## 選択肢と判断

### A. 列挙方式を維持 (却下)
- 各モジュール追加時に CSS 編集が必要
- 漏れが発覚しにくい (スクショを撮らないと分からない)

### B. `[class*="overlay-"]` 属性セレクタ **(採択)**
- 新しい overlay-xxx クラスに**自動適用**
- Gantt の `.overlay-bar` は `.selected` クラスを付けないので誤発火しない
- 書きやすく、1 行で済む

### C. data-属性ベース (`[data-selected="true"]`) (却下)
- モジュール側で `.classList.add('selected')` ではなく
  `setAttribute('data-selected', 'true')` にする必要があり、既存コード書き換え量が増える
- CSS セレクタの書きやすさは B とほぼ同じ

## 帰結

- **新モジュールで自動的に選択強調 CSS が効く** (overlay-xxx クラスと
  `.selected` を付けるだけ)
- **誤発火リスク**: `[class*="overlay-"]` は `.overlay-bar` にもマッチするが、
  Gantt 側は `.selected` クラスを使わないので安全。将来 Gantt に `.selected`
  を導入する場合は別クラス名 (`.gantt-selected` など) を使うルールとする
- CSS 行数削減 (4 ルール → 1 ルール)

## 制約 / ルール

- overlay クラス名は必ず `overlay-` で始めること (新モジュール実装時の契約)
- Gantt は `.selected` クラスを使わない (既存踏襲、将来変更時は別クラス
  命名でこの ADR を updated 扱い)
- CSS で色は `var(--accent-green, #7ee787)` のように fallback を持たせる

## 関連

- ADR-020: アクションバー共通化 (同時適用)
- ADR-022: ID 命名規則
