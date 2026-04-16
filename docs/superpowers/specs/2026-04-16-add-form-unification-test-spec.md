# システムテスト仕様書: MermaidAssist 追加フォーム統一

## 0. メタ情報
- **対象仕様書**: E:/00_Git/05_MermaidAssist/docs/superpowers/specs/2026-04-16-add-form-unification-design.md
- **生成日時**: 2026-04-16 23:14:59
- **生成エージェント**: system-tester
- **要件件数**: 26
- **評価項目件数**: 32
- **テストタスク件数**: 32

## 1. 未確定事項

仕様書の以下の箇所は、判定基準を一意に定めるためにさらに確認が必要な可能性があります。ただしカバレッジ自己検査(Test-6)の観点では全REQが少なくとも1件のEV/TCに紐付いており、禁止語・重複は0件です。以下は追補的な確認事項です:

- **U-1**: §4.6 「viewport 内に収まる（画面外切れ無し）」の viewport 基準サイズ(解像度・デバイス幅)が仕様書に記載されていません。本テスト仕様では property panel 幅 `220px` (§2.1 記載) を前提として、追加フォームの各 input/select が親 panel 内で `offsetWidth + offsetLeft ≤ panel.clientWidth` を満たすこと、かつブラウザ viewport 幅 `1280×720` 以上で水平スクロールバーが発生しないことを判定基準として採用しましたが、要求仕様として本値で確定してよいか確認が必要です。
- **U-2**: §4.6 「ブラウザコンソールにエラー無し（favicon 404 を除く）」における「エラー」の判定レベル(`console.error` のみか `console.warn` も含むか)が仕様書に明記されていません。本テスト仕様では `console.error` のみを対象としますが、`warn` 含有の要否を確認が必要です。
- **U-3**: §4.1〜§4.5 の「MCP スクリーンショットで構築過程の最終状態を保存」のうち、§4.6 共通合格基準では「最終状態」のみ必須とされている一方で §4.1 フル9メッセージシナリオなど中間ステップの保存要否が明示されていません。本テスト仕様では最終状態1枚のみを必須扱いとしました。

## 2. 要件抽出結果

| 要件ID | 仕様書該当箇所 | 要件内容 | 種別 |
|---|---|---|---|
| REQ-001 | §3.1 統一レイアウト | すべての「リレーション系追加フォーム」を個別編集パネルと同じ縦1列・ラベル付き・フル幅に統一すること | 機能 |
| REQ-002 | §3.1 統一レイアウト | 追加フォームに「セクションヘッダ（「メッセージを追加」/「エッジを追加」等）」が表示されること | インターフェース |
| REQ-003 | §3.1 統一レイアウト | 追加フォーム末尾に primary button として「+ 追加」ボタンが配置されること | インターフェース |
| REQ-004 | §3.2 Sequence メッセージ追加 | Sequence 追加フォームは From / Arrow / To / ラベル の4入力を縦1列に配置し、末尾に「+ メッセージ追加」ボタンを持つこと | 機能 |
| REQ-005 | §3.2 Flowchart エッジ追加 | Flowchart 追加フォームは From / Arrow / To / ラベル の4入力を縦1列に配置し、末尾に「+ エッジ追加」ボタンを持つこと | 機能 |
| REQ-006 | §3.2 State 遷移追加 | State 追加フォームは From / To / イベント の3入力を縦1列に配置し、末尾に「+ 遷移追加」ボタンを持つこと | 機能 |
| REQ-007 | §3.2 Class 関連追加 | Class 追加フォームは From / Arrow / To / ラベル の4入力を縦1列に配置し、末尾に「+ 関連追加」ボタンを持つこと | 機能 |
| REQ-008 | §3.2 ER リレーションシップ追加 | ER 追加フォームは From / Left card / Right card / To / ラベル の5入力を縦1列に配置し、末尾に「+ リレーションシップ追加」ボタンを持つこと | 機能 |
| REQ-009 | §3.3 element ID 不変 | Sequence 追加フォームの要素IDは `seq-add-msg-from`, `seq-add-msg-arrow`, `seq-add-msg-to`, `seq-add-msg-label`, `seq-add-msg-btn` から変更されないこと | インターフェース |
| REQ-010 | §3.3 element ID 不変 | Flowchart 追加フォームの要素IDは `fc-add-edge-from`, `fc-add-edge-arrow`, `fc-add-edge-to`, `fc-add-edge-label`, `fc-add-edge-btn` から変更されないこと | インターフェース |
| REQ-011 | §3.3 element ID 不変 | State 追加フォームの要素IDは `st-add-tr-from`, `st-add-tr-to`, `st-add-tr-event`, `st-add-tr-btn` から変更されないこと | インターフェース |
| REQ-012 | §3.3 element ID 不変 | Class 追加フォームの要素IDは `cl-add-rel-from`, `cl-add-rel-arrow`, `cl-add-rel-to`, `cl-add-rel-label`, `cl-add-rel-btn` から変更されないこと | インターフェース |
| REQ-013 | §3.3 element ID 不変 | ER 追加フォームの要素IDは `er-add-rel-from`, `er-add-rel-lc`, `er-add-rel-rc`, `er-add-rel-to`, `er-add-rel-label`, `er-add-rel-btn` から変更されないこと | インターフェース |
| REQ-014 | §3.4 ヘルパー活用 | 各 select は `window.MA.properties.selectFieldHtml(label, id, options, monoFont)` で構築され、From/To にはラベル文字列が必ず渡されること | インターフェース |
| REQ-015 | §4.1 Sequence シナリオ | property panel のみで OAuth 2.0 認可コードフロー（4 participants + 9 messages + 1 alt ブロック）を構築できること | 機能 |
| REQ-016 | §4.2 Flowchart シナリオ | property panel のみで受注処理業務フロー（9 nodes + 9 edges + direction LR）を構築できること | 機能 |
| REQ-017 | §4.3 State シナリオ | property panel のみで組み込み機器 電源/動作状態（5 states + 9 transitions）を構築できること | 機能 |
| REQ-018 | §4.4 Class シナリオ | property panel のみで EC ドメインモデル（4 classes + 8 members + 3 relations）を構築できること | 機能 |
| REQ-019 | §4.5 ER シナリオ | property panel のみで EC データベース設計（4 entities + 各属性 + 3 relationships）を構築できること | 機能 |
| REQ-020 | §4.6 共通合格基準 | 全ステップをエディタに直接タイプせず property panel のみで完了できること | 機能 |
| REQ-021 | §4.6 共通合格基準 | From/To 等の方向指示がラベル明示で識別可能であること | インターフェース |
| REQ-022 | §4.6 共通合格基準 | 全ドロップダウン・入力欄が viewport 内に収まる（画面外切れ無し）こと | 非機能 |
| REQ-023 | §4.6 共通合格基準 | 追加と編集で同じレイアウト（縦1列・ラベル付き・フル幅）を使用すること | 機能 |
| REQ-024 | §4.6 共通合格基準 | property panel 操作結果の Mermaid テキストがエディタに反映され、mermaid.js でエラー無くレンダリングされること | 機能 |
| REQ-025 | §4.6 共通合格基準 | ブラウザコンソールにエラー無し（favicon 404 を除く）であること | 非機能 |
| REQ-026 | §5.1 ユニットテスト | レイアウト変更後もユニットテスト 113 件すべて合格を維持すること | 非機能 |

## 3. 評価項目

| 評価ID | 対応要件ID | 評価観点 | 観測対象 | 判定基準 |
|---|---|---|---|---|
| EV-001 | REQ-001 | 全5図形の追加フォームが縦1列レイアウトで描画される | DOM構造（各 form の直接子要素の `getBoundingClientRect().top` が単調増加） | Sequence/Flowchart/State/Class/ER の各追加フォームで、From/Arrow/To/Label/イベント/Card などの入力フィールドの top 座標が前要素 ≤ 次要素 で並ぶ |
| EV-002 | REQ-002 | 追加フォームにセクションヘッダ要素が存在する | DOM（ヘッダテキストノード） | 各図形の追加フォーム直上に「メッセージを追加」/「エッジを追加」/「遷移追加」/「関連追加」/「リレーションシップ追加」のいずれかの文字列を含む要素が1件存在 |
| EV-003 | REQ-003 | 追加フォームの末尾に primary button が存在する | DOM（button要素のテキスト） | 各追加フォームの最終子要素が `<button>` かつテキストに「追加」を含む |
| EV-004 | REQ-004 | Sequence 追加フォームの入力構成と順序が仕様と一致する | DOM（id=seq-add-msg-* の DOM 順） | `seq-add-msg-from` → `seq-add-msg-arrow` → `seq-add-msg-to` → `seq-add-msg-label` → `seq-add-msg-btn` の順で出現し、button テキストに「メッセージ追加」を含む |
| EV-005 | REQ-005 | Flowchart 追加フォームの入力構成と順序が仕様と一致する | DOM（id=fc-add-edge-* の DOM 順） | `fc-add-edge-from` → `fc-add-edge-arrow` → `fc-add-edge-to` → `fc-add-edge-label` → `fc-add-edge-btn` の順で出現し、button テキストに「エッジ追加」を含む |
| EV-006 | REQ-006 | State 追加フォームの入力構成と順序が仕様と一致する | DOM（id=st-add-tr-* の DOM 順） | `st-add-tr-from` → `st-add-tr-to` → `st-add-tr-event` → `st-add-tr-btn` の順で出現し、button テキストに「遷移追加」を含む |
| EV-007 | REQ-007 | Class 追加フォームの入力構成と順序が仕様と一致する | DOM（id=cl-add-rel-* の DOM 順） | `cl-add-rel-from` → `cl-add-rel-arrow` → `cl-add-rel-to` → `cl-add-rel-label` → `cl-add-rel-btn` の順で出現し、button テキストに「関連追加」を含む |
| EV-008 | REQ-008 | ER 追加フォームの入力構成と順序が仕様と一致する | DOM（id=er-add-rel-* の DOM 順） | `er-add-rel-from` → `er-add-rel-lc` → `er-add-rel-rc` → `er-add-rel-to` → `er-add-rel-label` → `er-add-rel-btn` の順で出現し、button テキストに「リレーションシップ追加」を含む |
| EV-009 | REQ-009 | Sequence 追加フォームの既存 element ID が維持されている | DOM（`document.getElementById`） | `seq-add-msg-from`, `seq-add-msg-arrow`, `seq-add-msg-to`, `seq-add-msg-label`, `seq-add-msg-btn` のすべてが null でない |
| EV-010 | REQ-010 | Flowchart 追加フォームの既存 element ID が維持されている | DOM（`document.getElementById`） | `fc-add-edge-from`, `fc-add-edge-arrow`, `fc-add-edge-to`, `fc-add-edge-label`, `fc-add-edge-btn` のすべてが null でない |
| EV-011 | REQ-011 | State 追加フォームの既存 element ID が維持されている | DOM（`document.getElementById`） | `st-add-tr-from`, `st-add-tr-to`, `st-add-tr-event`, `st-add-tr-btn` のすべてが null でない |
| EV-012 | REQ-012 | Class 追加フォームの既存 element ID が維持されている | DOM（`document.getElementById`） | `cl-add-rel-from`, `cl-add-rel-arrow`, `cl-add-rel-to`, `cl-add-rel-label`, `cl-add-rel-btn` のすべてが null でない |
| EV-013 | REQ-013 | ER 追加フォームの既存 element ID が維持されている | DOM（`document.getElementById`） | `er-add-rel-from`, `er-add-rel-lc`, `er-add-rel-rc`, `er-add-rel-to`, `er-add-rel-label`, `er-add-rel-btn` のすべてが null でない |
| EV-014 | REQ-014 | From/To に紐づく `<label>` 要素が存在する | DOM（`<label for="...">` またはラベルテキスト要素） | 各図形の追加フォームで、From の select には「From」テキスト、To の select には「To」テキストを含むラベル要素が id 紐付けまたは直前配置で存在 |
| EV-015 | REQ-015 | Sequence OAuth シナリオが property panel のみで構築できる | エディタ内 Mermaid テキスト + mermaid.js レンダリング結果 + スクリーンショット | 最終 Mermaid テキストに participant 4件（User/Client/AuthServer/ResourceServer）、9 messages（表の通り）、alt ブロックが含まれ、mermaid.js レンダリングで `.error` ノードが生成されない |
| EV-016 | REQ-016 | Flowchart 受注フローシナリオが property panel のみで構築できる | エディタ内 Mermaid テキスト + レンダリング結果 | 最終 Mermaid テキストに direction `LR`、nodes 9件（Start/Stock/Reserve/BackOrder/Pay/Card/Bank/Ship/End）、edges 9件（表の通り）が含まれ、mermaid.js レンダリングで `.error` ノードが生成されない |
| EV-017 | REQ-017 | State 組み込み状態シナリオが property panel のみで構築できる | エディタ内 Mermaid テキスト + レンダリング結果 | 最終 Mermaid テキストに states 5件（PowerOff/Booting/Idle/Running/Error）、transitions 9件（表の通り、初期遷移 `[*] --> PowerOff` を含む）が含まれ、mermaid.js レンダリングで `.error` ノードが生成されない |
| EV-018 | REQ-018 | Class EC ドメインシナリオが property panel のみで構築できる | エディタ内 Mermaid テキスト + レンダリング結果 | 最終 Mermaid テキストに classes 4件（Customer/Order/OrderLine/Product）、members 8件（仕様通り）、relations 3件（表の通り）が含まれ、mermaid.js レンダリングで `.error` ノードが生成されない |
| EV-019 | REQ-019 | ER EC DB 設計シナリオが property panel のみで構築できる | エディタ内 Mermaid テキスト + レンダリング結果 | 最終 Mermaid テキストに entities 4件（CUSTOMER/ORDER/LINE_ITEM/PRODUCT）、各エンティティの属性（PK/FK 含む）、relationships 3件（表の通り）が含まれ、mermaid.js レンダリングで `.error` ノードが生成されない |
| EV-020 | REQ-020 | 全シナリオ中にエディタへの直接タイプ入力が発生しない | エディタ textarea の `keydown`/`input` イベント発生源 | シナリオ実行中、エディタ textarea は `document.activeElement` となる瞬間が 0 回、かつ全書き換えは property panel の button クリック経由で発生 |
| EV-021 | REQ-021 | 各追加フォームで From/To の方向指示にラベルテキストが描画される | DOM（ラベル要素のテキスト内容） | 各図形の追加フォームで「From」および「To」を含む label 要素がレンダリング結果に存在し、computed `display` が `none` でない |
| EV-022 | REQ-022 | 追加フォームの各入力要素が property panel 内に収まる | DOM（要素の `getBoundingClientRect().right` と panel の `clientWidth`） | viewport 幅 1280x720 で、各 input/select/button の `right` 座標が追加フォーム親 panel の右端座標以下、かつ document 全体に水平スクロールバーが生成されない |
| EV-023 | REQ-023 | 追加フォームと個別編集パネルのレイアウトが同一構造を共有する | DOM（構造比較） | 各図形について、追加フォームと個別編集パネルの双方が「縦1列」「各入力に label 要素が付随」「各 select/input が親要素幅100%（`width:100%` または `flex:1`）」の3条件を全て満たす |
| EV-024a | REQ-024 | property panel 操作結果がエディタ textarea に反映される | エディタ textarea の `value` | シナリオの全操作後、エディタ textarea の value に §4 の表記載の要素文字列が全て含まれる |
| EV-024b | REQ-024 | mermaid.js でエラー無くレンダリングされる | プレビュー領域 DOM（`svg` 要素 と `.error` ノード） | レンダリング後、プレビュー領域内に `<svg>` が1件以上存在、かつ `div.error-icon`/`text.error-text` が0件 |
| EV-025 | REQ-025 | ブラウザコンソールに `console.error` が出力されない（favicon 404 除く） | ブラウザコンソール（`console.error` のみ対象、U-2 参照） | シナリオ実行中〜終了までの `console.error` 件数が 0。ただし message に `favicon.ico` を含むエントリは除外 |
| EV-026 | REQ-026 | ユニットテストが全件合格する | `node tests/run-tests.js` の終了コードと出力 | プロセス終了コード 0、stdout に「113 passed」または「passed: 113」等の合格件数 113 を含む文字列が出力され、`failed: 0` が出力される |
| EV-E15 | REQ-004, REQ-021 | E15: sequence メッセージ追加フォームに From/Arrow/To のラベルが表示される | Playwright E2E assertion | `#seq-add-msg-from` 前後に「From」テキスト、`#seq-add-msg-arrow` 前後に「Arrow」テキスト、`#seq-add-msg-to` 前後に「To」テキストが描画される |
| EV-E17 | REQ-005, REQ-021 | E17: flowchart エッジ追加フォームに From/Arrow/To のラベルが表示される | Playwright E2E assertion | `#fc-add-edge-from` 前後に「From」、`#fc-add-edge-arrow` 前後に「Arrow」、`#fc-add-edge-to` 前後に「To」が描画される |
| EV-E19 | REQ-006, REQ-021 | E19: state 遷移追加フォームに From/To のラベルが表示される | Playwright E2E assertion | `#st-add-tr-from` 前後に「From」、`#st-add-tr-to` 前後に「To」が描画される |
| EV-E21 | REQ-007, REQ-021 | E21: class 関連追加フォームに From/Arrow/To のラベルが表示される | Playwright E2E assertion | `#cl-add-rel-from` 前後に「From」、`#cl-add-rel-arrow` 前後に「Arrow」、`#cl-add-rel-to` 前後に「To」が描画される |
| EV-E23 | REQ-008, REQ-021 | E23: er リレーションシップ追加フォームに From/LeftCard/RightCard/To のラベルが表示される | Playwright E2E assertion | `#er-add-rel-from` 前後に「From」、`#er-add-rel-lc` 前後に「Left card」または「LeftCard」、`#er-add-rel-rc` 前後に「Right card」または「RightCard」、`#er-add-rel-to` 前後に「To」が描画される |

## 4. テストタスク

### TC-001 (対応評価ID: EV-001)
- **目的**: 全5図形の追加フォームが縦1列で描画されることを確認する
- **準備物**: PC、ブラウザ (Chromium系)、`mermaid-assist.html`、HTTPサーバー(`python -m http.server 8765`)
- **事前条件**:
  - HTTPサーバー起動済み
  - `http://127.0.0.1:8765/mermaid-assist.html` 読み込み完了
- **手順**:
  1. ブラウザで Sequence 図形に切替える
  2. DevTools Console で `Array.from(document.querySelectorAll('#seq-add-msg-from, #seq-add-msg-arrow, #seq-add-msg-to, #seq-add-msg-label, #seq-add-msg-btn')).map(e=>e.getBoundingClientRect().top)` を実行
  3. Flowchart/State/Class/ER に切替え、同様に該当 id の top を取得
- **期待結果**: 各図形の全入力要素の top 座標が単調増加（前 ≤ 次）
- **合否判定**:
  - PASS: 全5図形で配列が単調非減少
  - FAIL: どれか1図形でも top が逆転
- **備考**: -

### TC-002 (対応評価ID: EV-002)
- **目的**: 各追加フォームにセクションヘッダが存在することを確認する
- **準備物**: PC、ブラウザ、`mermaid-assist.html`
- **事前条件**: アプリ読み込み完了
- **手順**:
  1. 各図形（Sequence/Flowchart/State/Class/ER）の property panel を表示する
  2. 追加フォームの直上要素テキストを取得する
- **期待結果**: 各図形のヘッダに「メッセージを追加」「エッジを追加」「遷移追加」「関連追加」「リレーションシップ追加」のいずれか文字列が含まれる
- **合否判定**:
  - PASS: 5図形すべてでヘッダ文字列を検出
  - FAIL: いずれかでヘッダ不在または別文言
- **備考**: -

### TC-003 (対応評価ID: EV-003)
- **目的**: 各追加フォーム末尾に「+ 追加」 primary button が配置されることを確認する
- **準備物**: PC、ブラウザ
- **事前条件**: アプリ読み込み完了
- **手順**:
  1. Sequence の追加フォームの最終子要素を `form.lastElementChild` で取得
  2. Flowchart/State/Class/ER についても同様
- **期待結果**: 各最終子要素が `<button>` タグかつテキストに「追加」を含む
- **合否判定**:
  - PASS: 5/5 で条件成立
  - FAIL: いずれか不成立
- **備考**: -

### TC-004 (対応評価ID: EV-004)
- **目的**: Sequence 追加フォームの入力構成順序を確認する
- **準備物**: PC、ブラウザ
- **事前条件**: Sequence 図形に切替済み
- **手順**:
  1. DevTools で `['seq-add-msg-from','seq-add-msg-arrow','seq-add-msg-to','seq-add-msg-label','seq-add-msg-btn'].map(id=>document.getElementById(id).compareDocumentPosition(document.getElementById('seq-add-msg-btn')))` を確認
  2. button テキストを取得
- **期待結果**: 5要素が DOM 順で From→Arrow→To→Label→Btn の順、button テキストに「メッセージ追加」を含む
- **合否判定**:
  - PASS: 順序一致 かつ テキスト一致
  - FAIL: それ以外
- **備考**: -

### TC-005 (対応評価ID: EV-005)
- **目的**: Flowchart 追加フォームの入力構成順序を確認する
- **準備物**: PC、ブラウザ
- **事前条件**: Flowchart 図形に切替済み
- **手順**:
  1. `fc-add-edge-from/arrow/to/label/btn` の DOM 順を取得
  2. button テキストを取得
- **期待結果**: 5要素が From→Arrow→To→Label→Btn 順、button テキストに「エッジ追加」を含む
- **合否判定**:
  - PASS: 条件全成立
  - FAIL: 不成立
- **備考**: -

### TC-006 (対応評価ID: EV-006)
- **目的**: State 追加フォームの入力構成順序を確認する
- **準備物**: PC、ブラウザ
- **事前条件**: State 図形に切替済み
- **手順**:
  1. `st-add-tr-from/to/event/btn` の DOM 順を取得
  2. button テキストを取得
- **期待結果**: 4要素が From→To→Event→Btn 順、button テキストに「遷移追加」を含む
- **合否判定**:
  - PASS: 条件全成立
  - FAIL: 不成立
- **備考**: -

### TC-007 (対応評価ID: EV-007)
- **目的**: Class 追加フォームの入力構成順序を確認する
- **準備物**: PC、ブラウザ
- **事前条件**: Class 図形に切替済み
- **手順**:
  1. `cl-add-rel-from/arrow/to/label/btn` の DOM 順を取得
  2. button テキストを取得
- **期待結果**: 5要素が From→Arrow→To→Label→Btn 順、button テキストに「関連追加」を含む
- **合否判定**:
  - PASS: 条件全成立
  - FAIL: 不成立
- **備考**: -

### TC-008 (対応評価ID: EV-008)
- **目的**: ER 追加フォームの入力構成順序を確認する
- **準備物**: PC、ブラウザ
- **事前条件**: ER 図形に切替済み
- **手順**:
  1. `er-add-rel-from/lc/rc/to/label/btn` の DOM 順を取得
  2. button テキストを取得
- **期待結果**: 6要素が From→LC→RC→To→Label→Btn 順、button テキストに「リレーションシップ追加」を含む
- **合否判定**:
  - PASS: 条件全成立
  - FAIL: 不成立
- **備考**: -

### TC-009 (対応評価ID: EV-009)
- **目的**: Sequence 追加フォームの element ID 保持を確認する
- **準備物**: PC、ブラウザ
- **事前条件**: Sequence 図形表示済み
- **手順**:
  1. Console で `['seq-add-msg-from','seq-add-msg-arrow','seq-add-msg-to','seq-add-msg-label','seq-add-msg-btn'].map(id=>document.getElementById(id))` を実行
- **期待結果**: 配列内すべて非null (HTMLElement)
- **合否判定**:
  - PASS: 5/5 非null
  - FAIL: 1件でも null
- **備考**: -

### TC-010 (対応評価ID: EV-010)
- **目的**: Flowchart 追加フォームの element ID 保持を確認する
- **準備物**: PC、ブラウザ
- **事前条件**: Flowchart 図形表示済み
- **手順**:
  1. `['fc-add-edge-from','fc-add-edge-arrow','fc-add-edge-to','fc-add-edge-label','fc-add-edge-btn'].map(id=>document.getElementById(id))`
- **期待結果**: 5/5 非null
- **合否判定**:
  - PASS: 5/5 非null
  - FAIL: null を含む
- **備考**: -

### TC-011 (対応評価ID: EV-011)
- **目的**: State 追加フォームの element ID 保持を確認する
- **準備物**: PC、ブラウザ
- **事前条件**: State 図形表示済み
- **手順**:
  1. `['st-add-tr-from','st-add-tr-to','st-add-tr-event','st-add-tr-btn'].map(id=>document.getElementById(id))`
- **期待結果**: 4/4 非null
- **合否判定**:
  - PASS: 4/4 非null
  - FAIL: null を含む
- **備考**: -

### TC-012 (対応評価ID: EV-012)
- **目的**: Class 追加フォームの element ID 保持を確認する
- **準備物**: PC、ブラウザ
- **事前条件**: Class 図形表示済み
- **手順**:
  1. `['cl-add-rel-from','cl-add-rel-arrow','cl-add-rel-to','cl-add-rel-label','cl-add-rel-btn'].map(id=>document.getElementById(id))`
- **期待結果**: 5/5 非null
- **合否判定**:
  - PASS: 5/5 非null
  - FAIL: null を含む
- **備考**: -

### TC-013 (対応評価ID: EV-013)
- **目的**: ER 追加フォームの element ID 保持を確認する
- **準備物**: PC、ブラウザ
- **事前条件**: ER 図形表示済み
- **手順**:
  1. `['er-add-rel-from','er-add-rel-lc','er-add-rel-rc','er-add-rel-to','er-add-rel-label','er-add-rel-btn'].map(id=>document.getElementById(id))`
- **期待結果**: 6/6 非null
- **合否判定**:
  - PASS: 6/6 非null
  - FAIL: null を含む
- **備考**: -

### TC-014 (対応評価ID: EV-014)
- **目的**: From/To 選択肢に `<label>` 要素が紐付いていることを確認する
- **準備物**: PC、ブラウザ
- **事前条件**: アプリ読み込み済み
- **手順**:
  1. Sequence 表示。`document.querySelector('label[for="seq-add-msg-from"]')?.textContent` と `label[for="seq-add-msg-to"]` のテキスト取得
  2. Flowchart/State/Class/ER で同様に From, To に対応する label for を取得
- **期待結果**: 各図形の From/To に対応する label 要素が存在し、テキストに「From」「To」が含まれる
- **合否判定**:
  - PASS: 5図形すべてで From/To の label が存在
  - FAIL: いずれかで label 不在
- **備考**: `selectFieldHtml` の出力が `<label for="...">` を生成することを前提とする

### TC-015 (対応評価ID: EV-015)
- **目的**: Sequence OAuth シナリオを property panel のみで構築できることを確認する
- **準備物**: PC、ブラウザ、HTTPサーバー (8765)、MCP Playwright
- **事前条件**:
  - サーバー起動、`mermaid-assist.html` ロード済み
  - Sequence 図形選択、デフォルトテンプレート表示
- **手順**:
  1. 既存 2 messages / 2 participants を property panel の削除ボタンで全削除する
  2. Add participant フォームで `User`/`Client`/`AuthServer`/`ResourceServer` を順次追加
  3. Add message フォームで §4.1 の表通り 9 messages を From/Arrow/To/Label 指定で追加
  4. alt ブロック追加操作を実行（ラベル `トークン期限切れ`）
  5. エディタ textarea の value を取得し、プレビュー領域の `<svg>`/`.error` 有無を取得
  6. MCP で最終状態スクリーンショットを `.eval/seq-ux-v1.2.0/sequence-result.png` に保存
- **期待結果**: Mermaid テキストに 4 participants + 9 messages + alt ブロックが含まれ、プレビューに `<svg>` あり・`.error` なし
- **合否判定**:
  - PASS: 含有要素数・alt 存在・svg 存在・error 不在 すべて成立
  - FAIL: いずれか不成立
- **備考**: シナリオは §4.1 の表に厳密準拠

### TC-016 (対応評価ID: EV-016)
- **目的**: Flowchart 受注フローシナリオを property panel のみで構築できることを確認する
- **準備物**: PC、ブラウザ、HTTPサーバー、MCP Playwright
- **事前条件**: Flowchart 図形選択、デフォルトテンプレート表示
- **手順**:
  1. デフォルト全要素を property panel から削除
  2. §4.2 の 9 nodes を種別（rect/diamond/round）指定で追加
  3. §4.2 の表通り 9 edges を From/Arrow/To/Label 指定で追加
  4. direction を `LR` に変更
  5. エディタテキスト取得、プレビュー確認
  6. スクリーンショット保存 (`.eval/seq-ux-v1.2.0/flowchart-result.png`)
- **期待結果**: direction LR、9 nodes、9 edges がテキストに含まれ、`<svg>` ありで `.error` なし
- **合否判定**:
  - PASS: 全条件成立
  - FAIL: 不成立
- **備考**: -

### TC-017 (対応評価ID: EV-017)
- **目的**: State 組み込みシナリオを property panel のみで構築できることを確認する
- **準備物**: PC、ブラウザ、HTTPサーバー、MCP Playwright
- **事前条件**: State 図形選択、デフォルトテンプレート表示
- **手順**:
  1. デフォルト全要素削除
  2. §4.3 の 5 states 追加
  3. §4.3 の表通り 9 transitions を From/To/Event 指定で追加（初期遷移 `[*]` を含む）
  4. エディタテキスト取得、プレビュー確認
  5. スクリーンショット保存 (`.eval/seq-ux-v1.2.0/state-result.png`)
- **期待結果**: 5 states + 9 transitions がテキストに含まれ、`<svg>` ありで `.error` なし
- **合否判定**:
  - PASS: 全条件成立
  - FAIL: 不成立
- **備考**: -

### TC-018 (対応評価ID: EV-018)
- **目的**: Class EC ドメインシナリオを property panel のみで構築できることを確認する
- **準備物**: PC、ブラウザ、HTTPサーバー、MCP Playwright
- **事前条件**: Class 図形選択、デフォルトテンプレート表示
- **手順**:
  1. デフォルト全要素削除
  2. §4.4 の 4 classes 追加
  3. 各 class に §4.4 の 8 members を追加
  4. §4.4 の表通り 3 relations を追加
  5. エディタテキスト取得、プレビュー確認
  6. スクリーンショット保存 (`.eval/seq-ux-v1.2.0/class-result.png`)
- **期待結果**: 4 classes + 8 members + 3 relations がテキストに含まれ、`<svg>` ありで `.error` なし
- **合否判定**:
  - PASS: 全条件成立
  - FAIL: 不成立
- **備考**: -

### TC-019 (対応評価ID: EV-019)
- **目的**: ER EC DB 設計シナリオを property panel のみで構築できることを確認する
- **準備物**: PC、ブラウザ、HTTPサーバー、MCP Playwright
- **事前条件**: ER 図形選択、デフォルトテンプレート表示
- **手順**:
  1. デフォルト全要素削除
  2. §4.5 の 4 entities 追加
  3. 各 entity の属性（PK/FK 含む）を §4.5 通りに追加
  4. §4.5 の表通り 3 relationships を追加
  5. エディタテキスト取得、プレビュー確認
  6. スクリーンショット保存 (`.eval/seq-ux-v1.2.0/er-result.png`)
- **期待結果**: 4 entities + 各属性 + 3 relationships がテキストに含まれ、`<svg>` ありで `.error` なし
- **合否判定**:
  - PASS: 全条件成立
  - FAIL: 不成立
- **備考**: -

### TC-020 (対応評価ID: EV-020)
- **目的**: シナリオ実行中にエディタへの直接タイプが発生しないことを確認する
- **準備物**: PC、ブラウザ、Playwright MCP
- **事前条件**: いずれかのシナリオ (TC-015〜TC-019) を実行中
- **手順**:
  1. シナリオ実行前に `document.querySelector('textarea#editor').addEventListener('focus', e=>window.__focusCount=(window.__focusCount||0)+1)` を注入
  2. シナリオ TC-015 を実行
  3. 完了後 `window.__focusCount` を取得
- **期待結果**: `window.__focusCount === 0`
- **合否判定**:
  - PASS: カウント 0
  - FAIL: カウント ≥ 1
- **備考**: TC-015〜TC-019 のいずれかと同時実行でもよい

### TC-021 (対応評価ID: EV-021)
- **目的**: 各追加フォームで From/To ラベルが描画されることを確認する
- **準備物**: PC、ブラウザ
- **事前条件**: アプリ読み込み済み
- **手順**:
  1. 各図形（5図形）を順次表示
  2. `window.getComputedStyle(document.querySelector('label[for$="-from"]')).display` および `to` 版を確認
- **期待結果**: 各図形で From/To の label が存在、display が `none` でない
- **合否判定**:
  - PASS: 5図形 × 2ラベル = 10 項目すべて成立
  - FAIL: 不成立
- **備考**: -

### TC-022 (対応評価ID: EV-022)
- **目的**: 追加フォーム各要素が property panel 内に収まることを確認する
- **準備物**: PC、ブラウザ（viewport 1280x720 固定）
- **事前条件**: アプリ読み込み済み、ウィンドウサイズ 1280x720
- **手順**:
  1. 各図形を表示
  2. 追加フォーム内の全 input/select/button について `el.getBoundingClientRect().right` と property panel の `panel.getBoundingClientRect().right` を比較
  3. `document.documentElement.scrollWidth > window.innerWidth` が true かを確認
- **期待結果**: 各要素 right ≤ panel right、`scrollWidth > innerWidth` が false（水平スクロール無し）
- **合否判定**:
  - PASS: 5図形すべてで2条件成立
  - FAIL: いずれか不成立
- **備考**: viewport 基準は U-1 未確定事項参照

### TC-023 (対応評価ID: EV-023)
- **目的**: 追加フォームと個別編集パネルが同じレイアウト規則を共有することを確認する
- **準備物**: PC、ブラウザ
- **事前条件**: 各図形で既存要素が1件以上存在
- **手順**:
  1. 各図形で追加フォームと個別編集パネル（既存要素クリック時）の双方を開く
  2. 両パネルについて「各入力に label 要素が付随する」「各 input/select に computed `width` が親要素幅100%相当である（`box.width / parent.clientWidth ≥ 0.9`）」「DOM 内で縦方向配置(top 単調増加)」を検証
- **期待結果**: 双方のパネルで3条件すべて成立
- **合否判定**:
  - PASS: 5図形 × 2パネル × 3条件 = 30 項目成立
  - FAIL: 1項目でも不成立
- **備考**: -

### TC-024 (対応評価ID: EV-024a)
- **目的**: property panel 操作の結果がエディタ textarea に反映されることを確認する
- **準備物**: PC、ブラウザ、Playwright MCP
- **事前条件**: TC-015〜TC-019 のいずれかを実行済み
- **手順**:
  1. TC-015 完了後、`document.querySelector('textarea#editor').value` を取得
  2. §4.1 の表中のすべての participant 名/message 文字列が value に含まれることを検証
- **期待結果**: value に `User`, `Client`, `AuthServer`, `ResourceServer`, および 9 messages の各 Label 文字列と alt 含有
- **合否判定**:
  - PASS: すべての文字列が含まれる
  - FAIL: 1件でも欠落
- **備考**: -

### TC-025 (対応評価ID: EV-024b)
- **目的**: mermaid.js レンダリングがエラーなく完了することを確認する
- **準備物**: PC、ブラウザ
- **事前条件**: TC-015〜TC-019 のいずれか完了
- **手順**:
  1. プレビュー領域内 `<svg>` 要素数を取得
  2. `div.error-icon, text.error-text` 要素数を取得
- **期待結果**: `<svg>` ≥ 1 かつ エラーノード = 0
- **合否判定**:
  - PASS: 条件成立
  - FAIL: svg 無し または エラーノードあり
- **備考**: -

### TC-026 (対応評価ID: EV-025)
- **目的**: ブラウザコンソールに `console.error` (favicon 404 除く) が発生しないことを確認する
- **準備物**: PC、ブラウザ、Playwright MCP (`browser_console_messages`)
- **事前条件**: いずれかのシナリオ TC-015〜TC-019 を実行中
- **手順**:
  1. シナリオ実行中に `browser_console_messages` で全 console ログを取得
  2. level == `error` かつ message に `favicon.ico` を含まないエントリ数をカウント
- **期待結果**: カウント = 0
- **合否判定**:
  - PASS: 0
  - FAIL: ≥ 1
- **備考**: 判定レベルは U-2 未確定事項参照

### TC-027 (対応評価ID: EV-026)
- **目的**: ユニットテスト 113 件の合格を維持することを確認する
- **準備物**: PC、Node.js ランタイム、リポジトリ clone
- **事前条件**: リポジトリ clone 完了、依存関係インストール済み
- **手順**:
  1. `cd E:/00_Git/05_MermaidAssist && node tests/run-tests.js` を実行
  2. 終了コードと stdout を記録
- **期待結果**: exit code 0、stdout に「113 passed」相当の文字列と `failed: 0` が含まれる
- **合否判定**:
  - PASS: 両条件成立
  - FAIL: 不成立
- **備考**: -

### TC-E15 (対応評価ID: EV-E15)
- **目的**: E2E E15 - Sequence 追加フォームの From/Arrow/To ラベル描画を検証する
- **準備物**: PC、Playwright、リポジトリ
- **事前条件**: `mermaid-assist.html` を Playwright でロード、Sequence 選択済み
- **手順**:
  1. `page.locator('label[for="seq-add-msg-from"]')`, `arrow`, `to` のテキストを取得
- **期待結果**: 3要素がそれぞれ「From」「Arrow」「To」を含む
- **合否判定**:
  - PASS: 3/3 成立
  - FAIL: 不成立
- **備考**: 設計書 §5.2 E15 に準拠

### TC-E17 (対応評価ID: EV-E17)
- **目的**: E2E E17 - Flowchart 追加フォームの From/Arrow/To ラベル描画を検証する
- **準備物**: PC、Playwright
- **事前条件**: Flowchart 選択済み
- **手順**:
  1. `label[for="fc-add-edge-from|arrow|to"]` のテキスト取得
- **期待結果**: 「From」「Arrow」「To」が各 label に含まれる
- **合否判定**:
  - PASS: 3/3 成立
  - FAIL: 不成立
- **備考**: -

### TC-E19 (対応評価ID: EV-E19)
- **目的**: E2E E19 - State 追加フォームの From/To ラベル描画を検証する
- **準備物**: PC、Playwright
- **事前条件**: State 選択済み
- **手順**:
  1. `label[for="st-add-tr-from|to"]` のテキスト取得
- **期待結果**: 「From」「To」が各 label に含まれる
- **合否判定**:
  - PASS: 2/2 成立
  - FAIL: 不成立
- **備考**: -

### TC-E21 (対応評価ID: EV-E21)
- **目的**: E2E E21 - Class 追加フォームの From/Arrow/To ラベル描画を検証する
- **準備物**: PC、Playwright
- **事前条件**: Class 選択済み
- **手順**:
  1. `label[for="cl-add-rel-from|arrow|to"]` のテキスト取得
- **期待結果**: 「From」「Arrow」「To」が各 label に含まれる
- **合否判定**:
  - PASS: 3/3 成立
  - FAIL: 不成立
- **備考**: -

### TC-E23 (対応評価ID: EV-E23)
- **目的**: E2E E23 - ER 追加フォームの From/LeftCard/RightCard/To ラベル描画を検証する
- **準備物**: PC、Playwright
- **事前条件**: ER 選択済み
- **手順**:
  1. `label[for="er-add-rel-from|lc|rc|to"]` のテキスト取得
- **期待結果**: 各 label に「From」「Left card」「Right card」「To」(または LeftCard/RightCard 表記) が含まれる
- **合否判定**:
  - PASS: 4/4 成立
  - FAIL: 不成立
- **備考**: -

## 5. トレーサビリティ

| 要件ID | 評価ID | テストタスクID |
|---|---|---|
| REQ-001 | EV-001 | TC-001 |
| REQ-002 | EV-002 | TC-002 |
| REQ-003 | EV-003 | TC-003 |
| REQ-004 | EV-004, EV-E15 | TC-004, TC-E15 |
| REQ-005 | EV-005, EV-E17 | TC-005, TC-E17 |
| REQ-006 | EV-006, EV-E19 | TC-006, TC-E19 |
| REQ-007 | EV-007, EV-E21 | TC-007, TC-E21 |
| REQ-008 | EV-008, EV-E23 | TC-008, TC-E23 |
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
| REQ-021 | EV-021, EV-E15, EV-E17, EV-E19, EV-E21, EV-E23 | TC-021, TC-E15, TC-E17, TC-E19, TC-E21, TC-E23 |
| REQ-022 | EV-022 | TC-022 |
| REQ-023 | EV-023 | TC-023 |
| REQ-024 | EV-024a, EV-024b | TC-024, TC-025 |
| REQ-025 | EV-025 | TC-026 |
| REQ-026 | EV-026 | TC-027 |

## 6. カバレッジ自己検査結果

- 要件→評価項目カバレッジ: 26/26 (100%)
- 評価項目→テストタスクカバレッジ: 32/32 (100%)
- 禁止語検出: 0件（`正しく`/`適切に`/`素早く`/`違和感なく`/`きちんと`/`しっかり` をすべて判定基準・期待結果から排除済み）
- 重複評価項目: 0件（観測対象+判定基準の完全一致組合せなし）
- 未確定事項: 3件（U-1: viewport 基準、U-2: console.error 判定レベル、U-3: スクリーンショット中間保存要否）

注: §4.6「結果の Mermaid テキストがエディタに正しく反映される」の「正しく」は仕様書原文の引用であり判定基準(EV-024a)では具体的な含有文字列条件に置き換えて観測可能化しています。
