'use strict';
var kb = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.kanban) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.kanban);

describe('addColumn', function() {
  test('appends column', function() { expect(kb.addColumn('kanban\n', 'Review')).toContain('Review'); });
});
describe('addCard', function() {
  test('adds card under column', function() {
    var t = 'kanban\n    Todo\n';
    var out = kb.addCard(t, 'Todo', 'Task X', '');
    expect(out).toContain('[Task X]');
  });
  test('adds card with meta', function() {
    var t = 'kanban\n    Todo\n';
    var out = kb.addCard(t, 'Todo', 'X', "@{ ticket: 'T1' }");
    expect(out).toContain("[X] @{ ticket: 'T1' }");
  });
});
describe('updateCard', function() {
  test('updates text', function() {
    var t = 'kanban\n    Todo\n        [Old]\n';
    var p = kb.parseKanban(t);
    var c = p.elements.filter(function(e) { return e.kind === 'card'; })[0];
    var out = kb.updateCard(t, c.line, 'text', 'New');
    expect(out).toContain('[New]');
  });
});
describe('deleteElement', function() {
  test('deletes card only', function() {
    var t = 'kanban\n    Todo\n        [A]\n        [B]\n    Done\n';
    var p = kb.parseKanban(t);
    var card = p.elements.filter(function(e) { return e.kind === 'card'; })[0];
    var out = kb.deleteElement(t, card.line);
    expect(out).not.toContain('[A]');
    expect(out).toContain('[B]');
    expect(out).toContain('Todo');
  });
  test('deletes column cascades cards', function() {
    var t = 'kanban\n    Todo\n        [A]\n        [B]\n    Done\n        [C]\n';
    var p = kb.parseKanban(t);
    var col = p.elements.filter(function(e) { return e.kind === 'column' && e.id === 'Todo'; })[0];
    var out = kb.deleteElement(t, col.line);
    expect(out).not.toContain('Todo');
    expect(out).not.toContain('[A]');
    expect(out).not.toContain('[B]');
    expect(out).toContain('Done');
  });
});
