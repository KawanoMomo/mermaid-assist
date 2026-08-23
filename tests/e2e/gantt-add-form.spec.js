'use strict';
// 追加フォームが「黙って死ぬ」2件。どちらも parse は OK のままなので、
// ステータスバーにも帯にも何も出ない。
//
//  1. 種別トグルの再描画が効いていなかった。`renderProps()` を引数なしで呼んで
//     おり、第3引数 propsEl が undefined になって先頭の早期 return で抜けていた。
//     マイルストーンを1本足したあと「タスク」を押しても種別が戻らず、終了日の欄も
//     出てこない。
//  2. 日程の自動送りが、期間指定 (`10d`) と マイルストーンの `0d` を解決できず
//     null を返していた。マイルストーンを1本足すと以後の追加が全部
//     「開始日を入れてください」で弾かれ、日付を手打ちするまで復帰しない。
//
// どちらも DOM とアプリの再描画が絡むので E2E でしか固定できない。
const path = require('path');
const { test, expect } = require('@playwright/test');

const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);
const DOC = ['gantt', '    title 開発計画', '    dateFormat YYYY-MM-DD',
  '    section 設計', '    要件定義 :a1, 2026-04-01, 10d', ''].join(NL);

async function setup(page) {
  page.on('dialog', (d) => d.dismiss());
  await page.goto(HTML_URL);
  await page.waitForFunction(() => window.MA && window.MA.modules && window.MA.modules.gantt);
  await page.selectOption('#diagram-type', 'gantt');
  await page.waitForTimeout(500);
  await page.fill('#editor', DOC);
  await page.waitForTimeout(1400);
}

const probe = () => ({
  start: (document.getElementById('prop-add-start') || {}).value,
  end: (document.getElementById('prop-add-end') || {}).value,
  hasEndField: !!document.getElementById('prop-add-end'),
  taskActive: (document.getElementById('prop-add-kind-task') || { style: {} }).style.background === 'var(--accent)',
});

test.describe('gantt: 追加フォーム', () => {
  test('期間指定のタスクの後でも日程が自動で送られる', async ({ page }) => {
    await setup(page);
    const s = await page.evaluate(probe);
    // 直前は `要件定義 :a1, 2026-04-01, 10d`。修正前はここが両方とも空だった。
    expect(s.start).toBe('2026-04-11');
    expect(s.end).toBe('2026-04-21');
  });

  test('日付欄に年の範囲がある', async ({ page }) => {
    await setup(page);
    const m = await page.evaluate(() => {
      const el = document.getElementById('prop-add-start');
      return { min: el.min, max: el.max };
    });
    expect(m.min).toBe('1970-01-01');
    expect(m.max).toBe('2999-12-31');
  });

  test('マイルストーンを足した後に「タスク」へ戻れて、日程も送られる', async ({ page }) => {
    await setup(page);
    await page.click('#prop-add-kind-milestone');
    await page.waitForTimeout(500);
    // マイルストーンでは終了日の欄が消え、「日付」だけになる
    const ms = await page.evaluate(probe);
    expect(ms.hasEndField).toBe(false);

    await page.fill('#prop-add-label', 'DR1');
    await page.fill('#prop-add-start', '2026-04-20');
    await page.click('#prop-add-btn');
    await page.waitForTimeout(1200);

    await page.click('#prop-add-kind-task');
    await page.waitForTimeout(1000);
    const back = await page.evaluate(probe);
    // 修正前: taskActive=false / hasEndField=false / start='' で、以後の追加が
    // 全部「開始日を入れてください」で弾かれていた。
    expect(back.taskActive).toBe(true);
    expect(back.hasEndField).toBe(true);
    expect(back.start).toBe('2026-04-20');       // マイルストーンの日付から送る
    expect(back.end).toBe('2026-04-30');         // 期間は直前の通常タスクの10日を継ぐ

    const parse = await page.evaluate(() => document.getElementById('status-parse').textContent);
    expect(parse).toBe('OK');
  });
});
