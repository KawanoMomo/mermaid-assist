# ADR-017: Mermaid parser に対する auto-quote 戦略

- **ステータス**: 承認
- **カテゴリ**: インターフェース
- **日付**: 2026-04-17
- **対象プロジェクト**: MermaidAssist
- **関連ADR**: ADR-012 (DiagramModule v2)
- **関連ECN**: ECN-014 (Requirement), ECN-021 (Quadrant 間接関連)

## コンテキスト

Tier2 Phase 1 (Requirement Diagram, v1.3.0) 実装中、Mermaid v11 の `requirementDiagram` parser が `id:` と `text:` 値について quote 必須であることが判明。例:

- `id: REQ-001` → parse error (`-` を含む値で失敗)
- `id: "REQ-001"` → OK
- `text: sample requirement` → parse error (空白含む値で失敗)
- `text: "sample requirement"` → OK

同様の制約は Quadrant Chart の title、XY Chart の title、Packet の label 等でも確認。

UI 設計上は、ユーザーに quote 入力を強いるのは非直感的。`id` フィールドに `"REQ-001"` と打たせるのは冗長。また parse 側で surrounding quote が data model に漏れると、UI 表示で `"REQ-001"` が見えてしまい醜い。

## 検討した選択肢

### A) ユーザーに quote 入力を要求

- 概要: UI 入力欄に quote を含めて入力してもらう
- メリット: 実装シンプル (auto-quote 不要)
- デメリット: UX 低下。Mermaid 構文ルールをユーザーが知る必要あり。"バックスラッシュエスケープ" 等の追加混乱要因

### B) Update 時に auto-quote、Parse 時に quote strip

- 概要: UI 入力値は生の文字列、モジュール側で add/update 時に `"..."` を自動付与、parse 時に surrounding quote を strip して data model はクリーンに保つ
- メリット: UX 自然。UI と data model が一貫。Mermaid 構文要件を UI から隠蔽
- デメリット: quote が必要なフィールドを把握しておく必要あり (モジュールごとに設定)

### C) 全フィールドを常に quote で囲む

- 概要: quote 要件に関係なく全てのテキスト値を `"..."` で囲んで出力
- メリット: 実装統一
- デメリット: 不要な箇所も quote が出るため Mermaid ソースの可読性が下がる。既存手書き Mermaid ソースとの diff が大きくなる

## 決定

**B) Update 時 auto-quote + Parse 時 quote strip** を採用。

各モジュールは `quotedFields` セット (例: requirement は `id/text/type/docref`) を定義し、updater でその field に値をセットする際に自動で `"..."` を付与する。parser は surrounding quote (`/^"|"$/g`) を strip して data model に渡す。既存 quote の重複を避けるため、set 前に既存 quote を除去するのが正則。

実装サンプル (`src/modules/requirement.js:updateRequirementField`):

```javascript
var quotedFields = { id: 1, text: 1, type: 1, docref: 1 };
var formatted = value;
if (quotedFields[fieldKey]) {
  var clean = typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;
  formatted = '"' + clean + '"';
}
```

parser 側 (`stripQuotes`):
```javascript
function stripQuotes(s) {
  if (s.length >= 2 && s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') {
    return s.substring(1, s.length - 1);
  }
  return s;
}
```

## 結果

- Requirement Diagram (v1.3.0): id/text/type/docref で auto-quote 実装、IEC 61508 シナリオが UI 単独で parse 通過
- 他モジュール (Quadrant, XY, Packet, Radar, Sankey 等) で title/label に同パターンを適用
- 156 → 365 unit tests、21 図形で quote 要件問題 0

## 教訓

- **外部パーサーの構文要件は UI から隠蔽すべき**: ユーザーに「ここは quote 必要」のルールを覚えさせない。モジュール側で吸収する。
- **Data model は "表示用" ではなく "内部用" に保つ**: parse 時に quote を剥がしてクリーンにすると、UI 表示・比較・diff が自然になる。
- **モジュールごとの quotedFields 設定を忘れない**: 新規 diagram を追加するたび、どの field に quote が必要か Mermaid v11 で試験して決定する。
