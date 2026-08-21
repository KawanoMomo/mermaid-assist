'use strict';
// 欄名の表記ゆれ。
//
// 実測 (2026-08-21): 「名前」を指す欄が **9通り**あった。
//
//   ラベル 33 / ID 15 / Name 9 / Title 8 / Text 6 / id 3 /
//   `id (任意)` / `name` / `Name (1単語)` / タイトル / 名前 / クラス名 /
//   エンティティ名 / グループID / Branch name
//
// 図種を跨ぐと同じ欄を毎回読み直すことになる。EA / Visio は図の種類が
// 変わっても Name / Description の語が変わらない。
//
// 3語に決めた。**意味で分ける**ので、機械が判定できる。
//
//   ID     他の行から参照される識別子 (消すと参照が壊れる)
//   ラベル  図に出る文字で、他の行から参照されないもの
//   タイトル 図全体の題
//
// 直しただけでは戻る。散文の規約は守られないことが分かっているので
// (E 区分の再検証で 5件中4件が誤りだった)、機械が数えてゲートに載せる。
//
// 対象は「名前を指す欄」に限る。ドメイン用語 (遷移 / 関連 / リレーション) は
// **潰さない**。UML の「遷移」をクラス図の「関連」と同じ語にするのは
// 一貫性ではなく誤りで、批判レビューの改善案の方が間違っていた。
const fs = require('fs');
const path = require('path');
const { report } = require('./lib');
const ROOT = process.argv[2];

// 名前らしき欄名。ここに挙がったものは 3語のどれかでなければならない。
// 「名前を指す欄」の見分け方。ここが狭いと、直した3語自体が数に入らず
// 「名前を指すもの 1種」という嘘の集計になる (最初そうなっていた)。
const NAMEISH = /^(name|text|title|id|label|ラベル|タイトル|名前|見出し|題)|(名|ID|name|Name|id)$/;
const ALLOWED = ['ID', 'ラベル', 'タイトル'];
// 「(1単語)」「(任意)」のような但し書きは付けてよい
function core(s) { return s.replace(/\s*\(.*\)\s*$/, '').trim(); }

const findings = [];
const counts = {};
const dir = path.join(ROOT, 'src', 'modules');
let total = 0;
fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach((f) => {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/(?:select)?fieldHtml\(\s*'([^']*)'/);
    if (!m) return;
    total++;
    const raw = m[1];
    const c = core(raw);
    (counts[c] = counts[c] || []).push(f.replace('.js', '') + ':' + (i + 1));
    if (!NAMEISH.test(c)) return;
    if (ALLOWED.indexOf(c) >= 0) return;
    findings.push({ module: f.replace('.js', ''), fn: 'T1 欄名',
      what: '名前を指す欄が 3語 (ID / ラベル / タイトル) の外: ' + JSON.stringify(raw) +
            ' (' + f.replace('.js', '') + ':' + (i + 1) + ')' });
  });
});

// 大小の違いだけで別表記になっているもの (target と Target など)
const seen = {};
Object.keys(counts).forEach((k) => {
  const low = k.toLowerCase();
  (seen[low] = seen[low] || []).push(k);
});
Object.keys(seen).forEach((low) => {
  if (seen[low].length > 1) {
    findings.push({ module: '(横断)', fn: 'T2 大小のゆれ',
      what: '同じ語が大小違いで併存: ' + seen[low].map(x => JSON.stringify(x)).join(' / ') +
            ' — ' + seen[low].map(x => counts[x].join(',')).join(' / ') });
  }
});

const nameish = Object.keys(counts).filter(k => NAMEISH.test(k));
// 欄名の日英混在。**まだ直していない**ので指摘にはしないが、数だけ出す。
// 出さないと「0件 = 揃っている」に見えてしまう。
// mermaid のキーワードそのもの (docref / risk / tag …) は原語が正しいので、
// 小文字だけの語は数から外す。
const en = Object.keys(counts).filter(k => /^[A-Za-z]/.test(k) && k !== 'ID' &&
  !/[ぁ-んァ-ヶ一-龠]/.test(k) && !/^[a-z]+$/.test(k));
const jp = Object.keys(counts).filter(k => /[ぁ-んァ-ヶ一-龠]/.test(k));
const kw = Object.keys(counts).filter(k => /^[a-z]+$/.test(k));
console.log('  (欄名の言語: 日本語 ' + jp.length + ' 種 / 英語 ' + en.length +
  ' 種 (' + en.slice(0, 12).join(',') + (en.length > 12 ? ',…' : '') + ') / ' +
  'mermaid のキーワード ' + kw.length + ' 種 (' + kw.join(',') + ')' +
  ' — 英語の分は UI-030 として未処理)');
console.log('  (欄名 ' + total + ' 箇所 / 異なり ' + Object.keys(counts).length + ' 種 / ' +
  'そのうち名前を指すもの ' + nameish.length + ' 種: ' + nameish.join(',') + ')');
report('terms', findings, { total: 21, examined: 21 });
