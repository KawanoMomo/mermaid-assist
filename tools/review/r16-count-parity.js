'use strict';
// R16 件数の一致: パネルが数える要素数と、mermaid が実際に描く数がずれていないか。
//
// これまで見つけた欠陥の多くは「パネルと図が別の述語で数えている」形だった。
//
//   sequence  宣言行を消したのに参照が残り、図には出ているのに一覧から消えた
//   block     style 行を分解して、図に無いブロックを一覧に出した
//   timeline  accTitle を期間として拾い、図に無い期間を一覧に出した
//
// どれも個別に見つけたが、**数の一致**という一本の物差しで見れば同じものだった。
// ステータスバーは「要素: N」と常時出しているので、この N が嘘なら常時嘘をつく。
//
// 判定は mermaid の描画に置く。パネルが挙げた各要素のラベルが、描かれた図の中に
// 現れるか。現れないものがあれば、図に無いものを数えている。
//
// 逆 (図にあるのにパネルに無い) は、mermaid が暗黙に作る要素があるので単純比較
// できない。そちらは r2 / r11 が個別に見ている。
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { loadModules, report, markExamined } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);

const PORT = 9660;
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><body><script src="/lib/mermaid.min.js"></script></body>');
    return;
  }
  try { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(fs.readFileSync(path.join(ROOT, u))); }
  catch (e) { res.writeHead(404); res.end(); }
});

(async () => {
  const findings = [];
  const skipped = [];
  await new Promise(r => srv.listen(PORT, r));
  const b = await chromium.launch();

  for (const key of Object.keys(M)) {
    const mod = M[key];
    if (!mod || !mod.template || !mod.parse) continue;
    const text = mod.template();
    let els;
    try { els = (mod.parse(text).elements || []); } catch (e) { continue; }
    markExamined(key);
    if (!els.length) continue;

    const p = await b.newPage();
    await p.goto('http://127.0.0.1:' + PORT + '/');
    await p.waitForFunction(() => typeof window.mermaid !== 'undefined');
    await p.evaluate(() => window.mermaid.initialize({
      startOnLoad: false, securityLevel: 'loose', maxTextSize: 5000000 }));
    const r = await p.evaluate(async (t) => {
      try { await window.mermaid.parse(t); } catch (e) { return { bad: true }; }
      let svg;
      try { const o = await window.mermaid.render('r16' + Math.floor(performance.now()), t); svg = o.svg; }
      catch (e) { return { bad: true }; }
      const d = document.createElement('div');
      d.innerHTML = svg;
      d.querySelectorAll('style').forEach(s => s.remove());
      return { text: (d.textContent || '').replace(/\s+/g, '') };
    }, text);
    await p.close();

    if (r.bad) { skipped.push(key); continue; }

    // パネルが数えた要素のうち、図に文字が出てこないもの
    const ghosts = [];
    els.forEach((e) => {
      // 図に描かれる文字の候補。id は SVG に出ないことがあるのでラベル側を優先する。
      const probes = [e.label, e.name, e.text, e.period, e.id]
        .filter(x => typeof x === 'string' && x.trim())
        // 自動採番の id (`__bar_0` など) は図に出ないのが当たり前なので除く。
        // xychart の系列は mermaid が名前を描かないので、これを根拠にすると
        // 「図に出ない」と言えてしまうが、それは観測できないだけで幽霊ではない。
        .filter(x => !/^__/.test(x))
        .map(x => x.replace(/\s+/g, ''));
      if (!probes.length) return;                 // 照合できる文字が無い要素は対象外
      if (probes.some(x => r.text.indexOf(x) >= 0)) return;
      ghosts.push(probes[0]);
    });
    if (ghosts.length) {
      findings.push({ module: key, fn: 'P1 件数の一致',
        what: 'パネルは数えているが図に出ない: [' + ghosts.slice(0, 5).join(',') +
              (ghosts.length > 5 ? ',…' : '') + '] (' + ghosts.length + '/' + els.length + ')' });
    }
  }

  await b.close();
  srv.close();
  if (skipped.length) {
    console.log('  (mermaid が描けないひな形: ' + skipped.length + ' 件を対象外) ' + skipped.join(','));
  }
  report('r16-count-parity', findings);
})();
