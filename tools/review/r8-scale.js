'use strict';
// R8 スケール耐性: 要素が 10倍・50倍になったときに壊れる操作を探す。
//
// これまでのレビュアーは全部テンプレート (要素5〜8個) を相手にしていた。
// 実務の図はそのサイズでは終わらない。ヘビーユーザは数十〜数百要素の図を
// 毎日触るので、**そこで初めて壊れるもの**が本番で出る欠陥になる。
//
// 見るもの:
//   - 一覧・オーバーレイが要素を取りこぼさないか (件数の一致)
//   - 100要素の図で、最後の要素を選んで消したときに**それが**消えるか
//     (先頭が消える系の取り違えは、要素が増えるほど当たりやすくなる)
//   - 操作から画面反映までの時間が実用範囲か
const path = require('path');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { report } = require('./lib');
const ROOT = process.argv[2];
// 測定条件も検査対象。
//
// これまで 1400x900 で測っていた。実利用は 13インチのノートPC (1366x768) が
// 普通で、132px 低い。この差でプロパティパネルの収まりが 8/21 → 15/21 に
// 変わっていた (UI-011)。**観点が足りなかったのではなく、測る場所が
// 実利用と違っていた**。指摘が出ないのは、出ない条件で測っているからかもしれない。
const VIEWPORT = { width: 1366, height: 768 };

const HTML = 'file:///' + path.resolve(ROOT, 'mermaid-assist.html').split(path.sep).join('/');

const N = 100;                 // 実務の上限に近い規模
const MAX_MS_RENDER = 8000;    // 本文を差し替えてから描画が終わるまで
const MAX_MS_SELECT = 2500;    // 要素を1つ選ぶ
const MAX_MS_DELETE = 3000;    // 1つ消す

function bigFlowchart(n) {
  const L = ['flowchart TD'];
  for (let i = 0; i < n; i++) L.push('  N' + i + '["ノード' + i + '"]');
  for (let i = 0; i < n - 1; i++) L.push('  N' + i + ' --> N' + (i + 1));
  return L.join('\n');
}
function bigGantt(n) {
  const L = ['gantt', '    dateFormat YYYY-MM-DD', '    title 大規模', '    section 本体'];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i));
    L.push('    タスク' + i + ' :t' + i + ', ' + d.toISOString().slice(0, 10) + ', 2d');
  }
  return L.join('\n');
}
function bigClass(n) {
  const L = ['classDiagram'];
  for (let i = 0; i < n; i++) L.push('  class C' + i + ' {\n    +int f' + i + '\n  }');
  for (let i = 0; i < n - 1; i++) L.push('  C' + i + ' --> C' + (i + 1));
  return L.join('\n');
}
function bigSequence(n) {
  const L = ['sequenceDiagram'];
  for (let i = 0; i < n; i++) L.push('  participant P' + i);
  for (let i = 0; i < n - 1; i++) L.push('  P' + i + '->>P' + (i + 1) + ': m' + i);
  return L.join('\n');
}

const CASES = [
  { type: 'flowchart', text: bigFlowchart(N), last: 'N' + (N - 1) },
  { type: 'gantt', text: bigGantt(N), last: 't' + (N - 1) },
  { type: 'classDiagram', text: bigClass(N), last: 'C' + (N - 1) },
  { type: 'sequenceDiagram', text: bigSequence(N), last: 'P' + (N - 1) },
];

(async () => {
  const findings = [];
  const b = await chromium.launch();

  for (const c of CASES) {
    const p = await b.newPage({ viewport: { width: VIEWPORT.width, height: VIEWPORT.height } });
    p.on('dialog', d => d.accept());
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await p.waitForTimeout(400);
    if (c.type !== 'gantt') { await p.locator('#diagram-type').selectOption(c.type); await p.waitForTimeout(1500); }

    // 本文を丸ごと差し替える (実務では貼り付けで来る)
    const t0 = Date.now();
    await p.evaluate((txt) => {
      const ed = document.getElementById('editor');
      ed.value = txt;
      ed.dispatchEvent(new Event('input', { bubbles: true }));
    }, c.text);
    await p.waitForFunction(() => !!document.querySelector('#preview-svg svg'),
      null, { timeout: MAX_MS_RENDER + 5000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const renderMs = Date.now() - t0;
    if (renderMs > MAX_MS_RENDER) {
      findings.push({ module: c.type, fn: 'S1 描画',
        what: N + '要素の描画に ' + renderMs + 'ms (上限 ' + MAX_MS_RENDER + ')' });
    }

    // S2 取りこぼし: parse が数えた要素数と、一覧に並ぶ行数が合うか
    const counts = await p.evaluate(() => {
      const mod = window.MA.currentModule ? window.MA.currentModule() : null;
      const txt = document.getElementById('editor').value;
      let parsed = -1;
      try {
        const m = mod || Object.values(window.MA.modules).find(x => x.detect && x.detect(txt));
        parsed = m ? (m.parse(txt).elements || []).length : -1;
      } catch (e) { parsed = -2; }
      const rows = document.querySelectorAll('#props-content [data-line]').length;
      const overlay = document.querySelectorAll('#overlay-layer [data-element-id]').length;
      return { parsed, rows, overlay };
    });
    if (counts.parsed > 0 && counts.rows > 0 && counts.rows < counts.parsed) {
      findings.push({ module: c.type, fn: 'S2 取りこぼし',
        what: '要素 ' + counts.parsed + ' に対し一覧は ' + counts.rows + ' 行しか出ない' });
    }

    // S3 末尾の要素を選べるか (一覧のスクロール / オーバーレイの当たり判定)
    const lastRow = p.locator('#props-content [data-element-id="' + c.last + '"]').first();
    if (await lastRow.count()) {
      const t1 = Date.now();
      await lastRow.scrollIntoViewIfNeeded();
      await lastRow.click({ force: true });
      await p.waitForTimeout(500);
      const ms = Date.now() - t1;
      if (ms > MAX_MS_SELECT) {
        findings.push({ module: c.type, fn: 'S3 末尾選択',
          what: '末尾要素の選択に ' + ms + 'ms (上限 ' + MAX_MS_SELECT + ')' });
      }
    }

    // S3 で行の「編集」を押すと、プロパティ欄は一覧から**その要素の編集画面**へ
    // 切り替わる。一覧に戻さずに削除ボタンを探すと当然見つからず、最初これを
    // 「削除ボタンに辿り着けない」という欠陥として報告してしまった。
    // レビュアー側の順序の誤りで、製品の欠陥ではない。
    await p.keyboard.press('Escape');
    await p.waitForTimeout(700);

    // S4 規模が大きいときに「押した要素」が消えるか。
    // 取り違えは要素が多いほど起きやすく、かつ気付きにくい。
    // 削除ボタンは行と同じ data-element-id を持つ (listItemHtml が両方に付ける)。
    // 最初は title で引こうとしたが、title は「<ラベル>」を削除 でありラベルは
    // 表示名 (ノード99) なので id (N99) では当たらない。id で引くのが正しい。
    const delBtn = p.locator('#props-content button[data-element-id="' + c.last + '"][class*="del"], ' +
      '#props-content button[data-element-id="' + c.last + '"][class*="Del"]').first();
    const beforeTxt = await p.locator('#editor').inputValue();
    if (await delBtn.count()) {
      const t2 = Date.now();
      await delBtn.scrollIntoViewIfNeeded();
      await delBtn.click({ force: true });
      await p.waitForTimeout(900);
      const ms = Date.now() - t2;
      const afterTxt = await p.locator('#editor').inputValue();
      if (afterTxt === beforeTxt) {
        findings.push({ module: c.type, fn: 'S4 大規模削除', what: '末尾要素の削除が効かない' });
      } else {
        // 消えたのが「押した要素」であること。ほかの要素が減っていたら取り違え。
        const gone = [];
        for (let i = 0; i < N; i++) {
          const id = c.last.replace(/\d+$/, '') + i;
          const re = new RegExp('(^|[^A-Za-z0-9_])' + id + '([^A-Za-z0-9_]|$)');
          if (re.test(beforeTxt) && !re.test(afterTxt)) gone.push(id);
        }
        if (gone.length !== 1 || gone[0] !== c.last) {
          findings.push({ module: c.type, fn: 'S4 大規模削除',
            what: c.last + ' を消したのに実際に消えたのは [' + gone.join(',') + ']' });
        }
        if (ms > MAX_MS_DELETE) {
          findings.push({ module: c.type, fn: 'S4 大規模削除',
            what: '1件の削除に ' + ms + 'ms (上限 ' + MAX_MS_DELETE + ')' });
        }
      }
    } else {
      findings.push({ module: c.type, fn: 'S4 大規模削除',
        what: '末尾要素 ' + c.last + ' の削除ボタンに辿り着けない' });
    }

    await p.close();
  }

  await b.close();
  report('r8-scale', findings, { examined: CASES.length, total: 21 });
})();
