// @ts-check
// Visual sweep for v1.15.0 — Tier3 Phase 13 Architecture Diagram
// Usage: node .eval/v1.15.0/visual-sweep-v1.15.0/sweep.js
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

  // EV1: default Architecture template
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'architecture-beta');
  await page.waitForTimeout(600);
  await shoot(page, 'ev1-default-template.png');

  // EV2: multi-group nested (two groups with services under each)
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'architecture-beta');
  await page.waitForTimeout(500);
  await setEditor(page, [
    'architecture-beta',
    '    group public_api(cloud)[Public API]',
    '    group private_api(cloud)[Private API]',
    '    service gateway(internet)[Gateway] in public_api',
    '    service auth(server)[Auth] in public_api',
    '    service db(database)[Database] in private_api',
    '    service cache(disk)[Cache] in private_api',
    '    gateway:R -- L:auth',
    '    auth:R -- L:db',
    '    db:T -- B:cache',
  ].join('\n'));
  await shoot(page, 'ev2-multi-group-nested.png');

  // EV3: multiple icons (one of each icon type)
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'architecture-beta');
  await page.waitForTimeout(500);
  await setEditor(page, [
    'architecture-beta',
    '    group sys(cloud)[System]',
    '    service c1(cloud)[Cloud] in sys',
    '    service d1(database)[Database] in sys',
    '    service k1(disk)[Disk] in sys',
    '    service s1(server)[Server] in sys',
    '    service i1(internet)[Internet] in sys',
    '    c1:R -- L:d1',
    '    d1:R -- L:k1',
    '    k1:R -- L:s1',
    '    s1:R -- L:i1',
  ].join('\n'));
  await shoot(page, 'ev3-multiple-icons.png');

  // EV4: cross-switch (architecture -> gantt -> architecture)
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'architecture-beta');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4a-architecture.png');
  await switchTo(page, 'gantt');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4b-gantt.png');
  await switchTo(page, 'architecture-beta');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4c-back-to-architecture.png');

  await browser.close();

  console.log('consoleErrors:', consoleErrors.length);
  if (consoleErrors.length) console.log(consoleErrors.join('\n'));
  fs.writeFileSync(path.join(OUT, '..', 'console-errors.json'), JSON.stringify(consoleErrors, null, 2));
})().catch(err => { console.error(err); process.exit(1); });
