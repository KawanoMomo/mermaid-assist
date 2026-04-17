'use strict';
window.MA = window.MA || {};
window.MA.parserUtils = (function() {
  // detectDiagramType: 第1キーワードから図形タイプを判定
  function detectDiagramType(text) {
    if (!text || !text.trim()) return null;
    var firstNonEmpty = '';
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (t && t.indexOf('%%') !== 0) { firstNonEmpty = t; break; }
    }
    if (firstNonEmpty.indexOf('gantt') === 0) return 'gantt';
    if (firstNonEmpty.indexOf('sequenceDiagram') === 0) return 'sequenceDiagram';
    if (firstNonEmpty.indexOf('flowchart') === 0 || firstNonEmpty.indexOf('graph') === 0) return 'flowchart';
    if (firstNonEmpty.indexOf('classDiagram') === 0) return 'classDiagram';
    if (firstNonEmpty.indexOf('stateDiagram') === 0) return 'stateDiagram';
    if (firstNonEmpty.indexOf('erDiagram') === 0) return 'erDiagram';
    if (firstNonEmpty.indexOf('requirementDiagram') === 0) return 'requirementDiagram';
    if (firstNonEmpty.indexOf('block-beta') === 0) return 'block-beta';
    if (firstNonEmpty.indexOf('timeline') === 0) return 'timeline';
    if (firstNonEmpty.indexOf('mindmap') === 0) return 'mindmap';
    if (firstNonEmpty.indexOf('gitGraph') === 0) return 'gitGraph';
    if (firstNonEmpty.indexOf('pie') === 0) return 'pie';
    if (firstNonEmpty.indexOf('journey') === 0) return 'journey';
    if (firstNonEmpty.indexOf('quadrantChart') === 0) return 'quadrantChart';
    return null;
  }

  // splitLinesWithMeta: 各行に行番号 + メタ情報を付与
  function splitLinesWithMeta(text) {
    if (!text) return [];
    var lines = text.split('\n');
    var result = [];
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var trimmed = raw.trim();
      result.push({
        lineNum: i + 1,
        raw: raw,
        trimmed: trimmed,
        isComment: trimmed.indexOf('%%') === 0,
        isBlank: trimmed === '',
      });
    }
    return result;
  }

  // generateAutoId: 仮IDを生成
  function generateAutoId(prefix, counter) {
    return '__' + (prefix || 'auto') + '_' + counter;
  }

  // isAutoId: 仮IDか判定
  function isAutoId(id) {
    return typeof id === 'string' && id.indexOf('__') === 0;
  }

  return {
    detectDiagramType: detectDiagramType,
    splitLinesWithMeta: splitLinesWithMeta,
    generateAutoId: generateAutoId,
    isAutoId: isAutoId,
  };
})();
