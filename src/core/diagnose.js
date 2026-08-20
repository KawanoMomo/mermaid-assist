(function() {
  'use strict';

  // 描画が失敗したときに、原因を利用者の言葉で名指しする。
  //
  // mermaid のエラーは字句解析器の言葉で書かれている。
  //   `Lexer error on line 3, column 25: unexpected character: ->[<-`
  // これを見せられても、自分の入力のどの文字が悪いのかは分からない。
  //
  // ここで扱うのは**こちらでは直せない mermaid 側の制限**だけ。
  // 直せるものは直す (mindmap の括弧、block の引用符、sequence の # は
  // 各モジュールで逃がしている)。直せないものを黙って壊れさせないのが役目。
  //
  // 推測はしない。規則に当てはまる入力が本文に実在するときだけ言う。
  // 当てはまらなければ空文字を返し、mermaid のエラーをそのまま見せる。

  // architecture-beta のラベルは [A-Za-z0-9_ ] しか通らない (v11.13 実測)。
  var ARCH_LABEL = /\[([^\]]*)\]/g;
  var ARCH_OK = /^[A-Za-z0-9_ ]*$/;

  function firstBadArchLabel(text) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!/^(service|group)\s/.test(t)) continue;
      ARCH_LABEL.lastIndex = 0;
      var m;
      while ((m = ARCH_LABEL.exec(t))) {
        if (!ARCH_OK.test(m[1])) return m[1];
      }
    }
    return null;
  }

  function firstBadSeqAlias(text) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].trim().match(/^(?:participant|actor)\s+\S+\s+as\s+(.+)$/);
      if (m && m[1].indexOf(';') >= 0) return m[1];
    }
    return null;
  }

  function diagnose(text, err) {
    if (!text) return '';
    var head = text.split('\n')[0].trim();

    if (/^architecture-beta/.test(head)) {
      var bad = firstBadArchLabel(text);
      if (bad !== null) {
        return 'architecture 図のラベルには半角英数字・下線・空白しか使えません' +
          '(mermaid 側の制限)。「' + bad + '」が該当します。';
      }
    }

    if (/^sequenceDiagram/.test(head)) {
      var alias = firstBadSeqAlias(text);
      if (alias !== null) {
        return 'sequence 図の別名に ; は使えません(mermaid 側の制限。引用符で' +
          '囲んでも通りません)。「' + alias + '」が該当します。';
      }
    }

    return '';
  }

  window.MA = window.MA || {};
  window.MA.diagnose = { diagnose: diagnose };
})();
