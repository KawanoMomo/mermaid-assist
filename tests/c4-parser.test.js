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
