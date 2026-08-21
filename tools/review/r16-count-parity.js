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
  const jpChecked = [];   // 逆向きを実際に検査できた図種
  const jpSkipped = [];   // 置き換えを mermaid が受け付けず対象外にした図種
  const jpNoId = [];      // 置き換えられる id が無い図種 (自動採番のみ) = 逆向きが空振り
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
    // 置き換えるのは **そのモジュール自身が id と呼んでいるもの** だけ。
    //
    // 最初は本文中の英単語をすべて置き換えたが、`CUSTOMER ||--o{ ORDER` の
    // `o` (基数記号の一部) まで巻き込んで mermaid が拒否し、**21図種中9図種が
    // 黙って対象外**になっていた。しかもその9図種に erDiagram が含まれる —
    // A59 が出た図種そのもので、**この検査では A59 を見つけられなかった**。
    //
    // 予約語の一覧を持つと必ず漏れる (r11 の関数名の表と同じ形)。
    // parse が返す id だけを対象にすれば、何が識別子かはモジュールが答える。
    let jp = text;
    let jpSeq = 1;
    els.forEach((e) => {
      const id = String(e.id === undefined || e.id === null ? '' : e.id);
      // 自動採番 (`__s_0`) は本文に無いので置き換えようがない
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) return;
      const rep = '識' + (jpSeq++);
      // 単語境界を手で見る (前後が英数字・下線でないこと)。
      let out2 = '';
      let i2 = 0;
      while (i2 < jp.length) {
        const at = jp.indexOf(id, i2);
        if (at < 0) { out2 += jp.slice(i2); break; }
        const before = at > 0 ? jp[at - 1] : '';
        const after = jp[at + id.length] || '';
        const bad = /[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after);
        out2 += jp.slice(i2, at) + (bad ? id : rep);
        i2 = at + id.length;
      }
      jp = out2;
    });
    // id が自動採番の図種は置き換える文字が無い。その場合は**人が見分ける文字**
    // (label / text / name) を置き換える。パネルに出ている文字はそれなので、
    // その読み取りが狭ければ同じ archetype が起きる。
    if (jp === text) {
      els.forEach((e) => {
        const nm = [e.label, e.text, e.name].filter(
          (x) => typeof x === 'string' && /^[A-Za-z_][A-Za-z0-9_ ]*$/.test(x))[0];
        if (!nm) return;
        const rep = '識' + (jpSeq++);
        let out3 = '';
        let i3 = 0;
        while (i3 < jp.length) {
          const at = jp.indexOf(nm, i3);
          if (at < 0) { out3 += jp.slice(i3); break; }
          const before = at > 0 ? jp[at - 1] : '';
          const after = jp[at + nm.length] || '';
          const bad = /[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after);
          out3 += jp.slice(i3, at) + (bad ? nm : rep);
          i3 = at + nm.length;
        }
        jp = out3;
      });
    }
    if (jp === text) { jpNoId.push(key); }
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
      // mermaid が描けない置き換えは、こちらの責任ではないので対象外。
      // ただし黙って捨てない。**0件が何件分の0なのか**が分からなくなる
      // (この検査で block-beta の欠陥が出たとき、他の20図種が実際に
      //  検査されたのかは出力からは読めなかった)。
      // 拒否されたら引用符付きで1回だけ試す。
      //
      // quadrant の点名は本文では裸で置かれるが、日本語を入れるには引用符が要る
      // (A-系で分かっている)。置き換えが裸のままだと mermaid が拒否し、
      // **こちらの置き換えが下手なだけで「対象外」に落ちていた**。
      // 対象外にする前に、こちらでできる直し方を試す。
      let jp2 = null;
      if (!rr.ok) {
        jp2 = jp.replace(/識(\d+)/g, '"識$1"').replace(/""/g, '"');
        const q2 = await b.newPage();
        await q2.goto('http://127.0.0.1:' + PORT + '/');
        await q2.waitForFunction(() => typeof window.mermaid !== 'undefined');
        await q2.evaluate(() => window.mermaid.initialize({
          startOnLoad: false, securityLevel: 'loose', maxTextSize: 5000000 }));
        const rq = await q2.evaluate(async (t) => {
          try { await window.mermaid.parse(t); return { ok: true }; } catch (e) { return { ok: false }; }
        }, jp2);
        await q2.close();
        // 引用符付きが通ったら、比較する本文もそちらに差し替える。
        // **jpEls を引用符なしのまま比較していた** ため、こちらが引用符付きを
        // 正しく読めるようになっても指摘が消えず、直したのに直っていないように
        // 見えていた (検査の誤り 9件目)。本文を差し替えたら読み直す。
        if (rq.ok) {
          rr.ok = true;
          jp = jp2;
          try { jpEls = (mod.parse(jp).elements || []); } catch (e2) { jpEls = null; }
        }
      }
      if (!rr.ok) { jpSkipped.push(key); }
      if (rr.ok) {
        jpChecked.push(key);
        if (jpEls === null) {
          findings.push({ module: key, fn: 'P2 逆向き',
            what: '識別子を日本語にすると parse が例外 (mermaid は通る)' });
        } else if (jpEls.length < els.length) {
          findings.push({ module: key, fn: 'P2 逆向き',
            what: '識別子を日本語にすると要素が ' + els.length + ' → ' + jpEls.length +
                  ' に減る (mermaid は同じように描く)。読み取りが半角英数字に狭まっている' +
                  ' / 再現: ' + JSON.stringify(
                    jp.split(String.fromCharCode(10)).join(' | ')).slice(0, 240) });
        }
      }
    }
  }

  await b.close();
  srv.close();
  if (skipped.length) {
    console.log('  (mermaid が描けないひな形: ' + skipped.length + ' 件を対象外) ' + skipped.join(','));
  }
  console.log('  (逆向きの検査: ' + jpChecked.length + ' 図種を検査 / ' +
    jpSkipped.length + ' 図種は日本語に置き換えると mermaid が受け付けないため対象外' +
    (jpSkipped.length ? ': ' + jpSkipped.join(',') : '') +
    ' (実測: architecture / radar / sankey は mermaid 自身が日本語の識別子を' +
    '受け付けない。引用符でも通らないので、こちらの読み取りが狭いという形は起きない)' +
    ' / ' + jpNoId.length + ' 図種は id もラベルも置き換えられない' +
    (jpNoId.length ? ': ' + jpNoId.join(',') : '') + ')');
  report('r16-count-parity', findings);
})();
