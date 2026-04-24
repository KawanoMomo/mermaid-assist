# ADR-020: selected-element アクションバーの共通ヘルパ化

**状態**: 採択
**日付**: 2026-04-24
**関連 spec**: `docs/superpowers/specs/2026-04-24-tier2-action-bar-common-ui-design.md`

## 決定

`↑ この前に挿入 / ↓ この後に挿入 / ↑ 上へ / ↓ 下へ / 削除` の 5 ボタンを出す
selected-element 用アクションバーを、`window.MA.properties` 配下の共通
ヘルパ `actionBarHtml(idPrefix, opts)` + `bindActionBar(idPrefix, handlers)`
として抽出する。

## 背景

Sequence モジュールで確立したアクションバー UX を他モジュールに展開する際、
現在は HTML / event 接続コードを**コピペ**するしかない。20 モジュールに
展開すれば ~100 箇所の重複が発生する。

## 選択肢と判断

### A. ボタン種別 fixed、ラベルだけ差し替え可 (却下)
- シンプルで予測可能
- 却下理由: モジュール固有アクション (例: flowchart の「エッジ反転」) を
  足せず、将来の拡張で再度ヘルパ外へ HTML を書く羽目になる

### B. ボタン配列を受け取る完全 generic (却下)
- 最大の柔軟性
- 却下理由: 呼び出し側が複雑になり、モジュール間で「5 ボタンの並び」が
  不一致になって UX 一貫性を損なう

### C. 固定 5 ボタン + extra placeholder **(採択)**
- 標準 5 ボタンは固定、モジュール固有は `<prefix>-extra` に任意 append
- Sequence が即移行可能、他モジュールでも追加アクションを後付けで足せる
- 欠点: prefix ごとに extra div を生成するオーバーヘッド (微小)

## 帰結

- **呼び出し側コード削減**: モジュール毎に ~20 行 → ~5 行
- **UX 一貫性**: 5 モジュール全部で同じボタン配置・挙動
- **拡張点**: extra placeholder がモジュール固有アクションの安定した挿入点を提供
- **Sequence 既存実装の移行**: 回帰リスクはあるが、Playwright 回帰で担保

## Forward compat

未知の opts キー / 未知の handlers キーは無視する。Tier 3/4 で新ボタン種別
が必要になったら、opts / handlers に新キーを追加するだけで済む
(呼び出し側の既存コードは壊れない)。

## 関連

- ADR-021: CSS 汎用化 (同時適用)
- ADR-022: ID 命名規則
