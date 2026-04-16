'use strict';
var req = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.requirementDiagram)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.requirementDiagram);

describe('addRequirement', function() {
  test('adds requirement block at end', function() {
    var t = 'requirementDiagram\n';
    var out = req.addRequirement(t, 'functionalRequirement', 'fr1');
    expect(out).toContain('functionalRequirement fr1 {');
    expect(out).toContain('id: ');
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
    expect(out).toContain('type: ');
    expect(out).toContain('docref: ');
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
