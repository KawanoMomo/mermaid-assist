// @ts-check
// Visual sweep for v1.13.0 — Tier3 Phase 11 C4 Diagram
// Usage: node .eval/v1.13.0/visual-sweep-v1.13.0/sweep.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../../mermaid-assist.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function waitRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 15000 });
  await page.waitForTimeout(800);
}

async function switchTo(page, type) {
  await page.locator('#diagram-type').selectOption(type);
  await page.waitForTimeout(1500);
}

async function setEditor(page, text) {
  await page.locator('#editor').fill(text);
  await page.waitForTimeout(1200);
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

  // EV1: default C4Context template
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'C4Context');
  await page.waitForTimeout(600);
  await shoot(page, 'ev1-default-c4context.png');

  // EV2: C4Container variant with tech field
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'C4Context');
  await page.waitForTimeout(500);
  await setEditor(page, [
    'C4Container',
    '    title Banking Containers',
    '    Person(user, "Customer", "Bank customer")',
    '    Container(web, "Web App", "Angular", "UI")',
    '    Container(api, "API", "Spring Boot", "REST API")',
    '    ContainerDb(db, "Database", "PostgreSQL", "Stores data")',
    '    Rel(user, web, "Uses", "HTTPS")',
    '    Rel(web, api, "Calls", "JSON/HTTPS")',
    '    Rel(api, db, "Reads/Writes", "JDBC")',
  ].join('\n'));
  await shoot(page, 'ev2-c4container-tech.png');

  // EV3: multiple Rels with tech labels
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'C4Context');
  await page.waitForTimeout(500);
  await setEditor(page, [
    'C4Context',
    '    title Multi-Rel Tech',
    '    Person(u, "User", "End user")',
    '    System(auth, "Auth", "OAuth server")',
    '    System(api, "API", "Backend API")',
    '    System_Ext(mail, "Mail", "SMTP server")',
    '    Rel(u, auth, "Logs in", "HTTPS")',
    '    Rel(auth, api, "Issues token", "JWT")',
    '    Rel(api, mail, "Sends", "SMTP")',
    '    Rel(u, api, "Reads data", "HTTPS/JSON")',
    '    BiRel(api, auth, "Validates", "HTTP")',
  ].join('\n'));
  await shoot(page, 'ev3-multi-rel-tech.png');

  // EV4: cross-switch (C4 -> gantt -> C4)
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'C4Context');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4a-c4.png');
  await switchTo(page, 'gantt');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4b-gantt.png');
  await switchTo(page, 'C4Context');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4c-back-to-c4.png');

  await browser.close();

  console.log('consoleErrors:', consoleErrors.length);
  if (consoleErrors.length) console.log(consoleErrors.join('\n'));
  fs.writeFileSync(path.join(OUT, '..', 'console-errors.json'), JSON.stringify(consoleErrors, null, 2));
})().catch(err => { console.error(err); process.exit(1); });
