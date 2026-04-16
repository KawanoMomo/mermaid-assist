'use strict';
var cl = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.classDiagram)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.classDiagram);

describe('addClass', function() {
  test('adds class', function() {
    var t = 'classDiagram\n';
    var out = cl.addClass(t, 'Cat');
    expect(out).toContain('class Cat');
  });
});

describe('addMember', function() {
  test('adds attribute', function() {
    var t = 'classDiagram\n    class Animal\n';
    var out = cl.addMember(t, 'Animal', '+', 'name', 'String', false);
    expect(out).toContain('Animal : +name String');
  });

  test('adds method', function() {
    var t = 'classDiagram\n    class Animal\n';
    var out = cl.addMember(t, 'Animal', '+', 'eat', 'void', true);
    expect(out).toContain('Animal : +eat() void');
  });
});

describe('addRelation', function() {
  test('adds inheritance', function() {
    var t = 'classDiagram\n';
    var out = cl.addRelation(t, 'Animal', 'Dog', '<|--', '');
    expect(out).toContain('Animal <|-- Dog');
  });

  test('adds with label', function() {
    var t = 'classDiagram\n';
    var out = cl.addRelation(t, 'A', 'B', '-->', 'uses');
    expect(out).toContain('A --> B : uses');
  });
});

describe('addNamespace', function() {
  test('adds namespace block', function() {
    var t = 'classDiagram\n';
    var out = cl.addNamespace(t, 'NS');
    expect(out).toContain('namespace NS {');
    expect(out).toContain('    }');
  });
});
