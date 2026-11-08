# ADR ドラフト: 確かめる入口(scripts/*.ps1)と台本 scenario の契約

- 状態: ドラフト(採番は人間)
- 日付: 2026-11-08
- 起点: TICKET-human-20261108-1500-1(自律開発ループの基盤)

## 文脈
自律開発ループは製品を `scripts/build.ps1` `scripts/test.ps1` `scripts/verify.ps1` と `summary.json` だけで確かめる。
既存の確かめ方は `node tests/run-tests.js` / `npm run test:render` / `npx playwright test`(testDir: `tests/e2e`)で、
ペルソナ台本の手順に対応する置き場が無かった。

## 決定
1. scenario は `tests/scenarios/{persona}-{手順}.spec.js`、設定は別ファイル `playwright.scenarios.config.js`(`playwright.config.js` を継承して testDir だけ替える)。
   既存の `npx playwright test` の対象(tests/e2e)は変えない。
   - 退けた案: `playwright.config.js` に projects を足して 1 本にする → 既存の `npx playwright test` の件数と所要時間が変わり、e2e の数え方がずれる
2. `verify.ps1 -Scenarios` にフォルダを渡すと「全体」(scenario 全部 + tests/e2e)、ファイルを渡すと「その scenario だけ」。
   builder は触った手順だけ、releaser と基盤判定はフォルダで全体を回す。`-E2E` / `-NoE2E` で上書きできる
3. 計測値は scenario が `testInfo.annotations` に `renderMs` / `diffLines` として積み、`scripts/verify-summary.js` が JSON レポートから
   `summary.json` に写す(複数あれば最大)。top-level の `passed` / `failed` / `total` は scenario と e2e の合計。
   レポートが読めない・spec が読み込めないときは failed に数える(黙って 0 本にしない)
4. Playwright は `npx` でなく `node node_modules/@playwright/test/cli.js` で起動する(Windows の npm/npx シムの差を避ける)

## 結果
- `summary.json` の項目名(passed / failed / total / scenarios / e2e / tests[].renderMs / diffLines / failedNames)はハーネスとの契約。変えるときはハーネス側(bootstrap_check.py・opencode_builder.py・releaser)と同時に変える
- render-oracle は固定ポート 9517 をやめ、OS が選ぶ空きポート(`RENDER_ORACLE_PORT` で固定も可)で待つ。test.ps1 を同じ機械で同時に回しても EADDRINUSE で落ちない
