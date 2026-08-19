'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils) || (global.window && global.window.MA && global.window.MA.parserUtils);
var c4 = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.c4) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.c4);

describe('detectDiagramType — C4', function() {
  test('detects C4Context', function() { expect(parserUtils.detectDiagramType('C4Context\n')).toBe('C4Context'); });
  test('detects C4Container', function() { expect(parserUtils.detectDiagramType('C4Container\n')).toBe('C4Context'); });
});

describe('parseC4', function() {
  test('parses variant', function() {
    var r = c4.parseC4('C4Container\n');
    expect(r.meta.variant).toBe('Container');
  });
  test('parses title', function() {
    var r = c4.parseC4('C4Context\n    title My Title\n');
    expect(r.meta.title).toBe('My Title');
  });
  test('parses Person with label + descr', function() {
    var r = c4.parseC4('C4Context\n    Person(u, "User", "End user")\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].kind).toBe('Person');
    expect(r.elements[0].id).toBe('u');
    expect(r.elements[0].label).toBe('User');
    expect(r.elements[0].descr).toBe('End user');
  });
  test('parses Container with tech', function() {
    var r = c4.parseC4('C4Container\n    Container(api, "API", "Java/Spring", "Backend")\n');
    expect(r.elements[0].tech).toBe('Java/Spring');
    expect(r.elements[0].descr).toBe('Backend');
  });
  test('parses Rel', function() {
    var r = c4.parseC4('C4Context\n    Rel(a, b, "uses", "HTTP")\n');
    expect(r.relations[0].kind).toBe('Rel');
    expect(r.relations[0].from).toBe('a');
    expect(r.relations[0].to).toBe('b');
    expect(r.relations[0].label).toBe('uses');
    expect(r.relations[0].tech).toBe('HTTP');
  });
});

// ── System_Boundary (block syntax) ────────────────────────────────────────
describe('parseC4: System_Boundary', function() {
  var TEXT = [
    'C4Context',
    '    title t',
    '    System_Boundary(b1, "API境界") {',
    '        System(s1, "Sys")',
    '    }',
    '    Person(u, "User")',
    ''
  ].join('\n');

  test('P1: 境界行に isBoundary と endLine が付く', function() {
    var p = c4.parseC4(TEXT);
    var b = p.elements.filter(function(e) { return e.id === 'b1'; })[0];
    expect(b.kind).toBe('System_Boundary');
    expect(b.label).toBe('API境界');
    expect(b.isBoundary).toBe(true);
    expect(b.line).toBe(3);
    expect(b.endLine).toBe(5); // 対応する '}' の行
  });

  test('P2: 境界内部の要素も elements に含まれる (regression)', function() {
    var p = c4.parseC4(TEXT);
    var ids = p.elements.map(function(e) { return e.id; });
    expect(ids).toContain('s1');
    expect(ids).toContain('u');
  });

  test('P3: 単独の } 行は要素を生まない', function() {
    var p = c4.parseC4(TEXT);
    expect(p.elements.length).toBe(3); // b1, s1, u のみ
  });

  test('P4: 非境界要素には isBoundary が立たない', function() {
    var p = c4.parseC4(TEXT);
    var u = p.elements.filter(function(e) { return e.id === 'u'; })[0];
    expect(!!u.isBoundary).toBe(false);
  });

  test('P5: 入れ子の境界でも endLine は対応する } を指す', function() {
    var t = [
      'C4Context',
      '    System_Boundary(outer, "外") {',      // line 2
      '        System_Boundary(inner, "内") {',  // line 3
      '            System(s1, "S")',             // line 4
      '        }',                               // line 5
      '    }',                                   // line 6
      ''
    ].join('\n');
    var p = c4.parseC4(t);
    var o = p.elements.filter(function(e) { return e.id === 'outer'; })[0];
    var i = p.elements.filter(function(e) { return e.id === 'inner'; })[0];
    expect(o.endLine).toBe(6);
    expect(i.endLine).toBe(5);
  });
});
