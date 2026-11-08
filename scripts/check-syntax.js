'use strict';
// scripts/build.ps1 から呼ぶ構文確認。ビルド工程の無い単一 HTML なので、
// 「ブラウザで開いて最初の script で落ちる」を開く前に止めるのがここの役目。
//   1. src/ 配下の *.js を全部 vm.Script でコンパイルする(実行はしない)
//   2. mermaid-assist.html のインライン <script> も同じくコンパイルする
//   3. mermaid-assist.html の <script src> と <link href> が指すファイルが在る
// 失敗があれば一覧を出して exit 1。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'mermaid-assist.html');
const errors = [];

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function compile(code, name) {
  try { new vm.Script(code, { filename: name }); }
  catch (e) { errors.push(name + ': ' + String(e && e.message || e).split('\n')[0]); }
}

const srcFiles = walk(path.join(ROOT, 'src'), []);
for (const f of srcFiles) compile(fs.readFileSync(f, 'utf8'), path.relative(ROOT, f));

let inline = 0, refs = 0;
if (!fs.existsSync(HTML)) {
  errors.push('mermaid-assist.html is missing');
} else {
  const html = fs.readFileSync(HTML, 'utf8');
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptRe.exec(html))) {
    const attrs = m[1];
    const src = (attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (src) {
      refs++;
      if (!/^(https?:)?\/\//i.test(src) && !fs.existsSync(path.join(ROOT, src))) errors.push('mermaid-assist.html: script src not found: ' + src);
    } else if (!/type\s*=\s*["'](?!text\/javascript|module)/i.test(attrs)) {
      inline++;
      compile(m[2], 'mermaid-assist.html <script #' + inline + '>');
    }
  }
  const linkRe = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((m = linkRe.exec(html))) {
    const href = m[1];
    if (/^(https?:|data:|#)/i.test(href) || href.startsWith('//')) continue;
    refs++;
    if (!fs.existsSync(path.join(ROOT, href))) errors.push('mermaid-assist.html: link href not found: ' + href);
  }
}

if (errors.length) {
  console.log('syntax: NG (' + errors.length + ')');
  for (const e of errors) console.log('  - ' + e);
  process.exit(1);
}
console.log('syntax: OK (src ' + srcFiles.length + ' files, html inline ' + inline + ', refs ' + refs + ')');
