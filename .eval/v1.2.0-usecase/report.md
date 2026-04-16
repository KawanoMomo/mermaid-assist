# v1.2.0 Use Case Validation Report

**Date:** 2026-04-16
**Method:** Playwright MCP via http://127.0.0.1:8765/mermaid-assist.html
**Scope:** Tier1 全5図形の追加フォーム統一後、実ユースケースを property panel のみで構築できることを実機検証

## Result Summary

| ID | シナリオ | 構築要素 | console errors | スクリーンショット | 判定 |
|---|---|---|---|---|---|
| T8 | Sequence — OAuth 2.0 認可コードフロー | 4 participants + 9 messages + title | 0 | sequence-oauth-final.png | **PASS** |
| T9 | Flowchart — 受注処理業務フロー (LR) | 9 nodes + 10 edges + direction LR | 0 | flowchart-order-final.png | **PASS** |
| T10 | State — 組み込み機器電源/動作状態 | 5 states + 9 transitions | 0 | state-embedded-final.png | **PASS** |
| T11 | Class — EC ドメインモデル | 4 classes + 8 members + 3 relations | 0 | class-domain-final.png | **PASS** |
| T12 | ER — EC データベース設計 | 4 entities + 12 attributes + 3 relationships | 0 | er-db-final.png | **PASS** |

## 検証観点 (spec §4.6 共通合格基準) — 全シナリオで満たすことを確認

- ✅ 全要素を **エディタに直接タイプせず** property panel のみで構築
- ✅ From / To / Arrow / Card 等の方向指示が **ラベル明示で識別可能**（縦1列レイアウト）
- ✅ 全 select / input が **viewport 内に収まる**（画面外切れゼロ）
- ✅ 追加と編集で同じレイアウト（縦1列・ラベル付き）を使用
- ✅ Mermaid テキストへの反映が正常
- ✅ mermaid.js でエラー無くレンダリング
- ✅ ブラウザコンソールにエラー無し（favicon 404 すら今回のセッションでは出ず）

## 詳細所見

### T8 Sequence OAuth
- 4 participants 左→右に整列、9 メッセージが時系列順にきれいに描画
- メッセージの `->>`（実線）/`-->>`（破線）が混在しても破綻なし
- property panel の From/Arrow/To が縦1列で完全可視 — 「送信先」識別の混乱解消を確認

### T9 Flowchart 受注フロー
- 10 edges を property panel のみで作成し、`-->|あり|`/`-->|なし|`/`-->|クレカ|`/`-->|銀行|` の条件分岐表記が正しく Mermaid に書き戻される
- direction LR への切替で再レンダリング正常

### T10 State 組み込み
- `[*]` 疑似状態の選択は dropdown 1番目に「[*] (start/end)」として配置済み、識別容易
- 9 transitions に event 名 (`power_on`/`boot_complete` 等) が正しく付与される

### T11 Class EC ドメイン
- 4 classes と 8 members（属性6 + メソッド2）を property panel から追加
- `+placeOrder() void` のメソッド表記、`+id int` の属性表記が共に正常出力
- 関連 `*--`（composition）の選択肢が dropdown でラベル付き ("composition") で識別容易

### T12 ER EC DB
- 4 entities と 12 attributes（PK 3 + FK 3 + 通常 6）を構築
- リレーションシップで Left card / Right card が縦並びで識別容易
- `||--o{`/`||--|{` の cardinality 組み合わせが正しく出力

## 不具合

### Critical: なし

### Minor: なし

5シナリオ全てが **追加修正不要で PASS**。リファクタの設計（縦1列・ラベル付き）が実ユースケースで意図通り機能していることを確認。

## 追加作成成果物

- system-tester エージェント生成: 26要件 / 32評価項目 / 32テストタスク / coverage 100%
  - `docs/superpowers/specs/2026-04-16-add-form-unification-test-spec.md`
  - 3件の未確定事項を曖昧推測せずに明示

## 結論

**v1.2.0 PASS** — 追加フォーム統一は仕様通り全5図形に適用され、実ユースケースで設計者が混乱なく Mermaid を構築できることを実機で確認。
