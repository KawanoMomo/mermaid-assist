'use strict';
var updateTaskDates = fns.updateTaskDates;
var updateTaskField = fns.updateTaskField;
var addTask         = fns.addTask;
var deleteTask      = fns.deleteTask;
var parseGantt      = fns.parseGantt;

describe('updateTaskDates', function() {
  var base = [
    'gantt',
    '    title T',
    '    dateFormat YYYY-MM-DD',
    '    section S',
    '    Task A :a1, 2026-04-01, 2026-04-15',
  ].join('\n');

  test('updates start date by line number', function() {
    var out = updateTaskDates(base, 5, '2026-05-01', null);
    expect(out).toContain(':a1, 2026-05-01, 2026-04-15');
  });

  test('updates end date by line number', function() {
    var out = updateTaskDates(base, 5, null, '2026-05-15');
    expect(out).toContain(':a1, 2026-04-01, 2026-05-15');
  });

  test('updates both dates', function() {
    var out = updateTaskDates(base, 5, '2026-06-01', '2026-06-30');
    expect(out).toContain(':a1, 2026-06-01, 2026-06-30');
  });

  test('converts after-based task to explicit dates', function() {
    var text = [
      'gantt',
      '    section S',
      '    Task A :a1, 2026-04-01, 2026-04-10',
      '    Task B :b1, after a1, 2026-04-20',
    ].join('\n');
    var out = updateTaskDates(text, 4, '2026-04-12', '2026-04-25');
    expect(out).toContain(':b1, 2026-04-12, 2026-04-25');
    expect(out).not.toContain('after');
  });

  test('preserves status keyword when updating dates', function() {
    var text = 'gantt\n    section S\n    C :crit, c1, 2026-05-01, 2026-06-01\n';
    var out = updateTaskDates(text, 3, '2026-07-01', '2026-08-01');
    expect(out).toContain(':crit, c1, 2026-07-01, 2026-08-01');
  });
});

describe('updateTaskField', function() {
  var base = [
    'gantt',
    '    section S',
    '    Task A :a1, 2026-04-01, 2026-04-15',
  ].join('\n');

  test('updates label', function() {
    var out = updateTaskField(base, 3, 'label', 'New Name');
    expect(out).toContain('New Name :a1,');
  });

  test('updates status from null to crit', function() {
    var out = updateTaskField(base, 3, 'status', 'crit');
    expect(out).toContain(':crit, a1, 2026-04-01, 2026-04-15');
  });

  test('removes status by setting to null', function() {
    var text = 'gantt\n    section S\n    T :crit, a1, 2026-04-01, 2026-04-15\n';
    var out = updateTaskField(text, 3, 'status', null);
    expect(out).toContain(':a1, 2026-04-01, 2026-04-15');
    expect(out).not.toContain('crit');
  });

  test('updates id', function() {
    var out = updateTaskField(base, 3, 'id', 'newId');
    expect(out).toContain(':newId, 2026-04-01, 2026-04-15');
  });
});

describe('addTask', function() {
  test('adds task at end of section', function() {
    var text = [
      'gantt',
      '    section Alpha',
      '    T1 :t1, 2026-01-01, 2026-01-10',
      '    section Beta',
      '    T2 :t2, 2026-02-01, 2026-02-10',
    ].join('\n');
    var out = addTask(text, 0, 'New Task', 'n1', '2026-01-15', '2026-01-20');
    expect(out).toContain('New Task :n1, 2026-01-15, 2026-01-20');
    var lines = out.split('\n');
    var newLine = lines.findIndex(function(l) { return l.includes('New Task'); });
    var betaLine = lines.findIndex(function(l) { return l.includes('section Beta'); });
    expect(newLine).toBeLessThan(betaLine);
  });

  test('adds task when no sections exist', function() {
    var text = 'gantt\n    title T\n';
    var out = addTask(text, -1, 'Solo Task', 's1', '2026-01-01', '2026-01-10');
    expect(out).toContain('Solo Task :s1, 2026-01-01, 2026-01-10');
  });
});

describe('deleteTask', function() {
  test('removes task line by line number', function() {
    var text = [
      'gantt',
      '    section S',
      '    T1 :t1, 2026-01-01, 2026-01-10',
      '    T2 :t2, 2026-02-01, 2026-02-10',
    ].join('\n');
    var out = deleteTask(text, 3);
    expect(out).not.toContain('T1');
    expect(out).toContain('T2');
  });
});

describe('round-trip: parse → update → re-parse', function() {
  test('dates survive round-trip', function() {
    var text = [
      'gantt',
      '    dateFormat YYYY-MM-DD',
      '    section S',
      '    Task A :a1, 2026-04-01, 2026-04-15',
    ].join('\n');
    var updated = updateTaskDates(text, 4, '2026-05-01', '2026-05-20');
    var r = parseGantt(updated);
    expect(r.tasks[0].startDate).toBe('2026-05-01');
    expect(r.tasks[0].endDate).toBe('2026-05-20');
    expect(r.tasks[0].id).toBe('a1');
  });

  test('field update survives round-trip', function() {
    var text = [
      'gantt',
      '    section S',
      '    Old Name :a1, 2026-04-01, 2026-04-15',
    ].join('\n');
    var updated = updateTaskField(text, 3, 'label', 'New Name');
    var r = parseGantt(updated);
    expect(r.tasks[0].label).toBe('New Name');
    expect(r.tasks[0].id).toBe('a1');
  });

  test('add + parse round-trip', function() {
    var text = 'gantt\n    section S\n    T1 :t1, 2026-01-01, 2026-01-10\n';
    var updated = addTask(text, 0, 'T2', 't2', '2026-02-01', '2026-02-15');
    var r = parseGantt(updated);
    expect(r.tasks.length).toBe(2);
    expect(r.tasks[1].id).toBe('t2');
    expect(r.tasks[1].label).toBe('T2');
  });
});
