# Tier1 全Mermaid図形対応 設計仕様書

**日付:** 2026-04-14
**ステータス:** Draft
**対象:** E:\00_Git\05_MermaidAssist
**前提:** v0.4.0 (Gantt 単体対応版) を基盤として拡張

## 1. コンセプト

MermaidAssist を Gantt 単体ツールから **マルチ図形対応のMermaid統合GUIエディタ** に拡張する。Tier1 として最も使用頻度の高い5図形（Sequence, Flowchart, State, Class, ER）を、Gantt と同等の編集粒度（コア要素 + サブ要素のフルカバー）で実装する。

操作モデルは構造化フォーム方式に統一し、Gantt の「ドラッグで日付操作」のような figureに固有のメタファーは持ち込まない。各図形要素を「クリックで選択 → プロパティパネルで編集 → 追加/削除はボタン → エッジは connection mode で接続」で操作する。

## 2. 全体アーキテクチャ

### 2.1 ファイル構成

単一HTML配布の利便性を維持しつつ、JSを外部ファイルに分割（ビルドステップなし、`<script src="...">` で個別読み込み）。

```
mermaid-assist.html             ← 配布用エントリ（HTML + CSS + script tags）
src/
  app.js                        ← Init, グローバル状態, パイプライン制御
  ui/
    toolbar.js                  ← Open/Save, Undo/Redo, Zoom, Export, 図種select
    editor.js                   ← textarea + 行番号
    preview.js                  ← mermaid.js 描画 + zoom
    overlay.js                  ← オーバーレイ層 + 共通選択ハンドラ
    properties.js               ← プロパティパネル基盤
    statusbar.js                ← ステータス表示
  core/
    parser-utils.js             ← 共通パース helpers (行番号, ID生成, タイプ検出)
    text-updater.js             ← 共通テキスト更新 (line replace, insert, delete)
    history.js                  ← Undo/Redo スタック (max 80)
    selection.js                ← sel = [{type, id}] 選択モデル
    connection-mode.js          ← クリック2回でエッジ作成 共通機構
  modules/
    gantt.js                    ← 既存ロジックを移行 (Phase 0)
    sequence.js                 ← Phase 1
    flowchart.js                ← Phase 2
    state.js                    ← Phase 3
    class.js                    ← Phase 4
    er.js                       ← Phase 5
lib/
  mermaid.min.js                ← 既存
  LICENSE.mermaid               ← 既存
```

`mermaid-assist.html` の `<body>` 末尾で必要な `<script>` を順序付きで読み込む。CSPは `script-src 'self' 'unsafe-inline'` 相当（mermaid.js もインライン使用しているため）。

### 2.2 DiagramModule インターフェース（改訂版）

```javascript
const DiagramModule = {
  // メタ情報
  type:        "sequence"            // 図種識別子
  displayName: "Sequence"            // toolbarのselect表示名

  // 検出・パース
  detect(text)                       → bool        // 第1キーワードで判定
  parse(text)                        → ParsedData

  // 描画
  buildOverlay(svgEl, parsed)        → void        // overlayEl にDOM配置
  renderProps(sel, parsed)           → void        // propsEl にHTML配置

  // 編集プリミティブ（共通名で各図形が実装）
  operations: {
    add(text, kind, props)           → text        // 要素追加
    delete(text, lineNum)            → text        // 行削除
    update(text, lineNum, field, val)→ text        // フィールド更新
    moveUp(text, lineNum)            → text        // ↑移動（同階層内）
    moveDown(text, lineNum)          → text        // ↓移動（同階層内）
    connect(text, fromId, toId, props)→ text       // エッジ/関係作成
  }

  // エクスポート
  exportMmd(parsed)                  → text        // 正規化Mermaid出力

  // テンプレート（新規作成時のひな型）
  template()                         → text        // 空状態テンプレート
}
```

#### ParsedData の標準形（全図形共通の最小構造）

```javascript
{
  meta: { ... },                     // 図形ごとの全体設定（title, direction等）
  elements: [
    {
      kind: "node" | "actor" | "state" | ...,  // 要素種別
      id: "A",                                  // 一意ID（無ければauto生成）
      line: 12,                                 // 1-based行番号 (ADR-003)
      label: "Start",                           // 表示ラベル
      ...                                       // 図形固有の属性
    },
  ],
  relations: [                       // エッジ・関係（無向/有向問わず）
    {
      kind: "edge" | "message" | "transition" | "relationship",
      from: "A", to: "B",
      id: "__rel_1",                 // 自動生成（テキストには出さない）
      line: 15,
      label: "...", style: "...",
    }
  ],
  groups: [                          // サブ要素（subgraph, loop, alt, composite等）
    {
      kind: "subgraph" | "loop" | "alt" | "note" | ...,
      id: "...", line: ..., label: "...",
      children: [...],               // ネストする場合の子要素ID参照
    }
  ]
}
```

各図形モジュールは必ずしも全フィールドを使う必要はない。ER のように `groups` が空の図形もある。

### 2.3 共通インフラの責務

| インフラ | 役割 | 適用範囲 |
|---|---|---|
| `core/parser-utils.js` | 行番号付与、空行/コメントスキップ、`__auto_N` ID生成、第1キーワード抽出 | 全モジュールから利用 |
| `core/text-updater.js` | `replaceLine(text, n, content)`, `insertAt(text, n, content)`, `deleteLine(text, n)`, `swapLines(text, a, b)` | 全モジュールから利用 |
| `core/history.js` | `pushHistory()`, `undo()`, `redo()`, max 80 | app共通 |
| `core/selection.js` | `selectItem(type, id, multi)`, `clearSelection()`, `isSelected(id)` | 全モジュールから利用 |
| `core/connection-mode.js` | エッジ作成モードへの遷移、ソース選択→ターゲット選択→`module.operations.connect()` 呼び出し | 全モジュールから利用 |
| `ui/properties.js` | タイトルヘッダ + ↑↓ボタン + 削除ボタンの共通レンダラ、共通フィールド入力 binders (`bindTextField`, `bindSelectField`) | 全モジュールから利用 |
| `ui/overlay.js` | mousedown ハンドラ、`data-element-id` / `data-line` 属性によるクリック委譲 | 全モジュールから利用 |

### 2.4 ADR適用ポイント（拡張）

| ADR | 適用箇所 |
|-----|---------|
| ADR-001 | 全図形のオーバーレイ要素に `data-element-id` `data-line` 属性、ブラウザイベント伝播を利用 |
| ADR-002 | 選択モデルは `sel = [{type, id}, ...]` で全モジュール統一 |
| ADR-003 | 全要素にDSL行番号を付与（`__auto_N` 仮IDも） |
| ADR-006 | GUI操作時にMermaidテキストを正規化して書き戻し |
| ADR-008 | mermaid.js SVG オーバーレイ方式は全図形で踏襲 |
| ADR-009 | DiagramModule インターフェースを Phase 0 で改訂 |

## 3. Phase 0: 共通基盤整備

### 3.1 リファクタリング作業

1. **ディレクトリ構造作成** — `src/{ui,core,modules}/` を作成
2. **Gantt モジュール分離** — 既存の Gantt 関連コードを `src/modules/gantt.js` に移動。グローバル変数経由ではなくモジュール export 経由でアクセス
3. **共通インフラ抽出** — 現在 `mermaid-assist.html` 内に散在するロジックを `src/core/`, `src/ui/` に移動
4. **HTMLエントリの薄化** — `mermaid-assist.html` は HTML + CSS + script タグのみ
5. **既存テスト全合格を維持** — Phase 0 完了時点で 90 E2E + 35 Unit テスト全 PASS

### 3.2 共通インフラ API（公開関数）

#### `core/parser-utils.js`
```javascript
detectDiagramType(text)          // → "gantt"|"sequenceDiagram"|"flowchart"|... | null
splitLinesWithMeta(text)         // → [{lineNum, raw, trimmed, isComment, isBlank}]
generateAutoId(prefix, counter)  // → "__auto_5"
isAutoId(id)                     // → bool
```

#### `core/text-updater.js`
```javascript
replaceLine(text, lineNum, newContent)
insertAfter(text, lineNum, newContent)
insertBefore(text, lineNum, newContent)
deleteLine(text, lineNum)
swapLines(text, lineA, lineB)
appendToFile(text, newContent)
```

#### `core/history.js`
```javascript
pushHistory()                    // 副作用: グローバル mmdText を保存
undo()                           // mmdText を復元
redo()
canUndo() / canRedo()
```

#### `core/selection.js`
```javascript
selectItem(type, id, multi)
clearSelection()
isSelected(id)
getSelected()                    // → [{type, id}]
```

#### `core/connection-mode.js`
```javascript
startConnectionMode(sourceType, sourceId, onComplete)
cancelConnectionMode()
isInConnectionMode()
```

#### `ui/properties.js`
```javascript
renderHeader(label, options)     // タイトル + ↑↓ + 削除ボタン
bindTextField(elId, lineNum, field)
bindSelectField(elId, lineNum, field, options)
bindMoveButtons(taskLine, moveFn)
```

### 3.3 既存機能の互換性保証

Phase 0 では機能変更ゼロを目標とする。完了基準:
- 既存 90 E2E テスト全 PASS
- 既存 35 Unit テスト全 PASS
- ブラウザでHTMLを開いて Gantt の全機能が動作

## 4. Phase 1-5 概要

各 Phase は独立した spec → plan → 実装 → リリースサイクルを持つ。本仕様書では概要のみ記載し、各 Phase 着手時に個別の詳細仕様を作成する。

### 4.1 Phase 1: Sequence Diagram

**対象:** プロトコル設計、組み込みの通信シーケンス記述で頻出。

**コア要素:**
- `participant`/`actor` (参加者) — alias, name, type
- `message` (メッセージ) — from, to, type (`->`/`-->`/`->>`/`-->>`/`-x`/`--x`/`-)`/`--)`), label

**サブ要素:**
- `loop ... end` — ループブロック
- `alt ... else ... end` — 条件分岐
- `par ... and ... end` — 並列
- `opt ... end` — オプション
- `note left/right/over of <actor>` — ノート
- `autonumber` — 自動採番

**主要操作:**
- 参加者の追加/削除/順序変更（左右）
- メッセージの追加/削除/順序変更（上下）
- ブロック（loop/alt/par/opt）の追加/削除/ネスト
- ノート追加

### 4.2 Phase 2: Flowchart

**対象:** 処理フロー、状態判断ロジックで頻出。

**コア要素:**
- `node` — id, label, shape (`[]`/`()`/`{}`/`[/...\\]`/`((...))`/`>...]`/`{{...}}` 等)
- `edge` — from, to, type (`-->`/`---`/`-.->`/`==>` 等), label

**サブ要素:**
- `subgraph ... end` — グルーピング
- `classDef <name> <styles>` — スタイル定義
- `class <node> <className>` — クラス適用
- `direction TD|LR|BT|RL` — グラフ全体の方向

**主要操作:**
- ノード追加（shape 選択）
- エッジ追加（connection mode）
- ノード形状変更
- subgraph 作成・ノード移動
- direction 変更
- classDef 編集 + class 適用

### 4.3 Phase 3: State Diagram

**対象:** ステートマシン設計、組み込みで頻出（既存04_StableStateとは別軌道、Mermaid標準対応）。

**コア要素:**
- `state` — id, label, type (normal/start/end)
- `transition` — from, to, event/label

**サブ要素:**
- `state ... { ... }` — composite state（ネスト）
- `<<fork>>` `<<join>>` — fork/join
- `<<choice>>` — choice node
- `note left/right of <state>` — ノート

**主要操作:**
- 状態追加（type 選択）
- 遷移追加（connection mode）
- composite state の作成・ネスト
- start/end の追加
- fork/join/choice の追加

### 4.4 Phase 4: Class Diagram

**対象:** OO設計、(C++/C#/Java環境) で利用。組み込みC言語では使用頻度低。

**コア要素:**
- `class <Name>` — クラス
- members: attribute (`+name: Type`), method (`+method() Type`)
- relations: inheritance (`<|--`), composition (`*--`), aggregation (`o--`), association (`-->`), dependency (`..>`), realization (`<|..`)

**サブ要素:**
- `namespace <Name> { ... }` — 名前空間
- generic types (`Class~T~`)
- callback annotations

**主要操作:**
- クラス追加・削除
- メンバ追加（visibility/name/type/method or attr）
- 関連線追加（type 選択）
- namespace でグルーピング

### 4.5 Phase 5: ER Diagram

**対象:** DB設計、リレーショナルデータモデル。最もシンプル。

**コア要素:**
- `entity` — name, attributes (PK/FK marker, type, name)
- `relationship` — from, to, cardinality (`||--o{`/`}|--||`等), label

**サブ要素:** （Mermaid ER は比較的シンプル、サブ要素少ない）

**主要操作:**
- エンティティ追加
- 属性追加（type, key 設定）
- 関係追加（cardinality 選択）

## 5. テスト戦略

### 5.1 階層

| レイヤ | 対象 | フレームワーク |
|---|---|---|
| Unit | `core/*.js`, 各モジュールの parse/update 関数 | Node.js custom runner（既存踏襲） |
| E2E | ブラウザでの操作と表示 | Playwright（既存踏襲） |
| Evaluation | ユーザー観点の品質基準 | Playwright（既存 brushup-evaluation 形式踏襲） |

### 5.2 Phase ごとのテスト追加方針

各 Phase で以下を作成:
- `tests/<diagram>-parser.test.js` — パーサー単体
- `tests/<diagram>-updater.test.js` — 編集プリミティブ
- `tests/e2e/<diagram>-basic.spec.js` — E2E基本動作
- `tests/e2e/<diagram>-evaluation.spec.js` — ユーザー観点評価項目（E01-EnnのID連番継続）

Phase 0 完了時点で既存テストが全PASSすることを必達条件とする。

### 5.3 評価ID連番

既存 E01-E14 に続いて、各 Phase で評価項目を連番で追加。各 Phase の詳細仕様策定時に正確な範囲を確定する。

| Phase | 評価ID範囲（目安） |
|---|---|
| Phase 0 (リファクタ) | 既存合格維持のみ。新規評価なし |
| Phase 1 Sequence | E15 から開始 |
| Phase 2 Flowchart | Phase 1 完了時点の連番から開始 |
| Phase 3 State | Phase 2 完了時点の連番から開始 |
| Phase 4 Class | Phase 3 完了時点の連番から開始 |
| Phase 5 ER | Phase 4 完了時点の連番から開始 |

## 6. リリースプラン

| バージョン | 内容 |
|---|---|
| v0.5.0 | Phase 0 完了（リファクタ + 共通基盤、機能等価） |
| v0.6.0 | Phase 1 Sequence 完了 |
| v0.7.0 | Phase 2 Flowchart 完了 |
| v0.8.0 | Phase 3 State 完了 |
| v0.9.0 | Phase 4 Class 完了 |
| v1.0.0 | Phase 5 ER 完了（Tier1 全図形対応 = 1.0 リリース） |

各 Phase 完了時点で master にマージ・タグ付与・GitHub に push。

## 7. ADR 追加予定

| ADR | タイトル | 概要 |
|-----|---------|------|
| ADR-011 | JS外部分割によるモジュール構造 | 単一HTML維持しつつ `src/{core,ui,modules}/*.js` に分割。ビルドステップなし。 |
| ADR-012 | DiagramModule v2 インターフェース | `operations` オブジェクト統一、`groups` 概念追加、`connect` プリミティブ標準化 |
| ADR-013 | Connection Mode による汎用エッジ作成 | クリック2回でソース→ターゲット指定、全図形で共通利用 |
| ADR-014 | サブ要素 (groups) のパース・編集モデル | composite state, subgraph, loop/alt/par 等の階層構造を統一表現 |

## 8. スコープ外（将来）

- Tier2 図形: User Journey, Pie, Quadrant, Mindmap, Timeline, Gitgraph, Sankey, XY chart, C4, ZenUML, Block, Packet, Architecture, Requirement
- VSCode拡張・MCP Server統合
- リアルタイム共同編集
- バンドラー導入（必要になれば ADR-015 で検討）
- カスタムレイアウト（Mermaid自動レイアウトを上書き）
