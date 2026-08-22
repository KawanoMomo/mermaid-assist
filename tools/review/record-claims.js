'use strict';
// 棚卸しの散文が主張している「測れる事実」を、機械で確かめる。
//
// Y8 (A 区分の抜き取り再検証) でこういう数字が出た。
//
//   A 区分 (84件・テストで守られている)  … 抜き取り10件すべて記録どおり
//   E 区分 (5件・判断を書いた文章のみ)   … **5件中4件が誤り**
//
// 同じ「済」でも、機械が触れる形かどうかで寿命が違う。
// **記録の形式が、記録の寿命を決めている。**
//
// E2 は現に誤っていた (「4図種」ではなく11図種、「mermaid が id を出さない」は
// kanban に当てはまらなかった)。誤っていても誰も気付かない状態だった。
//
// ここで守るのは「今も正しいが、崩れたら誰も気付かない」主張だけ。
// 価値判断 (G2 のパネル構成、G3 の複写の意味) は正しく散文なので触らない。
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const ROOT = process.argv[2];
const { loadModules } = require('./lib');
const M = loadModules(ROOT);

const findings = [];

// ── G1: class / er / state の move が無効のまま ──────────────────────────
//
// 棚卸し G1 の主張:
//   「`move: false` のままなので実害はないが、`move: true` に戻すだけで
//     無言の図破壊が復活する状態が残る」
//
// `_is*Line` の述語が「宣言行か」で判定しており、コンポジット状態 (`state Active {`)
// を宣言行と誤判定して他状態の子に吸い込む。mermaid の parse も render も通るので
// 無言で壊れる。述語をブレース深度ベースに直すまで UI から出さない、という判断。
{
  const files = ['class.js', 'er.js', 'state.js'];
  files.forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'modules', f), 'utf8');
    if (/move:\s*true/.test(src)) {
      findings.push({ module: f, fn: 'G1 move',
        what: '棚卸し G1 は「move: false のまま」と記録しているが `move: true` がある。' +
              '述語をブレース深度ベースに直したなら G1 を更新し、直していないなら戻すこと' });
    }
  });
}

// ── E2: 重ね合わせを持たない図種は SVG の id が位置由来 ────────────────
//
// 棚卸し E2 の主張 (2026-08-21 訂正後):
//   「残る10図種は id が `node-1` / `edge_0_1` のような位置由来で、
//     並べ替えると別の要素を指す」
//
// kanban だけは列名と DSL の id をそのまま出すので実装できた (A79)。
// **もし mermaid が他の図種でも使える id を出すようになったら、
// 見送りの理由は消える。** そのとき誰かが気付く必要がある。
// 判別の条件は「パターンに似ているか」ではなく、
// **id が DSL の名前と一致するか**。kanban の重ね合わせが実装できたのは
// `<g id="設計 中">` のように列名そのものが出ていたからで、
// `node_0` のような添字は並べ替えると別の要素を指すので使えない。
//
// 最初は正規表現で `node-\d+` などを列挙していたが、パターンが狭くて
// 偽陽性を 2 件出した (mindmap の `node_0` と sankey の `linearGradient-6`)。
// 列挙は必ず漏れるので、問うべきことそのものを問う。
const NO_OVERLAY = ['journey', 'sankey-beta', 'mindmap', 'timeline',
  'gitGraph', 'pie', 'quadrantChart', 'xychart-beta', 'packet-beta', 'radar-beta'];

// ── E7: sequence の別名に `;` は引用符でも通らない ────────────────────
//
// architecture のほうは引用符で通ることが分かり実装した (A83)。
// sequence の `;` は記録どおり通らない。**mermaid が受け付けるようになったら、
// 診断で「使えません」と言い続けるのは嘘になる。**
const SEQ_ALIAS = 'sequenceDiagram\n    participant A as "a;b"\n    A->>A: x\n';

const HTML = 'file:///' + path.resolve(ROOT, 'mermaid-assist.html').split(path.sep).join('/');
const PORT = 9651;
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
  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch();

  // E7 を mermaid に直接聞く
  {
    const p = await b.newPage();
    await p.goto('http://127.0.0.1:' + PORT + '/');
    await p.waitForFunction(() => typeof window.mermaid !== 'undefined');
    await p.evaluate(() => window.mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' }));
    const ok = await p.evaluate(async (t) => {
      try { await window.mermaid.parse(t); return true; } catch (e) { return false; }
    }, SEQ_ALIAS);
    if (ok) {
      findings.push({ module: 'sequence', fn: 'E7 別名の ;',
        what: '棚卸し E7 は「引用符でも通らない」と記録しているが、mermaid は通すようになった。' +
              '診断の「使えません」が嘘になるので、E7 と diagnose.js を更新すること' });
    }
    await p.close();
  }

  // E2 を実 UI で確かめる
  {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 20000 });
    for (const t of NO_OVERLAY) {
      await p.locator('#diagram-type').selectOption(t);
      await p.waitForTimeout(1600);
      const r = await p.evaluate(() => {
        const svg = document.querySelector('#preview-svg svg');
        const ed = document.getElementById('editor').value;
        if (!svg) return null;
        // こちらの parse が知っている名前
        let names = [];
        const mods = window.MA.modules;
        for (const k of Object.keys(mods)) {
          if (mods[k] && typeof mods[k].detect === 'function' && mods[k].detect(ed)) {
            try {
              const pr = mods[k].parse(ed);
              names = (pr.elements || []).map((e) => String(e.id))
                .concat((pr.elements || []).map((e) => String(e.label || e.text || e.name || '')));
            } catch (e) { /* parse できなければ名前は無い */ }
            break;
          }
        }
        const ids = Array.from(svg.querySelectorAll('[id]')).map((e) => e.id)
          .filter((x) => x && !/^ma-|^mermaid-svg-/.test(x));
        // DSL の名前と一致する id があれば、重ね合わせは組める
        const usable = ids.filter((x) => names.indexOf(x) >= 0);
        return { usable: usable, total: ids.length };
      });
      if (r && r.usable.length) {
        findings.push({ module: t, fn: 'E2 id',
          what: '棚卸し E2 は「使える id を出さない」と記録しているが、' +
                'DSL の名前と一致する id がある (' + JSON.stringify(r.usable.slice(0, 3)) +
                ')。kanban と同じやり方で重ね合わせを実装できるか再判定すること' });
      }
    }
    await p.close();
  }

  await b.close();
  srv.close();
  const dir = path.join(__dirname, 'out');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'record-claims.json'), JSON.stringify(findings, null, 1));
  console.log('[record-claims] findings=' + findings.length +
    ' / 検めた主張 3件 (G1 / E2 / E7)');
  findings.forEach((f) => console.log('  - ' + f.module + '.' + f.fn + ': ' + f.what));
})();
