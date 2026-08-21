'use strict';
// R22 無言の失敗: 押しても何も起きないボタンが無いか。
//
// この観点は「未確認と書いたまま測れるものを測っていなかった」ところから出た。
// クリップボードへのコピーは3ラウンド続けて「ヘッドレスでは権限が下りない」と
// 書いて先送りしていたが、Playwright は権限を与えられる。測ったら失敗が
// **2通りとも画面に何も出ていなかった**。
//
//   権限が下りない        → コンソールに Write permission denied、画面は無反応
//   ClipboardItem が無い  → コンソールに ReferenceError、画面は無反応
//
// 押しても何も起きないので、利用者はそのまま資料へ貼り付ける。すると
// 前にコピーしていた何かが入る。**失敗が成功と見分けられないのが一番悪い**。
//
// 見るもの:
//   S1 押したときに、本文か画面のどちらかが必ず動くこと
//   S2 未処理の例外を残さないこと (例外は利用者に届かない)
//   S3 何も起きない場合、その理由が画面に出ていること
const path = require('path');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { report } = require('./lib');
const ROOT = process.argv[2];

const VIEWPORT = { width: 1366, height: 768 };
const HTML = 'file:///' + path.resolve(ROOT, 'mermaid-assist.html').split(path.sep).join('/');

// ツールバーの操作。ダウンロードを伴うものは別 (r10 が見ている)。
const ACTIONS = [
  { id: 'exp-clipboard', name: 'クリップボードにコピー', openExport: true },
  { id: 'btn-undo', name: 'Undo', openExport: false, needsChange: true },
  { id: 'btn-redo', name: 'Redo', openExport: false, needsChange: true },
];

(async () => {
  const findings = [];
  const b = await chromium.launch();
  const examined = new Set();

  for (const act of ACTIONS) {
    // 権限のある/ない両方で見る。実務では両方起きる
    // (会社の設定でクリップボード権限が落ちていることがある)。
    for (const perms of [['clipboard-read', 'clipboard-write'], null]) {
      const ctx = await b.newContext(Object.assign(
        { viewport: { width: VIEWPORT.width, height: VIEWPORT.height } },
        perms ? { permissions: perms } : {}));
      const p = await ctx.newPage();
      const uncaught = [];
      p.on('pageerror', (e) => uncaught.push(String(e.message).slice(0, 70)));
      await p.goto(HTML);
      await p.waitForSelector('#preview-svg svg', { timeout: 20000 });
      await p.waitForTimeout(400);

      // Undo/Redo は「戻すものがある」状態を作ってから押す
      if (act.needsChange) {
        await p.evaluate(() => {
          const ed = document.getElementById('editor');
          ed.value = ed.value + '\n%% メモ';
          ed.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await p.waitForTimeout(1000);
      }

      const btn = p.locator('#' + act.id);
      if (!(await btn.count())) { await ctx.close(); continue; }
      if (await btn.isDisabled().catch(() => false)) { await ctx.close(); continue; }
      examined.add(act.id);

      const before = {
        text: await p.locator('#editor').inputValue(),
        info: await p.evaluate(() => document.getElementById('status-info').textContent),
      };
      if (act.openExport) {
        await p.locator('#btn-export').click();
        await p.waitForTimeout(250);
      }
      await btn.click();
      await p.waitForTimeout(1600);

      const after = {
        text: await p.locator('#editor').inputValue(),
        info: await p.evaluate(() => document.getElementById('status-info').textContent),
      };
      const label = act.name + (perms ? ' (権限あり)' : ' (権限なし)');

      // S2: 未処理の例外は利用者に届かない
      if (uncaught.length) {
        findings.push({ module: label, fn: 'S2 未処理の例外',
          what: '押すと未処理の例外が出る (画面には何も出ない): ' + uncaught[0] });
      }
      // S1 / S3: 本文も画面も動かないなら、押した結果が分からない
      if (before.text === after.text && before.info === after.info) {
        findings.push({ module: label, fn: 'S1 無言',
          what: '押しても本文も画面も変わらない (成功したのか失敗したのか分からない)' });
      }
      await ctx.close();
    }
  }

  await b.close();
  console.log('  (測定条件: ' + VIEWPORT.width + 'x' + VIEWPORT.height + ' / 権限あり・なしの両方)');
  report('r22-silent-failure', findings, { examined: examined.size, total: ACTIONS.length });
})();
