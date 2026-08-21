'use strict';
// R10 往復 (ワークフロー適合の実機側): 保存したものを開き直して同じか。
//
// 実務の反復は「作る → 保存 → Git に載せる → 指摘を受ける → 開き直して直す」。
// この輪のどこかで内容が変わると、図とファイルが静かにずれていく。
// 保存が本文と1バイトでも違えば、次に開いたときの図が違う。
//
// 見るもの:
//   - 保存した .mmd がエディタの本文と完全一致するか
//   - それを開き直して本文が戻り、図が描けるか
//   - SVG 書き出しが中身のある SVG か (空の枠だけ出ていないか)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { report } = require('./lib');
const ROOT = process.argv[2];
const HTML = 'file:///' + path.resolve(ROOT, 'mermaid-assist.html').split(path.sep).join('/');

const TYPES = ['gantt', 'flowchart', 'sequenceDiagram', 'classDiagram', 'block-beta', 'C4Context'];

(async () => {
  const findings = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-rt-'));
  const b = await chromium.launch();

  for (const t of TYPES) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
    p.on('dialog', d => d.accept());
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await p.waitForTimeout(500);
    if (t !== 'gantt') { await p.locator('#diagram-type').selectOption(t); await p.waitForTimeout(1600); }

    // 実務のファイルはコメントを持つ。往復で消えたら困る。
    const marked = (await p.locator('#editor').inputValue()) + '\n%% レビュー指摘: 後で直す\n';
    await p.evaluate((txt) => {
      const ed = document.getElementById('editor');
      ed.value = txt;
      ed.dispatchEvent(new Event('input', { bubbles: true }));
    }, marked);
    await p.waitForTimeout(1200);
    const inEditor = await p.locator('#editor').inputValue();

    // R1 保存した .mmd が本文と一致するか
    let saved = null;
    try {
      const [dl] = await Promise.all([
        p.waitForEvent('download', { timeout: 15000 }),
        p.locator('#btn-save, [id="btn-save"]').first().click(),
      ]);
      const f = path.join(tmp, t.replace(/[^a-z0-9]/gi, '_') + '.mmd');
      await dl.saveAs(f);
      saved = fs.readFileSync(f, 'utf8');
    } catch (e) {
      findings.push({ module: t, fn: 'R1 保存', what: '保存できない: ' + String(e.message).slice(0, 60) });
    }
    // 末尾改行1つは意図して足している。
    //
    // エディタの本文は末尾改行を持たない規約 (21図種のひな形と削除処理が揃えている)
    // だが、Git 管理では末尾改行が無いと全ファイルの差分に
    // `\ No newline at end of file` が付き、末尾に1行足すだけで2行差分になる。
    // 書き出し側でだけ1つ付け、読み込み側で1つ落とす。
    // ここで素の一致を求めると、正しい挙動を欠陥として報告してしまう。
    // 書き出しは常に末尾へ改行を1つ足し、読み込みは常に1つ落とす (対称)。
    // 条件付きにすると、利用者が打った末尾の改行が往復のたびに消える。
    if (saved !== null && saved.replace(/\n$/, '') !== inEditor) {
      findings.push({ module: t, fn: 'R1 保存',
        what: '保存したファイルが本文と違う (本文 ' + inEditor.length + ' 文字 / 保存 ' + saved.length + ' 文字)' });
    }
    if (saved !== null && !/\n$/.test(saved)) {
      findings.push({ module: t, fn: 'R1 保存',
        what: '保存したファイルが改行で終わらない (Git の差分が毎回汚れる)' });
    }
    if (saved !== null && saved.indexOf('%% レビュー指摘') < 0) {
      findings.push({ module: t, fn: 'R1 保存', what: '保存でコメント行が落ちる' });
    }

    // R2 開き直して戻るか (input[type=file] に保存したファイルを流し込む)
    if (saved !== null) {
      const f = path.join(tmp, t.replace(/[^a-z0-9]/gi, '_') + '.mmd');
      const fileInput = p.locator('input[type="file"]').first();
      if (await fileInput.count()) {
        await fileInput.setInputFiles(f);
        await p.waitForTimeout(2000);
        const reopened = await p.locator('#editor').inputValue();
        if (reopened !== inEditor) {
          findings.push({ module: t, fn: 'R2 開き直し',
            what: '開き直すと本文が変わる (保存 ' + inEditor.length + ' 文字 / 復元 ' + reopened.length + ' 文字)' });
        }
        const ok = await p.evaluate(() => !!document.querySelector('#preview-svg svg'));
        if (!ok) findings.push({ module: t, fn: 'R2 開き直し', what: '開き直すと図が描かれない' });
      } else {
        findings.push({ module: t, fn: 'R2 開き直し', what: 'ファイルを開く入力が見つからない' });
      }
    }

    // R3 SVG 書き出しが中身を持つか
    try {
      await p.locator('#btn-export').click();
      await p.waitForTimeout(300);
      const [dl2] = await Promise.all([
        p.waitForEvent('download', { timeout: 15000 }),
        p.locator('#exp-svg').click(),
      ]);
      const g = path.join(tmp, t.replace(/[^a-z0-9]/gi, '_') + '.svg');
      await dl2.saveAs(g);
      const svg = fs.readFileSync(g, 'utf8');
      if (svg.indexOf('<svg') < 0) {
        findings.push({ module: t, fn: 'R3 SVG', what: '書き出しが SVG になっていない' });
      } else if (!/<(path|rect|text|line|polygon|g)\b/.test(svg)) {
        findings.push({ module: t, fn: 'R3 SVG', what: '中身の無い SVG (図形要素が1つも無い)' });
      }
    } catch (e) {
      findings.push({ module: t, fn: 'R3 SVG', what: '書き出せない: ' + String(e.message).slice(0, 60) });
    }

    await p.close();
  }

  await b.close();
  report('r10-roundtrip', findings, { examined: TYPES.length, total: 21 });
})();
