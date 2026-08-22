'use strict';
// バックログ (G区分) の**前提**が今も成り立っているか。
//
// G区分は「やらないが捨てていない」項目で、それぞれに
// 「なぜここにあるか」= **先送りしてよい理由** が書いてある。
// 理由が崩れたら、その項目は先送りできない。
//
// ところが、崩れたことを**誰も監視していなかった**。
//
//   G4 は「契約経由で `add` を呼ぶのは検査とテストだけ」を理由に先送りし、
//   復活条件を「契約経由で add を呼ぶ経路を作る時点」と書いた。
//   **その経路は、6ラウンド後に私自身が r8 を書き換えたときに作っていた。**
//   気付いたのは、無関係な未確認事項を追いかけた偶然だった。
//
// 棚卸しに書いただけでは、条件の監視は誰もしていない。機械に見張らせる。
//
// 前提は2種類ある。
//   機械が見られるもの  コードの状態 (`move: false` のまま か など)
//   人が決めるもの      「訳す範囲を決める」「案を選ぶ」など価値判断
//
// **人が決めるものは自動化できない。** 待っている事実だけを毎回出す
// (何サイクル待っているかは棚卸しの側に書く)。ここで大事なのは
// **どちらなのかを項目ごとに宣言させる**こと — 宣言が無い項目は FAIL する。
// 宣言が無いまま増えると、また誰も見張らない項目ができる。
const fs = require('fs');
const path = require('path');
const { report } = require('./lib');
const ROOT = process.argv[2];

const read = (rel) => {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return ''; }
};

// 項目ごとの前提。`check` は { ok, detail } を返す。
// `human: true` は「人が決めるまで動かない」= 自動判定しない。
const PREMISES = {
  G1: {
    what: 'class / er / state が move: false のまま (実害が出ていない)',
    check: () => {
      const miss = ['class', 'er', 'state'].filter((m) => {
        const s = read('src/modules/' + m + '.js');
        return s.indexOf('move: false') < 0;
      });
      return { ok: miss.length === 0,
        detail: miss.length ? 'move: false が無い: ' + miss.join(',') : '3モジュールとも move: false' };
    },
  },
  G2: {
    what: 'パネル構成の作り替えは MOC の合意が要る',
    human: true,
    check: () => {
      const moc = read('docs/superpowers/specs/2026-08-22-panel-layout-moc.md');
      return { ok: true,
        detail: moc ? '資料あり (案A〜D)・合意待ち' : '**MOC がまだ無い** (資料を作るのは私の仕事)' };
    },
  },
  G3: {
    what: '複写 (Ctrl+C/V) が gantt だけに閉じている',
    human: true,
    check: () => {
      const s = read('src/app.js');
      // 契約経由で全図種に広げると、この分岐は gantt 判定を持たなくなる
      const gantted = /currentModule[\s\S]{0,200}gantt/.test(s) || s.indexOf('Gantt のみ') >= 0;
      return { ok: true, detail: gantted ? 'gantt に閉じたまま・仕様の決め待ち' : '**広がっている可能性** (要確認)' };
    },
  },
  G5: {
    what: '欄名に英語が残っている (訳す範囲は人が決める)',
    human: true,
    check: () => {
      const out = read('tools/review/out/terms.json');
      return { ok: true, detail: out ? 'terms.js が毎回数えている' : 'terms.js が未実行' };
    },
  },
  G6: {
    what: '一覧に仮想化が無い (全行を毎回作る)',
    check: () => {
      const s = read('src/ui/properties.js');
      // 仮想化や上限が入ったらこの前提は崩れる = 項目を見直す契機
      const capped = /slice\(0,\s*\d+\)|maxRows|virtual/i.test(s);
      return { ok: !capped,
        detail: capped ? '一覧に上限か仮想化が入った → G6 を見直す' : '全行を作るまま' };
    },
  },
  G7: {
    what: 'classDiagram と timeline で未知の行が黙って消える (mermaid の挙動)',
    human: true,
    check: () => {
      // 前提は「アプリは捏造していない」= r13 の規約を守っていること。
      // 捏造を始めたら、それは別の欠陥として r13 が捕まえる。
      // mermaid 側が将来エラーを返すようになったら、この項目は不要になる。
      const s2 = read('tools/review/out/r13-unknown-syntax.json');
      return { ok: true,
        detail: s2 ? 'r13 が捏造を見張っている・警告の範囲は人の判断待ち'
                   : 'r13 が未実行' };
    },
  },
  G8: {
    what: 'エッジの端点が絞り込みの無い <select> のまま',
    human: true,
    check: () => {
      // 絞り込み付きの部品 (datalist / combobox) に替わったら、この項目は不要になる。
      const s3 = read('src/modules/flowchart.js') + read('src/ui/properties.js');
      const filtered = /datalist|combobox|role="combobox"/i.test(s3);
      return { ok: true,
        detail: filtered ? '**絞り込み付きに替わった → G8 を見直す**'
                         : '<select> のまま・先頭一致の効きは実機で未測定' };
    },
  },
  G9: {
    what: '書き出しは白で塗り、線は暗いテーマの明るい色のまま',
    human: true,
    check: () => {
      const s4 = read('src/app.js');
      const white = s4.indexOf("ctx.fillStyle = '#ffffff'") >= 0;
      return { ok: true,
        detail: white ? '白で塗るまま・見た目の方針は人の判断待ち'
                      : '**塗りが変わった → G9 を見直す**' };
    },
  },
};

const md = read('docs/backlog.md');
const gSection = md.slice(md.indexOf('## G. バックログ'),
  md.indexOf('## H.') > 0 ? md.indexOf('## H.') : undefined);
const ids = [];
gSection.split('\n').forEach((line) => {
  const m = line.match(/^\|\s*(G\d+)\s*\|/);
  if (m && ids.indexOf(m[1]) < 0) ids.push(m[1]);
});

const findings = [];
const lines = [];
ids.forEach((id) => {
  const row = gSection.split('\n').find(l => l.indexOf('| ' + id + ' |') === 0) || '';
  if (row.indexOf('(解消)') >= 0 || row.indexOf('(不要)') >= 0) {
    lines.push(id + ': 解消済み');
    return;
  }
  const p = PREMISES[id];
  if (!p) {
    findings.push({ module: id, fn: '前提の宣言',
      what: 'この項目には前提の検査が無い。先送りしてよい理由が崩れても誰も気付かない' });
    lines.push(id + ': **前提の検査が無い**');
    return;
  }
  let r;
  try { r = p.check(); } catch (e) { r = { ok: false, detail: '検査が例外: ' + e.message }; }
  if (!r.ok) {
    findings.push({ module: id, fn: '前提が崩れた',
      what: p.what + ' → ' + r.detail });
  }
  lines.push(id + ': ' + (p.human ? '[人の判断待ち] ' : '') + r.detail);
});

// 検査だけあって項目が消えた場合も出す (棚卸しと検査の対応を両方向で見る)
Object.keys(PREMISES).forEach((id) => {
  if (ids.indexOf(id) < 0) {
    findings.push({ module: id, fn: '前提の宣言',
      what: '棚卸しに無い項目の検査が残っている' });
  }
});

// ── H区分 (削除リスト) も見張る ─────────────────────────────────────────
//
// 「削除リスト — 黙って消さない」の項目には復活条件が書いてある。
// **G区分と同じで、条件を誰も監視していない。**
//
// 2026-08-22 に F5 (ADR-027) / F6 + UI-022/023/032 / G3 (複写) を
// 期限到来で凍結してここへ移した。凍結は「忘れる」ことではないので、
// **条件が満たされたら気付ける状態**にしておく必要がある。
//
// 復活条件のほとんどは人の決定 (「採番の承認が出た時点」「案が選ばれた時点」)
// なので自動判定できない。できるのは:
//   1. 復活条件が**空でないこと**を確かめる (黙って消えていない)
//   2. 機械で見られる条件は見る
const hStart = md.indexOf('## H. 削除リスト');
const hEnd = md.indexOf('## F.') > hStart ? md.indexOf('## F.') : md.length;
const hSection = hStart >= 0 ? md.slice(hStart, hEnd) : '';
const hRows = hSection.split('\n')
  .filter(l => l.indexOf('|') === 0 && l.indexOf('---') < 0 && l.indexOf('削った項目') < 0)
  .map(l => l.split('|').map(x => x.trim()))
  .filter(c => c.length >= 4 && c[1]);

// 機械で見られる復活条件だけ書く。無いものは「人の決定待ち」。
const H_PROBES = {
  'F5 ADR-027 の採番': () => {
    const numbered = read('docs/adr/README.md').indexOf('ADR-027') >= 0;
    return { revived: numbered, detail: numbered ? '**ADR-027 が採番された → 復活**' : 'ドラフトのまま' };
  },
  'F6 パネル構成の案の選択 + UI-022 / UI-023 / UI-032': () => {
    // 案が選ばれると MOC に「採用」の記載が入る約束にする。
    //
    // **行頭でなければならない。** 最初は本文のどこかにあれば良いことにしたが、
    // MOC に書いた**再開手順の例文**(字下げした `採用: 案A`)に反応して
    // 「案が選ばれた」と誤検出した (検査の誤り25件目)。
    // 指示と決定は見た目が同じなので、**置かれる場所**で分ける。
    const moc = read('docs/superpowers/specs/2026-08-22-panel-layout-moc.md');
    const chosen = /^採用[:：]\s*案[A-C]/m.test(moc);
    return { revived: chosen, detail: chosen ? '**案が選ばれた → 復活**' : '案は未選択 (既定は案D 現状維持)' };
  },
};

const hLines = [];
hRows.forEach((c) => {
  const name = c[1];
  const cond = c[3] || '';
  if (!cond) {
    findings.push({ module: name.slice(0, 30), fn: '復活条件の欠落',
      what: '削除リストの項目に復活条件が書かれていない (黙って消えたのと同じ)' });
    hLines.push(name.slice(0, 34) + ': **復活条件が無い**');
    return;
  }
  const probe = H_PROBES[name];
  if (!probe) { hLines.push(name.slice(0, 34) + ': [人の決定待ち] ' + cond.slice(0, 40)); return; }
  let r;
  try { r = probe(); } catch (e) { r = { revived: false, detail: '検査が例外: ' + e.message }; }
  if (r.revived) {
    findings.push({ module: name.slice(0, 30), fn: '復活条件が満たされた',
      what: r.detail + ' — 削除リストから戻して計画に載せる' });
  }
  hLines.push(name.slice(0, 34) + ': ' + r.detail);
});

console.log('  (バックログ ' + ids.length + ' 項目の前提)');
lines.forEach(l => console.log('    ' + l));
console.log('  (削除リスト ' + hRows.length + ' 項目の復活条件)');
hLines.forEach(l => console.log('    ' + l));
report('backlog-premises', findings, { examined: 21, total: 21 });
