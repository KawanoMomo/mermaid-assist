'use strict';
// R4 UI 一貫性: 図種をまたいで同じ操作が同じ結果になるか。
//
// 実機で全図種を回し、次を見る:
//   - 一覧の ✕ を押したら押した要素だけが消えるか (UI 経路)
//   - 削除後に status が Error にならないか
//   - 選択が消えた要素に残らないか
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
const TYPES = ['gantt', 'sequenceDiagram', 'flowchart', 'stateDiagram', 'classDiagram',
  'erDiagram', 'requirementDiagram', 'block-beta', 'timeline', 'mindmap', 'gitGraph',
  'pie', 'journey', 'quadrantChart', 'xychart-beta', 'sankey-beta', 'C4Context',
  'packet-beta', 'architecture-beta', 'kanban', 'radar-beta'];

(async () => {
  const findings = [];
  const b = await chromium.launch();
  for (const t of TYPES) {
    const p = await b.newPage({ viewport: { width: VIEWPORT.width, height: VIEWPORT.height } });
    p.on('dialog', d => d.accept());
    const errs = [];
    p.on('pageerror', e => errs.push(String(e).slice(0, 80)));
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 15000 });
    await p.waitForTimeout(600);
    if (t !== 'gantt') { await p.locator('#diagram-type').selectOption(t); await p.waitForTimeout(1600); }
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);

    const before = await p.locator('#editor').inputValue();
    // 一覧の最初の ✕ を押す
    const del = p.locator('#props-content button[class*="delete"]').first();
    const n = await del.count();
    if (n === 0) { await p.close(); continue; }
    const targetId = await del.getAttribute('data-element-id');
    await del.click();
    await p.waitForTimeout(1300);
    const after = await p.locator('#editor').inputValue();
    const status = await p.locator('#status-parse').textContent();

    if (after === before) {
      findings.push({ module: t, fn: '一覧の✕', what: '押しても何も変わらない' + (targetId ? ' (' + targetId + ')' : '') });
    }
    if (status !== 'OK' && after !== before) {
      findings.push({ module: t, fn: '一覧の✕', what: '削除後に status=' + status });
    }
    if (targetId && after.indexOf(targetId) !== -1 && before.indexOf(targetId) !== -1) {
      // id がそのままテキストに残っている = 消えていない可能性
      const beforeCount = (before.split(targetId).length - 1);
      const afterCount = (after.split(targetId).length - 1);
      if (afterCount >= beforeCount) {
        findings.push({ module: t, fn: '一覧の✕',
          what: '押した id が減っていない (' + targetId + ': ' + beforeCount + ' -> ' + afterCount + ')' });
      }
    }
    const sel = await p.evaluate(() => window.MA.selection.getSelected());
    if (sel.length && targetId && sel.some(s => String(s.id) === String(targetId))) {
      findings.push({ module: t, fn: '選択', what: '消した要素が選択に残る (' + targetId + ')' });
    }
    if (errs.length) {
      findings.push({ module: t, fn: 'pageerror', what: errs[0] });
    }
    await p.close();
  }
  await b.close();
  report('r4-ui', findings, { examined: TYPES.length, total: 21 });
})();
