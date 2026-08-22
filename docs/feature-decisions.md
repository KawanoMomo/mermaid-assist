# 機能追加の判断記録

- **作成**: 2026-08-23
- **なぜ残すか**: 「なぜこの機能が無いのか」を後から聞かれたときに答えられるようにする。
  見送りの判断を口頭で済ませると、同じ検討を繰り返すか、黙って方針が変わる。

## 前提

| 項目 | 値 | 根拠 |
|---|---|---|
| 差別化軸 | **単一HTMLでオフライン完結・決定的出力・Git差分親和性** | R62で `.mmd` 保存のバイト一致とCRLF保持を実測 |
| ライセンス | **MIT** | `LICENSE` / `package.json` / `README.md:106` の3か所で一致 |
| 同梱物 | mermaid.js (MIT)、`lib/LICENSE.mermaid` を併記 | README:108 |
| 開発体制 | 実質1名・断続的 | — |

**MIT は同梱物の追加に寛容だが、単一HTMLに全部を埋め込む配布形態のため、
コピーレフト系を1つでも取り込むと成果物全体に伝播する。**
依存を足すときは必ずここを確認する。差別化軸と直結する制約。

## 判定一覧

| ID | 機能 | 規模 | 判定 |
|---|---|---|---|
| FEAT-001 | まとめて言い換え (一括置換) | S | **GO** |
| FEAT-002 | 図を直接つついて直す (視覚編集) | XL | NO-GO |
| FEAT-003 | 自然言語からの図の生成 | M | NO-GO |
| FEAT-004 | 閉じても作業が残る (UI-064) | M | NEED-INFO |
| FEAT-005 | ヘルプへの入口を増やす | S | **GO** |
| FEAT-006 | 同じ画面を2人以上で同時に直す | XL | NO-GO |

## 見送りの理由 (聞かれたときの回答)

**FEAT-002 図の直接編集がないのはなぜか**
21図種すべてで図とテキストの対応付けを持つ必要があり、単一HTMLで完結させる
方針と両立させるには規模が大きすぎる。現在はパネル経由の編集で全21図種を
等しく扱えており、**こちらの不足に関する指摘は65ラウンドで0件**。
競合にあることは採用理由にしない。

**FEAT-003 AI生成がないのはなぜか**
生成には図の内容を外部サービスへ送る必要がある。**本ツールは1枚のHTMLで
完結し、設計内容が外に出ないことを前提に作っている。** 秘密保持契約下の
設計資産を扱う用途で、この前提は譲れない。
白紙から書き始めるコストは21図種すべてのひな形で下げている (R63実測)。

**FEAT-006 共同編集がないのはなぜか**
サーバーが必要になり、単一HTMLでオフライン動作する前提が崩れる。
図は `.mmd` テキストなので、共同作業は Git の差分レビューで行える。

## 判断が要るもの

**FEAT-004 (UI-064, Major)**: 閉じたら作業が消える。
localStorage への退避自体は小さいが、**復元してよい条件の判定**が難しい。
A113/A114 (図種を切り替えても前の状態が残る) と同型で、
「別の文書を開いたのに前の内容が復活する」事故を作りやすい。

- 案A: 自動で復元する (事故リスクが最も高い)
- 案B: 「前回の続きがあります。開きますか」と確認してから復元する
- 案C: 復元しない (現状)

**製品の性格を決める判断なので測定では決まらない。判断を仰ぐ。**

## 出典 (確認日 2026-08-23)

- Mermaid Chart Visual Editor: https://mermaid.ai/products/visual-editor
- Mermaid AI: https://mermaid.ai/mermaid-ai
- 評判 (良・悪の両方): https://www.producthunt.com/products/mermaid-chart/reviews ,
  https://www.g2.com/products/mermaid-chart/reviews?qs=pros-and-cons ,
  https://swimm.io/learn/mermaid-js/top-6-mermaid-js-alternatives
- draw.io Find/Replace: https://the-requirements-engineer.com/draw-io/find-and-replace-in-draw-io/
- draw.io の一括置換要望 issue: https://github.com/jgraph/drawio/issues/1443

**Mermaid Chart の一括置換の有無は今回の調査では確認できず「未確認」。**
判断材料にしていない。
