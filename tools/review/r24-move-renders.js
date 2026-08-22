'use strict';
// R24 並べ替えても図が壊れないか。
//
// 実描画の網は「追加」(r23) と「改名」「削除」(render-oracle) に掛かっていた。
// **並べ替え (moveUp / moveDown) には無かった。**
//
// 前ラウンドの教訓「網が無いのは複雑な操作ではなく、一度書いて以来
// 触っていない操作」から手作業で探したところ、9件出た:
//
//   flowchart / erDiagram / requirementDiagram  先頭の要素を上へ動かすと
//                                               **図の宣言行と入れ替わって図が消える**
//   kanban                                      札がセクション見出しを飛び越える
//   mindmap                                     根が2つになる
//   packetBeta                                  ビット番号が飛んで拒否される
//   timeline                                    図から期間の文字が消える
//
// いずれも契約経路 (operations.moveUp) の欠陥。パネルの経路 (flowchart の
// _moveNodeStep) は入れ替え先が動かせる行かを見ていたので壊れていなかった。
// **「UI だけ動いて契約が壊れている」形の15例目。**
//
// 判定は3つ。
//   M1 動かしても図が描ける            (壊さない)
//   M2 動かしても要素の数が変わらない    (増減させない)
//   M3 同じ種類が2つ以上あれば実際に動く  (黙って空振りしない)
//
// M3 が要る。安全側に倒して「常に何もしない」ようにすると M1 / M2 は
// 必ず通るので、**直したつもりで機能を殺していても 0件になる**。
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { loadModules, report, markExamined } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);

const PORT = 9663;
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><body><script src="/lib/mermaid.min.js"></script></body>');
    return;
  }
  let body = null;
  try { body = fs.readFileSync(path.join(ROOT, u)); } catch (e) { body = null; }
  if (body === null) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/javascript' });
  res.end(body);
});

(async () => {
  const findings = [];
  const skipped = [];      // ひな形が描けない / 動かす対象がない
  const singles = [];      // その種類が1つしかないので動かしようがない
  let tried = 0;
  let edgeTried = 0;
  await new Promise(r => srv.listen(PORT, r));
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:' + PORT + '/');
  await p.waitForFunction(() => typeof window.mermaid !== 'undefined');
  await p.evaluate(() => window.mermaid.initialize({
    startOnLoad: false, securityLevel: 'loose', maxTextSize: 5000000 }));

  const draw = (t) => p.evaluate(async (txt) => {
    try {
      const o = await window.mermaid.render('r24' + Math.floor(performance.now()), txt);
      const d = document.createElement('div');
      d.innerHTML = o.svg;
      d.querySelectorAll('style').forEach(s => s.remove());
      return { ok: true, text: (d.textContent || '').replace(/\s+/g, '') };
    } catch (e) {
      return { ok: false, err: String(e.message).split(String.fromCharCode(10))[0].slice(0, 80) };
    }
  }, t);

  for (const key of Object.keys(M)) {
    const mod = M[key];
    if (!mod || !mod.template || !mod.parse || !mod.operations) continue;
    const text = mod.template();
    let els;
    try { els = mod.parse(text).elements || []; } catch (e) { continue; }
    markExamined(key);
    if (!els.length) { skipped.push(key + '(要素なし)'); continue; }
    const base = await draw(text);
    if (!base.ok) { skipped.push(key + '(ひな形が描けない)'); continue; }

    // 種類ごとに、開始行の昇順で並べる
    const byKind = {};
    els.forEach((e) => {
      if (typeof e.line !== 'number') return;
      // 「隣」は種類だけでは決まらない。mindmap の兄弟は親と深さで決まり、
      // kanban の札は列に属する。**要素自身が親を名乗っているならそれで束ねる。**
      // 種類だけで束ねると、親の違う要素どうしを「動くはずだ」と判定して
      // 誤報になる (最初そうなっていた)。
      const parent = (e.parentId !== undefined && e.parentId !== null && e.parentId !== '')
        ? String(e.parentId) : '';
      const k = String(e.kind === undefined ? '(既定)' : e.kind) +
        (parent ? '<' + parent + '>' : '');
      (byKind[k] = byKind[k] || []);
      if (byKind[k].indexOf(e.line) < 0) byKind[k].push(e.line);
    });
    for (const k of Object.keys(byKind)) {
      const lines = byKind[k].slice().sort((a, c) => a - c);

      // M4 端の要素を外へ動かそうとしても図を壊さない。
      //
      // M1〜M3 は**2番目の要素**しか動かさないので、元の欠陥
      // (先頭の要素を上へ動かすと図の宣言行と入れ替わる) を捕まえられない。
      // 変異を戻して確かめたら 9件のうち 2件しか出なかったので分かった。
      // 端では「動かない」か「正しく動く」のどちらかでなければならない。
      for (const edge of [{ dir: 'moveUp', at: lines[0] },
                          { dir: 'moveDown', at: lines[lines.length - 1] }]) {
        if (typeof mod.operations[edge.dir] !== 'function') continue;
        let out;
        const rk = k.split('<')[0];
        try { out = mod.operations[edge.dir](text, edge.at, { kind: rk === '(既定)' ? undefined : rk }); }
        catch (e) {
          findings.push({ module: key, fn: 'M4 端で壊さない',
            what: k + ' の端を' + (edge.dir === 'moveUp' ? '上' : '下') + 'へ動かすと例外: ' +
                  String(e.message).slice(0, 70) });
          continue;
        }
        edgeTried++;
        if (out === text) continue;            // 動かない = 正しい
        const re = await draw(out);
        if (!re.ok) {
          const diff = out.split(String.fromCharCode(10))
            .filter(l => text.indexOf(l) < 0 && l.trim()).slice(0, 3).join(' | ');
          findings.push({ module: key, fn: 'M4 端で壊さない',
            what: k + ' の端を' + (edge.dir === 'moveUp' ? '上' : '下') + 'へ動かすと図が壊れる: ' +
                  re.err + ' / 変わった行: ' + JSON.stringify(diff).slice(0, 140) });
        }
      }

      // M1〜M3 は同じ束に2つ以上ないと試せない。
      // **M4 は1つでも試す** — 元の欠陥 (先頭の要素を上へ動かすと
      // 図の宣言行と入れ替わる) は要素が1つでも起きるため。
      if (lines.length < 2) { singles.push(key + '.' + k); continue; }

      for (const dir of ['moveUp', 'moveDown']) {
        if (typeof mod.operations[dir] !== 'function') continue;
        // 動くはずの位置: moveUp なら2番目、moveDown なら最後から2番目
        const at = (dir === 'moveUp') ? lines[1] : lines[lines.length - 2];
        let after;
        const rawKind = k.split('<')[0];
        try { after = mod.operations[dir](text, at, { kind: rawKind === '(既定)' ? undefined : rawKind }); }
        catch (e) {
          findings.push({ module: key, fn: 'M1 動かしても描ける',
            what: k + ' を' + (dir === 'moveUp' ? '上' : '下') + 'へ動かすと例外: ' +
                  String(e.message).slice(0, 70) });
          continue;
        }
        tried++;
        // M3 黙って空振りしていないか
        if (after === text) {
          findings.push({ module: key, fn: 'M3 実際に動く',
            what: k + ' が' + lines.length + '個あるのに ' + dir + '(' + at + ') で本文が変わらない' });
          continue;
        }
        // M1 描けるか
        const r = await draw(after);
        if (!r.ok) {
          const diff = after.split(String.fromCharCode(10))
            .filter(l => text.indexOf(l) < 0 && l.trim()).slice(0, 3).join(' | ');
          findings.push({ module: key, fn: 'M1 動かしても描ける',
            what: k + ' を' + (dir === 'moveUp' ? '上' : '下') + 'へ動かすと図が壊れる: ' + r.err +
                  ' / 変わった行: ' + JSON.stringify(diff).slice(0, 140) });
          continue;
        }
        // M2 数が変わらないか
        let n2 = -1;
        try { n2 = (mod.parse(after).elements || []).length; } catch (e) { n2 = -1; }
        if (n2 !== els.length) {
          findings.push({ module: key, fn: 'M2 数が変わらない',
            what: k + ' を動かすと要素が ' + els.length + ' → ' + n2 + ' に変わる' });
          continue;
        }
        // 図に出ていた文字が消えていないか
        const lost = els.map((e) => [e.label, e.name, e.text, e.period, e.id]
            .filter(x => typeof x === 'string' && x.trim() && !/^__/.test(x))
            .map(x => x.replace(/\s+/g, ''))[0])
          .filter(Boolean)
          .filter(x => base.text.indexOf(x) >= 0 && r.text.indexOf(x) < 0);
        if (lost.length) {
          findings.push({ module: key, fn: 'M2 数が変わらない',
            what: k + ' を動かすと図から文字が消える: [' + lost.slice(0, 4).join(',') + ']' });
        }
      }

    }
  }

  await b.close();
  srv.close();
  // 0件が何件分の0なのかを必ず出す。
  console.log('  (動かした組み合わせ: ' + tried + ' / 端で試した: ' + edgeTried +
    ' / その種類が1つしかなく動かしようがない: ' + singles.length +
    (singles.length ? ' (' + singles.join(',') + ')' : '') +
    ' / 対象外: ' + skipped.length + (skipped.length ? ' (' + skipped.join(',') + ')' : '') + ')');
  report('r24-move-renders', findings);
})();
