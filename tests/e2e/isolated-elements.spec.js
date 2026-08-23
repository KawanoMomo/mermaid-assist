"use strict";
// UI-080: どこにも繋がっていない要素があっても気付けなかった。
//
// 消し忘れた要素が図に残ったままレビューに出る。図を目で追って数えるしかなく、
// 手数は要素数に比例する。gantt の danglingAfter (宙に浮いた依存) と同じ考え方で
// **件数ではなく名前**を出す —「1件あります」では探す手間が残る。
//
// **図種ごとの対応表は作らない。** 実測 (21図種) で分かったこと:
//   - 関係を持たない図種が11ある (mindmap / kanban / timeline …)。
//     そこでは全要素が孤立に見えるので、**関係が1つも無ければ何も言わない**
//   - 関係の端点が要素の id と一致しない図種がある —
//     requirementDiagram は関係が name (sample_req) を使い、id は
//     内側のフィールド (REQ-001)。stateDiagram の [*] は要素ではない
//   → **要素が持つ「いずれかの文字列」が端点に現れるか**で判定する。
//
// 21図種のひな形で**誤検知 0 件**を実測して規則を決めた。
const path = require("path");
const { test, expect } = require("@playwright/test");
const HTML_URL = "file:///" + path.resolve(__dirname, "..", "..", "mermaid-assist.html").split(path.sep).join("/");
const NL = String.fromCharCode(10);
const Q = String.fromCharCode(34);

async function load(page, type) {
  page.on("dialog", (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector("#preview-svg svg", { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.selectOption("#diagram-type", type);
  await page.waitForTimeout(2200);
}

async function edit(page, text) {
  await page.evaluate((x) => {
    const e = document.getElementById("editor");
    e.value = x; e.dispatchEvent(new Event("input", { bubbles: true }));
  }, text);
  await page.waitForTimeout(2600);
}

const info = (page) => page.evaluate(
  () => ((document.getElementById("status-info") || {}).textContent || "").trim());

test.describe("どこにも繋がっていない要素", () => {
  test("孤立した要素があると名前を出す", async ({ page }) => {
    await load(page, "flowchart");
    await edit(page, ["flowchart TD",
      "    A[" + Q + "要件" + Q + "] --> B[" + Q + "設計" + Q + "]",
      "    Z[" + Q + "孤立" + Q + "]"].join(NL));
    const s = await info(page);
    expect(s).toContain("どこにも繋がっていない");
    // **件数ではなく名前**。数だけでは数百行の図で探せない
    expect(s).toContain("孤立");
  });

  test("多いときは先頭2件と残りの数を出す", async ({ page }) => {
    // ステータス行は1行しかない。全部並べると読めない
    await load(page, "flowchart");
    await edit(page, ["flowchart TD",
      "    A[" + Q + "要件" + Q + "] --> B[" + Q + "設計" + Q + "]",
      "    Y[" + Q + "孤立1" + Q + "]",
      "    Z[" + Q + "孤立2" + Q + "]",
      "    W[" + Q + "孤立3" + Q + "]"].join(NL));
    const s = await info(page);
    expect(s).toContain("孤立1");
    expect(s).toContain("孤立2");
    expect(s).toContain("ほか1件");
    expect(s, "3件目まで並べている").not.toContain("孤立3");
  });

  test("全部つながっていれば何も言わない", async ({ page }) => {
    await load(page, "flowchart");
    await edit(page, ["flowchart TD",
      "    A[" + Q + "要件" + Q + "] --> B[" + Q + "設計" + Q + "]",
      "    B --> C[" + Q + "実装" + Q + "]"].join(NL));
    expect(await info(page)).not.toContain("どこにも繋がっていない");
  });

  for (const type of ["mindmap", "kanban", "timeline", "pie"]) {
    test(type + ": 関係を持たない図種では何も言わない", async ({ page }) => {
      // **ここが誤検知の本命。** これらの図種はひな形の全要素が
      // 「関係の端点に現れない」ので、素朴に数えると全件が孤立に見える
      await load(page, type);
      expect(await info(page), type + " で誤検知した").not.toContain("どこにも繋がっていない");
    });
  }

  for (const type of ["requirementDiagram", "stateDiagram", "C4Context", "architecture-beta"]) {
    test(type + ": ひな形で誤検知しない", async ({ page }) => {
      // requirementDiagram は関係が name を使い id と一致しない。
      // stateDiagram の [*] は要素ではない。素朴な id 照合だと誤検知する
      await load(page, type);
      expect(await info(page), type + " のひな形で誤検知した").not.toContain("どこにも繋がっていない");
    });
  }
});
