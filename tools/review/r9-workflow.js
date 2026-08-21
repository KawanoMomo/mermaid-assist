'use strict';
// R9 ワークフロー適合: Git に載せて回すときの摩擦を見る。
//
// 想定しているのは「mmd を Git 管理し、レビュー指摘のたびに小刻みに直す」使い方。
// このとき効くのは機能の有無ではなく、**1操作が差分をどれだけ汚すか**である。
//
//   - GUI で1つ消したら、無関係な行の書式まで書き換わった
//     → PR の差分が数十行になり、レビュアーは何が変わったか読めない
//   - `%% レビュー指摘: あとで直す` と書いておいたコメントが、GUI 操作で消える
//     → テキストで持っている情報が、GUI を通した瞬間に失われる
//   - 末尾の改行や空行が毎回揺れる
//     → 差分に無意味な行が乗り続ける
//
// どれも「動く」ので、これまでのレビュアーは全部素通りしていた。
const { loadModules, elementsOf, report } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);

const COMMENT = '%% レビュー指摘: ここは後で直す';
// 1操作で書き換わってよい行数の上限。削除は本体+関係行が消えるので少し許す。
const MAX_TOUCHED = 6;

const findings = [];

// 行の多重集合の差 (順序は move で変わるので、増減した行だけを数える)
function changedLines(before, after) {
  const count = {};
  before.split('\n').forEach(l => { count[l] = (count[l] || 0) + 1; });
  after.split('\n').forEach(l => { count[l] = (count[l] || 0) - 1; });
  return Object.keys(count).filter(k => count[k] !== 0);
}

// 削除は契約 (operations.delete) で呼ぶ。関数名の表を持つと、
// その名前を持たないモジュール (c4 / gitGraph は `deleteLine`) を黙って飛ばす。
// 移動も契約 (operations.moveUp) で呼ぶ。

Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse) return;

  // テンプレートの1行目 (図種宣言) の直後にコメントと空行を差し込む。
  // 実務のファイルはこういう「意味のない行」を必ず持っている。
  const lines = mod.template().split('\n');
  const src = [lines[0], '    ' + COMMENT, ''].concat(lines.slice(1)).join('\n');

  const before = elementsOf(mod, src);
  if (!before || before.length < 2) return;

  // W0 コメントを挟んだだけで parse が壊れないこと
  if (before.length !== (elementsOf(mod, mod.template()) || []).length) {
    findings.push({ module: key, fn: 'W0 コメント',
      what: 'コメント行を挟むと要素の数が変わる (コメントを要素と読んでいる)' });
    return;
  }

  const target = before[before.length - 1];

  if (mod.operations && typeof mod.operations.delete === 'function') {
    const del = 'operations.delete';
    let after = null;
    try {
      after = mod.operations.delete(src, target.line,
        { kind: target.kind, id: target.id, blockId: target.id });
    } catch (e) { after = null; }
    if (after && after !== src) {
      // W1 コメントが巻き添えで消えていないか
      if (after.indexOf(COMMENT) < 0) {
        findings.push({ module: key, fn: 'W1 コメント消失',
          what: del + ' が無関係なコメント行を消す' });
      }
      // W2 差分の局所性
      const ch = changedLines(src, after);
      if (ch.length > MAX_TOUCHED) {
        findings.push({ module: key, fn: 'W2 差分',
          what: del + ' が ' + ch.length + ' 行を書き換える (上限 ' + MAX_TOUCHED + ')' });
      }
      // W3 末尾改行の揺れ
      if (/\n$/.test(src) !== /\n$/.test(after)) {
        findings.push({ module: key, fn: 'W3 末尾改行', what: del + ' で末尾の改行が変わる' });
      }
    }
  }

  if (mod.operations && typeof mod.operations.moveUp === 'function') {
    const mv = 'operations.moveUp';
    const firstLine = before[0].line;
    const second = before.filter(x => x.line !== firstLine)[0];
    if (second) {
      let after = null;
      try {
        after = mod.operations.moveUp(src, second.line,
          { kind: second.kind, id: second.id, blockId: second.id });
      } catch (e) { after = null; }
      if (after && after !== src) {
        if (after.indexOf(COMMENT) < 0) {
          findings.push({ module: key, fn: 'W1 コメント消失',
            what: mv + ' が無関係なコメント行を消す' });
        }
        // 並び替えは行の入れ替えなので、行の多重集合は**変わらない**のが正しい。
        const ch = changedLines(src, after);
        if (ch.length > 0) {
          findings.push({ module: key, fn: 'W4 並び替えの副作用',
            what: mv + ' が行の中身を書き換える: ' + ch.slice(0, 3).map(x => JSON.stringify(x)).join(' ') });
        }
      }
    }
  }
});

report('r9-workflow', findings);
