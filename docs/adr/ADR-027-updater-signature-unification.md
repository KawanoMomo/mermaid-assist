# ADR-027: 更新関数のシグネチャ統一

- **ステータス**: 承認
- **カテゴリ**: インターフェース
- **日付**: 2026-08-21
- **対象プロジェクト**: MermaidAssist
- **関連ADR**: ADR-012 (DiagramModule v2)

## なぜ起票するか

棚卸しの E6 に「更新関数のシグネチャが混在している。ADR を起こしてから」と書いた
まま、3ラウンド以上動いていない。PL 診断で塩漬けタスクとして検出されたので、
「ADR を起こす」の側を先に片付ける。

## 現状 (2026-08-21 実測)

更新系の呼び出し形が3通りある。

| 形 | 例 |
|---|---|
| `(text, line, field, value)` | `updateNode`, `updateElement`, `updateParticipant`, `updateCard`, `updateTaskField` |
| `(text, line, value)` | `updateStateLabel`, `updateNodeText`, `updateColumn` |
| `(text, line, id, value)` | `updateBlockLabel` |

さらに今回の作業で、行を共有する要素を扱うために **末尾へ id を足した**関数が増えた。

| 関数 | 現在の形 |
|---|---|
| `flowchart.updateNode` | `(text, line, field, value, nodeId)` |
| `state.updateStateLabel` | `(text, line, value, stateId)` |
| `sequence.deleteParticipant` | `(text, line, participantId)` |
| `kanban.addCard` | `(text, columnName, cardText, metaStr, columnLine)` |

## 問題

- 呼び出し側が形を間違えても**静かに通る**。引数が1つずれると `field` に値が入り、
  どの分岐にも当たらずに元のテキストを返す。これは「無言の空振り」であり、実際に
  `flowchart.updateNode` で発生した (ラベル欄が効かない Blocker)
- レビュー機構 (r1 / r11 / r12) は形ごとに関数名の表を手で持つ必要があり、
  表から漏れたモジュールは検査対象から静かに外れる

## 検討した選択肢

### A) 全部 `(text, line, field, value, id)` に揃える

- メリット: 呼び出し側が形を覚えなくてよい。レビュー機構の表が1つで済む
- デメリット: 80箇所以上の呼び出しを一度に書き換える。振る舞い不変の変更で、
  途中で壊すと原因の切り分けが難しい

### B) 単一のオブジェクト引数 `(text, { line, field, value, id })` にする

- メリット: 引数の順序ミスが構造的に起きない。省略可能な項目が自然に書ける
- デメリット: 既存の全呼び出しとテストが書き換え対象。差分が最大になる

### C) 現状維持 + レビュー機構で形の不一致を検出する

- メリット: 動いているものを触らない。R12 (無言の空振り) が既に「違う値を渡したら
  必ず変わる」を全モジュールで見ているので、形の取り違えは検出できる
- デメリット: 呼び出し側の負担は残る

## 決定 (提案)

**C を採り、A は M2 (内部構造の整理) と同時に行う。**

理由: 単独で A をやると「振る舞い不変の大規模変更」になり、失敗したときに何が原因か
切り分けられない。`app.js` の分割 (E1) と同じ時期にやれば、どちらの変更で壊れたかを
オラクルとレビュー機構で切り分けられる。

それまでの間、形の取り違えは R12 が検出する。R12 は「違う値を渡したら本文が必ず
変わる」を全要素で確かめるので、引数がずれて no-op になった関数はそこで落ちる。

## 採番の可否

**未採番**。正式登録は承認後に `/adr` で行う。
