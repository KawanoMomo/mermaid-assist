# ADR-019: Evaluator の CDP cache clear プロトコル

- **ステータス**: 承認
- **カテゴリ**: エージェント運用
- **日付**: 2026-04-17
- **対象プロジェクト**: MermaidAssist
- **関連ADR**: ADR-014 (Visual Verification Gate), ADR-016 (system-tester)
- **関連ECN**: ECN-014 (Phase 1 で顕在化), ECN-015 (Phase 2 で再発)

## コンテキスト

MermaidAssist の dev server は `python -m http.server 8765` で起動する。Python の組み込み HTTP サーバーは `Last-Modified` ヘッダーのみ送出し、`Cache-Control` や `ETag` を出さない。Playwright の persistent browser context は Chromium の heuristic freshness cache に従うため、連続した evaluator run で古い JS ファイルがサービスされ続ける現象が発生する。

具体的な事象 (Tier2 Phase 1 visual sweep 再 run で発覚):
1. 修正 commit `577a106` 後、ディスクの `src/app.js` は修正版 (74197 bytes)
2. curl / `fetch(..., {cache:'no-store'})` は 74197 bytes の修正版を返す
3. しかし Playwright browser の `<script src="src/app.js">` は 69948 bytes の **pre-fix 版** を load
4. 結果: 実際の修正は master に入っているのに visual sweep が FAIL を返す (false FAIL)

`location.reload(true)`, F5, Ctrl+Shift+R, `browser_close` + `browser_navigate`, CDP `Network.setCacheDisabled` — いずれも cache を evict しない。

Tier3 Phase 1 (Pie, v1.8.0) でも同様の現象を確認済み。

## 検討した選択肢

### A) dev server を変える

- 概要: `python -m http.server` から `npx http-server -c-1` 等 no-cache サーバーに変更
- メリット: browser 側の挙動を変えずに問題解消
- デメリット: npm 依存が増える。ローカル環境の dev dependency 追加。一部の dev 環境では http-server 未インストール

### B) HTML に cache-busting query string を付与

- 概要: `<script src="src/app.js?v=<git-sha>">` のように毎 commit で変わる suffix
- メリット: 静的に解決、dev server 依存なし
- デメリット: 手動メンテナンスは破綻する。ビルドステップ必要 (ADR-011 で「ビルドなし」を採用済みのため、矛盾)

### C) Evaluator プロトコルに CDP `Network.clearBrowserCache` を標準化

- 概要: 毎 visual sweep 開始時に `Network.clearBrowserCache` + `Network.clearBrowserCookies` を CDP で呼ぶ
- メリット: 既存 dev server/HTML 無改修。evaluator 側の1回のハンドラー追加
- デメリット: 手動 browser 検証時には別途対応必要 (開発者は hard reload 等の workaround を使う)

## 決定

**C) Evaluator プロトコルに CDP cache clear 標準化** を採用。

理由:
- A は environment dep を増やす (インストール作業が前提)
- B は ADR-011 のビルドなし方針と矛盾
- C は agent 運用ルール1行の改訂で全 phase にスケールする

実装 (evaluator agent の必須プロトコル):

```javascript
const browser = await chromium.launch();
const context = await browser.newContext();
const cdpPage = await context.newPage();
const session = await context.newCDPSession(cdpPage);
await session.send('Network.clearBrowserCache');
await session.send('Network.clearBrowserCookies');
// ... then the actual verification page
```

evaluator の system prompt には「sweep 開始時に必ず CDP `Network.clearBrowserCache` を実行」と明記し、全 visual sweep で artifact を回避する。

## 結果

- Tier2 Phase 1 (Requirement v1.3.0) の再 sweep で成功
- Tier2 Phase 2〜5 (Block / Timeline / Mindmap / Gitgraph) および Tier3 Phase 6〜15 (10 図形) の 15 回連続 visual sweep で cache artifact 0件
- Evaluator の標準手順に組み込まれ、Phase 追加時の追加コスト 0

## 教訓

1. **外部依存 (Python http.server) の振る舞いは想定より強く persistent**: 通常の hard reload / Ctrl+Shift+R で evict されない cache が存在することを認識しておく。
2. **Evaluator プロトコル改訂は phase 横断で効く**: 1ルール追加で全 Phase のテスト信頼性が向上する。ADR レベルで標準化するべき改善。
3. **False FAIL は実 FAIL より厄介**: 修正が入った後も検証が失敗し続けると「修正に自信を持てない」状態が生まれる。evaluator はエビデンス収集だけでなく「再現性保証」にも責任を持つ。
