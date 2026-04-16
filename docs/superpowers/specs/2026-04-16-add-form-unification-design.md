# 追加フォームと編集パネルの統一 設計仕様書

**日付:** 2026-04-16
**ステータス:** Draft
**対象:** v1.1.0 → v1.2.0
**スコープ:** Sequence + Flowchart 両モジュール の add form UX 改善

## 1. コンセプト

property panel における **「追加フォーム」と「個別要素編集パネル」の階層差** を解消し、ユーザーが一つの mental model（縦1列・ラベル付き・フル幅）で全操作を行えるようにする。

## 2. 問題定義

### 2.1 現状

#### Sequence「メッセージを追加」

```html
<select from> <select arrow> <select to>  ← 横並び3カラム
ラベル
<input label>
<button>+ メッセージ追加</button>
```

問題:
- 3 select に **From/To のラベルが付かない** → どちらが送信元/送信先か不明
- property panel デフォルト幅 220px に対し3つ並ぶと **3つ目が画面外に切れる**
- 個別メッセージ編集（`.seq-select-message` クリック後の panel）は **縦1列・ラベル付き** → 追加と編集で UI が異なる

#### Flowchart「エッジを追加」

同パターンで同じ問題:
```html
<select from> <select arrow> <select to>
ラベル
<input>
<button>+ エッジ追加</button>
```

### 2.2 ユーザー影響

- **学習コスト**: 追加と編集で2つの異なる UI を覚える必要
- **誤操作**: From/To の取り違え（特に participant が "Client/Server" のような対称的命名のとき）
- **視認性**: To select が見えない → スクロールで気付く必要

## 3. 設計

### 3.1 統一レイアウト

すべての「リレーション系（エッジ・メッセージ）追加フォーム」を**個別編集パネルと同一の縦1列レイアウト**に統一:

```
[セクションヘッダ: 「メッセージを追加」 / 「エッジを追加」]
─────────────
From   [select   v]   ← 個別編集と同じラベル/幅
Arrow  [select   v]
To     [select   v]
ラベル [input      ]
[primary button: 「+ 追加」]
```

### 3.2 適用範囲

| モジュール | 対象フォーム | 変更内容 |
|---|---|---|
| sequence.js | `seq-add-msg-*` | 縦並びに再構成、From/Arrow/To に label追加 |
| flowchart.js | `fc-add-edge-*` | 同上、From/Arrow/To に label追加 |

**対象外:**
- 「参加者を追加」「ノードを追加」など単一要素の追加フォームは現状維持（既に縦1列）
- 「ブロックを追加」（loop/alt等）は現状維持
- 「サブグラフを追加」「名前空間を追加」は現状維持
- State / Class / ER の遷移・関連系も**今回のスコープ外**（同じパターンだが、まず Sequence/Flowchart で MVP 検証）

### 3.3 既存 element ID / class 名

E2E テスト互換性のため、**element ID は変更しない**:
- `seq-add-msg-from`, `seq-add-msg-arrow`, `seq-add-msg-to`, `seq-add-msg-label`, `seq-add-msg-btn`
- `fc-add-edge-from`, `fc-add-edge-arrow`, `fc-add-edge-to`, `fc-add-edge-label`, `fc-add-edge-btn`

ハンドラの bind 先 ID も同じ → JS 側の bind 部は無変更で済む。HTML レイアウトのみ変更。

### 3.4 ヘルパー活用

`window.MA.properties.selectFieldHtml(label, id, options, monoFont)` を活用:

```javascript
// Before:
'<div style="display:flex;gap:4px;margin-bottom:6px;">' +
  '<select id="seq-add-msg-from" ...>' + participantOpts + '</select>' +
  '<select id="seq-add-msg-arrow" ...>' + arrowOpts + '</select>' +
  '<select id="seq-add-msg-to" ...>' + participantOpts + '</select>' +
'</div>'

// After:
P.selectFieldHtml('From', 'seq-add-msg-from', fromOptions) +
P.selectFieldHtml('Arrow', 'seq-add-msg-arrow', arrowOptions, true) +  // monoFont
P.selectFieldHtml('To', 'seq-add-msg-to', toOptions)
```

`fromOptions` / `toOptions` は `[{value, label, selected?}]` 形式の配列。

## 4. 検証ユースケース

### 4.1 シナリオ: OAuth 2.0 認可コードフロー設計

実務シーン: 「認証基盤の設計をシーケンス図で起こしたい」

**前提状態:** デフォルトテンプレート (Client/Server/Request/Response) からスタート

**操作シーケンス（全て property panel から、エディタへの直接タイプ無し）:**

1. デフォルトの 2 participants と 2 messages を削除
2. 4 participants 追加: `User` / `Client` / `AuthServer` / `ResourceServer`
3. 9 messages 追加（順序通り）:

| # | From | Arrow | To | Label |
|---|---|---|---|---|
| 1 | User | `->>` | Client | 認可開始 |
| 2 | Client | `->>` | AuthServer | 認可リクエスト |
| 3 | AuthServer | `-->>` | User | ログイン画面表示 |
| 4 | User | `->>` | AuthServer | 認証情報送信 |
| 5 | AuthServer | `-->>` | Client | 認可コード返却 |
| 6 | Client | `->>` | AuthServer | トークン要求 |
| 7 | AuthServer | `-->>` | Client | アクセストークン |
| 8 | Client | `->>` | ResourceServer | API リクエスト |
| 9 | ResourceServer | `-->>` | Client | 保護リソース |

4. alt ブロック追加: `トークン期限切れ` / `else` / `end`

### 4.2 合格基準

- [ ] 全9メッセージで From/To を**迷わず**指定できる（ラベル明示で識別可能）
- [ ] property panel の To select が**画面外に切れない**
- [ ] 追加と編集で**同じレイアウト**を使う（学習コストなし）
- [ ] 結果のMermaidテキストがエディタに正しく反映される
- [ ] mermaid.js でレンダリングできる
- [ ] MCP スクリーンショットで構築過程の各段階を保存

### 4.3 検証手順

1. HTTPサーバー起動
2. MCP で http://127.0.0.1:8765/mermaid-assist.html
3. Sequence に切替
4. シナリオ通りに property panel 操作
5. 各ステップでスクリーンショット
6. 最終Mermaidテキストとレンダリング結果を report.md に記録

## 5. テスト戦略

### 5.1 E2E テスト追加

`tests/e2e/sequence-basic.spec.js` の既存テストはそのまま PASS する想定（element ID 不変）。

新規追加:
- **E15**: メッセージ追加フォームに From/Arrow/To のラベルが表示される
- **E16**: To select が viewport 内に収まる（offsetWidth + offsetLeft <= panel width）
- **E17**: OAuth シナリオ短縮版（4 participants + 3 messages）が property panel 操作のみで構築できる

`tests/e2e/flowchart-basic.spec.js` も同様:
- **E18**: エッジ追加フォームに From/Arrow/To のラベルが表示される
- **E19**: To select が viewport 内に収まる

### 5.2 ユニットテスト

レイアウト変更のみで関数シグネチャは不変 → ユニットテスト変更不要。113 件全合格を維持。

## 6. リリースプラン

| Version | 内容 |
|---|---|
| v1.2.0 | Sequence + Flowchart 追加フォーム統一、E15-E19 追加、OAuth シナリオ MCP検証完了 |

## 7. スコープ外（将来）

- State の transition 追加フォーム（同パターンだが今回は対象外、必要なら v1.2.1 で追加）
- Class の relation 追加フォーム
- ER の relationship 追加フォーム
- SVG クリックによる Connection Mode（方針 B）
- 連続追加モード（複数メッセージを連続で入れる UX）
