'use strict';
// 版の正本は VERSION(1 行の x.y.z)。package.json・package-lock.json・画面の #status-version は
// ここから導く。人が 4 箇所を揃えるのは必ず失敗するので、揃えるのも確かめるのもこのスクリプト。
//
//   node scripts/version.js                 確かめる(既定)。ずれていれば一覧を出して exit 1
//   node scripts/version.js set 1.18.0      VERSION を 1.18.0 にし、残りを揃える
//   node scripts/version.js sync            VERSION の値で残りを揃える(VERSION は触らない)
//   node scripts/version.js fingerprint     画面に出る「コードの指紋」を実ブラウザで取る(要 Playwright)
// npm からは: npm run version:check / npm run version:set -- 1.18.0
//
// リリース(タグ)の手順: `node scripts/version.js set {x.y.z}` → コミット → `git tag v{x.y.z}`。
// 出力の fingerprint をリリースの記録に残すと、利用者の画面の `#xxxxxxxxxxxx` と突き合わせられる。
const fs = require('fs');
const path = require('path');

const SEMVER = /^\d+\.\d+\.\d+$/;
const HTML_RE = /(id="status-version"[^>]*>)v?([^<]*)(<)/;

function files(root) {
  return {
    version: path.join(root, 'VERSION'),
    pkg: path.join(root, 'package.json'),
    lock: path.join(root, 'package-lock.json'),
    html: path.join(root, 'mermaid-assist.html'),
  };
}

// 4 箇所の値を読む。無い箇所は null。
function readAll(root) {
  const f = files(root);
  const out = { VERSION: null, 'package.json': null, 'package-lock.json': null, 'mermaid-assist.html': null };
  if (fs.existsSync(f.version)) out.VERSION = fs.readFileSync(f.version, 'utf8').trim();
  if (fs.existsSync(f.pkg)) out['package.json'] = JSON.parse(fs.readFileSync(f.pkg, 'utf8')).version || null;
  if (fs.existsSync(f.lock)) {
    const lock = JSON.parse(fs.readFileSync(f.lock, 'utf8'));
    const inner = lock.packages && lock.packages[''] ? lock.packages[''].version : lock.version;
    out['package-lock.json'] = lock.version === inner ? lock.version : (lock.version + ' / ' + inner);
  }
  if (fs.existsSync(f.html)) {
    const m = fs.readFileSync(f.html, 'utf8').match(HTML_RE);
    out['mermaid-assist.html'] = m ? m[2] : null;
  }
  return out;
}

// ずれの一覧(空なら揃っている)
function check(root) {
  const v = readAll(root);
  const problems = [];
  if (!v.VERSION || !SEMVER.test(v.VERSION)) problems.push('VERSION が x.y.z でない: ' + v.VERSION);
  for (const k of Object.keys(v)) {
    if (k === 'VERSION') continue;
    if (v[k] !== v.VERSION) problems.push(k + ' = ' + v[k] + '(VERSION = ' + v.VERSION + ')');
  }
  return { values: v, problems };
}

// JSON の "version" を書き換える。整形と改行コードはそのまま保つ(1 行の差分にする)。
function replaceJsonVersion(text, ver, all) {
  let n = 0;
  return text.replace(/("version"\s*:\s*")[^"]*(")/g, (m, a, b) => {
    n++;
    // package-lock.json は先頭の version と packages[""].version の 2 つだけ(依存の version は触らない)
    return (all || n === 1) ? a + ver + b : m;
  });
}

function sync(root, ver) {
  const f = files(root);
  if (!SEMVER.test(ver)) throw new Error('版は x.y.z: ' + ver);
  const changed = [];
  const write = (p, before, after) => { if (before !== after) { fs.writeFileSync(p, after); changed.push(path.basename(p)); } };

  const vText = fs.existsSync(f.version) ? fs.readFileSync(f.version, 'utf8') : '';
  const eol = /\r\n/.test(vText) ? '\r\n' : '\n';
  write(f.version, vText, ver + eol);

  const pkg = fs.readFileSync(f.pkg, 'utf8');
  write(f.pkg, pkg, replaceJsonVersion(pkg, ver, false));

  if (fs.existsSync(f.lock)) {
    const lock = fs.readFileSync(f.lock, 'utf8');
    // 先頭の version と、packages[""] の中の最初の version
    let out = replaceJsonVersion(lock, ver, false);
    out = out.replace(/("packages"\s*:\s*\{\s*""\s*:\s*\{[^{}]*?"version"\s*:\s*")[^"]*(")/, (m, a, b) => a + ver + b);
    write(f.lock, lock, out);
  }

  const html = fs.readFileSync(f.html, 'utf8');
  if (!HTML_RE.test(html)) throw new Error('mermaid-assist.html に #status-version が無い');
  write(f.html, html, html.replace(HTML_RE, (m, a, old, c) => a + 'v' + ver + c));
  return changed;
}

async function fingerprint(root) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto('file:///' + path.join(root, 'mermaid-assist.html').split(path.sep).join('/'));
    await page.waitForFunction(() => window.MA && window.MA.buildId && window.MA.buildId.fingerprint);
    return await page.evaluate(() => window.MA.buildId.fingerprint);
  } finally {
    await browser.close();
  }
}

module.exports = { readAll, check, sync, replaceJsonVersion, SEMVER };

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const [cmd, arg] = process.argv.slice(2);
  (async () => {
    if (!cmd || cmd === 'check') {
      const r = check(root);
      if (r.problems.length) {
        console.log('version: ずれ (' + r.problems.length + ')');
        r.problems.forEach((p) => console.log('  - ' + p));
        console.log('  揃えるには: node scripts/version.js sync(VERSION に合わせる)か set x.y.z');
        process.exit(1);
      }
      console.log('version: ' + r.values.VERSION + '(VERSION / package.json / package-lock.json / #status-version 一致)');
    } else if (cmd === 'set' || cmd === 'sync') {
      const ver = cmd === 'set' ? arg : readAll(root).VERSION;
      const changed = sync(root, ver);
      console.log('version: ' + ver + ' に揃えた' + (changed.length ? '(' + changed.join(', ') + ')' : '(変更なし)'));
      const r = check(root);
      if (r.problems.length) { r.problems.forEach((p) => console.log('  - ' + p)); process.exit(1); }
      try { console.log('fingerprint: #' + await fingerprint(root)); } catch (e) { console.log('fingerprint: 取れない(' + String(e.message || e).split('\n')[0] + ')'); }
    } else if (cmd === 'fingerprint') {
      console.log(await fingerprint(root));
    } else {
      console.log('usage: node scripts/version.js [check | set x.y.z | sync | fingerprint]');
      process.exit(2);
    }
  })().catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
}
