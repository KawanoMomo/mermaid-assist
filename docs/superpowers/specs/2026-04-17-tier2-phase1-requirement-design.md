# Tier2 Phase 1: Requirement Diagram Design Spec

- **作成日**: 2026-04-17
- **ステータス**: 承認待ち
- **対象バージョン**: v1.3.0
- **前提**: Tier2 ロードマップ承認済み (`2026-04-16-tier2-diagrams-design.md`)
- **関連 ADR**: ADR-011, ADR-012, ADR-014, ADR-015, ADR-016
- **関連 ECN**: ECN-011, ECN-012, ECN-013

## ゴール

Mermaid Requirement Diagram を Tier1 同等の操作粒度で対応し、組み込み実務 (IEC 61508 等の安全規格に基づく要件管理・トレーサビリティ) で利用可能にする。

## スコープ

### 対応する要素

- **requirement (6 種 reqType)**: `requirement` / `functionalRequirement` / `interfaceRequirement` / `performanceRequirement` / `physicalRequirement` / `designConstraint`
- **element**: 要件を満たす実装・成果物 (シミュレーション、ドキュメント、コードモジュール等)
- **relation (7 種 reltype)**: `contains` / `copies` / `derives` / `satisfies` / `verifies` / `refines` / `traces`

### 対応する operations

DiagramModule v2 標準セット:

- `add`: add-requirement / add-element / add-relation
- `delete`: 要素・リレーション削除 (リレーション参照クリーンアップ含む)
- `update`: 各フィールド書き換え (name 変更時は関連リレーション参照も追従更新)
- `moveUp / moveDown`: 要素の上下入替 (リレーションは対象外)
- `connect`: Connection Mode で source→target 選択 → relation 作成 (既存インフラ流用)

### 対象外

- 6 reqType を超える独自カテゴリ追加
- リレーション順序の moveUp/Down (描画順序に意味薄)
- requirement / element の自動 ID 採番 (id は自由文字列)

## アーキテクチャ

### モジュール構成

- 新規追加: `src/modules/requirement.js` (DiagramModule v2 実装)
- 既存 ER モジュール (`src/modules/er.js`) を骨格として流用
- `window.MA.properties` の 14 ヘルパー全面利用 (ECN-012)
- 縦並びラベル付き追加フォームに統一 (ECN-013 / ADR-015)
- mermaid.js v11 (`lib/mermaid.min.js`) で `requirementDiagram` 描画

### データモデル

`parse(text)` 戻り値:

```js
{
  meta: {},
  elements: [
    { kind: 'requirement', reqType: 'functionalRequirement',
      name: 'test_req', id: 'REQ-001', text: '...',
      risk: 'high', verifymethod: 'test', line: N },
    { kind: 'element', name: 'ecu_firmware',
      type: 'code module', docref: 'src/ecu.c', line: N },
  ],
  relations: [
    { id: 'rel_1', from: 'ecu_firmware', to: 'test_req',
      reltype: 'satisfies', line: N },
  ],
}
```

### Mermaid 構文サンプル

```
requirementDiagram

requirement test_req {
    id: REQ-001
    text: 過電流時はモータを停止する
    risk: high
    verifymethod: test
}

functionalRequirement test_req2 {
    id: REQ-002
    text: 過電流検出は 10ms 以内
    risk: high
    verifymethod: test
}

element ecu_firmware {
    type: code module
    docref: src/ecu.c
}

ecu_firmware - satisfies -> test_req
test_req - contains -> test_req2
```

## UI / プロパティパネル構造

Tier1 ER と同パターン、縦並び・ラベル付き (ECN-013 / ADR-015 準拠):

### 追加フォーム (リスト下部)

- Add Requirement: `[reqType select (6種)] [Name input] [+ ボタン]`
  - text / risk / verifyMethod は追加後に個別パネルで編集
- Add Element: `[Name input] [+ ボタン]`
  - type / docref は追加後に個別パネルで編集
- Add Relation: 縦1列 `[From select] [reltype select (7種)] [To select] [+ ボタン]`

### 個別要素編集パネル (要素クリック時)

- **Requirement**: `[reqType select] [Name] [id] [text textarea] [risk select 3種] [verifymethod select 4種] [削除][↑][↓]`
- **Element**: `[Name] [type 自由テキスト] [docref 自由テキスト・空可] [削除][↑][↓]`
- **Relation**: `[From select] [reltype select] [To select] [削除]`

## フィールド仕様

| フィールド | 型 | 入力方式 | 選択肢 |
|---|---|---|---|
| reqType | enum | selectFieldHtml | requirement / functionalRequirement / interfaceRequirement / performanceRequirement / physicalRequirement / designConstraint |
| Name | string | fieldHtml | 英数アンダースコア (リレーション参照用) |
| id | string | fieldHtml | 自由文字列 (例: REQ-001, 1.2.3) |
| text | string | textarea | 自由文字列 |
| risk | enum | selectFieldHtml | low / medium / high |
| verifymethod | enum | selectFieldHtml | analysis / inspection / test / demonstration |
| element.type | string | fieldHtml (自由テキスト) | (Mermaid 仕様準拠) |
| element.docref | string | fieldHtml (空可) | 自由文字列 |
| relation.reltype | enum | selectFieldHtml | contains / copies / derives / satisfies / verifies / refines / traces |

## テスト設計

### ユニットテスト

- **`tests/requirement-parser.test.js`** (約 12 ケース):
  - 6 reqType それぞれの parse
  - element parse
  - 7 reltype の parse
  - 空 requirement ブロック
  - コメント (`%%`) 処理
  - 改行揺れ (空行・インデント差異)
- **`tests/requirement-updater.test.js`** (約 12 ケース):
  - add-requirement (各 reqType)
  - add-element / add-relation
  - update-field (name / id / text / risk / verifymethod / type / docref / reltype)
  - update-name 時のリレーション参照追従更新
  - delete-requirement / delete-element / delete-relation
  - moveUp / moveDown

### E2E テスト

**`tests/e2e/requirement-basic.spec.js`** (約 8 ケース):

- E25: add-requirement (各 reqType / risk / verifymethod が反映される)
- E26: add-element (type / docref が反映される)
- E27: add-relation (7 reltype が選択可能、from/to が選択可能)
- E28: update-name 時にリレーション参照が追従更新される
- E29: delete-requirement で関連 relation も cascade 削除
- E30: Connection Mode で source→target 選択 → relation 作成
- E31: moveUp / moveDown で要素順序入替
- E32: 縦並び追加フォームのラベル表示確認 (ECN-013 同等)

### system-tester 工程

ADR-016 に従い:

- spec から REQ / EV / TC を構造化抽出
- カバレッジ 100% / 禁止語 0 を目標
- 出力を `docs/superpowers/specs/2026-04-17-tier2-phase1-requirement-test-spec.md` に保存

### visual sweep

- evaluator で実機スクリーンショット (Playwright MCP)
- console error 0 を確認
- 6 reqType すべての描画確認
- 7 reltype すべての描画確認
- 配置: `.eval/v1.3.0/visual-sweep-v1.3.0/`

### 実用シナリオ MCP 検証

「ECU ファームの IEC 61508 風安全要件管理」シナリオ:

- requirement 4 件 (例: 過電流停止 / 過電流検出時間 / 自己診断 / セーフモード遷移)
- element 2 件 (例: ecu_firmware / safety_test_suite)
- relation 5 件以上 (satisfies / verifies / contains / derives / refines を含む)
- 全操作を property panel から完成、`mermaid.parse()` 通過、render 成功

## 想定リスクと対応

| リスク | 影響 | 対応 |
|---|---|---|
| `requirementDiagram` が Mermaid v11 で構文 / 描画失敗 | Phase 着手不能 | Phase 最初のタスクで lib/mermaid.min.js + 全 6 reqType + 全 7 reltype の動作確認、失敗時は ECN 記録 |
| Name 変更時にリレーション側参照更新漏れ | リレーション切れ | update-name 操作で全 relations を走査して from/to を一括更新、E2E で update-name 追従検証 |
| 6 reqType の reqType select 挙動の差異 | UI 一貫性低下 | reqType は select のみで切替可能とし、parse / update / build 全段で6種を同等扱い |
| reltype 7種の selectFieldHtml が縦長になりすぎ | UX 低下 | 既存 ER の cardinality select と同じ要領でドロップダウン1個、縦長化しない |
| 並列改修時の alias 不整合 (ECN-013 再発) | 実装後にエラー | requirement.js で `var P = window.MA.properties` 統一、ADR-015 に従う |

## 完了基準 (Definition of Done)

- 全 unit + E2E テスト PASS (約 24 unit + 約 8 E2E)
- system-tester 出力でカバレッジ 100% / 禁止語 0
- visual sweep で console error 0、6 reqType + 7 reltype 全描画確認
- 実用シナリオ MCP 検証 PASS
- ECN 1 件以上記載 (Phase 1 リリースノート相当)
- master ブランチにマージ、`v1.3.0` タグプッシュ

## 次のステップ

本 spec 承認後、system-tester で REQ/EV/TC 構造化 → writing-plans で実装計画 → subagent-driven-development で実装。
