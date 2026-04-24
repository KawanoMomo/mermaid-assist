'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils)
  || (global.window && global.window.MA && global.window.MA.parserUtils);
var jr = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.journey)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.journey);

describe('detectDiagramType — journey', function() {
  test('detects journey', function() { expect(parserUtils.detectDiagramType('journey\n')).toBe('journey'); });
});

describe('parseJourney', function() {
  test('parses title', function() {
    var r = jr.parseJourney('journey\n    title My Day\n');
    expect(r.meta.title).toBe('My Day');
  });
  test('parses section', function() {
    var r = jr.parseJourney('journey\n    section Morning\n');
    expect(r.elements.filter(function(e){return e.kind==='section';}).length).toBe(1);
  });
  test('parses task with actors', function() {
    var r = jr.parseJourney('journey\n    section S\n      Task1: 3: Me, Pet\n');
    var tasks = r.elements.filter(function(e){return e.kind==='task';});
    expect(tasks.length).toBe(1);
    expect(tasks[0].text).toBe('Task1');
    expect(tasks[0].score).toBe(3);
    expect(tasks[0].actors.length).toBe(2);
    expect(tasks[0].parentId).toBe('S');
  });
  test('parses negative score', function() {
    var r = jr.parseJourney('journey\n    section S\n      T: -2: Me\n');
    expect(r.elements[1].score).toBe(-2);
  });
});
