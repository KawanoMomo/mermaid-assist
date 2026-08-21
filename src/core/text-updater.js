'use strict';
window.MA = window.MA || {};
window.MA.textUpdater = (function() {
  // replaceLine: 1-based lineNum の行を newContent に置き換え
  function replaceLine(text, lineNum, newContent) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    lines[idx] = newContent;
    return lines.join('\n');
  }

  // insertAfter: 1-based lineNum の行の直後に newContent を挿入
  function insertAfter(text, lineNum, newContent) {
    var lines = text.split('\n');
    var idx = lineNum; // 0-based の挿入位置 = lineNum (lineNum-1 + 1)
    lines.splice(idx, 0, newContent);
    return lines.join('\n');
  }

  // insertBefore: 1-based lineNum の行の直前に newContent を挿入
  function insertBefore(text, lineNum, newContent) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    lines.splice(idx, 0, newContent);
    return lines.join('\n');
  }

  // deleteLine: 1-based lineNum の行を削除
  // matchEol: 元の文書の改行コードに結果を合わせる。
  //
  // どのモジュールも split → splice → join で行を入れるので、CRLF の文書に
  // 挿入した行だけが復帰文字を持たない。mermaid は通るが、ファイルに書き出すと
  // diff にノイズが乗る (混在した改行コードはレビューで見えないだけにたちが悪い)。
  function matchEol(original, result) {
    if (typeof original !== 'string' || typeof result !== 'string') return result;
    var CR = String.fromCharCode(13);
    var LF = String.fromCharCode(10);
    if (original.indexOf(CR + LF) < 0) return result;
    return result.split(CR + LF).join(LF).split(LF).join(CR + LF);
  }

  function deleteLine(text, lineNum) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    lines.splice(idx, 1);
    return lines.join('\n');
  }

  // swapLines: 2行の内容を入れ替え
  function swapLines(text, lineA, lineB) {
    var lines = text.split('\n');
    var a = lineA - 1, b = lineB - 1;
    if (a < 0 || a >= lines.length || b < 0 || b >= lines.length) return text;
    var tmp = lines[a];
    lines[a] = lines[b];
    lines[b] = tmp;
    return lines.join('\n');
  }

  // moveElementLine: 要素を、**同じ種類の隣の要素と入れ替える**。
  //
  // 契約の moveUp / moveDown は素の swapLines を呼んでいた。行番号が1より
  // 大きいことしか見ていないので、先頭の要素を上へ動かすと**図の宣言行と
  // 入れ替わって図が消える**。実測 (mermaid v11.13):
  //
  //   flowchart TD                     A[Start] --> B{Decision}
  //       A[Start] --> B{Decision}  →  flowchart TD
  //   → No diagram type detected
  //
  // 同じことが erDiagram / requirementDiagram でも起きる。
  // kanban は札がセクション見出しを飛び越え、mindmap は根が2つになる。
  //
  // パネルの経路 (flowchart の _moveNodeStep) は入れ替え先が動かせる行かを
  // 見ていたので壊れない。**UI だけ動いて契約が壊れている形の15例目。**
  //
  // 1行1要素とは限らない。requirement / class / er はブロックを持つので、
  // 行だけ入れ替えると属性が別の要素にくっつく。**要素が占める範囲ごと**
  // 入れ替える。範囲の終わりは「次の要素が始まる直前」で決める
  // (parse が返すのは開始行だけなので、それ以外に手掛かりがない)。
  function elementBlocks(text, elements) {
    var lines = text.split('\n');
    var starts = [];
    elements.forEach(function(e) {
      if (typeof e.line === 'number' && e.line >= 1 && starts.indexOf(e.line) < 0) starts.push(e.line);
    });
    starts.sort(function(a, b) { return a - b; });
    // 最後の要素の範囲は、末尾の空行を除いたところまで
    var lastUsed = lines.length;
    while (lastUsed > 0 && lines[lastUsed - 1].trim() === '') lastUsed--;
    var blocks = {};
    starts.forEach(function(st, i) {
      var next = (i + 1 < starts.length) ? starts[i + 1] : (lastUsed + 1);
      var en = next - 1;
      // 範囲の末尾の空行は入れ替えに含めない (差分が増えるだけ)
      while (en > st && lines[en - 1].trim() === '') en--;
      blocks[st] = { start: st, end: en };
    });
    return blocks;
  }

  function moveElementLine(text, lineNum, direction, elements) {
    if (!elements || !elements.length) return text;
    var lines = text.split('\n');
    if (lineNum < 1 || lineNum > lines.length) return text;

    var here = null;
    for (var i = 0; i < elements.length; i++) {
      if (elements[i].line === lineNum) { here = elements[i]; break; }
    }
    if (!here) return text;

    // 同じ種類の要素の開始行 (昇順)
    var kindLines = [];
    elements.forEach(function(e) {
      if (e.kind === here.kind && typeof e.line === 'number' && kindLines.indexOf(e.line) < 0) {
        kindLines.push(e.line);
      }
    });
    kindLines.sort(function(a, b) { return a - b; });
    var at = kindLines.indexOf(lineNum);
    var other = kindLines[at + direction];
    if (at < 0 || other === undefined) return text;   // 端なので動かせない

    var blocks = elementBlocks(text, elements);
    var A = blocks[lineNum], B = blocks[other];
    if (!A || !B) return text;
    var first = (A.start < B.start) ? A : B;
    var second = (A.start < B.start) ? B : A;
    if (first.end >= second.start) return text;       // 範囲が重なるなら触らない

    var pre = lines.slice(0, first.start - 1);
    var fb = lines.slice(first.start - 1, first.end);
    var mid = lines.slice(first.end, second.start - 1);
    var sb = lines.slice(second.start - 1, second.end);
    var post = lines.slice(second.end);
    return pre.concat(sb, mid, fb, post).join('\n');
  }

  // appendToFile: ファイル末尾に追加（末尾の空行をスキップして直前に挿入）
  function appendToFile(text, newContent) {
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newContent);
    return lines.join('\n');
  }

  return {
    replaceLine: replaceLine,
    insertAfter: insertAfter,
    insertBefore: insertBefore,
    deleteLine: deleteLine,
    matchEol: matchEol,
    swapLines: swapLines,
    moveElementLine: moveElementLine,
    appendToFile: appendToFile,
  };
})();
