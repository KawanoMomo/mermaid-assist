'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils) || (global.window && global.window.MA && global.window.MA.parserUtils);
var pk = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.packetBeta) || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.packetBeta);

describe('detectDiagramType — packet-beta', function() {
  test('detects packet-beta', function() { expect(parserUtils.detectDiagramType('packet-beta\n')).toBe('packet-beta'); });
});

describe('parsePacket', function() {
  test('parses title', function() {
    var r = pk.parsePacket('packet-beta\ntitle "TCP"\n');
    expect(r.meta.title).toBe('TCP');
  });
  test('parses range field', function() {
    var r = pk.parsePacket('packet-beta\n0-15: "SrcPort"\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].startBit).toBe(0);
    expect(r.elements[0].endBit).toBe(15);
    expect(r.elements[0].label).toBe('SrcPort');
  });
  test('parses single bit', function() {
    var r = pk.parsePacket('packet-beta\n42: "Flag"\n');
    expect(r.elements[0].startBit).toBe(42);
    expect(r.elements[0].endBit).toBe(42);
  });
  test('parses multiple fields', function() {
    var r = pk.parsePacket('packet-beta\n0-7: "A"\n8-15: "B"\n16: "C"\n');
    expect(r.elements.length).toBe(3);
  });
});
