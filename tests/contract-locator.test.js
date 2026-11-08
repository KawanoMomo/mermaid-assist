'use strict';
// 契約 (ADR-012 operations.delete / update) の位置決めは行番号。opts.id は参考値。
// 決定と理由: docs/adr/drafts/contract-locator-line-number.md (backlog E8 の処分)。
//
// 守るのは「同じ本文の parse から取った行番号と opts.id を渡せば、名指しした要素に届く」こと。
// 行番号がずれた本文で opts.id だけを頼りに正しい要素へ届くことは契約に含めない
// (2026-11-08 再実測: id で全文を引けるのは class / er / flowchart / sankey / sequence / state の 6 図種、
//  8 図種の id は位置からの自動採番で本文に存在しない)。
var M = window.MA.modules;

function keyed(mod, text) {
  return (mod.parse(text).elements || []).map(function(e) { return e.kind + ':' + e.id; });
}

// 本文に ID として書かれていて、図の中で一意な要素だけを名指しの対象にする
function namedElements(mod, text) {
  var els = mod.parse(text).elements || [];
  var count = {};
  els.forEach(function(e) { var k = e.kind + ':' + e.id; count[k] = (count[k] || 0) + 1; });
  return els.filter(function(e) {
    if (typeof e.id !== 'string' || !e.id || !e.line) return false;
    if (count[e.kind + ':' + e.id] !== 1) return false;
    var esc = e.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^\\w])' + esc + '([^\\w]|$)', 'm').test(text);
  });
}

describe('契約: 同じ本文の行番号 + opts.id で名指しした要素が消える (G1)', function() {
  Object.keys(M).sort().forEach(function(key) {
    var mod = M[key];
    if (!mod || !mod.template || !mod.parse || !mod.operations) return;
    if (typeof mod.operations.delete !== 'function') return;
    var t = mod.template();
    var named = namedElements(mod, t);
    if (!named.length) return;   // 自動採番だけの図種 (pie / quadrant / packet …) は行番号だけで決まる
    test(key + ': ' + named.length + ' 要素', function() {
      named.forEach(function(el) {
        var k = el.kind + ':' + el.id;
        var out = mod.operations.delete(t, el.line, { kind: el.kind, id: el.id });
        expect(out).not.toBe(t);
        var after = keyed(mod, out);
        expect(after).not.toContain(k);
        // 同じ行を共有する隣の要素は残る (行ごと消すと隣を巻き込む)
        named.forEach(function(o) {
          if (o === el || o.line !== el.line) return;
          expect(after).toContain(o.kind + ':' + o.id);
        });
      });
    });
  });
});

describe('契約: opts.id は参考値 (ADR ドラフトに明記)', function() {
  var fs = require('fs');
  var path = require('path');
  var p = path.join(__dirname, '..', 'docs', 'adr', 'drafts', 'contract-locator-line-number.md');
  test('ADR ドラフトがあり、位置決めは行番号・opts.id は参考値と書いてある', function() {
    expect(fs.existsSync(p)).toBe(true);
    var s = fs.readFileSync(p, 'utf8');
    expect(s).toContain('参考値');
    expect(s).toContain('行番号');
  });
});
