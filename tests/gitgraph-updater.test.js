'use strict';
var gg = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.gitGraph)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.gitGraph);

describe('addCommit', function() {
  test('adds bare commit', function() {
    var out = gg.addCommit('gitGraph\n', '', '', '');
    expect(out).toContain('    commit');
  });
  test('adds commit with id', function() {
    var out = gg.addCommit('gitGraph\n', 'v1', '', '');
    expect(out).toContain('commit id: "v1"');
  });
  test('adds commit with type', function() {
    var out = gg.addCommit('gitGraph\n', '', 'HIGHLIGHT', '');
    expect(out).toContain('type: HIGHLIGHT');
  });
  test('adds commit with tag', function() {
    var out = gg.addCommit('gitGraph\n', 'x', 'NORMAL', 'v1');
    expect(out).toContain('tag: "v1"');
  });
});

describe('addBranch / addCheckout / addMerge / addCherryPick', function() {
  test('addBranch', function() {
    var out = gg.addBranch('gitGraph\n', 'feature-x');
    expect(out).toContain('branch feature-x');
  });
  test('addCheckout', function() {
    var out = gg.addCheckout('gitGraph\n', 'main');
    expect(out).toContain('checkout main');
  });
  test('addMerge without tag', function() {
    var out = gg.addMerge('gitGraph\n', 'develop', '');
    expect(out).toContain('merge develop');
  });
  test('addMerge with tag', function() {
    var out = gg.addMerge('gitGraph\n', 'develop', 'v1');
    expect(out).toContain('merge develop tag: "v1"');
  });
  test('addCherryPick', function() {
    var out = gg.addCherryPick('gitGraph\n', 'abc');
    expect(out).toContain('cherry-pick id: "abc"');
  });
});

describe('updateCommit', function() {
  test('updates id', function() {
    var t = 'gitGraph\n    commit id: "old"\n';
    var parsed = gg.parseGitgraph(t);
    var out = gg.updateCommit(t, parsed.elements[0].line, 'id', 'new');
    expect(out).toContain('id: "new"');
    expect(out).not.toContain('"old"');
  });
  test('updates type', function() {
    var t = 'gitGraph\n    commit\n';
    var parsed = gg.parseGitgraph(t);
    var out = gg.updateCommit(t, parsed.elements[0].line, 'type', 'HIGHLIGHT');
    expect(out).toContain('type: HIGHLIGHT');
  });
  test('updates tag', function() {
    var t = 'gitGraph\n    commit id: "x"\n';
    var parsed = gg.parseGitgraph(t);
    var out = gg.updateCommit(t, parsed.elements[0].line, 'tag', 'v1');
    expect(out).toContain('tag: "v1"');
  });
});

describe('updateBranch / updateCheckout / updateMerge', function() {
  test('updateBranch', function() {
    var t = 'gitGraph\n    branch old\n';
    var parsed = gg.parseGitgraph(t);
    var out = gg.updateBranch(t, parsed.elements[0].line, 'new-branch');
    expect(out).toContain('branch new-branch');
  });
  test('updateMerge target', function() {
    var t = 'gitGraph\n    merge old-branch\n';
    var parsed = gg.parseGitgraph(t);
    var out = gg.updateMerge(t, parsed.elements[0].line, 'target', 'new-branch');
    expect(out).toContain('merge new-branch');
  });
});

describe('deleteLine', function() {
  test('removes line', function() {
    var t = 'gitGraph\n    commit\n    branch develop\n';
    var parsed = gg.parseGitgraph(t);
    var out = gg.deleteLine(t, parsed.elements[1].line);
    expect(out).not.toContain('branch develop');
    expect(out).toContain('    commit');
  });
});
