'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils)
  || (global.window && global.window.MA && global.window.MA.parserUtils);

var block = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.blockBeta)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.blockBeta);

describe('detectDiagramType — block-beta', function() {
  test('detects block-beta keyword', function() {
    expect(parserUtils.detectDiagramType('block-beta\n')).toBe('block-beta');
  });
});

describe('parseBlock — standalone blocks', function() {
  test('parses single block with label', function() {
    var r = block.parseBlock('block-beta\n  a["Alpha"]\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].id).toBe('a');
    expect(r.elements[0].label).toBe('Alpha');
  });

  test('parses multiple blocks on one line', function() {
    var r = block.parseBlock('block-beta\n  a["A"] b["B"] c["C"]\n');
    expect(r.elements.length).toBe(3);
    expect(r.elements[0].id).toBe('a');
    expect(r.elements[2].id).toBe('c');
  });

  test('parses columns meta', function() {
    var r = block.parseBlock('block-beta\n  columns 3\n  a["A"]\n');
    expect(r.meta.columns).toBe(3);
  });

  test('parses bare block without label', function() {
    var r = block.parseBlock('block-beta\n  plain\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].id).toBe('plain');
    expect(r.elements[0].label).toBe('plain');
  });
});

describe('parseBlock — nested groups', function() {
  test('parses group with nested blocks', function() {
    var r = block.parseBlock('block-beta\n  block:g1\n    inner1 inner2\n  end\n');
    var grps = r.elements.filter(function(e) { return e.kind === 'group'; });
    var blocks = r.elements.filter(function(e) { return e.kind === 'block'; });
    expect(grps.length).toBe(1);
    expect(grps[0].id).toBe('g1');
    expect(blocks.length).toBe(2);
    expect(blocks[0].parentId).toBe('g1');
    expect(blocks[1].parentId).toBe('g1');
  });
});

describe('parseBlock — links', function() {
  test('parses plain link', function() {
    var r = block.parseBlock('block-beta\n  a --> b\n');
    expect(r.relations.length).toBe(1);
    expect(r.relations[0].from).toBe('a');
    expect(r.relations[0].to).toBe('b');
    expect(r.relations[0].label).toBe('');
  });

  test('parses link with label', function() {
    var r = block.parseBlock('block-beta\n  a -- "triggers" --> b\n');
    expect(r.relations.length).toBe(1);
    expect(r.relations[0].label).toBe('triggers');
  });

  test('parses link without blocks first (auto-reg not required)', function() {
    var r = block.parseBlock('block-beta\n  a["A"] b["B"]\n  a --> b\n');
    expect(r.elements.length).toBe(2);
    expect(r.relations.length).toBe(1);
  });
});
