# ECN-015: Tier2 Phase 2 — Block Diagram 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.4.0
- **対象コミット**: `45409f4`, `4eab3e2`, `1b910bb`, `2095b81`, `851ba98`, `9764c83`
- **影響ファイル**: `src/modules/block.js`, `src/core/parser-utils.js`, `mermaid-assist.html`, `tests/block-*.test.js`, `tests/e2e/block-basic.spec.js`, `tests/run-tests.js`
- **関連 ADR**: ADR-011, ADR-012, ADR-014, ADR-015, ADR-016
- **関連 spec/plan**: `docs/superpowers/specs/2026-04-17-tier2-phase2-block-design.md`, `docs/superpowers/specs/2026-04-17-tier2-phase2-block-test-spec.md` (30 REQ / 30 EV / 30 TC), `docs/superpowers/plans/2026-04-17-tier2-phase2-block.md`

## コンテキスト

Tier2 ロードマップ Phase 2。組み込み実務の ECU ハードウェア構成図・システムブロック分割に用いる Mermaid Block Diagram (`block-beta`) を Tier1 同等の操作粒度で対応する。

## 対策

DiagramModule v2 で実装:

- **コア要素**: block (standalone / nested), group (`block:ID ... end`), link (`-->` / `-- label -->`)
- **operations**: add (block / nested / link) / delete (cascade link on block removal) / update (label / link field) / moveUp/Down / connect (Connection Mode) / setColumns
- **UI**: 縦並びラベル付き追加フォーム 4種 (Columns / Block / Group / Link) + 詳細パネル 2種 (block/group, link)
- **mermaid.js v11**: `block-beta` 構文で動作確認済み、nested ブロック・label 付きリンク対応

system-tester で 30 REQ / 30 EV / 30 TC、カバレッジ 100% / 禁止語 0 を確保 (ADR-016)。

### 開発中に発見・修正した UX Gap

- **Link From/To プルダウンに group が含まれない**: 初版では blocks のみを候補化していたため、group を endpoint とするリンクが UI 単独で追加できなかった。visual sweep で evaluator が検出し、即修正 (commit `851ba98`) で groups を include。

## 結果

- **ユニットテスト**: 183 passed / 0 failed (Phase 1 時点 156 + Block 27 新規)
- **E2E**: 11 passed (`block-basic.spec.js`、E33-E40 + 3 switching)
- **system-tester**: 30 REQ / 30 EV / 30 TC、カバレッジ 100% / 禁止語 0
- **visual sweep**: PASS (columns 1/2/3/4 + nested + link label + cross-switch 全通過、console error 0)
- **ECU HW シナリオ MCP 検証**: PASS (3 sensor + MCU group [3 nested] + 3 output + 6 link を property panel UI のみで完成)
- v1.4.0 リリース (push は Tier2 完備時にまとめて)

## 教訓

1. **Link UI は endpoint に group も含めるべき**: flowchart/sequence ではエッジ endpoint = block のみで済んだが、block-beta では group も有効 endpoint。今後の図形設計でも endpoint の取りうる種類を初期実装時に洗い出すことを推奨。
2. **ブラウザキャッシュ問題の再発**: Phase 1 で発覚した Python `http.server` のキャッシュ挙動が Phase 2 でも再発。evaluator が CDP `Network.clearBrowserCache` を標準プロトコル化して解消。今後の sweep 定型手順として ADR-014 に追記検討。
3. **block-token 正規表現の慎重な扱い**: block 行に複数トークン (`a["A"] b["B"] c["C"]`) が並ぶため、delete 時に「その token のみ削除」ロジックが必要。ER/Flowchart と異なる注意点。
