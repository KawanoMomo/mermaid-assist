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
        return { w: svg.getBoundingClientRect().width, c: box.clientWidth };
      });
      // はみ出さない
      expect(m.w).toBeLessThanOrEqual(m.c);
      // かつサムネイルのように小さすぎない。切替のたびにズーム操作が要る状態を防ぐ。
      // 拡大上限 (3.0倍) に当たる小さな図があるので下限はゆるめに取る。
      expect(m.w).toBeGreaterThan(m.c * 0.35);
    });
  }
});
