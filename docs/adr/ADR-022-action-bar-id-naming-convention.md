# ADR-022: アクションバーボタン ID 命名規則

**状態**: 採択
**日付**: 2026-04-24
**関連 spec**: `docs/superpowers/specs/2026-04-24-tier2-action-bar-common-ui-design.md`

## 決定

`actionBarHtml` が生成するボタンの ID は `<prefix>-<action>` 形式で統一し、
prefix は以下の規則に従う:

- 単一選択時: `sel-<kind>` (例: `sel-node`, `sel-msg`, `sel-state`, `sel-note`, `sel-group`)
- 複数選択時: `sel-multi`
- action 部分は固定: `-insert-before`, `-insert-after`, `-up`, `-down`, `-delete`, `-extra` (placeholder)

## 背景

DOM 上で同じ ID が複数存在すると `getElementById` が片方しか返さず、
click handler の接続が無言で失敗する。モジュール間で命名規則を揃えないと、
将来 renderProps に複数のアクションバー (例: 親要素 + 子要素) を同時描画
する拡張を行う際に衝突が発生しうる。

## 選択肢と判断

### A. ID 命名規則をモジュール任せ (却下)
- 各モジュールが自由に命名 → 衝突検出が難しい
- Sequence の先例 (`sel-msg-*`, `sel-part-*`) と非統一になる

### B. `sel-<kind>` を必須とし、action suffix は helper 側で制御 **(採択)**
- prefix は呼び出し側が決める (`sel-node`, `sel-edge` など)
- action suffix は helper 内部の実装詳細、呼び出し側は意識しない
- 複数選択は `sel-multi` で固定 (既に Sequence で採用済の慣習)

### C. 自動生成 ID (uuid など) (却下)
- 衝突リスク無しだが、デバッグ時に ID が分からず追跡困難
- テストで ID を使って getElementById できない

## 帰結

- 呼び出し側は `actionBarHtml('sel-node', opts)` のように prefix を渡すだけ
- 同一 renderProps 呼び出し内で同じ prefix を 2 度使ってはならない (ルール)
- prefix の `<kind>` 部分は**モジュール内で一意**であれば良い (モジュール間は独立)

## ルール (契約)

1. prefix 必須接頭辞: `sel-` または `sel-multi-`
2. prefix の `<kind>` 部分は短く、モジュール内で一意な英小文字 (例: `msg`, `note`, `node`, `edge`, `state`, `class`, `entity`, `event`)
3. 同一 renderProps 呼び出し内で 2 つ以上のアクションバーをレンダリング
   しないこと。複数選択 panel は `sel-multi` prefix を使い、単一選択 panel と
   同時表示しない
4. テストは prefix を引数で受け取って `getElementById` する形で書くこと
   (ハードコードしない)

## 関連

- ADR-020: アクションバー共通化 (本命名規則はこちらに従って設計)
- ADR-021: CSS 汎用化
