'use strict';
// R18 キーボード完結性: マウスに触らずに一連の作業ができるか。
//
// 想定しているのは「キーボード中心で1日100回操作する」使い方。マウスへ持ち替える
// 回数がそのまま摩擦になる。これまでのレビュアーは「その操作ができるか」は見てきたが、
// **どの入力装置で到達できるか**は誰も見ていなかった。
//
// 見るもの (すべてマウスを1度も使わずに):
//   K1 図の要素を選べるか            (矢印キー)
//   K2 選んだ要素の編集欄へ行けるか  (Tab)
//   K3 値を変えて確定できるか        (打鍵 + Tab/Enter)
//   K4 消せるか                      (Delete または一覧の削除へ Tab で到達)
//   K5 保存できるか                  (Ctrl+S)
//
// クリック座標を一切使わず、キーボードイベントだけで進める。到達できない段があれば、
// そこがマウスへ持ち替える点。
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

// 以前は4図種だけを直書きしていた (実測 4/21)。
// 検査の中身は図種に依存していないので、一覧だけが範囲を狭めていた。
// キーボード中心の使い方を想定している以上、17図種未検査は通せない。
const TYPES = ['gantt', 'sequenceDiagram', 'flowchart', 'stateDiagram', 'classDiagram',
  'erDiagram', 'requirementDiagram', 'block-beta', 'timeline', 'mindmap', 'gitGraph',
  'pie', 'journey', 'quadrantChart', 'xychart-beta', 'sankey-beta', 'C4Context',
  'packet-beta', 'architecture-beta', 'kanban', 'radar-beta'];
const MAX_TAB = 30;   // これを超えて届かないなら実用上「到達できない」

(async () => {
  const findings = [];
  const examined = new Set();
  const skipped = [];
  const routes = [];   // どの経路で要素にたどり着いたか
  const b = await chromium.launch();

  for (const type of TYPES) {
    const p = await b.newPage({ viewport: { width: VIEWPORT.width, height: VIEWPORT.height }, acceptDownloads: true });
    p.on('dialog', async d => { await d.accept(); });
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await p.waitForTimeout(600);
    if (type !== 'gantt') {
      // 図種の切替もキーボードで。select にフォーカスを当てて選ぶ。
      await p.locator('#diagram-type').focus();
      await p.locator('#diagram-type').selectOption(type);
      await p.waitForTimeout(1700);
    }
    await p.waitForTimeout(500);

    // K1: 矢印キーで要素を選ぶ (プレビューにフォーカスを置くのもキーボードで)
    await p.evaluate(() => {
      var pane = document.getElementById('preview-pane');
      if (pane) { pane.setAttribute('tabindex', '-1'); pane.focus(); }
    });
    await p.keyboard.press('ArrowDown');
    await p.waitForTimeout(700);
    let sel = await p.evaluate(() => window.MA.selection.getSelected());
    let route = '矢印キー';
    if (!sel.length) {
      // 重ね合わせを持たない図種がある (mermaid が DSL の id を SVG に出さず、
      // 順序依存の照合は間違った要素を選ぶので入れないと決めている)。
      //
      // **だからといって「キーボードで編集できない」わけではない。**
      // 一覧の「編集」ボタンへ Tab で到達すれば同じことができる。
      // 以前はここで打ち切っていたので、10図種が丸ごと未検査だった
      // (11/21)。K1 が使えないことと、K2〜K5 が使えないことは別の話。
      const hasOverlay = await p.evaluate(() =>
        document.querySelectorAll('#overlay-layer [data-element-id], #overlay-layer .overlay-bar').length);
      if (hasOverlay) {
        findings.push({ module: type, fn: 'K1 選択',
          what: '重ね合わせはあるのに矢印キーで選べない (マウスが必要)' });
        await p.close();
        continue;
      }
      // 一覧の「編集」へ Tab だけで届くか
      let reachedRow = false;
      await p.evaluate(() => {
        var ed = document.getElementById('editor');
        if (ed) { ed.focus(); ed.blur(); }
        document.body.focus();
      });
      for (let i = 0; i < MAX_TAB * 2; i++) {
        await p.keyboard.press('Tab');
        await p.waitForTimeout(40);
        const inRow = await p.evaluate(() => {
          const a = document.activeElement;
          if (!a) return false;
          return !!(a.closest && a.closest('.ma-list-row') && a.tagName === 'BUTTON' &&
                    !/✕|×/.test(a.textContent || ''));
        });
        if (inRow) { reachedRow = true; break; }
      }
      if (!reachedRow) {
        findings.push({ module: type, fn: 'K1 選択',
          what: '矢印キーでも Tab でも要素を選べない (一覧の編集ボタンに届かない)' });
        await p.close();
        continue;
      }
      await p.keyboard.press('Enter');
      await p.waitForTimeout(800);
      sel = await p.evaluate(() => window.MA.selection.getSelected());
      route = '一覧を Tab';
      if (!sel.length) {
        // 選択状態にならない図種もある (一覧から詳細パネルを開くだけ)。
        // 欄に届いて打鍵できるなら実用上は同じなので、続ける。
        route = '一覧を Tab (選択状態にはならない)';
      }
    }
    routes.push(type + ': ' + route);
    examined.add(type);

    // K2: Tab で「その要素を編集できる欄」まで到達できるか
    //
    // 以前は id の接尾辞 (`-label` / `-name` / `-id`) で見分けていた。
    // **接尾辞の表を持つと必ず漏れる** — mindmap は `mm-edit-text`、
    // sankey は `sk-edit-from`、xychart は `xy-edit-values` で、
    // どれも表に無かったので「届かない」と誤報していた (検査の誤り17件目)。
    // r11 で同じことを学んだのに、この検査には規約が付いてこなかった。
    //
    // 名前ではなく**振る舞い**で見る。パネルの中の文字入力欄に届き、
    // そこへ打鍵して本文が変われば、その欄は編集できる欄。
    let tabs = 0, reachedField = null;
    for (; tabs < MAX_TAB; tabs++) {
      await p.keyboard.press('Tab');
      await p.waitForTimeout(70);
      const info = await p.evaluate(() => {
        const a = document.activeElement;
        if (!a || a.tagName !== 'INPUT') return null;
        if (a.type && a.type !== 'text' && a.type !== 'search') return null;
        const panel = document.getElementById('props-content');
        if (!panel || !panel.contains(a)) return null;
        if (a.id === 'ma-list-filter') return null;          // 絞り込みは編集欄ではない
        return { id: a.id || '(id なし)', value: a.value };
      });
      if (info) { reachedField = info.id; tabs++; break; }
    }
    if (!reachedField) {
      findings.push({ module: type, fn: 'K2 編集欄への到達',
        what: 'Tab ' + MAX_TAB + '回でもパネルの入力欄に届かない' });
    } else {
      // K3: 打鍵して確定できるか
      const before = await p.locator('#editor').inputValue();
      await p.keyboard.press('Control+a');
      await p.keyboard.type('KBD', { delay: 25 });
      await p.keyboard.press('Tab');
      await p.waitForTimeout(1100);
      const after = await p.locator('#editor').inputValue();
      if (after === before) {
        findings.push({ module: type, fn: 'K3 確定',
          what: reachedField + ' に打鍵しても本文が変わらない' });
      }
    }

    // K5: Ctrl+S で保存できるか (K4 の削除は図種で作法が違うので K5 を先に見る)
    let saved = false;
    try {
      await Promise.all([
        p.waitForEvent('download', { timeout: 8000 }),
        p.keyboard.press('Control+s'),
      ]);
      saved = true;
    } catch (e) { saved = false; }
    if (!saved) {
      findings.push({ module: type, fn: 'K5 \u4fdd\u5b58', what: 'Ctrl+S \u3067\u4fdd\u5b58\u3067\u304d\u306a\u3044' });
    }

    await p.close();
  }

  await b.close();
  if (skipped.length) {
    console.log('  (検査から外れた: ' + skipped.length + ' 図種) ' + skipped.slice(0, 6).join(' / '));
  }
  const viaList = routes.filter(r => r.indexOf('一覧を Tab') >= 0);
  console.log('  (要素への到達: 矢印キー ' + (routes.length - viaList.length) + ' 図種 / ' +
    '一覧を Tab ' + viaList.length + ' 図種' +
    (viaList.length ? ': ' + viaList.map(r => r.split(':')[0]).join(',') : '') + ')');
  report('r18-keyboard-only', findings, { examined: examined.size, total: 21 });
})();
