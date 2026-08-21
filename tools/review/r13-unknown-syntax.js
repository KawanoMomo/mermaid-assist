'use strict';
// R13 未知構文: 知らない行を「要素」として捏造していないか。
//
// block で `style a fill:#f9f` を4つのブロックに分解していた欠陥と同じ形を、
// 全図種で探す。幽霊項目の ✕ を押すと装飾行が消え、リンクの端点候補に `fill` や
// `f9f` が並ぶ。mermaid 側は正しく描くので、**パネルだけが嘘をつく**。
//
// 判定の根拠は mermaid に置く。
//
//   最初これを「装飾行を足したら要素の集合が変わらないこと」で判定し、21件の指摘を
//   出した。実描画で確かめたところ**全部誤り**だった:
//     kanban は `style X fill:#f9f` を本当にカラムとして描く (パネルは正しい)
//     mindmap / timeline / block はその行を入れると parse error (文書自体が不正)
//   「装飾行はどの図種でも共通に有効」という前提が間違っていた。装飾構文は図種ごとに
//   有効/無効が違う。
//
// そこで判定を実描画に接地させる:
//   1. mermaid が parse できない文書は対象外 (利用者が持ち得ない文書)
//   2. 描画された図に**その行の文字が出ている**なら、一覧に出るのが正しい
//   3. 描画に出ていないのに一覧に出るなら、それが捏造
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { loadModules, elementsOf, report } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);

const DECORATIONS = [
  'style X fill:#f9f',
  'classDef hot fill:#f00',
  'class X hot',
  'click X callback',
  'linkStyle 0 stroke:#f00',
  'accTitle: 読み上げ用タイトル',
  'accDescr: 読み上げ用の説明',
];

const cases = [];
Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse) return;
  const t0 = mod.template();
  const base = elementsOf(mod, t0);
  if (!base) return;
  DECORATIONS.forEach((deco) => {
    const lines = t0.split('\n');
    const text = [lines[0], '    ' + deco].concat(lines.slice(1)).join('\n');
    const after = elementsOf(mod, text);
    if (!after) return;                       // モジュールが読めない = 対象外
    const added = after.map(e => e.key).filter(k => base.every(b => b.key !== k));
    if (!added.length) return;                // 増えていない = 問題なし
    cases.push({ module: key, deco, text, added });
  });
});

const PORT = 9652;
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

  for (const c of cases) {
    const p = await b.newPage();
    await p.goto('http://127.0.0.1:' + PORT + '/');
    await p.waitForFunction(() => typeof window.mermaid !== 'undefined');
    await p.evaluate(() => window.mermaid.initialize({
      startOnLoad: false, securityLevel: 'loose', maxTextSize: 5000000 }));
    const r = await p.evaluate(async (text) => {
      try { await window.mermaid.parse(text); } catch (e) { return { bad: true }; }
      let svg;
      try { const o = await window.mermaid.render('r13' + Math.floor(performance.now()), text); svg = o.svg; }
      catch (e) { return { bad: true }; }
      const d = document.createElement('div');
      d.innerHTML = svg;
      d.querySelectorAll('style').forEach(s => s.remove());
      return { text: (d.textContent || '').replace(/\s+/g, '') };
    }, c.text);
    await p.close();

    if (r.bad) { skipped.push(c.module + ':' + c.deco); continue; }

    // 増えた要素の文字が、描かれた図に出ているか。
    // 出ていないのに一覧に並ぶなら、それは図に無いものを見せている。
    const ghost = c.added.filter((k) => {
      const probe = String(k).replace(/\s+/g, '');
      if (!probe || /^__/.test(probe)) {
        // 自動採番の id は文字で照合できないので、装飾行の先頭語で代用する
        const word = c.deco.split(/[\s:]/)[0];
        return r.text.indexOf(word) < 0;
      }
      return r.text.indexOf(probe) < 0;
    });
    if (ghost.length) {
      findings.push({ module: c.module, fn: 'U2 捏造',
        what: '「' + c.deco + '」が図に描かれていないのに一覧に出る: [' + ghost.join(',') + ']' });
    }
  }

  await b.close();
  srv.close();
  if (skipped.length) {
    // 黙って落とさない。mermaid が受け付けない組み合わせは対象外だが、件数は出す。
    console.log('  (mermaid が parse しない組み合わせ: ' + skipped.length + ' 件を対象外)');
  }
  report('r13-unknown-syntax', findings);
})();
