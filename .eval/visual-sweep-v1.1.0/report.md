# Visual Sweep Report — v1.1.0

**Date:** 2026-04-16
**Method:** Playwright MCP via http://127.0.0.1:8765/mermaid-assist.html
**Scope:** Tier1 全6図形 (Gantt, Sequence, Flowchart, State, Class, ER) の実機レンダリングと property panel の動作確認

## 結果サマリ

| ID | 図形 | 描画 | プロパティパネル | コンソールエラー | 判定 |
|---|---|---|---|---|---|
| V1 | Gantt | ✅ 4タスク/2セクション正常 | ✅ 全要素表示 | favicon 404 のみ | **PASS** |
| V2 | Sequence | ✅ Client/Server/Request/Response | ✅ Sequence専用UI | favicon 404 のみ | **PASS** |
| V3 | Flowchart | ✅ Start→Decision→OK/Retry→End | ✅ Flowchart専用UI | favicon 404 のみ | **PASS** |
| V4 | State | ✅ [*]→Idle→Running→[*] | ✅ State専用UI | favicon 404 のみ | **PASS** |
| V5 | Class | ✅ Animal/Dog with members | ✅ Class専用UI | favicon 404 のみ | **PASS** |
| V6 | ER | ✅ CUSTOMER ||--o{ ORDER | ✅ ER専用UI | favicon 404 のみ | **PASS** |

## 発見した不具合

### Critical: なし
リリース前に修正必須の不具合はゼロ。

### Minor (リリースブロッカーではない)

#### M-1: ステータスバーのempty-state文言がGantt固有
- **症状**: Sequence/Flowchart/State/Class/ER に切り替え直後、ステータスバーが「タスク: 0 | プロパティパネルからタスクを追加してください」を表示。Gantt以外は「タスク」概念がない。
- **影響箇所**: `src/app.js` の `renderStatus` 関数
- **修正案**: 図形ごとに用語を切り替える（例: Sequence→「メッセージ」、Flowchart→「ノード」）OR 汎用的に「要素」に統一

#### M-2: favicon.ico 404
- **症状**: ブラウザコンソールに `Failed to load resource: 404 (favicon.ico)` が常時1件
- **影響**: なし（UI動作には影響しない）
- **修正案**: 16x16 のロゴ画像を `favicon.ico` に追加するか、`<link rel="icon" href="data:,">` で空のfaviconを宣言

## ブラウザキャッシュに関する注意

Playwright MCP セッション中、`localhost:8765` で `<script src="src/ui/properties.js">` の旧バージョンがキャッシュされて新ヘルパーが反映されない事象を観測。`127.0.0.1:8765` に切り替えると正常に最新ファイルが読み込まれた。

**回避策**: 開発時は `http://127.0.0.1:8765/` を使用するか、HTML側で `<script src="...?v=1.1.0">` のようにバージョンクエリを付与するとキャッシュ問題が予防できる。これはユーザー環境では発生しない（毎回ファイルから直接ブラウザで開くため）が、開発・検証時に注意。

## スクリーンショット

- `v1-gantt.png` — Gantt 初期描画
- `v2-sequence.png` — Sequence 切替後
- `v3-flowchart.png` — Flowchart 切替後
- `v4-state.png` — State 切替後
- `v5-class.png` — Class 切替後
- `v6-er.png` — ER 切替後

## 結論

**Tier1 v1.1.0 は visual regression なしで PASS。** Critical bug 0件、minor 2件。M-1 は次の小リリース (v1.1.1) で対応可能。M-2 は cosmetic で優先度低。
