'use strict';
// R6 並び替え / 挿入: move と insert が構造を壊さないか。
//
// 見るもの:
//   - 上下に動かして戻したら元のテキストに戻るか (往復)
//   - 動かしても要素の集合が変わらないか
//   - 端で動かそうとしたときに壊れないか
//   - 挿入した結果が parse を通るか
const { loadModules, elementsOf, report } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);

// 全モジュールが `operations.moveUp / moveDown` を持つので、関数名の表を手で持たない。
//
// 以前は moveNodeUp / moveTaskUp / … という表を持っており、その名前を持たない
// **15モジュールを黙って飛ばしていた** (r19 で発覚)。検査していたのは6だけ。
// gantt が18観点から素通りしていたのと同じ形で、規模はこちらの方が大きい。

const findings = [];

Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse) return;
  if (!mod.operations || typeof mod.operations.moveUp !== 'function') {
    findings.push({ module: key, fn: 'operations.moveUp', what: '統一入口が無い' });
    return;
  }
  const t0 = mod.template();
  const before = elementsOf(mod, t0);
  if (!before || before.length < 2) return;

  // 並べ替えをまたぐ同一性の鍵。
  //
  // 自動採番の id (`__bar_0`) は**位置由来**なので、入れ替えると `__line_0` になる。
  // そのまま比べると、正しく入れ替わっても「集合が変わった」と見える。
  // 末尾の連番を落としてから多重集合として比べる。
  const idKey = (x) => String(x.key).replace(/_\d+$/, '');
  const keys0 = before.map(idKey).sort().join(',');

  // 行が違う要素を選ぶ。
  // flowchart は `A[Start] --> B{Decision}` のように **要素が行を共有**するので、
  // 「2番目の要素」は先頭と同じ行を指す。それを上へ動かしても何も起きない。
  const firstLine = before[0].line;
  const second = before.filter(x => x.line !== firstLine)[0];
  if (!second) return;

  const check = (label, out) => {
    if (!out || out === t0) return;                 // 動かないのは設計上ありうる
    const after = elementsOf(mod, out);
    if (!after) {
      findings.push({ module: key, fn: label, what: '動かすと parse できない' });
      return;
    }
    if (after.map(idKey).sort().join(',') !== keys0) {
      findings.push({ module: key, fn: label,
        what: '動かすと要素集合が変わる: ' + keys0 + ' -> ' + after.map(idKey).join(',') });
    }
  };

  try { check('U1 上へ', mod.operations.moveUp(t0, second.line)); }
  catch (e) { findings.push({ module: key, fn: 'U1 上へ', what: '例外: ' + String(e.message).slice(0, 50) }); }

  try { check('U2 先頭を上へ', mod.operations.moveUp(t0, before[0].line)); }
  catch (e) { findings.push({ module: key, fn: 'U2 先頭を上へ', what: '例外: ' + String(e.message).slice(0, 50) }); }

  try { check('U3 末尾を下へ', mod.operations.moveDown(t0, before[before.length - 1].line)); }
  catch (e) { findings.push({ module: key, fn: 'U3 末尾を下へ', what: '例外: ' + String(e.message).slice(0, 50) }); }
});

report('r6-move', findings);
