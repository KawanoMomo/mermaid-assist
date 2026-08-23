"use strict";
// UI-066: 新規の図の名前が、ひな形のタイトル由来だった。
//
// 実測 (直す前):
//   起動直後   → プロジェクト計画.mmd   (gantt のひな形のタイトル)
//   図種変更後 → sequenceDiagram-20260823.mmd
// **同じ「新規の図」なのに規則が2通り**あった。かつ同じひな形から作った図は
// 全部同じ名前になり、保存先に「プロジェクト計画 (1).mmd」が並んで
// 開くまでどれがどれか分からなかった。
//
// 決定 (2026-08-23): 常に `<図種>-<日付>.mmd` に揃える。
// **開いたファイル名は残す** — そちらは保存先の取り違えを防ぐために要る。
const path = require("path");
const fs = require("fs");
const os = require("os");
const { test, expect } = require("@playwright/test");
const HTML_URL = "file:///" + path.resolve(__dirname, "..", "..", "mermaid-assist.html").split(path.sep).join("/");
const NL = String.fromCharCode(10);
const Q = String.fromCharCode(34);

async function load(page) {
  page.on("dialog", (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector("#preview-svg svg", { timeout: 20000 });
  await page.waitForTimeout(800);
}

const shownName = (page) => page.evaluate(
  () => ((document.getElementById("status-file") || {}).textContent || "").trim());

// 今日の日付 (YYYYMMDD)。テストの実行日で決まるので固定値を書かない。
function stamp() {
  const d = new Date();
  return String(d.getFullYear()) +
    ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2);
}

test.describe("新規の図の名前", () => {
  test("起動直後の名前が 図種-日付 になる", async ({ page }) => {
    await load(page);
    // 起動時の図種を実際に読む (既定が変わってもテストが嘘にならない)
    const type = await page.evaluate(() => document.getElementById("diagram-type").value);
    expect(await shownName(page)).toBe(type + "-" + stamp() + ".mmd");
  });

  test("図種を切り替えても同じ規則で付く", async ({ page }) => {
    await load(page);
    for (const type of ["flowchart", "sequenceDiagram", "classDiagram"]) {
      await page.selectOption("#diagram-type", type);
      await page.waitForTimeout(2200);
      expect(await shownName(page), type + " の名前").toBe(type + "-" + stamp() + ".mmd");
    }
  });

  test("ひな形のタイトルを名前に使わない", async ({ page }) => {
    // gantt のひな形は title を持つ。以前はそれが名前になっていた
    await load(page);
    await page.selectOption("#diagram-type", "gantt");
    await page.waitForTimeout(2200);
    const title = await page.evaluate(() => {
      const m = document.getElementById("editor").value.match(/^\s*title\s+(.+)$/m);
      return m ? m[1].trim() : null;
    });
    expect(title, "gantt のひな形に title が無い (前提が崩れている)").not.toBeNull();
    const name = await shownName(page);
    expect(name).not.toContain(title);
    expect(name).toBe("gantt-" + stamp() + ".mmd");
  });

  test("開いたファイルの名前は保持する", async ({ page }) => {
    // 取り違えを防ぐ側の規則。新規の規則で上書きしてはいけない
    await load(page);
    const f = path.join(os.tmpdir(), "設計-A.mmd");
    fs.writeFileSync(f, ["flowchart TD", "    A[" + Q + "設計" + Q + "] --> B"].join(NL));
    await page.locator("#file-input").setInputFiles(f);
    await page.waitForTimeout(2400);
    expect(await shownName(page)).toBe("設計-A.mmd");
  });

  test("実際に保存されるファイル名も同じ規則", async ({ page }) => {
    // 表示だけ直して保存名が古いままだと、画面と結果が食い違う
    await load(page);
    const type = await page.evaluate(() => document.getElementById("diagram-type").value);
    await page.locator("#preview-pane").click({ position: { x: 5, y: 5 } }).catch(() => {});
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 12000 }),
      page.keyboard.press("Control+s"),
    ]);
    expect(dl.suggestedFilename()).toBe(type + "-" + stamp() + ".mmd");
  });
});
