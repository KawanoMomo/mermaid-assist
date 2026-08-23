"use strict";
// UI-072: エッジの端点を差し替えると、**触っていない要素のラベルが消えた**。
//
// 実測 (直す前, flowchart):
//   前   A[要件定義] --> B[設計] / B --> C[実装] / C --> D[検証]  (ラベルは引用符付き)
//   操作 B --> C の行き先を R に変える
//   後   A[要件定義] --> B[設計] / B --> R / C --> D[検証]
//   描画ラベル: 要件定義 / 設計 / R / **C** / 検証   ← 「実装」が消えて ID が出た
//
// C の宣言はそのエッジ行にインラインで書かれていた。端点を書き換えるときに
// 宣言ごと捨てていた。C は `C --> D` から参照され続けるので図には残るが、
// ラベルが無いので ID の "C" が描かれる。**何も言われずに名前が消える。**
// from 側も同じ (A[要件定義] --> B を Z --> B にすると「要件定義」が消える)。
//
// deleteNode は同じ問題を既に解いていた (生き残る端点の宣言を単独行として
// 出し直す)。契約経路の update だけが古いままだった。
const path = require("path");
const { test, expect } = require("@playwright/test");
const HTML_URL = "file:///" + path.resolve(__dirname, "..", "..", "mermaid-assist.html").split(path.sep).join("/");
const NL = String.fromCharCode(10);
const Q = String.fromCharCode(34);          // ラベルを囲む二重引用符

const BASE = ["flowchart TD",
  "    A[" + Q + "要件定義" + Q + "] --> B[" + Q + "設計" + Q + "]",
  "    B --> C[" + Q + "実装" + Q + "]",
  "    C --> D[" + Q + "検証" + Q + "]"].join(NL);

async function load(page) {
  page.on("dialog", (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector("#preview-svg svg", { timeout: 20000 });
  await page.waitForTimeout(800);
}

// **図に実際に描かれたラベル**を見る。本文だけ見ると「宣言が残っている」で
// 満足してしまい、描画時に ID が出ていることに気付けない。
async function labels(page, text) {
  await page.evaluate((x) => {
    const e = document.getElementById("editor");
    e.value = x; e.dispatchEvent(new Event("input", { bubbles: true }));
  }, text);
  await page.waitForTimeout(2400);
  return page.evaluate(() => Array.from(
    document.querySelectorAll("#preview-svg svg .nodeLabel")).map((n) => (n.textContent || "").trim()));
}

const edit = (page, text, line, field, value) => page.evaluate(
  ([t, l, f, v]) => window.MA.modules.flowchart.operations.update(t, l, f, v, { kind: "edge" }),
  [text, line, field, value]);

test.describe("エッジの端点を変えても他の要素の名前が消えない", () => {
  test("行き先を変えても、その行に宣言されていた要素の名前が残る", async ({ page }) => {
    await load(page);
    expect(await labels(page, BASE)).toEqual(["要件定義", "設計", "実装", "検証"]);
    const out = await edit(page, BASE, 3, "to", "R");
    const after = await labels(page, out);
    expect(after).toContain("実装");     // 名前が残っている
    expect(after).not.toContain("C");    // ID が代わりに出ていない
    expect(after).toContain("R");
  });

  test("出発点を変えても、その行に宣言されていた要素の名前が残る", async ({ page }) => {
    // 行き先側だけ直すと from 側が残る。両方を押さえる
    await load(page);
    const out = await edit(page, BASE, 2, "from", "Z");
    const after = await labels(page, out);
    expect(after).toContain("要件定義");
    expect(after).not.toContain("A");
    expect(after).toContain("Z");
  });

  test("宣言の無い端点では余計な行を足さない", async ({ page }) => {
    // 「常に単独宣言を足す」実装だと本文が育ち、Git 差分が汚れる
    await load(page);
    const plain = ["flowchart TD", "    A --> B", "    B --> C"].join(NL);
    const out = await edit(page, plain, 2, "to", "X");
    expect(out.split(NL).length).toBe(plain.split(NL).length);
    expect(await labels(page, out)).toEqual(["A", "X", "B", "C"]);
  });

  test("矢印だけ変えたときは本文が育たない", async ({ page }) => {
    await load(page);
    const one = ["flowchart TD", "    A[" + Q + "起点" + Q + "] --> B[" + Q + "終点" + Q + "]"].join(NL);
    const out = await edit(page, one, 2, "arrow", "-.->");
    expect(out.split(NL).length).toBe(one.split(NL).length);
    expect(await labels(page, out)).toEqual(["起点", "終点"]);
  });
});
