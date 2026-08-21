'use strict';
// R14 境界: 要素が 0個 / 1個 のときに壊れないか。
//
// これまでのレビュアーは全部「テンプレート (要素5〜8個)」と「100要素」を見ていた。
// 実務で最初に通るのは**空の図**で、次が**要素1個**である。新規作成した直後、
// 最後の1つを消した直後、という日常の状態がどこにも検査されていなかった。
//
// 見るもの:
//   - 全要素を消したあと、本文がまだ mermaid の文書として成立しているか
//   - 要素1個のときに削除・移動・更新が壊れないか
//   - 空にしてから1つ足すと戻ってくるか (往復)
const { loadModules, elementsOf, report } = require('./lib');
const ROOT = process.argv[2];
const M = loadModules(ROOT);

// 削除は契約 (operations.delete) で呼ぶ。関数名の表を持つと、
// その名前を持たないモジュール (c4 / gitGraph は `deleteLine`) を黙って飛ばす。
// 移動も契約 (operations.moveUp) で呼ぶ。

const findings = [];

Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse) return;
  if (!mod.operations || typeof mod.operations.delete !== 'function') return;

  // 全部消す。毎回 parse し直して、最後の1つまで消えるかを見る。
  let text = mod.template();
  let guard = 0;
  while (guard++ < 60) {
    const els = elementsOf(mod, text);
    if (!els) {
      findings.push({ module: key, fn: 'B1 全削除',
        what: '途中で parse できなくなる (残り不明)' });
      return;
    }
    if (!els.length) break;
    const last = els[els.length - 1];
    let out = null;
    try { out = mod.operations.delete(text, last.line, { kind: last.kind, id: last.id, blockId: last.id }); }
    catch (e) {
      findings.push({ module: key, fn: 'B1 全削除',
        what: '残り ' + els.length + ' 個で例外: ' + String(e.message).slice(0, 40) });
      return;
    }
    if (!out || out === text) {
      findings.push({ module: key, fn: 'B1 全削除',
        what: '残り ' + els.length + ' 個から先に進めない (削除が効かない)' });
      return;
    }
    text = out;
  }

  const empty = elementsOf(mod, text);
  if (!empty) {
    findings.push({ module: key, fn: 'B2 空の図', what: '全部消すと parse できない本文になる' });
    return;
  }
  // 図種宣言が残っていること。消えていると次に何を書けばよいか分からなくなる。
  const head = text.split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
  if (!head) {
    findings.push({ module: key, fn: 'B2 空の図', what: '全部消すと本文が空になり図種が分からなくなる' });
  }

  // 要素1個の状態を作って、移動・削除が壊れないか
  const t0 = mod.template();
  const all = elementsOf(mod, t0) || [];
  if (all.length >= 2) {
    let one = t0;
    // 先頭1つだけ残す
    for (let i = all.length - 1; i >= 1; i--) {
      const els = elementsOf(mod, one);
      if (!els || els.length <= 1) break;
      const e = els[els.length - 1];
      try { one = mod.operations.delete(one, e.line, { kind: e.kind, id: e.id, blockId: e.id }) || one; } catch (err) { break; }
    }
    const left = elementsOf(mod, one);
    if (left && left.length === 1) {
      if (typeof mod.operations.moveUp === 'function') {
        const mv = 'operations.moveUp';
        try {
          const moved = mod.operations.moveUp(one, left[0].line,
            { kind: left[0].kind, id: left[0].id, blockId: left[0].id });
          const after = elementsOf(mod, moved);
          if (!after) {
            findings.push({ module: key, fn: 'B3 要素1個',
              what: mv + ': 1個しかないのに動かすと parse できない' });
          } else if (after.length !== 1) {
            findings.push({ module: key, fn: 'B3 要素1個',
              what: mv + ': 1個しかないのに動かすと要素数が ' + after.length + ' になる' });
          }
        } catch (e) {
          findings.push({ module: key, fn: 'B3 要素1個',
            what: mv + ': 1個しかないのに動かすと例外: ' + String(e.message).slice(0, 40) });
        }
      }
    }
  }
});

report('r14-boundary', findings);
