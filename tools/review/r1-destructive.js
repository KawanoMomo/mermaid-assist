'use strict';
// R1 破壊検査: 更新系が「指定した要素以外」を変えていないか。
//
// 各図種のテンプレートに対し、全要素のラベルを **同じ値で** 書き戻す。
// 何も変わらないのが正しい。変わったら、その関数は指定していない何かを触っている。
const { loadModules, elementsOf, relationsOf, report } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);

// 全モジュールが `operations.update(text, line, field, value, opts)` を持つので、
// 関数名の表を持たない。
//
// 以前は FIELD_FNS / VALUE_FNS / ID_FNS の3つの表を持っており、その名前を持たない
// **7モジュールを黙って飛ばしていた** (classDiagram / erDiagram / journey /
// requirementDiagram / sankeyBeta / timeline / xychartBeta)。検査していたのは 14/21。
// r6 が15を飛ばしていたのと同じ形 (r19 で発覚したパターン)。

// kind はメタ情報であって編集値ではない。書き戻すとラベルが "column" などになる。
const FIELDS = ['label', 'text', 'name', 'id', 'period', 'value'];

const findings = [];

Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse) return;
  if (!mod.operations || typeof mod.operations.update !== 'function') return;
  const t0 = mod.template();
  const before = elementsOf(mod, t0);
  if (!before || before.length === 0) return;
  const relsBefore = relationsOf(mod, t0).join(',');
  const k0 = before.map(x => x.key).join(',');

  before.forEach((el) => {
    // その要素が今持っている値を、そのまま書き戻す。
    // 何も変わらないのが正しい。変わったら、指定していない何かを触っている。
    const opts = { kind: el.kind, id: el.id, blockId: el.id, name: el.name };
    FIELDS.forEach((field) => {
      const same = el[field];
      if (typeof same !== 'string' || !same) return;
      let out = null;
      try { out = mod.operations.update(t0, el.line, field, same, opts); }
      catch (e) {
        findings.push({ module: key, fn: 'operations.update/' + field,
          what: '同じ値の書き戻しで例外: ' + String(e.message).slice(0, 50), input: el.key });
        return;
      }
      if (!out || out === t0) return;

      const after = elementsOf(mod, out);
      if (!after) {
        findings.push({ module: key, fn: 'operations.update/' + field,
          what: '同じ値の書き戻しで parse 不能になる', input: el.key });
        return;
      }
      const k1 = after.map(x => x.key).join(',');
      if (k0 !== k1) {
        findings.push({ module: key, fn: 'operations.update/' + field,
          what: '同じ値の書き戻しで要素が変わる: ' + k0 + ' -> ' + k1, input: el.key });
      }
      const r1 = relationsOf(mod, out).join(',');
      if (relsBefore !== r1) {
        findings.push({ module: key, fn: 'operations.update/' + field,
          what: '同じ値の書き戻しで関連が変わる: ' + relsBefore + ' -> ' + r1, input: el.key });
      }
    });
  });
});

report('r1-destructive', findings);
