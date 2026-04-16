# ECN-012: properties.js ヘルパー集約リファクタ

- **ステータス**: 適用済
- **種別**: 改善
- **バージョン**: v1.1.0
- **対象コミット**: `783f5c0`, `93075a1`, `730092d`, `fe77936`, `b70b8b9`, `45927ad`, `251e39c`
- **影響ファイル**: `src/ui/properties.js`, `src/modules/{sequence,flowchart,state,class,er}.js`

## コンテキスト

Tier1 完了時点で各図形モジュールの `renderProps` 関数に同パターンの HTML 構築コードと event binding コードが重複していた:

- 各モジュールにローカル `fieldHtml` 関数定義
- 各モジュールにローカル `bindEvt` 関数定義
- リスト表示・ボタン bind の手書きループが5モジュール × 複数箇所 で重複

5モジュールで同じパターンを5回書いており、保守性低下。

## 対策

`src/ui/properties.js` に共通ヘルパーを 14 個追加:

- HTML builders: `fieldHtml`, `selectFieldHtml`, `panelHeaderHtml`, `sectionHeaderHtml/FooterHtml`, `listItemHtml`, `emptyListHtml`, `primaryButtonHtml`, `dangerButtonHtml`
- Event helpers: `bindEvent`, `bindAllByClass`, `bindSelectButtons`, `bindDeleteButtons`, `bindFieldChange`

5モジュールの `renderProps` を順次リファクタ（並列 worktree で実施）。各モジュールで `var P = window.MA.properties` または `props` を alias して `P.listItemHtml(...)` 等で呼び出す形に統一。

element ID と CSS class は不変のため既存 E2E と完全互換。

## 結果

- ~250行のコード削減（重複除去）
- 113 unit + 123 E2E 全合格を維持
- v1.1.0 リリース
- 各モジュールの renderProps が読みやすくなり、後続の v1.2.0 add form 統一の実装が容易に

教訓: 並列 worktree 改修は速いが、各モジュールの既存 alias 名（`P` vs `props`）を統一しないと不整合が生じやすい（v1.2.0 で実際に同問題発生 → ECN-013 参照）。
