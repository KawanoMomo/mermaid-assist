'use strict';
var st = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.state)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.state);

describe('addState', function() {
  test('adds simple state', function() {
    var t = 'stateDiagram-v2\n    [*] --> A\n';
    var out = st.addState(t, 'B', 'B', 'simple');
    expect(out).toContain('state B');
  });

  test('adds fork state', function() {
    var t = 'stateDiagram-v2\n';
    var out = st.addState(t, 'F', 'F', 'fork');
    expect(out).toContain('state F <<fork>>');
  });

  test('adds aliased state', function() {
    var t = 'stateDiagram-v2\n';
    var out = st.addState(t, 'R', 'Running', 'simple');
    expect(out).toContain('state "Running" as R');
  });
});

describe('addTransition', function() {
  test('adds transition', function() {
    var t = 'stateDiagram-v2\n    [*] --> A\n';
    var out = st.addTransition(t, 'A', 'B', 'click');
    expect(out).toContain('A --> B : click');
  });
});

describe('addComposite', function() {
  test('adds composite block', function() {
    var t = 'stateDiagram-v2\n';
    var out = st.addComposite(t, 'C', 'Comp');
    expect(out).toContain('state "Comp" as C {');
    expect(out).toContain('    }');
  });
});

describe('updateTransition', function() {
  test('updates event', function() {
    var t = 'stateDiagram-v2\n    A --> B : old\n';
    var out = st.updateTransition(t, 2, 'label', 'new');
    expect(out).toContain(': new');
  });
});
