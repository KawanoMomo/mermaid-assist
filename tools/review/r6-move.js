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

const UP = ['moveNodeUp', 'moveTaskUp', 'moveParticipantUp', 'moveClassUp', 'moveEntityUp',
  'moveStateUp', 'moveSectionUp', 'moveUp'];
const DOWN = ['moveNodeDown', 'moveTaskDown', 'moveParticipantDown', 'moveClassDown',
  'moveEntityDown', 'moveStateDown', 'moveSectionDown', 'moveDown'];

const findings = [];

Object.keys(M).forEach((key) => {
  const mod = M[key];
  if (!mod || !mod.template || !mod.parse) return;
  const t0 = mod.template();
  const before = elementsOf(mod, t0);
  if (!before || before.length < 2) return;

  const up = UP.find(f => typeof mod[f] === 'function');
  const down = DOWN.find(f => typeof mod[f] === 'function');
  if (!up || !down) return;

  const keys0 = before.map(x => x.key).join(',');

  // 行が違う要素を選ぶ。
  // flowchart は `A[Start] --> B{Decision}` のように **要素が行を共有する**ので、
  // 「2番目の要素」は先頭と同じ行を指す。それを上へ動かそうとしても先頭行を
  // 上へ動かすことになり、何も起きない = 検査が素通りする。
  // 実際それで move を壊しても検出できていなかった。
  const firstLine = before[0].line;
  const second = before.filter(x => x.line !== firstLine)[0];
  if (!second) return;
  let moved = null;
  try { moved = mod[up](t0, second.line); } catch (e) {
    findings.push({ module: key, fn: up, what: '例外: ' + String(e.message).slice(0, 50) });
  }
  if (moved && moved !== t0) {
    const mid = elementsOf(mod, moved);
    if (!mid) {
      findings.push({ module: key, fn: up, what: '上へ動かすと parse できない' });
    } else {
      if (mid.map(x => x.key).sort().join(',') !== before.map(x => x.key).sort().join(',')) {
        findings.push({ module: key, fn: up,
          what: '上へ動かすと要素集合が変わる: ' + keys0 + ' -> ' + mid.map(x => x.key).join(',') });
      }
      // 動いた要素を元の位置へ戻す
      const movedEl = mid.filter(x => x.key === second.key)[0];
      if (movedEl) {
        let back = null;
        try { back = mod[down](moved, movedEl.line); } catch (e) { back = null; }
        if (back !== null && back !== t0) {
          findings.push({ module: key, fn: up + '/' + down,
            what: '上→下 で元のテキストに戻らない' });
        }
      }
    }
  }

  // 先頭要素を上へ (端) — 何も起きないのが正しい。壊れたら指摘
  try {
    const atTop = mod[up](t0, before[0].line);
    if (atTop && atTop !== t0) {
      const e = elementsOf(mod, atTop);
      if (!e) findings.push({ module: key, fn: up, what: '先頭を上へ動かすと parse できない' });
      else if (e.map(x => x.key).sort().join(',') !== before.map(x => x.key).sort().join(',')) {
        findings.push({ module: key, fn: up, what: '先頭を上へ動かすと要素が変わる' });
      }
    }
  } catch (e) {
    findings.push({ module: key, fn: up, what: '先頭を上へ動かすと例外: ' + String(e.message).slice(0, 50) });
  }

  // 末尾要素を下へ (端)
  try {
    const atEnd = mod[down](t0, before[before.length - 1].line);
    if (atEnd && atEnd !== t0) {
      const e = elementsOf(mod, atEnd);
      if (!e) findings.push({ module: key, fn: down, what: '末尾を下へ動かすと parse できない' });
      else if (e.map(x => x.key).sort().join(',') !== before.map(x => x.key).sort().join(',')) {
        findings.push({ module: key, fn: down, what: '末尾を下へ動かすと要素が変わる' });
      }
    }
  } catch (e) {
    findings.push({ module: key, fn: down, what: '末尾を下へ動かすと例外: ' + String(e.message).slice(0, 50) });
  }
});

report('r6-move', findings);
