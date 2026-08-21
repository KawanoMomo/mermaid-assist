'use strict';
// requirementDiagram の日本語名と、空欄の属性。
//
// 記録にはこう書いてあった。
//
//   > requirement 図の要求名・要素名は識別子なので半角しか通らない
//
// **記録の方が誤っていた。** architecture (A83) と同じ形で、引用符で通る:
//
//   requirement "受信要求" { … }   → 「<<Requirement>>受信要求」を描画 (v11.13)
//
// 逆向きの検査 (r16 P2) を requirementDiagram まで広げて見つけた。
// 直す途中で、日本語とは無関係の欠陥が3つ出た:
//
//   1. 「+ 要件追加」「+ エレメント追加」が空の `id: ""` `text: ""` `type: ""` を
//      出しており、**押しただけで図が壊れていた**。mermaid は空の属性を拒否し、
//      行そのものを省けば通る (実測)。
//   2. operations.update が kind を先に見ていたため、エレメントの改名が
//      type/docref しか知らない関数に流れて**無反応**だった。
//      パネルは updateName を直に呼ぶので、UI では動いて契約では動かなかった。
//   3. 関係行を読む正規表現が裸の英数字のみで、日本語の端点を持つ関係を
//      編集しても**無反応**だった。

var R = window.MA.modules.requirementDiagram;

function names(t) { return R.parse(t).elements.map(function(e) { return e.name; }); }
function rels(t) {
  return (R.parse(t).relations || []).map(function(r) { return r.from + '-' + r.reltype + '->' + r.to; });
}

describe('requirementDiagram: 日本語名', function() {
  var t = R.template();

  test('RU-1: 日本語の要求名に引用符が付く', function() {
    var out = R.operations.add(t, 'requirement', { reqType: 'requirement', name: '受信要求' });
    expect(out).toContain('requirement "受信要求" {');
    expect(names(out)).toContain('受信要求');
  });

  test('RU-2: 半角英数字の名前には引用符を付けない', function() {
    var out = R.operations.add(t, 'requirement', { reqType: 'requirement', name: 'recv_req' });
    expect(out).toContain('requirement recv_req {');
    expect(out).not.toContain('"recv_req"');
  });

  test('RU-3: 日本語のエレメント名と関係の端点が読み直せる', function() {
    var out = R.operations.add(t, 'element', { name: '検証装置' });
    out = R.operations.add(out, 'relation', { from: '検証装置', reltype: 'verifies', to: 'sample_req' });
    expect(names(out)).toContain('検証装置');
    expect(rels(out)).toContain('検証装置-verifies->sample_req');
  });

  test('RU-4: 日本語名のエレメントを消すと関係も道連れになる', function() {
    var out = R.operations.add(t, 'element', { name: '検証装置' });
    out = R.operations.add(out, 'relation', { from: '検証装置', reltype: 'verifies', to: 'sample_req' });
    var el = R.parse(out).elements.filter(function(e) { return e.name === '検証装置'; })[0];
    var after = R.operations.delete(out, el.line, { kind: 'element', id: '検証装置' });
    expect(names(after)).not.toContain('検証装置');
    expect(rels(after).join()).not.toContain('検証装置');
  });

  test('RU-5: 要求を日本語に改名すると関係の端点も追従する', function() {
    var rq = R.parse(t).elements.filter(function(e) { return e.kind === 'requirement'; })[0];
    var out = R.operations.update(t, rq.line, 'name', '受信要求', { oldName: rq.name });
    expect(names(out)).toContain('受信要求');
    expect(rels(out)).toContain('sample_elem-satisfies->受信要求');
  });

  test('RU-6: 日本語から半角に戻せる (引用符が外れる)', function() {
    var rq = R.parse(t).elements.filter(function(e) { return e.kind === 'requirement'; })[0];
    var out = R.operations.update(t, rq.line, 'name', '受信要求', { oldName: rq.name });
    out = R.operations.update(out, rq.line, 'name', 'recv_req', { oldName: '受信要求' });
    expect(out).toContain('requirement recv_req {');
    expect(rels(out)).toContain('sample_elem-satisfies->recv_req');
  });
});

describe('requirementDiagram: 契約経路の改名', function() {
  var t = R.template();

  test('RU-7: エレメントの改名が operations.update で効く', function() {
    var el = R.parse(t).elements.filter(function(e) { return e.kind === 'element'; })[0];
    var out = R.operations.update(t, el.line, 'name', '検証装置', { kind: 'element', oldName: el.name });
    expect(names(out)).toContain('検証装置');
    expect(names(out)).not.toContain('sample_elem');
    expect(rels(out)).toContain('検証装置-satisfies->sample_req');
  });

  test('RU-8: 日本語の端点を持つ関係の種別を変更できる', function() {
    var el = R.parse(t).elements.filter(function(e) { return e.kind === 'element'; })[0];
    var out = R.operations.update(t, el.line, 'name', '検証装置', { kind: 'element', oldName: el.name });
    var rel = R.parse(out).relations[0];
    var after = R.operations.update(out, rel.line, 'reltype', 'verifies', { kind: 'relation' });
    expect(rels(after)).toContain('検証装置-verifies->sample_req');
  });

  test('RU-9: 関係の端点を日本語に差し替えられる', function() {
    var rel = R.parse(t).relations[0];
    var after = R.operations.update(t, rel.line, 'from', '別装置', { kind: 'relation' });
    expect(after).toContain('"別装置" - satisfies -> sample_req');
    expect(rels(after)).toContain('別装置-satisfies->sample_req');
  });
});

describe('requirementDiagram: 空欄の属性', function() {
  var t = R.template();

  // mermaid v11.13 実測: id/text/type/docref/risk/verifymethod いずれも
  // 空の値を書くと Parse error。行そのものが無ければ通る。
  test('RU-10: 要件追加が空の属性行を出さない', function() {
    var out = R.operations.add(t, 'requirement', { reqType: 'requirement', name: 'r2' });
    expect(out).not.toContain('id: ""');
    expect(out).not.toContain('text: ""');
  });

  test('RU-11: エレメント追加が空の属性行を出さない', function() {
    var out = R.operations.add(t, 'element', { name: 'e2' });
    expect(out).not.toContain('type: ""');
    expect(out).not.toContain('docref: ""');
  });

  test('RU-12: 属性を空にすると行ごと消える', function() {
    var el = R.parse(t).elements.filter(function(e) { return e.kind === 'element'; })[0];
    var out = R.operations.update(t, el.line, 'type', '', { kind: 'element' });
    expect(out).not.toContain('type:');
    expect(out).toContain('docref: src/sample.c');
  });

  test('RU-13: 無い属性を空で足そうとしても何も書かない', function() {
    var out = R.operations.add(t, 'element', { name: 'e3' });
    var el = R.parse(out).elements.filter(function(e) { return e.name === 'e3'; })[0];
    var after = R.operations.update(out, el.line, 'docref', '', { kind: 'element' });
    expect(after).toBe(out);
  });
});
