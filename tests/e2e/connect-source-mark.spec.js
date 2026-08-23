"use strict";
// UI-077: 接続モードに入ると、起点の印が図から消えていた。
//
// 実測 (直す前, DOM 差分で決着):
//   要素を選ぶ     → overlay に stroke="#7ee787" が **1個**
//   「ここから線を引く」→ **0個** (印が消える)
// ステータス行は「接続モード: C から線を引きます — 相手をクリック
// (Escape で中止)」と正しく言うが、**視線は図にある**。起点を確かめるには
// ステータス行へ視線を移す1手が要った。
//
// **判定は hitRect の中でする。** hitRect を直接呼ぶモジュールが4つある
// (flowchart / block / c4 / kanban)。呼び出し側に渡させると 21図種のうち
// 一部だけ光る不揃いを作る — このコードベースが繰り返し踏んできた型
// (UI 経路だけ直して契約経路を忘れる) そのもの。
const path = require("path");
const { test, expect } = require("@playwright/test");
const HTML_URL = "file:///" + path.resolve(__dirname, "..", "..", "mermaid-assist.html").split(path.sep).join("/");

const SELECTED = "#7ee787";      // 選択の印
const CONNECT_SRC = "#f0883e";   // 接続元の印 (別の色でないと区別できない)

async function load(page, type) {
  page.on("dialog", (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector("#preview-svg svg", { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.selectOption("#diagram-type", type);
  await page.waitForTimeout(2400);
}

const marks = (page) => page.evaluate(([sel, con]) => {
  const ch = Array.from(document.getElementById("overlay-layer").children);
  return { selected: ch.filter((c) => c.getAttribute("stroke") === sel).length,
    connectSrc: ch.filter((c) => c.getAttribute("stroke") === con).length };
}, [SELECTED, CONNECT_SRC]);

// 一覧の先頭を選び、接続モードに入る。接続ボタンが無い図種は null を返す。
async function startConnect(page) {
  const picked = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("#props-content .ma-list-row"));
    if (!rows.length) return false;
    rows[0].querySelector("button").click();
    return true;
  });
  if (!picked) return null;
  await page.waitForTimeout(900);
  const id = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("#props-content button"))
      .filter((x) => /線を引く/.test(x.textContent || ""))[0];
    return b ? b.id : null;
  });
  if (!id) return null;
  await page.click("#" + id);
  await page.waitForTimeout(1000);
  return true;
}

test.describe("接続モードの起点が図で分かる", () => {
  for (const type of ["flowchart", "block-beta", "stateDiagram"]) {
    test(type + ": 接続モードに入ると起点が図で光る", async ({ page }) => {
      await load(page, type);
      const started = await startConnect(page);
      expect(started, type + " に接続ボタンが無い (前提が崩れている)").toBe(true);
      const m = await marks(page);
      expect(m.connectSrc, "接続元の印が図に出ていない").toBe(1);
    });
  }

  test("接続元の印は、選択の印と別の色である", async ({ page }) => {
    // 同じ色だと「選ばれている」のか「ここから線を引く」のかが区別できない
    await load(page, "flowchart");
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("#props-content .ma-list-row"));
      rows[0].querySelector("button").click();
    });
    await page.waitForTimeout(900);
    const before = await marks(page);
    expect(before.selected, "選ぶだけで印が出ていない (前提が崩れている)").toBe(1);
    expect(before.connectSrc).toBe(0);

    const id = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("#props-content button"))
        .filter((x) => /線を引く/.test(x.textContent || ""))[0];
      return b ? b.id : null;
    });
    await page.click("#" + id);
    await page.waitForTimeout(1000);
    const after = await marks(page);
    expect(after.connectSrc).toBe(1);
    expect(SELECTED).not.toBe(CONNECT_SRC);
  });

  test("接続を中止したら起点の印も消える", async ({ page }) => {
    // 印だけ残ると「まだ線を引こうとしている」と誤解する
    await load(page, "flowchart");
    expect(await startConnect(page)).toBe(true);
    expect((await marks(page)).connectSrc).toBe(1);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    expect((await marks(page)).connectSrc, "中止したのに起点の印が残っている").toBe(0);
  });
});
