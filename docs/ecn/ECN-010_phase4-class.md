# ECN-010: Phase 4 — Class Diagram 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v0.9.0
- **対象コミット**: `0076727`
- **影響ファイル**: `src/modules/class.js`, `tests/class-*.test.js`, `tests/e2e/class-basic.spec.js`, `mermaid-assist.html`

## コンテキスト

OO 設計（C++/C#/Java環境）で利用される Class Diagram を Tier1 第4弾として実装。組み込みC言語では使用頻度低だが、Tier1 完備のため対応。

## 対策

DiagramModule v2 で実装:

- **コア要素**: class（block + standalone 両形式）, members (attribute / method)
- **可視性 4種**: `+` public, `-` private, `#` protected, `~` package
- **関連 7種**: `<|--` 継承, `<|..` 実現, `*--` 集約, `o--` 集成, `-->` 関連, `..>` 依存, `--` リンク
- **サブ要素**: namespace（クラスをグループ化）

実装時の注意: メンバ regex を1パスで書こうとしたら `+eat() void`（Mermaid はメソッド戻り値を space で区切る）が attribute regex で誤認される問題発生。method regex 先 → attribute fallback の2段にして解決。

## 結果

- 11 ユニット + 7 E2E 追加、合計 104 unit + 117 E2E 全 PASS
- v0.9.0 リリース
