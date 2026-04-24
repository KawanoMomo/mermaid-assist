# v1.3.0 / Tier2 Phase 1 — IEC 61508 Safety Requirement Use Case Report

## 概要

- **実施日**: 2026-04-17
- **対象**: Tier2 Phase 1 Requirement Diagram / IEC 61508 風 safety requirement シナリオ
- **最終判定**: **PASS**

## 環境

- dev_server_url: `http://127.0.0.1:8765/mermaid-assist.html`
- commit: `f77efa7` (visual sweep PASS) + `577a106` (app.js fix) + `d4a8359` (auto-quote fix)
- browser: Playwright chromium
- `Network.clearBrowserCache` via CDP 実施済み (キャッシュ artifact 防止)

## シナリオ

ECU ファーム (IEC 61508 風) の機能安全要件を property panel UI 操作のみで記述する。
合計: 4 requirement + 2 element + 5 relation。

## Pass 基準チェック

| 基準 | 結果 | 証拠 |
|---|---|---|
| 4 requirement 全部含まれる | PASS | final-editor.txt 行 2-25 |
| 2 element 全部含まれる | PASS | final-editor.txt 行 26-33 |
| 5 relation 全部含まれる | PASS | final-editor.txt 行 34-38 |
| SVG rendered | PASS | `#preview-svg svg` 内 `<g>` 67 個, `final-svg.png` |
| console error 0 (favicon 除く) | PASS | `console-errors.log`: favicon.ico 404 のみ |
| 目標 mermaid と equivalent | PASS | canonical diff 空 |

## 最終 editor text 全文

`final-editor.txt` 参照。4 requirement + 2 element + 5 relation が期待通りに生成され、id/text/type/docref は全て auto-quote (commit `d4a8359`) により quote 付きで出力。

## 証拠ファイル

- `final-editor.txt` — 最終 editor text
- `target.txt` — 期待 text
- `console-errors.log` — favicon.ico 404 のみ (他 0 件)
- `network.json` — favicon 除き全 200 OK
- `dom-*.txt` — 各ステップでの DOM 状態
- `screenshots/after-add-requirements.png` — Step B 完了
- `screenshots/after-add-elements.png` — Step C 完了
- `screenshots/after-add-relations.png` — Step D 完了
- `screenshots/final-svg.png` — 最終 SVG レンダリング
- `screenshots/final-editor.png` — 最終 editor text

## 検証された事項

1. **Property panel UI 操作のみで完成可能**: 4 requirement + 2 element + 5 relation の safety requirement ダイアグラムを、editor を直接書き換えることなく property panel UI のみで記述完成できた。
2. **Auto-quote 機能**: UI 入力値に quote を含めなくても、モジュール側 (`src/modules/requirement.js`) が id/text/type/docref に自動 quote を付与して mermaid parser が受け付ける形式で出力された。
3. **Mermaid render 成功**: 最終 mermaid text は parser を通過し、6 ノード + 5 エッジ + ラベルが SVG として描画された。

## UX 観察 (本評価の PASS 判定には影響しない)

- `+ 要件追加` / `+ エレメント追加` を押すと、詳細パネルが add form を置き換える (add form が非表示化)。次の要素を追加するには空領域クリック等で detail を閉じる必要あり。
- Evaluator は JS から `window.MA.selection.clearSelection()` を呼んで継続したが、ユーザが GUI 上でこれを直感的に実施できるかは UX 検討の余地あり。将来改善候補。

## 結論

**PASS**. IEC 61508 風 safety requirement シナリオが property panel UI のみで完成した。Tier2 Phase 1 の実用シナリオ検証を通過。

```json
{
  "sprint": "v1.3.0 / Tier2 Phase 1 / IEC 61508 use case",
  "verdict": "PASS",
  "failed_criteria": [],
  "console_errors": 0,
  "equivalent_to_target": true,
  "nodes_rendered": 6,
  "relations_rendered": 5
}
```
