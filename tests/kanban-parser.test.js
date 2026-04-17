'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils) || (global.window && global.window.MA && global.window.MA.parserUtils);
var kb = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.kanban) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.kanban);

describe('detectDiagramType — kanban', function() {
  test('detects kanban', function() { expect(parserUtils.detectDiagramType('kanban\n')).toBe('kanban'); });
});

describe('parseKanban', function() {
  test('parses columns', function() {
    var r = kb.parseKanban('kanban\n    Todo\n    Done\n');
    var cols = r.elements.filter(function(e) { return e.kind === 'column'; });
    expect(cols.length).toBe(2);
  });
  test('parses cards under columns', function() {
    var r = kb.parseKanban('kanban\n    Todo\n        [Task1]\n        [Task2]\n');
    var cards = r.elements.filter(function(e) { return e.kind === 'card'; });
    expect(cards.length).toBe(2);
    expect(cards[0].text).toBe('Task1');
    expect(cards[0].parentId).toBe('Todo');
  });
  test('captures card meta', function() {
    var r = kb.parseKanban("kanban\n    Todo\n        [T]@{ assigned: 'alice' }\n");
    var cards = r.elements.filter(function(e) { return e.kind === 'card'; });
    expect(cards[0].text).toBe('T');
    expect(cards[0].meta).toContain('assigned');
  });
});
