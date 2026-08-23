"use strict";
// UI-073: キーボードで図を動かせなかった / UI-074: 選んだ要素が画面外だと見えなかった。
//
// 実測 (直す前, 40要素のフローチャート):
//   UI-073 Escape で図へ移った後、PageDown / ArrowDown / End / Space が
//     **どれも効かず** scrollTop が 0 のままだった。焦点は #preview-pane (外枠) に
//     当たっていたが、**スクロールするのは #preview-container (内側)**。
//     キーボードだけで作業する人は、図の下の方を見るのにマウスへ持ち替えるしかない。
//     A117 で通したキーボード経路がここで切れていた。
//   UI-074 一覧で「工程38」を選ぶと図は光る (overlay の stroke が #7ee787 になる)
//     が、その要素は枠の上端から 3974px、枠の高さは 681px、scrollTop は 0 のまま。
//     **光っても見えない。** そこからホイールで探すことになる。
//
// **描画のたびに動かしてはいけない**点も押さえる。オーバレイは打鍵のたびに
// 作り直されるので、毎回動かすと手で合わせたスクロール位置を奪う。
const path = require("path");
const { test, expect } = require("@playwright/test");
const HTML_URL = "file:///" + path.resolve(__dirname, "..", "..", "mermaid-assist.html").split(path.sep).join("/");
const NL = String.fromCharCode(10);
const Q = String.fromCharCode(34);

function tall(n) {
  const l = ["flowchart TD"];
  for (let i = 0; i < n; i++) l.push("    M" + i + "[" + Q + "工程" + i + Q + "]");
  for (let i = 1; i < n; i++) l.push("    M" + (i - 1) + " --> M" + i);
  return l.join(NL);
}

async function load(page) {
  page.on("dialog", (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector("#preview-svg svg", { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate((x) => {
    const e = document.getElementById("editor");
    e.value = x; e.dispatchEvent(new Event("input", { bubbles: true }));
  }, tall(40));
  await page.waitForTimeout(3400);
}

const scrollTop = (page) => page.evaluate(
  () => Math.round(document.getElementById("preview-container").scrollTop));

// 一覧の行の「編集」を押す。行の先頭がその名前で始まるものだけを選ぶ
// (「工程2」で「工程20」を掴まないため)。
const pick = (page, name) => page.evaluate((t) => {
  const rows = Array.from(document.querySelectorAll("#props-content .ma-list-row"));
  const r = rows.filter((x) => x.innerText.split(String.fromCharCode(10))[0].indexOf(t) === 0)[0];
  if (!r) return false;
  r.querySelector("button").click();
  return true;
}, name);

// 選択の印 (stroke が付いた overlay) が枠の中に見えているか
const markVisible = (page) => page.evaluate(() => {
  const o = document.getElementById("overlay-layer");
  const m = Array.from(o.children).filter((c) => c.getAttribute("stroke") === "#7ee787")[0];
  if (!m) return null;
  const c = document.getElementById("preview-container");
  const mb = m.getBoundingClientRect(), cb = c.getBoundingClientRect();
  return mb.top < cb.bottom && mb.bottom > cb.top;
});

test.describe("大きい図の中を移動する", () => {
  test("Escape の後キーボードで図を動かせる", async ({ page }) => {
    await load(page);
    await page.locator("#editor").click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    // 焦点は**スクロールする要素**に当たっていること
    expect(await page.evaluate(() => (document.activeElement || {}).id)).toBe("preview-container");
    for (const key of ["PageDown", "End"]) {
      await page.evaluate(() => { document.getElementById("preview-container").scrollTop = 0; });
      await page.keyboard.press(key);
      await page.waitForTimeout(450);
      expect(await scrollTop(page), key + " で図が動かない").toBeGreaterThan(0);
    }
  });

  test("選んだ要素が画面の外なら、そこまで図が動く", async ({ page }) => {
    await load(page);
    expect(await pick(page, "工程38")).toBe(true);
    await page.waitForTimeout(1500);
    expect(await markVisible(page), "選んだ要素が画面の外のまま").toBe(true);
    expect(await scrollTop(page)).toBeGreaterThan(0);
  });

  test("もう見えている要素を選んでも図は動かない", async ({ page }) => {
    // 「常に中央へ寄せる」実装だと、見えているものを選ぶたびに図が跳ねる。
    //
    // **図の一番上の要素で測ってはいけない。** 中央寄せの計算が負になり
    // 0 にクランプされるので、動かす実装でも scrollTop が 0 のままになり、
    // 差が消える (この誤りで変異が素通りした)。
    // 図の途中まで送ってから、そこで見えている要素を選ぶ。
    await load(page);
    await page.evaluate(() => { document.getElementById("preview-container").scrollTop = 1800; });
    await page.waitForTimeout(300);
    // その位置で見えている要素を実際に探す (推測で名前を決めない)
    const visibleName = await page.evaluate(() => {
      const o = document.getElementById("overlay-layer");
      const c = document.getElementById("preview-container");
      const cb = c.getBoundingClientRect();
      const hit = Array.from(o.children).filter((x) => {
        const b = x.getBoundingClientRect();
        // 枠の中に完全に入っていて、かつ中央からずれているもの
        return b.top > cb.top + 20 && b.bottom < cb.bottom - 20;
      })[0];
      return hit ? hit.getAttribute("data-element-id") : null;
    });
    expect(visibleName, "枠の中に収まる要素が見つからない").not.toBeNull();
    const before = await scrollTop(page);
    await page.evaluate((id) => {
      const rows = Array.from(document.querySelectorAll("#props-content .ma-list-row"));
      const r = rows.filter((x) => x.innerText.indexOf("(" + id + ",") >= 0)[0];
      if (r) r.querySelector("button").click();
    }, visibleName);
    await page.waitForTimeout(1500);
    expect(await markVisible(page)).toBe(true);
    expect(Math.abs((await scrollTop(page)) - before), "見えている要素で図が跳ねた").toBeLessThan(20);
  });

  test("手で合わせた位置を打鍵で奪わない", async ({ page }) => {
    // オーバレイは打鍵のたびに作り直される。毎回動かすと位置を奪う。
    //
    // **選んだ要素が見えている位置で測ってはいけない。** 「もう見えている」の
    // 早期リターンに隠れて、毎描画で動かす実装でも通ってしまう
    // (この誤りで変異が素通りした)。**選択を画面の外へ追い出してから**打鍵する。
    await load(page);
    expect(await pick(page, "工程38")).toBe(true);
    await page.waitForTimeout(1500);
    const jumped = await scrollTop(page);
    expect(jumped, "選択で図が動いていない (前提が崩れている)").toBeGreaterThan(1000);
    // 選んだ要素を画面の外へ追い出す
    await page.evaluate(() => { document.getElementById("preview-container").scrollTop = 0; });
    await page.waitForTimeout(300);
    expect(await markVisible(page), "追い出せていない").toBe(false);
    await page.evaluate((q) => {
      const e = document.getElementById("editor");
      e.value = e.value + String.fromCharCode(10) + "    M39 --> M40[" + q + "追記" + q + "]";
      e.dispatchEvent(new Event("input", { bubbles: true }));
    }, Q);
    await page.waitForTimeout(3200);
    // 打鍵しただけで選択位置へ引き戻されないこと
    expect(await scrollTop(page), "打鍵で選択位置へ引き戻された").toBeLessThan(60);
  });
});
