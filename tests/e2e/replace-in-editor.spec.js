"use strict";
// FEAT-001: 用語を置き換える手段が無かった。
//
// 実測 (直す前): レビュー指摘で `_Init` → `_Initialize` に統一するとき、
// 5要素の改名に **15操作** (編集ボタン5回 + 入力5回 + 確定5回)。
// エディタは素の <textarea> で **Ctrl+H は無反応**だった。
// 2026-08-23 決定: エディタに置換を付ける。目標は2操作。
//
// **正規表現は入れない。** 誤った式で本文全体を壊す事故は Ctrl+Z 1回では
// 気付けない。扱うのは「そのままの文字列」だけ。
const path = require("path");
const { test, expect } = require("@playwright/test");
const HTML_URL = "file:///" + path.resolve(__dirname, "..", "..", "mermaid-assist.html").split(path.sep).join("/");
const NL = String.fromCharCode(10);

// 組込みの BSW 名は先頭が共通で末尾だけ違う。用語統一が起きる典型
const DOC = ["flowchart TD",
  "    ComM_Init --> EcuM_Init",
  "    EcuM_Init --> Det_Init"].join(NL);

async function load(page) {
  page.on("dialog", (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector("#preview-svg svg", { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate((x) => {
    const e = document.getElementById("editor");
    e.value = x; e.dispatchEvent(new Event("input", { bubbles: true }));
  }, DOC);
  await page.waitForTimeout(2400);
}

const body = (page) => page.evaluate(() => document.getElementById("editor").value);
const barState = (page) => page.evaluate(() => ({
  hidden: document.getElementById("replace-bar").hidden,
  focus: (document.activeElement || {}).id,
  count: (document.getElementById("replace-count") || {}).textContent,
}));

test.describe("エディタで用語を置き換える", () => {
  test("Ctrl+H で開き、探す語に焦点が入る", async ({ page }) => {
    await load(page);
    expect((await barState(page)).hidden, "最初から開いている").toBe(true);
    await page.locator("#editor").click();
    await page.keyboard.press("Control+h");
    await page.waitForTimeout(500);
    const s = await barState(page);
    expect(s.hidden).toBe(false);
    // 開いてから欄を探させない
    expect(s.focus).toBe("replace-find");
  });

  test("探す語を入れると件数が出る", async ({ page }) => {
    // **押す前に結果が分かる**ようにするため。誤置換の抑止
    await load(page);
    await page.keyboard.press("Control+h");
    await page.waitForTimeout(400);
    await page.fill("#replace-find", "_Init");
    await page.waitForTimeout(400);
    expect((await barState(page)).count).toContain("4");
    await page.fill("#replace-find", "存在しない語");
    await page.waitForTimeout(400);
    expect((await barState(page)).count).toContain("見つかりません");
  });

  test("すべて置換すると本文が置き換わり、図が描ける", async ({ page }) => {
    await load(page);
    await page.keyboard.press("Control+h");
    await page.waitForTimeout(400);
    await page.fill("#replace-find", "_Init");
    await page.fill("#replace-to", "_Initialize");
    await page.click("#replace-all");
    await page.waitForTimeout(2600);
    const after = await body(page);
    expect(after).toContain("ComM_Initialize");
    expect(after).not.toContain("ComM_Init " );
    expect(after.split("_Initialize").length - 1).toBe(4);
    // 本文が変わっただけで図が壊れていたら意味が無い
    expect(await page.locator("#status-parse").textContent()).toBe("OK");
    // 何件変えたかを言う
    expect(await page.locator("#status-info").textContent()).toContain("4 件を置き換えました");
  });

  test("置換を Ctrl+Z 1回で戻せる", async ({ page }) => {
    // 一括置換は影響が大きい。戻せないなら怖くて使えない
    await load(page);
    const before = await body(page);
    await page.keyboard.press("Control+h");
    await page.waitForTimeout(400);
    await page.fill("#replace-find", "_Init");
    await page.fill("#replace-to", "_Initialize");
    await page.click("#replace-all");
    await page.waitForTimeout(2600);
    expect(await body(page)).not.toBe(before);
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(1600);
    expect(await body(page), "Ctrl+Z 1回で戻らない").toBe(before);
  });

  test("Escape で閉じ、エディタへ焦点が戻る", async ({ page }) => {
    // 抜ける手段がキーボードに無いとマウスへ持ち替える
    await load(page);
    await page.keyboard.press("Control+h");
    await page.waitForTimeout(400);
    await page.locator("#replace-find").click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const s = await barState(page);
    expect(s.hidden).toBe(true);
    expect(s.focus).toBe("editor");
  });

  test("探す語が空なら理由を言い、本文を触らない", async ({ page }) => {
    await load(page);
    const before = await body(page);
    await page.keyboard.press("Control+h");
    await page.waitForTimeout(400);
    await page.fill("#replace-to", "何か");
    await page.click("#replace-all");
    await page.waitForTimeout(900);
    expect(await body(page)).toBe(before);
    expect(await page.locator("#status-info").textContent()).toContain("は必須です");
  });

  test("見つからない語なら理由を言い、本文を触らない", async ({ page }) => {
    await load(page);
    const before = await body(page);
    await page.keyboard.press("Control+h");
    await page.waitForTimeout(400);
    await page.fill("#replace-find", "存在しない語");
    await page.fill("#replace-to", "何か");
    await page.click("#replace-all");
    await page.waitForTimeout(900);
    expect(await body(page)).toBe(before);
    expect(await page.locator("#status-info").textContent()).toContain("本文にありません");
  });

  test("狭い画面でも置換の欄が溢れない", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await load(page);
    await page.keyboard.press("Control+h");
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const bar = document.getElementById("replace-bar");
      const b = bar.getBoundingClientRect();
      const kids = Array.from(bar.children).map((c) => c.getBoundingClientRect());
      return { inView: b.right <= innerWidth + 1,
        childOut: kids.filter((k) => k.right > innerWidth + 1).length,
        hScroll: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    expect(r.inView).toBe(true);
    expect(r.childOut, "欄の中身が画面からはみ出した").toBe(0);
    expect(r.hScroll).toBe(false);
  });
});
