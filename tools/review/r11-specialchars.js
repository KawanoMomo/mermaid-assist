'use strict';
// R11 特殊文字: 実務の名前をそのまま入れて壊れないか。
//
// 日本語の設計書で使う名前は素直な英数字ではない。
//   「設計(詳細)」「A：B」「入力/出力」「flag = 1」「Note: 要確認」
//   「モジュール-1」「配列[0]」「条件{真}」
// これらは mermaid の DSL では意味を持つ記号なので、そのまま本文に置くと
// 図が壊れる。UI から入れた名前は、必要なら引用符で囲うなどして**そのまま
// 描かれる**のが正しい。
//
// ここが壊れると、ユーザは「なぜか図が出ない」に遭い、原因が自分の入力の
// どの文字かを自力で切り分けることになる。毎日踏むわりに気付きにくい。
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { loadModules, report } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);
require(path.join(ROOT, 'src', 'core', 'diagnose.js'));
const DIAG = global.window.MA.diagnose;

// 実務で実際に出てくる形。記号だけを並べた嫌がらせではない。
const LABELS = [
  '設計(詳細)',
  'A：B',
  '入力/出力',
  'Note: 要確認',
  'モジュール-1',
  '配列[0]',
  '条件{真}',
  '"引用"付き',
  'A;B',
  'A#1',
];

// ラベルを更新できるモジュールに限る (更新関数の形が3通りあるので分ける)
const FIELD_FNS = ['updateNode', 'updateElement', 'updateParticipant', 'updateCard'];
const VALUE_FNS = ['updateStateLabel', 'updateNodeText'];
const ID_FNS = ['updateBlockLabel'];

const cases = [];
Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse) return;
  const t0 = mod.template();
  let els;
  try { els = mod.parse(t0).elements || []; } catch (e) { return; }
  if (!els.length) return;
  const el = els[0];

  const ff = FIELD_FNS.find(f => typeof mod[f] === 'function');
  const vf = VALUE_FNS.find(f => typeof mod[f] === 'function');
  const idf = ID_FNS.find(f => typeof mod[f] === 'function');

  LABELS.forEach((label) => {
    let out = null;
    try {
      if (ff) out = mod[ff](t0, el.line, 'label', label);
      else if (vf) out = mod[vf](t0, el.line, label);
      else if (idf) out = mod[idf](t0, el.line, el.id, label);
    } catch (e) {
      cases.push({ module: key, label, text: null, err: String(e.message).slice(0, 60) });
      return;
    }
    if (out && out !== t0) cases.push({ module: key, label, text: out });
  });
});

const PORT = 9613;
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><body><div id=o></div>' +
      '<script src="/lib/mermaid.min.js"></script></body>');
    return;
  }
  try {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(fs.readFileSync(path.join(ROOT, u)));
  } catch (e) { res.writeHead(404); res.end(); }
});

(async () => {
  const findings = [];
  const known = [];   // mermaid 側の制限 + 診断済み (黙って落とさないよう数えて出す)
  cases.filter(c => !c.text).forEach(c =>
    findings.push({ module: c.module, fn: 'ラベル更新',
      what: '「' + c.label + '」で例外: ' + c.err }));

  await new Promise(r => srv.listen(PORT, r));
  const b = await chromium.launch();
  for (const c of cases.filter(x => x.text)) {
    // mermaid は図種ごとに状態を持つのでケースごとに新しいページ
    const p = await b.newPage();
    await p.goto('http://127.0.0.1:' + PORT + '/');
    await p.waitForFunction(() => typeof window.mermaid !== 'undefined');
    await p.evaluate(() => window.mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' }));
    const r = await p.evaluate(async (text) => {
      const brief = (e) => (e && e.message ? e.message : String(e)).split('\n')[0].slice(0, 80);
      try { await window.mermaid.parse(text); } catch (e) { return { parse: brief(e) }; }
      let svg;
      try { const out = await window.mermaid.render('r11' + Math.floor(performance.now()), text); svg = out.svg; }
      catch (e) { return { render: brief(e) }; }
      const d = document.createElement('div');
      d.innerHTML = svg;
      // <style> の中身まで拾うと、フォント指定の文字列がラベルを埋もれさせる。
      // 実際それで「図に出ない」の判定が当てにならなくなっていた。
      d.querySelectorAll('style').forEach(s => s.remove());
      return { text: (d.textContent || '').replace(/\s+/g, '') };
    }, c.text);

    if (r.parse) {
      // mermaid 側の制限でこちらから直せないものがある
      // (architecture のラベルは [A-Za-z0-9_ ] のみ、sequence の別名に ; 不可)。
      // その場合に問うべきは「通るか」ではなく「**原因を名指しできているか**」。
      // 黙って壊れるのは欠陥だが、原因を告げていれば利用者は次の手を打てる。
      const cause = DIAG.diagnose(c.text, new Error(r.parse));
      if (cause) { known.push(c.module + ': 「' + c.label + '」'); }
      else {
        findings.push({ module: c.module, fn: 'ラベル',
          what: '「' + c.label + '」を入れると parse 失敗し、原因も名指しできていない: ' + r.parse });
      }
    } else if (r.render) {
      findings.push({ module: c.module, fn: 'ラベル',
        what: '「' + c.label + '」を入れると render 失敗: ' + r.render });
    } else {
      // 描かれた文字にラベルが含まれること。
      // 引用符や括弧が落ちる・別の文字に化ける場合もここで出る。
      const want = c.label.replace(/\s+/g, '');
      if (r.text.indexOf(want) < 0) {
        findings.push({ module: c.module, fn: 'ラベル',
          what: '「' + c.label + '」が図に出ない (描かれた文字: ' + r.text.slice(0, 60) + ')' });
      }
    }
    await p.close();
  }
  await b.close();
  srv.close();
  if (known.length) {
    console.log('  (mermaid 側の制限、診断メッセージあり: ' + known.length + ' 件) ' + known.slice(0, 3).join(' / '));
  }
  report('r11-specialchars', findings);
})();
