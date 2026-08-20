// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');

// 図種を切り替えると前の図のズームが残っていた。図種ごとに自然サイズが
// 一桁以上違うので、起動時の gantt (51% にフィット) から切り替えると
//   stateDiagram → 750px のペインに 51px のサムネイル
//   timeline     → 1190px ではみ出す
// という、読む前にズーム操作が要る状態になっていた。
const TYPES = [
  'flowchart', 'sequenceDiagram', 'classDiagram', 'erDiagram', 'stateDiagram',
  'C4Context', 'block-beta', 'architecture-beta', 'mindmap', 'timeline',
  'gitGraph', 'pie', 'journey', 'quadrantChart', 'xychart-beta',
  'sankey-beta', 'packet-beta', 'kanban', 'radar-beta', 'requirementDiagram',
];

test.describe('図種切替時のフィット', () => {
  for (const type of TYPES) {
    test(`${type} に切り替えるとペイン幅に収まる`, async ({ page }) => {
      page.on('dialog', d => d.accept());
      await page.goto(HTML_URL);
      await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
      await page.waitForTimeout(600);

      await page.locator('#diagram-type').selectOption(type);
      await page.waitForTimeout(1600);

      const m = await page.evaluate(() => {
        const svg = document.querySelector('#preview-svg svg');
        const box = document.getElementById('preview-container');
        const r = svg.getBoundingClientRect();
        return { w: r.width, h: r.height, W: box.clientWidth, H: box.clientHeight };
      });
      // 縦にも横にもはみ出さない
      expect(m.w).toBeLessThanOrEqual(m.W + 1);
      expect(m.h).toBeLessThanOrEqual(m.H + 1);
      // かつ、どちらかの軸はペインを使い切っている。
      // 縦長の図 (flowchart TD / stateDiagram) は縦が制約になるので幅は余る。
      // 幅だけを見るとその余りを「小さすぎる」と誤判定する。
      // 実測ではどの図種も片軸が 0.94〜0.96 に達する。
      expect(Math.max(m.w / m.W, m.h / m.H)).toBeGreaterThan(0.9);
    });
  }
});
