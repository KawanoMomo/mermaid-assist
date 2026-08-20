'use strict';
// R1 破壊検査: 更新系が「指定した要素以外」を変えていないか。
//
// 各図種のテンプレートに対し、全要素のラベルを **同じ値で** 書き戻す。
// 何も変わらないのが正しい。変わったら、その関数は指定していない何かを触っている。
const { loadModules, elementsOf, relationsOf, report } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);

// (text, line, field, value) 形式
const FIELD_FNS = ['updateNode', 'updateElement', 'updateTaskField', 'updateParticipant',
  'updateCard', 'updateField', 'updateSlice', 'updatePoint', 'updateCurve'];
// (text, line, value) 形式
const VALUE_FNS = ['updateColumn', 'updateStateLabel', 'updateNodeText', 'updateBranch'];
// (text, line, id, value) 形式
const ID_FNS = ['updateBlockLabel'];

const findings = [];

Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse) return;
  const t0 = mod.template();
  const before = elementsOf(mod, t0);
  if (!before || before.length === 0) return;
  const relsBefore = relationsOf(mod, t0);

  const tryOne = (fn, kind, el) => {
    const label = el.label !== undefined ? el.label : (el.name !== undefined ? el.name : null);
    if (label === null) return null;
    try {
      if (kind === 'field') return mod[fn](t0, el.line, 'label', label);
      if (kind === 'value') return mod[fn](t0, el.line, label);
      if (kind === 'id') return mod[fn](t0, el.line, el.id, label);
    } catch (e) {
      findings.push({ module: key, fn, what: '同じ値の書き戻しで例外: ' + String(e.message).slice(0, 60),
        input: el.key });
    }
    return null;
  };

  const cands = []
    .concat(FIELD_FNS.filter(f => typeof mod[f] === 'function').map(f => [f, 'field']))
    .concat(VALUE_FNS.filter(f => typeof mod[f] === 'function').map(f => [f, 'value']))
    .concat(ID_FNS.filter(f => typeof mod[f] === 'function').map(f => [f, 'id']));

  cands.forEach(([fn, kind]) => {
    before.forEach((el) => {
      const out = tryOne(fn, kind, el);
      if (out === null || out === t0) return;
      const after = elementsOf(mod, out);
      if (!after) {
        findings.push({ module: key, fn, what: '同じ値の書き戻しで parse 不能になる', input: el.key });
        return;
      }
      const k0 = before.map(x => x.key).join(',');
      const k1 = after.map(x => x.key).join(',');
      if (k0 !== k1) {
        findings.push({ module: key, fn,
          what: '同じ値の書き戻しで要素が変わる: ' + k0 + ' -> ' + k1, input: el.key });
      }
      const r1 = relationsOf(mod, out).join(',');
      if (relsBefore.join(',') !== r1) {
        findings.push({ module: key, fn,
          what: '同じ値の書き戻しで関連が変わる: ' + relsBefore.join(',') + ' -> ' + r1, input: el.key });
      }
    });
  });
});

report('r1-destructive', findings);
