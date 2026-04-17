# システムテスト仕様書: Tier2 Phase 5: Gitgraph

## 0. メタ情報
- **対象仕様書**: E:\00_Git\05_MermaidAssist\docs\superpowers\specs\2026-04-17-tier2-phase5-gitgraph-design.md
- **生成日時**: 2026-04-17 13:14:43
- **生成エージェント**: system-tester
- **要件件数**: 25
- **評価項目件数**: 25
- **テストタスク件数**: 25

## 1. 未確定事項

なし (カバレッジ自己検査結果: 要件→評価項目 100%、評価項目→テストタスク 100%、禁止語 0件、重複 0件)。

## 2. 要件抽出結果

| 要件ID | 仕様書該当箇所 | 要件内容 | 種別 |
|---|---|---|---|
| REQ-001 | ゴール | Mermaid Gitgraph (`gitGraph`) を Tier1 同等粒度で対応すること | 機能 |
| REQ-002 | スコープ/対応要素 commit | `commit` は id (任意), type (NORMAL/REVERSE/HIGHLIGHT), tag (任意) を属性として保持すること | 入出力 |
| REQ-003 | スコープ/対応要素 branch | `branch <name>` で branch 作成・切替を行うこと | 機能 |
| REQ-004 | スコープ/対応要素 checkout | `checkout <name>` でブランチ切替を行うこと | 機能 |
| REQ-005 | スコープ/対応要素 merge | `merge <name> [tag:"x"] [type:HIGHLIGHT]` でブランチマージを表現すること | 入出力 |
| REQ-006 | スコープ/対応要素 cherry-pick | `cherry-pick id:"x"` で既存 commit をピックアップ表現すること | 入出力 |
| REQ-007 | 対応 operations | `add-commit` が現在 HEAD ブランチに commit を追加し、id/type/tag を指定可能であること | 機能 |
| REQ-008 | 対応 operations | `add-branch` が branch 作成行を追加すること | 機能 |
| REQ-009 | 対応 operations | `add-checkout` が checkout 行を追加すること | 機能 |
| REQ-010 | 対応 operations | `add-merge` が merge 行を追加すること | 機能 |
| REQ-011 | 対応 operations | `add-cherry-pick` が cherry-pick 行を追加すること | 機能 |
| REQ-012 | 対応 operations | `update-commit` が id/type/tag を書き換えること | 機能 |
| REQ-013 | 対応 operations | `delete` が任意行を削除すること | 機能 |
| REQ-014 | 対応 operations | `moveUp / moveDown` が行順序入替を行うこと | 機能 |
| REQ-015 | 対応 operations | `connect` は提供しないこと (Git 操作は専用 merge / cherry-pick で表現) | 機能 |
| REQ-016 | 対象外 | ブランチ表示色指定 (`%%{init: ...}%%`) は対象外であること | 機能 |
| REQ-017 | 対象外 | 複雑な commit message 編集は対象外で、`commit` は id/type/tag のみであること | 機能 |
| REQ-018 | アーキテクチャ | `src/modules/gitgraph.js` を新規モジュールとして配置すること | インターフェース |
| REQ-019 | アーキテクチャ | 各行を kind='commit'/'branch'/'checkout'/'merge'/'cherry-pick' として要素化すること | 入出力 |
| REQ-020 | アーキテクチャ | parse は逐次処理し、現在ブランチを track すること | 機能 |
| REQ-021 | データモデル | elements 配列の各要素が仕様書記載のフィールド構造 (kind 毎に commit: id/commitType/tag/branch/line、branch: name/fromBranch/line、checkout: target/line、merge: target/tag/mergeType/line、cherry-pick: id/line) を満たすこと | 入出力 |
| REQ-022 | UI | 追加フォームは 5 種 (Add Commit / Add Branch / Add Checkout / Add Merge / Add Cherry-pick) を縦並びラベル付きで配置すること | インターフェース |
| REQ-023 | UI | 詳細パネルで各行が編集可能かつ削除可能であること | インターフェース |
| REQ-024 | 対応 operations 注記 | `moveUp/moveDown` は構文的に意味が変わる可能性があるため、同一ブランチ内 commit 順序入替を推奨する警告を提示すること | インターフェース |
| REQ-025 | 完了基準 | 全テスト PASS、system-tester 100%、visual sweep 0 error、GitFlow シナリオ (main + develop + feature + release の4ブランチ構成) PASS、ECN-018、v1.7.0 tag を満たすこと | 非機能 |

## 3. 評価項目

| 評価ID | 対応要件ID | 評価観点 | 観測対象 | 判定基準 |
|---|---|---|---|---|
| EV-001 | REQ-001 | `gitGraph` ヘッダを含む入力がモジュールで解析され要素化されるか | `src/modules/gitgraph.js` の parse 戻り値 | 構文サンプル (1〜15行) 投入時に elements.length が 10 となり、Tier1 モジュールと同種の `{meta, elements, relations}` オブジェクト構造を返す |
| EV-002 | REQ-002 | commit 属性 id/type/tag が要素に反映されるか | parse 後の commit 要素 | `commit id: "init"` → `{kind:'commit', id:'init', commitType:'NORMAL', tag:''}`、`commit type: HIGHLIGHT tag: "milestone"` → `commitType:'HIGHLIGHT', tag:'milestone'` |
| EV-003 | REQ-003 | `branch <name>` 行でブランチ要素が作成され現在ブランチが遷移するか | parse 後の branch 要素と後続 commit の branch 値 | `branch develop` 要素 `{kind:'branch', name:'develop', fromBranch:'main'}` が生成され、直後の commit 要素の branch が `'develop'` |
| EV-004 | REQ-004 | `checkout <name>` でブランチ切替要素が生成されるか | parse 後の checkout 要素 | `checkout develop` → `{kind:'checkout', target:'develop'}`、以降の commit の branch が `'develop'` |
| EV-005 | REQ-005 | merge 行が target/tag/mergeType を保持して要素化されるか | parse 後の merge 要素 | `merge feature-login` → `{kind:'merge', target:'feature-login', tag:'', mergeType:'NORMAL'}`、`merge develop tag: "v1.0"` → `tag:'v1.0'` |
| EV-006 | REQ-006 | cherry-pick 行が id を保持して要素化されるか | parse 後の cherry-pick 要素 | `cherry-pick id: "v0.1"` → `{kind:'cherry-pick', id:'v0.1'}` |
| EV-007 | REQ-007 | `add-commit` 操作で現在 HEAD ブランチの commit 行がテキスト末尾に追加されるか | operations('add-commit', {id,type,tag}) 実行後の Mermaidテキスト | `id:'x', type:'HIGHLIGHT', tag:'t'` 指定時、末尾に `    commit id: "x" type: HIGHLIGHT tag: "t"` が追記され、elements の commit.branch が直前の HEAD ブランチ名と等しい |
| EV-008 | REQ-008 | `add-branch` 操作で branch 行が追加され現在ブランチ扱いになるか | operations('add-branch', {name}) 実行後のテキストと parse 結果 | 末尾に `    branch <name>` が追記され、parse 後の branch 要素に `{name:<name>, fromBranch:<呼出前HEAD>}` が含まれる |
| EV-009 | REQ-009 | `add-checkout` 操作で checkout 行が追加されるか | operations('add-checkout', {target}) 実行後のテキスト | 末尾に `    checkout <target>` が追記され、parse 後の checkout 要素に `{target:<target>}` が含まれる |
| EV-010 | REQ-010 | `add-merge` 操作で merge 行が追加されるか | operations('add-merge', {target,tag}) 実行後のテキスト | 末尾に `    merge <target>` (tag 指定時は ` tag: "<tag>"` 付加) が追記され、parse 後の merge 要素の target/tag が一致 |
| EV-011 | REQ-011 | `add-cherry-pick` 操作で cherry-pick 行が追加されるか | operations('add-cherry-pick', {id}) 実行後のテキスト | 末尾に `    cherry-pick id: "<id>"` が追記され、parse 後の cherry-pick 要素の id が一致 |
| EV-012 | REQ-012 | `update-commit` 操作で既存 commit の id/type/tag が書き換わるか | operations('update-commit', {line,id,type,tag}) 実行後の commit 要素 | 指定 line の commit 要素の id/commitType/tag が呼出引数と完全一致し、他要素は不変 |
| EV-013 | REQ-013 | `delete` 操作で指定行が削除されるか | operations('delete', {line}) 実行後の行数 | 実行後の Mermaidテキスト行数 = 呼出前行数 - 1、かつ該当 line の要素が elements から消失 |
| EV-014 | REQ-014 | `moveUp` / `moveDown` 操作で隣接行が入替わるか | operations('moveUp'/'moveDown', {line}) 実行後の行順序 | `moveUp` 実行後、元 line の内容が line-1 に、`moveDown` 実行後、元 line の内容が line+1 に存在する |
| EV-015 | REQ-015 | `connect` 操作は未提供であることを確認 | operations 呼出 | `operations('connect', ...)` が未定義エラー/未サポート応答を返し、テキストが変化しない |
| EV-016 | REQ-016 | `%%{init: ...}%%` 色指定はモジュールで解釈しない | parse 戻り値 | `%%{init:{'gitGraph':{'mainBranchName':'x'}}}%%` を含む入力でも elements が通常通り構築され、meta に色/init の独自キーが追加されない |
| EV-017 | REQ-017 | commit は id/type/tag 以外の属性 (message 等) をサポートしないこと | parse および add-commit オプション | `commit msg: "hello"` 等の未サポート属性を含む入力で、commit 要素に `msg` フィールドが生成されない (id/commitType/tag/branch/line のみ) |
| EV-018 | REQ-018 | `src/modules/gitgraph.js` が存在しモジュール登録されること | ファイルシステムと window.MA.modules | `src/modules/gitgraph.js` が存在し、ロード後 `window.MA.modules.gitgraph` が DiagramModule v2 インターフェースを実装している (parse/serialize/operations を関数として公開) |
| EV-019 | REQ-019 | 要素の kind 値が5種のみに限定されるか | parse 後 elements の kind 集合 | 構文サンプル全行を parse 後、`new Set(elements.map(e=>e.kind))` が `{'commit','branch','checkout','merge','cherry-pick'}` の部分集合 |
| EV-020 | REQ-020 | parse が逐次的に現在ブランチ track するか | parse 途中のブランチ推移 | 構文サンプル parse 後、`branch feature-login` 以降 `checkout develop` までの commit 要素が branch='feature-login'、その後 `checkout develop` 以降の要素が branch='develop' |
| EV-021 | REQ-021 | 各 kind の要素フィールドが仕様書のデータモデル記述と一致するか | parse 後 elements の各要素キー集合 | commit 要素のキー集合=`{kind,id,commitType,tag,branch,line}`、branch 要素=`{kind,name,fromBranch,line}`、checkout 要素=`{kind,target,line}`、merge 要素=`{kind,target,tag,mergeType,line}`、cherry-pick 要素=`{kind,id,line}` |
| EV-022 | REQ-022 | UI に 5 種類の追加フォームが縦並びラベル付きで配置されているか | DOM 構造 (Add パネル) | Gitgraph 選択時、Add セクション内に Add Commit / Add Branch / Add Checkout / Add Merge / Add Cherry-pick の 5 フォームが `flex-direction:column` または順序通りにブロック配置され、各フォームに対応する `<label>` 要素が存在 |
| EV-023 | REQ-023 | 詳細パネルで各行の編集と削除が可能か | 詳細パネル DOM と operations 呼出 | 任意 elements の行を選択時、詳細パネルに編集可能フィールド (commit: id/type/tag、branch: name、checkout: target、merge: target/tag、cherry-pick: id) および Delete ボタンが表示され、Delete クリックで当該 line 要素が消失 |
| EV-024 | REQ-024 | moveUp/moveDown 時に警告が提示されるか | 操作実行時の UI 通知またはコンソール警告 | moveUp/moveDown 実行時、同一ブランチ内 commit 以外の行 (branch/checkout/merge/cherry-pick) を対象にすると、UI 通知またはコンソールに「構文的に意味が変わる可能性」相当のメッセージ (`gitgraph moveUp/moveDown: syntactic meaning may change` 等 moveUp/moveDown 警告文字列) が1件出力される |
| EV-025 | REQ-025 | GitFlow 4ブランチシナリオが全項目 PASS するか | テスト実行結果と visual sweep 出力 | main/develop/feature/release 4ブランチを含む入力で Unit テスト全 PASS、E57-E66 E2E 全 PASS、visual sweep error 0 件、ECN-018 が commits 履歴に存在、v1.7.0 tag が git tag 一覧に存在 |

## 4. テストタスク

### TC-001 (対応評価ID: EV-001)
- **目的**: Gitgraph モジュールが構文サンプルを要素化することを確認する
- **準備物**: Node.js 実行環境、`tests/run-tests.js`、仕様書構文サンプル
- **事前条件**:
  - `src/modules/gitgraph.js` がロード済
  - window.MA.modules.gitgraph.parse が利用可能
- **手順**:
  1. 仕様書「構文サンプル」コードブロック (gitGraph 〜 cherry-pick id: "v0.1") を文字列として parse に渡す
  2. 戻り値のキー集合と elements.length を取得する
- **期待結果**: 戻り値のキー集合に `meta`, `elements`, `relations` が含まれ、elements.length == 10
- **合否判定**:
  - PASS: 上記2条件すべて満たす
  - FAIL: キー不足、または elements.length != 10
- **備考**: —

### TC-002 (対応評価ID: EV-002)
- **目的**: commit 属性 id/type/tag が保持されることを確認する
- **準備物**: Node.js + parse 関数
- **事前条件**: parse 関数が利用可能
- **手順**:
  1. `gitGraph\n    commit id: "init"\n    commit type: HIGHLIGHT tag: "milestone"\n` を parse
  2. elements[0] と elements[1] を取得
- **期待結果**: elements[0] = `{kind:'commit', id:'init', commitType:'NORMAL', tag:''...}`、elements[1] = `{kind:'commit', commitType:'HIGHLIGHT', tag:'milestone'...}`
- **合否判定**:
  - PASS: id/commitType/tag すべて上記と一致
  - FAIL: いずれか不一致
- **備考**: —

### TC-003 (対応評価ID: EV-003)
- **目的**: branch 要素生成と現在ブランチ遷移を確認する
- **準備物**: parse 関数
- **事前条件**: 無し
- **手順**:
  1. `gitGraph\n    commit\n    branch develop\n    commit\n` を parse
  2. elements[1] と elements[2] を取得
- **期待結果**: elements[1] = `{kind:'branch', name:'develop', fromBranch:'main'...}`、elements[2].branch == 'develop'
- **合否判定**:
  - PASS: name/fromBranch/後続branch 一致
  - FAIL: いずれか不一致
- **備考**: —

### TC-004 (対応評価ID: EV-004)
- **目的**: checkout によるブランチ切替を確認する
- **準備物**: parse 関数
- **事前条件**: 無し
- **手順**:
  1. `gitGraph\n    commit\n    branch develop\n    checkout develop\n    commit\n    checkout main\n    commit\n` を parse
  2. checkout 要素と checkout 後の commit の branch を取得
- **期待結果**: 2 番目の checkout 要素 `{kind:'checkout', target:'main'}`、最後の commit の branch == 'main'
- **合否判定**:
  - PASS: target と後続 commit.branch が一致
  - FAIL: 不一致
- **備考**: —

### TC-005 (対応評価ID: EV-005)
- **目的**: merge 要素の target/tag/mergeType 保持を確認する
- **準備物**: parse 関数
- **事前条件**: 無し
- **手順**:
  1. `gitGraph\n    commit\n    branch develop\n    commit\n    checkout main\n    merge develop tag: "v1.0"\n` を parse
  2. merge 要素を取得
- **期待結果**: `{kind:'merge', target:'develop', tag:'v1.0', mergeType:'NORMAL'...}`
- **合否判定**:
  - PASS: 4 フィールドすべて一致
  - FAIL: 1つでも不一致
- **備考**: —

### TC-006 (対応評価ID: EV-006)
- **目的**: cherry-pick 要素の id 保持を確認する
- **準備物**: parse 関数
- **事前条件**: 無し
- **手順**:
  1. `gitGraph\n    commit id: "v0.1"\n    branch x\n    commit\n    cherry-pick id: "v0.1"\n` を parse
  2. cherry-pick 要素を取得
- **期待結果**: `{kind:'cherry-pick', id:'v0.1'...}`
- **合否判定**:
  - PASS: kind と id が一致
  - FAIL: 不一致
- **備考**: —

### TC-007 (対応評価ID: EV-007)
- **目的**: add-commit が HEAD ブランチに commit 行を追加することを確認する
- **準備物**: operations API、parse 関数
- **事前条件**: `gitGraph\n    commit\n    branch develop\n` が現在テキスト、HEAD=develop
- **手順**:
  1. `operations('add-commit', {id:'x', type:'HIGHLIGHT', tag:'t'})` を実行
  2. 実行後テキスト末尾行と再 parse 後の最後の commit.branch を取得
- **期待結果**: 末尾行 = `    commit id: "x" type: HIGHLIGHT tag: "t"`、最後の commit.branch == 'develop'
- **合否判定**:
  - PASS: 両条件一致
  - FAIL: いずれか不一致
- **備考**: —

### TC-008 (対応評価ID: EV-008)
- **目的**: add-branch が branch 行を追加することを確認する
- **準備物**: operations API
- **事前条件**: `gitGraph\n    commit\n` が現在テキスト、HEAD=main
- **手順**:
  1. `operations('add-branch', {name:'feature'})` を実行
  2. 末尾行および parse 後の branch 要素を取得
- **期待結果**: 末尾行 = `    branch feature`、parse 後に `{kind:'branch', name:'feature', fromBranch:'main'}` が存在
- **合否判定**:
  - PASS: 両条件一致
  - FAIL: 不一致
- **備考**: —

### TC-009 (対応評価ID: EV-009)
- **目的**: add-checkout が checkout 行を追加することを確認する
- **準備物**: operations API
- **事前条件**: `gitGraph\n    commit\n    branch develop\n` が現在テキスト
- **手順**:
  1. `operations('add-checkout', {target:'develop'})` を実行
  2. 末尾行および parse 後の checkout 要素を取得
- **期待結果**: 末尾行 = `    checkout develop`、checkout 要素 `{kind:'checkout', target:'develop'}` が存在
- **合否判定**:
  - PASS: 両条件一致
  - FAIL: 不一致
- **備考**: —

### TC-010 (対応評価ID: EV-010)
- **目的**: add-merge が merge 行を追加することを確認する
- **準備物**: operations API
- **事前条件**: `gitGraph\n    commit\n    branch develop\n    commit\n    checkout main\n` が現在テキスト
- **手順**:
  1. `operations('add-merge', {target:'develop', tag:'v1.0'})` を実行
  2. 末尾行および parse 後の merge 要素を取得
- **期待結果**: 末尾行 = `    merge develop tag: "v1.0"`、merge 要素の target='develop' tag='v1.0'
- **合否判定**:
  - PASS: 両条件一致
  - FAIL: 不一致
- **備考**: —

### TC-011 (対応評価ID: EV-011)
- **目的**: add-cherry-pick が cherry-pick 行を追加することを確認する
- **準備物**: operations API
- **事前条件**: `gitGraph\n    commit id: "a"\n    branch x\n    commit\n` が現在テキスト
- **手順**:
  1. `operations('add-cherry-pick', {id:'a'})` を実行
  2. 末尾行および parse 後の cherry-pick 要素を取得
- **期待結果**: 末尾行 = `    cherry-pick id: "a"`、cherry-pick 要素の id='a'
- **合否判定**:
  - PASS: 両条件一致
  - FAIL: 不一致
- **備考**: —

### TC-012 (対応評価ID: EV-012)
- **目的**: update-commit が id/type/tag を書き換えることを確認する
- **準備物**: operations API
- **事前条件**: `gitGraph\n    commit id: "old"\n` が現在テキスト (line=2 が commit)
- **手順**:
  1. `operations('update-commit', {line:2, id:'new', type:'REVERSE', tag:'rev'})` を実行
  2. parse 後の commit 要素を取得
- **期待結果**: commit 要素 id='new', commitType='REVERSE', tag='rev'
- **合否判定**:
  - PASS: 3 フィールドすべて一致
  - FAIL: 1つでも不一致
- **備考**: —

### TC-013 (対応評価ID: EV-013)
- **目的**: delete で指定行が削除されることを確認する
- **準備物**: operations API
- **事前条件**: `gitGraph\n    commit\n    commit\n    commit\n` (line=2,3,4 が commit)
- **手順**:
  1. 実行前のテキスト行数 N を取得
  2. `operations('delete', {line:3})` を実行
  3. 実行後のテキスト行数 M および elements を取得
- **期待結果**: M == N-1、parse 後 elements 内に line=3 だった要素が存在しない
- **合否判定**:
  - PASS: 行数と要素消失の両条件一致
  - FAIL: いずれか不一致
- **備考**: —

### TC-014 (対応評価ID: EV-014)
- **目的**: moveUp/moveDown が行順序を入替えることを確認する
- **準備物**: operations API
- **事前条件**: `gitGraph\n    commit id: "a"\n    commit id: "b"\n` (a=line2, b=line3)
- **手順**:
  1. `operations('moveUp', {line:3})` を実行
  2. 実行後の line2 および line3 の内容を取得
  3. `operations('moveDown', {line:2})` を実行
  4. 実行後の line2 および line3 の内容を再取得
- **期待結果**: 手順2で line2=`commit id: "b"` / line3=`commit id: "a"`、手順4で line2=`commit id: "a"` / line3=`commit id: "b"` に戻る
- **合否判定**:
  - PASS: 両時点の行内容一致
  - FAIL: いずれか不一致
- **備考**: —

### TC-015 (対応評価ID: EV-015)
- **目的**: connect 操作が未提供であることを確認する
- **準備物**: operations API
- **事前条件**: `gitGraph\n    commit\n` が現在テキスト
- **手順**:
  1. `operations('connect', {from:0, to:1})` を呼出す
  2. 呼出前後のテキストを比較する
- **期待結果**: 呼出がエラー/未サポート応答を返し、テキストは呼出前と完全一致
- **合否判定**:
  - PASS: 未サポート応答かつテキスト不変
  - FAIL: 新しい行が追加される、またはテキストが変化する
- **備考**: —

### TC-016 (対応評価ID: EV-016)
- **目的**: `%%{init: ...}%%` が独自キーとして meta に取り込まれないことを確認する
- **準備物**: parse 関数
- **事前条件**: 無し
- **手順**:
  1. `%%{init:{'gitGraph':{'mainBranchName':'x'}}}%%\ngitGraph\n    commit\n` を parse
  2. 戻り値の meta キー集合と elements.length を取得
- **期待結果**: elements.length == 1、meta に `init` / `gitGraph` / `mainBranchName` 等の独自キーが追加されていない
- **合否判定**:
  - PASS: 上記条件一致
  - FAIL: meta に独自キー出現、または elements.length != 1
- **備考**: —

### TC-017 (対応評価ID: EV-017)
- **目的**: commit に id/type/tag 以外のフィールドが追加されないことを確認する
- **準備物**: parse 関数
- **事前条件**: 無し
- **手順**:
  1. `gitGraph\n    commit msg: "hello"\n` を parse
  2. commit 要素のキー集合を取得
- **期待結果**: commit 要素のキー集合が `{kind,id,commitType,tag,branch,line}` のみ (msg キーなし)
- **合否判定**:
  - PASS: キー集合一致 (msg なし)
  - FAIL: msg など未定義フィールドが混入
- **備考**: —

### TC-018 (対応評価ID: EV-018)
- **目的**: gitgraph.js モジュールの存在と DiagramModule v2 準拠を確認する
- **準備物**: ブラウザ、mermaid-assist.html
- **事前条件**: アプリを Chrome で起動済
- **手順**:
  1. `src/modules/gitgraph.js` ファイルの存在を Glob で確認
  2. ブラウザ DevTools で `typeof window.MA.modules.gitgraph.parse`, `typeof window.MA.modules.gitgraph.serialize`, `typeof window.MA.modules.gitgraph.operations` を評価
- **期待結果**: ファイル存在、3 関数すべて `'function'`
- **合否判定**:
  - PASS: ファイル存在かつ 3 関数一致
  - FAIL: ファイル欠落または 1 つでも非関数
- **備考**: —

### TC-019 (対応評価ID: EV-019)
- **目的**: elements の kind 集合が 5 種の部分集合であることを確認する
- **準備物**: parse 関数、仕様書構文サンプル
- **事前条件**: 無し
- **手順**:
  1. 構文サンプルを parse する
  2. `new Set(elements.map(e=>e.kind))` を取得
- **期待結果**: 集合 ⊆ `{'commit','branch','checkout','merge','cherry-pick'}`、かつ全 5 種が含まれる
- **合否判定**:
  - PASS: 部分集合条件 かつ 5 種すべて出現
  - FAIL: 余分な kind が混入、または 5 種未網羅
- **備考**: —

### TC-020 (対応評価ID: EV-020)
- **目的**: parse が逐次的に現在ブランチを track することを確認する
- **準備物**: parse 関数、仕様書構文サンプル
- **事前条件**: 無し
- **手順**:
  1. 構文サンプル (gitGraph 〜 cherry-pick id: "v0.1") を parse
  2. 各 commit の branch 値を順に取得
- **期待結果**: `branch feature-login` 行 (仕様書5行目相当) 以降 `checkout develop` までの commit の branch='feature-login'、`checkout develop` 以降の merge/commit の branch='develop' または 'main'、末尾 merge が branch='main'
- **合否判定**:
  - PASS: 上記ブランチ遷移が保持される
  - FAIL: branch 値が HEAD 追跡に従わない
- **備考**: —

### TC-021 (対応評価ID: EV-021)
- **目的**: 各 kind 要素のフィールド構造が仕様書と一致することを確認する
- **準備物**: parse 関数、仕様書構文サンプル
- **事前条件**: 無し
- **手順**:
  1. 構文サンプルを parse
  2. 各 kind の要素 1 件ずつのキー集合を抽出
- **期待結果**: commit=`{kind,id,commitType,tag,branch,line}`、branch=`{kind,name,fromBranch,line}`、checkout=`{kind,target,line}`、merge=`{kind,target,tag,mergeType,line}`、cherry-pick=`{kind,id,line}`
- **合否判定**:
  - PASS: 全 kind のキー集合が仕様一致
  - FAIL: 過不足キーあり
- **備考**: —

### TC-022 (対応評価ID: EV-022)
- **目的**: UI の Add フォーム 5 種が縦並びラベル付きで配置されることを確認する
- **準備物**: ブラウザ、mermaid-assist.html、Playwright MCP
- **事前条件**: アプリ起動済、Gitgraph 図を読込済
- **手順**:
  1. browser_snapshot で Add パネルの DOM を取得
  2. Add Commit / Add Branch / Add Checkout / Add Merge / Add Cherry-pick に対応する要素とそれぞれの `<label>` を列挙
  3. 親要素の `computed-style` (flex-direction または block 配置) を browser_evaluate で取得
- **期待結果**: 5 フォーム全てが出現順通り (Commit → Branch → Checkout → Merge → Cherry-pick) に配置され、各フォームに `<label>` が 1 つ以上存在、親配置が `flex-direction:column` または block 配置
- **合否判定**:
  - PASS: 5 フォーム/ラベル/配置すべて一致
  - FAIL: フォーム欠落 or ラベル不足 or 配置が横並び
- **備考**: Evaluator でスクリーンショット併用を推奨

### TC-023 (対応評価ID: EV-023)
- **目的**: 詳細パネルで各行の編集と削除が可能であることを確認する
- **準備物**: ブラウザ、Playwright MCP
- **事前条件**: Gitgraph 図を読込済、各 kind の行を最低 1 つ含む
- **手順**:
  1. commit 行を選択し、詳細パネルに id/type/tag 入力欄が存在することを browser_snapshot で確認
  2. branch 行を選択し name 入力、checkout 行で target、merge 行で target/tag、cherry-pick 行で id 入力が出現することを確認
  3. 任意行の Delete ボタンをクリックし、parse 後に当該 line の要素が消失することを確認
- **期待結果**: 全 kind の入力欄が仕様通り表示され、Delete で要素消失
- **合否判定**:
  - PASS: 入力欄網羅 + Delete 動作
  - FAIL: 入力欄欠落 or Delete 不動作
- **備考**: —

### TC-024 (対応評価ID: EV-024)
- **目的**: moveUp/moveDown で警告が提示されることを確認する
- **準備物**: ブラウザ、Playwright MCP (console 監視)
- **事前条件**: `gitGraph\n    commit\n    branch develop\n    commit\n` を読込済
- **手順**:
  1. console ログ取得を開始
  2. branch 行 (line=3) に対して moveUp 操作を UI から実行
  3. browser_console_messages でログを取得
- **期待結果**: ログまたは UI 通知に「syntactic meaning may change」相当のメッセージ (moveUp/moveDown 警告文字列) が 1 件以上存在
- **合否判定**:
  - PASS: 警告メッセージが 1 件以上
  - FAIL: 警告 0 件
- **備考**: —

### TC-025 (対応評価ID: EV-025)
- **目的**: GitFlow 4ブランチシナリオが完了基準すべて PASS することを確認する
- **準備物**: Node.js、Playwright、mermaid-assist.html、visual sweep スクリプト、git
- **事前条件**:
  - main/develop/feature/release 4ブランチを含む Gitgraph 入力ファイル配置済
  - ECN-018 commit がリポジトリ履歴に存在
  - v1.7.0 tag が作成済
- **手順**:
  1. `node tests/run-tests.js` を実行
  2. `npx playwright test -g "E5[7-9]|E6[0-6]"` で E57-E66 を実行
  3. visual sweep スクリプトを default + branches/merges/cherry-pick 4 パターンで実行
  4. `git log --oneline | grep ECN-018` と `git tag | grep v1.7.0` を実行
- **期待結果**: Unit 全 PASS、E2E E57-E66 全 PASS、visual sweep error 件数=0、grep 2 件ともヒット 1 行以上
- **合否判定**:
  - PASS: 全 4 手順一致
  - FAIL: 1 つでも失敗
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

## 6. カバレッジ自己検査結果

- 要件→評価項目カバレッジ: 25/25 (100%)
- 評価項目→テストタスクカバレッジ: 25/25 (100%)
- 禁止語検出: 0件
- 重複評価項目: 0件
