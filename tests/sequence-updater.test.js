'use strict';
var seq = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.sequence)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.sequence);

describe('addParticipant', function() {
  test('adds participant after existing', function() {
    var t = 'sequenceDiagram\n    participant A\n';
    var out = seq.addParticipant(t, 'participant', 'B', 'Bob');
    expect(out).toContain('participant B as Bob');
  });

  test('adds after sequenceDiagram when no participants exist', function() {
    var t = 'sequenceDiagram\n    A->>B: x\n';
    var out = seq.addParticipant(t, 'participant', 'C');
    expect(out).toContain('participant C');
  });
});

describe('deleteParticipant', function() {
  test('removes line', function() {
    var t = 'sequenceDiagram\n    participant A\n    participant B\n';
    var out = seq.deleteParticipant(t, 2);
    expect(out).not.toContain('participant A');
    expect(out).toContain('participant B');
  });
});

describe('moveParticipant', function() {
  // gap semantics: 0 = head, k = between (k-1) and k, N = tail.

  test('gap 0 moves C (last) to the head', function() {
    var t = 'sequenceDiagram\n    participant A\n    participant B\n    participant C\n';
    var out = seq.moveParticipant(t, 'C', 0);
    var lines = out.split('\n').filter(function(l) { return l.trim().indexOf('participant') === 0; });
    expect(lines[0]).toContain('participant C');
    expect(lines[1]).toContain('participant A');
    expect(lines[2]).toContain('participant B');
  });

  test('gap 2 moves A two positions forward to the B-C boundary', function() {
    // Regression guard from PlantUMLAssist: dropping on the visible dotted line
    // between B and C must land the dragged participant exactly there.
    var t = 'sequenceDiagram\n    participant A\n    participant B\n    participant C\n';
    var out = seq.moveParticipant(t, 'A', 2);
    var lines = out.split('\n').filter(function(l) { return l.trim().indexOf('participant') === 0; });
    expect(lines[0]).toContain('participant B');
    expect(lines[1]).toContain('participant A');
    expect(lines[2]).toContain('participant C');
  });

  test('gap N (= length) drops at the end', function() {
    var t = 'sequenceDiagram\n    participant A\n    participant B\n    participant C\n';
    var out = seq.moveParticipant(t, 'A', 3);
    var lines = out.split('\n').filter(function(l) { return l.trim().indexOf('participant') === 0; });
    expect(lines[0]).toContain('participant B');
    expect(lines[1]).toContain('participant C');
    expect(lines[2]).toContain('participant A');
  });

  test('gap adjacent to self is a no-op', function() {
    var t = 'sequenceDiagram\n    participant A\n    participant B\n    participant C\n';
    // A is at from=0 → gaps 0 and 1 are both "A's own slot"
    expect(seq.moveParticipant(t, 'A', 0)).toBe(t);
    expect(seq.moveParticipant(t, 'A', 1)).toBe(t);
  });

  test('preserves message lines in order', function() {
    var t = 'sequenceDiagram\n    participant A\n    participant B\n    A->>B: msg\n';
    var out = seq.moveParticipant(t, 'B', 0);
    expect(out).toContain('participant B');
    expect(out).toContain('A->>B: msg');
  });

  test('mixed actor+participant kinds', function() {
    var t = 'sequenceDiagram\n    actor U\n    participant S\n    participant D\n';
    var out = seq.moveParticipant(t, 'U', 3);
    var partLines = out.split('\n').filter(function(l) { return /^(actor|participant)\s/.test(l.trim()); });
    expect(partLines[0]).toContain('participant S');
    expect(partLines[1]).toContain('participant D');
    expect(partLines[2]).toContain('actor U');
  });
});

describe('addMessage', function() {
  test('adds message at end', function() {
    var t = 'sequenceDiagram\n    participant A\n    participant B\n';
    var out = seq.addMessage(t, 'A', 'B', '->>', 'Hi');
    expect(out).toContain('A->>B: Hi');
  });
});

describe('updateMessage', function() {
  test('updates message label', function() {
    var t = 'sequenceDiagram\n    A->>B: old\n';
    var out = seq.updateMessage(t, 2, 'label', 'new');
    expect(out).toContain(': new');
  });

  test('updates arrow type', function() {
    var t = 'sequenceDiagram\n    A->>B: hi\n';
    var out = seq.updateMessage(t, 2, 'arrow', '-->>');
    expect(out).toContain('A-->>B');
  });
});

describe('addBlock', function() {
  test('adds loop block', function() {
    var t = 'sequenceDiagram\n    A->>B: x\n';
    var out = seq.addBlock(t, 'loop', 'until done');
    expect(out).toContain('loop until done');
    expect(out).toContain('    end');
  });
});

describe('toggleAutonumber', function() {
  test('adds autonumber when absent', function() {
    var t = 'sequenceDiagram\n    A->>B: x\n';
    var out = seq.toggleAutonumber(t);
    expect(out).toContain('autonumber');
  });

  test('removes autonumber when present', function() {
    var t = 'sequenceDiagram\n    autonumber\n    A->>B: x\n';
    var out = seq.toggleAutonumber(t);
    expect(out).not.toContain('autonumber');
  });
});

describe('addNote', function() {
  test('adds note with position', function() {
    var t = 'sequenceDiagram\n    A->>B: x\n';
    var out = seq.addNote(t, 'over', ['A', 'B'], 'important');
    expect(out).toContain('note over A,B: important');
  });
});
