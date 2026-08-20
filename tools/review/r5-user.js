'use strict';
// R5 ユーザー観点: 1日に何百回も通る経路の摩擦を測る。
//
// エンジニア観点 (壊れているか) とは別に、**壊れていないが辛い**を見る。
// 判定は数値で置く。「使いにくい」で終わる指摘は出さない。
const path = require('path');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { report } = require('./lib');
const ROOT = process.argv[2];
const HTML = 'file:///' + path.resolve(ROOT, 'mermaid-assist.html').split(path.sep).join('/');

// 高頻度操作の許容手数。これを超えたら指摘。
const MAX_CLICKS_SELECT = 1;      // 図の要素を選ぶ
const MAX_CLICKS_CONNECT = 3;     // 線を1本引く
const MAX_UNDO_PER_EDIT = 1;      // 1編集を取り消す
const MAX_MS_FEEDBACK = 1500;     // 操作してから画面に出るまで

const TYPES = ['gantt', 'flowchart', 'block-beta', 'classDiagram', 'erDiagram', 'stateDiagram'];

(async () => {
  const findings = [];
  const b = await chromium.launch();

  for (const t of TYPES) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
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
      findings.push({ module: t, fn: 'U1 選択', what: '図の要素をクリックで選べない (オーバーレイが無い)' });
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
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
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
  report('r5-user', findings);
})();
