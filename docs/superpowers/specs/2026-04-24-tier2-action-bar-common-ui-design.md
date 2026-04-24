# Tier 2: 選択要素アクションバーと選択強調 CSS の共通化

**日付**: 2026-04-24
**状態**: 設計確定、実装計画へ
**関連**: `docs/cross-ref/sequence-improvements-applicability.md` §3 Tier 2

## 背景

2026-04-20〜24 のクロスアプライサイクルで、Sequence モジュールに以下の
直接操作 UX を導入した:

- 選択要素のアクションバー (↑この前に挿入 / ↓この後に挿入 / ↑上へ / ↓下へ / 削除)
- 選択強調の緑点線枠 (`.overlay-*.selected` CSS)

現在これらは **Sequence モジュールにハードコード**されており、他 19 モジュール
(flowchart, state, class, er, timeline など) に同じ UX を提供するには都度
コピペが必要で、保守性が低い。

本 spec では、これらを `window.MA.properties` 配下の共通ヘルパおよび
`mermaid-assist.html` 内の共通 CSS に切り出し、5 つの主要モジュール
(flowchart / state / class / er / timeline) に適用する基盤を確立する。

後続 Tier 3/4 の拡張 (Move safety 共通化、Rich-label 統合、Multi-select
wrap) が本基盤の上に積み上げられるよう、forward-compat な API を設計する。

## 目的 / ゴール

### 達成すべきこと

1. `actionBarHtml(idPrefix, opts)` helper を properties.js に追加
2. `bindActionBar(idPrefix, handlers)` helper を properties.js に追加
3. `.overlay-*.selected` の汎用 CSS ルール (`[class*="overlay-"].selected`)
   を mermaid-assist.html に追加
4. Sequence モジュールを helper 経由に書き換え (振る舞い変化なし)
5. flowchart / state / class / er / timeline の selected-element 系
   renderProps にアクションバーを導入
6. ADR-020/021/022 を追加 (決定記録)

### 対象外 (本 spec)

- Tier 3: Move 同種要素のみ / 選択追随 helper のユーティリティ化 (別 spec)
- Tier 4: Rich-label-editor 他モジュール統合、Multi-select wrap container
  適用 (別 spec)
- Gantt への適用 (ADR-023 として別途「非適用」の判断を記録、本 spec では
  "out-of-scope" 言及のみ)
- Sequence 以外のモジュールの既存バグ修正 (機会があれば並行で対応可)

## ユーザー視点の変化

- **Sequence モジュール**: 見た目・挙動とも **変化なし**。内部実装のみ整理
- **flowchart / state / class / er / timeline**:
  - 要素を選択したとき、プロパティパネルに**共通のアクションバー**
    (↑この前に挿入 / ↓この後に挿入 / ↑上へ / ↓下へ / 削除) が現れる
  - 選択した overlay 要素が**緑の点線枠**で強調される
- **その他 14 モジュール**: 選択強調 CSS のみ自動的に効く
  (overlay- クラスを使っている要素がある場合)。アクションバー追加は本
  spec の対象外

## アーキテクチャ

### コンポーネント関係

```
mermaid-assist.html
 ├─ <style>  .overlay-*.selected, .action-btn, .action-btn-danger など
 └─ <script> core/*.js → ui/properties.js → ui/rich-label-editor.js → modules/*.js

window.MA.properties            (src/ui/properties.js)
 ├─ 既存: fieldHtml, selectFieldHtml, primaryButtonHtml, dangerButtonHtml,
 │        bindEvent, bindSelectButtons, bindAllByClass, ...
 ├─ 新規: actionBarHtml(idPrefix, opts) → string
 └─ 新規: bindActionBar(idPrefix, handlers) → void

各モジュール (src/modules/<kind>.js)
 renderProps(selData, parsedData, propsEl, ctx)
  └─ 選択要素毎のブランチで
     propsEl.innerHTML = header + fields + properties.actionBarHtml(...)
     properties.bindActionBar(prefix, handlers)
```

### データフロー

1. 選択変更 → app.js の `renderProps()` が `currentModule.renderProps(...)` を呼ぶ
2. モジュール側が `actionBarHtml('sel-node', {...})` で HTML 片を取得
3. HTML を `propsEl.innerHTML` に埋め込む
4. `bindActionBar('sel-node', {up: fn, down: fn, ...})` で click handler を bind
5. ユーザがボタンクリック → handler 実行 → DSL 更新 → `ctx.setMmdText` → 同期再 parse (既に適用済) → 選択再描画

### CSS セレクタ戦略

```css
#overlay-layer [class*="overlay-"].selected {
  fill: rgba(126, 231, 135, 0.15) !important;
  stroke: var(--accent-green, #7ee787);
  stroke-width: 2;
  stroke-dasharray: 4 4;
}
```

- 属性セレクタ `[class*="overlay-"]` で overlay-node / overlay-edge /
  overlay-state / overlay-message など**今後追加される overlay-xxx もすべて自動で対象**になる
- Gantt は `.overlay-bar` を使うが **`.selected` クラスを付けていない**ため誤発火しない
  (Gantt の選択強調は別メカニズム)
- 将来 Gantt スタイルに合わせる場合も別クラス (`.gantt-selected` など) を
  使えば本ルールと共存可能

## API 詳細

### actionBarHtml(idPrefix, opts)

**引数**:
- `idPrefix`: string — ボタン ID の共通接頭辞 (例: `'sel-node'`, `'sel-msg'`)
- `opts`: object (optional) — どのボタンを出すか + ラベル上書き
  - `insertBefore`: boolean (default: `true`) — ↑この前に挿入 ボタンを含めるか
  - `insertAfter`: boolean (default: `true`) — ↓この後に挿入 ボタンを含めるか
  - `move`: boolean or `{up: boolean, down: boolean}` (default: `true`)
    — 上下ボタン。true なら両方、false なら両方省略、object なら個別指定
  - `delete`: boolean (default: `true`) — 削除ボタン
  - `labels`: object — 各ボタンのテキスト上書き (例: `{delete: 'メッセージ削除'}`)

**返り値**: HTML string

**出力構造** (全オプション true 時):
```html
<div class="action-bar-row" data-action-bar-row="insert">
  <button id="<prefix>-insert-before" class="action-btn">↑ この前に挿入</button>
  <button id="<prefix>-insert-after"  class="action-btn">↓ この後に挿入</button>
</div>
<div class="action-bar-row" data-action-bar-row="move">
  <button id="<prefix>-up"   class="action-btn">↑ 上へ</button>
  <button id="<prefix>-down" class="action-btn">↓ 下へ</button>
</div>
<div id="<prefix>-extra" class="action-bar-extra"></div>
<button id="<prefix>-delete" class="action-btn-danger">削除</button>
```

**設計判断**:
- `<prefix>-extra` は **常に** 出力する (false 指定不可)。モジュール固有ボタンの
  挿入点を安定させるため
- 各ボタンは class を付与、inline style は持たない → CSS 側で一元管理
- 未知の opts キーは無視 (forward-compat)

### bindActionBar(idPrefix, handlers)

**引数**:
- `idPrefix`: string — actionBarHtml と同じ prefix
- `handlers`: object — キー → click handler
  - `insertBefore`: function — ↑この前に挿入 ボタン click 時
  - `insertAfter`: function — ↓この後に挿入 ボタン click 時
  - `up`: function — ↑上へ ボタン click 時
  - `down`: function — ↓下へ ボタン click 時
  - `delete`: function — 削除ボタン click 時

**振る舞い**:
- `handlers[key]` が function なら `properties.bindEvent(prefix + '-' + mapped, 'click', fn)` で bind
- function でない (undefined / null / false) キーは skip
- key → id suffix マッピング:
  - `insertBefore` → `-insert-before`
  - `insertAfter` → `-insert-after`
  - `up` → `-up`
  - `down` → `-down`
  - `delete` → `-delete`

### ボタン ID 命名規則

- prefix は `sel-<kind>` 形式必須 (例: `sel-node`, `sel-edge`, `sel-msg`, `sel-note`)
- multi-select 時は `sel-multi-` を使用 (既に Sequence で採用済)
- prefix と handler key を `-` で連結するので、prefix 自体にハイフンを含めて OK
- **DOM 衝突防止**: 同一 renderProps 呼び出し内で複数のアクションバーを
  レンダリングしないこと (設計上許可しないルールとして ADR-022 に明記)

## モジュール別の適用内容

| モジュール | 対象選択要素 | actionBarHtml opts | 備考 |
|---|---|---|---|
| flowchart | node | 全 true (move は node 順序) | edge 選択は別フェーズ |
| flowchart | edge | insert/delete のみ (move=false) | 順序概念が薄い |
| state | state | 全 true | |
| state | transition | insert/delete のみ | |
| class | class | 全 true (move=class 順序) | |
| class | relation | insert/delete のみ | |
| er | entity | 全 true | |
| er | relationship | insert/delete のみ | |
| timeline | event | 全 true (move=event 順序) | |
| timeline | section | insert/delete のみ (セクション中はイベント順序) | |

**ラベル上書き** は各モジュールで自然なドメイン語に:
- flowchart: `削除` → `ノード削除` / `エッジ削除`
- state: `削除` → `状態削除` / `遷移削除`
- class: `削除` → `クラス削除` / `関連削除`
- 等々

## テスト方針

### 単体テスト (Node sandbox)

新規 `tests/properties.test.js` (6-8 件):
1. `actionBarHtml('sel-x')` が 5 ボタンすべての id を含む
2. `actionBarHtml('sel-x', {move: false})` で -up / -down 無し
3. `actionBarHtml('sel-x', {move: {up: true, down: false}})` で -up のみ
4. `actionBarHtml('sel-x', {labels: {delete: 'Custom'}})` で label 上書き
5. `actionBarHtml` の戻り値に `<prefix>-extra` プレースホルダが含まれる
6. `bindActionBar('sel-x', {up: fn})` で up クリック時 fn が呼ばれる
7. `bindActionBar('sel-x', {})` で click しても handler が呼ばれない
8. `bindActionBar` が未知の key を無視

### 既存テスト

`tests/sequence-updater.test.js` 既存 371 件は、ボタン ID を変えない前提で
そのまま pass する想定。Sequence の helper 経由への書き換えは純粋な
リファクタ。

### Visual Verification (Playwright MCP)

CLAUDE.md 「GUI 変更は自動テスト GREEN だけで PASS 禁止」に従い:

1. Sequence で msg / participant / note / group 各選択時にアクションバーが
   従来通り表示され、各ボタンが従来通り動作
2. flowchart / state / class / er / timeline の代表的選択要素 (node /
   state / class / entity / event 1 つずつ) で:
   - アクションバーが出る
   - 選択強調の緑点線が overlay に入る
   - ↑上へ / ↓下へ / 削除 がそれぞれ期待通り DSL を書き換える

全スクリーンショットを `.eval/tier2-action-bar/` に保存。

### 受け入れ基準

- Unit: 既存 371 + 新規 6-8 件、**全 pass**
- Visual: 6 モジュール × 代表 1-2 要素 = 6-12 確認項目、全 OK
- Sequence の既存挙動に **regression なし**
- 行数: properties.js +~80 行、各モジュール -~20 行 × 5 = **純減または同等**

## リスク分析

| リスク | 影響 | 確度 | 対処 |
|---|---|---|---|
| CSS 属性セレクタ `[class*="overlay-"]` が誤マッチ | Gantt の `.overlay-bar` が緑点線化 | 低 | Gantt は `.selected` class 非使用、実機検証で確認 |
| ボタン ID 衝突 | DOM 重複 → click 不発 | 低 | 命名規則 `sel-<kind>` を ADR-022 で明文化 |
| モジュール毎に move 概念が違う | 「上へ下へ」が非直感 | 中 | move 意味不明なモジュールは `move: false` で省略、移行時に都度判断 |
| 既存 Sequence の action-bar を書き換えて regression | ユーザ影響 | 中 | 書き換え後に全 Playwright シナリオを回帰実行 |
| Tier 3/4 との API 非互換 | future-proof 崩壊 | 低 | 未知 opts/handlers 無視 + extra placeholder で拡張点を用意済 |

## 実装順序 (writing-plans で詳細化)

1. **PR-α**: helper + CSS 先行
   - properties.js に `actionBarHtml` / `bindActionBar` 追加
   - mermaid-assist.html に共通 CSS 追加
   - tests/properties.test.js 新規
   - Sequence モジュールを helper 経由に書き換え
2. **PR-β1〜β5**: flowchart / state / class / er / timeline へ順次適用
   - モジュール毎に 1 PR (レビュー粒度最適化)
   - 各 PR に Playwright スクショ
3. **ADR**:
   - ADR-020: アクションバー共通ヘルパ化
   - ADR-021: overlay 選択強調 CSS 汎用化
   - ADR-022: ボタン ID 命名規則

## Out of Scope (明示)

- Tier 3: Move safety / 選択追随 helper (別 spec)
- Tier 4: Rich-label 統合 / Multi-select wrap (別 spec)
- Gantt: 既存 date-drag UI を尊重、対象外
- その他 14 モジュール (architecture / block / c4 / gitgraph / journey /
  kanban / mindmap / packet / pie / quadrant / radar / requirement / sankey):
  本 spec では CSS 自動適用のみ、アクションバー追加は次スプリント以降

## 参考

- `docs/cross-ref/sequence-improvements-applicability.md` — Tier 1〜5 全景
- `docs/cross-ref/direct-manipulation-ux-checklist.md` — 直接操作 UX の観点
- Sequence モジュール既存実装: `src/modules/sequence.js` lines 1080-1110
  (message action-bar べた書き)
- PR #1 (mermaid-assist): https://github.com/KawanoMomo/mermaid-assist/pull/1
