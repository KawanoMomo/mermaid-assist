'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils)
  || (global.window && global.window.MA && global.window.MA.parserUtils);

describe('detectDiagramType — requirementDiagram', function() {
  test('detects requirementDiagram keyword', function() {
    expect(parserUtils.detectDiagramType('requirementDiagram\n')).toBe('requirementDiagram');
  });
});

var req = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.requirementDiagram)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.requirementDiagram);

describe('parseRequirement — 6 reqType', function() {
  test('parses requirement type', function() {
    var r = req.parseRequirement('requirementDiagram\n\nrequirement r1 {\n    id: REQ-001\n    text: hello\n    risk: high\n    verifymethod: test\n}\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].kind).toBe('requirement');
    expect(r.elements[0].reqType).toBe('requirement');
    expect(r.elements[0].name).toBe('r1');
    expect(r.elements[0].id).toBe('REQ-001');
    expect(r.elements[0].text).toBe('hello');
    expect(r.elements[0].risk).toBe('high');
    expect(r.elements[0].verifymethod).toBe('test');
  });

  test('parses functionalRequirement', function() {
    var r = req.parseRequirement('requirementDiagram\nfunctionalRequirement fr1 {\n    id: F-1\n}\n');
    expect(r.elements[0].reqType).toBe('functionalRequirement');
  });

  test('parses interfaceRequirement', function() {
    var r = req.parseRequirement('requirementDiagram\ninterfaceRequirement ir1 {\n    id: I-1\n}\n');
    expect(r.elements[0].reqType).toBe('interfaceRequirement');
  });

  test('parses performanceRequirement', function() {
    var r = req.parseRequirement('requirementDiagram\nperformanceRequirement pr1 {\n    id: P-1\n}\n');
    expect(r.elements[0].reqType).toBe('performanceRequirement');
  });

  test('parses physicalRequirement', function() {
    var r = req.parseRequirement('requirementDiagram\nphysicalRequirement ph1 {\n    id: PH-1\n}\n');
    expect(r.elements[0].reqType).toBe('physicalRequirement');
  });

  test('parses designConstraint', function() {
    var r = req.parseRequirement('requirementDiagram\ndesignConstraint dc1 {\n    id: DC-1\n}\n');
    expect(r.elements[0].reqType).toBe('designConstraint');
  });
});

describe('parseRequirement — comments and blank lines', function() {
  test('skips comments', function() {
    var r = req.parseRequirement('requirementDiagram\n%% this is comment\nrequirement r1 {\n    id: X\n}\n');
    expect(r.elements.length).toBe(1);
  });
});

describe('parseRequirement — element', function() {
  test('parses element with type and docref', function() {
    var r = req.parseRequirement('requirementDiagram\nelement ecu {\n    type: code module\n    docref: src/ecu.c\n}\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].kind).toBe('element');
    expect(r.elements[0].name).toBe('ecu');
    expect(r.elements[0].type).toBe('code module');
    expect(r.elements[0].docref).toBe('src/ecu.c');
  });

  test('parses element with empty docref', function() {
    var r = req.parseRequirement('requirementDiagram\nelement e1 {\n    type: simulation\n}\n');
    expect(r.elements[0].docref).toBe('');
  });
});

describe('parseRequirement — relations (7 reltype)', function() {
  var reltypes = ['contains', 'copies', 'derives', 'satisfies', 'verifies', 'refines', 'traces'];
  reltypes.forEach(function(rt) {
    test('parses reltype ' + rt, function() {
      var r = req.parseRequirement('requirementDiagram\nrequirement a {\n    id: A\n}\nrequirement b {\n    id: B\n}\na - ' + rt + ' -> b\n');
      expect(r.relations.length).toBe(1);
      expect(r.relations[0].from).toBe('a');
      expect(r.relations[0].to).toBe('b');
      expect(r.relations[0].reltype).toBe(rt);
    });
  });

  test('multiple relations get unique IDs', function() {
    var r = req.parseRequirement('requirementDiagram\nrequirement a { id: A }\nrequirement b { id: B }\nrequirement c { id: C }\na - contains -> b\nb - derives -> c\n');
    expect(r.relations.length).toBe(2);
    expect(r.relations[0].id).not.toBe(r.relations[1].id);
  });
});

describe('parseRequirement — quote stripping', function() {
  test('strips quotes from id and text fields', function() {
    var r = req.parseRequirement('requirementDiagram\nrequirement r1 {\n    id: "REQ-001"\n    text: "hello world"\n}\n');
    expect(r.elements[0].id).toBe('REQ-001');
    expect(r.elements[0].text).toBe('hello world');
  });

  test('strips quotes from element type and docref', function() {
    var r = req.parseRequirement('requirementDiagram\nelement e1 {\n    type: "code module"\n    docref: "src/x.c"\n}\n');
    expect(r.elements[0].type).toBe('code module');
    expect(r.elements[0].docref).toBe('src/x.c');
  });
});
