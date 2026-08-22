'use strict';
// 版が中身を識別できているか (E13 / UI-059)。
//
// 画面に版を出すようにした (B30) が、**それが何を識別しているか**は測って
// いなかった。測ったら:
//
//   VERSION 最終更新: 2026-04-16 (f34a81b)
//   以降のコミット  : 258
//   うち src を触ったもの: 151
//   その間に直した欠陥: 117 件 / 足した機能: 36 件
//
// **`v1.2.0` は 258 コミット分を1つの番号で表している。** 利用者が74コミット
// 遅れていたときも版は `1.2.0` のままで、**版だけでは修正が入っているか
// 判別できなかった**。実際その調査に大半の時間を使った。
//
// 直し方の候補を測って落とした:
//   - ビルド時にコミットハッシュを埋める … **ビルド工程が無い**
//   - 実行時に自分自身を読んで指紋を作る … **file:// では fetch できない**
//     (実測: `TypeError: Failed to fetch`)
//   - 人が手で上げる … B30 で避けた「人が2箇所を揃える」失敗形に戻る
//
// 残るのは「**上げ忘れを機械が言う**」。ここでは判断も修正もしない。
// **src を触ったのに版が据え置きなら、その事実を数えて出す。**
// いつ上げるかは人が決める (リリースの粒度は価値判断)。
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { report } = require('./lib');
const ROOT = process.argv[2];

// 何コミット分の据え置きまでを許すか。
//
// 0 にすると src を触るたびに落ちる = 版を上げるまで作業が進まない。
// リリースの粒度は人が決めるものなので、そこまで縛らない。
// **今の 151 は明らかに多すぎる**ので、まず桁を1つ落とす所に置く。
const MAX_STALE_COMMITS = 30;

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (e) { return ''; }
}

const findings = [];
const versionPath = path.join(ROOT, 'VERSION');

if (!fs.existsSync(versionPath)) {
  findings.push({ module: 'VERSION', fn: '版の鮮度', what: 'VERSION ファイルが無い' });
} else {
  // **まだコミットしていない版上げも数える。**
  //
  // 最初はコミット履歴だけを見ていた。版を 1.3.0 に上げた直後にもう一度
  // 回したら、まだ落ちた — 変更が作業ツリーにしか無いので、git から見ると
  // 最終更新は 4 か月前のままだった。
  // **直したのに落ちる検査は、直す気を削ぐ。** 作業ツリーの状態も見る。
  // **「差分があるか」ではなく「値が変わったか」を見る。**
  //
  // 最初は `git diff --name-only` で差分の有無だけを見ていた。
  // 変異で 1.2.0 に戻しても**差分は残る**ので通過してしまい、検出力が無かった。
  // HEAD の値と今の値を比べる。
  const nowVer = fs.readFileSync(versionPath, 'utf8').trim();
  const headVer = git(['show', 'HEAD:VERSION']).trim();
  if (headVer && nowVer !== headVer) {
    report('version-freshness', [], { examined: 1, total: 1, label: '版の鮮度' });
    console.log('[version-freshness] findings=0 / 検めた版 1件 (' +
      headVer + ' → ' + nowVer + ' に上げたところ・未コミット)');
    return;
  }
  const lastBump = git(['log', '-1', '--format=%H', '--', 'VERSION']);
  if (!lastBump) {
    findings.push({ module: 'VERSION', fn: '版の鮮度',
      what: 'VERSION を触ったコミットが見つからない (git 履歴が読めない)' });
  } else {
    // 版を上げてから、実装 (src / 単一HTML) を触ったコミットが何本あるか。
    // ドキュメントやテストだけの変更は数えない — 利用者の見る挙動が
    // 変わっていないなら、版が同じでも識別できている。
    const n = git(['rev-list', '--count', lastBump + '..HEAD',
      '--', 'src', 'mermaid-assist.html']);
    const count = parseInt(n, 10);
    if (isFinite(count) && count > MAX_STALE_COMMITS) {
      const v = fs.readFileSync(versionPath, 'utf8').trim();
      const when = git(['log', '-1', '--format=%ad', '--date=short', '--', 'VERSION']);
      findings.push({ module: 'VERSION', fn: '版の鮮度',
        what: '版 ' + v + ' のまま実装を ' + count + ' 回変えている (最終更新 ' + when +
              ' / 上限 ' + MAX_STALE_COMMITS + ')。版だけでは中身を識別できない' });
    }
  }
}

report('version-freshness', findings, { examined: 1, total: 1, label: '版の鮮度' });
console.log('[version-freshness] findings=' + findings.length + ' / 検めた版 1件');
findings.forEach((f) => console.log('  - ' + f.what));
