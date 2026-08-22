'use strict';
// UI-042: 文書を入れ替えても、モジュールが覚えている一時状態が残る。
//
// block は「最後に追加した親グループ」を覚えている (lastAddParent)。
// 同じ文書の中では便利だが、**別の文書を開いても残っていた**。
// 実務では図をまたいで命名が揃う (どの図にも `G1` がある) ので、
// 開いた直後に追加を押すと、選んだ覚えのないグループの中に入る。
//
// 経路は2つあり、根が同じだった:
//   (1) ファイルを開く   … 掃除するのが「今のモジュール」1つだけ
//   (2) 図種の切替 → 開く … 掃除するのが「切替**先**」なので切替元が残る
//
// 実測 (直す前 / 後):
//   (1) 別のファイルを開いた後の親グループ選択: G1  →  (なし・トップレベル)
//   (2) block汚す→flowchartへ切替→blockを開く : G1  →  (なし・トップレベル)
const path = require('path');
const fs = require('fs');
const os = require('os');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);
// どちらの文書にも同じ名前のグループ `G1` がある、という実務の形
const BLOCK_DOC = ['block-beta', '  block:G1', '    a["A"]', '  end', '  b["B"]'].join(NL) + NL;

function writeTmp(name, body) {
  const f = path.join(os.tmpdir(), name);
  fs.writeFileSync(f, body);
  return f;
}

async function selectedParent(page) {
  return page.evaluate(() => {
    const s = document.getElementById('block-add-parent');
    if (!s) return '(欄が無い)';
    const o = s.options[s.selectedIndex];
    return o ? o.text.trim() : '(選択なし)';
  });
}

// G1 の中にブロックを1つ足して、モジュールに「前回の親」を覚えさせる
async function dirtyLastParent(page) {
  const sel = page.locator('#block-add-parent');
  await sel.selectOption({ label: 'G1' }).catch(async () => {
    await sel.selectOption('G1').catch(() => {});
  });
  await page.waitForTimeout(300);
  await page.locator('#block-add-id').fill('c');
  await page.locator('#block-add-label').fill('C');
  await page.locator('#block-add-btn').click();
  await page.waitForTimeout(1500);
  // 汚れたことを**先に確かめる**。ここが G1 でないと、後の
  // 「残っていない」は「そもそも覚えていない」を見ているだけになる。
  expect(await selectedParent(page)).toContain('G1');
}

async function openDoc(page, name, body) {
  await page.locator('#file-input').setInputFiles(writeTmp(name, body));
  await page.waitForTimeout(2200);
}

test('別の文書を開いたら、前の文書の親グループは選ばれていない', async ({ page }) => {
  // 未保存のまま開く/切り替えると破棄確認が出る。既定は**却下**なので、
  // 手当てしないと切替そのものが起きず、テストは通ってしまう。
  page.on('dialog', (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(600);
  await openDoc(page, 'ts-a1.mmd', BLOCK_DOC);
  await dirtyLastParent(page);

  // 同じ名前のグループを持つ**別の**文書
  await openDoc(page, 'ts-a2.mmd',
    ['block-beta', '  block:G1', '    x["X"]', '  end', '  y["Y"]'].join(NL) + NL);
  expect(await selectedParent(page)).not.toContain('G1');

  // 選択だけでなく、押した結果も見る (選択欄が空でも中に入るなら意味がない)
  await page.locator('#block-add-id').fill('z');
  await page.locator('#block-add-label').fill('Z');
  await page.locator('#block-add-btn').click();
  await page.waitForTimeout(1500);
  const text = await page.evaluate(() => document.getElementById('editor').value);
  const zLine = text.split(NL).find((l) => l.indexOf('z[') >= 0) || '';
  // グループの中に入ると字下げが深くなる。トップレベルなら浅い。
  expect(zLine.length - zLine.replace(/^ +/, '').length).toBeLessThanOrEqual(2);
});

test('図種を切り替えてから開いても、前の文書の親グループは残らない', async ({ page }) => {
  // 未保存のまま開く/切り替えると破棄確認が出る。既定は**却下**なので、
  // 手当てしないと切替そのものが起きず、テストは通ってしまう。
  page.on('dialog', (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(600);
  await openDoc(page, 'ts-b1.mmd', BLOCK_DOC);
  await dirtyLastParent(page);

  // ドロップダウンでの切替は「切替**先**」を掃除するので、block は残る
  await page.locator('#diagram-type').selectOption('flowchart');
  await page.waitForTimeout(1800);
  await openDoc(page, 'ts-b2.mmd', BLOCK_DOC);
  expect(await selectedParent(page)).not.toContain('G1');
});

// A114: 同じ形が c4 にも残っていた。block を直したとき19モジュールを数えて
// いなかった。c4 は**種類**まで覚えるので block より重い — 外部システムを
// 足したあと別の図を開くと、種類も親境界も残り、要素の意味が変わる。
//
// 実測 (直す前 / 後): System_Ext / B1  →  Person / (なし・トップレベル)
const C4_DOC = (who) => ['C4Context',
  '    title ' + who,
  '    Enterprise_Boundary(B1, "B1") {',
  '      Person(' + who + 'u, "U", "d")',
  '    }',
  '    System(' + who + 's, "S", "d")'].join(NL) + NL;

async function selectedById(page, id) {
  return page.evaluate((i) => {
    const s = document.getElementById(i);
    if (!s) return '(欄が無い)';
    const o = s.options[s.selectedIndex];
    return o ? o.text.trim() : '(選択なし)';
  }, id);
}

test('c4: 別の文書を開いたら、前の文書の種類と親境界は残らない', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(600);
  await openDoc(page, 'ts-c1.mmd', C4_DOC('a'));

  // 既定と違う種類・親を選んで足す
  await page.locator('#c4-add-kind').selectOption('System_Ext');
  await page.locator('#c4-add-parent').selectOption('B1');
  await page.waitForTimeout(300);
  await page.locator('#c4-add-id').fill('newone');
  await page.locator('#c4-add-label').fill('New');
  await page.locator('#c4-add-btn').click();
  await page.waitForTimeout(1600);
  // 汚れたことを先に確かめる。ここが既定のままだと、後の判定は
  // 「そもそも覚えていない」を見ているだけになる。
  expect(await selectedById(page, 'c4-add-kind')).toContain('System_Ext');
  expect(await selectedById(page, 'c4-add-parent')).toContain('B1');

  await openDoc(page, 'ts-c2.mmd', C4_DOC('b'));
  expect(await selectedById(page, 'c4-add-kind')).not.toContain('System_Ext');
  expect(await selectedById(page, 'c4-add-parent')).not.toContain('B1');
});
