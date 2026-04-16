'use strict';
var m = global.fns;
// Use the sequence module directly (not fns export)
var seq = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.sequence)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.sequence);

describe('parseSequence — metadata', function() {
  test('parses title', function() {
    var r = seq.parseSequence('sequenceDiagram\n    title Test Title\n');
    expect(r.meta.title).toBe('Test Title');
  });

  test('parses autonumber (boolean)', function() {
    var r = seq.parseSequence('sequenceDiagram\n    autonumber\n');
    expect(r.meta.autonumber).toBe(true);
  });

  test('parses autonumber off', function() {
    var r = seq.parseSequence('sequenceDiagram\n    autonumber off\n');
    expect(r.meta.autonumber).toBe(false);
  });
});

describe('parseSequence — participants', function() {
  test('parses participant without alias', function() {
    var r = seq.parseSequence('sequenceDiagram\n    participant Alice\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].kind).toBe('participant');
    expect(r.elements[0].id).toBe('Alice');
    expect(r.elements[0].label).toBe('Alice');
    expect(r.elements[0].line).toBe(2);
  });

  test('parses participant with alias', function() {
    var r = seq.parseSequence('sequenceDiagram\n    participant A as Alice\n');
    expect(r.elements[0].id).toBe('A');
    expect(r.elements[0].label).toBe('Alice');
  });

  test('parses actor', function() {
    var r = seq.parseSequence('sequenceDiagram\n    actor C as Carol\n');
    expect(r.elements[0].kind).toBe('actor');
  });
});

describe('parseSequence — messages', function() {
  test('parses ->> message', function() {
    var r = seq.parseSequence('sequenceDiagram\n    A->>B: Hello\n');
    expect(r.relations.length).toBe(1);
    expect(r.relations[0].from).toBe('A');
    expect(r.relations[0].to).toBe('B');
    expect(r.relations[0].arrow).toBe('->>');
    expect(r.relations[0].label).toBe('Hello');
  });

  test('parses -->> message', function() {
    var r = seq.parseSequence('sequenceDiagram\n    A-->>B: Reply\n');
    expect(r.relations[0].arrow).toBe('-->>');
  });

  test('parses message without label', function() {
    var r = seq.parseSequence('sequenceDiagram\n    A->>B\n');
    expect(r.relations[0].label).toBe('');
  });
});

describe('parseSequence — blocks', function() {
  test('parses loop block', function() {
    var r = seq.parseSequence('sequenceDiagram\n    loop Every minute\n        A->>B: ping\n    end\n');
    expect(r.groups.length).toBe(1);
    expect(r.groups[0].kind).toBe('loop');
    expect(r.groups[0].label).toBe('Every minute');
    expect(r.groups[0].line).toBe(2);
    expect(r.groups[0].endLine).toBe(4);
  });

  test('parses alt/else block', function() {
    var r = seq.parseSequence('sequenceDiagram\n    alt ok\n        A->>B: x\n    else fail\n        A->>B: y\n    end\n');
    // 2 groups: alt + else
    expect(r.groups.length).toBe(2);
    expect(r.groups[0].kind).toBe('alt');
    expect(r.groups[1].kind).toBe('else');
  });

  test('tracks message blockPath for nested', function() {
    var r = seq.parseSequence('sequenceDiagram\n    loop outer\n        alt ok\n            A->>B: x\n        end\n    end\n');
    expect(r.relations[0].blockPath.length).toBe(2);
  });
});

describe('parseSequence — notes', function() {
  test('parses note left of', function() {
    var r = seq.parseSequence('sequenceDiagram\n    note left of A: hello\n');
    var notes = r.elements.filter(function(e) { return e.kind === 'note'; });
    expect(notes.length).toBe(1);
    expect(notes[0].position).toBe('left of');
    expect(notes[0].targets[0]).toBe('A');
    expect(notes[0].text).toBe('hello');
  });

  test('parses note over with two targets', function() {
    var r = seq.parseSequence('sequenceDiagram\n    note over A,B: spans\n');
    var n = r.elements.filter(function(e) { return e.kind === 'note'; })[0];
    expect(n.targets.length).toBe(2);
  });
});
