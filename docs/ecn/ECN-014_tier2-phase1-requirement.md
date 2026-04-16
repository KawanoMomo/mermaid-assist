# ECN-014: Tier2 Phase 1 — Requirement Diagram 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.3.0
- **対象コミット**: `e88272c`, `ba0ceae`, `20cda62`, `2d07389`, `f8056e1`, `c55cd43`, `1b13b2c`, `6f559ae`, `befd238`, `04735dd`, `8e7f053`, `32057c7`, `c521db2`, `23aa1d7`, `94d9344`, `d4a8359`, `577a106`, `f77efa7`, `9101d9f`
- **影響ファイル**: `src/modules/requirement.js`, `src/core/parser-utils.js`, `src/app.js`, `mermaid-assist.html`, `tests/requirement-*.test.js`, `tests/e2e/requirement-basic.spec.js`, `tests/run-tests.js`
- **関連 ADR**: ADR-011, ADR-012, ADR-014, ADR-015, ADR-016
- **関連 spec/plan**: `docs/superpowers/specs/2026-04-17-tier2-phase1-requirement-design.md`, `docs/superpowers/plans/2026-04-17-tier2-phase1-requirement.md`, test-spec (42 REQ/42 EV/42 TC)

## コンテキスト

Tier2 ロードマップ (`2026-04-16-tier2-diagrams-design.md`) Phase 1。組み込み実務 (IEC 61508 等の安全規格) で要件管理・トレーサビリティに使用される Mermaid Requirement Diagram を Tier1 同等の操作粒度で対応する。

## 対策

DiagramModule v2 で実装。ER モジュール骨格を流用:

- **コア要素**: 6 reqType (`requirement` / `functionalRequirement` / `interfaceRequirement` / `performanceRequirement` / `physicalRequirement` / `designConstraint`)
- **element**: type (自由テキスト) / docref (任意)
- **relation 7種**: `contains` / `copies` / `derives` / `satisfies` / `verifies` / `refines` / `traces`
- **operations**: add / delete (cascade) / update / updateName (relation参照追従) / moveUp/Down / connect (Connection Mode 流用)
- **UI**: 縦並びラベル付き追加フォーム (ECN-013 / ADR-015 準拠)、詳細パネル 3種 (requirement / element / relation)

system-tester で 42 REQ / 42 EV / 42 TC、カバレッジ 100% / 禁止語 0 を確保 (ADR-016)。

### 並列対応で発見された不具合と修正

- **Mermaid v11 parser の quote 要件**: `id:` と `text:` (および element の `type:`, `docref:`) に `-` や空白を含む場合は quote が必須。UI 入力値は quote 無しで受け、モジュール側で auto-quote する実装に変更 (commit `d4a8359`)。parse 側では surrounding quote を strip して UI データモデルをクリーンに保つ。
- **app.js 登録順バグ (Tier1 から潜在)**: `_registerWindowModules` が既存スロットをスキップしていたため、inline `modules.gantt` (template 欠落) が外部 `window.MA.modules.gantt` (template 有) を上書き保護し、gantt へ切替時に `TypeError: mod.template is not a function` 発生。merge 方式に変更し欠落プロパティを補完 (commit `577a106`)。visual sweep で初めて顕在化。

## 結果

- **ユニットテスト**: 156 passed / 0 failed (Tier1 113 + Requirement 43 新規)
- **E2E**: 11 passed (`requirement-basic.spec.js`、E25-E32 + 3 switching)
- **system-tester**: カバレッジ 100% / 禁止語 0 / 重複 0 (42 REQ / 42 EV / 42 TC)
- **visual sweep**: PASS (6 reqType + 7 reltype 全描画、console error 0 post-fix)
- **IEC 61508 シナリオ MCP 検証**: PASS (4 requirement + 2 element + 5 relation を property panel UI のみで完成、editor equivalent、SVG rendered)
- v1.3.0 リリース、Tier2 Phase 1 完了

## 教訓

1. **Mermaid v11 の構文厳格性**: 要件ブロックの値は quote 推奨 (`id: "REQ-001"` など)。parse/update 両面で quote の扱いを設計段階で明確化しておくべき。既存モジュール (ER, Class, etc.) も quote 対応の必要性を見直す余地あり。
2. **Tier1 潜在バグが Phase 追加で顕在化**: `_registerWindowModules` のスキップ実装は Tier1 時点から存在したが、gantt↔他図形の切替シナリオで visual sweep を走らせて初めて顕在化した。今後は Phase 着手時に既存図形 ↔ 新図形切替の console error チェックを defaultsweep に含めるべき。
3. **ブラウザキャッシュ artifact**: Python `http.server` は `Cache-Control` ヘッダーを出さないため、Playwright persistent context が古い JS を配信し false FAIL を生む。Evaluator プロトコルで sweep 開始時 `Network.clearBrowserCache` via CDP を必須化することを推奨 (ADR-014 の evaluator 運用ルールに追記候補)。
4. **UX 観察**: 要素追加直後に詳細パネルが add form を置き換えるため、連続追加には add form への復帰操作が必要。現状は空領域クリック (selection clear) で復帰するが、直感性向上のため `+ 要件追加` ボタンで追加時に detail パネルに遷移せず add form のままにするオプションを将来検討。
