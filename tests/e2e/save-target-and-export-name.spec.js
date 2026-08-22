"use strict";
// UI-075: 保存先のファイル名が画面内に出ない / UI-076: 透過PNGが通常PNGと同名。
//
// 実測 (直す前):
//   UI-075 「設計-A.mmd」を開いた状態で document.title は "設計-A.mmd — MermaidAssist"
//     だが、**ステータス欄にも本文にも .mmd が出ない**。タブを何枚も開くと
//     タイトルが省略され、Ctrl+S を押す前に保存先を確かめる手段が
//     「タブをホバーする」しか無かった。UI-065 (未保存の印) と同じ型の欠落。
//   UI-076 通常PNGも透過PNGも flowchart-20260823.png で出る。2倍版は @2x が
//     付くのに、**透過だけ規則から漏れていた**。両方書き出すと保存先に
//     同名 + " (1)" が並び、開くまでどちらが透過か分からない。
//     中身は確かに違う (左上の画素が [255,255,255,255] と [0,0,0,0])。
const path = require("path");
const fs = require("fs");
const os = require("os");
const { test, expect } = require("@playwright/test");
const HTML_URL = "file:///" + path.resolve(__dirname, "..", "..", "mermaid-assist.html").split(path.sep).join("/");
const NL = String.fromCharCode(10);
const Q = String.fromCharCode(34);
const DOC = ["flowchart TD", "    A[" + Q + "要件定義" + Q + "] --> B[" + Q + "設計" + Q + "]"].join(NL);

async function load(page) {
  page.on("dialog", (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector("#preview-svg svg", { timeout: 20000 });
  await page.waitForTimeout(800);
}

const label = (page) => page.evaluate(() => {
  const e = document.getElementById("status-file");
  return e ? { text: (e.textContent || "").trim(), shown: e.offsetHeight > 0 } : null;
});

async function edit(page, text) {
  await page.evaluate((x) => {
    const e = document.getElementById("editor");
    e.value = x; e.dispatchEvent(new Event("input", { bubbles: true }));
  }, text);
  await page.waitForTimeout(2600);
}

async function exportAs(page, id) {
  await page.click("#btn-export");
  await page.waitForTimeout(350);
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 12000 }),
    page.click("#" + id),
  ]);
  return dl.suggestedFilename();
}

test.describe("保存先と書き出し名が画面と名前で分かる", () => {
  test("保存先のファイル名が画面の中に出る", async ({ page }) => {
    await load(page);
    const first = await label(page);
    expect(first, "#status-file が無い").not.toBeNull();
    expect(first.shown).toBe(true);
    expect(first.text).toMatch(/\.mmd$/);
  });

  test("ファイルを開くと保存先の表示が追随する", async ({ page }) => {
    // 「常に同じ文字を出す」実装だと、開いたファイルと食い違ったまま気付けない
    await load(page);
    const f = path.join(os.tmpdir(), "設計-A.mmd");
    fs.writeFileSync(f, DOC);
    await page.locator("#file-input").setInputFiles(f);
    await page.waitForTimeout(2400);
    expect((await label(page)).text).toBe("設計-A.mmd");
    // 図種を切り替えたら保存先も切り替わる (前のファイルを上書きしない)
    await page.selectOption("#diagram-type", "sequenceDiagram");
    await page.waitForTimeout(2200);
    expect((await label(page)).text).not.toBe("設計-A.mmd");
    expect((await label(page)).text).toMatch(/\.mmd$/);
  });

  test("長い名前でも未保存の印が画面から押し出されない", async ({ page }) => {
    // **測る条件が甘いと変異が素通りする。** 最初は既定の短い名前で
    // 「はみ出さないか」を見ていたが、幅の制限を外しても収まってしまい、
    // 変異 (max-width を外す) が落ちなかった。
    //
    // 守りたいのは「名前が切れないこと」ではなく、**名前が長くても他の表示を
    // 押し出さないこと**。実務の設計書名は版・日付・状態を連ねるので長い。
    //
    // 実測 (800x600, 下の名前):
    //   制限あり: 名前の右端 458 / 未保存の印 535 → どちらも画面内
    //   制限なし: 名前の右端 806 / 未保存の印 882 → **どちらも画面外**
    //             (UI-065 で画面へ出したばかりの印が、また見えなくなる)
    await page.setViewportSize({ width: 800, height: 600 });
    await load(page);
    const longName = "ComM_ChannelStateManager_詳細設計書_第3版_2026年度_" +
      "安全機構レビュー反映済_最終確認待ち_担当者確認済_改訂履歴あり.mmd";
    const f = path.join(os.tmpdir(), longName);
    fs.writeFileSync(f, DOC);
    await page.locator("#file-input").setInputFiles(f);
    await page.waitForTimeout(2400);
    // 未保存の状態にする (印を出す)
    await edit(page, DOC + NL + "    B --> C[" + Q + "検証" + Q + "]");

    const r = await page.evaluate(() => {
      const q = (id) => {
        const e = document.getElementById(id);
        const b = e.getBoundingClientRect();
        return { right: Math.round(b.right), width: Math.round(b.width),
          inView: b.right <= innerWidth + 1 && b.width > 0 };
      };
      return { file: q("status-file"), dirty: q("status-dirty"),
        hScroll: document.documentElement.scrollWidth > innerWidth + 1,
        hasTitle: !!document.getElementById("status-file").title };
    });
    expect(r.file.inView, "保存先が画面外 (右端" + r.file.right + ")").toBe(true);
    expect(r.dirty.inView, "未保存の印が押し出された (右端" + r.dirty.right + ")").toBe(true);
    expect(r.hScroll, "横スクロールが出た").toBe(false);
    expect(r.hasTitle, "切れた名前を読む手段が無い").toBe(true);
  });

  test("書き出した3種のPNGが名前で見分けられる", async ({ page }) => {
    await load(page);
    await edit(page, DOC);
    const plain = await exportAs(page, "exp-png");
    const twoX = await exportAs(page, "exp-png-2x");
    const trans = await exportAs(page, "exp-png-transparent");
    // **3つとも違う名前**であること (2つが同名だと開くまで区別が付かない)
    expect(new Set([plain, twoX, trans]).size, "同じ名前で出た: " +
      JSON.stringify([plain, twoX, trans])).toBe(3);
    expect(twoX).toContain("@2x");
    expect(trans).toContain("transparent");
    // 通常版には余計な接尾辞が付かない (毎回使う経路の名前を汚さない)
    expect(plain).not.toContain("@");
    expect(plain).not.toContain("transparent");
  });
});
