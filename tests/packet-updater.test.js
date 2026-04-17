'use strict';
var pk = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.packetBeta) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.packetBeta);

describe('setTitle', function() {
  test('inserts title', function() { expect(pk.setTitle('packet-beta\n', 'X')).toContain('title "X"'); });
});
describe('addField', function() {
  test('adds range field', function() { expect(pk.addField('packet-beta\n', 0, 15, 'SrcPort')).toContain('0-15: "SrcPort"'); });
  test('adds single bit', function() { expect(pk.addField('packet-beta\n', 42, 42, 'Flag')).toContain('42: "Flag"'); });
});
describe('updateField', function() {
  test('updates label', function() {
    var t = 'packet-beta\n0-15: "Old"\n';
    var p = pk.parsePacket(t);
    var out = pk.updateField(t, p.elements[0].line, 'label', 'New');
    expect(out).toContain('0-15: "New"');
  });
  test('updates endBit', function() {
    var t = 'packet-beta\n0-15: "X"\n';
    var p = pk.parsePacket(t);
    var out = pk.updateField(t, p.elements[0].line, 'endBit', '31');
    expect(out).toContain('0-31: "X"');
  });
});
