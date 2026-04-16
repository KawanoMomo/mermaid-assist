'use strict';
var fc = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.flowchart)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.flowchart);

describe('addNode', function() {
  test('adds rect node', function() {
    var t = 'flowchart TD\n    A --> B\n';
    var out = fc.addNode(t, 'C', 'New', 'rect');
    expect(out).toContain('C[New]');
  });

  test('adds diamond node', function() {
    var t = 'flowchart TD\n';
    var out = fc.addNode(t, 'D', 'Q', 'diamond');
    expect(out).toContain('D{Q}');
  });
});

describe('addEdge', function() {
  test('adds edge without label', function() {
    var t = 'flowchart TD\n    A[a]\n    B[b]\n';
    var out = fc.addEdge(t, 'A', 'B', '-->', '');
    expect(out).toContain('A --> B');
  });

  test('adds edge with label', function() {
    var t = 'flowchart TD\n    A[a]\n    B[b]\n';
    var out = fc.addEdge(t, 'A', 'B', '-->', 'go');
    expect(out).toContain('A --> |go| B');
  });
});

describe('updateDirection', function() {
  test('changes TD to LR', function() {
    var t = 'flowchart TD\n    A --> B\n';
    var out = fc.updateDirection(t, 'LR');
    expect(out).toContain('flowchart LR');
    expect(out).not.toContain('flowchart TD');
  });
});

describe('updateNode', function() {
  test('updates node label', function() {
    var t = 'flowchart TD\n    A[Old]\n';
    var out = fc.updateNode(t, 2, 'label', 'New');
    expect(out).toContain('A[New]');
  });

  test('updates node shape', function() {
    var t = 'flowchart TD\n    A[Old]\n';
    var out = fc.updateNode(t, 2, 'shape', 'diamond');
    expect(out).toContain('A{Old}');
  });
});

describe('addSubgraph', function() {
  test('adds subgraph block', function() {
    var t = 'flowchart TD\n    A --> B\n';
    var out = fc.addSubgraph(t, 'G1', 'Group');
    expect(out).toContain('subgraph G1 [Group]');
    expect(out).toContain('end');
  });
});
