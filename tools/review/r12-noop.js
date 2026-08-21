'use strict';
// R12 無言の空振り: 更新関数が「何もしない」まま通っていないか。
//
// R1 は「同じ値を書き戻したら本文が変わらないこと」を見ている。押していない要素を
// 壊さないための検査で、これは正しい。ただし **何もしない実装でも通る**。
//
// 実際 flowchart の updateNode は
//     // Line has edge: only update label if field===label; otherwise no-op
//     return text;
// と書かれていて、コメントが約束した分岐が存在しなかった。ひな形は全ノードが
// エッジ行にあるので、ラベル欄も ID 欄も形状も無言で効かない。エラーも出ない。
// 単体テストも e2e も 750 件通っていて、誰も気付かなかった。
//
// ここで見るのは逆側の性質: **違う値を渡したら必ず変わること**。
// 変わらないなら、その欄は画面にあるのに死んでいる。
const { loadModules, elementsOf, report } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);

// 全モジュールが `operations.update(text, line, field, value)` を持つので、
// 関数名の表を手で持たない。
//
// 以前は FIELD_FNS / VALUE_FNS / ID_FNS の3つの表を持っていたが、表から漏れた
// モジュールは検査対象から静かに外れる。実際 2箇所で field 名を間違えて
// 偽陽性を出している (packet の `name` / timeline の `label`)。
// 表を消して契約に寄せる。

// 図種を問わず試す field。モジュールが知らない field は何もしないのが正しいので、
// **どれか1つでも本文が変われば良し**とする。
const FIELDS = ['label', 'text', 'name', 'id', 'period', 'value', 'startDate', 'kind', 'values'];

const NEW = 'ZZ更新済ZZ';
const findings = [];

Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse) return;
  if (!mod.operations || typeof mod.operations.update !== 'function') {
    findings.push({ module: key, fn: 'operations.update',
      what: '統一入口が無い (検査から静かに外れる)' });
    return;
  }
  const t0 = mod.template();
  const els = elementsOf(mod, t0);
  if (!els || !els.length) return;

  // どの要素でも、いずれかの field で本文が変わること。
  // 全要素・全 field で空振りなら、その図種は編集できない。
  const dead = [];
  els.forEach((el) => {
    const changed = FIELDS.some((f) => {
      try {
        // 契約の第5引数 opts は「どの種類の行か」を伝える。渡さないと
        // block / gitGraph / timeline は分岐に入れず、実装が正しくても空振りに見える
        // (実際これで3件の偽陽性を出した)。
        const opts = { kind: el.kind, id: el.id, blockId: el.id, name: el.name };
        const out = mod.operations.update(t0, el.line, f, NEW, opts);
        return out && out !== t0;
      } catch (e) { return false; }
    });
    if (!changed) dead.push(el.key || String(el.i));
  });
  if (dead.length === els.length) {
    findings.push({ module: key, fn: 'operations.update',
      what: 'どの field を渡しても本文が変わらない (' + els.length + '要素すべて空振り)' });
  }
});

report('r12-noop', findings);
