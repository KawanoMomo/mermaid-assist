'use strict';
// mermaid は中身の無い `block … end` を受理しない。名前付き (`block:g1`)、
// 無名 (`block`)、コメントだけ —— いずれも Parse error になる (v11.13.0 で実測)。
// 一方 `columns N` だけのグループとリンクだけのグループは受理される。
//
// 最後の子ブロックを消しただけで図が描画不能になっていた。ファズで、元が描画できる
// 文書30件を1件ずつ削除したうち1件がこの形で壊れた。既存テストは1本も捕まえて
// いなかった (この修正を入れる前でも 1134 passed / 0 failed)。
//
// C4 側は同じ欠陥を PR #20 で直したが、block には畳む処理自体が無かった。
var block = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.blockBeta)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.blockBeta);

// 「中身の無いグループ」がテキストに残っていないか。mermaid に渡す前の必要条件。
function hasEmptyGroup(text) {
  var ls = text.split('\n');
  for (var i = 0; i < ls.length; i++) {
    var s = ls[i].trim();
    if (s !== 'block' && !/^block:/.test(s)) continue;
    var d = 0, e = -1;
    for (var j = i; j < ls.length; j++) {
      var u = ls[j].trim();
      if (u === 'block' || /^block:/.test(u)) d++;
      else if (u === 'end') { d--; if (d === 0) { e = j; break; } }
    }
    if (e === -1) continue;
    var empty = true;
    for (var k = i + 1; k < e; k++) {
      var v = ls[k].trim();
      if (!v || v.indexOf('%%') === 0) continue;
      empty = false;
      break;
    }
    if (empty) return true;
  }
  return false;
}

function elementNamed(text, id) {
  var p = block.parseBlock(text);
  return p.elements.filter(function(e) { return e.id === id; })[0];
}

describe('グループ追加は空のグループを作らない', function() {
  // 「+ グループ追加」は `block:gid` と `end` だけを挿入していた。mermaid は空の
  // グループを受理しないので、ボタンを1回押しただけで parse が Error になる。
  // しかもプレビューは直前の図を出したままなので、壊れたことが画面から分からない
  // (実機で確認: 押下後 parse=Error、svg は前の内容のまま、console error なし)。
  //
  // c4 の addElement は境界に対して同じ問題を既に解いていた (プレースホルダの子を
  // 必ず添える)。block だけが未対応だった。
  test('AG1: 追加したグループには必ず子が入る', function() {
    var r = block.addGroup('block-beta\n  columns 2\n  ecu["車載ECU"]\n', 'mcu_group');
    expect(hasEmptyGroup(r.text)).toBe(false);
    expect(r.text.indexOf('block:mcu_group')).toBeGreaterThan(-1);
    expect(r.id).toBe('mcu_group');
    expect(r.text.indexOf(r.childId)).toBeGreaterThan(-1);
  });

  test('AG2: 子は親グループの中に入る（外に出ない）', function() {
    var r = block.addGroup('block-beta\n  columns 2\n', 'g');
    var p = block.parseBlock(r.text);
    var child = p.elements.filter(function(e) { return e.id === r.childId; })[0];
    expect(child).not.toBe(undefined);
    expect(child.parentId).toBe(r.id);
  });

  test('AG3: 既存の id とは衝突させない', function() {
    // mermaid は重複 id を黙って受理するのに renderProps は最初の一致で選択を
    // 解決するため、重複するとその後の編集・削除が別のブロックに当たる。
    var base = 'block-beta\n  columns 2\n  g["既存"]\n';
    var r = block.addGroup(base, 'g');
    expect(r.id).not.toBe('g');
    expect(r.id).toBe('g_2');
    var ids = block.parseBlock(r.text).elements.map(function(e) { return e.id; });
    var dup = ids.filter(function(x, i) { return ids.indexOf(x) !== i; });
    expect(dup.length).toBe(0);
  });

  test('AG4: 子の id も衝突させない', function() {
    var base = 'block-beta\n  columns 2\n  g_1["既存"]\n';
    var r = block.addGroup(base, 'g');
    expect(r.childId).not.toBe('g_1');
    var ids = block.parseBlock(r.text).elements.map(function(e) { return e.id; });
    var dup = ids.filter(function(x, i) { return ids.indexOf(x) !== i; });
    expect(dup.length).toBe(0);
  });

  test('AG5: 二度続けて同じ id で追加しても壊れない', function() {
    var r1 = block.addGroup('block-beta\n  columns 2\n', 'g');
    var r2 = block.addGroup(r1.text, 'g');
    expect(hasEmptyGroup(r2.text)).toBe(false);
    var ids = block.parseBlock(r2.text).elements.map(function(e) { return e.id; });
    var dup = ids.filter(function(x, i) { return ids.indexOf(x) !== i; });
    expect(dup.length).toBe(0);
  });
});

describe('空になったグループを残さない', function() {
  test('EG1: 名前付きグループの最後の子を消すとグループごと畳まれる', function() {
    var t = 'block-beta\n  columns 2\n  a["A"]\n  block:g1\n    b["B"]\n  end\n';
    var out = block.deleteBlock(t, elementNamed(t, 'b').line, 'b');
    expect(hasEmptyGroup(out)).toBe(false);
    expect(out.indexOf('block:g1')).toBe(-1);
    expect(out.indexOf('a["A"]')).toBeGreaterThan(-1);
  });

  test('EG2: 無名グループでも同じ', function() {
    var t = 'block-beta\n  columns 2\n  a["A"]\n  block\n    b["B"]\n  end\n';
    var out = block.deleteBlock(t, elementNamed(t, 'b').line, 'b');
    expect(hasEmptyGroup(out)).toBe(false);
    expect(out.indexOf('a["A"]')).toBeGreaterThan(-1);
  });

  test('EG3: 内側が畳まれた結果、外側も空になれば外側も畳まれる', function() {
    // ファズが実際に壊した形。内側だけ畳んで止めると外側が空のまま残る。
    var t = [
      'block-beta',
      '  columns 2',
      '  n3["N3"]',
      '  block',
      '    block',
      '      block:g1',
      '        n10["N10"]',
      '      end',
      '    end',
      '  end',
      ''
    ].join('\n');
    var out = block.deleteBlock(t, elementNamed(t, 'n10').line, 'n10');
    expect(hasEmptyGroup(out)).toBe(false);
    expect(out.indexOf('block:g1')).toBe(-1);
    expect(out.indexOf('n3["N3"]')).toBeGreaterThan(-1);
    // 開いた block と end の数が合っていること
    var opens = out.split('\n').filter(function(l) {
      var s = l.trim(); return s === 'block' || /^block:/.test(s);
    }).length;
    var ends = out.split('\n').filter(function(l) { return l.trim() === 'end'; }).length;
    expect(opens).toBe(ends);
  });

  test('EG4: リンクが刈られて空になったグループも畳まれる', function() {
    // 「刈るのが先・畳むのが後」の一方通行だと、ここで空のグループが残る。
    // g1 の中には子ブロックが無く、a も b も外にある。a を消すと a --> b が
    // ダングリングになって刈られ、その結果 g1 が空になる。
    var t = 'block-beta\n  columns 2\n  a["A"]\n  b["B"]\n  block:g1\n    a --> b\n  end\n';
    var out = block.deleteBlock(t, elementNamed(t, 'a').line, 'a');
    expect(out.indexOf('a --> b')).toBe(-1);
    expect(hasEmptyGroup(out)).toBe(false);
    expect(out.indexOf('block:g1')).toBe(-1);
    expect(out.indexOf('b["B"]')).toBeGreaterThan(-1);
  });

  test('EG4b: リンクを中身に持つグループは、そのリンクが生きている限り畳まない', function() {
    // mermaid はリンクだけのグループを受理する。畳む条件を「子ブロックが無い」に
    // すると、描画できる図を勝手に壊すことになる。
    var t = 'block-beta\n  columns 2\n  a["A"]\n  b["B"]\n  c["C"]\n  block:g1\n    a --> b\n  end\n';
    var out = block.deleteBlock(t, elementNamed(t, 'c').line, 'c');
    expect(out.indexOf('block:g1')).toBeGreaterThan(-1);
    expect(out.indexOf('a --> b')).toBeGreaterThan(-1);
  });

  test('EG5: リンクを直接消してグループが空になっても畳まれる', function() {
    var t = 'block-beta\n  columns 2\n  a["A"]\n  b["B"]\n  block:g1\n    a --> b\n  end\n';
    var rel = block.parseBlock(t).relations[0];
    var out = block.deleteLink(t, rel.line);
    expect(hasEmptyGroup(out)).toBe(false);
    expect(out.indexOf('a["A"]')).toBeGreaterThan(-1);
    expect(out.indexOf('b["B"]')).toBeGreaterThan(-1);
  });

  test('EG6: columns だけのグループは畳まない（mermaid が受理する）', function() {
    var t = 'block-beta\n  columns 2\n  a["A"]\n  block:g1\n    columns 1\n    b["B"]\n  end\n';
    var out = block.deleteBlock(t, elementNamed(t, 'b').line, 'b');
    expect(out.indexOf('block:g1')).toBeGreaterThan(-1);
    expect(out.indexOf('columns 1')).toBeGreaterThan(-1);
  });

  test('EG7: 畳むときも利用者が書いたコメントは捨てない', function() {
    // 畳む理由は mermaid が空グループを受理しないことであって、本文を消すことでは
    // ない。グループがあった位置へ繰り上げる。
    var t = 'block-beta\n  columns 2\n  a["A"]\n  block:g1\n    %% ECU 側の内訳\n    b["B"]\n  end\n';
    var out = block.deleteBlock(t, elementNamed(t, 'b').line, 'b');
    expect(hasEmptyGroup(out)).toBe(false);
    expect(out.indexOf('block:g1')).toBe(-1);
    expect(out.indexOf('%% ECU 側の内訳')).toBeGreaterThan(-1);
  });

  test('EG8: 入れ子が二段まとめて畳まれてもコメントは順序どおり残る', function() {
    var t = [
      'block-beta', '  columns 2', '  a["A"]',
      '  block:g1', '    %% 外', '    block:g2', '      %% 内', '      b["B"]',
      '    end', '  end', ''
    ].join('\n');
    var out = block.deleteBlock(t, elementNamed(t, 'b').line, 'b');
    expect(hasEmptyGroup(out)).toBe(false);
    var outer = out.indexOf('%% 外');
    var inner = out.indexOf('%% 内');
    expect(outer).toBeGreaterThan(-1);
    expect(inner).toBeGreaterThan(-1);
    expect(inner > outer).toBe(true);
  });

  test('EG9: グループを丸ごと消すときは配下のコメントも一緒に消える', function() {
    // こちらは仕様どおり。畳み込みと違い、利用者が「このグループを消す」と
    // 指示している。EG7 と取り違えないよう明示的に固定する。
    var t = 'block-beta\n  columns 2\n  a["A"]\n  block:g1\n    %% 内訳\n    b["B"]\n  end\n';
    var out = block.deleteBlock(t, elementNamed(t, 'g1').line, 'g1');
    expect(out.indexOf('%% 内訳')).toBe(-1);
    expect(out.indexOf('b["B"]')).toBe(-1);
    expect(out.indexOf('a["A"]')).toBeGreaterThan(-1);
  });

  test('EG9b: 畳みと刈りが2周必要な形でも収束する', function() {
    // mermaid はグループを端点にしたリンク (`a --> g1`) を受理する。すると
    //   b を消す → g1 が空になって畳まれる → g1 の id が消える
    //   → `a --> g1` がダングリングになって刈られる → g2 が空になって畳まれる
    // という2周ぶんの連鎖が起きる。1周で止めると、g2 の中にダングリングな
    // リンクが残ったままになる。
    //
    // ミューテーション検査で「不動点をやめて1周だけにする」が生き残ったため
    // 追加した。EG1〜EG8 はどれも1周で片付く形だった。
    var t = [
      'block-beta', '  columns 2', '  a["A"]',
      '  block:g1', '    b["B"]', '  end',
      '  block:g2', '    a --> g1', '  end', ''
    ].join('\n');
    var out = block.deleteBlock(t, elementNamed(t, 'b').line, 'b');
    expect(out.indexOf('block:g1')).toBe(-1);
    expect(out.indexOf('a --> g1')).toBe(-1);
    expect(out.indexOf('block:g2')).toBe(-1);
    expect(hasEmptyGroup(out)).toBe(false);
    expect(out.indexOf('a["A"]')).toBeGreaterThan(-1);
  });

  test('EG10: 閉じていないグループには触らない', function() {
    // 編集途中で `end` が無い状態。ここで勝手に畳むと、まだ書きかけの本文を消す。
    var t = 'block-beta\n  columns 2\n  a["A"]\n  block:g1\n    b["B"]\n';
    var out = block.deleteBlock(t, elementNamed(t, 'b').line, 'b');
    expect(out.indexOf('block:g1')).toBeGreaterThan(-1);
  });
});
