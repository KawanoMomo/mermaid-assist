'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils)
  || (global.window && global.window.MA && global.window.MA.parserUtils);

describe('detectDiagramType — requirementDiagram', function() {
  test('detects requirementDiagram keyword', function() {
    expect(parserUtils.detectDiagramType('requirementDiagram\n')).toBe('requirementDiagram');
  });
});
