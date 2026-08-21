'use strict';
// 合格判定。docs/quality-gate.md の G1〜G7 を、人の読み取りではなく
// **数値と終了コード**で判定する。
//
//   node tools/review/gate.js <リポジトリのパス>
//
// 終了コード 0 = PASS、1 = FAIL。
// 「だいたい直った」で終わらせないための最後の関門なので、閾値は下げない。
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || process.cwd();

// 下限。既存の件数を割り込んだら、テストが消されたということ。
const MIN_UNIT = 812;
const MIN_E2E = 357;
const MIN_RENDER = 30;          // rename 22 + delete 8
const MIN_RENDER_SUITES = 2;    // case ファイルの本数。1本消されても気付けるように

const results = [];
function check(id, label, ok, detail) {
  results.push({ id, label, ok, detail });
}

function run(cmd, args, opts) {
  try {
    return execFileSync(cmd, args, Object.assign({ cwd: ROOT, encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }, opts || {}));
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

// G1/G3: ユニット。件数の下限と、失敗ゼロ。
const unitOut = run(process.execPath, ['tests/run-tests.js']);
const um = unitOut.match(/(\d+)\s+passed,\s+(\d+)\s+failed/);
const uPass = um ? +um[1] : 0, uFail = um ? +um[2] : 1;
check('G1/G3', 'ユニット', uFail === 0 && uPass >= MIN_UNIT,
  uPass + ' passed / ' + uFail + ' failed (下限 ' + MIN_UNIT + ')');

// G2: 実描画オラクル。描画差分ゼロ。
// オラクルは複数の case ファイルを続けて回すので、集計行も複数出る。
// exec だと最初の1本しか読まず、2本目が全滅していても気付かない。全部足す。
const renderOut = run('npm', ['run', '--silent', 'test:render'], { shell: true });
const rAll = [...renderOut.matchAll(/描画差分なし \((\d+) ケース\)/g)];
const rSum = rAll.reduce((n, m) => n + (+m[1]), 0);
const rSuites = rAll.length;
check('G2', '実描画オラクル', rSuites >= MIN_RENDER_SUITES && rSum >= MIN_RENDER,
  rSum + ' ケース / ' + rSuites + ' 本で差分なし (下限 ' + MIN_RENDER + ' ケース・' +
  MIN_RENDER_SUITES + ' 本)');

// G4/G5: e2e。実ブラウザでの操作を通す。
const e2eOut = run('npx', ['playwright', 'test', '--reporter=line'], { shell: true });
const em = e2eOut.match(/(\d+)\s+passed/);
const eFail = /(\d+)\s+failed/.exec(e2eOut);
const ePass = em ? +em[1] : 0;
check('G4/G5', 'e2e', (!eFail || +eFail[1] === 0) && ePass >= MIN_E2E,
  ePass + ' passed' + (eFail ? ' / ' + eFail[1] + ' failed' : '') + ' (下限 ' + MIN_E2E + ')');

// 並行レビュー。4観点すべてで指摘ゼロ。
// 実行済みの結果を読む (gate から起動すると2重に走って遅い)。
const outDir = path.join(__dirname, 'out');
const reviewers = ['r1-destructive', 'r2-delete', 'r3-render', 'r4-ui', 'r5-user', 'r6-move', 'r7-consistency', 'r8-scale', 'r9-workflow', 'r10-roundtrip', 'r11-specialchars', 'r12-noop', 'r13-unknown-syntax', 'r14-boundary', 'r15-state-carryover', 'r16-count-parity', 'r17-undo-redo'];
//
// 出力の**鮮度**も見る。ここを見ていなかったせいで、変異注入したときの
// 結果ファイルがそのまま残り、ゲートが古いソースへの指摘を読んでいた。
// 「レビュー済み」と「今のソースをレビュー済み」は別の述語である。
function newestSourceTime(dir) {
  let t = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(js|html|css)$/.test(e.name)) t = Math.max(t, fs.statSync(full).mtimeMs);
    }
  };
  walk(path.join(dir, 'src'));
  const html = path.join(dir, 'mermaid-assist.html');
  if (fs.existsSync(html)) t = Math.max(t, fs.statSync(html).mtimeMs);
  return t;
}
const srcTime = newestSourceTime(ROOT);

let reviewTotal = 0, reviewMissing = [];
reviewers.forEach((r) => {
  const f = path.join(outDir, r + '.json');
  if (!fs.existsSync(f)) { reviewMissing.push(r); return; }
  if (fs.statSync(f).mtimeMs < srcTime) { reviewMissing.push(r + '(ソースより古い)'); return; }
  try { reviewTotal += JSON.parse(fs.readFileSync(f, 'utf8')).length; }
  catch (e) { reviewMissing.push(r + '(壊れた出力)'); }
});
check('LOOP', '並行レビューの指摘',
  reviewTotal === 0 && reviewMissing.length === 0,
  reviewMissing.length ? ('未実行: ' + reviewMissing.join(', ')) : (reviewTotal + ' 件'));

// G7: 権利。LICENSE と package.json の整合、同梱物のライセンス同梱。
let rights = true, rightsDetail = [];
if (!fs.existsSync(path.join(ROOT, 'LICENSE'))) { rights = false; rightsDetail.push('LICENSE 無し'); }
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const lic = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
  const declared = pkg.license;
  const inFile = /MIT License/.test(lic) ? 'MIT' : (/ISC/.test(lic) ? 'ISC' : '?');
  if (declared !== inFile) { rights = false; rightsDetail.push('package.json=' + declared + ' / LICENSE=' + inFile); }
} catch (e) { rights = false; rightsDetail.push('読めない'); }
if (fs.existsSync(path.join(ROOT, 'lib', 'mermaid.min.js')) &&
    !fs.existsSync(path.join(ROOT, 'lib', 'LICENSE.mermaid'))) {
  rights = false; rightsDetail.push('同梱 mermaid のライセンス全文が無い');
}
check('G7', '権利', rights, rightsDetail.length ? rightsDetail.join(' / ') : '整合');

// 棚卸しに「残」が無いこと。着手中のものが残っていれば FAIL。
let backlogOpen = -1;
try {
  const bl = fs.readFileSync(path.join(ROOT, 'docs', 'backlog.md'), 'utf8');
  const section = bl.split('## D. 残')[1] || '';
  const body = section.split('## E.')[0] || '';
  backlogOpen = (body.match(/^\|\s*D\d+\s*\|/gm) || []).length;
} catch (e) { /* 無ければ -1 */ }
check('BACKLOG', '棚卸しの未着手', backlogOpen === 0,
  backlogOpen < 0 ? 'docs/backlog.md が読めない' : (backlogOpen + ' 件が「残」'));

const failed = results.filter(r => !r.ok);
console.log('');
results.forEach(r => console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' +
  r.id.padEnd(9) + r.label.padEnd(18) + r.detail));
console.log('');
console.log(failed.length === 0 ? '合格' : ('不合格 — ' + failed.length + ' 項目'));
process.exit(failed.length === 0 ? 0 : 1);
