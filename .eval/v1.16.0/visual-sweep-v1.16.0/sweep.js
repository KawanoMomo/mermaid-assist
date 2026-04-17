// @ts-check
// Visual sweep for v1.16.0 — Tier3 Phase 14 Kanban Board
// Usage: node .eval/v1.16.0/visual-sweep-v1.16.0/sweep.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../../mermaid-assist.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function waitRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 15000 });
  await page.waitForTimeout(1000);
}

async function switchTo(page, type) {
  await page.locator('#diagram-type').selectOption(type);
  await page.waitForTimeout(1800);
}

async function setEditor(page, text) {
  await page.locator('#editor').fill(text);
  await page.waitForTimeout(1500);
}

async function shoot(page, name) {
  const p = path.join(OUT, name);
  await page.screenshot({ path: p, fullPage: true });
  console.log('saved', p);
}

(async () => {
  const consoleErrors = [];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!/favicon/i.test(txt)) consoleErrors.push(txt);
    }
  });

  // EV1: default Kanban template (Todo / InProgress / Done)
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'kanban');
  await page.waitForTimeout(600);
  await shoot(page, 'ev1-default-template.png');

  // EV2: many cards per column
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'kanban');
  await page.waitForTimeout(500);
  await setEditor(page, [
    'kanban',
    '    Todo',
    '        [Design spec]',
    '        [Research approach]',
    '        [Draft wireframes]',
    '        [Review requirements]',
    '        [Plan milestones]',
    '    InProgress',
    '        [Implement feature]',
    '        [Refactor parser]',
    '        [Write unit tests]',
    '        [Fix console errors]',
    '    Done',
    '        [Initial release]',
    '        [Setup CI]',
    '        [Create repo]',
    '        [Land first PR]',
  ].join('\n'));
  await shoot(page, 'ev2-many-cards.png');

  // EV3: card with meta (assigned / ticket / priority)
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'kanban');
  await page.waitForTimeout(500);
  await setEditor(page, [
    'kanban',
    '    Todo',
    '        docs[Document API]@{assigned: \'alice\', ticket: \'DOC-12\', priority: \'High\'}',
    '        ui[Polish UI]@{assigned: \'bob\', ticket: \'UI-48\', priority: \'Low\'}',
    '    InProgress',
    '        impl[Implement core]@{assigned: \'carol\', ticket: \'CORE-7\', priority: \'Very High\'}',
    '    Done',
    '        ship[Ship v1]@{assigned: \'dan\', ticket: \'REL-1\', priority: \'Normal\'}',
  ].join('\n'));
  await shoot(page, 'ev3-card-with-meta.png');

  // EV4: cross-switch (kanban -> gantt -> kanban)
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'kanban');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4a-kanban.png');
  await switchTo(page, 'gantt');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4b-gantt.png');
  await switchTo(page, 'kanban');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4c-back-to-kanban.png');

  await browser.close();

  console.log('consoleErrors:', consoleErrors.length);
  if (consoleErrors.length) console.log(consoleErrors.join('\n'));
  fs.writeFileSync(path.join(OUT, '..', 'console-errors.json'), JSON.stringify(consoleErrors, null, 2));
})().catch(err => { console.error(err); process.exit(1); });
