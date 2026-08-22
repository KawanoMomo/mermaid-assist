'use strict';
// R5 ユーザー観点: 1日に何百回も通る経路の摩擦を測る。
//
// エンジニア観点 (壊れているか) とは別に、**壊れていないが辛い**を見る。
// 判定は数値で置く。「使いにくい」で終わる指摘は出さない。
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

// 高頻度操作の許容手数。これを超えたら指摘。
const MAX_CLICKS_SELECT = 1;      // 図の要素を選ぶ
const MAX_CLICKS_CONNECT = 3;     // 線を1本引く
const MAX_UNDO_PER_EDIT = 1;      // 1編集を取り消す
const MAX_MS_FEEDBACK = 1500;     // 操作してから画面に出るまで

// 図種の一覧を直書きしていた。**検査の中身は図種に依存していない**のに、
// 一覧だけが範囲を狭めていた。r1 / r2 / r6 / r11 / r12 / r14 / r18 は
// 契約ベースへ書き換え済みで、この検査には書き換えが届いていなかった。
const TYPES = ['gantt', 'sequenceDiagram', 'flowchart', 'stateDiagram', 'classDiagram',
  'erDiagram', 'requirementDiagram', 'block-beta', 'timeline', 'mindmap', 'gitGraph',
  'pie', 'journey', 'quadrantChart', 'xychart-beta', 'sankey-beta', 'C4Context',
  'packet-beta', 'architecture-beta', 'kanban', 'radar-beta'];

(async () => {
  const findings = [];
  const excluded = [];   // 重ね合わせを持たない図種 (E2 の既知の制限)
  const b = await chromium.launch();

  for (const t of TYPES) {
    const p = await b.newPage({ viewport: { width: VIEWPORT.width, height: VIEWPORT.height } });
    p.on('dialog', d => d.accept());
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 15000 });
    await p.waitForTimeout(600);
    if (t !== 'gantt') { await p.locator('#diagram-type').selectOption(t); await p.waitForTimeout(1700); }
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);

    // U1 図の要素を1クリックで選べるか
    const hit = p.locator('#overlay-layer [data-element-id], #overlay-layer .overlay-bar').first();
    if ((await hit.count()) === 0) {
      // 重ね合わせを持たない図種がある。mermaid が DSL の id を SVG に出さず、
      // 位置由来の id (`node-1` / `edge_0_1`) しか無いので、並べ替えると
      // 別の要素を指す。**入れないと決めている既知の制限** (E 区分 E2) で、
      // `record-claims.js` が毎回実測して記録の正しさを確かめている。
      //
      // ここで指摘にすると、既知の制限を毎回言い直すだけになる。
      // ただし黙って捨てない — **0件が何件分の0なのか**を出す
      // (この規約は r16 / r23 / r24 が持っていて、この検査には無かった)。
      // U1〜U3 だけを飛ばす。U4 (Undo) 以降は重ね合わせに依らないので、
      // ここで `continue` すると**その図種の残りの検査ごと落ちる**
      // (r18 が K1 の失敗で K2〜K5 を丸ごと捨てていたのと同じ形。
      //  一度直した抜けを、別の検査で作りかけた)。
      excluded.push(t);
    } else {
      const t0 = Date.now();
      await hit.click({ force: true });
      await p.waitForFunction(() => window.MA.selection.getSelected().length > 0,
        null, { timeout: 5000 }).catch(() => {});
      const ms = Date.now() - t0;
      const sel = await p.evaluate(() => window.MA.selection.getSelected());
      if (!sel.length) {
        findings.push({ module: t, fn: 'U1 選択', what: MAX_CLICKS_SELECT + 'クリックで選択できない' });
      } else if (ms > MAX_MS_FEEDBACK) {
        findings.push({ module: t, fn: 'U1 選択', what: '反映まで ' + ms + 'ms (上限 ' + MAX_MS_FEEDBACK + ')' });
      }
    }

    // U2 選択したことが図の上で分かるか (枠が出るか)
    const outlined = await p.evaluate(() =>
      [...document.querySelectorAll('#overlay-layer [data-element-id]')]
        .filter(r => r.getAttribute('stroke') && r.getAttribute('stroke') !== 'none').length);
    const hasOverlay = await p.locator('#overlay-layer [data-element-id]').count();
    if (hasOverlay > 0 && outlined === 0) {
      findings.push({ module: t, fn: 'U2 フィードバック', what: '選択しても図の上に何も出ない' });
    }

    // U3 キーボードだけで次の要素へ行けるか
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    await p.keyboard.press('ArrowDown');
    await p.waitForTimeout(700);
    const afterArrow = await p.evaluate(() => window.MA.selection.getSelected());
    if (hasOverlay > 0 && afterArrow.length === 0) {
      findings.push({ module: t, fn: 'U3 キーボード', what: '矢印キーで要素を選べない' });
    }

    // U4 1編集を Undo 1回で戻せるか
    const before = await p.locator('#editor').inputValue();
    await p.locator('#editor').click();
    await p.locator('#editor').press('Control+End');
    await p.locator('#editor').type('\n%% テスト用の一行', { delay: 0 });
    await p.waitForTimeout(1400);
    let undos = 0;
    while (undos < 6 && (await p.locator('#editor').inputValue()) !== before) {
      await p.evaluate(() => window.MA.history.undo());
      await p.waitForTimeout(350);
      undos++;
    }
    if ((await p.locator('#editor').inputValue()) !== before) {
      findings.push({ module: t, fn: 'U4 取り消し', what: '6回 Undo しても編集前に戻らない' });
    } else if (undos > MAX_UNDO_PER_EDIT) {
      findings.push({ module: t, fn: 'U4 取り消し',
        what: '1編集の取り消しに Undo ' + undos + '回 (上限 ' + MAX_UNDO_PER_EDIT + ')' });
    }

    // U5 保存名が内容を識別できるか
    const name = await p.evaluate(() =>
      (typeof currentBaseName === 'function') ? currentBaseName() : null);
    if (name === null) {
      findings.push({ module: t, fn: 'U5 保存', what: '保存名を決める関数が無い' });
    } else if (/^untitled$/i.test(name) || name === '') {
      findings.push({ module: t, fn: 'U5 保存', what: '保存名が内容を識別できない (' + name + ')' });
    }

    await p.close();
  }

  // U6 線を引く手数 (接続モードを配線した図種のみ)
  const CONNECT = [['flowchart', 'sel-node-connect', 'A', 'E'],
                   ['classDiagram', 'sel-class-connect', 'Animal', 'Dog'],
                   ['block-beta', 'block-edit-connect', 'a', 'c']];
  for (const [t, btn, from, to] of CONNECT) {
    const p = await b.newPage({ viewport: { width: VIEWPORT.width, height: VIEWPORT.height } });
    p.on('dialog', d => d.accept());
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 15000 });
    await p.waitForTimeout(600);
    await p.locator('#diagram-type').selectOption(t);
    await p.waitForTimeout(1700);
    const before = await p.locator('#editor').inputValue();
    let clicks = 0;
    const src = p.locator('#overlay-layer [data-element-id="' + from + '"]');
    if (await src.count()) {
      await src.click({ force: true }); clicks++;
      await p.waitForTimeout(700);
      if (await p.locator('#' + btn).count()) {
        await p.locator('#' + btn).click(); clicks++;
        await p.waitForTimeout(600);
        const tgt = p.locator('#overlay-layer [data-element-id="' + to + '"]');
        if (await tgt.count()) { await tgt.click({ force: true }); clicks++; await p.waitForTimeout(1200); }
      }
    }
    const after = await p.locator('#editor').inputValue();
    if (after === before) {
      findings.push({ module: t, fn: 'U6 接続', what: '図の上から線を引けない' });
    } else if (clicks > MAX_CLICKS_CONNECT) {
      findings.push({ module: t, fn: 'U6 接続',
        what: '線1本に ' + clicks + 'クリック (上限 ' + MAX_CLICKS_CONNECT + ')' });
    }
    await p.close();
  }

  await b.close();
  if (excluded.length) {
    console.log('  (重ね合わせが無く U1〜U3 を試せない: ' + excluded.length + ' 図種) ' +
      excluded.join(',') + '  ← E2 の既知の制限。U4 以降は全図種で見ている');
  }
  report('r5-user', findings, { examined: TYPES.length, total: 21 });
})();
