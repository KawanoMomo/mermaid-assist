'use strict';
var fc = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.flowchart)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.flowchart);

describe('parseFlowchart — header', function() {
  test('parses direction TD', function() {
    var r = fc.parseFlowchart('flowchart TD\n    A --> B\n');
    expect(r.meta.direction).toBe('TD');
  });

  test('parses direction LR', function() {
    var r = fc.parseFlowchart('flowchart LR\n    A --> B\n');
    expect(r.meta.direction).toBe('LR');
  });

  test('accepts graph keyword', function() {
    var r = fc.parseFlowchart('graph TB\n    A --> B\n');
    expect(r.meta.direction).toBe('TB');
  });
});

describe('parseFlowchart — nodes', function() {
  test('parses node with rect shape', function() {
    var r = fc.parseFlowchart('flowchart TD\n    A[Start] --> B[End]\n');
    expect(r.elements.length).toBe(2);
    expect(r.elements[0].id).toBe('A');
    expect(r.elements[0].label).toBe('Start');
    expect(r.elements[0].shape).toBe('rect');
  });

  test('parses node with diamond shape', function() {
    var r = fc.parseFlowchart('flowchart TD\n    A{Decision} --> B[End]\n');
    expect(r.elements[0].shape).toBe('diamond');
  });

  test('parses standalone node', function() {
    var r = fc.parseFlowchart('flowchart TD\n    A[Standalone]\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].shape).toBe('rect');
  });

  test('parses node without shape (default rect)', function() {
    var r = fc.parseFlowchart('flowchart TD\n    A --> B\n');
    expect(r.elements[0].shape).toBe('rect');
  });
});

describe('parseFlowchart — edges', function() {
  test('parses --> edge', function() {
    var r = fc.parseFlowchart('flowchart TD\n    A --> B\n');
    expect(r.relations.length).toBe(1);
    expect(r.relations[0].from).toBe('A');
    expect(r.relations[0].to).toBe('B');
    expect(r.relations[0].arrow).toBe('-->');
  });

  test('parses edge with label', function() {
    var r = fc.parseFlowchart('flowchart TD\n    A -->|yes| B\n');
    expect(r.relations[0].label).toBe('yes');
  });

  test('parses ==> edge', function() {
    var r = fc.parseFlowchart('flowchart TD\n    A ==> B\n');
    expect(r.relations[0].arrow).toBe('==>');
  });
});

describe('parseFlowchart — subgraphs', function() {
  test('parses subgraph', function() {
    var r = fc.parseFlowchart('flowchart TD\n    subgraph G1 [Group One]\n        A --> B\n    end\n');
    expect(r.groups.length).toBe(1);
    expect(r.groups[0].kind).toBe('subgraph');
    expect(r.groups[0].id).toBe('G1');
    expect(r.groups[0].label).toBe('Group One');
    expect(r.groups[0].endLine).toBe(4);
  });

  test('parses classDef', function() {
    var r = fc.parseFlowchart('flowchart TD\n    A --> B\n    classDef imp fill:#f00\n');
    var cds = r.groups.filter(function(g) { return g.kind === 'classDef'; });
    expect(cds.length).toBe(1);
    expect(cds[0].id).toBe('imp');
  });
});
