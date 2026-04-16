'use strict';
var req = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.requirementDiagram)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.requirementDiagram);

describe('addRequirement', function() {
  test('adds requirement block at end', function() {
    var t = 'requirementDiagram\n';
    var out = req.addRequirement(t, 'functionalRequirement', 'fr1');
    expect(out).toContain('functionalRequirement fr1 {');
    expect(out).toContain('id: ""');
    expect(out).toContain('risk: medium');
    expect(out).toContain('verifymethod: analysis');
  });

  test('adds with each reqType', function() {
    ['requirement', 'functionalRequirement', 'interfaceRequirement', 'performanceRequirement', 'physicalRequirement', 'designConstraint'].forEach(function(rt) {
      var out = req.addRequirement('requirementDiagram\n', rt, 'x');
      expect(out).toContain(rt + ' x {');
    });
  });
});

describe('addElement', function() {
  test('adds element block', function() {
    var out = req.addElement('requirementDiagram\n', 'ecu');
    expect(out).toContain('element ecu {');
    expect(out).toContain('type: ""');
    expect(out).toContain('docref: ""');
  });
});

describe('addRelation', function() {
  test('adds relation line', function() {
    var out = req.addRelation('requirementDiagram\n', 'a', 'satisfies', 'b');
    expect(out).toContain('a - satisfies -> b');
  });

  test('addRelation works with each of 7 reltype', function() {
    ['contains', 'copies', 'derives', 'satisfies', 'verifies', 'refines', 'traces'].forEach(function(rt) {
      var out = req.addRelation('requirementDiagram\n', 'x', rt, 'y');
      expect(out).toContain('x - ' + rt + ' -> y');
    });
  });
});

describe('deleteElement', function() {
  test('removes requirement block', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: X\n}\n';
    var parsed = req.parseRequirement(t);
    var out = req.deleteElement(t, parsed.elements[0].line, 'r1');
    expect(out).not.toContain('requirement r1');
  });

  test('cascade removes relations referencing deleted element (as from)', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: A\n}\nrequirement r2 {\n    id: B\n}\nr1 - contains -> r2\n';
    var parsed = req.parseRequirement(t);
    var out = req.deleteElement(t, parsed.elements[0].line, 'r1');
    expect(out).not.toContain('r1 - contains -> r2');
  });

  test('cascade removes relations referencing deleted element (as to)', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: A\n}\nrequirement r2 {\n    id: B\n}\nr1 - contains -> r2\n';
    var parsed = req.parseRequirement(t);
    var out = req.deleteElement(t, parsed.elements[1].line, 'r2');
    expect(out).not.toContain('-> r2');
  });
});

describe('deleteRelation', function() {
  test('removes single relation line', function() {
    var t = 'requirementDiagram\nrequirement a {\n    id: A\n}\nrequirement b {\n    id: B\n}\na - contains -> b\n';
    var parsed = req.parseRequirement(t);
    var out = req.deleteRelation(t, parsed.relations[0].line);
    expect(out).not.toContain('a - contains -> b');
  });
});

describe('updateRequirementField', function() {
  test('updates id', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: OLD\n    text: hi\n}\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateRequirementField(t, parsed.elements[0].line, 'id', 'NEW');
    expect(out).toContain('id: "NEW"');
    expect(out).not.toContain('id: OLD');
  });

  test('updates text', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: X\n    text: hi\n}\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateRequirementField(t, parsed.elements[0].line, 'text', 'changed');
    expect(out).toContain('text: "changed"');
  });

  test('appends field if missing', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: X\n}\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateRequirementField(t, parsed.elements[0].line, 'risk', 'high');
    expect(out).toContain('risk: high');
  });
});

describe('updateRequirementType', function() {
  test('changes reqType', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: X\n}\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateRequirementType(t, parsed.elements[0].line, 'functionalRequirement');
    expect(out).toContain('functionalRequirement r1 {');
  });
});

describe('updateElementField', function() {
  test('updates docref', function() {
    var t = 'requirementDiagram\nelement e1 {\n    type: code\n    docref: old\n}\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateElementField(t, parsed.elements[0].line, 'docref', 'src/new.c');
    expect(out).toContain('docref: "src/new.c"');
  });
});

describe('updateRelation', function() {
  test('updates reltype', function() {
    var t = 'requirementDiagram\nrequirement a {\n    id: A\n}\nrequirement b {\n    id: B\n}\na - contains -> b\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateRelation(t, parsed.relations[0].line, 'reltype', 'derives');
    expect(out).toContain('a - derives -> b');
  });

  test('updates from', function() {
    var t = 'requirementDiagram\nrequirement a {\n    id: A\n}\nrequirement b {\n    id: B\n}\na - contains -> b\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateRelation(t, parsed.relations[0].line, 'from', 'c');
    expect(out).toContain('c - contains -> b');
  });
});

describe('updateName', function() {
  test('renames requirement and updates from-references', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: A\n}\nrequirement r2 {\n    id: B\n}\nr1 - contains -> r2\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateName(t, parsed.elements[0].line, 'r1', 'alpha');
    expect(out).toContain('requirement alpha {');
    expect(out).toContain('alpha - contains -> r2');
    expect(out).not.toContain('requirement r1');
    expect(out).not.toContain('r1 - contains');
  });

  test('renames requirement and updates to-references', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: A\n}\nrequirement r2 {\n    id: B\n}\nr1 - contains -> r2\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateName(t, parsed.elements[1].line, 'r2', 'beta');
    expect(out).toContain('requirement beta {');
    expect(out).toContain('-> beta');
    expect(out).not.toContain('requirement r2');
  });

  test('renames element and updates references', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: A\n}\nelement e1 {\n    type: code\n}\ne1 - satisfies -> r1\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateName(t, parsed.elements[1].line, 'e1', 'ecu');
    expect(out).toContain('element ecu {');
    expect(out).toContain('ecu - satisfies -> r1');
  });
});

describe('operations.moveUp / moveDown / connect', function() {
  test('moveUp swaps with previous line', function() {
    var t = 'A\nB\nC\n';
    var out = req.operations.moveUp(t, 2);
    expect(out.split('\n')[0]).toBe('B');
    expect(out.split('\n')[1]).toBe('A');
  });

  test('moveDown swaps with next line', function() {
    var t = 'A\nB\nC\n';
    var out = req.operations.moveDown(t, 1);
    expect(out.split('\n')[0]).toBe('B');
    expect(out.split('\n')[1]).toBe('A');
  });

  test('connect creates a satisfies relation by default', function() {
    var t = 'requirementDiagram\nrequirement r1 { id: A }\nelement e1 { type: x }\n';
    var out = req.operations.connect(t, 'e1', 'r1');
    expect(out).toContain('e1 - satisfies -> r1');
  });

  test('connect with reltype prop', function() {
    var out = req.operations.connect('requirementDiagram\n', 'a', 'b', { reltype: 'derives' });
    expect(out).toContain('a - derives -> b');
  });
});
