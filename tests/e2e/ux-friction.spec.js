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

test.describe('UI-011: パネルに続きがあることが画面から分かる', () => {
  // 13インチのノートPC (1366x768) では 21図種中15図種でパネルが画面に収まらない
  // (flowchart は 320px はみ出す)。スクロールバーは実測で幅0だったので、
  // 続きがあることを示すものが画面に1つも無かった。
  //
  // パネルの構成そのものを変える案 (折り畳み見出し / タブ分割) は GUI の
  // 作り替えなので合意が要る。ここでは「続きがある」ことを告げるだけ。
  test.use({ viewport: { width: 1366, height: 768 } });

  test('はみ出している図種では帯が出る', async ({ page }) => {
    await open(page, 'flowchart');
    const over = await page.evaluate(() => {
      const el = document.getElementById('props-content');
      return el.scrollHeight - el.clientHeight;
    });
    expect(over).toBeGreaterThan(4);
    await expect(page.locator('#props-more')).toBeVisible();
  });

  test('一番下まで送ると帯が消える', async ({ page }) => {
    await open(page, 'flowchart');
    await expect(page.locator('#props-more')).toBeVisible();
    await page.evaluate(() => {
      const el = document.getElementById('props-content');
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(300);
    await expect(page.locator('#props-more')).toBeHidden();
  });

  test('帯が中身に重ならない', async ({ page }) => {
    await open(page, 'flowchart');
    const overlap = await page.evaluate(() => {
      const el = document.getElementById('props-content');
      const hint = document.getElementById('props-more');
      const cr = el.getBoundingClientRect();
      const hr = hint.getBoundingClientRect();
      let n = 0;
      el.querySelectorAll('*').forEach((x) => {
        const r = x.getBoundingClientRect();
        if (r.height <= 0) return;
        if (r.top < cr.top - 1 || r.bottom > cr.bottom + 1) return;   // 窓の外
        if (r.bottom > hr.top + 1 && r.top < hr.bottom - 1) n++;
      });
      return n;
    });
    expect(overlap).toBe(0);
  });

  test('収まっている図種では帯が出ない (狼少年にしない)', async ({ page }) => {
    // 21図種のうち6図種は 1366x768 に収まる。そこで帯が出ると合図として働かなくなる。
    await page.goto(HTML_URL);
    await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
    const types = await page.locator('#diagram-type option').evaluateAll((os) => os.map((o) => o.value));
    let fits = 0;
    for (const t of types) {
      await page.locator('#diagram-type').selectOption(t);
      await page.waitForTimeout(1200);
      const r = await page.evaluate(() => {
        const el = document.getElementById('props-content');
        const h = document.getElementById('props-more');
        return { over: el.scrollHeight - el.clientHeight, shown: !h.hidden };
      });
      if (r.over <= 4) { fits++; expect(r.shown, t + ' は収まっているのに帯が出ている').toBe(false); }
      else { expect(r.shown, t + ' ははみ出しているのに帯が出ていない').toBe(true); }
    }
    expect(fits).toBeGreaterThan(0);
  });
});

test.describe('UI-013: 本文を編集しても追加フォームの書きかけが消えない', () => {
  // パネルは毎回 innerHTML を作り直すので、書きかけの追加フォームが消えていた。
  // 実測: 「WIP」と入れてからエディタに1文字打つと空になり、
  // 打鍵の途中で再描画が挟まると先頭の文字も落ちた (「ae」→「e」)。
  //
  // ただし「+追加」の直後は空になるのが正しい。そこで書き戻すと、
  // 同じ要素をもう一度足しかねない。引き金で区別する。
  test('エディタを編集しても書きかけが残る', async ({ page }) => {
    await open(page, 'flowchart');
    await page.locator('#fc-add-node-id').fill('WIP');
    await page.locator('#editor').focus();
    await page.keyboard.type('  %% メモ');
    await page.waitForTimeout(1500);
    await expect(page.locator('#fc-add-node-id')).toHaveValue('WIP');
  });

  test('打鍵の途中で再描画が挟まっても文字が落ちない', async ({ page }) => {
    await open(page, 'flowchart');
    await page.locator('#editor').focus();
    await page.keyboard.type('X');
    await page.locator('#fc-add-node-id').focus();
    await page.keyboard.type('ae');
    await page.waitForTimeout(1600);
    await expect(page.locator('#fc-add-node-id')).toHaveValue('ae');
  });

  test('追加ボタンを押したあとは空になる (書き戻さない)', async ({ page }) => {
    await open(page, 'flowchart');
    await page.locator('#fc-add-node-id').fill('NEW1');
    await page.locator('#fc-add-node-btn').click();
    await page.waitForTimeout(1400);
    await expect(page.locator('#fc-add-node-id')).toHaveValue('');
    expect(await page.locator('#editor').inputValue()).toContain('NEW1');
  });

  test('図種を切り替えたら持ち越さない (R15 を壊していない)', async ({ page }) => {
    await open(page, 'flowchart');
    await page.locator('#fc-add-node-id').fill('ZZ持ち越しZZ');
    await page.locator('#diagram-type').selectOption('classDiagram');
    await page.waitForTimeout(1700);
    await page.locator('#diagram-type').selectOption('flowchart');
    await page.waitForTimeout(1700);
    await expect(page.locator('#fc-add-node-id')).toHaveValue('');
  });
});

test.describe('kanban: 図をクリックして選べる', () => {
  // 「mermaid が DSL の id を SVG に出さないので入れない」という判断で
  // 11図種まとめて重ね合わせを見送っていたが、kanban は当てはまらなかった。
  //   列  → <g class="cluster" id="設計 中">  … 列名そのもの
  //   札  → <g class="node" id="t1">          … DSL の id (無ければ本文)
  // どちらも順序に依らない。見送りの理由が全図種に当てはまるかを
  // 確かめずに一括りにしていた。
  test('列と札に当たり判定が出る', async ({ page }) => {
    await open(page, 'kanban');
    const hits = await page.locator('#overlay-layer [data-element-id]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('data-element-id')));
    expect(hits).toContain('Todo');
    expect(hits).toContain('InProgress');
    expect(hits).toContain('Done');
    expect(hits.length).toBe(7);   // 列3 + 札4
  });

  test('列を押すと列が選ばれる (札に取られない)', async ({ page }) => {
    // 列の枠は札の上に重なって見えるので、枠全体を当たり判定にすると
    // 列を押したつもりで札が選ばれる (実測した)。列は見出しの帯だけをつかむ。
    await open(page, 'kanban');
    await page.locator('#overlay-layer [data-element-id="Todo"]').click({ force: true });
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => window.MA.selection.getSelected()))
      .toEqual([{ type: 'column', id: 'Todo' }]);
  });

  test('札を押すと札が選ばれる', async ({ page }) => {
    await open(page, 'kanban');
    await page.locator('#overlay-layer [data-element-id="__c_0"]').click({ force: true });
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => window.MA.selection.getSelected()))
      .toEqual([{ type: 'card', id: '__c_0' }]);
  });

  test('id 付きの札も図から選べる', async ({ page }) => {
    await open(page, 'kanban');
    await setText(page, 'kanban\n    設計 中\n        t1[やること]\n    レビュー待ち\n        t2[確認]\n');
    await page.waitForTimeout(1500);
    const hits = await page.locator('#overlay-layer [data-element-id]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('data-element-id')));
    expect(hits).toContain('t1');
    expect(hits).toContain('t2');
    await page.locator('#overlay-layer [data-element-id="t2"]').click({ force: true });
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => window.MA.selection.getSelected()))
      .toEqual([{ type: 'card', id: 't2' }]);
  });
});
