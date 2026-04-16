'use strict';
var st = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.state)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.state);

describe('parseState — basics', function() {
  test('parses simple transition', function() {
    var r = st.parseState('stateDiagram-v2\n    A --> B\n');
    expect(r.relations.length).toBe(1);
    expect(r.relations[0].from).toBe('A');
    expect(r.relations[0].to).toBe('B');
  });

  test('parses transition with event', function() {
    var r = st.parseState('stateDiagram-v2\n    A --> B : click\n');
    expect(r.relations[0].label).toBe('click');
  });

  test('parses [*] pseudo-state', function() {
    var r = st.parseState('stateDiagram-v2\n    [*] --> A\n');
    expect(r.relations[0].from).toBe('[*]');
  });

  test('registers states implicitly from transitions', function() {
    var r = st.parseState('stateDiagram-v2\n    A --> B\n');
    expect(r.elements.length).toBe(2);
  });
});

describe('parseState — special states', function() {
  test('parses fork state', function() {
    var r = st.parseState('stateDiagram-v2\n    state F <<fork>>\n');
    var fs = r.elements.filter(function(e) { return e.type === 'fork'; });
    expect(fs.length).toBe(1);
  });

  test('parses state with alias', function() {
    var r = st.parseState('stateDiagram-v2\n    state "Running state" as R\n');
    var s = r.elements.filter(function(e) { return e.id === 'R'; })[0];
    expect(s.label).toBe('Running state');
  });
});

describe('parseState — composites', function() {
  test('parses composite state', function() {
    var r = st.parseState('stateDiagram-v2\n    state "Comp" as C {\n        A --> B\n    }\n');
    expect(r.groups.length).toBe(1);
    expect(r.groups[0].kind).toBe('composite');
    expect(r.groups[0].label).toBe('Comp');
  });
});

describe('parseState — notes', function() {
  test('parses note', function() {
    var r = st.parseState('stateDiagram-v2\n    A --> B\n    note left of A : Hello\n');
    var notes = r.elements.filter(function(e) { return e.kind === 'note'; });
    expect(notes.length).toBe(1);
    expect(notes[0].position).toBe('left of');
    expect(notes[0].text).toBe('Hello');
  });
});
