'use strict';
var cl = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.classDiagram)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.classDiagram);

describe('parseClass — basics', function() {
  test('parses class declaration', function() {
    var r = cl.parseClass('classDiagram\n    class Animal\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].id).toBe('Animal');
  });

  test('parses class with members in block', function() {
    var r = cl.parseClass('classDiagram\n    class Animal {\n        +String name\n        +eat() void\n    }\n');
    expect(r.elements[0].members.length).toBe(2);
    expect(r.elements[0].members[0].name).toBe('String name');
    expect(r.elements[0].members[1].kind).toBe('method');
  });

  test('parses inheritance relation', function() {
    var r = cl.parseClass('classDiagram\n    Animal <|-- Dog\n');
    expect(r.relations.length).toBe(1);
    expect(r.relations[0].arrow).toBe('<|--');
    expect(r.relations[0].from).toBe('Animal');
    expect(r.relations[0].to).toBe('Dog');
  });

  test('parses relation with label', function() {
    var r = cl.parseClass('classDiagram\n    Owner --> Pet : owns\n');
    expect(r.relations[0].label).toBe('owns');
  });
});

describe('parseClass — namespaces', function() {
  test('parses namespace', function() {
    var r = cl.parseClass('classDiagram\n    namespace Vehicles {\n        class Car\n    }\n');
    expect(r.groups.length).toBe(1);
    expect(r.groups[0].kind).toBe('namespace');
    expect(r.groups[0].endLine).toBe(4);
  });
});
