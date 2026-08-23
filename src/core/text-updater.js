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

  // stripNotesAbove: lineNum の説明であるコメントを本文から外し、
  // ずれた行番号と一緒に返す。コメントは対象行の**上**にあるので、
  // 先に外して行番号を繰り上げれば、そのあとどんな削除の実装に委ねても成立する。
  // id で全文を書き直す削除 (flowchart / class / state / sequence) は
  // 行番号を見ないため、この形でしか届かない。
  function stripNotesAbove(text, lineNum) {
    var lines = text.split('\n');
    if (lineNum < 1 || lineNum > lines.length) return { text: text, lineNum: lineNum };
    var st = noteBlockStart(lines, lineNum);
    if (st >= lineNum) return { text: text, lineNum: lineNum };
    var n = lineNum - st;
    lines.splice(st - 1, n);
    return { text: lines.join('\n'), lineNum: lineNum - n };
  }

  function deleteLine(text, lineNum) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    // UI-083: この行の説明であるコメントも一緒に消す。
    // 残すと**説明対象が消えたコメント**が本文に残り、その下に来た別の
    // 要素の説明として読まれる。実測では削除した4図種すべてで付き先が狂った。
    // 空行で区切られた見出しは対象外 (noteBlockStart の判定に従う)。
    var st = noteBlockStart(lines, lineNum);
    lines.splice(st - 1, lineNum - st + 1);
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

  // swapLinesWithNotes: 2つの要素行を、**それぞれの説明 (直上のコメント) ごと**入れ替える。
  //
  // UI-083: 素の swapLines は行の中身だけを入れ替えるので、説明は元の位置に
  // 残り、そこに来た別の要素の説明として読まれる。実測 (sequence):
  // `印B` は B と一緒に動かず、動いてきた A の説明になった。
  //
  // 範囲が重なるとき (隣り合っていて片方の説明がもう片方に食い込むとき) は
  // 素の入れ替えに落とす。壊すよりは、今までどおりのほうがまし。
  function swapLinesWithNotes(text, lineA, lineB) {
    var lines = text.split('\n');
    if (lineA < 1 || lineB < 1 || lineA > lines.length || lineB > lines.length ||
        lineA === lineB) return swapLines(text, lineA, lineB);
    var a = { s: noteBlockStart(lines, lineA), e: lineA };
    var b = { s: noteBlockStart(lines, lineB), e: lineB };
    var first = (a.s < b.s) ? a : b;
    var second = (a.s < b.s) ? b : a;
    if (first.e >= second.s) return swapLines(text, lineA, lineB);
    var pre = lines.slice(0, first.s - 1);
    var fb = lines.slice(first.s - 1, first.e);
    var mid = lines.slice(first.e, second.s - 1);
    var sb = lines.slice(second.s - 1, second.e);
    var post = lines.slice(second.e);
    return pre.concat(sb, mid, fb, post).join('\n');
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
  // noteBlockStart: lineNum の直上に連なる `%%` コメントの先頭行 (1-based) を返す。
  //
  // UI-083: 要素を動かすとき、その説明であるコメントが付いて行かないと、
  // **説明は元の位置に取り残され、そこに来た別の要素の説明として読まれる**。
  // 実測 (flowchart): `A["開始"]` の下の `%% 印B` は B を上へ動かしたあと
  // A の説明になり、B には説明が無くなった。**コメントの件数は変わらない**ため、
  // 件数を見る検査はすべて通る。
  //
  // 空行が挟まっていれば付けない。`%% === 入力系 ===` のような**見出し**は
  // 要素と一緒に動いてはいけないからで、空行はその区切りとして使われる。
  function noteBlockStart(lines, lineNum) {
    var i = lineNum - 1;          // 0-based の要素行
    var st = lineNum;
    while (i - 1 >= 0) {
      var prev = lines[i - 1].trim();
      if (prev.indexOf('%%') !== 0) break;   // 空行も非コメント行もここで止まる
      st = i;                                  // lines[i-1] の 1-based 行番号
      i--;
    }
    return st;
  }

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
      // 次の要素に付いたコメントは、この要素の範囲から外す。
      // 外さないと範囲が重なり、moveElementLine が「重なるなら触らない」で
      // 何もしなくなる (動かなくなるのは、狂うのと同じくらい困る)。
      if (i + 1 < starts.length) {
        var nextNote = noteBlockStart(lines, next);
        if (nextNote < next) en = nextNote - 1;
      }
      // 範囲の末尾の空行は入れ替えに含めない (差分が増えるだけ)
      while (en > st && lines[en - 1].trim() === '') en--;
      // start は**コメントを含めた先頭**。key は要素の行のまま (呼ぶ側は要素の行で引く)
      blocks[st] = { start: noteBlockStart(lines, st), end: en };
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
    stripNotesAbove: stripNotesAbove,
    matchEol: matchEol,
    swapLines: swapLines,
    swapLinesWithNotes: swapLinesWithNotes,
    moveElementLine: moveElementLine,
    appendToFile: appendToFile,
  };
})();
