// @ts-check
// Visual sweep for v1.17.0 - Tier3 Phase 15 Radar Chart
// Usage: node .eval/v1.17.0/visual-sweep-v1.17.0/sweep.js
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

  // EV1: default Radar template (Alice / Bob)
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'radar-beta');
  await page.waitForTimeout(600);
  await shoot(page, 'ev1-default-template.png');

  // EV2: single curve
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'radar-beta');
  await page.waitForTimeout(500);
  await setEditor(page, [
    'radar-beta',
    '    title "Single Curve"',
    '    axis c["Comm"], s["Strat"], l["Lead"], v["Vision"], t["Tech"]',
    '    curve solo["Solo"]{80, 65, 90, 75, 85}',
    '    max 100',
    '    min 0',
  ].join('\n'));
  await shoot(page, 'ev2-single-curve.png');

  // EV3: 5+ curves overlap
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'radar-beta');
  await page.waitForTimeout(500);
  await setEditor(page, [
    'radar-beta',
    '    title "Team Overlap"',
    '    axis c["Comm"], s["Strat"], l["Lead"], v["Vision"], t["Tech"], x["Execution"]',
    '    curve a["Alice"]{85, 90, 75, 95, 80, 70}',
    '    curve b["Bob"]{70, 80, 85, 75, 90, 95}',
    '    curve c["Carol"]{60, 70, 95, 85, 75, 80}',
    '    curve d["Dan"]{90, 85, 70, 80, 95, 75}',
    '    curve e["Erin"]{75, 95, 80, 70, 85, 90}',
    '    curve f["Frank"]{95, 75, 90, 85, 70, 80}',
    '    max 100',
    '    min 0',
  ].join('\n'));
  await shoot(page, 'ev3-many-curves.png');

  // EV4: cross-switch (radar -> gantt -> radar)
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'radar-beta');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4a-radar.png');
  await switchTo(page, 'gantt');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4b-gantt.png');
  await switchTo(page, 'radar-beta');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4c-back-to-radar.png');

  await browser.close();

  console.log('consoleErrors:', consoleErrors.length);
  if (consoleErrors.length) console.log(consoleErrors.join('\n'));
  fs.writeFileSync(path.join(OUT, '..', 'console-errors.json'), JSON.stringify(consoleErrors, null, 2));
})().catch(err => { console.error(err); process.exit(1); });
