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

  // 引用符で囲えば通る。
  //
  // 以前は「architecture のラベルには半角英数字しか使えない (引用符で囲んでも
  // 通らない)」と告げていた。**実測すると引用符で通る**
  // (`service a(server)["設計"]` → 「設計」を描画、v11.13)。
  // 直せない制限として扱っていたのが誤りで、モジュール側で引用するようにした。
  //
  // ここに残すのは「引用符が付いていないのに英数字以外が入っている」場合だけ。
  // 利用者が本文を直接書いたときに起きる。
  function firstBadArchLabel(text) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!/^(service|group)\s/.test(t)) continue;
      ARCH_LABEL.lastIndex = 0;
      var m;
      while ((m = ARCH_LABEL.exec(t))) {
        if (/^".*"$/.test(m[1])) continue;   // 引用済みなら通る
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

  // gitGraph のブランチ名・タグ名は半角しか通らない (v11.13 実測)。
  // 日本語のブランチ名は Lexer error になり、引用符で囲んでも変わらない。
  function firstBadGitName(text) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].trim().match(/^(?:branch|checkout|merge)\s+(\S+)/);
      if (m && /[^\x00-\x7F]/.test(m[1])) return m[1];
    }
    return null;
  }

  // requirement 図の要求名・要素名は、**引用符で囲えば日本語が使える**。
  //
  // 以前は「識別子なので半角しか通らない。表示名は text: に書く」と記録し、
  // そう告げていた。実測すると `requirement "受信要求" { … }` は通り、
  // 「<<Requirement>>受信要求」を描く (v11.13)。
  // architecture (A83) と同じで、直せる問題を制限として扱っていた。
  //
  // ここに残すのは「引用符が付いていないのに全角が入っている」場合だけ。
  function firstBadReqName(text) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].trim().match(/^(?:requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint|element)\s+([^\s{]+)/);
      if (!m) continue;
      if (/^".*"$/.test(m[1])) continue;   // 引用済みなら通る
      if (/[^\x00-\x7F]/.test(m[1])) return m[1];
    }
    return null;
  }

  // ラベルの中の " をエスケープできない図種がある。
  //
  // er / state / class は &quot; がそのまま " として描かれるので逃がせる。
  // pie / quadrant / packet / radar / requirement は &quot; が文字どおり
  // 「&quot;」と描かれてしまうので、逃がしても直らない (v11.13 実測)。
  // つまりこちらでは直せない。せめて原因を告げる。
  // architecture も同じ (引用符では囲えるが、中の " は &quot; にしても
  // そのまま文字として出る。v11.13 実測)。
  var NO_QUOTE_ESCAPE = /^(pie|quadrantChart|packet-beta|packet|radar-beta|requirementDiagram|architecture-beta)/;

  // 「引用符の数」で見てはいけない。1行に複数のラベルを置く図種があり
  // (radar の `axis a["A"], b["B"]`)、素直に数えると正しい行を誤検知する。
  //
  // 見るのは「閉じ引用符の直後に文字が続いているか」。
  //   "引"用"付き"  → `"引"` の直後が `用` → ラベルの途中で引用符が閉じている
  //   a["A"], b["B"] → `"A"` の直後が `]` → 正しい区切り
  var QUOTED = /"[^"]*"/g;
  var SEPARATOR_AFTER = /^[\s,:\]\)\}]|^$/;

  // 「逃がしたのに出ない」印。
  //
  // er / state / class では `&quot;` がそのまま `"` として描かれるので逃がせるが、
  // pie / quadrant / packet / radar / requirement / architecture は
  // **`&quot;` を文字どおり描いてしまう** (v11.13 実測)。
  // 本文に `&quot;` が居る = こちらが逃がしたことの印なので、
  // それを見つけたら「この図種では " を表せない」と告げる。
  function firstEscapedQuote(text) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('&quot;') >= 0) return lines[i].trim().slice(0, 40);
    }
    return null;
  }

  function firstOverQuotedLine(text) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      QUOTED.lastIndex = 0;
      var m;
      while ((m = QUOTED.exec(t))) {
        var after = t.slice(m.index + m[0].length);
        if (!SEPARATOR_AFTER.test(after)) return t.slice(0, 40);
      }
    }
    return null;
  }

  // kanban の列名は行そのものが名前になる。括弧・角括弧・波括弧はカードの
  // 記法 (`id[本文]` / `@{...}`) と衝突するので、名前に入れると落ちるか消える。
  function firstBadKanbanColumn(text) {
    var lines = text.split('\n');
    for (var i = 1; i < lines.length; i++) {
      var raw = lines[i];
      if (!raw.trim()) continue;
      var indent = raw.match(/^(\s*)/)[1].length;
      // 列は最初の段。カード行はそれより深い。
      if (indent === 0 || indent > 4) continue;
      if (/[\[\](){}]/.test(raw.trim())) return raw.trim().slice(0, 40);
    }
    return null;
  }

  // journey / timeline の section 名は行末までが名前で、引用符も効かない。
  // : や ; は文法上の区切りなので名前に入れられない。
  function firstBadSectionName(text) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].trim().match(/^section\s+(.+)$/);
      if (m && /[:;#]/.test(m[1])) return m[1].slice(0, 40);
    }
    return null;
  }

  // mermaid の上限に当たった場合。本文からは判定できないので例外の文言で見る。
  //
  // 上限は設定で引き上げてあるが、引き上げた値をさらに超えることはある。
  // そのとき帯に出ていたのは「構文エラー」という定型文で、本文に構文誤りは
  // 1つも無い。原因を告げないより悪く、**間違った方向に調査させる**。
  function limitCause(err) {
    var msg = err && err.message ? String(err.message) : String(err || '');
    var edge = msg.match(/Edge limit exceeded\.\s*(\d+)\s*edges found, but the limit is (\d+)/i);
    if (edge) {
      return '線が多すぎて mermaid が図を描けません(' + edge[1] + ' 本 / 上限 ' +
        edge[2] + ' 本)。図を分割してください。';
    }
    if (/Maximum text size in diagram exceeded/i.test(msg)) {
      return '本文が長すぎて mermaid が図を描けません。図を分割してください。';
    }
    // 3000要素あたりで mermaid の配置計算が再帰の上限に当たる (v11.13 実測)。
    // 設定では回避できない。「構文エラー」と出ると本文を疑うことになるので、
    // 量の問題であることだけは伝える。
    if (/Maximum call stack size exceeded/i.test(msg)) {
      return '要素が多すぎて mermaid の配置計算が破綻しました' +
        '(こちらの設定では回避できません)。図を分割してください。';
    }
    return '';
  }

  function diagnose(text, err) {
    if (!text) return '';
    var head = text.split('\n')[0].trim();

    var limit = limitCause(err);
    if (limit) return limit;

    if (NO_QUOTE_ESCAPE.test(head)) {
      var eq = firstEscapedQuote(text);
      if (eq !== null) {
        return 'この図種のラベルには " を含められません' +
          '(mermaid 側の制限。&quot; と書いてもそのまま文字として出ます)。' +
          '「' + eq + '」が該当します。';
      }
      var q = firstOverQuotedLine(text);
      if (q !== null) {
        return 'この図種のラベルには " を含められません' +
          '(mermaid 側の制限。&quot; と書いてもそのまま文字として出ます)。' +
          '「' + q + '」が該当します。';
      }
    }

    if (/^kanban/.test(head)) {
      var kc = firstBadKanbanColumn(text);
      if (kc !== null) {
        return 'kanban の列名には ( ) [ ] { } が使えません' +
          '(mermaid 側の制限。カードの記法と衝突します)。「' + kc + '」が該当します。';
      }
    }

    if (/^(journey|timeline)/.test(head)) {
      var sn = firstBadSectionName(text);
      if (sn !== null) {
        return 'section 名には : ; # が使えません' +
          '(mermaid 側の制限。引用符で囲んでも通りません)。「' + sn + '」が該当します。';
      }
    }

    if (/^gitGraph/.test(head)) {
      var gname = firstBadGitName(text);
      if (gname !== null) {
        return 'gitGraph のブランチ名には全角文字が使えません' +
          '(mermaid 側の制限。引用符で囲んでも通りません)。「' + gname + '」が該当します。';
      }
    }

    if (/^requirementDiagram/.test(head)) {
      var rname = firstBadReqName(text);
      if (rname !== null) {
        return 'requirement 図の要求名・要素名に全角文字を入れるときは ' +
          '引用符で囲ってください (例: requirement "受信要求")。「' + rname + '」が該当します。';
      }
    }

    if (/^architecture-beta/.test(head)) {
      var bad = firstBadArchLabel(text);
      if (bad !== null) {
        return 'architecture 図のラベルに半角英数字以外を入れるときは ' +
          '引用符で囲ってください (例: ["設計"])。「' + bad + '」が該当します。';
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

  // 描き上がりが本物か。
  //
  // mermaid はテキストが上限 (既定 50,000 文字) を超えると、**例外を投げずに**
  // 「Maximum text size in diagram exceeded」とだけ書かれた小さな図を返す。
  // しかも種別は元の図種ではなく flowchart-v2 になる。アプリはそれを本物として
  // 扱い、ステータスに OK を出し、Export はその画像をそのまま書き出していた。
  // 2900タスクの図を保存したつもりで、空同然の画像を無警告で受け取ることになる。
  //
  // 上限自体は設定で引き上げるが、引き上げた値をさらに超える場合もあるので、
  // 描き上がりの側でも見分けられるようにしておく。
  //
  // 利用者が同じ文字列をラベルに書いている場合を誤判定しないよう、
  // 「その文字しか無い」ことまで確かめる。
  var OVERSIZE_TEXT = 'Maximum text size in diagram exceeded';

  function isOversizePlaceholder(svgMarkup) {
    if (!svgMarkup || typeof svgMarkup !== 'string') return false;
    if (svgMarkup.indexOf(OVERSIZE_TEXT) < 0) return false;
    // 描画要素が実質そのテキストだけであること。
    var texts = svgMarkup.match(/<text[\s\S]*?<\/text>/g) || [];
    if (texts.length > 1) return false;
    var shapes = (svgMarkup.match(/<(path|rect|polygon|line|circle|ellipse)\b/g) || []).length;
    return shapes === 0;
  }

  window.MA = window.MA || {};
  window.MA.diagnose = {
    diagnose: diagnose,
    isOversizePlaceholder: isOversizePlaceholder,
    OVERSIZE_TEXT: OVERSIZE_TEXT,
  };
})();
