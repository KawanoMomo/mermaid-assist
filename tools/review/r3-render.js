'use strict';
// R3 描画整合: 操作した結果を mermaid が受け付けるか。
//
// テキストが「もっともらしく」変わっても、mermaid が拒否したり別の図になったら
// 意味がない。add / connect の結果を実ブラウザで render する。
const path = require('path');
const fs = require('fs');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { loadModules, report } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);

// 各図種で「要素を1つ足す」「関連を1本足す」をやった結果を集める
const cases = [];
Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse || !mod.operations) return;
  const t0 = mod.template();
  const p = mod.parse(t0);
  const els = (p.elements || []);
  if (els.length < 2) return;
  const a = els[0], b = els[1];
  // 図の中での識別子。requirementDiagram は `name` がそれで、`id` は
  // `REQ-001` のような別の値。id を優先すると存在しない端点で関係を作り、
  // 実装ではなくレビュアーの側で parse を落とす (実際そうなった)。
  // オーバーレイの実装でも同じ罠を踏んでいる (keyOf: e => e.name)。
  const NAME_KEYED = { requirementDiagram: true };
  const idOf = (e) => NAME_KEYED[key]
    ? (e.name || e.id || e.label)
    : ((e.id !== undefined && e.id !== null) ? e.id : (e.name || e.label));

  if (typeof mod.operations.connect === 'function') {
    try {
      const out = mod.operations.connect(t0, idOf(a), idOf(b), {});
      if (out && out !== t0) cases.push({ module: key, op: 'connect', text: out });
    } catch (e) {
      cases.push({ module: key, op: 'connect', text: null, err: String(e.message).slice(0, 60) });
    }
  }
  // add はモジュールごとに必須プロパティが違う (pie は value、packet は
  // startBit/endBit、quadrant は x/y …)。id と label だけ渡すと出力に
  // `undefined` が混ざり、実装の欠陥ではなくレビュアーの入力不足で parse が
  // 落ちる。実際それで7件の誤検出を出した。
  // UI が渡すのと同じだけの値を用意できるモジュールに限って検査する。
  const ADD_PROPS = {
    flowchart: { id: 'zzNew', label: 'zzNew', shape: 'rect' },
    classDiagram: { id: 'zzNew', label: 'zzNew' },
    erDiagram: { id: 'ZZNEW', label: 'ZZNEW' },
    state: { id: 'zzNew', label: 'zzNew', type: 'simple' },
    blockBeta: { id: 'zzNew', label: 'zzNew' },
    sequence: { id: 'zzNew', label: 'zzNew', kind: 'participant' },
    c4: { id: 'zzNew', label: 'zzNew' },
    architectureBeta: { id: 'zzNew', label: 'zzNew', icon: 'server' },
  };
  if (typeof mod.operations.add === 'function' && ADD_PROPS[key]) {
    try {
      const out = mod.operations.add(t0, els[0].kind, ADD_PROPS[key]);
      if (out && out !== t0) cases.push({ module: key, op: 'add', text: out });
    } catch (e) {
      cases.push({ module: key, op: 'add', text: null, err: String(e.message).slice(0, 60) });
    }
  }
});

const http = require('http');
const PORT = 9611;
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><body><div id=o></div><script src="/lib/mermaid.min.js"></script></body>');
    return;
  }
  try {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(fs.readFileSync(path.join(ROOT, u)));
  } catch (e) { res.writeHead(404); res.end(); }
});

(async () => {
  const findings = [];
  cases.filter(c => !c.text).forEach(c =>
    findings.push({ module: c.module, fn: 'operations.' + c.op, what: '呼び出しで例外: ' + c.err }));

  await new Promise(r => srv.listen(PORT, r));
  const b = await chromium.launch();
  for (const c of cases.filter(x => x.text)) {
    // ケースごとに新しいページ (mermaid はダイアグラム種別ごとに状態を持ち、
    // 同一ページで連続 render すると前のケースの id が漏れる)
    const p = await b.newPage();
    await p.goto('http://127.0.0.1:' + PORT + '/');
    await p.waitForFunction(() => typeof window.mermaid !== 'undefined');
    await p.evaluate(() => window.mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' }));
    const r = await p.evaluate(async (text) => {
      const brief = (e) => (e && e.message ? e.message : String(e)).split('\n')[0].slice(0, 90);
      try { await window.mermaid.parse(text); } catch (e) { return { parse: brief(e) }; }
      try { await window.mermaid.render('r3' + Math.floor(performance.now()), text); }
      catch (e) { return { render: brief(e) }; }
      return {};
    }, c.text);
    if (r.parse) findings.push({ module: c.module, fn: 'operations.' + c.op, what: 'parse 失敗: ' + r.parse });
    else if (r.render) findings.push({ module: c.module, fn: 'operations.' + c.op, what: 'render 失敗: ' + r.render });
    await p.close();
  }
  await b.close();
  srv.close();
  report('r3-render', findings);
})();
