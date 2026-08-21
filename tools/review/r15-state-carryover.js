'use strict';
// R15 状態の持ち越し: 文書が入れ替わったのに、前の文書の状態が残っていないか。
//
// 図種を切り替えると本文はひな形に置き換わる。そのとき画面に残ってよい状態と、
// 残ってはいけない状態がある。
//
//   残ってよい: ズーム、パネルの開閉、Undo 履歴 (切替そのものを取り消せる)
//   残ってはいけない: 前の文書に紐づく入力値、選択、絞り込み
//
// 残ってはいけないものが残ると、利用者は「新しい図を作った」つもりなのに前の図の
// 入力を持ったままになる。そのまま追加を押せば、意図しない名前や日付の要素が入る。
// 本文は入れ替わっているので、画面と本文で食い違いが起きている状態でもある。
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

// 図種と、その図種の追加フォームの入力欄
const FORMS = [
  ['gantt', ['#prop-add-label', '#prop-add-id']],
  ['flowchart', ['#fc-add-node-id', '#fc-add-node-label']],
  ['classDiagram', ['#cl-add-class-id']],
  ['C4Context', ['#c4-add-id', '#c4-add-label']],
  ['block-beta', ['#block-add-id', '#block-add-label']],
];

(async () => {
  const findings = [];
  const b = await chromium.launch();

  for (const [type, fields] of FORMS) {
    const p = await b.newPage({ viewport: { width: VIEWPORT.width, height: VIEWPORT.height } });
    p.on('dialog', async d => { await d.accept(); });
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await p.waitForTimeout(600);
    if (type !== 'gantt') { await p.locator('#diagram-type').selectOption(type); await p.waitForTimeout(1700); }
    await p.waitForTimeout(400);

    // 入力欄に値を入れる
    let filled = 0;
    for (const f of fields) {
      const loc = p.locator(f);
      if (await loc.count()) { await loc.fill('ZZ持ち越しZZ'); filled++; }
    }
    if (!filled) { await p.close(); continue; }

    // 別の図種へ行って戻る (本文はひな形に置き換わる)
    const other = type === 'flowchart' ? 'classDiagram' : 'flowchart';
    await p.locator('#diagram-type').selectOption(other);
    await p.waitForTimeout(1700);
    await p.locator('#diagram-type').selectOption(type);
    await p.waitForTimeout(1900);

    const left = await p.evaluate((fs) => fs.map((sel) => {
      const el = document.querySelector(sel);
      return el ? { sel: sel, v: el.value } : null;
    }).filter(Boolean).filter(x => x.v && x.v.indexOf('ZZ') >= 0).map(x => x.sel), fields);

    if (left.length) {
      findings.push({ module: type, fn: 'S1 入力の持ち越し',
        what: '\u56f3\u7a2e\u3092\u5207\u308a\u66ff\u3048\u3066\u623b\u3059\u3068\u524d\u306e\u5165\u529b\u304c\u6b8b\u308b: ' + left.join(',') });
    }
    await p.close();
  }

  // 選択が持ち越されないこと (本文が入れ替わったのに選択が残ると
  // パネルが「見つかりません」になる)
  {
    const p = await b.newPage({ viewport: { width: VIEWPORT.width, height: VIEWPORT.height } });
    p.on('dialog', async d => { await d.accept(); });
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await p.waitForTimeout(800);
    const hit = p.locator('#overlay-layer .overlay-bar, #overlay-layer [data-element-id]').first();
    if (await hit.count()) { await hit.click({ force: true }); await p.waitForTimeout(600); }
    await p.locator('#diagram-type').selectOption('flowchart');
    await p.waitForTimeout(1800);
    const sel = await p.evaluate(() => window.MA.selection.getSelected());
    const panel = await p.evaluate(() => (document.getElementById('props-content').textContent || '').slice(0, 40));
    if (sel.length) {
      findings.push({ module: '横断', fn: 'S2 選択の持ち越し',
        what: '\u56f3\u7a2e\u3092\u5207\u308a\u66ff\u3048\u3066\u3082\u9078\u629e\u304c\u6b8b\u308b: ' + JSON.stringify(sel) + ' / \u30d1\u30cd\u30eb: ' + panel });
    }
    await p.close();
  }

  await b.close();
  report('r15-state-carryover', findings, { examined: FORMS.length, total: 21 });
})();
