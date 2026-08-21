'use strict';
// R19 検査の網羅: 各観点が本当に全モジュールを見ているか。
//
// gantt が18観点すべてから静かに外れていた (`parse` が `elements` を返していなかった)
// という事故を受けて作った、**検査の網羅そのものを検査する**観点。
//
// 「18観点すべて指摘0」は、検査対象に入っている範囲でしか意味を持たない。
// 外れているモジュールについては、その0は何も言っていない。
//
// レビュアーは前提を満たさないモジュールを黙って飛ばす:
//
//   if (!mod || !mod.template || !mod.parse) return;
//   if (!before || before.length < 2) return;
//   if (!del) return;              // 削除関数が見つからない
//   if (!up || !down) return;      // 移動関数が見つからない
//
// どれも正当な理由だが、**飛ばしたことが記録に残らない**。ここで前提を並べ、
// どのモジュールがどの前提で外れるかを一覧にする。
//
// 判定の考え方:
//   - 基本の前提 (template / parse / elements) を満たさないモジュールは**欠陥**。
//     すべての観点から外れるので、影響が大きすぎる
//   - 個別の前提 (削除関数がある / 移動関数がある) を満たさないのは設計上ありうるので、
//     件数を出すだけにして黙って落とさない
const { loadModules, elementsOf, report } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);

// レビュアーが実際に使っている前提。ここを増やしたら検査も広がる。
const BASELINE = [
  { key: 'template', label: 'template() を持つ', test: (m) => typeof m.template === 'function' },
  { key: 'parse', label: 'parse() を持つ', test: (m) => typeof m.parse === 'function' },
  { key: 'elements', label: 'parse().elements が配列', test: (m) => {
    try { return Array.isArray(m.parse(m.template()).elements); } catch (e) { return false; }
  } },
  { key: 'nonEmpty', label: 'ひな形に要素が1つ以上ある', test: (m) => {
    const els = elementsOf(m, m.template());
    return !!(els && els.length);
  } },
  { key: 'operations', label: 'operations.update を持つ', test: (m) =>
    !!(m.operations && typeof m.operations.update === 'function') },
];

// 満たさなくても設計上ありうるもの。件数だけ出す。
//
// ここに関数名の表 (deleteNode / moveNodeUp / …) を持っていたが、それこそが
// この観点が問題にしている「表から漏れる」形だった。契約 (operations) で見る。
const OPTIONAL = [
  { key: 'twoPlus', label: 'ひな形に要素が2つ以上 (r1/r6/r9 が要求)', test: (m) => {
    const els = elementsOf(m, m.template());
    return !!(els && els.length >= 2);
  } },
  { key: 'delete', label: 'operations.delete が実際に本文を変える', test: (m) => {
    const els = elementsOf(m, m.template());
    if (!els || !els.length) return false;
    try {
      // 契約の opts を渡す。渡さないと block は「1行に複数のブロックがあるので
      // どれを消すか決まらない」として正しく拒否する。検査の呼び方の問題を
      // 製品の欠陥として報告しない。
      const last = els[els.length - 1];
      const out = m.operations.delete(m.template(), last.line,
        { kind: last.kind, id: last.id, blockId: last.id });
      return !!out && out !== m.template();
    } catch (e) { return false; }
  } },
  // ひな形の構造上、上へ動かす相手がいない図種がある
  // (block は3つが1行に並ぶ、gantt はセクションにタスク1つ)。欠陥ではないので
  // 件数を出すだけにするが、黙って落とさない。
  { key: 'move', label: 'operations.moveUp が実際に本文を変える (ひな形に動かす相手がいる場合)', test: (m) => {
    const els = elementsOf(m, m.template());
    if (!els || els.length < 2) return true;
    const first = els[0].line;
    const second = els.filter(x => x.line !== first)[0];
    if (!second) return true;      // 行が1つしか無い = 動かす相手がいない
    try {
      const out = m.operations.moveUp(m.template(), second.line,
        { kind: second.kind, id: second.id, blockId: second.id });
      return !!out && out !== m.template();
    } catch (e) { return false; }
  } },
];

const findings = [];
const optionalGaps = {};

Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod) return;

  BASELINE.forEach((b) => {
    let ok = false;
    try { ok = !!b.test(mod); } catch (e) { ok = false; }
    if (!ok) {
      findings.push({ module: key, fn: 'V1 検査の前提',
        what: b.label + ' を満たさないため、これに依存する観点から静かに外れる' });
    }
  });

  OPTIONAL.forEach((o) => {
    let ok = false;
    try { ok = !!o.test(mod); } catch (e) { ok = false; }
    if (!ok) {
      (optionalGaps[o.label] = optionalGaps[o.label] || []).push(key);
    }
  });
});

// 黙って落とさない。設計上ありうる欠落も件数と名前を出す。
Object.keys(optionalGaps).forEach((label) => {
  console.log('  (任意の前提) ' + label + ' を満たさない: ' +
    optionalGaps[label].length + '件 — ' + optionalGaps[label].join(','));
});

report('r19-coverage', findings);
