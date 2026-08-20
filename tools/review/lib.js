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
  return global.window.MA.modules;
}

// モジュールごとの「識別子を持つ要素」。id が無いものは name / label で代用する。
function elementsOf(mod, text) {
  try {
    const p = mod.parse(text);
    return (p.elements || []).map((e, i) => ({
      i, id: e.id, name: e.name, label: e.label, kind: e.kind, line: e.line,
      key: e.id !== undefined && e.id !== null ? String(e.id) : String(e.name || e.label || i),
    }));
  } catch (e) { return null; }
}
function relationsOf(mod, text) {
  try {
    const p = mod.parse(text);
    return (p.relations || []).map(r => (r.from || '') + '>' + (r.to || ''));
  } catch (e) { return []; }
}

function report(name, findings) {
  const dir = path.join(__dirname, 'out');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(findings, null, 1));
  console.log('[' + name + '] findings=' + findings.length);
  findings.forEach(f => console.log('  - ' + f.module + '.' + f.fn + ': ' + f.what));
}

module.exports = { loadModules, elementsOf, relationsOf, report };
