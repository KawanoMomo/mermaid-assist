"use strict";
// UI-078: 接続の拒否がすべて黙って起き、しかもモードが解除されていた。
//
// **実測が最初の方針を覆した。** 当初「flowchart では自己ループが不正なので
// 図種で分ける」と説明したが、測ると **8図種すべてで mermaid が自己ループを
// 描ける** (flowchart の `A --> A` / stateDiagram の自己遷移 /
// sequenceDiagram の自己呼び出し / erDiagram の自己関連 …)。
// **テキストで書けるものを GUI が黙って拒むのは、この製品が避けてきた
// 「経路によって能力が違う」型そのもの。** 2026-08-23 に「全図種で許す」と決定。
//
// 構造の問題も直した: notifyTarget が**コールバックより先に**
// cancelConnectionMode() していたので、コールバックが相手を拒んでも
// モードだけは消えた。押した人から見ると「何も起きず、接続モードも消えた」
// 状態で、やり直しに3クリック要った。
const path = require("path");
const { test, expect } = require("@playwright/test");
const HTML_URL = "file:///" + path.resolve(__dirname, "..", "..", "mermaid-assist.html").split(path.sep).join("/");
const NL = String.fromCharCode(10);

async function load(page, type) {
  page.on("dialog", (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector("#preview-svg svg", { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.selectOption("#diagram-type", type);
  await page.waitForTimeout(2400);
}

// 一覧の先頭を選び、接続モードに入る
async function startConnect(page) {
  const picked = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("#props-content .ma-list-row"));
    if (!rows.length) return false;
    rows[0].querySelector("button").click();
    return true;
  });
  if (!picked) return false;
  await page.waitForTimeout(800);
  const id = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("#props-content button"))
      .filter((x) => /線を引く/.test(x.textContent || ""))[0];
    return b ? b.id : null;
  });
  if (!id) return false;
  await page.click("#" + id);
  await page.waitForTimeout(800);
  return true;
}

// 接続元 (橙の印) の中心をクリックする = 自分自身を相手に選ぶ
async function clickSource(page) {
  const at = await page.evaluate(() => {
    const m = Array.from(document.getElementById("overlay-layer").children)
      .filter((c) => c.getAttribute("stroke") === "#f0883e")[0];
    if (!m) return null;
    const b = m.getBoundingClientRect();
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  });
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(1600);
  return true;
}

const body = (page) => page.evaluate(() => document.getElementById("editor").value);
const inMode = (page) => page.evaluate(() => window.MA.connectionMode.isInConnectionMode());
const info = (page) => page.evaluate(
  () => ((document.getElementById("status-info") || {}).textContent || "").trim());

test.describe("自分自身への線と、拒否したときの扱い", () => {
  for (const type of ["flowchart", "stateDiagram"]) {
    test(type + ": 自分自身へ線を引ける", async ({ page }) => {
      await load(page, type);
      const before = await body(page);
      expect(await startConnect(page), "接続ボタンが無い (前提が崩れている)").toBe(true);
      expect(await clickSource(page), "接続元の印が無い (前提が崩れている)").toBe(true);
      const after = await body(page);
      expect(after.length, "自分自身への線ができていない").toBeGreaterThan(before.length);
      // 描けること (本文が増えただけで壊れていたら意味が無い)
      expect(await page.evaluate(
        () => ((document.getElementById("status-parse") || {}).textContent || "").trim())).toBe("OK");
    });
  }

  test("自分自身への線も Ctrl+Z で1回で戻る", async ({ page }) => {
    await load(page, "flowchart");
    const before = await body(page);
    await startConnect(page);
    await clickSource(page);
    expect((await body(page)).length).toBeGreaterThan(before.length);
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(1500);
    expect(await body(page)).toBe(before);
  });

  test("受理したら接続モードは終わる", async ({ page }) => {
    // 終わらないと、次のクリックで意図しない線がもう1本できる
    await load(page, "flowchart");
    await startConnect(page);
    await clickSource(page);
    expect(await inMode(page)).toBe(false);
  });

  test("始点が消えていたら理由を告げ、接続モードを続ける", async ({ page }) => {
    // 以前は黙って終了し、やり直しに3クリック要った
    await load(page, "flowchart");
    await page.evaluate(() => {
      const e = document.getElementById("editor");
      e.value = ["flowchart TD", "    A[始点] --> B[中]", "    C[相手]"].join(String.fromCharCode(10));
      e.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(2600);
    // A を起点に接続モードへ
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("#props-content .ma-list-row"));
      const r = rows.filter((x) => /始点/.test(x.innerText))[0];
      if (r) r.querySelector("button").click();
    });
    await page.waitForTimeout(800);
    const cid = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("#props-content button"))
        .filter((x) => /線を引く/.test(x.textContent || ""))[0];
      return b ? b.id : null;
    });
    expect(cid, "接続ボタンが無い").not.toBeNull();
    await page.click("#" + cid);
    await page.waitForTimeout(800);
    // 本文から始点を消す
    await page.evaluate(() => {
      const e = document.getElementById("editor");
      e.value = ["flowchart TD", "    B[中]", "    C[相手]"].join(String.fromCharCode(10));
      e.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(2600);
    const lenBefore = (await body(page)).length;
    // 相手をクリック
    const at = await page.evaluate(() => {
      const m = Array.from(document.getElementById("overlay-layer").children)
        .filter((c) => c.getAttribute("data-element-id") === "C")[0];
      if (!m) return null;
      const b = m.getBoundingClientRect();
      return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
    });
    expect(at, "相手の当たり判定が無い").not.toBeNull();
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(1600);

    expect((await body(page)).length, "線ができてしまった").toBe(lenBefore);
    expect(await info(page)).toContain("始点が本文から消えています");
    expect(await inMode(page), "拒否なのに接続モードが終わった").toBe(true);
  });
});
