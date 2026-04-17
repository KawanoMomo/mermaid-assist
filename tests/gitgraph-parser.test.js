'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils)
  || (global.window && global.window.MA && global.window.MA.parserUtils);
var gg = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.gitGraph)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.gitGraph);

describe('detectDiagramType — gitGraph', function() {
  test('detects gitGraph keyword', function() {
    expect(parserUtils.detectDiagramType('gitGraph\n')).toBe('gitGraph');
  });
});

describe('parseGitgraph — commit', function() {
  test('parses bare commit', function() {
    var r = gg.parseGitgraph('gitGraph\n    commit\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].kind).toBe('commit');
    expect(r.elements[0].commitType).toBe('NORMAL');
    expect(r.elements[0].id).toBe('');
  });
  test('parses commit with id', function() {
    var r = gg.parseGitgraph('gitGraph\n    commit id: "init"\n');
    expect(r.elements[0].id).toBe('init');
  });
  test('parses commit with type', function() {
    var r = gg.parseGitgraph('gitGraph\n    commit type: HIGHLIGHT\n');
    expect(r.elements[0].commitType).toBe('HIGHLIGHT');
  });
  test('parses commit with id, type, tag', function() {
    var r = gg.parseGitgraph('gitGraph\n    commit id: "x" type: REVERSE tag: "v1"\n');
    expect(r.elements[0].id).toBe('x');
    expect(r.elements[0].commitType).toBe('REVERSE');
    expect(r.elements[0].tag).toBe('v1');
  });
});

describe('parseGitgraph — branch/checkout/merge', function() {
  test('parses branch', function() {
    var r = gg.parseGitgraph('gitGraph\n    branch develop\n');
    expect(r.elements[0].kind).toBe('branch');
    expect(r.elements[0].name).toBe('develop');
  });
  test('tracks current branch through checkout', function() {
    var r = gg.parseGitgraph('gitGraph\n    commit\n    branch develop\n    commit\n    checkout main\n    commit\n');
    var commits = r.elements.filter(function(e) { return e.kind === 'commit'; });
    expect(commits[0].branch).toBe('main');
    expect(commits[1].branch).toBe('develop');
    expect(commits[2].branch).toBe('main');
  });
  test('parses merge', function() {
    var r = gg.parseGitgraph('gitGraph\n    merge develop\n');
    expect(r.elements[0].kind).toBe('merge');
    expect(r.elements[0].target).toBe('develop');
  });
  test('parses merge with tag', function() {
    var r = gg.parseGitgraph('gitGraph\n    merge develop tag: "v2"\n');
    expect(r.elements[0].tag).toBe('v2');
  });
});

describe('parseGitgraph — cherry-pick', function() {
  test('parses cherry-pick', function() {
    var r = gg.parseGitgraph('gitGraph\n    cherry-pick id: "abc"\n');
    expect(r.elements[0].kind).toBe('cherry-pick');
    expect(r.elements[0].id).toBe('abc');
  });
});
