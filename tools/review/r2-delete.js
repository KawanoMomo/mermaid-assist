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
const unidentifiable = [];   // 鍵で同定できず対象から外した要素 (黙って捨てない)

Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse) return;
  const t0 = mod.template();
  const before = elementsOf(mod, t0);
  if (!before || before.length < 2) return;

  // 契約 (operations.delete) で呼ぶ。関数名の表を持つと、その名前を持たない
  // モジュール (c4 / gitGraph は `deleteLine`) を黙って飛ばす。
  if (mod.operations && typeof mod.operations.delete === 'function') {
    const fn = 'operations.delete';
    before.forEach((el) => {
      let out = null;
      try {
        out = mod.operations.delete(t0, el.line,
          { kind: el.kind, id: el.id, blockId: el.id });
      } catch (e) { out = null; }
      if (out === t0 || out === null) return;   // 効かない = 削除対象外の行

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
      // 同定できない要素 (無名コミット / 添字しか手がかりが無い checkout など) は
      // 残存を鍵で判定できない。対象から外し、外したことを数えて出す。
      if (!el.identifiable) { unidentifiable.push(key + ':' + (el.kind || '?')); return; }
      if (!auto) {
        // 押した要素は1回で消えること。
        //
        // 以前はここに `&& !lineGone` (何かの行が消えていれば見逃す) が付いていた。
        // 導出される要素 (sankey のノード) で誤検出を出さないための逃げ道だったが、
        // **どの行が消えたかを問わない**ので、間違った行を消しても通ってしまう。
        // 実際 erDiagram はエンティティを押すと関係行だけが消え、本体のブロックが
        // 残っていたのに 21/21 で0件だった。
        //
        // 導出される要素と区別するために、消えるまで繰り返して回数を数える。
        //   1回で消える         → 正しい
        //   2回以上かかる       → 宣言が1箇所に無い (導出) か、間違った行を消している
        //   何回やっても消えない → 欠陥
        if (after.map(x => x.key).indexOf(el.key) !== -1) {
          let cur = out, rounds = 1, gone = false;
          for (let k = 0; k < 6; k++) {
            const els = elementsOf(mod, cur);
            if (!els) break;
            const same = els.filter(x => x.key === el.key)[0];
            if (!same) { gone = true; break; }
            let nx;
            try {
              nx = mod.operations.delete(cur, same.line,
                { kind: same.kind, id: same.id, blockId: same.id });
            } catch (e) { break; }
            if (!nx || nx === cur) break;
            cur = nx; rounds++;
          }
          if (!gone) {
            findings.push({ module: key, fn,
              what: '押した要素が消えない (' + el.key + ': ' + rounds + '回試しても残る)', input: el.key });
          } else {
            findings.push({ module: key, fn,
              what: '押した要素が1回で消えない (' + el.key + ': ' + rounds + '回必要)', input: el.key });
          }
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
      // 要素が宣言ではなく**導出**される図種がある (sankey のノードは
      // 流れの両端から作られる)。他の行からまだ参照されているなら、
      // 1行消しても要素が残るのは正しい。残っている理由が本文にあるか見る。
      const stillReferenced = ident !== null && ident !== '' && out.indexOf(ident) >= 0;
      if (after.length >= before.length && !stillReferenced) {
        findings.push({ module: key, fn,
          what: '要素数が減らない (' + before.length + ' -> ' + after.length + ')', input: el.key });
      }
    });
  }
});

if (unidentifiable.length) {
  console.log('  (鍵で同定できず未検査: ' + unidentifiable.length + ' 要素) ' + unidentifiable.slice(0, 6).join(' / '));
}
report('r2-delete', findings);
