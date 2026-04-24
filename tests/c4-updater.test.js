'use strict';
var c4 = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.c4) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.c4);

describe('setTitle / setVariant', function() {
  test('sets title', function() { expect(c4.setTitle('C4Context\n', 'X')).toContain('title X'); });
  test('sets variant', function() { expect(c4.setVariant('C4Context\n', 'Container')).toContain('C4Container'); });
});
describe('addElement', function() {
  test('adds Person', function() { expect(c4.addElement('C4Context\n', 'Person', 'u', 'User', 'desc')).toContain('Person(u, "User", "desc")'); });
  test('adds Container with tech', function() { expect(c4.addElement('C4Context\n', 'Container', 'api', 'API', 'backend', 'Java')).toContain('Container(api, "API", "Java", "backend")'); });
});
describe('addRel', function() {
  test('adds Rel with label', function() { expect(c4.addRel('C4Context\n', 'Rel', 'a', 'b', 'uses')).toContain('Rel(a, b, "uses")'); });
  test('adds Rel with tech', function() { expect(c4.addRel('C4Context\n', 'Rel', 'a', 'b', 'calls', 'HTTP')).toContain('Rel(a, b, "calls", "HTTP")'); });
});
describe('updateElement', function() {
  test('updates label', function() {
    var t = 'C4Context\n    Person(u, "Old", "d")\n';
    var p = c4.parseC4(t);
    var out = c4.updateElement(t, p.elements[0].line, 'label', 'New');
    expect(out).toContain('Person(u, "New", "d")');
  });
});
describe('updateRel', function() {
  test('updates label', function() {
    var t = 'C4Context\n    Rel(a, b, "old")\n';
    var p = c4.parseC4(t);
    var out = c4.updateRel(t, p.relations[0].line, 'label', 'new');
    expect(out).toContain('Rel(a, b, "new")');
  });
});
describe('parseArgs', function() {
  test('handles quoted commas', function() {
    var args = c4.parseArgs('u, "Label, with, commas", "d"');
    expect(args.length).toBe(3);
    expect(args[1]).toBe('Label, with, commas');
  });
});
