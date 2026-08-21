# ECN-032: 契約経路の Blocker 3件と、日本語識別子の扱い (A90〜A106)

- **ステータス**: 適用済 (未マージ)
- **種別**: 不具合修正
- **バージョン**: (未リリース / PR #16)
- **対象コミット**: `dd121a2`, `d41239d`, `41fa4b4`, `74321b3`, `e1c6ba6`, `55d1a3c`, `8324171` ほか (PR #16)
- **影響ファイル**: src/core/text-updater.js, src/app.js, src/modules/{requirement,gitgraph,quadrant,mindmap,packet,sankey,gantt}.js
- **マイルストーン**: 欠陥 **17件**を修正 (うち Blocker 3件)

## コンテキスト

「UI 経路だけ直して契約経路を忘れる」形の欠陥を、追加・並べ替えの2操作で
まとめて検出した。実描画の網が**改名と削除にしか掛かっていなかった**ことが原因。

## 何を変えたか

### Blocker 3件

| # | 内容 | 実測 |
|---|---|---|
| A91 | **「+ 要件追加」を押しただけで図が壊れる** | 空の `id: ""` `text: ""` `type: ""` は mermaid が Parse error。行そのものを省けば通る |
| A100 | **先頭の要素を上へ動かすと図の宣言行と入れ替わり図が消える** | `flowchart TD` が2行目に落ち「No diagram type detected」 |
| A104 | **人の速さで打つと1打鍵ごとに全体を描き直す** | 400要素で10文字打つ間に **14718ms** UI が固まる → **1409ms** |

### 日本語の識別子 — 記録の誤りが3件

「mermaid の制限」と記録していたものが、実測すると**引用符で通った**。

| 図種 | 記録 | 実測 |
|---|---|---|
| requirementDiagram | 「識別子なので半角しか通らない」 | `requirement "受信要求" {` で通る |
| gitGraph | (未検討) | `branch "機能A"` で通る |
| quadrantChart | (追加経路だけ未対応) | `"試作品": [0.5, 0.5]` で通る |

一方 **architecture の service id と radar の curve id は引用符でも通らない**。
図種単位で「日本語が使えない」と記録すると必ず誤る
(architecture は**ラベルは通るが id は通らない**)。

### 並べ替えの作り直し

素の行入れ替えを**要素が占める範囲ごとの入れ替え**に統一 (18モジュール)。
並びが構造そのものの2図種は個別実装:

- **mindmap** 字下げが親子関係 → 同じ親の兄弟を**子孫ごと**動かす
- **packetBeta** ビット位置が中身 → 入れ替え後に**幅を保って振り直す**

## 影響範囲

- ユニット 977 → **1084**、e2e 410 → **424**
- `docs/adr/drafts/draft-move-block-semantics.md` / `draft-adaptive-render-debounce.md` /
  `draft-add-kind-alias.md` を起票 (未採番)

## 姉妹プロジェクトへの横展開

| 観点 | 該当しそうなプロジェクト |
|---|---|
| 「UI 経路だけ直して契約経路を忘れる」 | **06_PlantUMLAssist** (05 の姉妹・同じ契約設計) / 04_StableState |
| 日本語識別子の引用符 | **06_PlantUMLAssist** (PlantUML は識別子規則が別なので要実測) |
| 並べ替えが宣言行を巻き込む | **06_PlantUMLAssist** / 01_StatbleBlock (DSL の1行目が図種宣言) |
| 打鍵ごとの再描画 | **06_PlantUMLAssist** / 04_StableState / 01_StatbleBlock |
