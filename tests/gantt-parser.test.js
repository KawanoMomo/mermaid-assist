'use strict';
var parseGantt = fns.parseGantt;

describe('parseGantt — metadata', function() {
  test('parses title', function() {
    var r = parseGantt('gantt\n    title My Project\n');
    expect(r.title).toBe('My Project');
  });

  test('parses dateFormat', function() {
    var r = parseGantt('gantt\n    dateFormat YYYY-MM-DD\n');
    expect(r.dateFormat).toBe('YYYY-MM-DD');
  });

  test('parses axisFormat', function() {
    var r = parseGantt('gantt\n    axisFormat %m/%d\n');
    expect(r.axisFormat).toBe('%m/%d');
  });

  test('defaults dateFormat to YYYY-MM-DD', function() {
    var r = parseGantt('gantt\n');
    expect(r.dateFormat).toBe('YYYY-MM-DD');
  });
});

describe('parseGantt — sections', function() {
  test('parses section names with line numbers', function() {
    var text = 'gantt\n    title T\n\n    section Alpha\n    section Beta\n';
    var r = parseGantt(text);
    expect(r.sections.length).toBe(2);
    expect(r.sections[0].name).toBe('Alpha');
    expect(r.sections[0].line).toBe(4);
    expect(r.sections[1].name).toBe('Beta');
    expect(r.sections[1].line).toBe(5);
  });

  test('handles no sections', function() {
    var text = 'gantt\n    title T\n    Task A :a1, 2026-04-01, 2026-04-10\n';
    var r = parseGantt(text);
    expect(r.sections.length).toBe(0);
    expect(r.tasks.length).toBe(1);
    expect(r.tasks[0].sectionIndex).toBe(-1);
  });
});

describe('parseGantt — tasks', function() {
  test('parses id, startDate, endDate', function() {
    var text = 'gantt\n    section S\n    Task A :a1, 2026-04-01, 2026-04-15\n';
    var r = parseGantt(text);
    expect(r.tasks.length).toBe(1);
    var t = r.tasks[0];
    expect(t.id).toBe('a1');
    expect(t.label).toBe('Task A');
    expect(t.startDate).toBe('2026-04-01');
    expect(t.endDate).toBe('2026-04-15');
    expect(t.after).toBeNull();
    expect(t.status).toBeNull();
    expect(t.line).toBe(3);
    expect(t.sectionIndex).toBe(0);
  });

  test('parses status + id + dates', function() {
    var text = 'gantt\n    section S\n    Coding :crit, c1, 2026-05-10, 2026-06-10\n';
    var r = parseGantt(text);
    var t = r.tasks[0];
    expect(t.status).toBe('crit');
    expect(t.id).toBe('c1');
    expect(t.startDate).toBe('2026-05-10');
    expect(t.endDate).toBe('2026-06-10');
  });

  test('parses done status', function() {
    var text = 'gantt\n    section S\n    Done Task :done, d1, 2026-01-01, 2026-01-10\n';
    var r = parseGantt(text);
    expect(r.tasks[0].status).toBe('done');
  });

  test('parses active status', function() {
    var text = 'gantt\n    section S\n    Active Task :active, x1, 2026-01-01, 2026-01-10\n';
    var r = parseGantt(text);
    expect(r.tasks[0].status).toBe('active');
  });

  test('parses after dependency', function() {
    var text = 'gantt\n    section S\n    Task A :a1, 2026-04-01, 2026-04-10\n    Task B :b1, after a1, 2026-04-20\n';
    var r = parseGantt(text);
    var t = r.tasks[1];
    expect(t.id).toBe('b1');
    expect(t.after).toBe('a1');
    expect(t.startDate).toBeNull();
    expect(t.endDate).toBe('2026-04-20');
  });

  test('parses status + after', function() {
    var text = 'gantt\n    section S\n    Task A :a1, 2026-04-01, 2026-04-10\n    Task B :crit, b1, after a1, 2026-04-20\n';
    var r = parseGantt(text);
    var t = r.tasks[1];
    expect(t.status).toBe('crit');
    expect(t.after).toBe('a1');
  });

  test('parses duration format', function() {
    var text = 'gantt\n    section S\n    Task A :a1, 2026-04-01, 30d\n';
    var r = parseGantt(text);
    var t = r.tasks[0];
    expect(t.startDate).toBe('2026-04-01');
    expect(t.endDate).toBe('30d');
  });

  test('auto-generates ID for tasks without explicit ID', function() {
    var text = 'gantt\n    section S\n    Task A :2026-04-01, 2026-04-10\n';
    var r = parseGantt(text);
    var t = r.tasks[0];
    expect(t.id).toContain('__auto_');
    expect(t.startDate).toBe('2026-04-01');
    expect(t.endDate).toBe('2026-04-10');
  });

  test('assigns correct sectionIndex across multiple sections', function() {
    var text = [
      'gantt',
      '    section A',
      '    T1 :t1, 2026-01-01, 2026-01-10',
      '    section B',
      '    T2 :t2, 2026-02-01, 2026-02-10',
      '    T3 :t3, 2026-03-01, 2026-03-10',
    ].join('\n');
    var r = parseGantt(text);
    expect(r.tasks[0].sectionIndex).toBe(0);
    expect(r.tasks[1].sectionIndex).toBe(1);
    expect(r.tasks[2].sectionIndex).toBe(1);
  });

  test('line numbers are 1-based and accurate', function() {
    var text = [
      'gantt',
      '    title T',
      '',
      '    section S',
      '    A :a1, 2026-01-01, 2026-01-10',
      '    B :b1, 2026-02-01, 2026-02-10',
    ].join('\n');
    var r = parseGantt(text);
    expect(r.tasks[0].line).toBe(5);
    expect(r.tasks[1].line).toBe(6);
    expect(r.sections[0].line).toBe(4);
  });
});

describe('parseGantt — edge cases', function() {
  test('empty input returns empty structure', function() {
    var r = parseGantt('');
    expect(r.title).toBe('');
    expect(r.sections.length).toBe(0);
    expect(r.tasks.length).toBe(0);
  });

  test('gantt keyword only', function() {
    var r = parseGantt('gantt\n');
    expect(r.title).toBe('');
    expect(r.tasks.length).toBe(0);
  });

  test('ignores comment lines', function() {
    var text = 'gantt\n    %% this is a comment\n    title T\n';
    var r = parseGantt(text);
    expect(r.title).toBe('T');
  });

  test('handles Japanese labels', function() {
    var text = 'gantt\n    section 要件定義\n    要件分析 :a1, 2026-04-01, 2026-04-15\n';
    var r = parseGantt(text);
    expect(r.sections[0].name).toBe('要件定義');
    expect(r.tasks[0].label).toBe('要件分析');
  });
});
