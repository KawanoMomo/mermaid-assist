'use strict';
// R2 削除検査: 削除が「押した要素だけ」を消しているか。
//
// 判定は要素キーの集合差分。押した要素が残る / 押していない要素が消える の
// どちらも指摘にする。グループ削除で中身も消えるのは正しいので、
// 「押した要素が消えていること」を必須条件、「他が消えたこと」は情報として添える。
const { loadModules, elementsOf, report } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);

const DEL = ['deleteNode', 'deleteBlock', 'deleteElement', 'deleteClass', 'deleteEntity',
  'deleteState', 'deleteTask', 'deleteParticipant', 'deleteRequirement', 'deleteColumn',
  'deleteCard', 'deleteSlice', 'deletePoint', 'deleteCurve', 'deleteField', 'deleteSection'];

const findings = [];

Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse) return;
  const t0 = mod.template();
  const before = elementsOf(mod, t0);
  if (!before || before.length < 2) return;

  DEL.filter(f => typeof mod[f] === 'function').forEach((fn) => {
    before.forEach((el) => {
      let out = null;
      // id あり / なし の両シグネチャを試す
      try { out = mod[fn](t0, el.line, el.id); } catch (e) { out = null; }
      if (out === t0 || out === null) { try { out = mod[fn](t0, el.line); } catch (e) { out = null; } }
      if (out === t0 || out === null) return;   // 効かない = 別の関数の担当

      const after = elementsOf(mod, out);
      if (!after) {
        findings.push({ module: key, fn, what: '削除後に parse できない', input: el.key });
        return;
      }
      // 自動採番 id (`__s_0` など) は削除のたびに振り直される。
      // id で残存を判定すると、正しく消えていても「押した要素が残る」に見える。
      // 実際 pie / timeline / kanban などで 25件の誤検出を出した。
      // 見分けがつく識別子 (label / name / text) がある場合だけ残存を見る。
      const auto = /^__/.test(String(el.id || ''));
      const ident = el.label !== undefined ? el.label
        : (el.name !== undefined ? el.name : null);
      if (!auto) {
        if (after.map(x => x.key).indexOf(el.key) !== -1) {
          findings.push({ module: key, fn,
            what: '押した要素が残る (' + el.key + ')', input: el.key });
        }
      } else if (ident !== null && ident !== '') {
        const idents = after.map(x => (x.label !== undefined ? x.label : x.name));
        // 同じラベルが複数ある図では「1つ減ったか」でしか判定できない
        const b0 = before.filter(x => (x.label !== undefined ? x.label : x.name) === ident).length;
        const a0 = idents.filter(x => x === ident).length;
        if (a0 >= b0) {
          findings.push({ module: key, fn,
            what: '押した要素のラベルが減らない (' + ident + ': ' + b0 + ' -> ' + a0 + ')', input: el.key });
        }
      }
      if (after.length >= before.length) {
        findings.push({ module: key, fn,
          what: '要素数が減らない (' + before.length + ' -> ' + after.length + ')', input: el.key });
      }
    });
  });
});

report('r2-delete', findings);
