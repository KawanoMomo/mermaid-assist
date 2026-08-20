'use strict';
// R7 一貫性 / 発見可能性: 21図種のプロパティ欄を横に並べて、
// **同じ概念が同じ操作・同じ語で出ているか**を見る。
//
// これまでのレビュアーは「壊れているか」を図種ごとに縦に見ていた。
// 横に並べないと見えない欠陥がある。ある図種では消せるのに別の図種では
// 消せない、同じ働きのボタンが図種ごとに違う語で出ている、といったもの。
// ヘビーユーザは図種をまたいで1日に何十回も往復するので、ここのゆれは
// 「毎回考え直す」コストとして効いてくる。
const path = require('path');
const { chromium } = require('E:/00_Git/05_MermaidAssist/node_modules/playwright');
const { report } = require('./lib');
const ROOT = process.argv[2];
const HTML = 'file:///' + path.resolve(ROOT, 'mermaid-assist.html').split(path.sep).join('/');

const TYPES = ['gantt', 'sequenceDiagram', 'flowchart', 'stateDiagram', 'classDiagram',
  'erDiagram', 'requirementDiagram', 'block-beta', 'timeline', 'mindmap', 'gitGraph',
  'pie', 'journey', 'quadrantChart', 'xychart-beta', 'sankey-beta', 'C4Context',
  'packet-beta', 'architecture-beta', 'kanban', 'radar-beta'];

// 同じ働きに対して使ってよい語をひとつに決める。ゆれたら指摘。
const CANON = [
  { concept: '削除', words: ['削除', '消す', '除去', 'クリア', '取り除'] },
  { concept: '追加', words: ['追加', '新規', '作成', '足す'] },
  { concept: '上へ', words: ['上へ', '上に', '↑'] },
  { concept: '下へ', words: ['下へ', '下に', '↓'] },
  { concept: '接続', words: ['接続', 'つなぐ', '線を引く', 'リンク'] },
];

(async () => {
  const findings = [];
  const b = await chromium.launch();
  const dump = {};

  for (const t of TYPES) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('dialog', d => d.accept());
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await p.waitForTimeout(500);
    if (t !== 'gantt') { await p.locator('#diagram-type').selectOption(t); await p.waitForTimeout(1600); }
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);

    // 一覧は「何も選んでいない状態」に出る。選ぶと編集画面に切り替わるので、
    // 選択より前に数えないと、全図種で0件に見える (最初それで誤検出した)。
    const listRowsBefore = await p.evaluate(() =>
      document.querySelectorAll('#props-content .ma-list-row').length);

    // 図の上から1つ選ぶ。選べない図種はオーバーレイ非対応 (E2 で見送り済み) なので
    // 一覧側から選ぶ経路にも回して、どちらでも選べない場合だけ記録する。
    let picked = false;
    const hit = p.locator('#overlay-layer [data-element-id], #overlay-layer .overlay-bar').first();
    if (await hit.count()) { await hit.click({ force: true }); await p.waitForTimeout(700); picked = true; }
    if (!picked || !(await p.locator('#props-content button').count())) {
      const row = p.locator('#props-content [data-element-id], #props-content li, #props-content .list-row').first();
      if (await row.count()) { await row.click({ force: true }); await p.waitForTimeout(600); }
    }

    const info = await p.evaluate(() => {
      const root = document.getElementById('props-content');
      const btns = [...root.querySelectorAll('button')].map(x => ({
        id: x.id || '',
        text: (x.textContent || '').trim(),
        title: x.getAttribute('title') || '',
        aria: x.getAttribute('aria-label') || '',
      }));
      const labels = [...root.querySelectorAll('label')].map(x => (x.textContent || '').trim());
      const fields = [...root.querySelectorAll('input,select,textarea')].map(x => ({
        id: x.id || '', type: x.tagName.toLowerCase(),
      }));
      return { btns, labels, fields, empty: root.textContent.trim().length === 0 };
    });
    info.listRows = listRowsBefore;
    dump[t] = info;
    await p.close();
  }

  await b.close();

  // K1 要素を選んでも編集手段が出ない図種
  Object.keys(dump).forEach((t) => {
    const d = dump[t];
    if (d.empty) findings.push({ module: t, fn: 'K1 編集手段', what: 'プロパティ欄が空のまま' });
    else if (d.btns.length === 0 && d.fields.length === 0) {
      findings.push({ module: t, fn: 'K1 編集手段', what: '選んでもボタンも入力欄も出ない' });
    }
  });

  // K7 入口の揃い: どの図種でも「一覧 → 選択 → 編集」が同じ位置に出ること。
  //
  // gantt だけ一覧が無く、タスクを選ぶ手段がチャート上のバーだけだった。
  // 図種をまたぐたびに入口を探し直すのは、熟達しても速くならない設計。
  Object.keys(dump).forEach((t) => {
    if (!dump[t].listRows) {
      findings.push({ module: t, fn: 'K7 入口',
        what: '要素の一覧が出ない (他の図種にはある)' });
    }
  });

  // K2 語のゆれ: ひとつの概念に複数の語が使われていたら指摘
  CANON.forEach((c) => {
    const used = {};
    Object.keys(dump).forEach((t) => {
      dump[t].btns.forEach((x) => {
        const s = x.text + ' ' + x.title + ' ' + x.aria;
        c.words.forEach((w) => {
          // ↑↓ のような記号はアイコンであって語ではない。語のゆれだけを数える。
          if (/^[↑↓+]+$/.test(w)) return;
          if (s.indexOf(w) >= 0) { (used[w] = used[w] || []).push(t); }
        });
      });
    });
    const variants = Object.keys(used);
    if (variants.length > 1) {
      findings.push({ module: '横断', fn: 'K2 用語',
        what: c.concept + ' に ' + variants.length + '通りの語: ' +
          variants.map(w => w + '(' + used[w].slice(0, 3).join(',') + ')').join(' / ') });
    }
  });

  // K3 は削除した。
  //
  // 最初は「ボタンidの接頭辞が揃っていない」を指摘した。それは存在しない規約だった
  // (接頭辞は図種ごとで設計どおり)。次に「接尾辞=役割」を検査したが、静的に数えると
  // 役割を持つ 51 個のうち 46 個が外れており、こちらも規約ではなかった。
  // 実態は `<module>-<role>-<thing>` で role が中間に来る形が多数派で、横断規約は
  // 元から無い。そして id は利用者に見えない。UI/UX のレビュアーが id の命名を
  // 指摘するのは筋が違うので、この観点は落とし、エラー回復 (K6) に差し替えた。
  // 「規約違反」を数える前に、その規約が実在するかを確かめること。

  // K4 上下移動が片方だけ
  Object.keys(dump).forEach((t) => {
    const s = dump[t].btns.map(x => x.text + x.title + x.aria).join(' ');
    const up = /上へ|上に|↑/.test(s), down = /下へ|下に|↓/.test(s);
    if (up !== down) {
      findings.push({ module: t, fn: 'K4 並び替え',
        what: (up ? '上へ' : '下へ') + ' だけがあり、逆方向が無い' });
    }
  });

  // K5 発見可能性: 文字を持たないボタンに title も aria-label も無い
  Object.keys(dump).forEach((t) => {
    dump[t].btns.forEach((x) => {
      const bare = x.text.replace(/[\s×✕✖＋+↑↓]/g, '') === '';
      if (bare && !x.title && !x.aria) {
        findings.push({ module: t, fn: 'K5 発見可能性',
          what: '記号だけのボタンに説明が無い: id=' + (x.id || '(idなし)') + ' text="' + x.text + '"' });
      }
    });
  });


  // K6 エラー回復: 削除は必ず Undo 1回で戻せること。
  //
  // 図種ごとに削除の実装が違うので、「pushHistory を呼び忘れた図種」が出うる。
  // 呼び忘れると、消えた要素は二度と戻らない。テストは各モジュールの delete を
  // 単体で見ているだけで、**UI の削除ボタンが履歴に積むか**は見ていなかった。
  const b2 = await chromium.launch();
  for (const t of TYPES) {
    const p = await b2.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('dialog', d => d.accept());
    await p.goto(HTML);
    await p.waitForSelector('#preview-svg svg', { timeout: 20000 });
    await p.waitForTimeout(500);
    if (t !== 'gantt') { await p.locator('#diagram-type').selectOption(t); await p.waitForTimeout(1600); }
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);

    const before = await p.locator('#editor').inputValue();
    // 一覧行の削除ボタン (クラス指定) を1つ押す。どの図種にも一覧はある。
    const del = p.locator('#props-content button[class*="del"], #props-content button[title*="削除"]').first();
    if (!(await del.count())) {
      findings.push({ module: t, fn: 'K6 エラー回復', what: '一覧から削除する手段が見つからない' });
      await p.close();
      continue;
    }
    await del.click({ force: true });
    await p.waitForTimeout(900);
    const after = await p.locator('#editor').inputValue();
    if (after === before) {
      findings.push({ module: t, fn: 'K6 エラー回復', what: '削除を押しても本文が変わらない' });
      await p.close();
      continue;
    }
    await p.evaluate(() => window.MA.history.undo());
    await p.waitForTimeout(700);
    const back = await p.locator('#editor').inputValue();
    if (back !== before) {
      findings.push({ module: t, fn: 'K6 エラー回復',
        what: '削除を Undo 1回で戻せない (履歴に積んでいない可能性)' });
    }
    await p.close();
  }
  await b2.close();

  report('r7-consistency', findings);
})();
