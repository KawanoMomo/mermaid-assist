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
