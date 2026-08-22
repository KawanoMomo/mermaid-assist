'use strict';
// R8 スケール耐性: 要素が 10倍・50倍になったときに壊れる操作を探す。
//
// これまでのレビュアーは全部テンプレート (要素5〜8個) を相手にしていた。
// 実務の図はそのサイズでは終わらない。ヘビーユーザは数十〜数百要素の図を
// 毎日触るので、**そこで初めて壊れるもの**が本番で出る欠陥になる。
//
// 見るもの:
//   - 一覧・オーバーレイが要素を取りこぼさないか (件数の一致)
//   - 100要素の図で、最後の要素を選んで消したときに**それが**消えるか
//     (先頭が消える系の取り違えは、要素が増えるほど当たりやすくなる)
//   - 操作から画面反映までの時間が実用範囲か
const path = require('path');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { report } = require('./lib');
const ROOT = process.argv[2];
// 測定条件も検査対象。
//
// これまで 1400x900 で測っていた。実利用は 13インチのノートPC (1366x768) が
// 普通で、132px 低い。この差でプロパティパネルの収まりが 8/21 → 15/21 に
// 変わっていた (UI-011)。**観点が足りなかったのではなく、測る場所が
// 実利用と違っていた**。指摘が出ないのは、出ない条件で測っているからかもしれない。
const VIEWPORT = { width: 1366, height: 768 };

const HTML = 'file:///' + path.resolve(ROOT, 'mermaid-assist.html').split(path.sep).join('/');

const N = 100;                 // 実務の上限に近い規模
const MAX_MS_RENDER = 8000;    // 本文を差し替えてから描画が終わるまで
const MAX_MS_SELECT = 2500;    // 要素を1つ選ぶ
const MAX_MS_DELETE = 3000;    // 1つ消す

// 図種ごとに巨大文書の生成器を手書きしていた (flowchart / gantt / class /
// sequence の4つ)。**生成器の表を持つと必ず漏れる** — 残り17図種は
// 「大きくしたときに壊れるか」を一度も見ていなかった。
//
// モジュール自身の `operations.add` を繰り返して育てる。何を足せばよいかは
// モジュールが知っているので、こちらは知らなくてよい (r23 が同じやり方で
// 21図種すべてに追加を通している)。
//
// 育てられない図種 (add が本文を変えない種類しか無い) は対象外として数える。
// **0件が何件分の0なのか**を出す。
const TYPES = ['gantt', 'sequenceDiagram', 'flowchart', 'stateDiagram', 'classDiagram',
  'erDiagram', 'requirementDiagram', 'block-beta', 'timeline', 'mindmap', 'gitGraph',
  'pie', 'journey', 'quadrantChart', 'xychart-beta', 'sankey-beta', 'C4Context',
  'packet-beta', 'architecture-beta', 'kanban', 'radar-beta'];

// ページの中でひな形を N 要素まで育てる。
async function grow(page, target) {
  return page.evaluate((n) => {
    const txt0 = document.getElementById('editor').value;
    const mod = Object.values(window.MA.modules).find(m => m.detect && m.detect(txt0));
    if (!mod || !mod.operations || typeof mod.operations.add !== 'function') return null;
    const parse = (t) => { try { return mod.parse(t).elements || []; } catch (e) { return []; } };
    let text = txt0;
    let els = parse(text);
    if (!els.length) return null;
    // 追加できる種類を、一覧に出ている種類から拾う
    const kinds = [];
    els.forEach(e => { const k = e.kind; if (kinds.indexOf(k) < 0) kinds.push(k); });
    if (!kinds.length) kinds.push(undefined);
    let guard = 0;
    while (els.length < n && guard < n * 4) {
      guard++;
      const i = els.length;
      const ends = els.map(e => e.name || e.id || e.label).filter(Boolean);
      let grew = false;
      for (const kind of kinds) {
        const nm = 'S' + i;
        const props = { name: nm, label: nm, text: nm, id: nm, title: nm, kind: kind,
          from: ends[0], to: ends[1] || ends[0], target: ends[0], reltype: 'satisfies',
          section: ends[0], column: ends[0], parentLine: 2, siblingLine: 2, line: 2,
          period: nm, event: nm, meta: '', shape: '', icon: 'server', parent: '',
          fromSide: 'R', toSide: 'L', score: 3, actors: '', reqType: 'requirement',
          startBit: 0, endBit: 0, x: 0.5, y: 0.5, value: 1, values: [1, 2, 3] };
        let out;
        try { out = mod.operations.add(text, kind, props); } catch (e) { continue; }
        if (typeof out !== 'string' || out === text) continue;
        if (out.indexOf('undefined') >= 0) continue;
        const after = parse(out);
        if (after.length <= els.length) continue;
        text = out; els = after; grew = true;
        break;
      }
      if (!grew) break;
    }
    const last = els[els.length - 1];
    return { text: text, count: els.length,
      last: String((last && (last.id || last.name || last.label)) || '') };
  }, target);
}

(async () => {
  const findings = [];
  const tooSmall = [];      // N まで育てられない図種
  const grownCounts = [];   // 実際に育った要素数
  const b = await chromium.launch();

  for (const type of TYPES) {
    const p = await b.newPage({ viewport: { width: VIEWPORT.width, height: VIEWPORT.height } });
    p.on('dialog', d => d.accept());
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await p.waitForTimeout(400);
    if (type !== 'gantt') { await p.locator('#diagram-type').selectOption(type); await p.waitForTimeout(1500); }
    const grown = await grow(p, N);
    if (!grown || grown.count < 20) {
      tooSmall.push(type + (grown ? '(' + grown.count + '要素まで)' : '(育てられない)'));
      await p.close();
      continue;
    }
    const c = { type: type, text: grown.text, last: grown.last };
    grownCounts.push(type + ':' + grown.count);

    // 本文を丸ごと差し替える (実務では貼り付けで来る)
    const t0 = Date.now();
    await p.evaluate((txt) => {
      const ed = document.getElementById('editor');
      ed.value = txt;
      ed.dispatchEvent(new Event('input', { bubbles: true }));
    }, c.text);
    await p.waitForFunction(() => !!document.querySelector('#preview-svg svg'),
      null, { timeout: MAX_MS_RENDER + 5000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const renderMs = Date.now() - t0;
    if (renderMs > MAX_MS_RENDER) {
      findings.push({ module: c.type, fn: 'S1 描画',
        what: N + '要素の描画に ' + renderMs + 'ms (上限 ' + MAX_MS_RENDER + ')' });
    }

    // S2 取りこぼし: parse が数えた要素数と、一覧に並ぶ行数が合うか。
    //
    // 行の数え方を `[data-line]` にしていたが、これは**行あたり複数付く**
    // (選択ボタンと削除ボタンの両方)。しかも gantt はタスク一覧と
    // セクション一覧が別なので、片方だけ数えると足りなく見える。
    // 実際、育てた gantt は100要素中96個がセクションで、
    // 「要素100に対し一覧4行」と誤報した (検査の誤り20件目)。
    //
    // パネル全体で**異なる data-element-id の個数**を数える。
    const counts = await p.evaluate(() => {
      const txt = document.getElementById('editor').value;
      let parsed = -1;
      try {
        const m = Object.values(window.MA.modules).find(x => x.detect && x.detect(txt));
        parsed = m ? (m.parse(txt).elements || []).length : -1;
      } catch (e) { parsed = -2; }
      const ids = new Set();
      document.querySelectorAll('#props-content [data-element-id]').forEach(
        (n) => ids.add(n.getAttribute('data-element-id')));
      const overlay = document.querySelectorAll('#overlay-layer [data-element-id]').length;
      return { parsed, rows: ids.size, overlay };
    });
    if (counts.parsed > 0 && counts.rows > 0 && counts.rows < counts.parsed) {
      findings.push({ module: c.type, fn: 'S2 取りこぼし',
        what: '要素 ' + counts.parsed + ' に対し一覧は ' + counts.rows + ' 件しか出ない' });
    }

    // S3 末尾の要素を選べるか (一覧のスクロール / オーバーレイの当たり判定)
    // 末尾の要素は**画面から**取る。parse の `id` と、一覧が付ける
    // `data-element-id` は別物のことがある — gitGraph の行は行番号 (101) を
    // 付けており、要素の id (S99) では当たらず「削除ボタンに辿り着けない」と
    // 誤報した (検査の誤り21件目)。
    const lastKey = await p.evaluate(() => {
      const nodes = [...document.querySelectorAll('#props-content [data-element-id]')];
      return nodes.length ? nodes[nodes.length - 1].getAttribute('data-element-id') : null;
    });
    if (lastKey) c.last = lastKey;
    const lastRow = p.locator('#props-content [data-element-id="' + c.last + '"]').first();
    if (await lastRow.count()) {
      const t1 = Date.now();
      await lastRow.scrollIntoViewIfNeeded();
      await lastRow.click({ force: true });
      await p.waitForTimeout(500);
      const ms = Date.now() - t1;
      if (ms > MAX_MS_SELECT) {
        findings.push({ module: c.type, fn: 'S3 末尾選択',
          what: '末尾要素の選択に ' + ms + 'ms (上限 ' + MAX_MS_SELECT + ')' });
      }
    }

    // S3 で行の「編集」を押すと、プロパティ欄は一覧から**その要素の編集画面**へ
    // 切り替わる。一覧に戻さずに削除ボタンを探すと当然見つからず、最初これを
    // 「削除ボタンに辿り着けない」という欠陥として報告してしまった。
    // レビュアー側の順序の誤りで、製品の欠陥ではない。
    await p.keyboard.press('Escape');
    await p.waitForTimeout(700);

    // S4 規模が大きいときに「押した要素」が消えるか。
    // 取り違えは要素が多いほど起きやすく、かつ気付きにくい。
    // 削除ボタンは行と同じ data-element-id を持つ (listItemHtml が両方に付ける)。
    // 最初は title で引こうとしたが、title は「<ラベル>」を削除 でありラベルは
    // 表示名 (ノード99) なので id (N99) では当たらない。id で引くのが正しい。
    const delBtn = p.locator('#props-content button[data-element-id="' + c.last + '"][class*="del"], ' +
      '#props-content button[data-element-id="' + c.last + '"][class*="Del"]').first();
    const beforeTxt = await p.locator('#editor').inputValue();
    if (await delBtn.count()) {
      const t2 = Date.now();
      await delBtn.scrollIntoViewIfNeeded();
      await delBtn.click({ force: true });
      await p.waitForTimeout(900);
      const ms = Date.now() - t2;
      const afterTxt = await p.locator('#editor').inputValue();
      if (afterTxt === beforeTxt) {
        findings.push({ module: c.type, fn: 'S4 大規模削除', what: '末尾要素の削除が効かない' });
      } else {
        // 消えたのが「押した要素」であること。ほかの要素が減っていたら取り違え。
        //
        // 以前は id を本文から正規表現で探していた。**自動採番の id
        // (`__s_99` / `__p_99` / `__bar_99`) は本文に現れない**ので、
        // どの図種でも「消えたのは []」になり、4図種を誤報していた
        // (検査の誤り19件目)。id ではなく、モジュールが読み取った
        // 見分けのつく文字で比べる。
        const idOf = (e) => [e.label, e.name, e.text, e.period, e.id]
          .filter(x => typeof x === 'string' && x.trim() && !/^__/.test(x))[0] || '';
        const names = await p.evaluate((pair) => {
          const mod = Object.values(window.MA.modules).find(m => m.detect && m.detect(pair[0]));
          if (!mod) return null;
          // **関係 (エッジ) も数に入れる。** 一覧の末尾は多くの図種でエッジで、
          // 要素だけ比べると「1つ消したのに何も減っていない」と誤報する
          // (検査の誤り22件目)。
          const take = (t) => {
            try {
              const r = mod.parse(t);
              const els = (r.elements || []).map((e) =>
                [e.label, e.name, e.text, e.period, e.id]
                  .filter(x => typeof x === 'string' && x.trim() && x.indexOf('__') !== 0)[0] || '');
              const rels = (r.relations || []).map((x) =>
                '関係:' + (x.from || '') + '->' + (x.to || ''));
              return els.concat(rels);
            } catch (e) { return null; }
          };
          return { before: take(pair[0]), after: take(pair[1]) };
        }, [beforeTxt, afterTxt]);
        if (!names || !names.before || !names.after) {
          findings.push({ module: c.type, fn: 'S4 大規模削除',
            what: '削除の前後を読み取れない (判定できない)' });
        } else {
          const cnt = (arr) => arr.reduce((m, x) => { m[x] = (m[x] || 0) + 1; return m; }, {});
          const bc = cnt(names.before), ac = cnt(names.after);
          const gone = Object.keys(bc).filter(k => (ac[k] || 0) < bc[k]);
          const added = Object.keys(ac).filter(k => (bc[k] || 0) < ac[k]);
          // 何を消したのかは、消えたものから読む (一覧の末尾は要素のことも
          // 関係のこともある)。
          //
          //   要素が消えた  → その要素が対象。**その要素を指す関係**が
          //                   一緒に消えるのは巻き添えではない
          //                   (sankey のノードは流れの端点としてしか存在しない)
          //   関係だけ消えた → 関係が対象。ちょうど1本ならよい
          //
          // 最初は「消えたのは1つだけ」を求めたが、それでは sankey の正しい
          // 実装を欠陥として報告してしまう。次に関係を一律で除いたら、
          // 関係を消した図種が全部「巻き添え」になった。**対象が何かを
          // 決めてから巻き添えを数える**のが正しい順序だった。
          const elemsGone = gone.filter(k => k.indexOf('関係:') !== 0);
          const relsGone = gone.filter(k => k.indexOf('関係:') === 0);
          let collateral = [];
          if (elemsGone.length) {
            const target = elemsGone[0];
            collateral = elemsGone.slice(1)
              .concat(relsGone.filter(k => k.indexOf(target) < 0));
          } else {
            collateral = relsGone.slice(1);   // 関係を1本消したなら残りは巻き添え
          }
          if (!gone.length || collateral.length || added.length) {
            findings.push({ module: c.type, fn: 'S4 大規模削除',
              what: '1つ消したのに 減った=[' + gone.slice(0, 4).join(',') +
                    '] 巻き添え=[' + collateral.slice(0, 4).join(',') +
                    '] 増えた=[' + added.slice(0, 4).join(',') + ']' });
          }
        }
        if (ms > MAX_MS_DELETE) {
          findings.push({ module: c.type, fn: 'S4 大規模削除',
            what: '1件の削除に ' + ms + 'ms (上限 ' + MAX_MS_DELETE + ')' });
        }
      }
    } else {
      findings.push({ module: c.type, fn: 'S4 大規模削除',
        what: '末尾要素 ' + c.last + ' の削除ボタンに辿り着けない' });
    }

    await p.close();
  }

  await b.close();
  console.log('  (育てて試した: ' + grownCounts.length + ' 図種 ' +
    JSON.stringify(grownCounts).slice(0, 200) + ' / ' +
    '20要素まで育てられない: ' + tooSmall.length +
    (tooSmall.length ? ' (' + tooSmall.join(',') + ')' : '') + ')');
  report('r8-scale', findings, { examined: grownCounts.length, total: 21 });
})();
