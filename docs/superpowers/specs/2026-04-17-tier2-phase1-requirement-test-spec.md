# システムテスト仕様書: Tier2 Phase 1: Requirement Diagram

## 0. メタ情報

- **対象仕様書**: `E:\00_Git\05_MermaidAssist\docs\superpowers\specs\2026-04-17-tier2-phase1-requirement-design.md`
- **生成日時**: 2026-04-17 00:05:12
- **生成エージェント**: system-tester
- **要件件数**: 42
- **評価項目件数**: 42
- **テストタスク件数**: 42

## 1. 未確定事項

なし (Test-6 自己検査で REQ→EV / EV→TC とも 100%、禁止語 0、重複 0 を確認済み)。

## 2. 要件抽出結果

| 要件ID | 仕様書該当箇所 | 要件内容 | 種別 |
|---|---|---|---|
| REQ-001 | §スコープ / 対応する要素 | requirement の reqType として `requirement` を扱えること | 機能 |
| REQ-002 | §スコープ / 対応する要素 | requirement の reqType として `functionalRequirement` を扱えること | 機能 |
| REQ-003 | §スコープ / 対応する要素 | requirement の reqType として `interfaceRequirement` を扱えること | 機能 |
| REQ-004 | §スコープ / 対応する要素 | requirement の reqType として `performanceRequirement` を扱えること | 機能 |
| REQ-005 | §スコープ / 対応する要素 | requirement の reqType として `physicalRequirement` を扱えること | 機能 |
| REQ-006 | §スコープ / 対応する要素 | requirement の reqType として `designConstraint` を扱えること | 機能 |
| REQ-007 | §スコープ / 対応する要素 | element (要件を満たす実装・成果物) を要素として扱えること | 機能 |
| REQ-008 | §スコープ / 対応する要素 | relation の reltype として `contains` を扱えること | 機能 |
| REQ-009 | §スコープ / 対応する要素 | relation の reltype として `copies` を扱えること | 機能 |
| REQ-010 | §スコープ / 対応する要素 | relation の reltype として `derives` を扱えること | 機能 |
| REQ-011 | §スコープ / 対応する要素 | relation の reltype として `satisfies` を扱えること | 機能 |
| REQ-012 | §スコープ / 対応する要素 | relation の reltype として `verifies` を扱えること | 機能 |
| REQ-013 | §スコープ / 対応する要素 | relation の reltype として `refines` を扱えること | 機能 |
| REQ-014 | §スコープ / 対応する要素 | relation の reltype として `traces` を扱えること | 機能 |
| REQ-015 | §スコープ / 対応する operations | `add` 操作で add-requirement / add-element / add-relation を実行できること | 機能 |
| REQ-016 | §スコープ / 対応する operations | `delete` 操作で要素・リレーションを削除し、削除に伴うリレーション参照クリーンアップを行うこと | 機能 |
| REQ-017 | §スコープ / 対応する operations | `update` 操作で各フィールドを書き換えできること。Name 変更時は関連リレーション参照も追従更新すること | 機能 |
| REQ-018 | §スコープ / 対応する operations | `moveUp` / `moveDown` 操作で要素の上下入替が可能であること。リレーションは moveUp / moveDown の対象外であること | 機能 |
| REQ-019 | §スコープ / 対応する operations | `connect` 操作で Connection Mode により source→target を選択して relation を作成できること | 機能 |
| REQ-020 | §アーキテクチャ / モジュール構成 | `src/modules/requirement.js` を DiagramModule v2 として新規追加すること | インターフェース |
| REQ-021 | §アーキテクチャ / モジュール構成 | `window.MA.properties` の 14 ヘルパーを全面利用すること (ECN-012) | インターフェース |
| REQ-022 | §アーキテクチャ / モジュール構成 | 追加フォームを縦並びラベル付きに統一すること (ECN-013 / ADR-015) | 機能 |
| REQ-023 | §アーキテクチャ / モジュール構成 | mermaid.js v11 (`lib/mermaid.min.js`) で `requirementDiagram` を描画できること | インターフェース |
| REQ-024 | §アーキテクチャ / データモデル | `parse(text)` の戻り値が `{meta, elements, relations}` の構造を持ち、elements に kind / reqType / name / id / text / risk / verifymethod / line、または kind / name / type / docref / line を含み、relations に id / from / to / reltype / line を含むこと | 入出力 |
| REQ-025 | §UI / 追加フォーム | Add Requirement フォームが `[reqType select (6種)] [Name input] [+ ボタン]` の構成であること | インターフェース |
| REQ-026 | §UI / 追加フォーム | Add Element フォームが `[Name input] [+ ボタン]` の構成であり、type / docref は追加後に個別パネルで編集可能であること | インターフェース |
| REQ-027 | §UI / 追加フォーム | Add Relation フォームが縦1列で `[From select] [reltype select (7種)] [To select] [+ ボタン]` の構成であること | インターフェース |
| REQ-028 | §UI / 個別要素編集パネル | Requirement 編集パネルが `[reqType select] [Name] [id] [text textarea] [risk select 3種] [verifymethod select 4種] [削除][↑][↓]` を備えること | インターフェース |
| REQ-029 | §UI / 個別要素編集パネル | Element 編集パネルが `[Name] [type 自由テキスト] [docref 自由テキスト・空可] [削除][↑][↓]` を備えること | インターフェース |
| REQ-030 | §UI / 個別要素編集パネル | Relation 編集パネルが `[From select] [reltype select] [To select] [削除]` を備えること | インターフェース |
| REQ-031 | §フィールド仕様 | reqType フィールドは selectFieldHtml 入力で選択肢が `requirement / functionalRequirement / interfaceRequirement / performanceRequirement / physicalRequirement / designConstraint` の 6 種であること | 入出力 |
| REQ-032 | §フィールド仕様 | Name フィールドは fieldHtml 入力で英数アンダースコアを受け付けること (リレーション参照用) | 入出力 |
| REQ-033 | §フィールド仕様 | id フィールドは fieldHtml 入力で自由文字列を受け付けること | 入出力 |
| REQ-034 | §フィールド仕様 | text フィールドは textarea 入力で自由文字列を受け付けること | 入出力 |
| REQ-035 | §フィールド仕様 | risk フィールドは selectFieldHtml 入力で `low / medium / high` の 3 種であること | 入出力 |
| REQ-036 | §フィールド仕様 | verifymethod フィールドは selectFieldHtml 入力で `analysis / inspection / test / demonstration` の 4 種であること | 入出力 |
| REQ-037 | §フィールド仕様 | element.type は fieldHtml 自由テキスト、element.docref は fieldHtml 自由テキストかつ空入力可であること | 入出力 |
| REQ-038 | §フィールド仕様 / §リスク対応 | relation.reltype は selectFieldHtml 入力で `contains / copies / derives / satisfies / verifies / refines / traces` の 7 種であり、ドロップダウン1個で縦長化しないこと | インターフェース |
| REQ-039 | §リスク対応 (Name 変更追従) | update-name 操作で全 relations を走査し、`from` / `to` の参照を一括更新すること | 機能 |
| REQ-040 | §リスク対応 (alias 不整合) | requirement.js 内で `var P = window.MA.properties` の alias 統一を行うこと (ADR-015 準拠) | インターフェース |
| REQ-041 | §テスト設計 / 実用シナリオ MCP 検証 | requirement 4 件 / element 2 件 / relation 5 件以上 (satisfies / verifies / contains / derives / refines を含む) のシナリオを property panel から完成し、`mermaid.parse()` が通過し render が成功すること | 機能 |
| REQ-042 | §完了基準 (DoD) | render 結果に対し console error が 0 件であること (visual sweep) | 非機能 |

## 3. 評価項目

| 評価ID | 対応要件ID | 評価観点 | 観測対象 | 判定基準 |
|---|---|---|---|---|
| EV-001 | REQ-001 | parse が `requirement` 種別を識別すること | parse(text).elements[i] | `kind == 'requirement'` かつ `reqType == 'requirement'` |
| EV-002 | REQ-002 | parse が `functionalRequirement` 種別を識別すること | parse(text).elements[i] | `kind == 'requirement'` かつ `reqType == 'functionalRequirement'` |
| EV-003 | REQ-003 | parse が `interfaceRequirement` 種別を識別すること | parse(text).elements[i] | `kind == 'requirement'` かつ `reqType == 'interfaceRequirement'` |
| EV-004 | REQ-004 | parse が `performanceRequirement` 種別を識別すること | parse(text).elements[i] | `kind == 'requirement'` かつ `reqType == 'performanceRequirement'` |
| EV-005 | REQ-005 | parse が `physicalRequirement` 種別を識別すること | parse(text).elements[i] | `kind == 'requirement'` かつ `reqType == 'physicalRequirement'` |
| EV-006 | REQ-006 | parse が `designConstraint` 種別を識別すること | parse(text).elements[i] | `kind == 'requirement'` かつ `reqType == 'designConstraint'` |
| EV-007 | REQ-007 | parse が element 要素を識別し name / type / docref を保持すること | parse(text).elements[i] | `kind == 'element'`、`name`/`type`/`docref` プロパティが string で存在 |
| EV-008 | REQ-008 | parse が relation `contains` を識別すること | parse(text).relations[i].reltype | `reltype == 'contains'` |
| EV-009 | REQ-009 | parse が relation `copies` を識別すること | parse(text).relations[i].reltype | `reltype == 'copies'` |
| EV-010 | REQ-010 | parse が relation `derives` を識別すること | parse(text).relations[i].reltype | `reltype == 'derives'` |
| EV-011 | REQ-011 | parse が relation `satisfies` を識別すること | parse(text).relations[i].reltype | `reltype == 'satisfies'` |
| EV-012 | REQ-012 | parse が relation `verifies` を識別すること | parse(text).relations[i].reltype | `reltype == 'verifies'` |
| EV-013 | REQ-013 | parse が relation `refines` を識別すること | parse(text).relations[i].reltype | `reltype == 'refines'` |
| EV-014 | REQ-014 | parse が relation `traces` を識別すること | parse(text).relations[i].reltype | `reltype == 'traces'` |
| EV-015 | REQ-015 | add-requirement / add-element / add-relation の各操作後にテキストへ追記されること | 操作後の Mermaid テキスト | 追加対象の宣言行 (例: `functionalRequirement <name> {`、`element <name> {`、`<from> - <reltype> -> <to>`) が新規行として存在 |
| EV-016 | REQ-016 | delete 操作で対象要素行が消え、その要素を参照する relation 行も同時に消えること | 操作後の Mermaid テキスト | 対象要素の宣言行が 0 件、その要素を `from` / `to` に持つ relation 行が 0 件 |
| EV-017 | REQ-017 | update 操作で対象フィールドの値がテキストに反映されること | 操作後の Mermaid テキスト | 指定フィールド (name / id / text / risk / verifymethod / type / docref / reltype) が新値の文字列で出力 |
| EV-018 | REQ-018 | moveUp / moveDown で要素行の順序が入れ替わること、relation には適用されないこと | 操作後の Mermaid テキスト | 対象要素の登場行番号が入替前後で隣接要素と入替済み。relation 行に対する moveUp / moveDown 呼出はテキスト変更 0 |
| EV-019 | REQ-019 | Connection Mode で source→target をクリックしたとき relation 行が 1 行追加されること | 操作後の Mermaid テキスト | `<source> - <reltype> -> <target>` の行が 1 行新規追加 |
| EV-020 | REQ-020 | `src/modules/requirement.js` が存在し DiagramModule v2 形式で登録されていること | ファイルシステム / window.MA.modules | `src/modules/requirement.js` が存在、`window.MA.modules.requirement` が DiagramModule v2 のインターフェース (parse / build / operations) を備える |
| EV-021 | REQ-021 | requirement.js が `window.MA.properties` の 14 ヘルパーを参照していること | requirement.js のソースコード | `window.MA.properties` の参照箇所が 1 箇所以上、独自実装による fieldHtml / selectFieldHtml が 0 件 |
| EV-022 | REQ-022 | 追加フォームが縦並びラベル付き構造であること | DOM (追加フォームコンテナ) | フォーム要素が縦方向に積まれ (flex-direction:column 相当)、各入力に対応する `<label>` 要素が存在 |
| EV-023 | REQ-023 | mermaid v11 で requirementDiagram が描画されること | プレビュー領域 / console | プレビュー DOM 内に `<svg>` が 1 個以上生成、console error 0 |
| EV-024 | REQ-024 | parse 戻り値が指定構造であること | parse 戻り値オブジェクト | `result.meta` がオブジェクト、`result.elements` が配列で要素は `{kind, name, line, ...}` を持ち requirement の場合は `reqType/id/text/risk/verifymethod`、element の場合は `type/docref` を持つ。`result.relations` が配列で `{id, from, to, reltype, line}` を持つ |
| EV-025 | REQ-025 | Add Requirement フォームの構造一致 | DOM (Add Requirement フォーム) | 子要素として reqType の `<select>` (option 6 個)、Name の `<input>` (1 個)、`+` ボタン (1 個) が存在 |
| EV-026 | REQ-026 | Add Element フォームの構造一致 | DOM (Add Element フォーム) | 子要素として Name の `<input>` (1 個)、`+` ボタン (1 個) が存在し、type / docref 入力欄は追加フォームに存在しない |
| EV-027 | REQ-027 | Add Relation フォームの構造一致 (縦1列) | DOM (Add Relation フォーム) | 子要素として From `<select>`、reltype `<select>` (option 7 個)、To `<select>`、`+` ボタンの 4 要素が縦方向 (flex-direction:column 相当) に配置 |
| EV-028 | REQ-028 | Requirement 編集パネルのフィールド一致 | DOM (Requirement 編集パネル) | reqType `<select>` (option 6)、Name `<input>`、id `<input>`、text `<textarea>`、risk `<select>` (option 3)、verifymethod `<select>` (option 4)、削除ボタン、↑ボタン、↓ボタン がそれぞれ 1 個以上存在 |
| EV-029 | REQ-029 | Element 編集パネルのフィールド一致 | DOM (Element 編集パネル) | Name `<input>`、type `<input>` (自由テキスト)、docref `<input>`、削除ボタン、↑ボタン、↓ボタンが各 1 個以上存在し、docref は空入力で submit 可能 |
| EV-030 | REQ-030 | Relation 編集パネルのフィールド一致 | DOM (Relation 編集パネル) | From `<select>`、reltype `<select>` (option 7)、To `<select>`、削除ボタンが各 1 個以上存在し、↑↓ボタンは存在しない |
| EV-031 | REQ-031 | reqType select 6 種選択肢が一致 | reqType `<select>` の option 値 | option の value 集合が `{requirement, functionalRequirement, interfaceRequirement, performanceRequirement, physicalRequirement, designConstraint}` と完全一致 (6 個) |
| EV-032 | REQ-032 | Name 入力が英数アンダースコアを受け付けること | Name `<input>` での入力結果 | `abc_123` の入力後にテキストへ反映され、parse 結果の name が `abc_123` |
| EV-033 | REQ-033 | id フィールドが自由文字列を受け付けること | id `<input>` での入力結果 | `REQ-001` および `1.2.3` の入力後、parse 結果の id がそれぞれ `REQ-001` / `1.2.3` |
| EV-034 | REQ-034 | text フィールドが textarea で自由文字列を受け付けること | text `<textarea>` での入力結果 | `<textarea>` 要素であり、改行を含む文字列を入力後 parse 結果の text に同一文字列が格納 |
| EV-035 | REQ-035 | risk select 3 種選択肢が一致 | risk `<select>` の option 値 | option の value 集合が `{low, medium, high}` と完全一致 (3 個) |
| EV-036 | REQ-036 | verifymethod select 4 種選択肢が一致 | verifymethod `<select>` の option 値 | option の value 集合が `{analysis, inspection, test, demonstration}` と完全一致 (4 個) |
| EV-037 | REQ-037 | element.type / element.docref が自由テキスト入力で docref は空可であること | element 編集パネル input | type `<input>` で `code module` 等の任意文字列が入力可、docref `<input>` を空文字列のまま保存しても parse でエラーが発生せず docref が空文字列または未定義 |
| EV-038 | REQ-038 | reltype select 7 種選択肢一致かつドロップダウン1個 | reltype `<select>` 要素 | `<select>` 要素が 1 個 (`<select multiple>` ではない)、option の value 集合が `{contains, copies, derives, satisfies, verifies, refines, traces}` と完全一致 (7 個) |
| EV-039 | REQ-039 | update-name 操作で全 relation の from/to 参照が新名に追従すること | 操作後の Mermaid テキスト / parse 結果 | 旧 name を `from` または `to` に持っていた relation すべての該当フィールドが新 name に置換、旧 name を残した relation 行が 0 件 |
| EV-040 | REQ-040 | requirement.js 冒頭で `var P = window.MA.properties` alias を宣言していること | requirement.js のソースコード | ソース内に `var P = window.MA.properties` (またはセミコロンなしを許容して同等の単一行) が 1 箇所存在 |
| EV-041 | REQ-041 | IEC 61508 風シナリオを property panel から構築し mermaid.parse / render が成功すること | parse 戻り値 / mermaid.render 結果 / console | parse 戻り値の elements に requirement 4 件 + element 2 件、relations 5 件以上、reltype 集合に `satisfies / verifies / contains / derives / refines` を含む。`mermaid.parse(text)` が throw せず、`mermaid.render` 後に SVG が生成される。console error 0 |
| EV-042 | REQ-042 | render 完了時の console error が 0 であること | DevTools console / Playwright console_messages | render 完了後の console error 件数 == 0 |

## 4. テストタスク

### TC-001 (対応評価ID: EV-001)
- **目的**: parse が `requirement` 種別を識別することを確認する
- **準備物**: Node.js、`tests/run-tests.js`、`tests/requirement-parser.test.js`
- **事前条件**: `src/modules/requirement.js` がロード済み
- **手順**:
  1. テキスト `requirementDiagram\n\nrequirement r1 {\n  id: R1\n  text: t\n  risk: low\n  verifymethod: test\n}` を parse に渡す
  2. 戻り値 `result.elements[0]` を取得
- **期待結果**: `result.elements[0].kind == 'requirement'` かつ `result.elements[0].reqType == 'requirement'`
- **合否判定**:
  - PASS: 上記 2 条件が両方 true
  - FAIL: いずれか 1 つでも false
- **備考**: —

### TC-002 (対応評価ID: EV-002)
- **目的**: parse が `functionalRequirement` を識別することを確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: `src/modules/requirement.js` がロード済み
- **手順**:
  1. テキスト `requirementDiagram\n\nfunctionalRequirement r1 {\n  id: R1\n}` を parse に渡す
  2. 戻り値 `result.elements[0]` を取得
- **期待結果**: `result.elements[0].kind == 'requirement'` かつ `result.elements[0].reqType == 'functionalRequirement'`
- **合否判定**:
  - PASS: 上記条件成立
  - FAIL: 不成立
- **備考**: —

### TC-003 (対応評価ID: EV-003)
- **目的**: parse が `interfaceRequirement` を識別することを確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: `src/modules/requirement.js` がロード済み
- **手順**:
  1. テキスト `requirementDiagram\n\ninterfaceRequirement r1 {}` を parse に渡す
  2. 戻り値 `result.elements[0]` を取得
- **期待結果**: `result.elements[0].kind == 'requirement'` かつ `result.elements[0].reqType == 'interfaceRequirement'`
- **合否判定**:
  - PASS: 成立
  - FAIL: 不成立
- **備考**: 空ボディも許容するか確認 (parse 仕様上空ブロックも対象)

### TC-004 (対応評価ID: EV-004)
- **目的**: parse が `performanceRequirement` を識別することを確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: `src/modules/requirement.js` がロード済み
- **手順**:
  1. テキスト `requirementDiagram\n\nperformanceRequirement r1 {}` を parse に渡す
  2. `result.elements[0]` を取得
- **期待結果**: `kind == 'requirement'` かつ `reqType == 'performanceRequirement'`
- **合否判定**: PASS: 成立 / FAIL: 不成立
- **備考**: —

### TC-005 (対応評価ID: EV-005)
- **目的**: parse が `physicalRequirement` を識別することを確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: `src/modules/requirement.js` がロード済み
- **手順**:
  1. テキスト `requirementDiagram\n\nphysicalRequirement r1 {}` を parse に渡す
  2. `result.elements[0]` を取得
- **期待結果**: `kind == 'requirement'` かつ `reqType == 'physicalRequirement'`
- **合否判定**: PASS: 成立 / FAIL: 不成立
- **備考**: —

### TC-006 (対応評価ID: EV-006)
- **目的**: parse が `designConstraint` を識別することを確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: `src/modules/requirement.js` がロード済み
- **手順**:
  1. テキスト `requirementDiagram\n\ndesignConstraint r1 {}` を parse に渡す
  2. `result.elements[0]` を取得
- **期待結果**: `kind == 'requirement'` かつ `reqType == 'designConstraint'`
- **合否判定**: PASS: 成立 / FAIL: 不成立
- **備考**: —

### TC-007 (対応評価ID: EV-007)
- **目的**: parse が element を識別し name / type / docref を保持することを確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: `src/modules/requirement.js` がロード済み
- **手順**:
  1. テキスト `requirementDiagram\n\nelement ecu_firmware {\n  type: code module\n  docref: src/ecu.c\n}` を parse に渡す
  2. `result.elements[0]` を取得
- **期待結果**: `kind == 'element'` かつ `name == 'ecu_firmware'` かつ `type == 'code module'` かつ `docref == 'src/ecu.c'`
- **合否判定**: PASS: 4 条件全成立 / FAIL: 1 つでも不成立
- **備考**: —

### TC-008 (対応評価ID: EV-008)
- **目的**: relation `contains` の parse を確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: 同上
- **手順**:
  1. テキスト `requirementDiagram\n\nrequirement a {}\nrequirement b {}\na - contains -> b` を parse に渡す
  2. `result.relations[0]` を取得
- **期待結果**: `relations[0].reltype == 'contains'` かつ `from == 'a'` かつ `to == 'b'`
- **合否判定**: PASS: 全成立 / FAIL: 不成立
- **備考**: —

### TC-009 (対応評価ID: EV-009)
- **目的**: relation `copies` の parse を確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: 同上
- **手順**:
  1. テキスト `requirementDiagram\n\nrequirement a {}\nrequirement b {}\na - copies -> b` を parse に渡す
  2. `result.relations[0]` を取得
- **期待結果**: `reltype == 'copies'`
- **合否判定**: PASS: 成立 / FAIL: 不成立
- **備考**: —

### TC-010 (対応評価ID: EV-010)
- **目的**: relation `derives` の parse を確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: 同上
- **手順**:
  1. テキスト `requirementDiagram\n\nrequirement a {}\nrequirement b {}\na - derives -> b` を parse に渡す
  2. `result.relations[0]` を取得
- **期待結果**: `reltype == 'derives'`
- **合否判定**: PASS: 成立 / FAIL: 不成立
- **備考**: —

### TC-011 (対応評価ID: EV-011)
- **目的**: relation `satisfies` の parse を確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: 同上
- **手順**:
  1. テキスト `requirementDiagram\n\nelement e {}\nrequirement r {}\ne - satisfies -> r` を parse に渡す
  2. `result.relations[0]` を取得
- **期待結果**: `reltype == 'satisfies'`
- **合否判定**: PASS: 成立 / FAIL: 不成立
- **備考**: —

### TC-012 (対応評価ID: EV-012)
- **目的**: relation `verifies` の parse を確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: 同上
- **手順**:
  1. テキスト `requirementDiagram\n\nelement e {}\nrequirement r {}\ne - verifies -> r` を parse に渡す
  2. `result.relations[0]` を取得
- **期待結果**: `reltype == 'verifies'`
- **合否判定**: PASS: 成立 / FAIL: 不成立
- **備考**: —

### TC-013 (対応評価ID: EV-013)
- **目的**: relation `refines` の parse を確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: 同上
- **手順**:
  1. テキスト `requirementDiagram\n\nrequirement a {}\nrequirement b {}\na - refines -> b` を parse に渡す
  2. `result.relations[0]` を取得
- **期待結果**: `reltype == 'refines'`
- **合否判定**: PASS: 成立 / FAIL: 不成立
- **備考**: —

### TC-014 (対応評価ID: EV-014)
- **目的**: relation `traces` の parse を確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: 同上
- **手順**:
  1. テキスト `requirementDiagram\n\nrequirement a {}\nrequirement b {}\na - traces -> b` を parse に渡す
  2. `result.relations[0]` を取得
- **期待結果**: `reltype == 'traces'`
- **合否判定**: PASS: 成立 / FAIL: 不成立
- **備考**: —

### TC-015 (対応評価ID: EV-015)
- **目的**: add-requirement / add-element / add-relation の操作後にテキストへ宣言行が追記されることを確認する
- **準備物**: Node.js、`tests/requirement-updater.test.js`
- **事前条件**: 初期テキスト `requirementDiagram\n` のみ
- **手順**:
  1. add-requirement(reqType: functionalRequirement, name: r1) を実行
  2. add-element(name: e1) を実行
  3. add-relation(from: e1, reltype: satisfies, to: r1) を実行
- **期待結果**: 操作後のテキストに `functionalRequirement r1 {`、`element e1 {`、`e1 - satisfies -> r1` の 3 行が新規追加されている
- **合否判定**:
  - PASS: 3 行すべて存在
  - FAIL: 1 行でも欠落
- **備考**: —

### TC-016 (対応評価ID: EV-016)
- **目的**: delete 操作で対象要素行と関連 relation 行が同時に消えることを確認する
- **準備物**: Node.js、`tests/requirement-updater.test.js`
- **事前条件**: テキストに requirement r1、element e1、relation `e1 - satisfies -> r1` が存在
- **手順**:
  1. delete-requirement(name: r1) を実行
  2. 操作後テキストを取得
- **期待結果**: `requirement r1 {` および `e1 - satisfies -> r1` の行が両方とも 0 件
- **合否判定**:
  - PASS: 両行とも消滅
  - FAIL: いずれか残存
- **備考**: cascade 削除の検証

### TC-017 (対応評価ID: EV-017)
- **目的**: update 操作で各フィールド (name / id / text / risk / verifymethod / type / docref / reltype) の値がテキストに反映されることを確認する
- **準備物**: Node.js、`tests/requirement-updater.test.js`
- **事前条件**: requirement r1 (id: R0, text: old, risk: low, verifymethod: analysis)、element e1 (type: t0, docref: d0)、relation `e1 - satisfies -> r1` を含むテキスト
- **手順**:
  1. update-field(target: r1, field: id, value: R1) を実行
  2. update-field(target: r1, field: text, value: new) を実行
  3. update-field(target: r1, field: risk, value: high) を実行
  4. update-field(target: r1, field: verifymethod, value: test) を実行
  5. update-field(target: e1, field: type, value: code module) を実行
  6. update-field(target: e1, field: docref, value: src/x.c) を実行
  7. update-field(target: relation, field: reltype, value: verifies) を実行
- **期待結果**: 操作後テキストに `id: R1`、`text: new`、`risk: high`、`verifymethod: test`、`type: code module`、`docref: src/x.c`、`e1 - verifies -> r1` の 7 文字列がそれぞれ 1 件以上存在し、旧値の文字列 (`R0`、`old`、`low`、`analysis`、`t0`、`d0`、`satisfies`) は当該行から消滅
- **合否判定**:
  - PASS: 新値 7 件すべて存在 + 旧値が当該行から全消失
  - FAIL: 1 件でも欠落または旧値残存
- **備考**: name update は EV-039 / TC-039 で個別検証

### TC-018 (対応評価ID: EV-018)
- **目的**: moveUp / moveDown が要素には適用され relation には適用されないことを確認する
- **準備物**: Node.js、`tests/requirement-updater.test.js`
- **事前条件**: テキストに requirement a、requirement b の順で宣言、`a - satisfies -> b` の relation 1 件
- **手順**:
  1. moveDown(target: requirement a) を実行
  2. 操作後テキスト T1 を保存
  3. moveUp(target: relation `a - satisfies -> b`) を実行
  4. 操作後テキスト T2 を保存
- **期待結果**: T1 で requirement b の宣言行が requirement a より前に出現。T2 と T1 が完全一致 (relation への moveUp は無効)
- **合否判定**:
  - PASS: T1 で順序入替済み、T2 == T1
  - FAIL: いずれか不成立
- **備考**: —

### TC-019 (対応評価ID: EV-019)
- **目的**: Connection Mode で source→target を選択した結果 relation 行が 1 行追加されることを確認する
- **準備物**: Playwright、`mermaid-assist.html`、`tests/e2e/requirement-basic.spec.js` (E30 相当)
- **事前条件**: requirement r1、element e1 を含むテキストでアプリ起動済み、Connection Mode reltype = satisfies に設定済み
- **手順**:
  1. オーバーレイ上の e1 をクリック (source 選択)
  2. オーバーレイ上の r1 をクリック (target 選択)
  3. テキストエディタの内容を取得
- **期待結果**: テキストに `e1 - satisfies -> r1` の行が 1 行新規追加されている (操作前との diff が +1 行のみ、その内容が当該文字列)
- **合否判定**:
  - PASS: diff +1 行 かつ 内容一致
  - FAIL: 行数不一致または内容不一致
- **備考**: —

### TC-020 (対応評価ID: EV-020)
- **目的**: `src/modules/requirement.js` が DiagramModule v2 として登録されていることを確認する
- **準備物**: Playwright、`mermaid-assist.html`
- **事前条件**: アプリ起動済み
- **手順**:
  1. ファイルシステムで `src/modules/requirement.js` の存在を確認
  2. ブラウザコンソールで `window.MA.modules.requirement` を評価
  3. `Object.keys(window.MA.modules.requirement)` を取得
- **期待結果**: ファイルが存在し、`window.MA.modules.requirement` が undefined ではなく、キーに `parse`、`build`、`operations` (または DiagramModule v2 が要求するインターフェース名) を含む
- **合否判定**:
  - PASS: ファイル存在 + キー parse/build/operations 全て存在
  - FAIL: いずれか欠落
- **備考**: DiagramModule v2 のインターフェース定義は ADR-012 を参照

### TC-021 (対応評価ID: EV-021)
- **目的**: requirement.js が `window.MA.properties` を参照し独自 fieldHtml 実装を持たないことを確認する
- **準備物**: Grep
- **事前条件**: `src/modules/requirement.js` が存在
- **手順**:
  1. `src/modules/requirement.js` を Grep で `window.MA.properties` 検索
  2. 同ファイルを Grep で関数定義 `function fieldHtml`、`function selectFieldHtml` 等の独自実装を検索
- **期待結果**: `window.MA.properties` 参照が 1 箇所以上、独自定義 `function fieldHtml(` / `function selectFieldHtml(` の宣言が 0 件
- **合否判定**:
  - PASS: 参照 ≥ 1 かつ 独自定義 == 0
  - FAIL: 参照 0 または 独自定義 ≥ 1
- **備考**: —

### TC-022 (対応評価ID: EV-022)
- **目的**: 追加フォームが縦並びかつラベル付きであることを確認する
- **準備物**: Playwright、`mermaid-assist.html`
- **事前条件**: requirementDiagram のプロパティパネルが開いている
- **手順**:
  1. Add Requirement / Add Element / Add Relation の各追加フォーム DOM をスナップショット取得
  2. 各フォームコンテナの computed style `flex-direction` を取得
  3. 各入力に対応する `<label>` 要素の数を取得
- **期待結果**: 各追加フォームの `flex-direction == 'column'` (もしくは block レイアウトの縦積み) かつ 入力 input/select/textarea の数 ≦ `<label>` 要素の数
- **合否判定**:
  - PASS: 3 フォームすべてで縦積み + label 数 ≧ 入力数
  - FAIL: 1 フォームでも違反
- **備考**: ECN-013 / ADR-015 と同等の表示

### TC-023 (対応評価ID: EV-023)
- **目的**: mermaid v11 で requirementDiagram が描画されることを確認する
- **準備物**: Playwright、`mermaid-assist.html`、`lib/mermaid.min.js`
- **事前条件**: 本仕様書 §Mermaid 構文サンプルのテキストをエディタにロード済み
- **手順**:
  1. プレビュー領域 DOM の `<svg>` 要素数を取得
  2. ブラウザ console error の件数を取得
- **期待結果**: SVG 要素数 ≧ 1 かつ console error == 0
- **合否判定**:
  - PASS: SVG ≥ 1 かつ error == 0
  - FAIL: SVG 0 または error ≥ 1
- **備考**: —

### TC-024 (対応評価ID: EV-024)
- **目的**: parse 戻り値が `{meta, elements, relations}` の構造を持つことを確認する
- **準備物**: Node.js、`tests/requirement-parser.test.js`
- **事前条件**: 同上
- **手順**:
  1. 本仕様書 §Mermaid 構文サンプルのテキスト全文を parse に渡す
  2. 戻り値 `result` を検査
- **期待結果**: `typeof result.meta == 'object'`、`Array.isArray(result.elements) == true`、`Array.isArray(result.relations) == true`、各 element に `kind` / `name` / `line` プロパティが存在し、kind == 'requirement' のとき `reqType` / `id` / `text` / `risk` / `verifymethod` プロパティが存在、kind == 'element' のとき `type` / `docref` プロパティが存在。各 relation に `id` / `from` / `to` / `reltype` / `line` プロパティが存在
- **合否判定**:
  - PASS: 上記すべて成立
  - FAIL: 1 件でも違反
- **備考**: —

### TC-025 (対応評価ID: EV-025)
- **目的**: Add Requirement フォーム DOM 構造を確認する
- **準備物**: Playwright、`mermaid-assist.html`
- **事前条件**: requirementDiagram プロパティパネル表示済み
- **手順**:
  1. Add Requirement フォーム DOM を取得
  2. 子要素を列挙
- **期待結果**: 子要素に reqType `<select>` (option 数 == 6)、Name `<input>` (1 個)、`+` ボタン (1 個) が含まれる
- **合否判定**:
  - PASS: 3 種すべて存在 + option 数 == 6
  - FAIL: 1 つでも違反
- **備考**: —

### TC-026 (対応評価ID: EV-026)
- **目的**: Add Element フォーム DOM 構造を確認する
- **準備物**: Playwright、`mermaid-assist.html`
- **事前条件**: 同上
- **手順**:
  1. Add Element フォーム DOM を取得
  2. 子要素を列挙
- **期待結果**: 子要素に Name `<input>` (1 個) と `+` ボタン (1 個) が存在し、type / docref に対応する追加フォーム上の input / textarea は 0 個
- **合否判定**:
  - PASS: Name + ボタン存在 + type/docref 入力 0
  - FAIL: いずれか違反
- **備考**: type / docref は個別パネル側で確認 (TC-029)

### TC-027 (対応評価ID: EV-027)
- **目的**: Add Relation フォーム DOM 構造 (縦1列) を確認する
- **準備物**: Playwright、`mermaid-assist.html`
- **事前条件**: 同上
- **手順**:
  1. Add Relation フォーム DOM を取得
  2. computed style `flex-direction` を取得
  3. 子要素として From `<select>`、reltype `<select>`、To `<select>`、`+` ボタンを列挙
- **期待結果**: `flex-direction == 'column'`、From `<select>` (1)、reltype `<select>` (option 数 == 7)、To `<select>` (1)、`+` ボタン (1) がすべて存在
- **合否判定**:
  - PASS: すべて成立
  - FAIL: 違反あり
- **備考**: —

### TC-028 (対応評価ID: EV-028)
- **目的**: Requirement 編集パネルのフィールド構成を確認する
- **準備物**: Playwright、`mermaid-assist.html`
- **事前条件**: requirement 要素を 1 件選択 (クリック) 済み
- **手順**:
  1. 編集パネル DOM を取得
  2. reqType select、Name input、id input、text textarea、risk select、verifymethod select、削除ボタン、↑ボタン、↓ボタン の数をカウント
- **期待結果**: reqType `<select>` (option 6)、Name `<input>`、id `<input>`、text `<textarea>`、risk `<select>` (option 3)、verifymethod `<select>` (option 4)、削除ボタン、↑ボタン、↓ボタンが各 1 個以上
- **合否判定**:
  - PASS: 全要素存在 + option 数一致
  - FAIL: 違反あり
- **備考**: —

### TC-029 (対応評価ID: EV-029)
- **目的**: Element 編集パネルのフィールド構成を確認する
- **準備物**: Playwright、`mermaid-assist.html`
- **事前条件**: element 要素を 1 件選択 (クリック) 済み
- **手順**:
  1. 編集パネル DOM を取得
  2. Name input、type input、docref input、削除/↑/↓ ボタンの数をカウント
  3. docref を空にして blur (確定) 操作を実行
  4. parse 後の docref 値を取得
- **期待結果**: Name `<input>` (1)、type `<input>` (1)、docref `<input>` (1)、削除ボタン (1)、↑ボタン (1)、↓ボタン (1)。docref 空入力後の parse で例外が発生せず docref が空文字列または未定義
- **合否判定**:
  - PASS: 全要素存在 + 空 docref で例外 0
  - FAIL: 違反あり
- **備考**: —

### TC-030 (対応評価ID: EV-030)
- **目的**: Relation 編集パネルのフィールド構成を確認する
- **準備物**: Playwright、`mermaid-assist.html`
- **事前条件**: relation 要素を 1 件選択済み
- **手順**:
  1. 編集パネル DOM を取得
  2. From select、reltype select、To select、削除ボタンを列挙
  3. ↑ボタン、↓ボタンの数を取得
- **期待結果**: From `<select>` (1)、reltype `<select>` (option 7)、To `<select>` (1)、削除ボタン (1)、↑ボタン (0)、↓ボタン (0)
- **合否判定**:
  - PASS: 全条件成立
  - FAIL: 違反あり
- **備考**: —

### TC-031 (対応評価ID: EV-031)
- **目的**: reqType select の選択肢が 6 種であることを確認する
- **準備物**: Playwright
- **事前条件**: Add Requirement フォーム表示済み
- **手順**:
  1. reqType `<select>` の option value 集合を取得
- **期待結果**: option value 集合が `{requirement, functionalRequirement, interfaceRequirement, performanceRequirement, physicalRequirement, designConstraint}` と完全一致 (要素数 6)
- **合否判定**:
  - PASS: 完全一致
  - FAIL: 過不足あり
- **備考**: —

### TC-032 (対応評価ID: EV-032)
- **目的**: Name 入力で英数アンダースコア (例: `abc_123`) が受け付けられることを確認する
- **準備物**: Playwright、`mermaid-assist.html`
- **事前条件**: Add Requirement フォーム表示済み
- **手順**:
  1. Name `<input>` に `abc_123` を入力
  2. `+` ボタンをクリック
  3. parse 結果の `elements[i].name` を取得
- **期待結果**: `name == 'abc_123'`
- **合否判定**:
  - PASS: 一致
  - FAIL: 不一致
- **備考**: —

### TC-033 (対応評価ID: EV-033)
- **目的**: id フィールドが自由文字列 (`REQ-001`、`1.2.3`) を受け付けることを確認する
- **準備物**: Playwright
- **事前条件**: requirement 編集パネル表示済み
- **手順**:
  1. id `<input>` に `REQ-001` を入力 → blur
  2. parse 結果の id を取得
  3. id `<input>` に `1.2.3` を入力 → blur
  4. parse 結果の id を取得
- **期待結果**: 1 回目の id == `REQ-001`、2 回目の id == `1.2.3`
- **合否判定**:
  - PASS: 両方一致
  - FAIL: いずれか不一致
- **備考**: —

### TC-034 (対応評価ID: EV-034)
- **目的**: text フィールドが textarea で改行を含む自由文字列を受け付けることを確認する
- **準備物**: Playwright
- **事前条件**: requirement 編集パネル表示済み
- **手順**:
  1. 編集パネルの text 入力要素のタグ名を取得
  2. text 入力要素に `line1\nline2` を入力 → blur
  3. parse 結果の text を取得
- **期待結果**: 入力要素のタグ名 == `TEXTAREA`、parse 結果の text に `line1` と `line2` の両行が含まれる
- **合否判定**:
  - PASS: タグ名 一致 + 両行含有
  - FAIL: 違反あり
- **備考**: —

### TC-035 (対応評価ID: EV-035)
- **目的**: risk select の選択肢が 3 種であることを確認する
- **準備物**: Playwright
- **事前条件**: requirement 編集パネル表示済み
- **手順**:
  1. risk `<select>` の option value 集合を取得
- **期待結果**: option value 集合が `{low, medium, high}` と完全一致 (要素数 3)
- **合否判定**:
  - PASS: 完全一致
  - FAIL: 過不足あり
- **備考**: —

### TC-036 (対応評価ID: EV-036)
- **目的**: verifymethod select の選択肢が 4 種であることを確認する
- **準備物**: Playwright
- **事前条件**: requirement 編集パネル表示済み
- **手順**:
  1. verifymethod `<select>` の option value 集合を取得
- **期待結果**: option value 集合が `{analysis, inspection, test, demonstration}` と完全一致 (要素数 4)
- **合否判定**:
  - PASS: 完全一致
  - FAIL: 過不足あり
- **備考**: —

### TC-037 (対応評価ID: EV-037)
- **目的**: element.type / element.docref が自由テキスト入力で docref は空可であることを確認する
- **準備物**: Playwright
- **事前条件**: element 編集パネル表示済み
- **手順**:
  1. type `<input>` に `code module` を入力 → blur
  2. parse 結果の type を取得
  3. docref `<input>` の値を空文字列にして blur
  4. parse を再実行し例外発生有無と docref の値を確認
- **期待結果**: type == `code module`、docref 空入力後の parse で例外発生 0、docref が空文字列または未定義
- **合否判定**:
  - PASS: type 一致 + 例外 0 + docref 空相当
  - FAIL: いずれか違反
- **備考**: —

### TC-038 (対応評価ID: EV-038)
- **目的**: reltype select が 7 種でドロップダウン1個 (multi 不可) であることを確認する
- **準備物**: Playwright
- **事前条件**: relation 編集パネルまたは Add Relation フォーム表示済み
- **手順**:
  1. reltype `<select>` 要素を取得
  2. 要素に `multiple` 属性が無いことを確認
  3. option value 集合を取得
- **期待結果**: `<select multiple>` ではない (`select.multiple == false`) かつ option value 集合が `{contains, copies, derives, satisfies, verifies, refines, traces}` と完全一致 (要素数 7)
- **合否判定**:
  - PASS: 全条件成立
  - FAIL: 違反あり
- **備考**: —

### TC-039 (対応評価ID: EV-039)
- **目的**: update-name で全 relation の from / to 参照が新名に追従更新されることを確認する
- **準備物**: Node.js、`tests/requirement-updater.test.js`
- **事前条件**: テキストに requirement `old_name` と element `e1`、relation `e1 - satisfies -> old_name` および `old_name - contains -> sub_req` を含む
- **手順**:
  1. update-field(target: old_name, field: name, value: new_name) を実行
  2. 操作後テキストを取得し parse
- **期待結果**: テキストおよび parse 結果に旧名 `old_name` を `from` または `to` に持つ relation が 0 件、新名 `new_name` に置換された relation が `e1 - satisfies -> new_name` と `new_name - contains -> sub_req` の 2 件存在
- **合否判定**:
  - PASS: 旧名参照 0 件 + 新名参照 2 件
  - FAIL: 違反あり
- **備考**: —

### TC-040 (対応評価ID: EV-040)
- **目的**: requirement.js が `var P = window.MA.properties` の alias を宣言していることを確認する
- **準備物**: Grep
- **事前条件**: `src/modules/requirement.js` が存在
- **手順**:
  1. `src/modules/requirement.js` を Grep で正規表現 `var\s+P\s*=\s*window\.MA\.properties` 検索
  2. ヒット数を取得
- **期待結果**: ヒット数 == 1
- **合否判定**:
  - PASS: == 1
  - FAIL: 0 または 2 以上
- **備考**: ADR-015 準拠

### TC-041 (対応評価ID: EV-041)
- **目的**: IEC 61508 風シナリオを property panel で構築し mermaid.parse / render が成功することを確認する
- **準備物**: Playwright、`mermaid-assist.html`
- **事前条件**: アプリ起動済み、空エディタ
- **手順**:
  1. Add Requirement で requirement 4 件を追加 (例: 過電流停止 / 過電流検出時間 / 自己診断 / セーフモード遷移)
  2. Add Element で element 2 件を追加 (例: ecu_firmware / safety_test_suite)
  3. Add Relation で reltype `satisfies` / `verifies` / `contains` / `derives` / `refines` を含む 5 件以上を追加
  4. parse 戻り値を取得
  5. `mermaid.parse(text)` を呼び、例外発生有無を取得
  6. プレビュー領域の `<svg>` 要素数および console error 数を取得
- **期待結果**: parse 戻り値の elements に requirement 4 件 + element 2 件 (合計 6 件)、relations 件数 ≥ 5、relations の reltype 集合が `{satisfies, verifies, contains, derives, refines}` を部分集合として含む。`mermaid.parse(text)` で例外 0、`<svg>` ≥ 1、console error == 0
- **合否判定**:
  - PASS: 全条件成立
  - FAIL: 1 つでも違反
- **備考**: 実用シナリオ MCP 検証

### TC-042 (対応評価ID: EV-042)
- **目的**: render 完了時の console error が 0 であることを確認する
- **準備物**: Playwright、`mermaid-assist.html`
- **事前条件**: 本仕様書 §Mermaid 構文サンプルのテキストをロード済み
- **手順**:
  1. ページをリロードし mermaid render 完了を待機
  2. `browser_console_messages` で `error` レベルのメッセージ数を取得
- **期待結果**: error メッセージ数 == 0
- **合否判定**:
  - PASS: == 0
  - FAIL: ≥ 1
- **備考**: visual sweep の一部

## 5. トレーサビリティ

| 要件ID | 評価ID | テストタスクID |
|---|---|---|
| REQ-001 | EV-001 | TC-001 |
| REQ-002 | EV-002 | TC-002 |
| REQ-003 | EV-003 | TC-003 |
| REQ-004 | EV-004 | TC-004 |
| REQ-005 | EV-005 | TC-005 |
| REQ-006 | EV-006 | TC-006 |
| REQ-007 | EV-007 | TC-007 |
| REQ-008 | EV-008 | TC-008 |
| REQ-009 | EV-009 | TC-009 |
| REQ-010 | EV-010 | TC-010 |
| REQ-011 | EV-011 | TC-011 |
| REQ-012 | EV-012 | TC-012 |
| REQ-013 | EV-013 | TC-013 |
| REQ-014 | EV-014 | TC-014 |
| REQ-015 | EV-015 | TC-015 |
| REQ-016 | EV-016 | TC-016 |
| REQ-017 | EV-017 | TC-017 |
| REQ-018 | EV-018 | TC-018 |
| REQ-019 | EV-019 | TC-019 |
| REQ-020 | EV-020 | TC-020 |
| REQ-021 | EV-021 | TC-021 |
| REQ-022 | EV-022 | TC-022 |
| REQ-023 | EV-023 | TC-023 |
| REQ-024 | EV-024 | TC-024 |
| REQ-025 | EV-025 | TC-025 |
| REQ-026 | EV-026 | TC-026 |
| REQ-027 | EV-027 | TC-027 |
| REQ-028 | EV-028 | TC-028 |
| REQ-029 | EV-029 | TC-029 |
| REQ-030 | EV-030 | TC-030 |
| REQ-031 | EV-031 | TC-031 |
| REQ-032 | EV-032 | TC-032 |
| REQ-033 | EV-033 | TC-033 |
| REQ-034 | EV-034 | TC-034 |
| REQ-035 | EV-035 | TC-035 |
| REQ-036 | EV-036 | TC-036 |
| REQ-037 | EV-037 | TC-037 |
| REQ-038 | EV-038 | TC-038 |
| REQ-039 | EV-039 | TC-039 |
| REQ-040 | EV-040 | TC-040 |
| REQ-041 | EV-041 | TC-041 |
| REQ-042 | EV-042 | TC-042 |

## 6. カバレッジ自己検査結果

- 要件→評価項目カバレッジ: 42/42 (100%)
- 評価項目→テストタスクカバレッジ: 42/42 (100%)
- 禁止語検出: 0 件 (`正しく` / `適切に` / `素早く` / `違和感なく` / `きちんと` / `しっかり` をすべて Grep で 0 件確認)
- 重複評価項目: 0 件 (観点と判定基準が完全一致する項目なし)
