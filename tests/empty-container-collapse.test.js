'use strict';
// 「最後の子を消すと空のコンテナが残り、mermaid が描けなくなる」欠陥は、C4 の境界と
// block のグループで見つかったあと、他の図種にも同じ形が無いか実機 mermaid で
// 総当たりして確かめた。v11.13.0 の判定は以下のとおり:
//
// | 図種 | 空のコンテナ | 判定 |
// |---|---|---|
// | flowchart | 空の subgraph | OK (受理する) |
// | sequence | 空の box / loop / alt | OK |
// | architecture | 空の group | OK |
// | kanban | 空の列 | OK |
// | state | 空の合成状態 | **parse は通るが render で落ちる** |
// | class | 空の namespace | **parse から落ちる** |
//
// state は parse が通ってしまうぶん、ステータスバーは OK のままで図だけが消える。
var S = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.state)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.state);
var C = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.classDiagram)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.classDiagram);

// `{` で開いたコンテナのうち、本文が空 (空行とコメントだけ) のものが残っていないか。
function hasEmptyBraceBlock(text) {
  var lines = text.split('\n');
  var stack = [];
  for (var i = 0; i < lines.length; i++) {
    var s = lines[i].trim();
    if (/\{\s*$/.test(s)) { stack.push({ open: i, hasBody: false }); continue; }
    if (s === '}') {
      var top = stack.pop();
      if (top && !top.hasBody) return true;
      continue;
    }
    if (!s || s.indexOf('%%') === 0) continue;
    for (var k = 0; k < stack.length; k++) stack[k].hasBody = true;
  }
  return false;
}

function stateTransition(text, from, to) {
  var p = S.parse(text);
  return p.relations.filter(function(r) { return r.from === from && r.to === to; })[0];
}

describe('state: 空になった合成状態を残さない', function() {
  test('SC1: 中の遷移をすべて消すと合成状態ごと畳まれる', function() {
    var t = 'stateDiagram-v2\n    [*] --> S\n    state S {\n        [*] --> Inner\n        Inner --> [*]\n    }\n';
    var a = S.deleteTransition(t, stateTransition(t, 'Inner', '[*]').line);
    // まだ中身があるので畳まない
    expect(a.indexOf('state S {')).toBeGreaterThan(-1);
    var b = S.deleteTransition(a, stateTransition(a, '[*]', 'Inner').line);
    expect(hasEmptyBraceBlock(b)).toBe(false);
    expect(b.indexOf('state S {')).toBe(-1);
    // 外から S を指す遷移は残す。mermaid は暗黙の単純状態として描けるので、
    // 利用者の書いたものを余分に消さない。
    expect(b.indexOf('[*] --> S')).toBeGreaterThan(-1);
  });

  test('SC2: 内側が空になると外側の合成も畳まれる', function() {
    var t = 'stateDiagram-v2\n    [*] --> S\n    state S {\n        state T {\n            A --> B\n        }\n    }\n';
    var out = S.deleteTransition(t, stateTransition(t, 'A', 'B').line);
    expect(hasEmptyBraceBlock(out)).toBe(false);
    expect(out.indexOf('state T {')).toBe(-1);
    expect(out.indexOf('state S {')).toBe(-1);
    expect(out.indexOf('[*] --> S')).toBeGreaterThan(-1);
  });

  test('SC3: 畳むときも利用者が書いたコメントは捨てない', function() {
    var t = 'stateDiagram-v2\n    [*] --> S\n    state S {\n        %% 内部の説明\n        Inner --> [*]\n    }\n';
    var out = S.deleteTransition(t, stateTransition(t, 'Inner', '[*]').line);
    expect(hasEmptyBraceBlock(out)).toBe(false);
    expect(out.indexOf('%% 内部の説明')).toBeGreaterThan(-1);
  });

  test('SC4: 中身が残っていれば畳まない', function() {
    var t = 'stateDiagram-v2\n    [*] --> S\n    state S {\n        A --> B\n        B --> C\n    }\n';
    var out = S.deleteTransition(t, stateTransition(t, 'B', 'C').line);
    expect(out.indexOf('state S {')).toBeGreaterThan(-1);
    expect(out.indexOf('A --> B')).toBeGreaterThan(-1);
  });

  test('SC5: 合成を丸ごと消して外側が空になっても畳まれる', function() {
    var t = 'stateDiagram-v2\n    [*] --> S\n    state S {\n        state T {\n            A --> B\n        }\n    }\n';
    var T = S.parse(t).groups.filter(function(g) { return g.id === 'T'; })[0];
    var out = S.deleteComposite(t, T.line, T.endLine);
    expect(hasEmptyBraceBlock(out)).toBe(false);
    expect(out.indexOf('state S {')).toBe(-1);
  });
});

describe('コンテナの追加は空のコンテナを作らない', function() {
  // 「+ 複合状態を追加」/「+ namespace 追加」は中身が空白1行だけのブロックを
  // 挿入していた。1クリックで図が描画不能になる。state は parse を通してしまうので
  // ステータスバーは OK のまま図だけが消え、手がかりが画面に無い。
  // block の addGroup / c4 の addElement は同じ問題を既に解いていた。
  function hasEmptyBraceBlockLocal(text) { return hasEmptyBraceBlock(text); }

  test('AC1: state — 追加した複合状態には必ず子が入る', function() {
    var out = S.addComposite('stateDiagram-v2\n    [*] --> A\n', 'Running', '走行中');
    expect(hasEmptyBraceBlockLocal(out)).toBe(false);
    expect(out.indexOf('state "走行中" as Running {')).toBeGreaterThan(-1);
    // 子は `[*] --> <id>_1`。`state <id>_1` は mermaid が受理しない
    // (No such shape: roundedWithTitle。実機 v11.13.0 で確認)。
    expect(out.indexOf('[*] --> Running_1')).toBeGreaterThan(-1);
  });

  test('AC2: class — 追加した namespace には必ずクラスが入る', function() {
    var out = C.addNamespace('classDiagram\n    class B\n', 'Ctrl');
    expect(hasEmptyBraceBlockLocal(out)).toBe(false);
    expect(out.indexOf('namespace Ctrl {')).toBeGreaterThan(-1);
    expect(out.indexOf('class Ctrl_1')).toBeGreaterThan(-1);
  });

  test('AC3: 同じ id で二度追加しても衝突させない', function() {
    // mermaid は重複した別名を黙って受理するのに、プロパティパネルは最初の一致で
    // 選択を解決するので、重複するとその後の編集・削除が別のものに当たる。
    var s1 = S.addComposite('stateDiagram-v2\n    [*] --> A\n', 'Running', '走行中');
    var s2 = S.addComposite(s1, 'Running', '走行中');
    var ids = S.parse(s2).groups.map(function(g) { return g.id; });
    expect(ids.length).toBe(2);
    expect(ids[0] === ids[1]).toBe(false);
    var c1 = C.addNamespace('classDiagram\n    class B\n', 'Ctrl');
    var c2 = C.addNamespace(c1, 'Ctrl');
    var ns = C.parse(c2).groups.map(function(g) { return g.id; });
    expect(ns.length).toBe(2);
    expect(ns[0] === ns[1]).toBe(false);
    // 子の id も重ならない
    var cls = C.parse(c2).elements.map(function(e) { return e.id; });
    var dup = cls.filter(function(x, i) { return cls.indexOf(x) !== i; });
    expect(dup.length).toBe(0);
  });
});

describe('畳み込みの上限は文書の大きさに追従する', function() {
  // 上限を固定値 (200) にしていたとき、それより深い入れ子では畳み残しが出た。
  // 1回畳むごとに必ず2行以上減るので、行数を上限にすれば取りこぼさない。
  test('GUARD1: state — 250段の入れ子が1つ残らず畳まれる', function() {
    var d = ['stateDiagram-v2'];
    for (var i = 0; i < 250; i++) d.push(new Array(i + 2).join('  ') + 'state D' + i + ' {');
    d.push(new Array(252).join('  ') + 'X --> Y');
    for (var j = 249; j >= 0; j--) d.push(new Array(j + 2).join('  ') + '}');
    var text = d.join('\n') + '\n';
    var rel = S.parse(text).relations[0];
    var out = S.deleteTransition(text, rel.line);
    expect((out.match(/\{/g) || []).length).toBe(0);
    expect(hasEmptyBraceBlock(out)).toBe(false);
  });

  // 注意: これは class 側の上限を検証していない。namespace は入れ子にできず、
  // 1回の deleteClass で空になる namespace は高々1つなので、周回数が上限に届く
  // 経路がそもそも存在しない (上限を 200 の固定値に戻すミューテーションを当てても
  // このテストは通ってしまう = SURVIVED)。
  // class の上限を行数に連動させているのは state / block と揃えるためで、
  // 現時点では到達不能な防御。検証できるのは「namespace が多数あっても1つずつ
  // 正しく畳まれる」ことだけなので、テスト名もそれに合わせてある。
  test('GUARD2: class — namespace が250個あっても1つずつ正しく畳まれる', function() {
    var d = ['classDiagram'];
    for (var i = 0; i < 250; i++) {
      d.push('    namespace N' + i + ' {');
      d.push('        class C' + i);
      d.push('    }');
    }
    var text = d.join('\n') + '\n';
    var cur = text;
    for (var k = 0; k < 250; k++) {
      var e = C.parse(cur).elements.filter(function(x) { return x.kind === 'class'; })[0];
      if (!e) break;
      cur = C.deleteClass(cur, e.line, e.id);
    }
    expect((cur.match(/namespace/g) || []).length).toBe(0);
    expect(hasEmptyBraceBlock(cur)).toBe(false);
  });
});

describe('class: 空になった namespace を残さない', function() {
  function deleteClassById(text, id) {
    var e = C.parse(text).elements.filter(function(x) { return x.id === id; })[0];
    return C.deleteClass(text, e.line, id);
  }

  test('NS1: namespace の唯一のクラスを消すと namespace ごと畳まれる', function() {
    var t = 'classDiagram\n    namespace N {\n        class A\n    }\n    class B\n';
    var out = deleteClassById(t, 'A');
    expect(hasEmptyBraceBlock(out)).toBe(false);
    expect(out.indexOf('namespace N')).toBe(-1);
    expect(out.indexOf('class B')).toBeGreaterThan(-1);
  });

  test('NS2: クラスが残っていれば畳まない', function() {
    var t = 'classDiagram\n    namespace N {\n        class A\n        class C\n    }\n';
    var out = deleteClassById(t, 'A');
    expect(out.indexOf('namespace N')).toBeGreaterThan(-1);
    expect(out.indexOf('class C')).toBeGreaterThan(-1);
  });

  test('NS3: 畳むときも利用者が書いたコメントは捨てない', function() {
    var t = 'classDiagram\n    namespace N {\n        %% 内訳\n        class A\n    }\n    class B\n';
    var out = deleteClassById(t, 'A');
    expect(hasEmptyBraceBlock(out)).toBe(false);
    expect(out.indexOf('%% 内訳')).toBeGreaterThan(-1);
  });

  test('NS4: 別の namespace は巻き添えにしない', function() {
    var t = 'classDiagram\n    namespace N {\n        class A\n    }\n    namespace M {\n        class C\n    }\n';
    var out = deleteClassById(t, 'A');
    expect(out.indexOf('namespace N')).toBe(-1);
    expect(out.indexOf('namespace M')).toBeGreaterThan(-1);
    expect(out.indexOf('class C')).toBeGreaterThan(-1);
  });
});
