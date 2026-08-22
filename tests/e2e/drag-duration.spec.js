// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').split(path.sep).join('/');

// mermaid gantt で最も普通の書き方:
//
//     設計 :t1, 2026-03-01, 10d
//     実装 :t2, after t1, 10d
//
// 較正が「終了日が YYYY-MM-DD であること」を条件にしていたので、この図では
// pxPerDay が 0 のままだった。**バーもリサイズハンドルも描かれるのに、
// 掴んでも一切動かない。** 理由の表示も無く、壊れているようにしか見えない。
async function load(page, text) {
  page.on('dialog', d => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(700);
  await page.evaluate((x) => {
    const ed = document.getElementById('editor');
    ed.value = x;
    ed.dispatchEvent(new Event('input'));
  }, text);
  await page.waitForTimeout(2200);
}
async function dragBar(page, id, dx) {
  const bar = page.locator('#overlay-layer .overlay-bar[data-task-id="' + id + '"]');
  const box = await bar.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1100);
}
const lineOf = (t, id) => (t.split('\n').find(l => l.includes(':' + id + ',')) || '').trim();

const DUR = 'gantt\n    dateFormat YYYY-MM-DD\n    section S\n' +
  '    設計 :t1, 2026-03-01, 10d\n    実装 :t2, after t1, 10d\n';

test.describe('duration 記法のガントでドラッグできる', () => {
  test('pxPerDay が 0 のままにならない', async ({ page }) => {
    await load(page, DUR);
    const px = await page.evaluate(() => window.MA.modules.gantt.getCalibration().pxPerDay);
    expect(px).toBeGreaterThan(0);
  });

  test('バーをドラッグすると日付が動く', async ({ page }) => {
    await load(page, DUR);
    const before = await page.locator('#editor').inputValue();
    await dragBar(page, 't1', 70);
    const after = await page.locator('#editor').inputValue();
    expect(after).not.toBe(before);
    expect(lineOf(after, 't1')).not.toBe(lineOf(before, 't1'));
    // 期間 (10d) は維持される
    expect(lineOf(after, 't1')).toContain('10d');
    expect(await page.locator('#status-parse').textContent()).toBe('OK');
  });

  test('after 依存タスクは 1970 年に飛ばない', async ({ page }) => {
    await load(page, DUR);
    const before = await page.locator('#editor').inputValue();
    await dragBar(page, 't2', 70);
    const after = await page.locator('#editor').inputValue();
    // addDays(null, n) が epoch から数えて 1970-01-04 を作っていた
    expect(after).not.toContain('1970');
    // 依存も壊れない
    expect(after).toContain('after t1');
    expect(lineOf(after, 't2')).toBe(lineOf(before, 't2'));
  });

  test('動かせない理由がステータスバーに出る', async ({ page }) => {
    await load(page, DUR);
    await dragBar(page, 't2', 70);
    const s = await page.locator('#status-info').textContent();
    // 無反応のままだと壊れているようにしか見えない
    expect(s).toContain('after t1');
  });
});

// A116: マイルストーンを起点にする書き方で較正が 0 のままだった。
//
//     節目 :milestone, m1, 2026-03-01, 0d
//     実装 :t2, after m1, 10d
//
// m1 は開始日を持つが期間が 0d (割ると壊れる)。t2 は期間を持つが開始日が無い。
// どちらも単独では失格で、2点較正にも足りず pxPerDay=0 のままだった。
// **倍率は幅と期間から、原点は開始日を持つバーから**、別々の相手に取ればよい。
// マイルストーンは菱形で描かれ矩形として照合できない (barRects[0] が null) ので、
// 原点には `after` を解決した開始日 (resolveSpan) を使う。
//
// 実測 (直す前 / 後): pxPerDay 0 → 54.4
const MILESTONE = ['gantt', '    dateFormat YYYY-MM-DD', '    section S',
  '    節目 :milestone, m1, 2026-03-01, 0d',
  '    実装 :t2, after m1, 10d', ''].join(String.fromCharCode(10));

test.describe('マイルストーンを起点にしたガント', () => {
  test('pxPerDay が 0 のままにならない', async ({ page }) => {
    await load(page, MILESTONE);
    const px = await page.evaluate(() => window.MA.modules.gantt.getCalibration().pxPerDay);
    expect(px).toBeGreaterThan(0);
  });

  test('動かせないバーは理由を出す', async ({ page }) => {
    await load(page, MILESTONE);
    // 掴めるバーは `after m1` の t2 だけ。動かないこと自体は仕様だが、
    // **黙って動かない**のは壊れているようにしか見えない。
    await dragBar(page, 't2', 70);
    const s = await page.locator('#status-info').textContent();
    expect(s).toContain('after m1');
  });
});
