'use strict';
// R17 Undo / Redo の往復整合: 戻して進めたら元の場所に帰ってくるか。
//
// これまで Undo は「1編集 = 1回で戻れるか」(r5) と「削除を戻せるか」(r7 K6) しか
// 見ていなかった。どちらも**1手**の検査で、複数手を戻して進める往復は誰も見ていない。
//
// 往復が壊れる形は静かで、しかも取り返しがつかない:
//
//   戻したあとに進めると別の状態になる  → 作業が失われたことに後から気づく
//   途中の状態が飛ばされる              → 「2回戻したのに3手前にいる」
//   進めなくなる (Redo が消える)         → 戻しすぎたときに復旧できない
//
// 判定は「N手の操作を記録し、N回戻して各段が一致し、N回進めて各段が一致すること」。
// 実機の履歴を使うので、モジュール単体では見えない app 側の取りこぼしも出る。
const path = require('path');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { report } = require('./lib');
const ROOT = process.argv[2];
const HTML = 'file:///' + path.resolve(ROOT, 'mermaid-assist.html').split(path.sep).join('/');

// 図種と、その図種で確実に本文を変える3手
const CASES = [
  { type: 'gantt', steps: [
    { name: 'タスク追加', run: async (p) => {
      await p.locator('#prop-add-label').fill('U1');
      await p.locator('#prop-add-start').fill('2026-10-01');
      await p.locator('#prop-add-end').fill('2026-10-05');
      await p.locator('#prop-add-btn').click();
    } },
    { name: 'もう1つ追加', run: async (p) => {
      await p.locator('#prop-add-label').fill('U2');
      await p.locator('#prop-add-start').fill('2026-11-01');
      await p.locator('#prop-add-end').fill('2026-11-05');
      await p.locator('#prop-add-btn').click();
    } },
    { name: '一覧から削除', run: async (p) => {
      const del = p.locator('#props-content button[class*="del"], #props-content button[title*="削除"]').first();
      if (await del.count()) await del.click({ force: true });
    } },
  ] },
  { type: 'flowchart', steps: [
    { name: 'ノード追加', run: async (p) => {
      await p.locator('#fc-add-node-id').fill('U1');
      await p.locator('#fc-add-node-btn').click();
    } },
    { name: 'ラベル変更', run: async (p) => {
      await p.locator('#overlay-layer [data-element-id="A"]').click({ force: true });
      await p.waitForTimeout(500);
      const l = p.locator('#sel-node-label');
      if (await l.count()) { await l.fill('変更後'); await l.blur(); }
    } },
    { name: '一覧から削除', run: async (p) => {
      await p.keyboard.press('Escape');
      await p.waitForTimeout(400);
      const del = p.locator('#props-content button[class*="del"]').first();
      if (await del.count()) await del.click({ force: true });
    } },
  ] },
];

(async () => {
  const findings = [];
  const b = await chromium.launch();

  for (const c of CASES) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('dialog', async d => { await d.accept(); });
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await p.waitForTimeout(600);
    if (c.type !== 'gantt') { await p.locator('#diagram-type').selectOption(c.type); await p.waitForTimeout(1700); }
    await p.waitForTimeout(500);

    // 各手の後の本文を記録する
    const states = [await p.locator('#editor').inputValue()];
    for (const st of c.steps) {
      await st.run(p);
      await p.waitForTimeout(1100);
      states.push(await p.locator('#editor').inputValue());
    }
    // 手が本当に本文を変えたか (変えていないなら検査が成立しない)
    const effective = states.filter((v, i) => i === 0 || v !== states[i - 1]).length - 1;
    if (effective < 2) {
      findings.push({ module: c.type, fn: 'U0 前提',
        what: '検査用の操作が本文を変えていない (' + effective + '/' + c.steps.length + ') — 検査が空振りしている' });
      await p.close();
      continue;
    }

    // 戻す: states[n-1] → … → states[0]
    for (let i = states.length - 1; i >= 1; i--) {
      await p.evaluate(() => window.MA.history.undo());
      await p.waitForTimeout(500);
      const now = await p.locator('#editor').inputValue();
      if (now !== states[i - 1]) {
        findings.push({ module: c.type, fn: 'U1 戻す',
          what: (states.length - i) + '回戻したところが記録と違う (期待: ' + c.steps.slice(0, i - 1).map(s => s.name).join('→') +
                ' の後 / 実際の長さ ' + now.length + ' vs ' + states[i - 1].length + ')' });
        break;
      }
    }

    // 進める: states[0] → … → states[n-1]
    for (let i = 1; i < states.length; i++) {
      await p.evaluate(() => window.MA.history.redo());
      await p.waitForTimeout(500);
      const now = await p.locator('#editor').inputValue();
      if (now !== states[i]) {
        findings.push({ module: c.type, fn: 'U2 進める',
          what: i + '回進めたところが記録と違う (期待: ' + c.steps[i - 1].name +
                ' の後 / 実際の長さ ' + now.length + ' vs ' + states[i].length + ')' });
        break;
      }
    }
    await p.close();
  }

  await b.close();
  report('r17-undo-redo', findings);
})();
