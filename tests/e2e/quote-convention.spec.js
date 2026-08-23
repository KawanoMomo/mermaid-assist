"use strict";
// UI-082: 足した要素の表記が、その文書の流儀に合わなかった。
//
// 測ったこと: 既存が A["要件"] の文書に足すと NEW[新規] になり、
// **同じ文書に表記が2通り**並ぶ。図の見た目は変わらないが、
// **Git 差分で追加行だけ書式が違い**、受け取った人が「なぜここだけ」と読む。
//
// **A115 (入れ子の字下げ) と同じ型。** あのとき「既存の子があればその字下げに
// 合わせる」と直したのに、引用符には同じ判断を適用していなかった。
//
// **多数決で決める。** 実測: flowchart のひな形は引用符なし (0対4) なので、
// 「1つでもあれば付ける」にするとひな形の流儀を壊す。
//
// **mindmap には入れない。** そこでは引用符が形状と結びついており
// (default 形状には囲む場所が無く、引用符を付けると [...] = 四角になる)、
// 流儀に合わせると**描かれる形が変わる**。書式を揃える話ではなくなる。
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

// 契約経路で1つ足し、足した行を返す
const addedLine = (page, text) => page.evaluate((t) => {
  const out = window.MA.modules.flowchart.operations.add(
    t, "node", { id: "NEW", label: "新規", shape: "rect" });
  return (out.split(String.fromCharCode(10)).filter((l) => /NEW/.test(l))[0] || "").trim();
}, text);

test.describe("足した要素が文書の流儀に合う", () => {
  test("引用符を使う文書には引用符付きで足す", async ({ page }) => {
    await load(page, "flowchart");
    const doc = ["flowchart TD",
      "    A[" + Q + "要件" + Q + "] --> B[" + Q + "設計" + Q + "]"].join(NL);
    expect(await addedLine(page, doc)).toBe("NEW[" + Q + "新規" + Q + "]");
  });

  test("引用符を使わない文書には付けずに足す", async ({ page }) => {
    await load(page, "flowchart");
    const doc = ["flowchart TD", "    A[要件] --> B[設計]"].join(NL);
    expect(await addedLine(page, doc)).toBe("NEW[新規]");
  });

  test("混在なら多数派に合わせる", async ({ page }) => {
    await load(page, "flowchart");
    const quotedMajority = ["flowchart TD",
      "    A[" + Q + "要件" + Q + "] --> B[" + Q + "設計" + Q + "]",
      "    C[実装]"].join(NL);
    expect(await addedLine(page, quotedMajority)).toBe("NEW[" + Q + "新規" + Q + "]");

    const plainMajority = ["flowchart TD",
      "    A[" + Q + "要件" + Q + "] --> B[設計]",
      "    C[実装]"].join(NL);
    expect(await addedLine(page, plainMajority)).toBe("NEW[新規]");
  });

  test("ひな形の流儀を壊さない", async ({ page }) => {
    // **ここが「1つでもあれば付ける」を退ける根拠。**
    // flowchart のひな形は引用符なし (実測 0対4)
    await load(page, "flowchart");
    const tpl = await page.evaluate(() => document.getElementById("editor").value);
    expect(tpl, "ひな形に引用符がある (前提が崩れている)").not.toContain(Q);
    expect(await addedLine(page, tpl)).toBe("NEW[新規]");
  });

  test("引用符が要るラベルには文書の流儀によらず付く", async ({ page }) => {
    // 流儀に合わせるのは**必要性の判定を上書きしない**
    await load(page, "flowchart");
    const doc = ["flowchart TD", "    A[要件] --> B[設計]"].join(NL);
    const line = await page.evaluate((t) => {
      const out = window.MA.modules.flowchart.operations.add(
        t, "node", { id: "NEW", label: "設計(詳細)", shape: "rect" });
      return (out.split(String.fromCharCode(10)).filter((l) => /NEW/.test(l))[0] || "").trim();
    }, doc);
    expect(line).toContain(Q);
  });

  test("足した後も図が描ける", async ({ page }) => {
    await load(page, "flowchart");
    const doc = ["flowchart TD",
      "    A[" + Q + "要件" + Q + "] --> B[" + Q + "設計" + Q + "]"].join(NL);
    const out = await page.evaluate((t) => window.MA.modules.flowchart.operations.add(
      t, "node", { id: "NEW", label: "新規", shape: "rect" }), doc);
    await page.evaluate((x) => {
      const e = document.getElementById("editor");
      e.value = x; e.dispatchEvent(new Event("input", { bubbles: true }));
    }, out);
    await page.waitForTimeout(2600);
    expect(await page.locator("#status-parse").textContent()).toBe("OK");
    const labels = await page.evaluate(() => Array.from(
      document.querySelectorAll("#preview-svg svg .nodeLabel")).map((n) => (n.textContent || "").trim()));
    expect(labels).toContain("新規");
  });
});
