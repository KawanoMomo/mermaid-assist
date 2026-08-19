# Sequence改善の他図形への適用可能性分析

2026-04-24 時点。MermaidAssist の Sequence モジュールに適用した一連の改善を、
他 20 モジュールへの横展開候補として整理した資料。

## 1. Sequenceに対して加えた改善 (すべて PR #1 / feat/selection-toggle-consistency)

| # | 改善 | 性質 |
|---|---|---|
| A | `bindSelectButtons` を `selectItem` (toggle) に差し替え | **全モジュール既適用** (properties.js) |
| B | `ctx.setMmdText` で **同期再 parse** | **全モジュール既適用** (app.js) ← 重大 regression fix |
| C | `.overlay-*.selected` CSS で緑点線強調 | Sequence クラス限定、**パターンは普遍的** |
| D | Click-only selection (mouseup で selectItem) | Sequence + Gantt、**パターン普遍的** |
| E | Rich-label-editor (B / I / <br/>) | Sequence のみ、**Mermaid 対応モジュール全般に適用可** |
| F | Action-bar (↑前に挿入 / ↓後に挿入 / ↑上へ / ↓下へ / 削除) | Sequence のみ、**モジュール固有だが構造普遍** |
| G | Modal insert form (From/To/Arrow/Label + 新規追加 inline) | Sequence 固有 |
| H | Hover-insert guide (y→line resolver) | Sequence 固有だが、**同様のアイデアは flowchart/state/class でも可** |
| I | Drag reorder + drop-indicator (gap semantics, data-id dedup) | Sequence 固有 |
| J | Move 上下で非選択要素が動かない (skip-non-message) | パターン普遍 (移動は同種要素のみで) |
| K | Move 後の選択追随 (id が position ベースなら line 同定で再選択) | パターン普遍 |
| L | Multi-select 範囲 wrap (alt/loop/opt/par) | パターン普遍 (container 持ち図形に適用可) |
| M | Overlay rect for message / note / group | Sequence 固有 |
| N | Participant drag handle (actor-top/-bottom 両端) | Sequence 固有 |

## 2. 他モジュールへの適用マトリクス

凡例:
- ◎ = 強く推奨、ユーザ価値高い
- ○ = 適用可、価値中
- △ = 理論的に適用可だが ROI 低い
- — = 非該当 (構造的に意味を持たない)

| モジュール | C 選択強調 | D Click-select | E Rich-label | F Action-bar | H Hover-insert | J Move同種のみ | K 選択追随 | L Multi-wrap | M/N Overlay |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **flowchart** | ◎ | ◎ | ◎ (node label) | ◎ | ○ (edge 間) | ◎ (node/edge 混在) | ◎ | ◎ (subgraph) | ○ |
| **state** | ◎ | ◎ | ◎ | ◎ | ○ | ◎ | ◎ | ◎ (composite) | ○ |
| **class** | ◎ | ◎ | ○ (class名) | ◎ | △ | ○ | ◎ | △ | ○ |
| **er** | ◎ | ◎ | △ | ◎ | △ | ○ | ◎ | — | ○ |
| **timeline** | ◎ | ○ | ○ | ◎ | ○ | ◎ | ◎ | ◎ (section) | ○ |
| **mindmap** | ◎ | ○ | ○ | ◎ | — (階層) | — | ◎ | — | △ |
| **gitgraph** | ◎ | ○ | ○ | ◎ (commit 順) | △ | ◎ | ◎ | — | △ |
| **kanban** | ◎ | ◎ | ○ | ◎ (card移動) | △ | ◎ | ◎ | — | △ |
| **packet** | ◎ | ○ | △ | ◎ (field 順) | △ | ◎ | ◎ | — | △ |
| **requirement** | ◎ | ◎ | ○ | ◎ | △ | ○ | ◎ | △ | ○ |
| **block** | ◎ | ◎ | ○ | ◎ | ○ | ○ | ◎ | ◎ (既済) | ○ |
| **architecture** | ◎ | ○ | △ | ◎ | △ | ○ | ◎ | — | △ |
| **quadrant** | ○ | ○ | △ | ○ | — | — | ○ | — | △ |
| **xychart** | ○ | △ | — | ○ | — | ◎ | ○ | — | — |
| **pie** | ○ | △ | — | △ (slice 順) | — | △ | ○ | — | — |
| **radar** | ○ | △ | — | △ | — | △ | ○ | — | — |
| **journey** | ○ | ○ | △ | ○ | △ | ◎ | ○ | — | △ |
| **sankey** | ○ | △ | — | △ (flow 順) | — | △ | ○ | — | — |
| **c4** | ○ | ○ | ○ | ○ | △ | — | ○ | △ | ○ |

## 3. 優先度マトリクス (推奨実装順)

### Tier 1 — 全モジュール一律適用 (既適用)

すでに A (toggle-off) と B (sync parse) は全モジュールに効いている。B は特に
「**id 再生成を伴う DSL 書換え全般で発生していた stale parse バグ**」を修正した。
全モジュールで選択追随がおかしい問題は暗黙に解消されている可能性が高い。

### Tier 2 — 低リスク・高 ROI (各モジュール ~1h 程度)

#### 2A. 選択強調 CSS (観点 C)

現在 `.overlay-message.selected` / `.overlay-note.selected` / `.overlay-group.selected`
/ `.overlay-participant-handle.selected` に緑点線適用中。各モジュールの overlay
クラス名 (例: flowchart の `overlay-node`) にも同じ CSS ルールを追加すれば即
ユーザが「選択がどれかわからない」問題を解消できる。

**実装**: mermaid-assist.html の CSS に module-prefix 付きセレクタを追加するだけ。

#### 2B. Action-bar の共通化 (観点 F)

sequence.js にある「↑この前に / ↓この後に / ↑上へ / ↓下へ / 削除」パターンを
`src/ui/properties.js` に **actionBarHtml(idPrefix, options)** ヘルパとして抽出し、
各モジュールの選択パネルから呼び出す。

**期待効果**: 20 モジュールが一貫した操作感になる。

### Tier 3 — 中リスク・モジュール固有 (各 1-2h)

#### 3A. Move up/down で非同種要素を動かさない (観点 J)

sequence.js の `_moveMessageStep` 同様、各モジュールの move 関数を:
- 空行・コメントを skip
- 隣接の非同種行 (別 kind) に当たったら no-op

に統一する。flowchart の edge vs node、state の transition vs state、class の
member vs relation 等、**同じ構造の図形**で同じバグが発生しうる。

#### 3B. 選択追随 helper (観点 K)

id が line ベースで再生成される構造 (message, transition, edge など) は全て
同じバグを抱える。`_findSwapTargetLine` + post-swap re-select のパターンを
module 間で共有化 (ユーティリティ化) する。

### Tier 4 — 価値高いが工数大 (各 2-4h)

#### 4A. Rich-label-editor 統合 (観点 E)

flowchart / state / timeline / block / requirement / kanban の各 label 入力を
rich editor に置換。Mermaid の `<br/>` 対応は全モジュール共通なので動作確認は
最小限で済む。

#### 4B. Multi-select 範囲 wrap (観点 L)

container を持つ図形:
- **flowchart**: `subgraph ... end` で囲む
- **state**: composite state (`state Name { ... }`) で囲む
- **timeline**: `section Name` で区切る
- **block**: 既に一部実装 (要確認)

sequence の `wrapWithBlock` を参考に、各モジュール固有の container DSL に書き換え。

#### 4C. Hover-insert (観点 H)

flowchart の edge 挿入 (node間クリック)、state の transition 挿入 (同じく)、
timeline の event 挿入。Mermaid SVG 構造調査が都度必要。

### Tier 5 — Sequence 専用 (移植価値低)

- G Modal insert form、M/N Overlay specifics、I Drag reorder は Sequence 固有
  の要件。他図形でも drag / modal は欲しくなるかもしれないが、構造がまったく
  違うので別設計推奨。

## 4. 推奨する次の一手

**最も ROI が高い**: Tier 2A + 2B を1スプリントで全モジュール一括対応。

1. **選択強調 CSS** の generic ルール (1h)
   - `.overlay-*.selected` ワイルドカード的セレクタで全モジュールを carpetで
     カバー、または各モジュールの overlay クラス名列挙
2. **actionBarHtml helper** を properties.js に追加 (1h)
3. 上位頻用モジュール (flowchart, state, class, er, timeline) の renderProps で
   action-bar helper を導入 (5 × 30min)

**合計 5h 程度で 5 モジュールの操作感が Sequence と揃う**。

その後 Tier 3 (Move safety) を横断適用、Tier 4 (Rich-label) は個別価値評価
しながら追加。

## 5. 適用「しない」判断もセット

以下は明示的に **やらない** 項目として記録:

- **mindmap の drag reorder**: 階層構造が自然、横入れ替えに意味がない
- **pie / radar / sankey の rich-label**: label が 1 語のラベル中心、装飾不要
- **c4 の subgraph wrap**: C4 自体が container 前提の DSL、既に構造的に表現可能
- **Gantt への Sequence 流儀の適用**: Gantt は独自のタイムライン操作UIが発達済、
  既存の date-drag / bar-move を尊重

---

本資料のベース: PR #1 (https://github.com/KawanoMomo/mermaid-assist/pull/1) で入った
17 commits の改善観点。`docs/cross-ref/direct-manipulation-ux-checklist.md` と
あわせて、新規モジュール実装 / 既存モジュール brush-up の着手前チェックリスト
として参照。
