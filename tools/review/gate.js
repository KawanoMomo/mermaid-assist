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
const MIN_UNIT = 1084;
const MIN_E2E = 435;
const MIN_RENDER = 34;          // rename 26 + delete 8
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
// **どれが落ちたかを捨てない。**
//
// 1度「1 failed」とだけ出て、どのテストか分からず再現もしなかったことがある
// (2026-08-23)。ゲートは verify.sh とは別に e2e を回すので、**ここでしか
// 起きない失敗はここでしか見えない**。件数だけ出すのは、検査器で3回出た
// 「失敗が見えない書き方」と同じ型。
if (eFail && +eFail[1] > 0) {
  const lines = e2eOut.split('\n');
  const detail = lines.filter(function(l) { return /Error:|expect\(|\u2718|\u2717/.test(l); }).slice(0, 20);
  console.log('\n  --- e2e で落ちたもの ---');
  detail.forEach(function(l) {
    console.log('  ' + l.replace(/\u001b\[[0-9;]*m/g, '').trim().slice(0, 160));
  });
  console.log('  ------------------------');
}

// 並行レビュー。4観点すべてで指摘ゼロ。
// 実行済みの結果を読む (gate から起動すると2重に走って遅い)。
const outDir = path.join(__dirname, 'out');
const reviewers = ['r1-destructive', 'r2-delete', 'r3-render', 'r4-ui', 'r5-user', 'r6-move', 'r7-consistency', 'r8-scale', 'r9-workflow', 'r10-roundtrip', 'r11-specialchars', 'r12-noop', 'r13-unknown-syntax', 'r14-boundary', 'r15-state-carryover', 'r16-count-parity', 'r17-undo-redo', 'r18-keyboard-only', 'r19-coverage', 'r20-unicode-names', 'r21-reachable', 'r22-silent-failure', 'r23-add-renders', 'r24-move-renders', 'terms'];
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

let reviewTotal = 0, reviewMissing = [], reviewWho = [];
reviewers.forEach((r) => {
  const f = path.join(outDir, r + '.json');
  if (!fs.existsSync(f)) { reviewMissing.push(r); return; }
  if (fs.statSync(f).mtimeMs < srcTime) { reviewMissing.push(r + '(ソースより古い)'); return; }
  try {
    const n = JSON.parse(fs.readFileSync(f, 'utf8')).length;
    reviewTotal += n;
    if (n) reviewWho.push(r + ':' + n);
  } catch (e) { reviewMissing.push(r + '(壊れた出力)'); }
});
// **どのレビュアーが出したかまで、ここで言う。**
//
// 元は総数だけを出し、内訳は verify.sh 側が別に数えていた。**2つの情報源が
// 食い違い、片方 (verify.sh) が壊れていた** (どの実行でも 0 を返す数え方)。
// 判定はここ1本に寄せ、verify.sh は実行だけを担う。
check('LOOP', '並行レビューの指摘',
  reviewTotal === 0 && reviewMissing.length === 0,
  reviewMissing.length ? ('未実行: ' + reviewMissing.join(', '))
    : (reviewTotal ? (reviewTotal + ' 件 — ' + reviewWho.join(', ')) : '0 件'));

// 網羅率の下限。
//
// 「指摘0件」は検査した範囲の外では何も意味しない。実際 r11 は関数名の表で
// 対象を選んでいたので 21 図種中 6 図種しか見ておらず、その状態で 0 件だった。
// 契約ベースに直したら同じ観点のまま 47 件出た。観点を増やす前に、まず
// **見ている範囲が縮んでいないこと**を機械で押さえる。
//
// 下限は現状の実測値 (coverage-floor.json)。下回ったら FAIL。
// 上げるのは自由、下げるにはファイルを書き換える必要がある = 意図が記録に残る。
let covFail = [];
try {
  const floor = JSON.parse(fs.readFileSync(path.join(__dirname, 'coverage-floor.json'), 'utf8'));
  Object.keys(floor).forEach((r) => {
    const f = path.join(outDir, r + '.coverage.json');
    if (!fs.existsSync(f)) { covFail.push(r + ': 網羅率の記録が無い'); return; }
    const got = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (got.examined < floor[r].examined) {
      covFail.push(r + ': ' + got.examined + '/' + got.total +
        ' (下限 ' + floor[r].examined + ')');
    }
  });
} catch (e) { covFail.push('下限ファイルが読めない: ' + e.message); }
check('COV', 'レビューの網羅率', covFail.length === 0,
  covFail.length ? covFail.join(' / ') : '全観点が下限以上');

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

// 棚卸しが現実に追いついていること。
//
// これまでゲートは D 区分 (残) しか見ていなかった。そのため C 区分 (検証の仕組み)
// が **6ラウンド分・7項目遅れていても毎回 PASS していた**。
// 観点を足しても棚卸しに書かなければ、次に読む人はその観点の存在を知らない。
//
// 「プランが現実を写す測定器」であるためには、機械で照合できる部分は
// 機械で照合する。ここではレビュアーの実体と記録の対応だけを見る。
let missingDoc = [];
try {
  const bl = fs.readFileSync(path.join(ROOT, 'docs', 'backlog.md'), 'utf8');
  fs.readdirSync(__dirname)
    .filter(f => /^r\d+-.*\.js$/.test(f))
    .forEach(f => {
      const n = f.match(/^r(\d+)-/)[1];
      // 「R22」「r22」のどちらの書き方でもよい。R2 が R22 に誤って一致しないよう
      // 後ろに数字が続かないことまで見る。
      if (!new RegExp('[Rr]' + n + '(?![0-9])').test(bl)) missingDoc.push(f);
    });
} catch (e) { missingDoc.push('docs/backlog.md が読めない'); }
check('DOC', '棚卸しと実体の対応', missingDoc.length === 0,
  missingDoc.length ? ('棚卸しに記録が無い: ' + missingDoc.join(', ')) : '全レビュアーが記録されている');

// 棚卸しの散文が主張している「測れる事実」が今も正しいこと。
//
// A 区分 (テストで守られている) は抜き取り10件すべて記録どおりだったのに対し、
// E 区分 (判断を書いた文章のみ) は **5件中4件が誤っていた**。
// 同じ「済」でも、機械が触れる形かどうかで寿命が違う。
//
// `record-claims.js` は G1 (move: false のまま) / E2 (使える id を出さない) /
// E7 (別名の ; は引用符でも通らない) を実測する。
// 価値判断 (G2 のパネル構成、G3 の複写の意味) は正しく散文なので対象外。
let recFail = [];
try {
  const f = path.join(outDir, 'record-claims.json');
  if (!fs.existsSync(f)) recFail.push('未実行');
  else if (fs.statSync(f).mtimeMs < srcTime) recFail.push('ソースより古い');
  else {
    const items = JSON.parse(fs.readFileSync(f, 'utf8'));
    items.forEach((x) => recFail.push(x.module + '.' + x.fn));
  }
} catch (e) { recFail.push('読めない: ' + e.message); }
check('REC', '棚卸しの主張の検証', recFail.length === 0,
  recFail.length ? recFail.join(' / ') : '3件の主張が今も正しい');

// バックログ (G区分) の**前提**が今も成り立っていること。
//
// G区分は「やらないが捨てていない」項目で、それぞれに先送りしてよい理由が
// 書いてある。理由が崩れたら先送りできないのに、**崩れたことを誰も
// 監視していなかった**。
//
// 実例: G4 は「契約経由で add を呼ぶのは検査とテストだけ」を理由に
// 先送りし、復活条件を「その経路を作る時点」と書いた。**その経路は6ラウンド後に
// 私自身が r8 を書き換えたときに作っていた** — 気付いたのは偶然だった。
//
// 人が決める項目 (訳す範囲・案の選択) は自動化できない。**どちらなのかを
// 項目ごとに宣言させる**ところまでを機械で強制する。
let premiseFail = [];
try {
  const f = path.join(outDir, 'backlog-premises.json');
  if (!fs.existsSync(f)) premiseFail.push('未実行');
  else if (fs.statSync(f).mtimeMs < srcTime) premiseFail.push('ソースより古い');
  else {
    const items = JSON.parse(fs.readFileSync(f, 'utf8'));
    items.forEach((x) => premiseFail.push(x.module + '.' + x.fn));
  }
} catch (e) { premiseFail.push('読めない: ' + e.message); }
check('PREMISE', 'バックログの前提', premiseFail.length === 0,
  premiseFail.length ? premiseFail.join(' / ') : '全項目の前提が成り立っている');

// SILENT: **失敗が見えない書き方**を機械が弾く。
//
// 同じ型を3回踏んだ:
//   1. 指摘の数え方が、どの実行でも必ず 0 を返した (R69)
//   2. step が終了コードを握り潰し、|| exit 1 が発火しなかった (R74)
//   3. レビュアーの出力とエラーを捨てた (R75)
//
// **どれも「検査器が自分の失敗を報告できない」形。**
// 人の注意力で防ぐのは3回失敗した。機械が弾く。
//
// 検査するのは tools/review/ の中だけ。gate.js 自身は判定者なので対象外。
const silentBad = [];
try {
  const revDir = path.join(ROOT, 'tools', 'review');
  fs.readdirSync(revDir).filter((f) => /\.(sh|js|py)$/.test(f)).forEach((f) => {
    if (f === 'gate.js') return;
    const src = fs.readFileSync(path.join(revDir, f), 'utf8');
    src.split('\n').forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith('#') || t.startsWith('//')) return;
      if (/>\s*\/dev\/null\s+2>&1/.test(t)) {
        silentBad.push(f + ':' + (i + 1) + ' 出力とエラーを両方捨てている');
      }
      if (/grep\s+-c[A-Za-z]*\s+.*(Blocker|Major|Minor|Nit)/.test(t)) {
        silentBad.push(f + ':' + (i + 1) + ' 標準出力を数えて判定している');
      }
    });
  });
} catch (e) { silentBad.push('走査できない: ' + e.message); }
check('SILENT', '失敗が見える書き方', silentBad.length === 0,
  silentBad.length ? silentBad.slice(0, 4).join(' / ')
    : '検査器が自分の失敗を隠す書き方は無い');
// VERSION: 版が中身を識別できているか。
//
// 画面に版を出した (B30) が、**それが何を識別しているか**は測っていなかった。
// 測ったら `v1.2.0` のまま **258 コミット / 実装変更 151 回**が積まれており、
// その間に欠陥117件を直し機能36件を足していた。**版は何も識別していなかった。**
//
// 直し方の候補は測って落とした: ビルド時の埋め込み (**ビルド工程が無い**) /
// 実行時に自分を読む (**file:// では fetch できない** — 実測で TypeError) /
// 人が手で上げる (B30 で避けた「2箇所を人が揃える」失敗形)。
//
// 残るのは「**上げ忘れを機械が言う**」。いつ上げるかは人が決める。
let verFail = [];
try {
  const f = path.join(outDir, 'version-freshness.json');
  if (!fs.existsSync(f)) verFail.push('未実行');
  else {
    const items = JSON.parse(fs.readFileSync(f, 'utf8'));
    items.forEach((x) => verFail.push(x.what));
  }
} catch (e) { verFail.push('読めない: ' + e.message); }
check('VERSION', '版の鮮度', verFail.length === 0,
  verFail.length ? verFail.join(' / ') : '版が実装の変化に追いついている');

// ── ABSENCE は撤去した (T3 の再評価による) ─────────────────────────
//
// 「無い」と書いた指摘に根拠の引用を要求する門を足したが、**効かなかった**。
//
// 過去31ラウンド (R30〜R60) に遡って当てた実測:
//   広い言い方   … 該当56段落 / FAIL 47件 / 通過率 16.1%
//   強い言い方のみ … 該当30段落 / FAIL 25件 / 通過率 16.7%
//   断定のみ     … 該当26段落 / FAIL 21件 / 通過率 19.2%
//   断定+指摘の文脈 … 該当 5段落 / FAIL  3件 / 通過率 40%
//
// どの強さでも門にならない。**ほとんど通る状態でなければ門は機能しない**
// — 落ちても信じなくなるのは C76 (再現しない指摘) と同じ害。
//
// 効かなかった根本の理由: **誤った主張は会話で出され、記録に載るのは
// 撤回した後**。記録を検査しても、主張ではなく散文を罰するだけだった。
//
// 本当の最頻パターンは「無いと書く」ではなく**「既定の状態だけを測る」**
// (C82 古い版 / C83 概観モードだけ / B34 の理由文 ひな形だけ、で3回)。
// これは散文の検査では捕まらない。**振る舞いの指摘は、その場限りの
// プローブではなく r系レビュアー (21図種を必ず走査する) として足す**
// のが対策になる。C83 は概観/詳細の両方を走るレビュアーなら出なかった。

const failed = results.filter(r => !r.ok);
console.log('');
results.forEach(r => console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' +
  r.id.padEnd(9) + r.label.padEnd(18) + r.detail));
console.log('');
console.log(failed.length === 0 ? '合格' : ('不合格 — ' + failed.length + ' 項目'));
process.exit(failed.length === 0 ? 0 : 1);
