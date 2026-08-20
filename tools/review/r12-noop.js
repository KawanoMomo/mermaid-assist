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

// (text, line, field, value) 形式。field 名はモジュールごとに違うので候補を持つ。
const FIELD_FNS = {
  updateNode: ['label', 'id', 'shape'],
  updateElement: ['label', 'name'],
  updateParticipant: ['label', 'id'],
  updateCard: ['text', 'meta'],
  updateField: ['label'],        // packet は startBit/endBit/label
  updateSlice: ['label', 'value'],
  updatePoint: ['label'],
  updateCurve: ['label'],
  updateTaskField: ['label', 'id'],
  updateSection: ['name'],
  updatePeriod: ['period'],      // timeline は period/event
  updateCommit: ['id'],
};
// (text, line, value) 形式
const VALUE_FNS = ['updateStateLabel', 'updateNodeText', 'updateColumn'];
// (text, line, id, value) 形式
const ID_FNS = ['updateBlockLabel'];

const NEW = 'ZZ更新済ZZ';
const findings = [];

Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse) return;
  const t0 = mod.template();
  const els = elementsOf(mod, t0);
  if (!els || !els.length) return;

  const call = (el, kind, fn, field) => {
    try {
      if (kind === 'field') return mod[fn](t0, el.line, field, NEW, el.id !== undefined ? el.id : el.key);
      if (kind === 'value') return mod[fn](t0, el.line, NEW, el.id !== undefined ? el.id : el.key);
      return mod[fn](t0, el.line, el.id !== undefined ? el.id : el.key, NEW);
    } catch (e) { return { err: String(e.message).slice(0, 50) }; }
  };

  const check = (fn, kind, field) => {
    const dead = [];
    els.forEach((el) => {
      const out = call(el, kind, fn, field);
      if (out && out.err) { dead.push((el.key || '?') + '(例外:' + out.err + ')'); return; }
      if (!out || out === t0) dead.push(el.key || String(el.i));
    });
    // 全要素で空振りなら、その欄は死んでいる。
    // 一部だけ空振りなのは「その要素には無い属性」でありうるので、全滅のときだけ言う。
    if (dead.length === els.length) {
      findings.push({ module: key, fn: fn + (field ? '/' + field : ''),
        what: '違う値を渡しても本文が変わらない (' + els.length + '要素すべて空振り)' });
    }
  };

  Object.keys(FIELD_FNS).forEach((fn) => {
    if (typeof mod[fn] !== 'function') return;
    // 代表として1つ目の field だけ見る。全部見ると「その図種に無い属性」で騒がしくなる。
    check(fn, 'field', FIELD_FNS[fn][0]);
  });
  VALUE_FNS.forEach((fn) => { if (typeof mod[fn] === 'function') check(fn, 'value'); });
  ID_FNS.forEach((fn) => { if (typeof mod[fn] === 'function') check(fn, 'id'); });
});

report('r12-noop', findings);
