# ECN-030: 契約経路の欠陥 — UI だけ直して契約を忘れる形

- **ステータス**: 適用済
- **種別**: 不具合修正
- **バージョン**: (未リリース / master `5d9d2ff`)
- **対象コミット**: `3fb4c82`, `7575e62`, `7326f75`, `7feb07e`, `821d660`, `6115686` ほか (PR #15)
- **影響ファイル**: src/modules/{gantt,flowchart,state,class,er,sankey,sequence,kanban,mindmap,requirement,block,gitgraph,journey,timeline,quadrant}.js
- **マイルストーン**: 同一 archetype **12例**を検出・修正

## コンテキスト

ADR-012 で全21図種が `operations.{add,update,delete,moveUp,moveDown}` を持つ
契約になった。ところが **UI は契約を通らず、モジュールの関数を直接呼んでいる**。

    UI      : ctx.setMmdText(deleteState(ctx.getMmdText(), st.line, st.id))
    契約経路: mod.operations.delete(text, lineNum, opts)

そのため「UI 経路だけ直して契約経路が古いまま残る」形が繰り返し起きた。
契約経路を誰も通っていなかったので、誰も気づかなかった。

## 検出した archetype

### (1) id 認識の関数はあるのに入口が繋がっていない (12例)

| 図種 | 内容 |
|---|---|
| state / flowchart | `operations.delete` が単なる `deleteLine`。宣言行だけ消えて参照が残り、mermaid が参照だけで要素を作るので**一覧から消えても図に残る** |
| er | エンティティは「最初に現れた行」= 関係行を持つ。押すと関係だけ消えて宣言ブロックが残る |
| class | `deleteClass` (id 認識) があるのに入口が使っていない |
| sequence | `deleteParticipant` があるのに入口が id を渡していない。宣言だけ消えて `A->>B` が残り、mermaid が暗黙再宣言する |
| block / requirement | `opts.id` ではなく独自キー (`opts.blockId` / `opts.elementName`) を要求し、契約どおりの呼出しが空振り |

### (2) 行の中身で分岐して別の要素を編集する (3例)

| 図種 | 内容 |
|---|---|
| flowchart | `A[Start] --> B{Decision}` はノード宣言とエッジが同じ行。A のラベルを変えようとすると**エッジのラベル**が付く |
| state | 状態は遷移行で宣言されるのが普通 (`[*] --> Idle`)。状態を選んでラベルを変えると**矢印のラベルが書き換わる** |
| sequence | 宣言行を持たない参加者を選んでラベルを変えると**メッセージの本文が書き換わる** (`A->>B: 要求` → `A->>B: 端末`) |

### (3) parse が要素を返さず、全観点から素通りする (3例)

| 図種 | 内容 |
|---|---|
| gantt | `parse` が `elements` を返しておらず、**18観点すべてから見えていなかった** |
| erDiagram | エンティティ名を `[A-Za-z_][A-Za-z0-9_-]*` で拾っていた。`顧客 \|\|--o{ 注文` は mermaid が描くのに**一覧に1件も出ない** |
| sequence | メッセージ行から参加者を登録していなかった。mermaid はアクターを8図形描くのに要素数**0** |
| kanban | `id[本文]` 形式のカードが行ごと消えていた (`^\[` 始まりしか見ていない) |

### (4) 知らない field が本文を壊す (6図種24通り)

`requirement` は渡された field をそのまま `field: value` として書き込んでいた。
パネルに無い field 名が一度来ると mermaid が知らないキーが入り、
**その図は以後 parse を通らなくなる**。
gitGraph / journey / kanban / timeline は field を見ずに名前を書き換えていた。

## 対策

- 契約経路をすべて id 認識の実装へ繋いだ
- 分岐を `opts.kind` で行うようにした (行の中身での判定は旧い呼出しの後方互換としてのみ残す)
- 知らない field は無変化を返す
- parse が要素を返していなかった図種を直した
- `opts.id` を契約の識別子として統一 (独自キーは後方互換で受け続ける)

## 結果

- 欠陥 **84件**を修正 (A1〜A84)
- ユニット 750 → **970**、e2e 341 → **406**
- 全22観点で指摘0件、ゲート合格

## 分かったことの一般化

**「同じ欠陥を UI 経路だけ直して契約経路を忘れる」形が12例出た。**
入口が2つあるのに片方しか通っていないことが原因で、
個別の修正では止まらない。次のどちらかが要る。

- UI を契約経由に寄せる (入口を1つにする)
- 契約経路を常に検査する (今回はこちらを機械化した)

**parse を直すと、他の観点の網が初めて機能する。**
sequence の参加者を parse に載せて初めて、r2 (削除検査) が
「参加者を消してもライフラインが残る」を捕まえられるようになった
(それまでは「消えたこと」を確認する相手が一覧に居なかった)。

## 姉妹プロジェクトへの横展開

06_PlantUMLAssist は同じ DiagramModule 契約を持つため、
**(1) と (2) の archetype はそのまま該当する可能性が高い**。
`docs/ecn-analysis/` で判定する。
