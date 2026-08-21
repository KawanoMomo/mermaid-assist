'use strict';
// R20 日本語名の非対称: mermaid は描くのに、こちらの一覧から消える名前が無いか。
//
// この観点は「網羅率を測ったら r11 が 6/21 しか見ていなかった」ところから出た。
// r11 を契約ベースに直すと、erDiagram の parser がエンティティ名を
// `[A-Za-z_][A-Za-z0-9_-]*` で拾っていたことが判明した。つまり
//
//     erDiagram
//         顧客 ||--o{ 注文 : places
//
// という、日本語の設計書ならまず最初に書く形が、**mermaid では正しく描かれるのに
// 一覧にも重ね合わせにも1件も出ない**。図は見えているのに GUI からは触れない。
// 利用者から見ると「このツールは自分の図に反応しない」という壊れ方をする。
//
// r16 (件数の一致) はテンプレ (英数字) しか流していなかったので気付けなかった。
// r11 (特殊文字) は描画だけ見ていて、**一覧に残るか**を見ていなかった。
// どちらの穴も「述語の非対称」で、mermaid が真とするものをこちらが偽としている。
//
// ここで見るのは3つ:
//   N1 日本語名を入れても要素数が減らないこと (見失っていない)
//   N2 その名前が要素のどこかに現れること (別物にすり替わっていない)
//   N3 mermaid が描き、描かれた文字にその名前が出ること (図と一覧が一致する)
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { loadModules, report, markExamined } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);
require(path.join(ROOT, 'src', 'core', 'diagnose.js'));
const DIAG = global.window.MA.diagnose;

// 実務の設計書に出てくる名前。記号は r11 が見るので、ここは純粋に日本語だけ。
const NAMES = ['設計対象', '入力処理', '状態遷移', 'タイマ割込'];
const FIELDS = ['label', 'text', 'title', 'name'];

const cases = [];
const findings0 = [];
const skipped = [];

Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse) return;
  if (!mod.operations || typeof mod.operations.update !== 'function') {
    findings0.push({ module: key, fn: '契約', what: 'operations.update が無い (ADR-012)' });
    return;
  }
  const t0 = mod.template();
  let before;
  try { before = mod.parse(t0); } catch (e) { return; }
  const els = before.elements || [];
  if (!els.length) return;

  els.forEach((el, ei) => {
    const name = NAMES[ei % NAMES.length];
    let out = null;
    for (const f of FIELDS) {
      let c;
      try { c = mod.operations.update(t0, el.line, f, name, { kind: el.kind, id: el.id, blockId: el.id, name: el.name, oldName: el.name }); }
      catch (e) {
        findings0.push({ module: key, fn: 'N0 例外',
          what: '「' + name + '」を ' + f + ' に入れると例外: ' + String(e.message).slice(0, 60) });
        return;
      }
      if (c && c !== t0) { out = c; break; }
    }
    if (!out) { skipped.push(key + '#' + ei); return; }
    markExamined(key);
    // N1 / N2 の判定は mermaid が受け付ける本文に対してのみ意味を持つので、
    // 描画の可否が分かってから (下の非同期側で) 行う。
    // mermaid 自身が拒む本文について「一覧に出ない」と言っても、それは
    // こちらの欠陥ではなく前提の誤り。
    cases.push({ module: key, name, text: out, mod, before: els.length })
  });
});

const PORT = 9621;
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
  const findings = findings0.slice();
  const known = [];
  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch();
  for (const c of cases) {
    // mermaid は図種ごとに状態を持つのでケースごとに新しいページ
    const p = await b.newPage();
    await p.goto('http://127.0.0.1:' + PORT + '/');
    await p.waitForFunction(() => typeof window.mermaid !== 'undefined');
    await p.evaluate(() => window.mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' }));
    const r = await p.evaluate(async (text) => {
      const brief = (e) => (e && e.message ? e.message : String(e)).split('\n')[0].slice(0, 70);
      try { await window.mermaid.parse(text); } catch (e) { return { parse: brief(e) }; }
      let svg;
      try { const o = await window.mermaid.render('n' + Math.floor(performance.now()), text); svg = o.svg; }
      catch (e) { return { render: brief(e) }; }
      const d = document.createElement('div');
      d.innerHTML = svg;
      d.querySelectorAll('style').forEach((s) => s.remove());
      return { text: (d.textContent || '').replace(/\s+/g, '') };
    }, c.text);

    if (r.parse) {
      const cause = DIAG.diagnose(c.text, new Error(r.parse));
      if (cause) known.push(c.module + ': 「' + c.name + '」');
      else {
        findings.push({ module: c.module, fn: 'N3 描画',
          what: '「' + c.name + '」を入れると mermaid の parse が落ち、原因も名指しできていない: ' + r.parse });
      }
    } else if (r.render) {
      findings.push({ module: c.module, fn: 'N3 描画',
        what: '「' + c.name + '」を入れると render 失敗: ' + r.render });
    } else {
      // ここに来た本文は mermaid が受け付けている。GUI 側が追随しているかを問う。
      if (r.text.indexOf(c.name) < 0) {
        const dropCause = DIAG.diagnose(c.text, null);
        if (dropCause) known.push(c.module + ': 「' + c.name + '」(一部が落ちる・警告あり)');
        else findings.push({ module: c.module, fn: 'N3 描画',
          what: '「' + c.name + '」が図に出ず、原因も名指しできていない (描かれた文字: ' + r.text.slice(0, 60) + ')' });
      }
      let after = null;
      try { after = c.mod.parse(c.text); } catch (e) {
        findings.push({ module: c.module, fn: 'N1 要素数',
          what: '「' + c.name + '」を入れると parse が例外 (mermaid は描けている): ' + String(e.message).slice(0, 60) });
      }
      if (after) {
        const na = (after.elements || []).length;
        if (na !== c.before) {
          findings.push({ module: c.module, fn: 'N1 要素数',
            what: '「' + c.name + '」を入れると一覧の要素が ' + c.before + ' → ' + na + ' になる (mermaid は描くのに GUI から消える)' });
        }
        const seen = (after.elements || []).some((e) =>
          [e.id, e.label, e.name, e.text, e.title].some((v) => typeof v === 'string' && v.indexOf(c.name) >= 0));
        if (!seen) {
          findings.push({ module: c.module, fn: 'N2 名前',
            what: '「' + c.name + '」が図には出ているのに要素のどこにも現れない (一覧から触れない)' });
        }
      }
    }
    await p.close();
  }
  await b.close();
  srv.close();
  if (known.length) {
    console.log('  (mermaid 側の制限、診断メッセージあり: ' + known.length + ' 件) ' + known.slice(0, 3).join(' / '));
  }
  // 検査から外れた組を黙って捨てない
  if (skipped.length) {
    console.log('  (どの field でも本文が変わらず未検査: ' + skipped.length + ' 組) ' + skipped.slice(0, 6).join(' / '));
  }
  report('r20-unicode-names', findings);
})();
