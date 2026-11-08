'use strict';
// 台本 primary(設計者)場面 3・手順 5:
//   レビュー指摘 10 件(ID 改名 3・ラベル直し 5・エッジ文言 2)を直した後の Fit と部分拡大で、
//   直した箇所が読めるかを見る。
// 再現: CRLF の flowchart を開く → 10 件を GUI で直す(_primary-review.js)→ ツールバーの Fit →
//   「＋」で拡大 → プレビューをホイールでスクロールして直した箇所を見る。
// 期待: Fit = 倍率は 100% を超えず、図全体がプレビューに入り、直した字が全部図にあり、
//         直した要素はどれも拡大せずに押せる位置にある(principles.md「Fit は図全体を画面に入れる」)。
//       部分拡大 = Fit より大きい倍率で、直した箇所(末尾の「完了」と分岐の「不可」)が
//         プレビューの見えている範囲にあり、字の高さが 14px 以上で読める。
//       G1 / G2 は 10 件それぞれで確かめる(_primary-review.js)。
//       操作コストは principles.md の上限(1366x768、要素 30 以下の図で操作から描画まで 300ms)。
const { test, expect } = require('@playwright/test');
const H = require('./_helpers');
const R = require('./_primary-review');

const RENDER_LIMIT_MS = 300;
const READABLE_PX = 14;

test.use({ viewport: { width: 1366, height: 768 } });

// プレビューの見えている範囲と、図の中で字が text と一致する葉要素の矩形
async function layout(page, texts) {
  return page.evaluate((texts) => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
    const pane = document.getElementById('preview-container');
    const pb = pane.getBoundingClientRect();
    const view = { x: pb.left, y: pb.top, w: pane.clientWidth, h: pane.clientHeight };
    const svg = document.querySelector('#preview-svg svg');
    const leaves = [...svg.querySelectorAll('*')].filter((e) => e.children.length === 0);
    const found = {};
    for (const t of texts) {
      const el = leaves.find((e) => (e.textContent || '').trim() === t);
      found[t] = el ? r(el) : null;
    }
    return { view, svg: r(svg), found, zoom: document.getElementById('zoom-display').textContent.trim() };
  }, texts);
}

function inside(box, view, slack) {
  const s = slack || 1;
  return box.x >= view.x - s && box.y >= view.y - s
    && box.x + box.w <= view.x + view.w + s && box.y + box.h <= view.y + view.h + s;
}

test('primary-5: 10 件を直した後、Fit で図全体が入り、部分拡大で直した箇所が読める', async ({ page, browser }, testInfo) => {
  await R.openReviewFixture(page, testInfo);
  const steps = await R.applyReviewFixes(page, browser);
  await page.keyboard.press('Escape');
  const fixed = await H.editorText(page);
  let clicks = 0;

  // Fit: 100% を超えず、図全体がプレビューに入る
  await page.locator('#btn-zoom-fit').click();
  clicks++;
  await page.waitForTimeout(200);
  const fit = await layout(page, R.EDITED_TEXTS);
  const fitZoom = parseInt(fit.zoom, 10);
  expect(fitZoom, 'Fit の倍率: ' + fit.zoom).toBeLessThanOrEqual(100);
  expect(inside(fit.svg, fit.view, 2), 'Fit で図全体がプレビューに入る ' + JSON.stringify(fit)).toBe(true);
  for (const t of R.EDITED_TEXTS) {
    expect(fit.found[t], '直した字「' + t + '」が図にある').not.toBeNull();
  }
  // 直した要素はどれも、拡大せずにそのまま押せる(見えている範囲にあり、上に別の物が被さっていない)
  for (const id of R.EDITED_IDS) {
    const hit = await page.evaluate((id) => {
      const el = document.querySelector('#overlay-layer [data-element-id="' + id + '"]');
      if (!el) return 'no overlay';
      const b = el.getBoundingClientRect();
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return top && top.getAttribute('data-element-id');
    }, id);
    expect(hit, id + ' を Fit のまま押せる').toBe(id);
  }
  await page.screenshot({ path: testInfo.outputPath('primary-5-fit.png') });

  // 部分拡大: 「＋」を 150% 以上になるまで押す
  for (let i = 0; i < 20; i++) {
    const z = parseInt(await page.locator('#zoom-display').textContent(), 10);
    if (z >= 150) break;
    await page.locator('#btn-zoom-in').click();
    clicks++;
  }
  // ホイールで直した箇所(図の下の方の「完了」)が見えるまでスクロールする
  const pane = page.locator('#preview-container');
  const pb = await pane.boundingBox();
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  for (const target of ['完了', '不可']) {
    for (let i = 0; i < 30; i++) {
      const l = await layout(page, [target]);
      const b = l.found[target];
      if (b && inside(b, l.view, 0)) break;
      const dy = b.y + b.h / 2 - (l.view.y + l.view.h / 2);
      const dx = b.x + b.w / 2 - (l.view.x + l.view.w / 2);
      await page.mouse.wheel(Math.abs(dx) > 40 ? Math.sign(dx) * 200 : 0, Math.abs(dy) > 40 ? Math.sign(dy) * 200 : 0);
      clicks++;
      await page.waitForTimeout(80);
    }
    const l = await layout(page, [target]);
    expect(parseInt(l.zoom, 10), '部分拡大の倍率').toBeGreaterThan(fitZoom);
    expect(inside(l.found[target], l.view, 0), '「' + target + '」が見えている ' + JSON.stringify(l)).toBe(true);
    expect(l.found[target].h, '「' + target + '」の字の高さ').toBeGreaterThanOrEqual(READABLE_PX);
    await page.screenshot({ path: testInfo.outputPath('primary-5-zoom-' + R.EDITED_TEXTS.indexOf(target) + '.png') });
  }
  // Fit・拡大・スクロールは本文を変えない
  expect(await H.editorText(page), 'Fit・拡大・スクロールで本文が動かない').toBe(fixed);
  await expect(page.locator('#status-parse')).toHaveText(/OK/);

  // 操作コスト(principles.md): 要素 30 以下の図で操作から描画まで 300ms 以内
  for (const s of steps) {
    expect(s.ms, s.name + ': 描画までの待ち').toBeLessThanOrEqual(RENDER_LIMIT_MS);
  }
  H.record(testInfo, 'renderMs', Math.max.apply(null, steps.map((s) => s.ms || 0)));
  H.record(testInfo, 'diffLines', Math.max.apply(null, steps.map((s) => s.lines)));
  H.record(testInfo, 'viewClicks', clicks);
});
