'use strict';
var er = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.erDiagram)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.erDiagram);

describe('addEntity', function() {
  test('adds entity block', function() {
    var t = 'erDiagram\n';
    var out = er.addEntity(t, 'PRODUCT');
    expect(out).toContain('PRODUCT {');
    expect(out).toContain('    }');
  });
});

describe('addAttribute', function() {
  test('inserts attribute inside entity', function() {
    var t = 'erDiagram\n    CUSTOMER {\n    }\n';
    var out = er.addAttribute(t, 'CUSTOMER', 'string', 'name', '', '');
    expect(out).toContain('string name');
  });

  test('inserts with PK key', function() {
    var t = 'erDiagram\n    ORDER {\n    }\n';
    var out = er.addAttribute(t, 'ORDER', 'int', 'id', 'PK', '');
    expect(out).toContain('int id PK');
  });
});

describe('addRelationship', function() {
  test('adds relationship', function() {
    var t = 'erDiagram\n';
    var out = er.addRelationship(t, 'A', 'B', '||', 'o{', 'has', '--');
    expect(out).toContain('A ||--o{ B : has');
  });
});

describe('updateRelationship', function() {
  test('updates label', function() {
    var t = 'erDiagram\n    A ||--o{ B : old\n';
    var out = er.updateRelationship(t, 2, 'label', 'new');
    expect(out).toContain(': new');
  });
});
