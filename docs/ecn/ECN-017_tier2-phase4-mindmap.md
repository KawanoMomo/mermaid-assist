# ECN-017: Tier2 Phase 4 — Mindmap 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.6.0
- **対象コミット**: `42ce262`, `e868b2f`, `4a31177`
- **影響ファイル**: `src/modules/mindmap.js`, `src/core/parser-utils.js`, `mermaid-assist.html`, `tests/mindmap-*.test.js`, `tests/e2e/mindmap-basic.spec.js`, `tests/run-tests.js`
- **関連 ADR**: ADR-011, ADR-012, ADR-014, ADR-015, ADR-016
- **関連 spec**: Phase 4 design (28 REQ) / test-spec (29 EV/TC)

## コンテキスト

Tier2 Phase 4。機能設計ブレスト・構造検討に用いる Mermaid Mindmap を Tier1 同等粒度で対応。

## 対策

DiagramModule v2:

- **コア要素**: root, node (tree 階層)
- **shape 6種**: default / square `[]` / rounded `()` / circle `(())` / bang `))((` / cloud `)(` / hexagon `{{}}`
- **icon / class**: `::icon(fa fa-xxx)` / `:::className` を preceding node に attach
- **operations**: addChild / addSibling / indent / outdent / updateNodeText / setIcon / deleteNode (subtree cascade) / moveUp/Down
- **connect**: なし (tree 構造固定)
- **UI**: 親ノード select + Text + Shape の縦並び追加フォーム + 詳細パネル (Text/Shape/Icon/indent/outdent/削除)

parse は indent-based stack walk で parent-child 復元。

## 結果

- **ユニット**: 222 passed (Phase 3 時点 200 + Mindmap 22 新規)
- **E2E**: 11 passed (E49-E56 + 3 switching)
- **system-tester**: 28 REQ / 29 EV / 29 TC, coverage 100%
- **visual sweep**: PASS (6 shapes + icon + 4-level nesting + cross-switch 全通過、console error 0)
- **組み込み設計シナリオ MCP**: PASS (14 nodes, 4階層, 1 icon を UI のみで完成)
- v1.6.0 リリース

## 教訓

1. **FontAwesome 未バンドル**: `::icon(fa fa-xxx)` は parse・model で保持されるが SVG glyph 描画されない (FA CSS 未ロード)。model 的には正しいので PASS だが、将来 FA bundle で visual 改善可能。
2. **Indent-based parse のシンプルさ**: stack-based walk で階層復元するパターンが mindmap に綺麗に機能。Tier1 の explicit parent 指定パターンと異なるが、コードは簡潔になる。
3. **Shape detection order**: 長い delimiter (((/)))) を先に match しないと短い方 ((/)) が誤判定する。regex 順序が重要。
