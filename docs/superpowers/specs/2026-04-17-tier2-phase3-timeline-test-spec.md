# システムテスト仕様書: Tier2 Phase 3: Timeline

## 0. メタ情報
- **対象仕様書**: E:\00_Git\05_MermaidAssist\docs\superpowers\specs\2026-04-17-tier2-phase3-timeline-design.md
- **生成日時**: 2026-04-17 09:43:00
- **生成エージェント**: system-tester
- **要件件数**: 31
- **評価項目件数**: 31
- **テストタスク件数**: 31

## 1. 未確定事項

なし

## 2. 要件抽出結果

| 要件ID | 仕様書該当箇所 | 要件内容 | 種別 |
|---|---|---|---|
| REQ-001 | §ゴール | Mermaid Timeline を Tier1 同等の操作粒度で対応し、リリース計画・開発スケジュールに利用可能とすること | 機能 |
| REQ-002 | §スコープ/対応要素 | 対応要素として `title` (図のタイトル) を扱うこと | 機能 |
| REQ-003 | §スコープ/対応要素 | 対応要素として `section` (グループ区切り) を扱うこと | 機能 |
| REQ-004 | §スコープ/対応要素 | 対応要素として `period` (時刻・日付文字列など) を扱うこと | 機能 |
| REQ-005 | §スコープ/対応要素 | 対応要素として `event` (period に紐付くイベント、複数可) を扱うこと | 機能 |
| REQ-006 | §対応 operations/add | `add-title` operation を持つこと | 機能 |
| REQ-007 | §対応 operations/add | `add-section` operation を持つこと | 機能 |
| REQ-008 | §対応 operations/add | `add-period` operation を持つこと | 機能 |
| REQ-009 | §対応 operations/add | `add-event` operation は既存 period に event を追加すること | 機能 |
| REQ-010 | §対応 operations/delete | `delete` 操作で title / section / period / event を削除可能であること | 機能 |
| REQ-011 | §対応 operations/update | `update` 操作で各フィールドのテキストを書き換え可能であること | 機能 |
| REQ-012 | §対応 operations/moveUp・moveDown | `moveUp` / `moveDown` 操作で時系列の順序入替が可能であること | 機能 |
| REQ-013 | §対応 operations/connect | `connect` 操作はサポートしないこと (time-sequential のため) | 機能 |
| REQ-014 | §対象外 | period → section の再ぶら下げは対象外であり、move 操作は同一 section 内のみであること | 機能 |
| REQ-015 | §アーキテクチャ | 新規モジュール `src/modules/timeline.js` を DiagramModule v2 として実装すること | インターフェース |
| REQ-016 | §アーキテクチャ | properties helpers を利用し、縦並びフォームで実装すること | インターフェース |
| REQ-017 | §アーキテクチャ | auto-quote は不要であること (timeline は quote 制約がゆるい) | インターフェース |
| REQ-018 | §データモデル | データモデルは `meta.title` を持つこと | 入出力 |
| REQ-019 | §データモデル | `elements` 配列に `section` 要素 (`kind: 'section'`, `id`, `label`, `line`) を持つこと | 入出力 |
| REQ-020 | §データモデル | `elements` 配列に `period` 要素 (`kind: 'period'`, `id`, `period`, `events` 配列, `parentId`, `line`) を持つこと | 入出力 |
| REQ-021 | §データモデル | `relations` は空配列であること | 入出力 |
| REQ-022 | §UI/プロパティパネル | Title 設定 UI は `[title input] [適用]` 構成であること | インターフェース |
| REQ-023 | §UI/プロパティパネル | Add Section UI は `[name] [+]` 構成であること | インターフェース |
| REQ-024 | §UI/プロパティパネル | Add Period UI は `[section select] [period text] [first event text] [+]` 構成であること | インターフェース |
| REQ-025 | §UI/プロパティパネル | Add Event to period UI は `[period select] [event text] [+]` 構成であること | インターフェース |
| REQ-026 | §UI/プロパティパネル | 詳細パネルは section / period (events list を含む) / event (個別) の3種を提供すること | インターフェース |
| REQ-027 | §テスト設計 | Unit テストを約15ケース実装すること (parse: title/section/period/event + updater: add/delete/update/move) | 非機能 |
| REQ-028 | §テスト設計 | E2E テストを約8ケース (E41-E48) 実装すること | 非機能 |
| REQ-029 | §テスト設計 | system-tester によるカバレッジ 100% を達成すること | 非機能 |
| REQ-030 | §テスト設計 | visual sweep として default + various section/period counts のスクリーンショット検証を行うこと | 非機能 |
| REQ-031 | §完了基準 | 全テスト PASS、system-tester 100%、visual sweep 0 error、リリース計画シナリオ PASS、ECN-016 発行、v1.5.0 タグ付与を満たすこと | 非機能 |

## 3. 評価項目

| 評価ID | 対応要件ID | 評価観点 | 観測対象 | 判定基準 |
|---|---|---|---|---|
| EV-001 | REQ-001 | リリース計画シナリオ (3 section × 3-4 period, 複数 event) が全操作で編集可能であること | GUI操作の完了状態・Mermaidテキスト | シナリオ定義の全操作 (add/delete/update/moveUp/moveDown) が実行でき、Mermaid テキストが `timeline` プレフィックスを持つ有効な構文で出力される |
| EV-002 | REQ-002 | `title プロジェクトリリース計画` の記述が parse で `meta.title === 'プロジェクトリリース計画'` として保持されること | parse 結果の `meta.title` | `meta.title === 'プロジェクトリリース計画'` |
| EV-003 | REQ-003 | `section Q1` が parse で `kind: 'section'`, `id: 'Q1'`, `label: 'Q1'` として保持されること | parse 結果の `elements` 配列 | `elements.find(e => e.kind === 'section' && e.id === 'Q1')` が存在し `label === 'Q1'` |
| EV-004 | REQ-004 | `2026-01-15 : キックオフ` が parse で `kind: 'period'`, `period: '2026-01-15'` として保持されること | parse 結果の `elements` 配列 | `elements.find(e => e.kind === 'period' && e.period === '2026-01-15')` が存在する |
| EV-005 | REQ-005 | `2026-02-01 : 要件定義完了 : 設計開始` が parse で `events: ['要件定義完了', '設計開始']` として保持されること (複数 event 対応) | parse 結果の period 要素の `events` 配列 | `period === '2026-02-01'` の要素の `events` が `['要件定義完了', '設計開始']` と一致 |
| EV-006 | REQ-006 | `add-title` operation 実行で Mermaid テキスト先頭 (`timeline` 直後) に `title <入力値>` 行が挿入されること | 書き戻し後の Mermaid テキスト | `timeline\n    title <入力値>` が含まれる |
| EV-007 | REQ-007 | `add-section` operation 実行で Mermaid テキストに `section <入力値>` 行が追加されること | 書き戻し後の Mermaid テキスト | `section <入力値>` を含む行が末尾に存在する |
| EV-008 | REQ-008 | `add-period` operation 実行で指定 section 配下に `<period text> : <first event text>` 行が追加されること | 書き戻し後の Mermaid テキスト | 指定 section ブロック内に `<period text> : <first event text>` 行が存在する |
| EV-009 | REQ-009 | `add-event` operation 実行で既存 period 行に ` : <event text>` が追記されること | 書き戻し後の該当 period 行 | 該当 period 行が `<period> : <既存events> : <追加event>` 形式に更新される |
| EV-010 | REQ-010 | `delete` operation で title / section / period / event のいずれも削除可能なこと | 書き戻し後の Mermaid テキスト行数と内容 | 削除対象の行または event トークンが Mermaid テキストから消失する (title 削除時は `title` 行消失、section 削除時は `section` 行およびその配下の period 行消失、period 削除時は period 行消失、event 削除時は該当 event トークンのみ消失) |
| EV-011 | REQ-011 | `update` operation で title / section label / period / event の各フィールドテキストが書き換わること | 書き戻し後の Mermaid テキスト | 各フィールドに対して update 実行後、Mermaid テキスト中の該当トークンが入力新値と一致する |
| EV-012 | REQ-012 | `moveUp` / `moveDown` operation で period の行順序が入れ替わること | 書き戻し後の Mermaid テキスト行順 | moveUp 実行で該当 period 行が直前の period 行の前へ移動し、moveDown 実行で直後の period 行の後ろへ移動する |
| EV-013 | REQ-013 | `connect` operation が timeline モジュールから提供されないこと | `timelineModule.operations` キー | `timelineModule.operations` に `connect` キーが存在しない |
| EV-014 | REQ-014 | period は同一 section 内でのみ move 可能で、section 境界を越える移動操作が拒否または無効化されること | moveUp/moveDown 実行時の動作 | section 先頭の period に対する moveUp、および section 末尾の period に対する moveDown は Mermaid テキストを変更しない (parentId が変化しない) |
| EV-015 | REQ-015 | `src/modules/timeline.js` が存在し DiagramModule v2 として登録されていること | ファイル存在・モジュール登録 | `src/modules/timeline.js` ファイルが存在し、`window.MA.modules.timeline` が DiagramModule v2 インターフェース (parse/operations/getFormSchema 等) を満たす |
| EV-016 | REQ-016 | properties helpers を用いた縦並びフォームが timeline モジュールで使用されていること | プロパティパネルの DOM 構造 | プロパティパネル内のフォーム要素が `flex-direction: column` または縦方向スタックで配置され、properties helper 関数 (例: `createField`) が呼び出されている |
| EV-017 | REQ-017 | auto-quote 処理が timeline モジュール内で呼び出されないこと | timeline モジュールのコード | `timeline.js` 内に auto-quote 関連関数呼び出し (例: `autoQuote`) が含まれない |
| EV-018 | REQ-018 | parse 結果のデータモデルが `meta.title` を持つこと | parse 結果オブジェクト | `result.meta` が存在し `typeof result.meta.title === 'string'` |
| EV-019 | REQ-019 | parse 結果の section 要素が `kind`, `id`, `label`, `line` の全フィールドを持つこと | parse 結果の section 要素 | section 要素について `kind === 'section'` かつ `id`, `label`, `line` の各プロパティが定義されている |
| EV-020 | REQ-020 | parse 結果の period 要素が `kind`, `id`, `period`, `events`, `parentId`, `line` の全フィールドを持つこと | parse 結果の period 要素 | period 要素について `kind === 'period'` かつ `id`, `period`, `events` (配列), `parentId`, `line` の各プロパティが定義されている |
| EV-021 | REQ-021 | parse 結果の `relations` が空配列であること | parse 結果の `relations` プロパティ | `Array.isArray(result.relations) === true` かつ `result.relations.length === 0` |
| EV-022 | REQ-022 | Title 設定 UI が `[title input] [適用]` の2要素構成であること | プロパティパネル DOM | Title セクションに `input[type=text]` と label が `適用` のボタンが存在する |
| EV-023 | REQ-023 | Add Section UI が `[name] [+]` の2要素構成であること | プロパティパネル DOM | Add Section セクションに `input` (name 用) と `+` ラベルのボタンが存在する |
| EV-024 | REQ-024 | Add Period UI が `[section select] [period text] [first event text] [+]` の4要素構成であること | プロパティパネル DOM | Add Period セクションに `select` (section 選択) と `input` 2つ (period text, first event text) と `+` ラベルのボタンが存在する |
| EV-025 | REQ-025 | Add Event to period UI が `[period select] [event text] [+]` の3要素構成であること | プロパティパネル DOM | Add Event セクションに `select` (period 選択) と `input` (event text) と `+` ラベルのボタンが存在する |
| EV-026 | REQ-026 | 詳細パネルが section / period / event の3種類提供されていること | 各要素選択時のプロパティパネル | section 要素選択時に label 編集欄、period 要素選択時に period 編集欄と events リスト、event 要素選択時に単一 event テキスト編集欄が表示される |
| EV-027 | REQ-027 | Unit テストが 15 ケース以上実装されており全件 PASS すること | `node tests/run-tests.js` 出力 | timeline 関連テスト数 >= 15 かつ全件 PASS |
| EV-028 | REQ-028 | E2E テスト E41〜E48 の 8 ケースが実装されており全件 PASS すること | `npx playwright test` 出力 | E41〜E48 の 8 ケースが存在し全件 PASS |
| EV-029 | REQ-029 | system-tester による要件→評価→テストのカバレッジが 100% であること | 本テスト仕様書の §6 カバレッジ自己検査結果 | 要件→評価項目カバレッジ == 100% かつ 評価項目→テストタスクカバレッジ == 100% |
| EV-030 | REQ-030 | visual sweep で default と section/period 数の異なる複数パターンのスクリーンショットが取得され差分エラー0件であること | Playwright スクリーンショットと差分レポート | 取得スクリーンショット枚数 >= 2 (default + 異なる section/period 数) かつ visual diff エラー 0 件 |
| EV-031 | REQ-031 | 全テスト PASS、system-tester 100%、visual sweep 0 error、リリース計画シナリオ PASS、ECN-016 発行、v1.5.0 タグが満たされること | テスト結果・ECN ドキュメント・git tag | `npm run test:all` 全 PASS、system-tester カバレッジ 100%、visual sweep diff 0、リリース計画シナリオ手動確認 PASS、`docs/ecn/ECN-016*.md` 存在、`git tag -l v1.5.0` が `v1.5.0` を返す |

## 4. テストタスク

### TC-001 (対応評価ID: EV-001)
- **目的**: リリース計画シナリオで全 operation が実行可能か確認する
- **準備物**: MermaidAssist アプリ (mermaid-assist.html)、ブラウザ
- **事前条件**:
  - アプリ起動済み
  - エディタに空の `timeline` 図が表示されている
- **手順**:
  1. Title に `プロジェクトリリース計画` を入力し「適用」をクリックする
  2. Add Section で `Q1`, `Q2`, `Q3` をそれぞれ追加する
  3. 各 section に 3〜4 個の period を Add Period で追加する (例: Q1 に `2026-01-15:キックオフ`, `2026-02-01:要件定義完了`, `2026-03-20:実装フェーズ開始`)
  4. 既存 period に Add Event で event を追加する
  5. 1 つの period を update、delete、moveUp、moveDown 各操作で編集する
  6. エディタの Mermaid テキストを取得する
- **期待結果**: Mermaid テキストが `timeline` で始まり、title / section / period / event が設計書のシナリオ通り含まれる
- **合否判定**:
  - PASS: Mermaid テキスト先頭が `timeline` かつ全操作がエラーなく完了
  - FAIL: 操作エラーまたは Mermaid テキストに `timeline` プレフィックスなし
- **備考**: シナリオ完走までの一連の手動確認

### TC-002 (対応評価ID: EV-002)
- **目的**: title 文字列が parse 結果の `meta.title` に保持されるか確認する
- **準備物**: Unit テスト環境 (`node tests/run-tests.js`)
- **事前条件**: timeline モジュール実装済み
- **手順**:
  1. 入力テキスト `timeline\n    title プロジェクトリリース計画` を timeline モジュールの parse に渡す
  2. 返却オブジェクトの `meta.title` を読み出す
- **期待結果**: `meta.title === 'プロジェクトリリース計画'`
- **合否判定**:
  - PASS: 文字列完全一致
  - FAIL: 不一致または undefined
- **備考**: —

### TC-003 (対応評価ID: EV-003)
- **目的**: section 要素が parse 結果に所定のフィールドで保持されるか確認する
- **準備物**: Unit テスト環境
- **事前条件**: timeline モジュール実装済み
- **手順**:
  1. 入力テキスト `timeline\n    section Q1\n      2026-01-15 : キックオフ` を parse に渡す
  2. `elements` から `kind === 'section'` の要素を抽出する
- **期待結果**: 抽出要素が `id === 'Q1'` かつ `label === 'Q1'` を満たす
- **合否判定**:
  - PASS: 両フィールドが一致
  - FAIL: いずれか不一致または要素未存在
- **備考**: —

### TC-004 (対応評価ID: EV-004)
- **目的**: period 要素が parse 結果に所定のフィールドで保持されるか確認する
- **準備物**: Unit テスト環境
- **事前条件**: timeline モジュール実装済み
- **手順**:
  1. 入力テキスト `timeline\n    section Q1\n      2026-01-15 : キックオフ` を parse に渡す
  2. `elements` から `kind === 'period'` の要素を抽出する
- **期待結果**: 抽出要素が `period === '2026-01-15'` を満たす
- **合否判定**:
  - PASS: period 値一致
  - FAIL: 不一致または要素未存在
- **備考**: —

### TC-005 (対応評価ID: EV-005)
- **目的**: 複数 event を持つ period が `events` 配列で保持されるか確認する
- **準備物**: Unit テスト環境
- **事前条件**: timeline モジュール実装済み
- **手順**:
  1. 入力テキスト `timeline\n    section Q1\n      2026-02-01 : 要件定義完了 : 設計開始` を parse に渡す
  2. period 要素の `events` 配列を取得する
- **期待結果**: `events` が配列 `['要件定義完了', '設計開始']` と一致
- **合否判定**:
  - PASS: 配列要素数 2 かつ順序込みで完全一致
  - FAIL: 要素数不一致または内容不一致
- **備考**: —

### TC-006 (対応評価ID: EV-006)
- **目的**: add-title operation で title 行が挿入されるか確認する
- **準備物**: Unit テスト環境
- **事前条件**: 初期 Mermaid テキストが `timeline` (title 未設定)
- **手順**:
  1. `timelineModule.operations['add-title']` を入力 `プロジェクトリリース計画` で呼び出す
  2. 書き戻し後の Mermaid テキストを取得する
- **期待結果**: 書き戻しテキストに `timeline\n    title プロジェクトリリース計画` が含まれる
- **合否判定**:
  - PASS: 部分文字列一致
  - FAIL: title 行未挿入または別位置に挿入
- **備考**: —

### TC-007 (対応評価ID: EV-007)
- **目的**: add-section operation で section 行が追加されるか確認する
- **準備物**: Unit テスト環境
- **事前条件**: 初期 Mermaid テキストが `timeline\n    title T`
- **手順**:
  1. `timelineModule.operations['add-section']` を入力 `Q1` で呼び出す
  2. 書き戻し後の Mermaid テキストを取得する
- **期待結果**: 書き戻しテキスト末尾に `section Q1` を含む行が存在する
- **合否判定**:
  - PASS: `section Q1` 行が末尾に存在
  - FAIL: 行が存在しない
- **備考**: —

### TC-008 (対応評価ID: EV-008)
- **目的**: add-period operation で指定 section 配下に period 行が追加されるか確認する
- **準備物**: Unit テスト環境
- **事前条件**: 初期 Mermaid テキストに `section Q1` が存在し配下 period 0 件
- **手順**:
  1. `timelineModule.operations['add-period']` を `{ section: 'Q1', period: '2026-01-15', event: 'キックオフ' }` で呼び出す
  2. 書き戻し後の Mermaid テキストを取得する
- **期待結果**: `section Q1` ブロック内に `2026-01-15 : キックオフ` 行が存在する
- **合否判定**:
  - PASS: Q1 ブロック内に指定行が存在
  - FAIL: 行が他 section 配下または未挿入
- **備考**: —

### TC-009 (対応評価ID: EV-009)
- **目的**: add-event operation で既存 period 行に event が追記されるか確認する
- **準備物**: Unit テスト環境
- **事前条件**: 初期テキストに `2026-02-01 : 要件定義完了` 行が存在
- **手順**:
  1. `timelineModule.operations['add-event']` を `{ periodId: <該当>, event: '設計開始' }` で呼び出す
  2. 書き戻し後の該当 period 行を取得する
- **期待結果**: 行が `2026-02-01 : 要件定義完了 : 設計開始` に更新される
- **合否判定**:
  - PASS: 行テキスト完全一致
  - FAIL: event 未追記または他行に影響
- **備考**: —

### TC-010 (対応評価ID: EV-010)
- **目的**: delete operation で title / section / period / event が削除可能か確認する
- **準備物**: Unit テスト環境
- **事前条件**: 以下 4 種のテキストを用意
  - (a) `timeline\n    title T`
  - (b) `timeline\n    section Q1\n      2026-01-15 : e`
  - (c) `timeline\n    section Q1\n      2026-01-15 : e`
  - (d) `timeline\n    section Q1\n      2026-01-15 : e1 : e2`
- **手順**:
  1. (a) で title 削除 operation を実行しテキストを取得
  2. (b) で section Q1 削除 operation を実行しテキストを取得
  3. (c) で period 削除 operation を実行しテキストを取得
  4. (d) で event `e1` 削除 operation を実行しテキストを取得
- **期待結果**:
  - (a) 結果に `title` 行が含まれない
  - (b) 結果に `section Q1` および `2026-01-15` が含まれない
  - (c) 結果に `2026-01-15 : e` 行が含まれない
  - (d) 結果が `2026-01-15 : e2` に更新される
- **合否判定**:
  - PASS: 全 4 条件を満たす
  - FAIL: いずれか 1 件でも不一致
- **備考**: —

### TC-011 (対応評価ID: EV-011)
- **目的**: update operation で各フィールドのテキストが書き換わるか確認する
- **準備物**: Unit テスト環境
- **事前条件**: 初期テキスト `timeline\n    title T\n    section Q1\n      2026-01-15 : e1`
- **手順**:
  1. title を `T2` に update してテキスト取得
  2. 続けて section `Q1` の label を `Quarter1` に update してテキスト取得
  3. 続けて period `2026-01-15` を `2026-01-20` に update してテキスト取得
  4. 続けて event `e1` を `e9` に update してテキスト取得
- **期待結果**: 最終テキストに `title T2`, `section Quarter1`, `2026-01-20 : e9` が含まれる
- **合否判定**:
  - PASS: 3 フィールド全て一致
  - FAIL: いずれか不一致
- **備考**: —

### TC-012 (対応評価ID: EV-012)
- **目的**: moveUp/moveDown で period の行順序が入れ替わるか確認する
- **準備物**: Unit テスト環境
- **事前条件**: 初期テキスト
  ```
  timeline
      section Q1
        2026-01-15 : a
        2026-02-01 : b
        2026-03-20 : c
  ```
- **手順**:
  1. 2 番目 period (`2026-02-01 : b`) に moveUp を実行しテキストを取得する
  2. 元テキストに戻し 2 番目 period に moveDown を実行しテキストを取得する
- **期待結果**:
  - moveUp 後: 行順序が `2026-02-01 : b` → `2026-01-15 : a` → `2026-03-20 : c`
  - moveDown 後: 行順序が `2026-01-15 : a` → `2026-03-20 : c` → `2026-02-01 : b`
- **合否判定**:
  - PASS: 両ケースとも期待順序と一致
  - FAIL: いずれか不一致
- **備考**: —

### TC-013 (対応評価ID: EV-013)
- **目的**: connect operation が timeline モジュールに存在しないこと確認する
- **準備物**: Unit テスト環境
- **事前条件**: timeline モジュール登録済み
- **手順**:
  1. `Object.keys(timelineModule.operations)` を取得する
- **期待結果**: 配列に文字列 `connect` が含まれない
- **合否判定**:
  - PASS: `includes('connect') === false`
  - FAIL: `connect` キーが存在する
- **備考**: —

### TC-014 (対応評価ID: EV-014)
- **目的**: move 操作が同一 section 内に限定されていること確認する
- **準備物**: Unit テスト環境
- **事前条件**: 初期テキスト
  ```
  timeline
      section Q1
        2026-01-15 : a
      section Q2
        2026-04-10 : b
  ```
- **手順**:
  1. Q1 の `2026-01-15 : a` (section 先頭) に moveUp を実行しテキストを取得する
  2. Q2 の `2026-04-10 : b` (section 末尾) に moveDown を実行しテキストを取得する
- **期待結果**: 両操作とも Mermaid テキストが初期状態と一致 (parentId が変化せず section 境界を越えない)
- **合否判定**:
  - PASS: 2 操作とも初期テキストから変更なし
  - FAIL: いずれかでテキスト変更または section 越境発生
- **備考**: —

### TC-015 (対応評価ID: EV-015)
- **目的**: timeline.js が DiagramModule v2 として存在・登録されていること確認する
- **準備物**: ブラウザ (mermaid-assist.html)、開発者コンソール
- **事前条件**: アプリ起動済み
- **手順**:
  1. ファイルシステムで `src/modules/timeline.js` の存在を確認する
  2. ブラウザコンソールで `window.MA.modules.timeline` を評価する
  3. 返却オブジェクトに `parse`, `operations`, `getFormSchema` の各プロパティが存在するか確認する
- **期待結果**: ファイル存在 かつ `window.MA.modules.timeline` が `parse`, `operations`, `getFormSchema` を持つオブジェクト
- **合否判定**:
  - PASS: ファイル存在 + 3 プロパティ全て存在
  - FAIL: ファイル未存在 または 3 プロパティのいずれか未存在
- **備考**: —

### TC-016 (対応評価ID: EV-016)
- **目的**: プロパティパネルが properties helpers と縦並びフォームで構築されていること確認する
- **準備物**: ブラウザ、開発者コンソール
- **事前条件**: timeline 図表示中、プロパティパネル表示中
- **手順**:
  1. プロパティパネル内のフォームコンテナを DOM inspector で選択する
  2. 計算スタイルの `flex-direction` を取得する
  3. `src/modules/timeline.js` を Grep し `createField` 等の properties helper 関数名の出現を確認する
- **期待結果**: `flex-direction === 'column'` かつ properties helper 関数呼び出しがソース中に存在
- **合否判定**:
  - PASS: 両条件成立
  - FAIL: いずれか不成立
- **備考**: —

### TC-017 (対応評価ID: EV-017)
- **目的**: timeline モジュール内で auto-quote 処理が呼び出されないこと確認する
- **準備物**: Grep ツール
- **事前条件**: `src/modules/timeline.js` 実装済み
- **手順**:
  1. `src/modules/timeline.js` に対して文字列 `autoQuote` を Grep する
- **期待結果**: マッチ件数 0
- **合否判定**:
  - PASS: マッチ 0 件
  - FAIL: マッチ 1 件以上
- **備考**: —

### TC-018 (対応評価ID: EV-018)
- **目的**: parse 結果に `meta.title` フィールドが存在すること確認する
- **準備物**: Unit テスト環境
- **事前条件**: timeline モジュール実装済み
- **手順**:
  1. 入力 `timeline\n    title T` を parse に渡す
  2. 返却オブジェクトの `meta` を取得する
- **期待結果**: `typeof result.meta.title === 'string'` かつ値 `'T'`
- **合否判定**:
  - PASS: 型と値の両方が期待値と一致
  - FAIL: いずれか不一致
- **備考**: —

### TC-019 (対応評価ID: EV-019)
- **目的**: section 要素が `kind`, `id`, `label`, `line` の全フィールドを持つこと確認する
- **準備物**: Unit テスト環境
- **事前条件**: timeline モジュール実装済み
- **手順**:
  1. 入力 `timeline\n    section Q1\n      2026-01-15 : e` を parse に渡す
  2. `elements` から最初の section 要素を取得する
  3. `kind`, `id`, `label`, `line` の各プロパティの存在と型を確認する
- **期待結果**: `kind === 'section'` かつ `typeof id === 'string'` かつ `typeof label === 'string'` かつ `typeof line === 'number'`
- **合否判定**:
  - PASS: 4 条件全て成立
  - FAIL: いずれか不成立
- **備考**: —

### TC-020 (対応評価ID: EV-020)
- **目的**: period 要素が `kind`, `id`, `period`, `events`, `parentId`, `line` の全フィールドを持つこと確認する
- **準備物**: Unit テスト環境
- **事前条件**: timeline モジュール実装済み
- **手順**:
  1. 入力 `timeline\n    section Q1\n      2026-01-15 : e1 : e2` を parse に渡す
  2. `elements` から period 要素を取得する
  3. `kind`, `id`, `period`, `events`, `parentId`, `line` の各プロパティを確認する
- **期待結果**: `kind === 'period'` かつ `typeof id === 'string'` かつ `typeof period === 'string'` かつ `Array.isArray(events) === true` かつ `typeof parentId === 'string'` かつ `typeof line === 'number'`
- **合否判定**:
  - PASS: 6 条件全て成立
  - FAIL: いずれか不成立
- **備考**: —

### TC-021 (対応評価ID: EV-021)
- **目的**: `relations` が空配列であること確認する
- **準備物**: Unit テスト環境
- **事前条件**: timeline モジュール実装済み
- **手順**:
  1. 任意の timeline テキストを parse に渡す
  2. 返却オブジェクトの `relations` を取得する
- **期待結果**: `Array.isArray(result.relations) === true` かつ `result.relations.length === 0`
- **合否判定**:
  - PASS: 両条件成立
  - FAIL: いずれか不成立
- **備考**: —

### TC-022 (対応評価ID: EV-022)
- **目的**: Title 設定 UI が `[title input][適用]` の 2 要素構成であること確認する
- **準備物**: ブラウザ
- **事前条件**: timeline 図で何も選択していない状態 (グローバルプロパティ表示)
- **手順**:
  1. プロパティパネルの Title セクションを DOM inspector で確認する
  2. 子要素として `input[type=text]` の個数と `button` のテキストを確認する
- **期待結果**: `input[type=text]` 1 個 かつ ボタンテキスト `適用` の button 1 個
- **合否判定**:
  - PASS: 2 要素とも存在
  - FAIL: いずれか欠落または追加要素存在
- **備考**: —

### TC-023 (対応評価ID: EV-023)
- **目的**: Add Section UI が `[name][+]` の 2 要素構成であること確認する
- **準備物**: ブラウザ
- **事前条件**: timeline グローバルプロパティ表示中
- **手順**:
  1. Add Section セクションを DOM inspector で確認する
  2. 子要素として `input` の個数と `button` のテキストを確認する
- **期待結果**: `input` 1 個 (name 用) かつ ボタンテキスト `+` の button 1 個
- **合否判定**:
  - PASS: 2 要素とも存在
  - FAIL: いずれか欠落または追加要素存在
- **備考**: —

### TC-024 (対応評価ID: EV-024)
- **目的**: Add Period UI が `[section select][period text][first event text][+]` の 4 要素構成であること確認する
- **準備物**: ブラウザ
- **事前条件**: timeline グローバルプロパティ表示中、section が 1 件以上登録済み
- **手順**:
  1. Add Period セクションを DOM inspector で確認する
  2. 子要素として `select` の個数、`input` の個数、`button` のテキストを確認する
- **期待結果**: `select` 1 個 かつ `input` 2 個 (period text, first event text) かつ ボタンテキスト `+` の button 1 個
- **合否判定**:
  - PASS: 4 要素全て存在
  - FAIL: 個数不一致または追加要素存在
- **備考**: —

### TC-025 (対応評価ID: EV-025)
- **目的**: Add Event to period UI が `[period select][event text][+]` の 3 要素構成であること確認する
- **準備物**: ブラウザ
- **事前条件**: timeline グローバルプロパティ表示中、period が 1 件以上登録済み
- **手順**:
  1. Add Event セクションを DOM inspector で確認する
  2. 子要素として `select` の個数、`input` の個数、`button` のテキストを確認する
- **期待結果**: `select` 1 個 かつ `input` 1 個 かつ ボタンテキスト `+` の button 1 個
- **合否判定**:
  - PASS: 3 要素全て存在
  - FAIL: 個数不一致または追加要素存在
- **備考**: —

### TC-026 (対応評価ID: EV-026)
- **目的**: 詳細パネルが section / period / event の 3 種類提供されていること確認する
- **準備物**: ブラウザ
- **事前条件**: section, period (複数 event 付き), event 各 1 件以上のデータを持つ timeline
- **手順**:
  1. section 要素を選択しプロパティパネル表示内容を確認する
  2. period 要素を選択しプロパティパネル表示内容を確認する
  3. event 要素を選択しプロパティパネル表示内容を確認する
- **期待結果**:
  - section 選択時: label 編集用 input が存在
  - period 選択時: period 編集用 input と events リスト UI (複数 event 編集) が存在
  - event 選択時: 単一 event テキスト編集用 input が存在
- **合否判定**:
  - PASS: 3 条件全て成立
  - FAIL: いずれか不成立
- **備考**: —

### TC-027 (対応評価ID: EV-027)
- **目的**: timeline 関連 Unit テストが 15 ケース以上あり全 PASS することを確認する
- **準備物**: Node.js
- **事前条件**: リポジトリ clone 済み、依存インストール済み
- **手順**:
  1. `node tests/run-tests.js` を実行する
  2. 出力から timeline 関連テストの件数と PASS 件数を抽出する
- **期待結果**: timeline 関連テスト件数 >= 15 かつ PASS 件数 == テスト件数
- **合否判定**:
  - PASS: 件数条件と全 PASS の両方を満たす
  - FAIL: 件数 < 15 または PASS 件数 < テスト件数
- **備考**: —

### TC-028 (対応評価ID: EV-028)
- **目的**: E2E テスト E41〜E48 の 8 ケースが実装され全 PASS することを確認する
- **準備物**: Playwright 環境
- **事前条件**: Playwright 依存インストール済み
- **手順**:
  1. `npx playwright test --grep "E4[1-8]"` を実行する
  2. 出力から実行ケース数と PASS 件数を取得する
- **期待結果**: 実行ケース数 == 8 かつ PASS 件数 == 8
- **合否判定**:
  - PASS: 8 ケース全 PASS
  - FAIL: ケース数 != 8 または PASS 件数 < 8
- **備考**: —

### TC-029 (対応評価ID: EV-029)
- **目的**: 本テスト仕様書のカバレッジ自己検査が 100% であることを確認する
- **準備物**: 本テスト仕様書
- **事前条件**: system-tester により本テスト仕様書生成済み
- **手順**:
  1. §6 カバレッジ自己検査結果を参照する
  2. 要件→評価項目カバレッジと 評価項目→テストタスクカバレッジの数値を読み取る
- **期待結果**: 要件→評価項目カバレッジ 100% かつ 評価項目→テストタスクカバレッジ 100%
- **合否判定**:
  - PASS: 両方 100%
  - FAIL: いずれかが 100% 未満
- **備考**: —

### TC-030 (対応評価ID: EV-030)
- **目的**: visual sweep のスクリーンショット取得と差分エラー 0 を確認する
- **準備物**: Playwright、visual diff 基準画像
- **事前条件**: 基準スクリーンショット保存済み
- **手順**:
  1. default timeline パターンでスクリーンショット取得
  2. 異なる section/period 数 (例: 2 section × 2 period) でスクリーンショット取得
  3. 異なる section/period 数 (例: 4 section × 5 period) でスクリーンショット取得
  4. visual diff ツールで基準画像との比較を実行する
- **期待結果**: スクリーンショット 3 枚取得 かつ visual diff 報告のエラー件数 0
- **合否判定**:
  - PASS: 枚数 >= 2 かつ diff エラー 0 件
  - FAIL: 枚数 < 2 または diff エラー 1 件以上
- **備考**: —

### TC-031 (対応評価ID: EV-031)
- **目的**: 完了基準 (全テスト PASS、system-tester 100%、visual sweep 0 error、シナリオ PASS、ECN-016 発行、v1.5.0 タグ) を総合確認する
- **準備物**: Node.js、Playwright、git、リポジトリ
- **事前条件**: 全関連実装完了、テスト基準画像整備済み
- **手順**:
  1. `npm run test:all` を実行し全テスト結果を取得する
  2. 本テスト仕様書 §6 で system-tester カバレッジ 100% を確認する
  3. TC-030 を実行し visual sweep diff エラー 0 を確認する
  4. TC-001 のリリース計画シナリオを実行し PASS を確認する
  5. `docs/ecn/` 配下で `ECN-016` のファイル存在を確認する
  6. `git tag -l v1.5.0` を実行しタグ存在を確認する
- **期待結果**:
  - `npm run test:all` 終了コード 0
  - system-tester カバレッジ 100%
  - visual sweep diff エラー 0
  - TC-001 シナリオ PASS
  - `ECN-016` で始まるファイルが `docs/ecn/` 配下に存在
  - `git tag -l v1.5.0` 出力が `v1.5.0` を含む
- **合否判定**:
  - PASS: 6 条件全て成立
  - FAIL: いずれか不成立
- **備考**: v1.5.0 タグはリリース作業完了後に付与されるため最終確認タイミングで実施

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

## 6. カバレッジ自己検査結果

- 要件→評価項目カバレッジ: 31/31 (100%)
- 評価項目→テストタスクカバレッジ: 31/31 (100%)
- 禁止語検出: 0件
- 重複評価項目: 0件
