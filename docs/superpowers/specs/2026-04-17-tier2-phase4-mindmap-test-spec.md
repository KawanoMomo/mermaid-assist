# システムテスト仕様書: Tier2 Phase 4: Mindmap

## 0. メタ情報
- **対象仕様書**: E:\00_Git\05_MermaidAssist\docs\superpowers\specs\2026-04-17-tier2-phase4-mindmap-design.md
- **生成日時**: 2026-04-17 10:03:31
- **生成エージェント**: system-tester
- **要件件数**: 28
- **評価項目件数**: 28
- **テストタスク件数**: 28

## 1. 未確定事項
なし

## 2. 要件抽出結果

| 要件ID | 仕様書該当箇所 | 要件内容 | 種別 |
|---|---|---|---|
| REQ-001 | §ゴール | Mermaid Mindmap を Tier1 同等粒度で対応し、機能設計ブレスト・構造検討に利用可能とする | 機能 |
| REQ-002 | §構文サンプル | 仕様書に示された mindmap サンプル構文(root 1件、3ブランチ、最大3階層、複数 shape、1 icon)を parse 可能とする | 機能 |
| REQ-003 | §スコープ-対応要素 | root は最上位ノードで、通常 `((text))` 形式で表記される | 入出力 |
| REQ-004 | §スコープ-対応要素 | node は子ノードで、インデントで階層表現する | 入出力 |
| REQ-005 | §スコープ-対応要素 | shape は 6 種類対応: default / `[text]` square / `(text)` rounded / `((text))` circle / `))text((` bang / `)text(` cloud / `{{text}}` hexagon | 入出力 |
| REQ-006 | §スコープ-対応要素 | icon は `::icon(fa fa-xxx)` 形式で、ノード内の子行として記述される | 入出力 |
| REQ-007 | §スコープ-対応要素 | class は `:::className` 形式で parse のみ対応し、UI 編集は対象外とする | 機能 |
| REQ-008 | §スコープ-対応operations | add-child: 選択ノードの子として新規追加する | 機能 |
| REQ-009 | §スコープ-対応operations | add-sibling: 選択ノードの兄弟として追加する | 機能 |
| REQ-010 | §スコープ-対応operations | indent: インデントを +2 して、より深い子にする | 機能 |
| REQ-011 | §スコープ-対応operations | outdent: インデントを -2 して、親と同レベルにする | 機能 |
| REQ-012 | §スコープ-対応operations | update-text-shape-icon: テキスト / shape / icon を書き換える | 機能 |
| REQ-013 | §スコープ-対応operations | delete: ノードを削除し、子ノードも一緒に削除する | 機能 |
| REQ-014 | §スコープ-対応operations | moveUp / moveDown: 同階層内の順序入替を行う | 機能 |
| REQ-015 | §スコープ-対応operations | connect operation は対応しない(tree 構造固定) | 機能 |
| REQ-016 | §アーキテクチャ | 新規 `src/modules/mindmap.js` を配置する | インターフェース |
| REQ-017 | §アーキテクチャ | indent-based parse を行い、tree 構造へ復元する | 機能 |
| REQ-018 | §データモデル | elements 配列は `{ kind: 'node', id, text, shape, parentId, level, icon, line }` を格納し、root は parentId=null / level=0 とする | 入出力 |
| REQ-019 | §データモデル | relations フィールドは mindmap では unused(空配列)とする | 入出力 |
| REQ-020 | §UI | Add 追加フォームは縦並びで `[親ノード select] [Text] [Shape select 6種] [+ 子追加]` を提示する | インターフェース |
| REQ-021 | §UI | Add sibling フォームは選択中ノードがある場合のみ visible で、`[Text] [Shape select] [+ 兄弟追加]` を提示する | インターフェース |
| REQ-022 | §UI | ノード一覧は tree 表示で、indent により階層を視覚化する | インターフェース |
| REQ-023 | §UI | 詳細パネルは `[Text] [Shape select] [Icon input] [indent/outdent] [削除][↑][↓]` を含む | インターフェース |
| REQ-024 | §テスト設計 | Unit テストは約 15 ケース(parse: indent levels / shapes / icon、updater: add/indent/outdent/delete/move) | 非機能 |
| REQ-025 | §テスト設計 | E2E テストは約 8 ケース(E49-E56)を用意する | 非機能 |
| REQ-026 | §テスト設計 | visual sweep で default + 各 shape(全 6 種) + icon 表示をカバーする | 非機能 |
| REQ-027 | §テスト設計 | シナリオ「組み込み設計ブレスト」(3 階層、複数ブランチ、1 icon)を PASS とする | 機能 |
| REQ-028 | §完了基準 | 全テスト PASS、system-tester 100%、visual sweep 0 error、シナリオ PASS、ECN-017、v1.6.0 tag を満たす | 非機能 |

## 3. 評価項目

| 評価ID | 対応要件ID | 評価観点 | 観測対象 | 判定基準 |
|---|---|---|---|---|
| EV-001 | REQ-001 | Mindmap モジュールが DiagramModule v2 インターフェース経由で登録され、ツール上で図種 `mindmap` が選択可能 | window.MA.modules / UI 図種セレクタ | `window.MA.modules.mindmap` が存在し、図種セレクタに項目 `mindmap` が出現する |
| EV-002 | REQ-002 | 仕様書サンプル構文の parse 結果が期待ツリーに一致 | parse 戻り値 elements 配列 | elements.length == 12、root の text=='組み込み設計' かつ shape=='circle'、`MCU` の shape=='square' かつ label=='ARM Cortex-M4'、`::icon(fa fa-flask)` が テスト ノードの icon プロパティに格納 |
| EV-003 | REQ-003 | root ノードが最上位として扱われ `((text))` 形式を認識 | parse 戻り値 | 入力 `root((X))` に対し elements[0] == `{kind:'node', parentId:null, level:0, shape:'circle', text:'X'}` |
| EV-004 | REQ-004 | インデント差で親子階層が組み立てられる | parse 戻り値 parentId / level | 2 スペースインデントの子ノードで parentId が直上のより浅いノード id、level が親 level+1 |
| EV-005 | REQ-005 | 6 種の shape が構文から識別される | parse 戻り値 shape | 入力 `A`/`[A]`/`(A)`/`((A))`/`))A((`/`)A(`/`{{A}}` に対し shape が順に `default/square/rounded/circle/bang/cloud/hexagon` |
| EV-006 | REQ-006 | icon 構文が親ノードの icon プロパティに集約 | parse 戻り値 icon | 親ノード直下に `::icon(fa fa-flask)` があるとき、親ノードの icon == `fa fa-flask`、icon 行は elements に独立ノードとして追加されない |
| EV-007 | REQ-007 | `:::className` が parse 時に読み取られるが UI 編集欄には出ない | parse 戻り値 / 詳細パネル DOM | 入力 `A:::warn` で対応ノードの class プロパティ == `warn`、詳細パネル内に class 編集用 input 要素が存在しない |
| EV-008 | REQ-008 | add-child が選択ノードの子としてテキスト末尾に 1 行追加 | 書き戻し後 Mermaid テキスト | 選択ノード行の直後に、インデント = 選択ノード+2 の新規行が挿入される |
| EV-009 | REQ-009 | add-sibling が選択ノードと同インデントで直下の位置に 1 行追加 | 書き戻し後 Mermaid テキスト | 選択ノードおよびその子孫ブロックの末尾直後に、選択ノードと同じインデントの新規行が挿入される |
| EV-010 | REQ-010 | indent 操作で対象行のインデントが +2 空白される | 書き戻し後 Mermaid テキスト | 対象行の先頭空白数が実行前 +2、同ブロック内の子孫行の先頭空白数も各 +2 |
| EV-011 | REQ-011 | outdent 操作で対象行のインデントが -2 空白される | 書き戻し後 Mermaid テキスト | 対象行の先頭空白数が実行前 -2、同ブロック内の子孫行の先頭空白数も各 -2、実行前 level==1 の行に対しては実行不可(変化なし) |
| EV-012 | REQ-012 | update-text-shape-icon でテキスト/shape/icon が書き換わる | 書き戻し後 Mermaid テキスト | 対象行の text 文字列、shape 区切り記号、`::icon(..)` 子行がそれぞれ新値に置換される |
| EV-013 | REQ-013 | delete 操作で対象ノードとその子孫がすべてテキストから消える | 書き戻し後 Mermaid テキスト | 対象行および level が対象より深い後続行が削除され、兄弟以降の行は保持される |
| EV-014 | REQ-014 | moveUp / moveDown で同階層内の隣接兄弟と順序入替 | 書き戻し後 Mermaid テキスト | 対象ノードブロック(自身+子孫)と隣接兄弟ブロック(自身+子孫)が丸ごと入れ替わる。先頭で moveUp、末尾で moveDown は no-op |
| EV-015 | REQ-015 | connect operation が公開インターフェースに存在しない | window.MA.modules.mindmap.operations | `operations.connect` が undefined、かつ UI に connect 用ボタンが存在しない |
| EV-016 | REQ-016 | `src/modules/mindmap.js` が存在し読み込まれる | ファイルシステム / HTML script tag | `E:\00_Git\05_MermaidAssist\src\modules\mindmap.js` が存在し、mermaid-assist.html が当該パスを `<script src>` で参照 |
| EV-017 | REQ-017 | parse 結果が木構造として妥当(parentId 循環なし) | parse 戻り値 | 全 element の parentId を辿って root に到達可能、閉路なし、level は `parent.level + 1`(root は 0) |
| EV-018 | REQ-018 | 各 element が所定フィールドを持つ | parse 戻り値 element | 各 element に `kind=='node'`, `id`(文字列, 一意), `text`(文字列), `shape`(6 種のいずれか), `parentId`(文字列 or null), `level`(整数≥0), `icon`(文字列), `line`(整数≥0) が存在 |
| EV-019 | REQ-019 | mindmap の relations は常に空配列 | parse 戻り値 relations | `result.relations` が配列であり length==0 |
| EV-020 | REQ-020 | Add 追加フォームが縦並びで 4 要素を提示 | UI DOM | Add フォーム内に `<select>`(親ノード)、`<input type=text>`(Text)、`<select>`(Shape、option 6 件)、追加ボタン(ラベル「+ 子追加」)が縦方向(`flex-direction: column` または各要素が独立行)に配置 |
| EV-021 | REQ-021 | Add sibling フォームは選択時のみ表示 | UI DOM | 選択ノードなしで非表示(display:none もしくは DOM 非存在)、選択あり時に `<input>`, `<select>`, ボタン「+ 兄弟追加」が表示 |
| EV-022 | REQ-022 | ノード一覧が tree 表示でインデントにより階層を視覚化 | UI DOM | 各ノード行の左マージン or padding が `level × Xpx`(X は実装定数、0 < X) で、parent より子が深い位置に表示 |
| EV-023 | REQ-023 | 詳細パネルに規定 6 コントロールが揃う | UI DOM | 詳細パネル内に Text 入力、Shape セレクタ、Icon 入力、indent ボタン、outdent ボタン、削除ボタン、↑ ボタン、↓ ボタンの各 DOM 要素が存在 |
| EV-024 | REQ-024 | Unit テストケース数と観点が仕様どおり | tests/ 配下の mindmap 関連 unit テスト | mindmap の unit テスト数が 13 以上 17 以下(目標 15)で、parse の indent levels / shapes / icon、updater の add / indent / outdent / delete / move の各観点が最低 1 件ずつ含まれる |
| EV-025 | REQ-025 | E2E テストケースが E49-E56 の 8 件 | Playwright テストファイル | E49, E50, E51, E52, E53, E54, E55, E56 の 8 ID を含む E2E テストが定義されている |
| EV-026 | REQ-026 | visual sweep が default+6 shape+icon の計 8 パターンを含む | visual 検証用 入力 or スクショ一覧 | スクショファイルが最低 8 件(default, square, rounded, circle, bang, cloud, hexagon, icon)存在し、各ファイルで mermaid.js レンダリングが error 0 |
| EV-027 | REQ-027 | シナリオ「組み込み設計ブレスト」が実行可能で 3 階層+複数ブランチ+1 icon を含む | シナリオ定義ファイル / 実行結果 | シナリオ入力が root 1+ branch 2 以上+ depth 3+ icon 1、実行結果の Mermaid テキストが parse error 0、結果 elements に level 0/1/2 の node と icon プロパティ付きノード 1 件が含まれる |
| EV-028a | REQ-028 | 全テスト PASS と 0 error の最終ゲート | テストランナー出力 / visual sweep レポート | `npm run test:all` の exit code == 0、visual sweep レポートで error count == 0 |
| EV-028b | REQ-028 | ECN-017 と v1.6.0 tag の存在 | docs/ecn / git tag | ECN-017 ドキュメントが `docs/` 配下に存在し、`git tag` 出力に `v1.6.0` が含まれる |

## 4. テストタスク

### TC-001 (対応評価ID: EV-001)
- **目的**: Mindmap モジュールが DiagramModule v2 経由で登録されることを確認する
- **準備物**: PC、Chrome 系ブラウザ、mermaid-assist.html
- **事前条件**:
  - 最新ビルドを取得済
  - ブラウザで mermaid-assist.html を開き、初期化完了(`window.MA` 定義済)
- **手順**:
  1. DevTools Console で `window.MA.modules.mindmap` を評価する
  2. 図種セレクタを開き、項目一覧をテキスト抽出する
- **期待結果**: `window.MA.modules.mindmap` が truthy、図種セレクタに文字列 `mindmap` を含む option が存在する
- **合否判定**:
  - PASS: 両観測が真
  - FAIL: いずれかが undefined / 不在
- **備考**: —

### TC-002 (対応評価ID: EV-002)
- **目的**: 仕様書記載のサンプル構文が期待ツリーに parse されることを確認する
- **準備物**: node 実行環境、tests/run-tests.js、mindmap parse API
- **事前条件**:
  - リポジトリを E:\00_Git\05_MermaidAssist でチェックアウト済
- **手順**:
  1. 仕様書 §構文サンプルの Mermaid テキストをそのまま parse 関数に渡す
  2. 戻り値 elements を JSON 化して件数・各要素のプロパティを走査する
- **期待結果**: elements.length == 12、root.text=='組み込み設計' かつ shape=='circle'、MCU.shape=='square' かつ label=='ARM Cortex-M4'、テスト ノードの icon=='fa fa-flask'
- **合否判定**:
  - PASS: 全条件一致
  - FAIL: 件数不一致または 1 件以上のプロパティ不一致
- **備考**: —

### TC-003 (対応評価ID: EV-003)
- **目的**: root ノード `((text))` が最上位ノードとして識別されることを確認する
- **準備物**: mindmap parse API
- **事前条件**: なし
- **手順**:
  1. 入力 `mindmap\n  root((X))` を parse する
  2. 戻り値 elements[0] を取得する
- **期待結果**: elements[0] == `{kind:'node', parentId:null, level:0, shape:'circle', text:'X', ...}`
- **合否判定**:
  - PASS: 4 プロパティ全一致
  - FAIL: 1 つ以上のプロパティ不一致
- **備考**: —

### TC-004 (対応評価ID: EV-004)
- **目的**: インデント差が parentId と level に反映されることを確認する
- **準備物**: mindmap parse API
- **事前条件**: なし
- **手順**:
  1. 入力 `mindmap\n  root((R))\n    A\n      B` を parse する
  2. 各 element の parentId と level を取得する
- **期待結果**: R.level==0 / R.parentId==null、A.level==1 / A.parentId==R.id、B.level==2 / B.parentId==A.id
- **合否判定**:
  - PASS: 全 6 プロパティ一致
  - FAIL: 1 つ以上不一致
- **備考**: —

### TC-005 (対応評価ID: EV-005)
- **目的**: 6 種の shape 表記が識別されることを確認する
- **準備物**: mindmap parse API
- **事前条件**: なし
- **手順**:
  1. 入力 `mindmap\n  root((R))\n    A\n    [B]\n    (C)\n    ((D))\n    ))E((\n    )F(\n    {{G}}` を parse する
  2. A〜G の shape を取得する
- **期待結果**: A==default、B==square、C==rounded、D==circle、E==bang、F==cloud、G==hexagon
- **合否判定**:
  - PASS: 7 ケース全一致
  - FAIL: 1 件以上不一致
- **備考**: —

### TC-006 (対応評価ID: EV-006)
- **目的**: icon 構文が親ノードの icon プロパティに集約されることを確認する
- **準備物**: mindmap parse API
- **事前条件**: なし
- **手順**:
  1. 入力 `mindmap\n  root((R))\n    テスト\n      ::icon(fa fa-flask)` を parse する
  2. 戻り値 elements の件数と テスト ノードの icon を取得する
- **期待結果**: elements.length==2(R と テスト のみ)、テスト ノード.icon=='fa fa-flask'
- **合否判定**:
  - PASS: 両条件一致
  - FAIL: icon 行が独立 element として追加されている or icon 値不一致
- **備考**: —

### TC-007 (対応評価ID: EV-007)
- **目的**: `:::className` が parse されるが UI 編集欄には現れないことを確認する
- **準備物**: mindmap parse API、ブラウザ、mermaid-assist.html
- **事前条件**: アプリ起動、図種=mindmap
- **手順**:
  1. エディタに `mindmap\n  root((R))\n    A:::warn` を入力する
  2. A ノードを選択し、詳細パネル DOM を取得する
  3. parse 戻り値の A ノード.class を取得する
- **期待結果**: A.class=='warn'、詳細パネル内に class 編集用 input/select が 0 件
- **合否判定**:
  - PASS: 両条件一致
  - FAIL: いずれかが不一致
- **備考**: —

### TC-008 (対応評価ID: EV-008)
- **目的**: add-child 実行で子行が挿入されることを確認する
- **準備物**: mindmap updater API
- **事前条件**: 入力 `mindmap\n  root((R))\n    A`、選択ノード=A
- **手順**:
  1. add-child を実行し、新規テキスト `X` を渡す
  2. 書き戻し後の Mermaid テキストを取得する
- **期待結果**: A 行の直後に `      X`(A より +2 インデント)の 1 行が挿入される
- **合否判定**:
  - PASS: 挿入行が期待文字列と一致
  - FAIL: インデント不一致 or 挿入位置不一致
- **備考**: —

### TC-009 (対応評価ID: EV-009)
- **目的**: add-sibling で兄弟行が挿入されることを確認する
- **準備物**: mindmap updater API
- **事前条件**: 入力 `mindmap\n  root((R))\n    A\n      A1\n    B`、選択ノード=A
- **手順**:
  1. add-sibling を実行し、新規テキスト `X` を渡す
  2. 書き戻し後の Mermaid テキストを取得する
- **期待結果**: A+A1 ブロック末尾直後に `    X`(A と同インデント)の 1 行が挿入され、B より前に位置する
- **合否判定**:
  - PASS: 挿入位置とインデントが期待通り
  - FAIL: 挿入位置が A1 より前 or B より後 or インデント不一致
- **備考**: —

### TC-010 (対応評価ID: EV-010)
- **目的**: indent 操作でインデントが +2 されることを確認する
- **準備物**: mindmap updater API
- **事前条件**: 入力 `mindmap\n  root((R))\n    A\n      A1\n    B`、選択ノード=B
- **手順**:
  1. indent を実行する
  2. 書き戻し後の B 行の先頭空白数を取得する
- **期待結果**: B 行の先頭空白数が 4 → 6 に増加(A の子になる)
- **合否判定**:
  - PASS: 空白数 == 6
  - FAIL: 空白数 != 6
- **備考**: —

### TC-011 (対応評価ID: EV-011)
- **目的**: outdent 操作でインデントが -2 されることと、level==1 で no-op であることを確認する
- **準備物**: mindmap updater API
- **事前条件**: 入力 `mindmap\n  root((R))\n    A\n      A1\n        A1a`、選択ノード=A1a
- **手順**:
  1. outdent を A1a に対して実行、書き戻し後の A1a 行先頭空白数を取得
  2. 次に outdent を A(level==1)に対して実行、書き戻し後の A 行先頭空白数を取得
- **期待結果**: 手順1 後 A1a の先頭空白数 6、手順2 後 A の先頭空白数 4(変化なし)
- **合否判定**:
  - PASS: 両観測一致
  - FAIL: 1 つ以上不一致
- **備考**: —

### TC-012 (対応評価ID: EV-012)
- **目的**: update-text-shape-icon の 3 フィールド書き換えを確認する
- **準備物**: mindmap updater API
- **事前条件**: 入力 `mindmap\n  root((R))\n    A\n      ::icon(fa fa-x)`、選択ノード=A
- **手順**:
  1. A の text を `B`、shape を `square`、icon を `fa fa-y` に更新する
  2. 書き戻し後テキストを取得する
- **期待結果**: A 行が `    [B]`、icon 子行が `      ::icon(fa fa-y)` に置換される
- **合否判定**:
  - PASS: 両行が期待通り
  - FAIL: いずれかが未置換 or 誤置換
- **備考**: —

### TC-013 (対応評価ID: EV-013)
- **目的**: delete で対象ノードとその子孫が削除されることを確認する
- **準備物**: mindmap updater API
- **事前条件**: 入力 `mindmap\n  root((R))\n    A\n      A1\n        A1a\n    B`、選択ノード=A
- **手順**:
  1. delete を実行する
  2. 書き戻し後テキストの各行を抽出する
- **期待結果**: 残存行は `mindmap`, `  root((R))`, `    B` の 3 行のみ
- **合否判定**:
  - PASS: 行一覧完全一致
  - FAIL: 余分な行または欠落
- **備考**: —

### TC-014 (対応評価ID: EV-014)
- **目的**: moveUp / moveDown で隣接兄弟ブロックと順序入替されることを確認する
- **準備物**: mindmap updater API
- **事前条件**: 入力 `mindmap\n  root((R))\n    A\n      A1\n    B\n      B1`
- **手順**:
  1. A を選択し moveDown を実行、書き戻しテキストの `    ` 直下兄弟順を取得
  2. 末尾兄弟 A(手順1で末尾に移動後)に moveDown を再実行、書き戻しテキスト取得
- **期待結果**: 手順1 後の兄弟順 = `B, B1, A, A1`、手順2 後は変化なし(no-op)
- **合否判定**:
  - PASS: 両観測一致
  - FAIL: 1 件以上不一致
- **備考**: —

### TC-015 (対応評価ID: EV-015)
- **目的**: connect operation が公開されていないことを確認する
- **準備物**: ブラウザ、mermaid-assist.html、mindmap 図種選択
- **事前条件**: アプリ起動、図種=mindmap
- **手順**:
  1. DevTools Console で `window.MA.modules.mindmap.operations.connect` を評価する
  2. UI をスキャンし button 要素のラベル一覧を抽出する
- **期待結果**: `operations.connect` == undefined、button ラベル一覧に `connect` / `接続` / `矢印追加` が 0 件
- **合否判定**:
  - PASS: 両観測一致
  - FAIL: 定義あり or 該当ボタン存在
- **備考**: —

### TC-016 (対応評価ID: EV-016)
- **目的**: `src/modules/mindmap.js` の存在と HTML からの参照を確認する
- **準備物**: リポジトリ、grep
- **事前条件**: リポジトリを E:\00_Git\05_MermaidAssist でチェックアウト済
- **手順**:
  1. `ls E:\00_Git\05_MermaidAssist\src\modules\mindmap.js` を実行
  2. `grep -n "src/modules/mindmap.js" mermaid-assist.html` を実行
- **期待結果**: 手順1 でファイル存在(exit 0)、手順2 で 1 行以上マッチ
- **合否判定**:
  - PASS: 両条件一致
  - FAIL: ファイル不在 or HTML 参照なし
- **備考**: —

### TC-017 (対応評価ID: EV-017)
- **目的**: parse 木構造の妥当性(循環なし、level 整合)を確認する
- **準備物**: mindmap parse API
- **事前条件**: なし
- **手順**:
  1. 仕様書サンプル構文を parse する
  2. 各 element について parentId チェーンを root まで辿り、訪問集合を記録
  3. 各 element.level と親.level+1 を比較する
- **期待結果**: 全 element が root(parentId==null)に到達、訪問集合に重複なし、level == parent.level + 1(root は 0)
- **合否判定**:
  - PASS: 全 3 条件成立
  - FAIL: 循環検出 or level 不整合 or 到達不能
- **備考**: —

### TC-018 (対応評価ID: EV-018)
- **目的**: 各 element のフィールド構成を確認する
- **準備物**: mindmap parse API
- **事前条件**: なし
- **手順**:
  1. 仕様書サンプル構文を parse する
  2. 各 element について kind / id / text / shape / parentId / level / icon / line の型と値を検査する
  3. id 一意性を Set サイズで確認する
- **期待結果**: 全 element で kind=='node'、id は文字列で一意、text は文字列、shape は 6 種のいずれか、parentId は文字列 or null、level は 0 以上の整数、icon は文字列、line は 0 以上の整数
- **合否判定**:
  - PASS: 全 element が全条件成立
  - FAIL: 1 件以上条件違反
- **備考**: —

### TC-019 (対応評価ID: EV-019)
- **目的**: relations フィールドが空配列であることを確認する
- **準備物**: mindmap parse API
- **事前条件**: なし
- **手順**:
  1. 仕様書サンプル構文を parse する
  2. 戻り値の relations プロパティを取得する
- **期待結果**: `Array.isArray(result.relations) == true` かつ `result.relations.length == 0`
- **合否判定**:
  - PASS: 両条件成立
  - FAIL: 非配列 or length > 0
- **備考**: —

### TC-020 (対応評価ID: EV-020)
- **目的**: Add 追加フォームの構成要素を確認する
- **準備物**: ブラウザ、mermaid-assist.html
- **事前条件**: アプリ起動、図種=mindmap、既存ノード 2 件以上
- **手順**:
  1. Add フォーム領域の DOM を取得する
  2. 子要素種別とボタンラベル、Shape セレクタの option 数を列挙する
  3. 領域の CSS `flex-direction` もしくは要素の行配置を取得する
- **期待結果**: `<select>`(親ノード用), `<input type=text>`(Text), `<select>`(Shape, option 6 件), button `+ 子追加` の 4 要素が存在、配置が縦並び(flex-direction:column or 各要素が独立ブロック行)
- **合否判定**:
  - PASS: 4 要素全存在、option==6、縦並び成立
  - FAIL: 1 件以上不成立
- **備考**: —

### TC-021 (対応評価ID: EV-021)
- **目的**: Add sibling フォームの表示条件を確認する
- **準備物**: ブラウザ、mermaid-assist.html
- **事前条件**: アプリ起動、図種=mindmap、ノード複数件定義済
- **手順**:
  1. ノード未選択状態で Add sibling フォームの可視性を検査する
  2. 任意ノードを選択し、同フォームの可視性と構成要素を検査する
- **期待結果**: 未選択時は display:none もしくは DOM 不在、選択時は `<input>`, `<select>`, button `+ 兄弟追加` が表示
- **合否判定**:
  - PASS: 両シナリオ期待通り
  - FAIL: 未選択時に表示 or 選択時に非表示 or 要素不足
- **備考**: —

### TC-022 (対応評価ID: EV-022)
- **目的**: ノード一覧の tree 表示(インデント視覚化)を確認する
- **準備物**: ブラウザ、mermaid-assist.html
- **事前条件**: 仕様書サンプル構文をエディタに投入
- **手順**:
  1. ノード一覧 DOM の各行について computed style の margin-left または padding-left を取得する
  2. 各行の level と取得値の対応を表にする
- **期待結果**: 同一実装定数 X > 0 に対し、各行のオフセットが level × X px に一致する(level 0 で 0、level 1 で X、level 2 で 2X)
- **合否判定**:
  - PASS: 全行が level×X に一致
  - FAIL: 1 件以上不一致
- **備考**: —

### TC-023 (対応評価ID: EV-023)
- **目的**: 詳細パネルの構成要素 8 種を確認する
- **準備物**: ブラウザ、mermaid-assist.html
- **事前条件**: 任意ノードを選択
- **手順**:
  1. 詳細パネル DOM を取得する
  2. 子要素を列挙し、Text 入力・Shape セレクタ・Icon 入力・indent ボタン・outdent ボタン・削除ボタン・↑ ボタン・↓ ボタンの存在を検証する
- **期待結果**: 8 要素全てが 1 件以上存在
- **合否判定**:
  - PASS: 8/8 存在
  - FAIL: 1 件以上不在
- **備考**: —

### TC-024 (対応評価ID: EV-024)
- **目的**: Unit テストの件数と観点網羅を確認する
- **準備物**: tests/ 配下、grep
- **事前条件**: なし
- **手順**:
  1. `tests/` 配下の mindmap 関連 unit テストファイルを抽出
  2. test 関数宣言(`test(` または `it(` など)の件数を集計
  3. 各観点キーワード(indent levels / shapes / icon / add / indent / outdent / delete / move)を grep し出現件数を集計
- **期待結果**: test 件数 13 以上 17 以下、各観点キーワード毎に 1 件以上マッチ
- **合否判定**:
  - PASS: 両条件成立
  - FAIL: 件数範囲外 or 観点欠落
- **備考**: —

### TC-025 (対応評価ID: EV-025)
- **目的**: E2E テスト ID E49-E56 の 8 件定義を確認する
- **準備物**: tests/e2e/、grep
- **事前条件**: なし
- **手順**:
  1. `grep -nE "E(49|50|51|52|53|54|55|56)" tests/` を実行
  2. 各 ID が test 定義内に存在することを確認する
- **期待結果**: E49, E50, E51, E52, E53, E54, E55, E56 の各 ID が少なくとも 1 件ずつ test 定義とマッチ
- **合否判定**:
  - PASS: 8/8 存在
  - FAIL: 1 件以上欠落
- **備考**: —

### TC-026 (対応評価ID: EV-026)
- **目的**: visual sweep の 8 パターン(default+6 shape+icon)網羅を確認する
- **準備物**: visual sweep 実行スクリプト、スクショ出力ディレクトリ
- **事前条件**: visual sweep を実行済
- **手順**:
  1. スクショ出力ディレクトリを走査し、default / square / rounded / circle / bang / cloud / hexagon / icon を含むファイル名のスクショ件数を集計する
  2. 実行レポートの error カウントを取得する
- **期待結果**: 上記 8 キーワード毎に 1 件以上のスクショが存在、error カウント == 0
- **合否判定**:
  - PASS: 両条件成立
  - FAIL: キーワード欠落 or error > 0
- **備考**: —

### TC-027 (対応評価ID: EV-027)
- **目的**: シナリオ「組み込み設計ブレスト」の構造要件を確認する
- **準備物**: シナリオ実行スクリプト、mindmap parse API
- **事前条件**: シナリオ最終テキストを取得可能
- **手順**:
  1. シナリオ実行完了後の Mermaid テキストを parse する
  2. elements の level 分布、ブランチ数、icon プロパティ付きノード数を集計する
- **期待結果**: parse error 0、level==0 のノード 1 件、level==1 のノード 2 件以上、level==2 のノード 1 件以上、icon!='' のノードが 1 件以上
- **合否判定**:
  - PASS: 全条件成立
  - FAIL: 1 件以上不成立
- **備考**: —

### TC-028 (対応評価ID: EV-028a)
- **目的**: 最終ゲート(全テスト PASS / visual sweep 0 error)を確認する
- **準備物**: PC、コマンドライン、リポジトリ
- **事前条件**: v1.6.0 リリース候補ビルドを取得済
- **手順**:
  1. `npm run test:all` を実行し exit code を記録する
  2. visual sweep レポートの error カウントを取得する
- **期待結果**: exit code == 0、error カウント == 0
- **合否判定**:
  - PASS: 両条件成立
  - FAIL: いずれか不成立
- **備考**: REQ-028 のうち ECN-017 と v1.6.0 tag の検証は TC-029 に分離

### TC-029 (対応評価ID: EV-028b)
- **目的**: ECN-017 ドキュメントと v1.6.0 tag の存在を確認する
- **準備物**: リポジトリ、git
- **事前条件**: リモートと同期済
- **手順**:
  1. `ls docs/` で ECN-017 を含むファイル名を検索する
  2. `git tag --list v1.6.0` を実行する
- **期待結果**: ECN-017 を含むファイルが 1 件以上、`git tag` 出力に `v1.6.0` が 1 件含まれる
- **合否判定**:
  - PASS: 両条件成立
  - FAIL: いずれか不成立
- **備考**: —

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
| REQ-028 | EV-028a, EV-028b | TC-028, TC-029 |

## 6. カバレッジ自己検査結果
- 要件→評価項目カバレッジ: 28/28 (100%)
- 評価項目→テストタスクカバレッジ: 29/29 (100%)
- 禁止語検出: 0件
- 重複評価項目: 0件
