'use strict';
var er = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.erDiagram)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.erDiagram);

describe('parseER — entities', function() {
  test('parses entity with attributes', function() {
    var r = er.parseER('erDiagram\n    CUSTOMER {\n        string name\n        int age\n    }\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].id).toBe('CUSTOMER');
    expect(r.elements[0].attributes.length).toBe(2);
  });

  test('parses attribute with PK', function() {
    var r = er.parseER('erDiagram\n    ORDER {\n        int id PK\n    }\n');
    expect(r.elements[0].attributes[0].key).toBe('PK');
  });
});

describe('parseER — relationships', function() {
  test('parses relationship with cardinality', function() {
    var r = er.parseER('erDiagram\n    CUSTOMER ||--o{ ORDER : places\n');
    expect(r.relations.length).toBe(1);
    expect(r.relations[0].leftCard).toBe('||');
    expect(r.relations[0].rightCard).toBe('o{');
    expect(r.relations[0].label).toBe('places');
  });

  test('registers entities from relationship', function() {
    var r = er.parseER('erDiagram\n    A ||--|| B\n');
    expect(r.elements.length).toBe(2);
  });
});
