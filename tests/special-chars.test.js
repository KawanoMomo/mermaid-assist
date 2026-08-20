'use strict';
// 実務の名前をそのまま入れて壊れないか。
//
// 日本語の設計書で使う名前は素直な英数字ではない。
//   「設計(詳細)」「配列[0]」「条件{真}」「A#1」「"引用"付き」
// これらは mermaid の DSL では意味を持つ記号なので、そのまま本文に置くと
// 図が壊れるか、**入れた文字が黙って消える**。
//
// R11 (特殊文字) が実描画で確かめた事実:
//   mindmap  「設計(詳細)」→ 図には「詳細」だけが出る。( が形状指定として食われ、
//            前半が捨てられる。エラーも出ないので気付けない
//   mindmap  「配列[0]」→「0」だけ
//   block    「"引用"付き」→ parse 失敗
//   sequence 「A#1」→「A」。# 以降が実体参照として食われる
//
// mermaid はどの形状でも引用囲みを受け付ける (default だけ不可) ので、
// 記号を含むときは引用で囲む。読み戻しでは引用を外して元の文字に戻す。

var MM = window.MA.modules.mindmap;
var BL = window.MA.modules.blockBeta;
var SQ = window.MA.modules.sequence;

describe('mindmap: 形状記号を含むラベル', function() {
  var src = 'mindmap\n  root\n    子1\n';

  test('SC-1: 括弧を含むラベルが往復する', function() {
    var out = MM.updateNodeText(src, 3, '設計(詳細)', 'square');
    var n = MM.parse(out).elements.filter(function(e) { return e.line === 3; })[0];
    expect(n.text).toBe('設計(詳細)');
  });

  test('SC-2: 角括弧を含むラベルが往復する', function() {
    var out = MM.updateNodeText(src, 3, '配列[0]', 'rounded');
    var n = MM.parse(out).elements.filter(function(e) { return e.line === 3; })[0];
    expect(n.text).toBe('配列[0]');
  });

  test('SC-3: 波括弧を含むラベルが往復する', function() {
    var out = MM.updateNodeText(src, 3, '条件{真}', 'hexagon');
    var n = MM.parse(out).elements.filter(function(e) { return e.line === 3; })[0];
    expect(n.text).toBe('条件{真}');
  });

  test('SC-4: 記号を含むと本文は引用で囲まれる', function() {
    var out = MM.updateNodeText(src, 3, '設計(詳細)', 'square');
    expect(out).toContain('["設計(詳細)"]');
  });

  test('SC-5: 記号が無ければ引用で囲まない (差分を増やさない)', function() {
    var out = MM.updateNodeText(src, 3, '普通のラベル', 'square');
    expect(out).toContain('[普通のラベル]');
    expect(out).not.toContain('"');
  });

  test('SC-6: default 形状で記号を含む場合は形状を付けて文字を守る', function() {
    // default には囲む場所が無く、mermaid は引用を受け付けない。
    // 文字が消えるより、形状が付くほうがまし (形状は UI で選び直せる)。
    var out = MM.updateNodeText(src, 3, '設計(詳細)', 'default');
    expect(out).toContain('"設計(詳細)"');
    var n = MM.parse(out).elements.filter(function(e) { return e.line === 3; })[0];
    expect(n.text).toBe('設計(詳細)');
  });

  test('SC-7: 子の追加でも同じ扱い', function() {
    var out = MM.addChild(src, 2, '配列[0]', 'square');
    expect(out).toContain('["配列[0]"]');
  });
});

describe('block: 引用符を含むラベル', function() {
  test('SC-8: 引用符が本文を壊さない', function() {
    var src = BL.template();
    var el = BL.parse(src).elements[0];
    var out = BL.updateBlockLabel(src, el.line, el.id, '"引用"付き');
    expect(out).not.toContain('""引用"付き"');
    expect(out).toContain('#quot;');
  });

  test('SC-9: 引用符付きラベルが往復する', function() {
    var src = BL.template();
    var el = BL.parse(src).elements[0];
    var out = BL.updateBlockLabel(src, el.line, el.id, '"引用"付き');
    var back = BL.parse(out).elements.filter(function(e) { return e.id === el.id; })[0];
    expect(back.label).toBe('"引用"付き');
  });
});

describe('sequence: # を含むラベル', function() {
  test('SC-10: # が実体参照として食われない', function() {
    var src = 'sequenceDiagram\n    participant A as Alice\n    A->>A: x\n';
    var out = SQ.updateParticipant(src, 2, 'label', 'A#1');
    expect(out).toContain('#35;');
  });

  test('SC-11: # を含むラベルが往復する', function() {
    var src = 'sequenceDiagram\n    participant A as Alice\n    A->>A: x\n';
    var out = SQ.updateParticipant(src, 2, 'label', 'A#1');
    var p = SQ.parse(out).elements.filter(function(e) { return e.id === 'A'; })[0];
    expect(p.label).toBe('A#1');
  });
});

describe('flowchart: 記号を含むラベル', function() {
  var F = window.MA.modules.flowchart;
  var src = 'flowchart TD\n    A[Start] --> B{Decision}\n';

  test('SC-12: 括弧を含むラベルは引用で囲まれる', function() {
    var out = F.updateNode(src, 2, 'label', '設計(詳細)', 'A');
    expect(out).toContain('A["設計(詳細)"]');
  });

  test('SC-13: 角括弧・波括弧も同じ', function() {
    expect(F.updateNode(src, 2, 'label', '配列[0]', 'A')).toContain('A["配列[0]"]');
    expect(F.updateNode(src, 2, 'label', '条件{真}', 'B')).toContain('B{"条件{真}"}');
  });

  test('SC-14: 引用符は #quot; に逃がす', function() {
    var out = F.updateNode(src, 2, 'label', '"引用"付き', 'A');
    expect(out).toContain('#quot;');
    expect(out).not.toContain('A[""引用"付き"]');
  });

  test('SC-15: ラベルが往復する', function() {
    ['設計(詳細)', '配列[0]', '条件{真}', '"引用"付き', 'A#1'].forEach(function(label) {
      var out = F.updateNode(src, 2, 'label', label, 'A');
      var n = F.parse(out).elements.filter(function(e) { return e.id === 'A'; })[0];
      expect(n.label).toBe(label);
    });
  });

  test('SC-16: 記号が無ければ囲まない (差分を増やさない)', function() {
    expect(F.updateNode(src, 2, 'label', '開始', 'A')).toContain('A[開始]');
  });

  test('SC-17: ノード追加でも同じ扱い', function() {
    var out = F.addNode(src, 'zz', '設計(詳細)', 'rect');
    expect(out).toContain('"設計(詳細)"');
  });
});
