# システムテスト仕様書: Tier2 Phase 2: Block Diagram

## 0. メタ情報

- **対象仕様書**: `E:\00_Git\05_MermaidAssist\docs\superpowers\specs\2026-04-17-tier2-phase2-block-design.md`
- **生成日時**: 2026-04-17 09:10:13
- **生成エージェント**: system-tester
- **要件件数**: 30
- **評価項目件数**: 30
- **テストタスク件数**: 30

## 1. 未確定事項

なし (Test-6 自己検査で REQ→EV / EV→TC とも 100%、禁止語 0、重複 0 を確認済み)。

## 2. 要件抽出結果

| 要件ID | 仕様書該当箇所 | 要件内容 | 種別 |
|---|---|---|---|
| REQ-001 | §ゴール | Mermaid Block Diagram (`block-beta`) を Tier1 同等の操作粒度で対応すること | 機能 |
| REQ-002 | §スコープ / 対応要素 | standalone ブロックを要素として扱えること | 機能 |
| REQ-003 | §スコープ / 対応要素 | nested ブロック (入れ子) を要素として扱えること | 機能 |
| REQ-004 | §スコープ / 対応要素 | columns (1〜N 列) によるレイアウト制御を扱えること | 機能 |
| REQ-005 | §スコープ / 対応要素 | 矢印リンク (`A --> B`、`A -- label --> B`) を要素として扱えること | 機能 |
| REQ-006 | §スコープ / 対応 operations | `add` 操作で add-block (standalone) / add-nested-block / add-link を実行できること | 機能 |
| REQ-007 | §スコープ / 対応 operations | `delete` 操作でブロック・リンクを削除できること | 機能 |
| REQ-008 | §スコープ / 対応 operations | `update` 操作で text / style を書き換えできること | 機能 |
| REQ-009 | §スコープ / 対応 operations | `moveUp` / `moveDown` 操作でブロックの順序入替が可能であること | 機能 |
| REQ-010 | §スコープ / 対応 operations | `connect` 操作で Connection Mode 経由の矢印リンク作成が可能であること | 機能 |
| REQ-011 | §スコープ / 対象外 | `styles`、`classDef` 等のスタイリング文法は対象外であること | 機能 |
| REQ-012 | §スコープ / 対象外 | Architecture diagram は対象外であること (Tier3 候補) | 機能 |
| REQ-013 | §アーキテクチャ | `src/modules/block.js` を DiagramModule v2 として新規追加すること | インターフェース |
| REQ-014 | §アーキテクチャ | `window.MA.properties` の 14 ヘルパーを全面利用すること (ECN-012) | インターフェース |
| REQ-015 | §アーキテクチャ | 追加フォームを縦並びラベル付きに統一すること (ECN-013 / ADR-015) | インターフェース |
| REQ-016 | §アーキテクチャ | mermaid.js v11 で `block-beta` を描画できること | インターフェース |
| REQ-017 | §データモデル | `parse(text)` 戻り値が `{meta, elements, relations}` の構造を持つこと | 入出力 |
| REQ-018 | §データモデル | `parse(text).meta` が `columns` フィールドを数値で保持すること | 入出力 |
| REQ-019 | §データモデル | `parse(text).elements` の block 要素が `{kind:'block', id, label, shape, parentId, line}` を持つこと | 入出力 |
| REQ-020 | §データモデル | `parse(text).elements` の group 要素が `{kind:'group', id, parentId, line}` を持ち、入れ子ブロックの親 group を参照できること | 入出力 |
| REQ-021 | §データモデル | `parse(text).relations` が `{id, from, to, label, line}` を持ち、ラベルなしリンクは `label: ''` であること | 入出力 |
| REQ-022 | §UI / 追加フォーム | Add Block フォームが `[Name input] [Label input] [+ ボタン]` の構成であり、Label 省略時は Name が表示されること | インターフェース |
| REQ-023 | §UI / 追加フォーム | Add Link フォームが縦1列で `[From select] [To select] [Label input] [+ ボタン]` の構成であること | インターフェース |
| REQ-024 | §UI / 追加フォーム | Set Columns フォームが `[columns input] [適用]` の構成で、全体に1つだけ存在すること | インターフェース |
| REQ-025 | §UI / 個別要素編集パネル | Block 編集パネルが `[Name] [Label] [削除][↑][↓]` を備えること | インターフェース |
| REQ-026 | §UI / 個別要素編集パネル | Link 編集パネルが `[From select] [To select] [Label] [削除]` を備えること | インターフェース |
| REQ-027 | §テスト設計 / updater | `delete` 操作でブロック削除時に当該ブロックを参照する link も連動削除 (cascade) されること | 機能 |
| REQ-028 | §テスト設計 / 実用シナリオ | ECU ハードウェア構成シナリオ (Sensor / MCU / Actuator の3列構成、内部 block 含む) を property panel から完成し、render が成功すること | 機能 |
| REQ-029 | §完了基準 | visual sweep の結果 console error が 0 件であること | 非機能 |
| REQ-030 | §完了基準 | system-tester 100% カバレッジかつ禁止語 0 であること | 非機能 |

## 3. 評価項目

| 評価ID | 対応要件ID | 評価観点 | 観測対象 | 判定基準 |
|---|---|---|---|---|
| EV-001 | REQ-001 | block-beta 図が Tier1 同等の操作 (add / delete / update / moveUp / moveDown / connect) を提供すること | `window.MA.modules.block.operations` | operations オブジェクトに `add-block` / `add-link` / `delete` / `update` / `moveUp` / `moveDown` / `connect` の 7 キー以上が存在 |
| EV-002 | REQ-002 | parse が standalone ブロックを識別し parentId が null であること | parse(text).elements[i] | `kind == 'block'` かつ `parentId == null` の要素が 1 件以上存在 |
| EV-003 | REQ-003 | parse が nested ブロックを識別し parentId が親 group の id を参照すること | parse(text).elements[i] | `kind == 'block'` かつ `parentId == '<group id>'` の要素が 1 件以上、当該 parentId に対応する `kind == 'group'` の要素が存在 |
| EV-004 | REQ-004 | parse が `columns N` 行を識別し meta.columns に数値として保持すること | parse(text).meta.columns | `columns 3` 入力時に `meta.columns === 3` (Number 型) |
| EV-005 | REQ-005 | parse がラベル有/無の矢印リンクを識別すること | parse(text).relations[i] | `A --> B` 入力で `{from:'A', to:'B', label:''}`、`A -- foo --> B` 入力で `{from:'A', to:'B', label:'foo'}` の relation が存在 |
| EV-006 | REQ-006 | add 操作で add-block (standalone) / add-nested-block / add-link の各呼出後にテキスト行が追加されること | 操作後の Mermaid テキスト | add-block で `<id>["<label>"]` 行が新規 1 行、add-nested-block で対象 group 内に block 行が新規 1 行、add-link で `<from> --> <to>` または `<from> -- <label> --> <to>` 行が新規 1 行 |
| EV-007 | REQ-007 | delete 操作でブロック行および link 行が削除できること | 操作後の Mermaid テキスト | 対象 block の宣言行が 0 件、対象 link の行が 0 件 |
| EV-008 | REQ-008 | update 操作で block の label (text) および link の label (style 含むラベル書換) がテキストに反映されること | 操作後の Mermaid テキスト | block の `["<new label>"]` 文字列で出力、link の `-- <new label> -->` 文字列で出力 |
| EV-009 | REQ-009 | moveUp / moveDown で block 宣言行の順序が入替ること | 操作後の Mermaid テキスト | 対象 block の登場行番号が入替前後で隣接 block と入替済み |
| EV-010 | REQ-010 | Connection Mode で source→target をクリックしたとき link 行が 1 行追加されること | 操作後の Mermaid テキスト | `<source> --> <target>` の行が 1 行新規追加 |
| EV-011 | REQ-011 | `styles` / `classDef` 構文は parse の対象外として扱われること | block モジュールの parse / operations | `styles` / `classDef` の追加フォーム・編集パネルが DOM 上に存在せず、parse 結果の elements / relations にこれらの要素が含まれない |
| EV-012 | REQ-012 | Architecture diagram (`architecture-beta` 等) は本モジュールでは扱わないこと | block モジュールの diagramType 判定 | block モジュールの先頭行判定 (`block-beta`) に `architecture-beta` を入力してもマッチせず、モジュールがアクティブにならない |
| EV-013 | REQ-013 | `src/modules/block.js` が存在し DiagramModule v2 形式で登録されていること | ファイルシステム / window.MA.modules | `src/modules/block.js` が存在、`window.MA.modules.block` が DiagramModule v2 インターフェース (parse / build / operations) を備える |
| EV-014 | REQ-014 | block.js が `window.MA.properties` の 14 ヘルパーを参照していること | block.js のソースコード | `window.MA.properties` (または `var P = window.MA.properties` alias) の参照箇所が 1 箇所以上、独自実装による fieldHtml / selectFieldHtml が 0 件 |
| EV-015 | REQ-015 | 追加フォームが縦並びラベル付き構造であること | DOM (Add Block / Add Link / Set Columns 各フォーム) | 各フォーム要素が縦方向に積まれ (flex-direction:column 相当)、各入力に対応する `<label>` 要素が存在 |
| EV-016 | REQ-016 | mermaid v11 で `block-beta` が描画されること | プレビュー領域 / console | プレビュー DOM 内に `<svg>` が 1 個以上生成、console error 0 |
| EV-017 | REQ-017 | parse 戻り値が指定構造であること | parse 戻り値オブジェクト | `result.meta` がオブジェクト、`result.elements` が配列、`result.relations` が配列 |
| EV-018 | REQ-018 | parse 戻り値 meta.columns の型と値 | parse 戻り値 meta.columns | `columns 5` 入力時に `typeof result.meta.columns === 'number'` かつ値が 5 |
| EV-019 | REQ-019 | block 要素のプロパティ構造が仕様通りであること | parse(text).elements[i] (kind=='block') | `kind`, `id`, `label`, `shape`, `parentId`, `line` の 6 プロパティが存在し、kind は文字列 `'block'`、id / label / shape は string、parentId は string または null、line は number |
| EV-020 | REQ-020 | group 要素のプロパティ構造と入れ子参照 | parse(text).elements[i] (kind=='group') | `kind`, `id`, `parentId`, `line` の 4 プロパティが存在、kind は文字列 `'group'`、group の id を parentId に持つ block が少なくとも 1 件存在 |
| EV-021 | REQ-021 | relation のプロパティ構造とラベルなしリンクの label 値 | parse(text).relations[i] | `id`, `from`, `to`, `label`, `line` の 5 プロパティが存在、`A --> B` のみの入力に対し該当 relation の `label === ''` (空文字列) |
| EV-022 | REQ-022 | Add Block フォームの構造一致と Label 省略動作 | DOM (Add Block フォーム) / 追加後の表示 | 子要素として Name `<input>` (1)、Label `<input>` (1)、`+` ボタン (1) が存在。Label 未入力で submit 時、プレビュー SVG 内で当該 block のテキストが Name と同一 |
| EV-023 | REQ-023 | Add Link フォームの構造一致 (縦1列) | DOM (Add Link フォーム) | 子要素として From `<select>`、To `<select>`、Label `<input>`、`+` ボタンの 4 要素が縦方向 (flex-direction:column 相当) に配置 |
| EV-024 | REQ-024 | Set Columns フォームの構造一致と個数 | DOM (Set Columns フォーム) | プロパティパネル上に Set Columns フォームが 1 個のみ存在。子要素として columns `<input>` と `適用` ボタンが各 1 個存在 |
| EV-025 | REQ-025 | Block 編集パネルの UI 要素一致 | DOM (Block 編集パネル) | Name `<input>`、Label `<input>`、削除ボタン、↑ボタン、↓ボタンが各 1 個以上存在 |
| EV-026 | REQ-026 | Link 編集パネルの UI 要素一致 | DOM (Link 編集パネル) | From `<select>`、To `<select>`、Label `<input>`、削除ボタンが各 1 個以上存在し、↑↓ボタンは存在しない |
| EV-027 | REQ-027 | block 削除時のリンク cascade | 操作後の Mermaid テキスト | 削除対象 block の宣言行が 0 件、かつ当該 block の id を `from` / `to` に持つ link 行が 0 件 |
| EV-028 | REQ-028 | ECU HW シナリオ (3列 + 内部 block) を property panel から構築し render が成功すること | parse 戻り値 / mermaid.render 結果 / console | parse 戻り値の `meta.columns === 3`、elements に Sensor / MCU / Actuator の 3 block と 1 個以上の nested block (parentId != null) を含む。`mermaid.parse(text)` が throw せず `mermaid.render` 後に SVG が生成される。console error 0 |
| EV-029 | REQ-029 | visual sweep 完了時の console error が 0 であること | DevTools console / Playwright console_messages | render 完了後の console error 件数 == 0 |
| EV-030 | REQ-030 | 本テスト仕様書のカバレッジと禁止語 | Test-6 自己検査結果 | REQ→EV / EV→TC カバレッジが共に 100%、system-tester 仕様書 §Test-6 が定める禁止語 6 種の検出件数 == 0、重複評価項目 == 0 |

## 4. テストタスク

### TC-001 (対応評価ID: EV-001)
- **目的**: block モジュールが Tier1 同等の operations を登録していることを確認する
- **準備物**: Chromium ブラウザ、`mermaid-assist.html`
- **事前条件**: アプリ起動、block diagram が選択済み
- **手順**:
  1. DevTools console を開く
  2. `Object.keys(window.MA.modules.block.operations)` を実行し戻り値を取得する
- **期待結果**: 戻り値配列に `add-block` / `add-link` / `delete` / `update` / `moveUp` / `moveDown` / `connect` を含む (7 キー以上)
- **合否判定**:
  - PASS: 上記 7 キーすべてが含まれる
  - FAIL: いずれかのキーが欠落

### TC-002 (対応評価ID: EV-002)
- **目的**: parse が standalone ブロックを識別することを確認する
- **準備物**: Node.js、`tests/run-tests.js`、block parser テスト
- **事前条件**: `src/modules/block.js` がロード済み
- **手順**:
  1. テキスト `block-beta\n  a["Sensor"]` を parse に渡す
  2. 戻り値 `result.elements` を取得する
- **期待結果**: `result.elements` に `kind == 'block'` かつ `parentId == null` の要素が 1 件以上存在
- **合否判定**:
  - PASS: 条件を満たす要素が存在
  - FAIL: 存在しない

### TC-003 (対応評価ID: EV-003)
- **目的**: parse が nested ブロックを識別し parentId が親 group を参照することを確認する
- **準備物**: Node.js、`tests/run-tests.js`、block parser テスト
- **事前条件**: `src/modules/block.js` がロード済み
- **手順**:
  1. テキスト `block-beta\n  columns 2\n  block:group1\n    inner1 inner2\n  end\n  outer1` を parse に渡す
  2. `result.elements` から `inner1` / `inner2` / `group1` を取得する
- **期待結果**: `inner1.parentId == 'group1'` かつ `inner2.parentId == 'group1'` かつ `group1.kind == 'group'`
- **合否判定**:
  - PASS: 全条件を満たす
  - FAIL: いずれかが不一致

### TC-004 (対応評価ID: EV-004)
- **目的**: parse が `columns N` を数値として meta に保持することを確認する
- **準備物**: Node.js、block parser テスト
- **事前条件**: `src/modules/block.js` がロード済み
- **手順**:
  1. テキスト `block-beta\n  columns 3\n  a b c` を parse に渡す
  2. `result.meta.columns` を取得する
- **期待結果**: `result.meta.columns === 3` (Number 型)
- **合否判定**:
  - PASS: 型が number かつ値が 3
  - FAIL: 型不一致または値不一致

### TC-005 (対応評価ID: EV-005)
- **目的**: parse がラベル有/無の矢印リンクを識別することを確認する
- **準備物**: Node.js、block parser テスト
- **事前条件**: `src/modules/block.js` がロード済み
- **手順**:
  1. テキスト `block-beta\n  a b\n  a --> b\n  a -- foo --> b` を parse に渡す
  2. `result.relations` を取得する
- **期待結果**: relations 配列に `{from:'a', to:'b', label:''}` と `{from:'a', to:'b', label:'foo'}` が各 1 件存在
- **合否判定**:
  - PASS: 2 件の relation が期待通り
  - FAIL: 件数または値が不一致

### TC-006 (対応評価ID: EV-006)
- **目的**: add-block / add-nested-block / add-link 操作がテキスト行を追加することを確認する
- **準備物**: Chromium ブラウザ、`mermaid-assist.html`
- **事前条件**: block diagram 選択済み、初期テキスト `block-beta\n  columns 2\n  block:g1\n  end`
- **手順**:
  1. Add Block フォームに Name=`a` Label=`A` を入力し `+` をクリック
  2. g1 の内部ブロックとして Name=`inner1` を追加
  3. Add Link フォームで From=`a`, To=`inner1`, Label=空 で `+` をクリック
  4. 編集領域のテキストを取得する
- **期待結果**: テキストに `a["A"]` 行、g1 ブロック内に `inner1` 行、`a --> inner1` 行が各 1 行新規に含まれる
- **合否判定**:
  - PASS: 3 行すべて追加
  - FAIL: いずれかが未追加

### TC-007 (対応評価ID: EV-007)
- **目的**: delete 操作でブロック行および link 行が削除できることを確認する
- **準備物**: Chromium ブラウザ、`mermaid-assist.html`
- **事前条件**: block diagram 選択済み、テキスト `block-beta\n  a b\n  a --> b`
- **手順**:
  1. Block `b` を選択し Block 編集パネルで削除ボタンをクリック
  2. 初期化を戻し link `a --> b` を選択し Link 編集パネルで削除ボタンをクリック
  3. 編集領域のテキストを取得する
- **期待結果**: 削除後のテキストに `b` 単独宣言行が 0 件、`a --> b` 行が 0 件
- **合否判定**:
  - PASS: いずれも 0 件
  - FAIL: どちらかが残存

### TC-008 (対応評価ID: EV-008)
- **目的**: update 操作で block / link の label がテキストに反映されることを確認する
- **準備物**: Chromium ブラウザ、`mermaid-assist.html`
- **事前条件**: テキスト `block-beta\n  a["old"]\n  b\n  a -- oldlbl --> b`
- **手順**:
  1. Block a を選択し Label を `new` に変更
  2. Link `a --> b` を選択し Label を `newlbl` に変更
  3. 編集領域のテキストを取得する
- **期待結果**: テキストに `a["new"]` と `a -- newlbl --> b` を含む
- **合否判定**:
  - PASS: 2 文字列とも存在
  - FAIL: いずれかが不一致

### TC-009 (対応評価ID: EV-009)
- **目的**: moveUp / moveDown で block 宣言行の順序が入替ることを確認する
- **準備物**: Chromium ブラウザ、`mermaid-assist.html`
- **事前条件**: テキスト `block-beta\n  a\n  b\n  c`
- **手順**:
  1. Block `b` を選択し moveUp ボタンをクリック
  2. 編集領域のテキストを取得する
  3. 同じ Block `b` に対し moveDown を 2 回クリック
  4. 編集領域のテキストを取得する
- **期待結果**: 手順2時点で出現順が `b, a, c`、手順4時点で出現順が `a, c, b`
- **合否判定**:
  - PASS: 両手順とも順序一致
  - FAIL: いずれかの順序が不一致

### TC-010 (対応評価ID: EV-010)
- **目的**: Connection Mode で矢印リンクが作成されることを確認する
- **準備物**: Chromium ブラウザ、`mermaid-assist.html`
- **事前条件**: テキスト `block-beta\n  a b`、Connection Mode ボタンが UI に存在
- **手順**:
  1. Connection Mode ボタンをクリックしモード ON
  2. block `a` のオーバーレイをクリック
  3. block `b` のオーバーレイをクリック
  4. 編集領域のテキストを取得する
- **期待結果**: テキストに `a --> b` 行が 1 行新規追加
- **合否判定**:
  - PASS: 行が新規 1 行追加
  - FAIL: 追加されない、または複数追加

### TC-011 (対応評価ID: EV-011)
- **目的**: `styles` / `classDef` 構文が parse 対象外であることを確認する
- **準備物**: Chromium ブラウザ、`mermaid-assist.html`、DevTools
- **事前条件**: block diagram 選択済み
- **手順**:
  1. プロパティパネル DOM を `document.querySelectorAll('[data-form="add-style"], [data-form="add-classDef"]')` で取得
  2. テキスト `block-beta\n  a\n  style a fill:#f00\n  classDef foo fill:#0f0` を parse に渡し、戻り値の elements / relations を確認
- **期待結果**: 手順1で取得した NodeList が空 (length == 0)、手順2で elements / relations のいずれにも `style` / `classDef` に由来する要素が含まれない
- **合否判定**:
  - PASS: 両条件を満たす
  - FAIL: いずれかの UI が存在、または要素として parse された

### TC-012 (対応評価ID: EV-012)
- **目的**: Architecture diagram が block モジュール対象外であることを確認する
- **準備物**: Node.js、block モジュールの diagramType 判定関数
- **事前条件**: `src/modules/block.js` がロード済み
- **手順**:
  1. `window.MA.modules.block.detect('architecture-beta\n  service a')` (または同等の detect 関数) を呼ぶ
  2. 戻り値を取得
- **期待結果**: 戻り値が `false` (block モジュールが受理しない)
- **合否判定**:
  - PASS: false
  - FAIL: true

### TC-013 (対応評価ID: EV-013)
- **目的**: `src/modules/block.js` が DiagramModule v2 として登録されていることを確認する
- **準備物**: ファイルシステム、Chromium ブラウザ
- **事前条件**: リポジトリ clone 済み、`mermaid-assist.html` 読込済み
- **手順**:
  1. `src/modules/block.js` ファイルの存在を確認
  2. DevTools console で `window.MA.modules.block` を評価
  3. `typeof window.MA.modules.block.parse`、`typeof window.MA.modules.block.operations` を取得
- **期待結果**: ファイル存在、`window.MA.modules.block` が object、`parse` が function、`operations` が object
- **合否判定**:
  - PASS: 全条件を満たす
  - FAIL: いずれかが欠落

### TC-014 (対応評価ID: EV-014)
- **目的**: block.js が `window.MA.properties` ヘルパーを参照していることを確認する
- **準備物**: Grep、`src/modules/block.js`
- **事前条件**: ファイル存在
- **手順**:
  1. `grep -c "window.MA.properties\|var P = window.MA.properties" src/modules/block.js` を実行
  2. `grep -cE "fieldHtml|selectFieldHtml" src/modules/block.js` で独自定義の有無を確認 (関数定義パターンを目視で除外)
- **期待結果**: 手順1のカウントが 1 以上、手順2でヘルパーの再実装 (function 定義) が 0
- **合否判定**:
  - PASS: 参照 1+ かつ再実装 0
  - FAIL: 参照 0 または再実装が存在

### TC-015 (対応評価ID: EV-015)
- **目的**: 追加フォームが縦並びラベル付き構造であることを確認する
- **準備物**: Chromium ブラウザ、DevTools
- **事前条件**: block diagram 選択済み、プロパティパネル表示
- **手順**:
  1. Add Block / Add Link / Set Columns 各フォームの ComputedStyle `flex-direction` を取得する
  2. 各フォームの `<label>` 要素数を取得する
- **期待結果**: 各フォームの flex-direction が `column`、かつ各入力に対応する `<label>` が 1 個以上存在
- **合否判定**:
  - PASS: 3 フォームすべて条件を満たす
  - FAIL: いずれかが未対応

### TC-016 (対応評価ID: EV-016)
- **目的**: mermaid v11 で block-beta が描画されることを確認する
- **準備物**: Chromium ブラウザ、DevTools console
- **事前条件**: block diagram 選択、テキスト `block-beta\n  a["Sensor"] b["MCU"]\n  a --> b`
- **手順**:
  1. レンダリング完了を待機 (プレビュー DOM に svg が出現するまで)
  2. `document.querySelectorAll('#preview svg').length` を取得
  3. DevTools console の error メッセージ件数を取得
- **期待結果**: svg 件数が 1 以上、console error 件数が 0
- **合否判定**:
  - PASS: 両条件を満たす
  - FAIL: いずれかが不一致

### TC-017 (対応評価ID: EV-017)
- **目的**: parse 戻り値の構造一致を確認する
- **準備物**: Node.js、block parser テスト
- **事前条件**: `src/modules/block.js` がロード済み
- **手順**:
  1. `result = parse('block-beta\n  columns 2\n  a b\n  a --> b')` を実行
  2. `typeof result.meta`、`Array.isArray(result.elements)`、`Array.isArray(result.relations)` を取得
- **期待結果**: `typeof result.meta === 'object'`、`Array.isArray(result.elements) === true`、`Array.isArray(result.relations) === true`
- **合否判定**:
  - PASS: 3 条件すべて true
  - FAIL: いずれかが不一致

### TC-018 (対応評価ID: EV-018)
- **目的**: parse 戻り値の meta.columns 型と値を確認する
- **準備物**: Node.js、block parser テスト
- **事前条件**: `src/modules/block.js` がロード済み
- **手順**:
  1. `result = parse('block-beta\n  columns 5\n  a b c d e')` を実行
  2. `typeof result.meta.columns` および `result.meta.columns` の値を取得
- **期待結果**: `typeof result.meta.columns === 'number'` かつ値が 5
- **合否判定**:
  - PASS: 両条件を満たす
  - FAIL: 型不一致または値不一致

### TC-019 (対応評価ID: EV-019)
- **目的**: block 要素のプロパティ構造を確認する
- **準備物**: Node.js、block parser テスト
- **事前条件**: `src/modules/block.js` がロード済み
- **手順**:
  1. `result = parse('block-beta\n  a["Sensor"]')` を実行
  2. `result.elements[0]` のキー集合と型を取得
- **期待結果**: キー集合が `{kind, id, label, shape, parentId, line}` を包含。`kind === 'block'`、`typeof id === 'string'`、`typeof label === 'string'`、`typeof shape === 'string'`、`parentId === null || typeof parentId === 'string'`、`typeof line === 'number'`
- **合否判定**:
  - PASS: 全条件を満たす
  - FAIL: いずれかが不一致

### TC-020 (対応評価ID: EV-020)
- **目的**: group 要素のプロパティ構造と入れ子参照を確認する
- **準備物**: Node.js、block parser テスト
- **事前条件**: `src/modules/block.js` がロード済み
- **手順**:
  1. `result = parse('block-beta\n  block:g1\n    inner1\n  end')` を実行
  2. `result.elements` から `kind == 'group'` の要素を取得
  3. 当該 group.id を parentId に持つ block 要素を取得
- **期待結果**: group 要素が `{kind:'group', id:'g1', parentId:null, line:<number>}` のキーを持ち、parentId=='g1' の block が 1 件以上存在
- **合否判定**:
  - PASS: 両条件を満たす
  - FAIL: いずれかが不一致

### TC-021 (対応評価ID: EV-021)
- **目的**: relation のプロパティ構造とラベルなしリンクの label 値を確認する
- **準備物**: Node.js、block parser テスト
- **事前条件**: `src/modules/block.js` がロード済み
- **手順**:
  1. `result = parse('block-beta\n  a b\n  a --> b')` を実行
  2. `result.relations[0]` のキー集合および label 値を取得
- **期待結果**: キー集合が `{id, from, to, label, line}` を包含し、`label === ''` (空文字列)
- **合否判定**:
  - PASS: 両条件を満たす
  - FAIL: キー欠落または label が空文字列でない

### TC-022 (対応評価ID: EV-022)
- **目的**: Add Block フォーム構造と Label 省略動作を確認する
- **準備物**: Chromium ブラウザ、DevTools
- **事前条件**: block diagram 選択
- **手順**:
  1. Add Block フォーム内の Name `<input>`、Label `<input>`、`+` ボタン の各要素数を取得
  2. Name=`sensor` Label=空 で `+` をクリック
  3. プレビュー SVG 内の block `sensor` のテキスト内容を取得
- **期待結果**: Name `<input>` 1 個、Label `<input>` 1 個、`+` ボタン 1 個。プレビューで当該 block のテキストが `sensor` と一致
- **合否判定**:
  - PASS: 要素数一致かつテキスト一致
  - FAIL: いずれか不一致

### TC-023 (対応評価ID: EV-023)
- **目的**: Add Link フォームの縦1列構造を確認する
- **準備物**: Chromium ブラウザ、DevTools
- **事前条件**: block diagram 選択
- **手順**:
  1. Add Link フォーム内の From `<select>`、To `<select>`、Label `<input>`、`+` ボタンの各要素数を取得
  2. フォームコンテナの ComputedStyle `flex-direction` を取得
- **期待結果**: From / To / Label / `+` が各 1 個、flex-direction が `column`
- **合否判定**:
  - PASS: 全条件を満たす
  - FAIL: いずれかが不一致

### TC-024 (対応評価ID: EV-024)
- **目的**: Set Columns フォームの構造一致と個数を確認する
- **準備物**: Chromium ブラウザ、DevTools
- **事前条件**: block diagram 選択
- **手順**:
  1. プロパティパネル全体で Set Columns フォームの個数を取得 (例: `querySelectorAll('[data-form="set-columns"]').length`)
  2. 当該フォーム内の columns `<input>` と `適用` ボタンの個数を取得
- **期待結果**: Set Columns フォームが 1 個、columns `<input>` 1 個、`適用` ボタン 1 個
- **合否判定**:
  - PASS: 全条件を満たす
  - FAIL: いずれかが不一致

### TC-025 (対応評価ID: EV-025)
- **目的**: Block 編集パネルの UI 要素一致を確認する
- **準備物**: Chromium ブラウザ、DevTools
- **事前条件**: block diagram 選択、テキスト `block-beta\n  a["A"]`、Block a 選択済み
- **手順**:
  1. Block 編集パネル内の Name `<input>`、Label `<input>`、削除ボタン、↑ボタン、↓ボタン の個数を取得
- **期待結果**: それぞれ 1 個以上存在
- **合否判定**:
  - PASS: 5 要素すべて存在
  - FAIL: いずれかが欠落

### TC-026 (対応評価ID: EV-026)
- **目的**: Link 編集パネルの UI 要素一致を確認する
- **準備物**: Chromium ブラウザ、DevTools
- **事前条件**: テキスト `block-beta\n  a b\n  a --> b`、Link `a --> b` 選択済み
- **手順**:
  1. Link 編集パネル内の From `<select>`、To `<select>`、Label `<input>`、削除ボタンの個数を取得
  2. ↑ボタン・↓ボタンの個数を取得
- **期待結果**: From / To / Label / 削除が各 1 個以上、↑↓ボタンが共に 0 個
- **合否判定**:
  - PASS: 全条件を満たす
  - FAIL: いずれかが不一致

### TC-027 (対応評価ID: EV-027)
- **目的**: block 削除時の link cascade 動作を確認する
- **準備物**: Chromium ブラウザ、`mermaid-assist.html`
- **事前条件**: テキスト `block-beta\n  a b c\n  a --> b\n  b --> c`
- **手順**:
  1. Block b を選択し削除ボタンをクリック
  2. 編集領域のテキストを取得する
- **期待結果**: テキスト内に `b` 単独宣言行が 0 件、`a --> b` 行が 0 件、`b --> c` 行が 0 件
- **合否判定**:
  - PASS: 3 条件すべて 0 件
  - FAIL: いずれかが残存

### TC-028 (対応評価ID: EV-028)
- **目的**: ECU ハードウェア構成シナリオ (Sensor / MCU / Actuator 3列、内部 block 含む) を property panel から構築し render できることを確認する
- **準備物**: Chromium ブラウザ、`mermaid-assist.html`、DevTools console
- **事前条件**: block diagram 選択済み、編集領域空
- **手順**:
  1. Set Columns フォームで columns=3 を適用
  2. Add Block で Sensor / MCU / Actuator を順次追加
  3. Add Block で MCU の下位 (nested) として CPU / RAM などの内部 block を 1 個以上追加 (nested 追加 UI 経由)
  4. Add Link で Sensor --> MCU、MCU --> Actuator を追加
  5. 編集領域のテキストを parse に渡し戻り値を取得、`mermaid.parse(text)` を実行、プレビュー svg 生成と console error を確認
- **期待結果**: `result.meta.columns === 3`、elements に Sensor / MCU / Actuator を含み parentId != null の nested block が 1 件以上、`mermaid.parse` が throw しない、プレビュー svg 1 個以上、console error 0
- **合否判定**:
  - PASS: 全条件を満たす
  - FAIL: いずれかが不一致

### TC-029 (対応評価ID: EV-029)
- **目的**: visual sweep 完了時の console error が 0 件であることを確認する
- **準備物**: Playwright、`mcp__playwright__browser_console_messages`
- **事前条件**: block diagram テンプレート描画完了、evaluator によるスクリーンショット取得済み
- **手順**:
  1. Playwright で `mermaid-assist.html` を開き block diagram に切替
  2. テンプレート render 完了を待機
  3. `browser_console_messages` を呼び error レベルのメッセージ件数を取得
- **期待結果**: error レベルの console メッセージ件数が 0
- **合否判定**:
  - PASS: 件数 0
  - FAIL: 件数 >= 1

### TC-030 (対応評価ID: EV-030)
- **目的**: 本テスト仕様書のカバレッジと禁止語検査が基準を満たすことを確認する
- **準備物**: Grep、`2026-04-17-tier2-phase2-block-test-spec.md`
- **事前条件**: 本ファイルが `output_path` に出力済み
- **手順**:
  1. REQ-NNN / EV-NNN / TC-NNN の総数を `grep -c` で計測
  2. トレーサビリティ表で全 REQ が EV、全 EV が TC に紐付くことを確認
  3. 判定基準行に system-tester 仕様書 §Test-6 の禁止語 6 種が含まれていないかを grep で確認
  4. 評価項目 (観点+判定基準) の重複を sort/uniq で確認
- **期待結果**: REQ→EV カバレッジ 100% (30/30)、EV→TC カバレッジ 100% (30/30)、禁止語 0 件、重複 0 件
- **合否判定**:
  - PASS: 全指標が基準値
  - FAIL: いずれかが未達

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

## 6. カバレッジ自己検査結果

- 要件→評価項目カバレッジ: 30/30 (100%)
- 評価項目→テストタスクカバレッジ: 30/30 (100%)
- 禁止語検出: 0 件
- 重複評価項目: 0 件
