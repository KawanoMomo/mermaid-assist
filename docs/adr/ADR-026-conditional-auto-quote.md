# ADR-026: 記号を含むラベルの条件付き auto-quote

- **ステータス**: 承認
- **カテゴリ**: インターフェース
- **日付**: 2026-08-21
- **対象プロジェクト**: MermaidAssist
- **関連ADR**: ADR-017 (Mermaid parser に対する auto-quote 戦略)

## なぜ起票するか

ADR-017 は承認済みで、「Update 時 auto-quote + Parse 時 quote strip」を決めている。
今回 mindmap / block / flowchart / sequence のラベルに入れた処理は同じ原則に立つが、
**適用の仕方が ADR-017 の記述と違う**。承認済み ADR と食い違う実装を黙って進めない、
という運用ルールに従って差分を記録する。

## ADR-017 との差分

| | ADR-017 | 今回の実装 |
|---|---|---|
| 対象の決め方 | モジュールが `quotedFields` セットを宣言し、その field は**常に**囲む | field 単位ではなく**値**を見て、記号を含むときだけ囲む |
| 既存 quote の扱い | set 前に既存 quote を除去する (重複回避) | 利用者が打った `"` は文字として扱い、`#quot;` に逃がす |
| 逃がす対象 | quote のみ | `"` に加えて `#` も `#35;` に逃がす |

## なぜ条件付きにしたか

ADR-017 は選択肢 C (全フィールドを常に quote) を「不要な箇所も quote が出るため
Mermaid ソースの可読性が下がる。既存手書き Mermaid ソースとの diff が大きくなる」
という理由で却下している。

flowchart / mindmap のラベルは **図の本文そのもの**で、記号を含まない普通の名前が
大半を占める。ここで常時 quote を付けると、`A[Start]` が `A["Start"]` になり、
既存の手書き Mermaid との diff が全行に出る。ADR-017 が C を却下した理由が、
この2つの図種では特に強く当てはまる。

そこで「値が形状記号 (`[] () {}`) や `" # < > |` を含むときだけ囲む」という条件に
した。ADR-017 の目的 (ユーザーに quote 入力を強いない / data model をクリークに保つ)
は満たしたまま、C の弊害を避けている。

## 既存 quote を文字として扱う理由

ADR-017 は「set 前に既存 quote を除去するのが正則」と書いている。これは `id:` や
`text:` のように **quote が構文の一部**であるフィールドを想定した記述で、そこでは
利用者が打った `"` は構文の記号であって内容ではない。

一方 flowchart のラベルで利用者が `"引用"付き` と打った場合、その `"` は**内容**である。
除去すると入力した文字が消える (このセッションで直した「黙って消える」欠陥と同じ形に
なる)。そこで mermaid 自身の実体 `#quot;` に逃がし、読み戻しで元に戻す。
`#` を先に `#35;` に逃がすのは、利用者が実際に `#quot;` と打った場合を壊さないため
(c4.js が同じ手を先に採っている)。

## 影響範囲

- `src/modules/flowchart.js` — `buildShape` / `parseNodeShape`
- `src/modules/mindmap.js` — `shapeToText` / parse
- `src/modules/block.js` — `updateBlockLabel` / `addBlock` / parse
- `src/modules/sequence.js` — `updateParticipant` / parse (`#` のみ)

## 直せないもの (記録)

mermaid v11.13 の制限で、こちらでは対処できないものが2つある。

- `architecture-beta` のラベルは `[A-Za-z0-9_ ]` のみ。**日本語が原理的に使えない**。
  引用囲みも効かないことを実測済み
- `sequence` の participant 別名に `;` は使えない。生でも引用囲みでも parse 失敗

黙って壊れさせないため、原因を日本語で名指しする診断 (`src/core/diagnose.js`) を
入れた。規則に当てはまる入力が本文に実在するときだけ言い、推測はしない。

## 採番の可否

2026-08-21 に承認を得て ADR-026 として採番した。
