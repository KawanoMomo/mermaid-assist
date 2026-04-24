# ECN-016: Tier2 Phase 3 — Timeline 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.5.0
- **対象コミット**: `13db506`, `db4a1d2`, `d0287a8`
- **影響ファイル**: `src/modules/timeline.js`, `src/core/parser-utils.js`, `mermaid-assist.html`, `tests/timeline-*.test.js`, `tests/e2e/timeline-basic.spec.js`, `tests/run-tests.js`
- **関連 ADR**: ADR-011, ADR-012, ADR-014, ADR-015, ADR-016
- **関連 spec/plan**: Phase 3 design/test-spec/plan (31 REQ / 31 EV / 31 TC)

## コンテキスト

Tier2 Phase 3。組み込み実務のリリース計画・開発スケジュール記述に用いる Mermaid Timeline を Tier1 同等粒度で対応。

## 対策

DiagramModule v2:

- **コア要素**: title, section, period (events 複数可), event
- **operations**: setTitle / addSection / addPeriod / addEventToPeriod / deleteElement (section cascade) / updateSection / updatePeriod (period text or specific event) / deleteEvent (個別イベント削除) / moveUp/Down
- **UI**: Title 設定 + 3 追加フォーム (Section / Period / Event-to-Period) + 詳細パネル 2種 (section / period w/events list)
- **connect**: なし (timeline は時系列)

## 結果

- **ユニット**: 200 passed (Phase 2 時点 183 + Timeline 17 新規)
- **E2E**: 11 passed (E41-E48 + 3 switching)
- **system-tester**: 31 REQ / 31 EV / 31 TC, coverage 100%
- **visual sweep**: PASS (multi section / multi event / cross-switch 全通過、console error 0)
- **リリース計画シナリオ MCP**: PASS (3 sections × 8 periods × 1 multi-event period を UI のみで完成、target と完全一致)
- v1.5.0 リリース (push Tier2 完備時にまとめて)

## 教訓

1. **Mermaid timeline の構文柔軟性**: period 行は `date : event` 形式で複数 event は ` : ` 区切り。parse/update の実装で event index を扱う必要がある。
2. **Section cascade delete**: Timeline では section 削除時にその下の period も削除すべき (ECN-014/015 と同じ cascade pattern)。
3. **Selection clear between adds**: 要件 (Phase 1) と同様に、詳細パネルが add form を置き換える挙動のため、連続 add 時に selection clear が必要。UX 改善余地あり。
