'use strict';
var pie = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.pie)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.pie);

describe('addSlice', function() {
  test('adds slice line', function() {
    var out = pie.addSlice('pie title X\n', 'Dogs', '10');
    expect(out).toContain('"Dogs" : 10');
  });
});

describe('updateSlice', function() {
  test('updates label', function() {
    var t = 'pie\n    "Old" : 5\n';
    var parsed = pie.parsePie(t);
    var out = pie.updateSlice(t, parsed.elements[0].line, 'label', 'New');
    expect(out).toContain('"New" : 5');
  });
  test('updates value', function() {
    var t = 'pie\n    "X" : 5\n';
    var parsed = pie.parsePie(t);
    var out = pie.updateSlice(t, parsed.elements[0].line, 'value', '99');
    expect(out).toContain('"X" : 99');
  });
});

describe('setTitle', function() {
  test('sets new title', function() {
    var out = pie.setTitle('pie\n    "A" : 1\n', 'My Chart');
    expect(out).toContain('pie title My Chart');
  });
  test('replaces existing title', function() {
    var out = pie.setTitle('pie title Old\n', 'New');
    expect(out).toContain('pie title New');
    expect(out).not.toContain('Old');
  });
});

describe('setShowData', function() {
  test('enables showData', function() {
    var out = pie.setShowData('pie title X\n', true);
    expect(out).toContain('pie showData title X');
  });
  test('disables showData', function() {
    var out = pie.setShowData('pie showData title X\n', false);
    expect(out).toContain('pie title X');
    expect(out).not.toContain('showData');
  });
});
