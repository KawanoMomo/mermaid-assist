'use strict';
// ヘビーユーザ視点の批判レビュー (UI-001〜UI-008) で出た摩擦の修正を固定する。
//
// 元の指摘はいずれも「毎日100回踏む操作」に関わるもの。直したあとで静かに
// 戻ると、戻ったこと自体が気付かれない種類の変更なので e2e で押さえる。
const path = require('path');
const { test, expect } = require('@playwright/test');

const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');

async function open(page, type) {
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  if (type && type !== 'gantt') {
    await page.locator('#diagram-type').selectOption(type);
    await page.waitForTimeout(1700);
  }
  await page.waitForTimeout(400);
}

async function setText(page, txt) {
  await page.evaluate((t) => {
    const ed = document.getElementById('editor');
    ed.value = t;
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  }, txt);
}

test.describe('UI-002 / UI-006: Delete キーが全図種で効き、戻せることを告げる', () => {
  // 以前は `parsed.tasks` を見て gantt だけを処理し、他の20図種には
  // 「未対応 — 一覧の ✕ を使ってください」と返していた。削除1回ごとに
  // マウス往復が1回発生していた。契約は全21図種で揃っている。
  for (const type of ['gantt', 'flowchart', 'classDiagram', 'stateDiagram', 'erDiagram', 'block-beta']) {
    test(type + ': Delete で消え、取り消せることが画面に出る', async ({ page }) => {
      await open(page, type);
      const hit = page.locator('#overlay-layer [data-element-id], #overlay-layer .overlay-bar').first();
      await hit.click({ force: true });
      await page.waitForTimeout(600);

      const before = await page.locator('#editor').inputValue();
      await page.evaluate(() => {
        const pane = document.getElementById('preview-pane');
        if (pane) { pane.setAttribute('tabindex', '-1'); pane.focus(); }
      });
      await page.keyboard.press('Delete');
      await page.waitForTimeout(900);

      expect(await page.locator('#editor').inputValue()).not.toBe(before);
      await expect(page.locator('#status-info')).toContainText('Ctrl+Z');

      await page.evaluate(() => window.MA.history.undo());
      await page.waitForTimeout(600);
      expect(await page.locator('#editor').inputValue()).toBe(before);
    });
  }
});

test.describe('UI-001 / UI-005: 大きな図と、描けないときの言い分', () => {
  test('800要素の flowchart が描ける (以前は500エッジで落ちていた)', async ({ page }) => {
    test.setTimeout(180000);
    await open(page, 'flowchart');
    let txt = 'flowchart TD\n';
    for (let i = 0; i < 800; i++) txt += '    N' + i + '[ノード' + i + '] --> N' + ((i + 1) % 800) + '\n';
    await setText(page, txt);
    await page.waitForFunction(() => {
      const s = document.getElementById('status-parse');
      return s && (s.textContent === 'OK' || s.classList.contains('error'));
    }, { timeout: 120000 });
    await expect(page.locator('#status-parse')).toHaveText('OK');
    await expect(page.locator('#parse-error-banner')).toBeHidden();
  });

  test('描けないときに「構文エラー」と断定しない', async ({ page }) => {
    test.setTimeout(300000);
    await open(page, 'flowchart');
    // mermaid の配置計算が再帰上限に当たる規模。こちらの設定では回避できない。
    let txt = 'flowchart TD\n';
    for (let i = 0; i < 3000; i++) txt += '    N' + i + '[ノード' + i + '] --> N' + ((i + 1) % 3000) + '\n';
    await setText(page, txt);
    await page.waitForFunction(() => {
      const s = document.getElementById('status-parse');
      return s && s.classList.contains('error');
    }, { timeout: 240000 });
    const banner = page.locator('#parse-error-banner');
    await expect(banner).toBeVisible();
    // 本文に構文誤りは1つも無いので、構文を疑わせてはいけない
    await expect(banner).not.toContainText('構文エラー');
    await expect(banner).toContainText('要素が多すぎて');
  });
});

test.describe('UI-007: 保存したファイルが改行で終わる', () => {
  for (const type of ['gantt', 'flowchart', 'erDiagram']) {
    test(type + ': 末尾改行が付き、開き直すと本文が一致する', async ({ page }, testInfo) => {
      await open(page, type);
      const inEditor = await page.locator('#editor').inputValue();

      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        page.locator('#btn-save').first().click(),
      ]);
      const f = testInfo.outputPath(type.replace(/\W/g, '_') + '.mmd');
      await dl.saveAs(f);
      const saved = require('fs').readFileSync(f, 'utf8');

      expect(saved.endsWith('\n')).toBe(true);
      expect(saved.replace(/\n$/, '')).toBe(inEditor);

      await page.locator('input[type="file"]').first().setInputFiles(f);
      await page.waitForTimeout(2000);
      // 開き直しで末尾に空行が増えないこと
      expect(await page.locator('#editor').inputValue()).toBe(inEditor);
    });
  }
});

test.describe('UI-003: ショートカット一覧が実際の挙動と合っている', () => {
  test('Delete に「Gantt のみ」と書かれていない', async ({ page }) => {
    await open(page, 'gantt');
    await page.keyboard.press('?');
    await page.waitForTimeout(500);
    const row = page.locator('#shortcut-help-table tr', { hasText: 'Delete' }).first();
    await expect(row).toBeVisible();
    await expect(row).not.toContainText('Gantt のみ');
  });
});

test.describe('UI-008: 追加とエディタにキーボードから入れる', () => {
  // 追加は一番よく使う操作なのに、欄へ入る手段がマウスのクリックしか無かった。
  // Enter での確定は既にできるので、入口の1クリックだけがキーボード完結を
  // 止めていた。1日100回足すなら100往復。
  for (const [type, expected] of [
    ['gantt', 'prop-add-label'],
    ['flowchart', 'fc-add-node-id'],
    ['classDiagram', 'cl-add-class-id'],
    ['kanban', 'kb-add-col-name'],
  ]) {
    test(type + ': A で追加フォームの先頭欄に入る', async ({ page }) => {
      await open(page, type);
      await page.evaluate(() => {
        const pane = document.getElementById('preview-pane');
        if (pane) { pane.setAttribute('tabindex', '-1'); pane.focus(); }
      });
      await page.keyboard.press('a');
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe(expected);
    });
  }

  test('E でエディタに入る', async ({ page }) => {
    await open(page, 'flowchart');
    await page.evaluate(() => {
      const pane = document.getElementById('preview-pane');
      if (pane) { pane.setAttribute('tabindex', '-1'); pane.focus(); }
    });
    await page.keyboard.press('e');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('editor');
  });

  test('エディタと入力欄では a / e が文字として入る', async ({ page }) => {
    await open(page, 'flowchart');
    // エディタ
    await page.locator('#editor').focus();
    const before = await page.locator('#editor').inputValue();
    await page.keyboard.type('ae');
    expect(await page.locator('#editor').inputValue()).toBe(before + 'ae');
    // 追加フォームの入力欄
    await page.locator('#fc-add-node-id').focus();
    await page.keyboard.type('ae');
    await expect(page.locator('#fc-add-node-id')).toHaveValue('ae');
  });

  test('A で入った欄から Enter まで、マウスを使わずに追加できる', async ({ page }) => {
    await open(page, 'flowchart');
    const before = await page.locator('#editor').inputValue();
    await page.evaluate(() => {
      const pane = document.getElementById('preview-pane');
      if (pane) { pane.setAttribute('tabindex', '-1'); pane.focus(); }
    });
    await page.keyboard.press('a');
    await page.waitForTimeout(250);
    await page.keyboard.type('KBD1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    const after = await page.locator('#editor').inputValue();
    expect(after).not.toBe(before);
    expect(after).toContain('KBD1');
  });

  test('ショートカット一覧に A と E が載っている', async ({ page }) => {
    await open(page, 'gantt');
    await page.keyboard.press('?');
    await page.waitForTimeout(500);
    const table = page.locator('#shortcut-help-table');
    await expect(table).toContainText('追加フォームの先頭欄へ移動');
    await expect(table).toContainText('エディタへ移動');
  });
});
