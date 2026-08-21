'use strict';
// R21 画面に見えているか: 操作に必要なものが、実利用の画面で見つかるか。
//
// この観点は「測定条件そのものが甘かった」ところから出た。
//
// UI-011 を最初 1500x950 で測って「8/21図種・Minor」と判定した。
// 13インチのノートPC (1366x768) で測り直すと **15/21図種**、flowchart は
// 320px はみ出していた。**観点が足りなかったのではなく、測る場所が実利用と
// 違っていた**。指摘が出ないのは、出ない条件で測っているからかもしれない。
//
// しかも既存の20観点は誰もこの形を見ていなかった。全部を 1366x768 に揃えて
// 走らせ直しても 0件のままだった。「画面に収まっているか」という述語が
// どこにも無かったからで、条件を変えるだけでは足りない。
//
// 見るもの:
//   V1 操作に必要なもの (追加ボタン / 入力欄) がパネルの見える範囲にあるか
//   V2 収まらない場合、続きがあることが画面から分かるか
//   V3 その合図が中身に重なっていないか
//   V4 一番下まで送ったら合図が消えるか (出しっぱなしは合図として働かない)
const path = require('path');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { report } = require('./lib');
const ROOT = process.argv[2];

// 実利用の画面。13インチのノートPC が一番小さい常用環境。
const VIEWPORT = { width: 1366, height: 768 };

const HTML = 'file:///' + path.resolve(ROOT, 'mermaid-assist.html').split(path.sep).join('/');

(async () => {
  const findings = [];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VIEWPORT.width, height: VIEWPORT.height } });
  await p.goto(HTML);
  await p.waitForSelector('#preview-svg svg', { timeout: 20000 });
  const types = await p.locator('#diagram-type option').evaluateAll((os) => os.map((o) => o.value));
  const examined = new Set();

  for (const t of types) {
    await p.locator('#diagram-type').selectOption(t);
    await p.waitForTimeout(1300);
    examined.add(t);

    const r = await p.evaluate(() => {
      const el = document.getElementById('props-content');
      const hint = document.getElementById('props-more');
      if (!el) return null;
      const cr = el.getBoundingClientRect();
      const over = el.scrollHeight - el.clientHeight;

      // 見えている範囲にある要素だけを数える。
      // 窓の外にある要素の矩形も getBoundingClientRect は返すので、
      // それを数えると重なっていないものまで重なりに見える。
      const visible = (x) => {
        const r2 = x.getBoundingClientRect();
        return r2.height > 0 && r2.top >= cr.top - 1 && r2.bottom <= cr.bottom + 1;
      };
      const btns = Array.from(el.querySelectorAll('button')).filter((x) => /追加|\+/.test(x.textContent || ''));
      const hiddenBtns = btns.filter((x) => !visible(x)).map((x) => (x.textContent || '').trim().slice(0, 12));

      let overlap = 0;
      if (hint && !hint.hidden) {
        const hr = hint.getBoundingClientRect();
        el.querySelectorAll('*').forEach((x) => {
          if (!visible(x)) return;
          const r2 = x.getBoundingClientRect();
          if (r2.bottom > hr.top + 1 && r2.top < hr.bottom - 1) overlap++;
        });
      }
      return {
        over: over,
        hintShown: !!(hint && !hint.hidden),
        hiddenBtns: hiddenBtns,
        totalBtns: btns.length,
        overlap: overlap,
      };
    });
    if (!r) continue;

    // V1: 追加ボタンが見える範囲に無い = マウスで探さないと機能の存在すら分からない
    if (r.hiddenBtns.length) {
      // 収まらないこと自体はパネル構成の問題 (合意が要る) なので、
      // ここでは「続きがあると分かるか」を必須にする。分かるなら指摘にしない。
      if (!r.hintShown) {
        findings.push({ module: t, fn: 'V1 見える範囲',
          what: '追加ボタン ' + r.hiddenBtns.length + '/' + r.totalBtns +
                ' が見える範囲に無く、続きがある合図も出ていない (' + r.hiddenBtns.join(',') + ')' });
      }
    }
    // V2: はみ出しているのに合図が無い
    if (r.over > 4 && !r.hintShown) {
      findings.push({ module: t, fn: 'V2 続きの合図',
        what: 'パネルが ' + r.over + 'px はみ出しているのに、続きがあることが画面から分からない' });
    }
    // V2': 収まっているのに合図が出ている (狼少年になる)
    if (r.over <= 4 && r.hintShown) {
      findings.push({ module: t, fn: 'V2 続きの合図',
        what: '収まっているのに「続きがあります」が出ている (合図として働かなくなる)' });
    }
    // V3: 合図が中身に重なる
    if (r.overlap > 0) {
      findings.push({ module: t, fn: 'V3 重なり',
        what: '続きの合図が中身に重なって ' + r.overlap + ' 要素が読めない' });
    }

    // V4: 一番下まで送ったら合図が消えるか
    if (r.over > 4) {
      await p.evaluate(() => {
        const el = document.getElementById('props-content');
        el.scrollTop = el.scrollHeight;
        el.dispatchEvent(new Event('scroll'));
      });
      await p.waitForTimeout(250);
      const still = await p.evaluate(() => {
        const h = document.getElementById('props-more');
        return !!(h && !h.hidden);
      });
      if (still) {
        findings.push({ module: t, fn: 'V4 合図の解除',
          what: '一番下まで送っても「続きがあります」が消えない' });
      }
      await p.evaluate(() => {
        const el = document.getElementById('props-content');
        el.scrollTop = 0;
        el.dispatchEvent(new Event('scroll'));
      });
    }
  }

  await b.close();
  console.log('  (測定条件: ' + VIEWPORT.width + 'x' + VIEWPORT.height + ' — 13インチのノートPC)');
  report('r21-reachable', findings, { examined: examined.size, total: 21 });
})();
