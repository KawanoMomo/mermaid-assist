# 追加フォームと編集パネルの統一 設計仕様書

**日付:** 2026-04-16
**ステータス:** Draft
**対象:** v1.1.0 → v1.2.0
**スコープ:** Tier1 全5図形 (Sequence / Flowchart / State / Class / ER) の add form UX 改善 + 実ユースケース検証

## 1. コンセプト

property panel における **「追加フォーム」と「個別要素編集パネル」の階層差** を解消し、ユーザーが一つの mental model（縦1列・ラベル付き・フル幅）で全操作を行えるようにする。Tier1 全5図形に適用し、実務で頻出するユースケースで「property panel のみで Mermaid を構築できる」ことを検証する。

## 2. 問題定義

### 2.1 現状の共通問題

リレーション系（エッジ・メッセージ・遷移・関連・リレーションシップ）の追加フォームが、いずれも**3〜4個のドロップダウンを横並び**に配置し、以下の問題を抱える:

- **ラベル無し**: From/To が見えない → 識別困難
- **画面外切れ**: 220px の property panel に対し3つ並ぶと最後の select がはみ出る
- **編集との不整合**: 個別要素編集パネルは縦1列・ラベル付きで設計されている → 学習コスト二重

### 2.2 該当箇所一覧

| モジュール | 追加フォーム | 横並び要素数 | 編集パネル |
|---|---|---|---|
| sequence | `seq-add-msg-*` | 3 (from/arrow/to) | 縦1列 ✓ |
| flowchart | `fc-add-edge-*` | 3 (from/arrow/to) | 縦1列 ✓ |
| state | `st-add-tr-*` | 2 (from/to) + イベント別 | 縦1列 ✓ |
| class | `cl-add-rel-*` | 3 (from/arrow/to) | 縦1列 ✓ |
| er | `er-add-rel-*` | 4 (from/leftCard/rightCard/to) | 縦1列 ✓ |

## 3. 設計

### 3.1 統一レイアウト

すべての「リレーション系追加フォーム」を**個別編集パネルと同じ縦1列・ラベル付き・フル幅**に統一:

```
[セクションヘッダ: 「メッセージを追加」 / 「エッジを追加」 / etc.]
─────────────
From   [select        v]
Arrow  [select        v]   ← 図形により Card / Type 等
To     [select        v]
Label  [input           ]
[primary button: 「+ 追加」]
```

### 3.2 図形別の具体形

#### Sequence メッセージ追加
```
From   [participant select    v]
Arrow  [arrow type select     v]
To     [participant select    v]
ラベル [label input             ]
[+ メッセージ追加]
```

#### Flowchart エッジ追加
```
From   [node select        v]
Arrow  [arrow type select  v]
To     [node select        v]
ラベル [label input          ]
[+ エッジ追加]
```

#### State 遷移追加
```
From   [state select       v]
To     [state select       v]
イベント [input              ]
[+ 遷移追加]
```

#### Class 関連追加
```
From   [class select         v]
Arrow  [relation type select v]
To     [class select         v]
ラベル [label input            ]
[+ 関連追加]
```

#### ER リレーションシップ追加
```
From       [entity select      v]
Left card  [card select        v]
Right card [card select        v]
To         [entity select      v]
ラベル     [label input          ]
[+ リレーションシップ追加]
```

### 3.3 element ID 不変

E2E テスト互換性のため、既存の input/select/button の `id` 属性は**変更しない**:
- `seq-add-msg-from`, `seq-add-msg-arrow`, `seq-add-msg-to`, `seq-add-msg-label`, `seq-add-msg-btn`
- `fc-add-edge-from`, `fc-add-edge-arrow`, `fc-add-edge-to`, `fc-add-edge-label`, `fc-add-edge-btn`
- `st-add-tr-from`, `st-add-tr-to`, `st-add-tr-event`, `st-add-tr-btn`
- `cl-add-rel-from`, `cl-add-rel-arrow`, `cl-add-rel-to`, `cl-add-rel-label`, `cl-add-rel-btn`
- `er-add-rel-from`, `er-add-rel-lc`, `er-add-rel-rc`, `er-add-rel-to`, `er-add-rel-label`, `er-add-rel-btn`

ハンドラの bind 部は無変更 → HTML レイアウトのみ変更で済む。

### 3.4 ヘルパー活用

`window.MA.properties.selectFieldHtml(label, id, options, monoFont)` で各 select を構築。From/To にはラベル文字列を必ず渡す。

```javascript
P.selectFieldHtml('From', 'seq-add-msg-from', participants.map(p => ({value: p.id, label: p.label}))) +
P.selectFieldHtml('Arrow', 'seq-add-msg-arrow', arrows.map(a => ({value: a, label: a})), true) +
P.selectFieldHtml('To', 'seq-add-msg-to', participants.map(p => ({value: p.id, label: p.label})))
```

## 4. 検証ユースケース

実務で頻出する5シナリオを、それぞれ property panel のみで構築できることを MCP で検証する。

### 4.1 Sequence — OAuth 2.0 認可コードフロー

**前提**: デフォルトテンプレート（Client/Server）からスタート

**操作**:
1. デフォルト2 messages + 2 participants を削除
2. 4 participants 追加: `User`, `Client`, `AuthServer`, `ResourceServer`
3. 9 messages 追加:

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

4. alt ブロック追加: `トークン期限切れ`

### 4.2 Flowchart — 受注処理業務フロー

**前提**: デフォルトテンプレート (Start/Decision/OK/Retry/End) からスタート

**操作**:
1. デフォルトを全削除
2. 7 nodes 追加:
   - `Start` (rect): 受注受付
   - `Stock` (diamond): 在庫確認
   - `Reserve` (rect): 在庫予約
   - `BackOrder` (rect): 入荷待ち登録
   - `Pay` (diamond): 決済方法
   - `Card` (rect): クレジットカード処理
   - `Bank` (rect): 銀行振込待ち
   - `Ship` (rect): 出荷
   - `End` (round): 完了
3. 9 edges 追加（条件分岐 含む）:

| # | From | Arrow | To | Label |
|---|---|---|---|---|
| 1 | Start | `-->` | Stock | |
| 2 | Stock | `-->` | Reserve | あり |
| 3 | Stock | `-->` | BackOrder | なし |
| 4 | Reserve | `-->` | Pay | |
| 5 | BackOrder | `-->` | Pay | |
| 6 | Pay | `-->` | Card | クレカ |
| 7 | Pay | `-->` | Bank | 銀行 |
| 8 | Card | `-->` | Ship | |
| 9 | Bank | `-->` | Ship | |

4. direction を `LR` に変更

### 4.3 State — 組み込み機器 電源/動作状態

**前提**: デフォルトテンプレート ([*]/Idle/Running) からスタート

**操作（組み込みエンジニア観点）**:
1. デフォルト全削除
2. 5 states 追加:
   - `PowerOff` (simple)
   - `Booting` (simple)
   - `Idle` (simple)
   - `Running` (simple)
   - `Error` (simple)
3. 9 transitions 追加:

| # | From | To | Event |
|---|---|---|---|
| 1 | [*] | PowerOff | |
| 2 | PowerOff | Booting | power_on |
| 3 | Booting | Idle | boot_complete |
| 4 | Idle | Running | start |
| 5 | Running | Idle | stop |
| 6 | Running | Error | fault |
| 7 | Error | Idle | reset |
| 8 | Idle | PowerOff | power_off |
| 9 | Error | PowerOff | shutdown |

### 4.4 Class — EC ドメインモデル

**前提**: デフォルトテンプレート (Animal/Dog) からスタート

**操作**:
1. デフォルト全削除
2. 4 classes 追加: `Customer`, `Order`, `OrderLine`, `Product`
3. 各クラスにメンバ追加（合計 8 members）:
   - Customer: `+id: int`, `+name: String`
   - Order: `+id: int`, `+placeOrder() void`
   - OrderLine: `+quantity: int`
   - Product: `+id: int`, `+name: String`, `+price: float`
4. 3 relations 追加:

| # | From | Arrow | To | Label |
|---|---|---|---|---|
| 1 | Customer | `-->` | Order | places |
| 2 | Order | `*--` | OrderLine | contains |
| 3 | OrderLine | `-->` | Product | refers |

### 4.5 ER — EC データベース設計

**前提**: デフォルトテンプレート (CUSTOMER/ORDER) からスタート

**操作**:
1. デフォルト全削除
2. 4 entities 追加: `CUSTOMER`, `ORDER`, `LINE_ITEM`, `PRODUCT`
3. 各エンティティに属性追加:
   - CUSTOMER: `int id PK`, `string name`, `string email`
   - ORDER: `int id PK`, `int customer_id FK`, `date created`
   - LINE_ITEM: `int order_id FK`, `int product_id FK`, `int quantity`
   - PRODUCT: `int id PK`, `string name`, `decimal price`
4. 3 relationships 追加:

| # | From | LeftCard | RightCard | To | Label |
|---|---|---|---|---|---|
| 1 | CUSTOMER | `||` | `o{` | ORDER | places |
| 2 | ORDER | `||` | `|{` | LINE_ITEM | contains |
| 3 | PRODUCT | `||` | `o{` | LINE_ITEM | refers |

### 4.6 共通合格基準

各シナリオについて以下を満たすこと:

- [ ] 全ステップを **エディタに直接タイプせず** property panel のみで完了
- [ ] From/To 等の方向指示が**ラベル明示で識別可能**
- [ ] 全ドロップダウン・入力欄が **viewport 内に収まる**（画面外切れ無し）
- [ ] 追加と編集で**同じレイアウトを使用**（学習コスト一元化）
- [ ] 結果の Mermaid テキストがエディタに正しく反映される
- [ ] mermaid.js でエラー無くレンダリングされる
- [ ] MCP スクリーンショットで構築過程の最終状態を保存
- [ ] ブラウザコンソールにエラー無し（favicon 404 を除く）

### 4.7 検証手順

各図形について:
1. HTTPサーバー起動 (`python -m http.server 8765`)
2. MCP で `http://127.0.0.1:8765/mermaid-assist.html` を開く
3. 該当図形に切替
4. シナリオ通りに property panel 操作
5. 完了時にスクリーンショット
6. 結果を `.eval/seq-ux-v1.2.0/<diagram>-result.png` + 全体 report.md に記録

## 5. テスト戦略

### 5.1 ユニットテスト

レイアウト変更のみで関数シグネチャ・ロジック不変 → ユニット 113 件全合格を維持。

### 5.2 E2E テスト

既存 E2E は element ID 不変のため互換。新規追加:

| ID | 対象 | 内容 |
|---|---|---|
| E15 | sequence | メッセージ追加フォームに From/Arrow/To のラベル `<label>` が表示される |
| E16 | sequence | OAuth ミニシナリオ（4 participants + 3 messages）が property panel から構築できる |
| E17 | flowchart | エッジ追加フォームに From/Arrow/To のラベルが表示される |
| E18 | flowchart | 受注フロー ミニシナリオ（5 nodes + 4 edges）構築 |
| E19 | state | 遷移追加フォームに From/To のラベルが表示される |
| E20 | state | 組み込み状態 ミニシナリオ（4 states + 4 transitions）構築 |
| E21 | class | 関連追加フォームに From/Arrow/To のラベルが表示される |
| E22 | class | EC ドメインモデル ミニシナリオ（3 classes + 2 relations）構築 |
| E23 | er | リレーションシップ追加フォームに From/LeftCard/RightCard/To のラベルが表示される |
| E24 | er | EC DB 設計 ミニシナリオ（3 entities + 2 relationships）構築 |

各「ミニシナリオ」は E2E で検証する短縮版。フルシナリオは MCP 手動検証で確認。

## 6. リリースプラン

| Version | 内容 |
|---|---|
| v1.2.0 | 全5図形の追加フォーム統一、E15-E24 追加（10件）、5シナリオ MCP検証完了、report.md コミット |

## 7. スコープ外（将来）

- SVG クリックによる Connection Mode（participant/node クリック2回でメッセージ/エッジ作成）
- 連続追加モード（複数要素を連続で入れる UX）
- inline 編集（list item の編集ボタンを廃して直接 dropdown を表示）
