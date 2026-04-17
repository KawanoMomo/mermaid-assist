// @ts-check
// Visual sweep for v1.14.0 — Tier3 Phase 12 Packet Diagram
// Usage: node .eval/v1.14.0/visual-sweep-v1.14.0/sweep.js
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

  // EV1: default TCP header template
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'packet-beta');
  await page.waitForTimeout(600);
  await shoot(page, 'ev1-default-tcp-header.png');

  // EV2: Simple single-bit fields demo
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'packet-beta');
  await page.waitForTimeout(500);
  await setEditor(page, [
    'packet-beta',
    'title "Flag Byte"',
    '0: "F0"',
    '1: "F1"',
    '2: "F2"',
    '3: "F3"',
    '4: "F4"',
    '5: "F5"',
    '6: "F6"',
    '7: "F7"',
  ].join('\n'));
  await shoot(page, 'ev2-single-bit-fields.png');

  // EV3: Large range + mixed (IPv4 header style)
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'packet-beta');
  await page.waitForTimeout(500);
  await setEditor(page, [
    'packet-beta',
    'title "IPv4 Header"',
    '0-3: "Version"',
    '4-7: "IHL"',
    '8-15: "Type of Service"',
    '16-31: "Total Length"',
    '32-47: "Identification"',
    '48-50: "Flags"',
    '51-63: "Fragment Offset"',
    '64-71: "TTL"',
    '72-79: "Protocol"',
    '80-95: "Header Checksum"',
    '96-127: "Source IP Address"',
    '128-159: "Destination IP Address"',
  ].join('\n'));
  await shoot(page, 'ev3-large-range-mixed.png');

  // EV4: cross-switch (packet -> gantt -> packet)
  await page.goto(HTML_URL);
  await waitRender(page);
  await switchTo(page, 'packet-beta');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4a-packet.png');
  await switchTo(page, 'gantt');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4b-gantt.png');
  await switchTo(page, 'packet-beta');
  await page.waitForTimeout(600);
  await shoot(page, 'ev4c-back-to-packet.png');

  await browser.close();

  console.log('consoleErrors:', consoleErrors.length);
  if (consoleErrors.length) console.log(consoleErrors.join('\n'));
  fs.writeFileSync(path.join(OUT, '..', 'console-errors.json'), JSON.stringify(consoleErrors, null, 2));
})().catch(err => { console.error(err); process.exit(1); });
