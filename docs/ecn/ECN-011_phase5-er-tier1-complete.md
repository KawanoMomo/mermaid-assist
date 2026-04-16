# ECN-011: Phase 5 — ER Diagram 対応 + Tier1 完了

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.0.0
- **対象コミット**: `1f9960e`
- **影響ファイル**: `src/modules/er.js`, `tests/er-*.test.js`, `tests/e2e/er-basic.spec.js`, `mermaid-assist.html`

## コンテキスト

DB 設計・リレーショナルデータモデルで使われる ER Diagram を Tier1 第5弾として実装し、Tier1 ロードマップを完了させる。v1.0.0 マイルストーン。

## 対策

DiagramModule v2 で実装（最もシンプル：サブ要素なし）:

- **コア要素**: entity（block 形式 `ENTITY { attr ... }`）, attribute, relationship
- **属性キー 3種**: PK / FK / UK
- **cardinality 7種**: `||` `|o` `}o` `}|` `o|` `o{` `|{` （Left/Right 組み合わせ）
- **operations**: add (entity/attribute/relationship), delete, update, moveUp/Down, connect

属性追加は entity block 内にインデント挿入する仕組み。

README.md の特徴セクションを更新し「対応図形: Gantt, Sequence, Flowchart, State, Class, ER (Tier1完備)」と記載。

## 結果

- 9 ユニット + 6 E2E 追加、合計 113 unit + 123 E2E 全 PASS
- **v1.0.0 リリース** — Tier1 マイルストーン達成（全6図形 = Gantt + 5図形）
- GitHub 公開: タグ `v1.0.0` プッシュ済み
