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
