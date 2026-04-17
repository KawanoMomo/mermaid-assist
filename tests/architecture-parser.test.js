'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils) || (global.window && global.window.MA && global.window.MA.parserUtils);
var arch = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.architectureBeta) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.architectureBeta);

describe('detectDiagramType — architecture-beta', function() {
  test('detects architecture-beta', function() { expect(parserUtils.detectDiagramType('architecture-beta\n')).toBe('architecture-beta'); });
});

describe('parseArchitecture', function() {
  test('parses group', function() {
    var r = arch.parseArchitecture('architecture-beta\n    group api(cloud)[API]\n');
    expect(r.groups.length).toBe(1);
    expect(r.groups[0].id).toBe('api');
    expect(r.groups[0].icon).toBe('cloud');
    expect(r.groups[0].label).toBe('API');
  });
  test('parses service in group', function() {
    var r = arch.parseArchitecture('architecture-beta\n    service db(database)[DB] in api\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].id).toBe('db');
    expect(r.elements[0].parentId).toBe('api');
  });
  test('parses edge', function() {
    var r = arch.parseArchitecture('architecture-beta\n    db:L -- R:server\n');
    expect(r.relations.length).toBe(1);
    expect(r.relations[0].from).toBe('db');
    expect(r.relations[0].fromSide).toBe('L');
    expect(r.relations[0].toSide).toBe('R');
    expect(r.relations[0].to).toBe('server');
  });
});
