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

    // ── 逆向き: 図にあるのにパネルに無い ────────────────────────────────
    //
    // ここには「mermaid が暗黙に作る要素があるので単純比較できない。
    // 逆は r2 / r11 が個別に見ている」と書いてあった。**その記録が誤りだった。**
    //
    //   A59  erDiagram が日本語のエンティティ名を読めず、一覧が空になる
    //   A80  sequence が宣言行を持たない参加者を読めず、一覧が空になる
    //
    // どちらも「図にあるのにパネルに無い」形で、**r2 も r11 も捕まえておらず、
    // 手作業で見つけた**。C 区分の再検証 (Y11) で、変異を入れても r16 が
    // 0件を返すことから記録の誤りが判明した。
    //
    // 単純比較ができないのは本当なので、比較の仕方を変える。
    // **同じ図の識別子を日本語にしたとき、こちらの要素数が変わらないこと**を見る。
    // mermaid が両方を同じように描くなら、数が変わるのはこちらの読み取りが
    // 狭いということ。これが A59 / A80 の archetype そのもの。
    const jpMap = {};
    let jpSeq = 1;
    const jp = text.replace(/\b[A-Za-z][A-Za-z0-9_]*\b/g, (w) => {
      // 図種宣言と予約語は置き換えない (置き換えると別の図になる)
      if (/^(gantt|sequenceDiagram|flowchart|stateDiagram|classDiagram|erDiagram|journey|kanban|mindmap|timeline|gitGraph|pie|quadrantChart|xychart|sankey|C4Context|packet|architecture|radar|beta|title|section|participant|actor|state|class|note|end|loop|alt|opt|par|else|and|subgraph|direction|columns|block|service|group|commit|branch|checkout|merge|axis|curve|bar|line|dateFormat|axisFormat|requirement|element|id|text|risk|verifymethod|type|docref|left|right|of|over|as|in|TD|LR|RL|BT|v2|string|int|date|PK|FK|UK)$/i.test(w)) return w;
      // **同じ語には同じ置き換え、違う語には違う置き換え**を返す。
      // 最初は `'識' + w.length` と書いたので `A` と `B` がどちらも `識1` になり、
      // 別々のノードが1つに潰れて「5 → 1 に減る」という偽の指摘を出した。
      // 置き換えが単射でないと、減ったのが読み取りのせいか置き換えのせいか分からない。
      if (!jpMap[w]) jpMap[w] = '識' + (jpSeq++);
      return jpMap[w];
    });
    if (jp !== text) {
      let jpEls = null;
      try { jpEls = (mod.parse(jp).elements || []); } catch (e) { jpEls = null; }
      const q = await b.newPage();
      await q.goto('http://127.0.0.1:' + PORT + '/');
      await q.waitForFunction(() => typeof window.mermaid !== 'undefined');
      await q.evaluate(() => window.mermaid.initialize({
        startOnLoad: false, securityLevel: 'loose', maxTextSize: 5000000 }));
      const rr = await q.evaluate(async (t) => {
        try { await window.mermaid.parse(t); return { ok: true }; } catch (e) { return { ok: false }; }
      }, jp);
      await q.close();
      // mermaid が描けない置き換えは、こちらの責任ではないので対象外
      if (rr.ok) {
        if (jpEls === null) {
          findings.push({ module: key, fn: 'P2 逆向き',
            what: '識別子を日本語にすると parse が例外 (mermaid は通る)' });
        } else if (jpEls.length < els.length) {
          findings.push({ module: key, fn: 'P2 逆向き',
            what: '識別子を日本語にすると要素が ' + els.length + ' → ' + jpEls.length +
                  ' に減る (mermaid は同じように描く)。読み取りが半角英数字に狭まっている' });
        }
      }
    }
  }

  await b.close();
  srv.close();
  if (skipped.length) {
    console.log('  (mermaid が描けないひな形: ' + skipped.length + ' 件を対象外) ' + skipped.join(','));
  }
  report('r16-count-parity', findings);
})();
