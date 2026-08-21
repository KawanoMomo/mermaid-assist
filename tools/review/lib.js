'use strict';
// レビュアー共通の土台。
// 各レビュアーは独立プロセスで動き、findings を JSON で吐く。
// 集約側はそれを読んで修正し、同じレビュアーを再実行する = 並行批判ループ。
const fs = require('fs');
const path = require('path');

function loadModules(ROOT) {
  global.window = { MA: { modules: {} } };
  ['core/date-utils', 'core/html-utils', 'core/text-updater', 'core/parser-utils',
   'core/history', 'core/selection', 'core/connection-mode'].forEach((f) => {
    try { require(path.join(ROOT, 'src', f + '.js')); } catch (e) { /* DOM 依存は無視 */ }
  });
  fs.readdirSync(path.join(ROOT, 'src', 'modules')).filter(f => f.endsWith('.js')).forEach((f) => {
    try { require(path.join(ROOT, 'src', 'modules', f)); } catch (e) { /* 同上 */ }
  });
  const mods = global.window.MA.modules;
  _totalModules = Object.keys(mods).length;
  Object.keys(mods).forEach((k) => { if (mods[k]) _moduleKeys.set(mods[k], k); });
  return mods;
}

// どのモジュールを実際に検査したかを記録する。
//
// 「19観点すべて指摘0」は、検査対象に入っている範囲でしか意味を持たない。
// r1 は 14/21、r6 は 6/21 しか見ていなかったのに、数だけ数えていた。
// 土台側で数えれば、各レビュアーを書き換えなくても網羅率が出る。
const _examined = new Set();
const _moduleKeys = new WeakMap();
let _totalModules = 0;

function markExamined(key) { if (key) _examined.add(key); }

// モジュールごとの「識別子を持つ要素」。id が無いものは name / label で代用する。
function elementsOf(mod, text) {
  // elementsOf を呼んだ = そのモジュールに実際に手を付けた、と見なす。
  markExamined(_moduleKeys.get(mod));
  try {
    const p = mod.parse(text);
    return (p.elements || []).map((e, i) => ({
      // 「その要素を人が見分ける文字」の置き場所は図種で違う。
      // journey のタスクは text、pie は label、gitGraph の branch は name。
      // 1つでも決め打ちすると、その図種が黙って検査から外れる。
      i, id: e.id, name: e.name, label: e.label, text: e.text, kind: e.kind, line: e.line,
      key: e.id !== undefined && e.id !== null && e.id !== '' ? String(e.id) : String(e.name || e.label || i),
      // 同定できるか。
      //
      // gitGraph の無名コミットは id が空文字なので、2つあると同じ鍵になる。
      // checkout / merge には id も name も無いので添字が鍵になるが、添字は
      // 削除のたびに振り直されるので**identity としては使えない**。
      // 鍵で残存を判定するレビュアーは、こういう要素を対象から外さないと
      // 「押した要素が残る」という偽の指摘を出す (自動採番 id と同じ罠)。
      identifiable: !!(
        (e.id !== undefined && e.id !== null && e.id !== '' && !/^__/.test(String(e.id))) ||
        (e.name !== undefined && e.name !== null && e.name !== '') ||
        (e.label !== undefined && e.label !== null && e.label !== '') ||
        (e.text !== undefined && e.text !== null && e.text !== '')
      ),
    }));
  } catch (e) { return null; }
}
function relationsOf(mod, text) {
  try {
    const p = mod.parse(text);
    return (p.relations || []).map(r => (r.from || '') + '>' + (r.to || ''));
  } catch (e) { return []; }
}

function report(name, findings, opts) {
  opts = opts || {};
  const dir = path.join(__dirname, 'out');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(findings, null, 1));

  // 網羅率を残す。ブラウザを使うレビュアーは図種の一覧を自分で持っているので、
  // opts.examined / opts.total で渡す。モジュール層のレビュアーは土台が自動で数える。
  const examined = (opts.examined !== undefined) ? opts.examined : _examined.size;
  const total = (opts.total !== undefined) ? opts.total : _totalModules;
  if (total) {
    fs.writeFileSync(path.join(dir, name + '.coverage.json'),
      JSON.stringify({ name, examined, total }, null, 1));
  }
  console.log('[' + name + '] findings=' + findings.length +
    (total ? ' / 検査した図種 ' + examined + '/' + total : ''));
  findings.forEach(f => console.log('  - ' + f.module + '.' + f.fn + ': ' + f.what));
}

module.exports = { loadModules, elementsOf, relationsOf, report, markExamined };
