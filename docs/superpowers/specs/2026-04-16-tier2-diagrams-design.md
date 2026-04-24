# Tier2 Diagrams Roadmap Design Spec

- **作成日**: 2026-04-16
- **ステータス**: 承認待ち
- **対象バージョン**: v1.3.0 〜 v1.7.0 (5 Phase)
- **前提**: Tier1 完成 (v1.0.0 / Gantt + Sequence/Flowchart/State/Class/ER)
- **関連 ADR**: ADR-011（JS外部化）, ADR-012（DiagramModule v2）, ADR-014（visual verification）, ADR-015（vertical relation form）, ADR-016（system-tester integration）
- **関連 ECN**: ECN-011（Tier1完了）, ECN-012（properties helpers）, ECN-013（add form unification）

## ゴール

Mermaid の主要図形のうち、組み込みエンジニア実務で価値の高い5図形を Tier1 と同等の操作粒度で対応する。各 Phase = 1リリース、Phase ごとに独立検証可能。

## スコープ

### 対象 5 図形

| 順序 | Phase | 図形 | バージョン | 想定ユースケース |
|---|---|---|---|---|
| 1 | Phase 1 | Requirement Diagram | v1.3.0 | 安全規格（IEC 61508等）の要件管理、トレーサビリティ |
| 2 | Phase 2 | Block Diagram | v1.4.0 | システムブロック分割、ハードウェア構成図 |
| 3 | Phase 3 | Timeline | v1.5.0 | リリース計画、開発スケジュール |
| 4 | Phase 4 | Mindmap | v1.6.0 | 設計検討、機能ブレスト |
| 5 | Phase 5 | Gitgraph | v1.7.0 | 開発フロー・ブランチ戦略の説明 |

### 対象外

- Pie / Quadrant / XY Chart（実務頻度低）
- Journey（UX設計用、組み込み開発外）
- Sankey / C4 / Packet / Architecture（次段階以降で検討）

## アーキテクチャ

Tier1 で確立済みパターンを全面流用する:

- **DiagramModule v2 インターフェース** (ADR-012): `parse / buildOverlay / renderProps / operations { add, delete, update, moveUp, moveDown, connect }` の標準シグネチャ
- **window.MA.properties ヘルパー** (ECN-012): `fieldHtml / selectFieldHtml / panelHeaderHtml / sectionHeaderHtml/FooterHtml / listItemHtml / emptyListHtml / primaryButtonHtml / dangerButtonHtml / bindEvent / bindAllByClass / bindSelectButtons / bindDeleteButtons / bindFieldChange`
- **縦並びラベル付き追加フォーム** (ADR-015 / ECN-013): リレーション系追加 UI は縦1列・ラベル付きで統一
- **配布形態**: 単一 HTML (mermaid-assist.html)、ビルドステップなし、JS 外部分割 (src/{core,ui,modules}/*.js)
- **mermaid.js v11**: lib/mermaid.min.js 既存版を利用、experimental 図形 (`block-beta` / `mindmap` / `gitGraph`) は Phase 開始時に動作確認

## 各図形の操作仕様

### Phase 1: Requirement Diagram (v1.3.0)

- **Mermaid 構文**:
  - `requirementDiagram`
  - `requirement <Name> { id: <id>, text: <text>, risk: <Low|Medium|High>, verifymethod: <Analysis|Inspection|Test|Demonstration> }`
  - `element <Name> { type: <type>, docref: <ref> }`
  - リレーション: `<elem> - <reltype> -> <req>` （reltype 7種: contains / copies / derives / satisfies / verifies / refines / traces）
- **コア要素**: requirement, element, relation
- **operations**: add-requirement / add-element / add-relation / update-field / delete / moveUp / moveDown
- **connect**: リレーション作成 (Connection Mode 利用)
- **サブ選択**: risk 3種、verifyMethod 4種、reltype 7種をすべて selectFieldHtml で提供

### Phase 2: Block Diagram (v1.4.0)

- **Mermaid 構文**:
  - `block-beta`
  - `columns N` / `block:ID` / 入れ子 `block:Outer columns 2 inner1 inner2 end` / 矢印 `A --> B`
- **コア要素**: block, link, column 設定
- **サブ要素**: nested block (block 内に block を入れ子配置)
- **operations**: add-block (standalone / nested) / add-link / update-text-style / delete / moveUp / moveDown
- **connect**: 矢印リンク作成
- **サブ選択**: column 数 (1〜N)、nested block 階層

### Phase 3: Timeline (v1.5.0)

- **Mermaid 構文**:
  - `timeline`
  - `title <タイトル>` / `section <セクション名>` / `<period> : <event>` （複数 event 可: `: e1 : e2`）
- **コア要素**: title, section, period, event
- **operations**: add-section / add-period / add-event / update / delete / moveUp / moveDown
- **connect**: なし（時系列順序を moveUp/Down で管理）
- **サブ選択**: section 帰属、period への複数 event 追加

### Phase 4: Mindmap (v1.6.0)

- **Mermaid 構文**:
  - `mindmap`
  - インデントベースの tree（半角スペース 2 でレベル区切り）
  - shape: `id[text]` square / `id((text))` circle / `id))text((` bang / `id)text(` cloud / `id{{text}}` hexagon / default
  - icon: `::icon(fa fa-book)` / class: `:::className`
- **コア要素**: root, node
- **サブ要素**: 階層 (indent / outdent)、shape、icon
- **operations**: add-node (child / sibling) / indent / outdent / update-shape-icon / delete / moveUp / moveDown
- **connect**: tree 構造固定、明示接続なし
- **サブ選択**: shape 6種、icon

### Phase 5: Gitgraph (v1.7.0)

- **Mermaid 構文**:
  - `gitGraph`
  - `commit id:"x" type: NORMAL|REVERSE|HIGHLIGHT tag:"v1"` / `branch <name>` / `checkout <name>` / `merge <name>` / `cherry-pick id:"x"`
- **コア要素**: commit, branch, merge
- **サブ要素**: tag, commit type
- **operations**: add-commit / add-branch / add-merge / cherry-pick / update / delete / moveUp / moveDown
- **connect**: branch切替 + merge 特殊操作
- **サブ選択**: commit type 3種、tag 文字列

## Phase 共通フロー

各 Phase で以下の 6 ステップを実施する:

1. **spec 作成**: Phase 専用 design.md を `docs/superpowers/specs/YYYY-MM-DD-tier2-phaseN-<diagram>-design.md` に作成。本ロードマップspecから該当図形セクションを起点に詳細化
2. **system-tester** (ADR-016): spec から REQ / EV / TC を構造化抽出。カバレッジ100% / 禁止語0 を目標
3. **writing-plans**: TDD 手順とサブ要素を含めたタスク分解
4. **subagent-driven-development**: 並列 worktree で実装、spec compliance + code quality 二段レビュー
5. **evaluator**: visual sweep + E2E 実機検証 (ADR-014, feedback_visual_verification)
6. **ECN/ADR 追記**: 設計判断や教訓を ECN-NNN.md に追記、必要なら ADR 追加。タグプッシュでリリース

## テスト・検証戦略

### Phase ごとの検証項目

- **ユニットテスト**: parse / 各 operation で 10〜15 ケース (`tests/<diagram>-*.test.js`)
- **E2E**: Playwright で基本操作 6〜10 ケース (`tests/e2e/<diagram>-basic.spec.js`)
- **system-tester 出力**: REQ / EV / TC 構造化、カバレッジ 100%、禁止語 0
- **visual sweep**: evaluator で実機スクリーンショット、console error 0
- **実用シナリオ MCP 検証**: 1〜2 件 / Phase
  - Phase 1 (Requirement): IEC 61508 風安全要件記述シナリオ
  - Phase 2 (Block): ECU ハードウェア構成図シナリオ
  - Phase 3 (Timeline): プロジェクトリリース計画シナリオ
  - Phase 4 (Mindmap): 機能設計ブレストシナリオ
  - Phase 5 (Gitgraph): GitFlow 説明シナリオ

### Phase 完了基準 (Definition of Done)

- 全 unit + E2E テスト PASS
- system-tester 出力でカバレッジ 100% / 禁止語 0
- visual sweep で console error 0
- 実用シナリオ MCP 検証 PASS
- ECN 1 件以上記載、必要なら ADR 追記
- master ブランチにマージ、`vX.Y.Z` タグプッシュ

## リリース戦略

- 各 Phase = 1 リリース (Tier1 同様の段階方式)
- バージョン: v1.3.0 → v1.4.0 → v1.5.0 → v1.6.0 → v1.7.0
- 完了時点で v1.7.0 = Tier2 完備マイルストーン

## 想定リスクと対応

| リスク | 影響 | 対応 |
|---|---|---|
| Mermaid v11 で experimental 図形 (`block-beta` / `mindmap` / `gitGraph`) が描画失敗 | Phase 着手不能 | Phase 開始時の最初のタスクで lib/mermaid.min.js での動作確認を必須化、失敗時は ECN で記録し代替 (mermaid バージョン上げ等) を検討 |
| Requirement の `<reltype>` 7種誤入力で描画失敗 | UX 低下 | 自由入力ではなく selectFieldHtml で7種固定提示 |
| Gitgraph の branch / merge 操作が moveUp/Down で構文崩壊 | 編集不能 | Gitgraph は moveUp/Down の対象を「ブランチ内 commit のみ」に制限、または専用操作 (cherry-pick) で代替 |
| Mindmap の indent ベース構文が moveUp/Down で階層崩壊 | 編集不能 | indent / outdent 操作で階層を明示制御、moveUp/Down は同階層内のみ許可 |
| 並列改修時の alias 不整合 (ECN-013 で発生済み) | 実装後にエラー | 各モジュールで `var P = window.MA.properties` で統一する規約を ADR-015 に従い徹底 |

## スコープ外 (将来検討)

- Tier3 候補: Pie / Quadrant / XY / Sankey / C4 / Packet / Architecture / Journey
- 図形横断機能 (図形タイプ切替、図形変換、テンプレート集) は Tier2 完了後に検討

## 次のステップ

本ロードマップ承認後、Phase 1 (Requirement Diagram) の専用 design.md を作成し brainstorming を再起動する。Phase 1 の writing-plans → 実装は本 spec と独立して進む。
