'use strict';
var jsdom = require('jsdom');
var dom = new jsdom.JSDOM('<!DOCTYPE html><html><body><div id="props-content"></div></body></html>');
// Preserve the existing sandbox window.MA namespace (populated by run-tests.js
// when it eval'd every src/ file) so subsequent test files still see their
// modules after we swap in jsdom's window.
var _prevMA = global.window && global.window.MA;
global.window = dom.window;
global.document = dom.window.document;
if (_prevMA) global.window.MA = _prevMA;
// html-utils is required by properties.js escHtml
require('../src/core/html-utils.js');
require('../src/ui/properties.js');
var P = window.MA.properties;

describe('actionBarHtml', function() {
  test('emits all 5 buttons by default', function() {
    var html = P.actionBarHtml('sel-x');
    expect(html).toContain('id="sel-x-insert-before"');
    expect(html).toContain('id="sel-x-insert-after"');
    expect(html).toContain('id="sel-x-up"');
    expect(html).toContain('id="sel-x-down"');
    expect(html).toContain('id="sel-x-delete"');
    expect(html).toContain('id="sel-x-extra"');
  });

  test('omits up/down when move=false', function() {
    var html = P.actionBarHtml('sel-x', { move: false });
    expect(html).not.toContain('id="sel-x-up"');
    expect(html).not.toContain('id="sel-x-down"');
    expect(html).toContain('id="sel-x-delete"');  // still there
  });

  test('emits only up when move={up:true, down:false}', function() {
    var html = P.actionBarHtml('sel-x', { move: { up: true, down: false } });
    expect(html).toContain('id="sel-x-up"');
    expect(html).not.toContain('id="sel-x-down"');
  });

  test('uses label override', function() {
    var html = P.actionBarHtml('sel-x', { labels: { delete: 'ノード削除' } });
    expect(html).toContain('>ノード削除<');
    expect(html).not.toContain('>削除<');
  });

  test('always emits the -extra placeholder', function() {
    var html = P.actionBarHtml('sel-x', {
      insertBefore: false, insertAfter: false, move: false, delete: false,
    });
    expect(html).toContain('id="sel-x-extra"');
    expect(html).not.toContain('id="sel-x-delete"');
  });
});

describe('bindActionBar', function() {
  beforeEach(function() {
    document.body.innerHTML = '<div id="props-content">' + P.actionBarHtml('sel-x') + '</div>';
  });

  test('fires handler on up click', function() {
    var called = 0;
    P.bindActionBar('sel-x', { up: function() { called++; } });
    document.getElementById('sel-x-up').click();
    expect(called).toBe(1);
  });

  test('does not fire handler when key is omitted', function() {
    var called = 0;
    P.bindActionBar('sel-x', { up: function() { called++; } });
    document.getElementById('sel-x-down').click();
    expect(called).toBe(0);
  });

  test('ignores unknown keys silently', function() {
    expect(function() {
      P.bindActionBar('sel-x', { somethingElse: function() {} });
    }).not.toThrow();
  });
});
