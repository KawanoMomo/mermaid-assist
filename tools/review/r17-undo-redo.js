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


// UI 駆動では図種ごとに手順が違うので2図種しか見られなかった (実測 2/21)。
// 「戻して進めたら元に帰る」は図種に依らない性質なので、契約 (operations.*) で
// 本文を作り、エディタ経由で流し込む走査を足して全21図種に広げる。
//
// 取り返しのつかない操作なので、19図種が未検査のままなのは通せない。
const ALL_TYPES = ['gantt', 'sequenceDiagram', 'flowchart', 'stateDiagram', 'classDiagram',
  'erDiagram', 'requirementDiagram', 'block-beta', 'timeline', 'mindmap', 'gitGraph',
  'pie', 'journey', 'quadrantChart', 'xychart-beta', 'sankey-beta', 'C4Context',
  'packet-beta', 'architecture-beta', 'kanban', 'radar-beta'];

(async () => {
  const findings = [];
  const examinedTypes = new Set();
  const skippedTypes = [];
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

  // ── 契約駆動の走査 (全21図種) ─────────────────────────────────────────
  for (const type of ALL_TYPES) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('dialog', async d => { await d.accept(); });
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await p.waitForTimeout(500);
    if (type !== 'gantt') { await p.locator('#diagram-type').selectOption(type); await p.waitForTimeout(1600); }
    await p.waitForTimeout(300);

    // 3手ぶんの本文を契約で作る。作れない図種はここで正直に外れる。
    const plan = await p.evaluate(() => {
      const mods = window.MA.modules;
      const t0 = document.getElementById('editor').value;
      let mod = null;
      for (const k of Object.keys(mods)) {
        if (mods[k] && typeof mods[k].detect === 'function' && mods[k].detect(t0)) { mod = mods[k]; break; }
      }
      if (!mod || !mod.operations) return { skip: 'モジュールが見つからない' };
      let els = [];
      try { els = mod.parse(t0).elements || []; } catch (e) { return { skip: 'parse 例外' }; }
      if (!els.length) return { skip: '要素が無い' };
      const FIELDS = ['label', 'text', 'title', 'name', 'value'];
      const steps = [];
      let cur = t0;
      // 1手目・2手目: ラベルを2回変える
      for (const v of ['ZZ手1', 'ZZ手2']) {
        const el = (() => { try { return (mod.parse(cur).elements || [])[0]; } catch (e) { return null; } })();
        if (!el) break;
        let next = null;
        for (const f of FIELDS) {
          let c;
          try { c = mod.operations.update(cur, el.line, f, v, { kind: el.kind, id: el.id, blockId: el.id, name: el.name }); }
          catch (e) { continue; }
          if (c && c !== cur) { next = c; break; }
        }
        if (!next) break;
        steps.push(next); cur = next;
      }
      // 3手目: 消す
      const el2 = (() => { try { return (mod.parse(cur).elements || [])[0]; } catch (e) { return null; } })();
      if (el2 && typeof mod.operations.delete === 'function') {
        let d = null;
        try { d = mod.operations.delete(cur, el2.line, { kind: el2.kind, id: el2.id, blockId: el2.id, name: el2.name }); }
        catch (e) { d = null; }
        if (d && d !== cur) steps.push(d);
      }
      return { base: t0, steps: steps };
    });

    if (plan.skip || !plan.steps || plan.steps.length < 2) {
      // 検査が成立しない図種は黙って通さず、外れたことを記録する
      skippedTypes.push(type + ': ' + (plan.skip || ((plan.steps || []).length + '手しか作れない')));
      await p.close();
      continue;
    }
    examinedTypes.add(type);

    // エディタ経由で1手ずつ流し込む (アプリの履歴に載せる)
    const states = [plan.base];
    for (const st of plan.steps) {
      await p.evaluate((t) => {
        const ed = document.getElementById('editor');
        ed.value = t;
        ed.dispatchEvent(new Event('input', { bubbles: true }));
      }, st);
      await p.waitForTimeout(700);
      states.push(await p.locator('#editor').inputValue());
    }

    // 戻す
    let broke = false;
    for (let i = states.length - 1; i >= 1; i--) {
      await p.evaluate(() => window.MA.history.undo());
      await p.waitForTimeout(350);
      const now = await p.locator('#editor').inputValue();
      if (now !== states[i - 1]) {
        findings.push({ module: type, fn: 'U1 戻す (契約駆動)',
          what: (states.length - i) + '回戻したところが記録と違う (長さ ' + now.length + ' vs ' + states[i - 1].length + ')' });
        broke = true;
        break;
      }
    }
    // 進める
    if (!broke) {
      for (let i = 1; i < states.length; i++) {
        await p.evaluate(() => window.MA.history.redo());
        await p.waitForTimeout(350);
        const now = await p.locator('#editor').inputValue();
        if (now !== states[i]) {
          findings.push({ module: type, fn: 'U2 進める (契約駆動)',
            what: i + '回進めたところが記録と違う (長さ ' + now.length + ' vs ' + states[i].length + ')' });
          break;
        }
      }
    }
    await p.close();
  }

  await b.close();
  // 検査から外れた図種を黙って捨てない
  if (skippedTypes.length) {
    console.log('  (検査が成立せず未検査: ' + skippedTypes.length + ' 図種) ' + skippedTypes.slice(0, 5).join(' / '));
  }
  report('r17-undo-redo', findings, { examined: examinedTypes.size, total: 21 });
})();
