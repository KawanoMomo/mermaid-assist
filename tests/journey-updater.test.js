'use strict';
var jr = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.journey)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.journey);

describe('setTitle', function() {
  test('sets title', function() { expect(jr.setTitle('journey\n', 'Hello')).toContain('title Hello'); });
});
describe('addSection', function() {
  test('adds section', function() { expect(jr.addSection('journey\n', 'S1')).toContain('section S1'); });
});
describe('addTask', function() {
  test('adds task under section', function() {
    var t = 'journey\n    section S\n';
    var out = jr.addTask(t, 'S', 'Coffee', '5', 'Me');
    expect(out).toContain('Coffee: 5: Me');
  });
});
describe('updateTask', function() {
  test('updates score', function() {
    var t = 'journey\n    section S\n      X: 3: Me\n';
    var p = jr.parseJourney(t);
    var task = p.elements.filter(function(e){return e.kind==='task';})[0];
    var out = jr.updateTask(t, task.line, 'score', '9');
    expect(out).toContain('X: 9: Me');
  });
});
describe('deleteElement', function() {
  test('deletes section with tasks', function() {
    var t = 'journey\n    section A\n      T: 1: Me\n    section B\n      U: 2: Me\n';
    var p = jr.parseJourney(t);
    var sec = p.elements.filter(function(e){return e.kind==='section' && e.id==='A';})[0];
    var out = jr.deleteElement(t, sec.line);
    expect(out).not.toContain('section A');
    expect(out).not.toContain('T: 1');
    expect(out).toContain('section B');
  });
});
