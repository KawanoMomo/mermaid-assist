'use strict';
// R23 追加しても図が壊れないか。
//
// これまでの網は「改名」と「削除」にしか掛かっていなかった
// (tests/gen-rename-cases.js / gen-delete-cases.js)。
// **一番最初にやる操作である「追加」に実描画の網が無かった。**
//
// その穴で requirementDiagram の Blocker が生き残っていた:
//
//   「+ 要件追加」→ `id: ""` `text: ""` を出す → mermaid が Parse error
//   「+ エレメント追加」→ `type: ""` `docref: ""` → 同じ
//
// 単体テストは通っていた。むしろ**壊れた出力の方を固定していた**
// (`expect(out).toContain('id: ""')`)。パーサは自分が書いた空文字を
// そのまま読み戻せるので、パーサとテストだけでは永久に気づけない。
//
// 判定は mermaid に置く。ひな形が描けるなら、そこに1つ足したものも
// 描けなければならない。足す種類は**そのモジュール自身が一覧に出している
// 種類** (parse が返す element.kind) を使う。種類の一覧を手で持つと必ず漏れる。
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { loadModules, report, markExamined } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);

const PORT = 9662;
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

// 追加に渡す値。どのモジュールが何を要るかは分からないので、
// **名前らしきものを全部同じ語で埋める**。要らないものは無視される。
// 追加に渡す値。どのモジュールが何を要るかは分からないので、
// **名前らしきものを全部同じ語で埋める**。要らないものは無視される。
//
// ただし `type` のように、図種によって許される値が違うものがある
// (gitGraph の type は NORMAL/REVERSE/HIGHLIGHT しか取らない)。
// こちらが渡した値が悪いだけなのに「追加すると壊れる」と報告しかけた。
// **値の組を2通り試し、どちらでも描けないときだけ指摘する。**
// packet の bit のように、**既存の値の続きでないと受け付けない**ものがある。
// 固定値 (0-7) を渡して「追加すると壊れる」と報告しかけた。
function nextBit(els) {
  var mx = -1;
  els.forEach(function(e) {
    [e.end, e.endBit, e.to, e.start, e.startBit].forEach(function(v) {
      var n = Number(v);
      if (!isNaN(n) && n > mx) mx = n;
    });
  });
  return mx + 1;
}

function propsFor(name, kind, els, variant, endIdx) {
  // 端点に渡す既存の名前。どれが「その図種で端点になれる名前」かは
  // モジュールしか知らない (gitGraph なら branch であって commit id ではない)。
  // 一覧から順に試して、描けたものを採る。
  const all = els.map(e => e.name || e.id || e.label).filter(Boolean);
  const ends = all.slice(endIdx).concat(all.slice(0, endIdx));
  const base = {
    name: name, label: name, text: name, id: name, title: name,
    kind: kind, reqType: 'requirement',
    from: ends[0], to: ends[1] || ends[0], target: ends[0], reltype: 'satisfies',
    section: ends[0], column: ends[0], parentLine: 2, siblingLine: 2, line: 2,
    period: name, event: name, meta: '', shape: '', icon: 'server',
    parent: '', fromSide: 'R', toSide: 'L', score: 3, actors: '',
    // packet は連番でないと mermaid が拒否する。既存の最後の次から取る。
    startBit: nextBit(els), endBit: nextBit(els) + 7, x: 0.5, y: 0.5,
    value: 1, values: [1, 2, 3],
  };
  // variant 0 = 値を多めに渡す / variant 1 = 図種ごとに解釈が割れる値を外す
  if (variant === 0) { base.type = 'simulation'; base.visibility = '+'; }
  return base;
}

(async () => {
  const findings = [];
  const skipped = [];
  const tried = [];       // 実際に追加を試せた 図種.種類
  const noAdd = [];       // operations.add を持たない図種
  const noChange = [];    // 追加を呼んでも本文が変わらなかった 図種.種類
  const triedJp = [];     // 日本語の名前でも試せた 図種.種類
  const badProps = [];    // こちらの渡す値が足りず判定できなかった 図種.種類
  const jpLimit = [];     // mermaid 自身が日本語を受け付けない 図種.種類
  await new Promise(r => srv.listen(PORT, r));
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:' + PORT + '/');
  await p.waitForFunction(() => typeof window.mermaid !== 'undefined');
  await p.evaluate(() => window.mermaid.initialize({
    startOnLoad: false, securityLevel: 'loose', maxTextSize: 5000000 }));

  const renders = (txt) => p.evaluate(async (t) => {
    try { await window.mermaid.render('r23' + Math.floor(performance.now()), t); return { ok: true }; }
    catch (e) { return { ok: false, err: String(e.message).split(String.fromCharCode(10))[0].slice(0, 90) }; }
  }, txt);

  for (const key of Object.keys(M)) {
    const mod = M[key];
    if (!mod || !mod.template || !mod.parse) continue;
    const text = mod.template();
    let els;
    try { els = (mod.parse(text).elements || []); } catch (e) { continue; }
    markExamined(key);

    // ひな形が描けない図種は、追加の可否を判定する土台が無い。
    const base = await renders(text);
    if (!base.ok) { skipped.push(key + ' (ひな形が描けない)'); continue; }
    if (!mod.operations || typeof mod.operations.add !== 'function') { noAdd.push(key); continue; }

    // 一覧に出ている種類。kind を持たない図種は 1 種類しかないので undefined を使う。
    const kinds = [];
    els.forEach((e) => { const k = e.kind; if (kinds.indexOf(k) < 0) kinds.push(k); });
    if (!kinds.length) kinds.push(undefined);

    for (const kind of kinds) {
      const label = key + '.' + (kind === undefined ? '(既定)' : kind);
      // 半角の名前で1回、日本語の名前で1回。
      // 半角で壊れるなら追加そのものが壊れている。半角で通って日本語で壊れる
      // なら「日本語名で追加すると壊れる」という別の話になる。混ぜない。
      let asciiOk = false;
      for (const trial of [{ nm: 'Added1', jp: false }, { nm: '追加見本', jp: true }]) {
        if (trial.jp && !asciiOk) break;      // 土台が壊れているなら日本語を見る意味が無い
        let last = null;
        let ok = false;
        let unusable = 0;
        let unchanged = 0;
        const ends0 = els.map(e => e.name || e.id || e.label).filter(Boolean);
        const combos = [];
        for (let v = 0; v < 2; v++) {
          for (let ei = 0; ei < Math.max(1, Math.min(4, ends0.length)); ei++) combos.push([v, ei]);
        }
        for (const combo of combos) {
          let after;
          try { after = mod.operations.add(text, kind, propsFor(trial.nm, kind, els, combo[0], combo[1])); }
          catch (e) { last = { err: '例外: ' + String(e.message).slice(0, 70), added: '' }; continue; }
          if (typeof after !== 'string' || after === text) { unchanged++; continue; }
          const added = after.split(String.fromCharCode(10))
            .filter(l => text.indexOf(l) < 0 && l.trim());
          // 足した行に `undefined` が出るのは、**こちらが渡す値がその図種に
          // 合っていない**ということ。モジュールの欠陥ではないので指摘にしない。
          // ただし黙って捨てない (0件が何件分の0なのか分からなくなる)。
          // `undefined` が出るのは値を渡せていない印。
          //
          // 一度これに空の `""` も含めたが、**それは直したばかりの欠陥
          // (`type: ""` を出して図を壊す) そのものの形**で、変異を入れても
          // 検出できなくなっていた。検査側の都合で述語を広げると、
          // 見つけたい欠陥ごと消える。渡し漏れは `undefined` だけで見る。
          if (added.join(' ').indexOf('undefined') >= 0) { unusable++; continue; }
          const r = await renders(after);
          if (r.ok) { ok = true; break; }
          // 引用符で囲った版も作っておく (mermaid の制限かどうかの判定に使う)
          const rebuilt = after.split(trial.nm).join('"' + trial.nm + '"').split('""').join('"');
          last = { err: r.err, added: added.slice(0, 4).join(' | '),
                   rebuilt: rebuilt === after ? null : rebuilt };
        }
        if (ok) {
          if (trial.jp) triedJp.push(label); else { tried.push(label); asciiOk = true; }
          continue;
        }
        if (!last) {
          // 一度も判定にたどり着けなかった。**どちらの理由なのかを分けて数える。**
          // 数え方を間違えると「呼んでも本文が変わらない」に全部落ちて、
          // 追加が効かない図種があるように見えてしまう。
          (unusable > 0 ? badProps : noChange).push(label + (trial.jp ? '(日本語)' : ''));
          break;
        }
        if (trial.jp) triedJp.push(label); else tried.push(label);
        if (trial.jp) {
          // 日本語で壊れたとき、**mermaid 自身が受け付けないのか**、
          // こちらの書き方が悪いのかを分ける。引用符で囲えば通るなら
          // こちらの欠陥 (A83 の形)。引用符でも通らないなら mermaid の制限で、
          // 直しようがない — 指摘にせず、制限として数える。
          const quoted = last.rebuilt;
          const rq2 = quoted ? await renders(quoted) : { ok: false };
          if (!rq2.ok) { jpLimit.push(label); break; }
        }
        findings.push({ module: key, fn: trial.jp ? 'D2 日本語名で追加' : 'D1 追加が描ける',
          what: (kind || '(既定)') + ' を1つ追加すると図が壊れる' +
                (trial.jp ? ' (半角の名前なら描ける)' : '') + ': ' + last.err +
                ' / 足した行: ' + JSON.stringify(last.added).slice(0, 160) });
        break;
      }
    }
  }

  await b.close();
  srv.close();
  // 0件が何件分の0なのかを必ず出す。黙って落ちた分があると 0件が嘘になる。
  console.log('  (追加を試した組み合わせ: ' + tried.length +
    ' (うち日本語名でも試せた: ' + triedJp.length + ')' +
    ' / mermaid 自身が日本語を受け付けない: ' + jpLimit.length +
    (jpLimit.length ? ' (' + jpLimit.join(',') + ')' : '') +
    ' / 渡す値が合わず判定できない: ' + badProps.length +
    (badProps.length ? ' (' + badProps.join(',') + ')' : '') + ' / ' +
    'ひな形が描けず対象外: ' + skipped.length + (skipped.length ? ' (' + skipped.join(',') + ')' : '') +
    ' / operations.add が無い: ' + noAdd.length + (noAdd.length ? ' (' + noAdd.join(',') + ')' : '') +
    ' / 呼んでも本文が変わらない: ' + noChange.length + (noChange.length ? ' (' + noChange.join(',') + ')' : '') + ')');
  report('r23-add-renders', findings);
})();
