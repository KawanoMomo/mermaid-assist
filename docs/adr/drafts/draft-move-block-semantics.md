# (ドラフト) 並べ替えは「同じ種類の隣の要素とブロック単位で入れ替える」

- **ステータス**: ドラフト (未採番・未登録)
- **カテゴリ**: インターフェース
- **日付**: 2026-08-22
- **対象プロジェクト**: MermaidAssist
- **関連ADR**: ADR-012 (DiagramModule v2)

## なぜ起票するか

`operations.moveUp` / `moveDown` の実装方針を、18モジュールで一斉に変えた。
選択肢が複数あり、そのうち2つを実測で捨てている。判断の記録が無いと、
次に触る人が最初の形に戻す。

## 何が起きていたか (実測)

全モジュールが素の行入れ替えを呼んでいた。

    moveUp: function(text, lineNum) {
      if (lineNum <= 1) return text;                    ← 1行目しか守っていない
      return window.MA.textUpdater.swapLines(text, lineNum, lineNum - 1);
    }

先頭の要素を上へ動かすと**図の宣言行と入れ替わって図が消える**。

    flowchart TD                     A[Start] --> B{Decision}
        A[Start] --> B{Decision}  →  flowchart TD
                                     → No diagram type detected

手作業で21図種を探して9件出た (flowchart / erDiagram / requirementDiagram /
kanban / mindmap / packetBeta / timeline)。

**パネルの経路 (flowchart の `_moveNodeStep`) は入れ替え先が動かせる行かを
見ていたので壊れない。契約経路だけが壊れていた** —「UI 経路だけ直して
契約経路を忘れる」形の15例目。

## 検討した案

| 案 | 内容 | 判断 |
|---|---|---|
| A | 素の行入れ替え + 行番号の下限だけ守る | **却下**。上記のとおり宣言行を巻き込む |
| B | 同じ種類の要素が乗っている「行」としか入れ替えない | **却下 (実測)**。requirement / class / er はブロックを持つので、行だけ入れ替えると属性が別の要素にくっつく。ユニットで検出した |
| C | **同じ種類の隣の要素と、要素が占める範囲ごと入れ替える** | **採用** |
| D | 図種ごとに実装する | 部分採用。並びが構造そのものの2図種のみ |

## 決めたこと

**共通の `window.MA.textUpdater.moveElementLine(text, lineNum, direction, elements)` を
使う。** 要素が占める範囲は「次の要素が始まる直前まで」で決める
(parse が返すのは開始行だけなので、それ以外に手掛かりが無い)。

**並びが構造そのものの2図種は共通化しない。**

| 図種 | なぜ | どうしたか |
|---|---|---|
| mindmap | 字下げが親子関係そのもの。行を入れ替えると根が2つになる | 同じ親の兄弟どうしを**子孫ごと**動かす |
| packetBeta | ビット位置が中身。入れ替えると番号が飛んで mermaid が拒否する | 入れ替えたあと**幅を保って先頭から振り直す** |

## 影響

- 18モジュールの `operations.moveUp` / `moveDown` が共通ヘルパーを呼ぶ
- `tests/move-contract.test.js` が21図種で「宣言行を巻き込まない」を固定
- `tools/review/r24-move-renders.js` が122通りを実描画で確認 (変異で16件検出)
- **r9 の W4「並べ替えは行の中身を変えない」が packet では成り立たなくなった**ので、
  行ではなく要素の見分けがつく文字の多重集合を比べる形に変えた

## 未解決

- `connect` は同様の検査を持たない (手作業で10通り試して0件だったので、
  自分で決めた規則「欠陥が出てから検査を足す」に従い足していない)
