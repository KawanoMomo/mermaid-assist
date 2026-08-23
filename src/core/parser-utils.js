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
    if (firstNonEmpty.indexOf('xychart-beta') === 0) return 'xychart-beta';
    if (firstNonEmpty.indexOf('sankey-beta') === 0) return 'sankey-beta';
    // C4 の5つの variant はすべて c4 モジュールが扱う。ここで Context と Container
    // しか見ていなかったので、`C4Component` / `C4Dynamic` / `C4Deployment` は
    // **図種が判定できない**扱いになっていた。しかも Variant のプルダウンには
    // この3つが並んでおり、選べるのに認識されない状態だった。
    //
    // 何が起きるか: 判定に失敗するとプロパティパネルが**前の文書のまま固まる**。
    // プレビューは正しく描けていて、ステータスバーも左下も前の文書の内容を出すので、
    // 異常を示すものが画面に一つも無い。その状態で一覧の ✕ を押すと、**前の文書の
    // 行番号で今の文書の別の行が消える** (実測: 「System(sys, ...)」の ✕ を押すと
    // 4行目の `Deployment_Node(ecu, ...) {` が消え、孤児の `}` が残って描画不能)。
    // 帯は壊した場所でも原因でもない行を指す。
    //
    // 判定は parseC4 のヘッダ照合と同じ形で書く。片方だけ増えると同じことが起きる。
    if (/^C4(Context|Container|Component|Dynamic|Deployment)/.test(firstNonEmpty)) return 'C4Context';
    if (firstNonEmpty.indexOf('packet-beta') === 0) return 'packet-beta';
    if (firstNonEmpty.indexOf('architecture-beta') === 0) return 'architecture-beta';
    if (firstNonEmpty.indexOf('kanban') === 0) return 'kanban';
    if (firstNonEmpty.indexOf('radar-beta') === 0) return 'radar-beta';
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
