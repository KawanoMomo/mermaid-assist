'use strict';
var arch = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.architectureBeta) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.architectureBeta);

describe('addGroup', function() {
  test('adds group', function() { expect(arch.addGroup('architecture-beta\n', 'api', 'cloud', 'API')).toContain('group api(cloud)[API]'); });
  test('adds nested group', function() { expect(arch.addGroup('architecture-beta\n', 'sub', 'cloud', 'Sub', 'api')).toContain('in api'); });
});
describe('addService', function() {
  test('adds service', function() { expect(arch.addService('architecture-beta\n', 'db', 'database', 'DB', 'api')).toContain('service db(database)[DB] in api'); });
});
describe('addEdge', function() {
  test('adds edge', function() { expect(arch.addEdge('architecture-beta\n', 'a', 'R', 'L', 'b')).toContain('a:R -- L:b'); });
});
describe('updateElement', function() {
  test('updates label', function() {
    var t = 'architecture-beta\n    service db(database)[Old]\n';
    var p = arch.parseArchitecture(t);
    var out = arch.updateElement(t, p.elements[0].line, 'label', 'New');
    expect(out).toContain('[New]');
  });
  test('updates icon', function() {
    var t = 'architecture-beta\n    service db(database)[DB]\n';
    var p = arch.parseArchitecture(t);
    var out = arch.updateElement(t, p.elements[0].line, 'icon', 'disk');
    expect(out).toContain('(disk)');
  });
});
describe('updateEdge', function() {
  test('updates fromSide', function() {
    var t = 'architecture-beta\n    a:R -- L:b\n';
    var p = arch.parseArchitecture(t);
    var out = arch.updateEdge(t, p.relations[0].line, 'fromSide', 'T');
    expect(out).toContain('a:T -- L:b');
  });
});
