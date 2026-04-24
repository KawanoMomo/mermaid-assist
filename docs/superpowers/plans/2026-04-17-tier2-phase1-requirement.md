# Tier2 Phase 1: Requirement Diagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mermaid Requirement Diagram を Tier1 同等の操作粒度で対応する DiagramModule v2 を `src/modules/requirement.js` として実装し、v1.3.0 をリリースする。

**Architecture:** ER モジュール (`src/modules/er.js`) を骨格として流用。`window.MA.properties` の14ヘルパー全面利用、縦並びラベル付き追加フォーム (ECN-013/ADR-015 準拠)、`var P = window.MA.properties` alias 統一 (ECN-013 教訓)。Mermaid v11 の `requirementDiagram` は確認済み。

**Tech Stack:** JavaScript (ES5互換)、mermaid.js v11、Playwright、ビルドステップなし。

**Branch:** `tier2/phase1-requirement` を `master` から切って作業。

---

## ファイル構成

- **Create:**
  - `src/modules/requirement.js` — DiagramModule v2 実装
  - `tests/requirement-parser.test.js` — パーサーユニットテスト
  - `tests/requirement-updater.test.js` — アップデーターユニットテスト
  - `tests/e2e/requirement-basic.spec.js` — E2E テスト
- **Modify:**
  - `src/core/parser-utils.js:5-21` — `detectDiagramType` に `requirementDiagram` 判定追加
  - `mermaid-assist.html:391-396` — `<select id="diagram-type">` に `<option value="requirementDiagram">Requirement</option>` 追加
  - `mermaid-assist.html:465` — `<script src="src/modules/requirement.js"></script>` 追加
  - `tests/run-tests.js:7-23` — `sourceFiles` 配列に `'src/modules/requirement.js'` 追加
- **Eval Output:**
  - `.eval/v1.3.0/visual-sweep-v1.3.0/` — visual sweep スクショ配置
  - `.eval/v1.3.0/usecase-iec61508/` — IEC 61508 シナリオ検証
- **Doc:**
  - `docs/ecn/ECN-014_tier2-phase1-requirement.md` — Phase 1 リリースノート

---

## Task 1: ブランチ作成 + Mermaid v11 requirementDiagram 動作確認

**Files:**
- 確認: `lib/mermaid.min.js` (既存)
- 一時作成: `tmp_req_check.html` (確認後削除)

- [ ] **Step 1: ブランチ切替**

```bash
git checkout master
git pull origin master
git checkout -b tier2/phase1-requirement
```

- [ ] **Step 2: 動作確認用一時HTML作成**

`tmp_req_check.html` を作成:

```html
<!DOCTYPE html>
<html><head><script src="lib/mermaid.min.js"></script></head>
<body>
<pre class="mermaid">
requirementDiagram

requirement test_req {
    id: REQ-001
    text: 過電流時はモータを停止する
    risk: high
    verifymethod: test
}

functionalRequirement test_req2 {
    id: REQ-002
    text: 過電流検出は10ms以内
    risk: high
    verifymethod: test
}

interfaceRequirement test_req3 { id: REQ-003 text: I/F text: risk: medium verifymethod: inspection }
performanceRequirement test_req4 { id: REQ-004 text: perf risk: medium verifymethod: analysis }
physicalRequirement test_req5 { id: REQ-005 text: phys risk: low verifymethod: demonstration }
designConstraint test_req6 { id: REQ-006 text: dc risk: low verifymethod: analysis }

element ecu_firmware {
    type: code module
    docref: src/ecu.c
}

ecu_firmware - satisfies -> test_req
test_req - contains -> test_req2
test_req - copies -> test_req3
test_req - derives -> test_req4
test_req - refines -> test_req5
test_req - traces -> test_req6
ecu_firmware - verifies -> test_req2
</pre>
<script>mermaid.initialize({ startOnLoad: true });</script>
</body></html>
```

- [ ] **Step 3: ブラウザで開いて描画確認**

Run:
```bash
start tmp_req_check.html
```

Expected: 6 reqType すべて + 7 reltype すべてが構文エラーなく描画される。F12 console error 0。

- [ ] **Step 4: 確認結果を記録、tmp ファイル削除**

確認 OK なら:
```bash
rm tmp_req_check.html
```

確認 NG (描画失敗・構文エラー) なら **作業中断・ECN 記録・ユーザー判断仰ぎ** (Mermaid バージョン上げ等の代替検討)。

- [ ] **Step 5: ブランチ作成 commit**

```bash
git add -A
git commit -m "chore: branch off for tier2 phase1 requirement diagram" --allow-empty
```

---

## Task 2: detectDiagramType に requirementDiagram 追加

**Files:**
- Modify: `src/core/parser-utils.js:5-21`

- [ ] **Step 1: 既存 detectDiagramType を確認**

`src/core/parser-utils.js` 4-21 行を読み、erDiagram 判定の直後に追加可能なことを確認。

- [ ] **Step 2: requirementDiagram 判定追加**

`src/core/parser-utils.js:19` の `if (firstNonEmpty.indexOf('erDiagram') === 0) return 'erDiagram';` の直後に1行追加:

```javascript
    if (firstNonEmpty.indexOf('requirementDiagram') === 0) return 'requirementDiagram';
```

- [ ] **Step 3: ユニットテストで検証**

新規 `tests/requirement-parser.test.js` の冒頭に detection テストを書く (Task 3 で本格テスト追加するための骨組み):

```javascript
'use strict';
var parserUtils = (typeof window !== 'undefined' && window.MA && window.MA.parserUtils)
  || (global.window && global.window.MA && global.window.MA.parserUtils);

describe('detectDiagramType — requirementDiagram', function() {
  test('detects requirementDiagram keyword', function() {
    expect(parserUtils.detectDiagramType('requirementDiagram\n')).toBe('requirementDiagram');
  });
});
```

- [ ] **Step 4: Run test to verify**

Run: `node tests/run-tests.js tests/requirement-parser.test.js`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add src/core/parser-utils.js tests/requirement-parser.test.js
git commit -m "feat(parser): detect requirementDiagram type"
```

---

## Task 3: requirement.js モジュール skeleton + parse (requirement 6 reqType)

**Files:**
- Create: `src/modules/requirement.js`
- Modify: `tests/run-tests.js:7-23`
- Modify: `tests/requirement-parser.test.js`

- [ ] **Step 1: tests/run-tests.js の sourceFiles に追加**

`tests/run-tests.js:21` の `'src/modules/er.js',` の直後に追加:

```javascript
  'src/modules/requirement.js',
```

- [ ] **Step 2: requirement.js skeleton 作成**

`src/modules/requirement.js` を新規作成:

```javascript
'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

window.MA.modules.requirementDiagram = (function() {
  var REQ_TYPES = ['requirement', 'functionalRequirement', 'interfaceRequirement', 'performanceRequirement', 'physicalRequirement', 'designConstraint'];
  var RISKS = ['low', 'medium', 'high'];
  var VERIFY_METHODS = ['analysis', 'inspection', 'test', 'demonstration'];
  var RELTYPES = ['contains', 'copies', 'derives', 'satisfies', 'verifies', 'refines', 'traces'];

  // Build dynamic regex for reqType block start: e.g. /^(requirement|functionalRequirement|...)\s+(\S+)\s*\{\s*$/
  var REQ_BLOCK_RE = new RegExp('^(' + REQ_TYPES.join('|') + ')\\s+([A-Za-z_][A-Za-z0-9_-]*)\\s*\\{\\s*$');
  var ELEMENT_BLOCK_RE = /^element\s+([A-Za-z_][A-Za-z0-9_-]*)\s*\{\s*$/;
  // Field inside block: e.g.  id: REQ-001  /  text: foo bar  /  risk: high  /  verifymethod: test  /  type: code module  /  docref: src/x.c
  var FIELD_RE = /^([A-Za-z]+)\s*:\s*(.+)$/;
  // Relation: SRC - reltype -> DST
  var REL_RE = new RegExp('^([A-Za-z_][A-Za-z0-9_-]*)\\s+-\\s+(' + RELTYPES.join('|') + ')\\s+->\\s+([A-Za-z_][A-Za-z0-9_-]*)\\s*$');

  function parseRequirement(text) {
    var result = { meta: {}, elements: [], relations: [] };
    if (!text || !text.trim()) return result;

    var lines = text.split('\n');
    var relCounter = 0;
    var current = null; // { kind, name, fields, line }

    for (var i = 0; i < lines.length; i++) {
      var lineNum = i + 1;
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.indexOf('%%') === 0) continue;
      if (/^requirementDiagram/.test(trimmed)) continue;

      if (trimmed === '}') { current = null; continue; }

      var rm = trimmed.match(REQ_BLOCK_RE);
      if (rm) {
        current = {
          kind: 'requirement', reqType: rm[1], name: rm[2],
          id: '', text: '', risk: '', verifymethod: '',
          line: lineNum,
        };
        result.elements.push(current);
        continue;
      }

      var em = trimmed.match(ELEMENT_BLOCK_RE);
      if (em) {
        current = {
          kind: 'element', name: em[1],
          type: '', docref: '',
          line: lineNum,
        };
        result.elements.push(current);
        continue;
      }

      if (current) {
        var fm = trimmed.match(FIELD_RE);
        if (fm) {
          var key = fm[1].toLowerCase();
          var val = fm[2].trim();
          if (current.kind === 'requirement') {
            if (key === 'id') current.id = val;
            else if (key === 'text') current.text = val;
            else if (key === 'risk') current.risk = val.toLowerCase();
            else if (key === 'verifymethod') current.verifymethod = val.toLowerCase();
          } else if (current.kind === 'element') {
            if (key === 'type') current.type = val;
            else if (key === 'docref') current.docref = val;
          }
          continue;
        }
      }

      var lm = trimmed.match(REL_RE);
      if (lm) {
        result.relations.push({
          id: '__rel_' + (relCounter++),
          from: lm[1], reltype: lm[2], to: lm[3],
          line: lineNum,
        });
      }
    }

    return result;
  }

  return {
    type: 'requirementDiagram',
    displayName: 'Requirement',
    REQ_TYPES: REQ_TYPES,
    RISKS: RISKS,
    VERIFY_METHODS: VERIFY_METHODS,
    RELTYPES: RELTYPES,
    detect: function(text) {
      return window.MA.parserUtils.detectDiagramType(text) === 'requirementDiagram';
    },
    parse: parseRequirement,
    parseRequirement: parseRequirement,
    template: function() {
      return [
        'requirementDiagram',
        '',
        'requirement sample_req {',
        '    id: REQ-001',
        '    text: サンプル要件',
        '    risk: medium',
        '    verifymethod: test',
        '}',
        '',
        'element sample_elem {',
        '    type: code module',
        '    docref: src/sample.c',
        '}',
        '',
        'sample_elem - satisfies -> sample_req',
      ].join('\n');
    },
    buildOverlay: function(svgEl, parsedData, overlayEl) {
      if (!overlayEl) return;
      while (overlayEl.firstChild) overlayEl.removeChild(overlayEl.firstChild);
      if (!svgEl) return;
      var viewBox = svgEl.getAttribute('viewBox');
      if (viewBox) overlayEl.setAttribute('viewBox', viewBox);
      var svgW = svgEl.getAttribute('width'); var svgH = svgEl.getAttribute('height');
      if (svgW) overlayEl.setAttribute('width', svgW);
      if (svgH) overlayEl.setAttribute('height', svgH);
    },
    renderProps: function(selData, parsedData, propsEl, ctx) {
      if (propsEl) propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">Requirement (実装中)</p>';
    },
    operations: { add: function(t) { return t; }, delete: function(t) { return t; }, update: function(t) { return t; }, moveUp: function(t) { return t; }, moveDown: function(t) { return t; }, connect: function(t) { return t; } },
  };
})();
```

- [ ] **Step 3: parser テストを拡張**

`tests/requirement-parser.test.js` に追記:

```javascript
var req = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.requirementDiagram)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.requirementDiagram);

describe('parseRequirement — 6 reqType', function() {
  test('parses requirement type', function() {
    var r = req.parseRequirement('requirementDiagram\n\nrequirement r1 {\n    id: REQ-001\n    text: hello\n    risk: high\n    verifymethod: test\n}\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].kind).toBe('requirement');
    expect(r.elements[0].reqType).toBe('requirement');
    expect(r.elements[0].name).toBe('r1');
    expect(r.elements[0].id).toBe('REQ-001');
    expect(r.elements[0].text).toBe('hello');
    expect(r.elements[0].risk).toBe('high');
    expect(r.elements[0].verifymethod).toBe('test');
  });

  test('parses functionalRequirement', function() {
    var r = req.parseRequirement('requirementDiagram\nfunctionalRequirement fr1 {\n    id: F-1\n}\n');
    expect(r.elements[0].reqType).toBe('functionalRequirement');
  });

  test('parses interfaceRequirement', function() {
    var r = req.parseRequirement('requirementDiagram\ninterfaceRequirement ir1 {\n    id: I-1\n}\n');
    expect(r.elements[0].reqType).toBe('interfaceRequirement');
  });

  test('parses performanceRequirement', function() {
    var r = req.parseRequirement('requirementDiagram\nperformanceRequirement pr1 {\n    id: P-1\n}\n');
    expect(r.elements[0].reqType).toBe('performanceRequirement');
  });

  test('parses physicalRequirement', function() {
    var r = req.parseRequirement('requirementDiagram\nphysicalRequirement ph1 {\n    id: PH-1\n}\n');
    expect(r.elements[0].reqType).toBe('physicalRequirement');
  });

  test('parses designConstraint', function() {
    var r = req.parseRequirement('requirementDiagram\ndesignConstraint dc1 {\n    id: DC-1\n}\n');
    expect(r.elements[0].reqType).toBe('designConstraint');
  });
});

describe('parseRequirement — comments and blank lines', function() {
  test('skips comments', function() {
    var r = req.parseRequirement('requirementDiagram\n%% this is comment\nrequirement r1 {\n    id: X\n}\n');
    expect(r.elements.length).toBe(1);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `node tests/run-tests.js tests/requirement-parser.test.js`
Expected: PASS (8 passed total: 1 detection + 6 reqType + 1 comment)

- [ ] **Step 5: Commit**

```bash
git add src/modules/requirement.js tests/run-tests.js tests/requirement-parser.test.js
git commit -m "feat(requirement): module skeleton + parse 6 reqType"
```

---

## Task 4: parse element

**Files:**
- Modify: `tests/requirement-parser.test.js`

- [ ] **Step 1: element parse テスト追加**

```javascript
describe('parseRequirement — element', function() {
  test('parses element with type and docref', function() {
    var r = req.parseRequirement('requirementDiagram\nelement ecu {\n    type: code module\n    docref: src/ecu.c\n}\n');
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].kind).toBe('element');
    expect(r.elements[0].name).toBe('ecu');
    expect(r.elements[0].type).toBe('code module');
    expect(r.elements[0].docref).toBe('src/ecu.c');
  });

  test('parses element with empty docref', function() {
    var r = req.parseRequirement('requirementDiagram\nelement e1 {\n    type: simulation\n}\n');
    expect(r.elements[0].docref).toBe('');
  });
});
```

- [ ] **Step 2: Run tests (Task 3 のparserで既に対応済みなので即PASS見込み)**

Run: `node tests/run-tests.js tests/requirement-parser.test.js`
Expected: 10 passed

- [ ] **Step 3: Commit**

```bash
git add tests/requirement-parser.test.js
git commit -m "test(requirement): parse element with type/docref"
```

---

## Task 5: parse relation (7 reltype)

**Files:**
- Modify: `tests/requirement-parser.test.js`

- [ ] **Step 1: relation parse テスト追加**

```javascript
describe('parseRequirement — relations (7 reltype)', function() {
  var reltypes = ['contains', 'copies', 'derives', 'satisfies', 'verifies', 'refines', 'traces'];
  reltypes.forEach(function(rt) {
    test('parses reltype ' + rt, function() {
      var r = req.parseRequirement('requirementDiagram\nrequirement a {\n    id: A\n}\nrequirement b {\n    id: B\n}\na - ' + rt + ' -> b\n');
      expect(r.relations.length).toBe(1);
      expect(r.relations[0].from).toBe('a');
      expect(r.relations[0].to).toBe('b');
      expect(r.relations[0].reltype).toBe(rt);
    });
  });

  test('multiple relations get unique IDs', function() {
    var r = req.parseRequirement('requirementDiagram\nrequirement a { id: A }\nrequirement b { id: B }\nrequirement c { id: C }\na - contains -> b\nb - derives -> c\n');
    expect(r.relations.length).toBe(2);
    expect(r.relations[0].id).not.toBe(r.relations[1].id);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `node tests/run-tests.js tests/requirement-parser.test.js`
Expected: 18 passed (10 prev + 7 reltype + 1 unique IDs)

- [ ] **Step 3: Commit**

```bash
git add tests/requirement-parser.test.js
git commit -m "test(requirement): parse 7 reltype"
```

---

## Task 6: addRequirement updater

**Files:**
- Modify: `src/modules/requirement.js`
- Create: `tests/requirement-updater.test.js`

- [ ] **Step 1: addRequirement 関数追加**

`src/modules/requirement.js` の `parseRequirement` 関数の直後 (return 文の前) に追加:

```javascript
  function addRequirement(text, reqType, name) {
    var block = [
      reqType + ' ' + name + ' {',
      '    id: ',
      '    text: ',
      '    risk: medium',
      '    verifymethod: analysis',
      '}',
    ];
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice.apply(lines, [insertAt, 0].concat(block));
    return lines.join('\n');
  }
```

そして return オブジェクトに `addRequirement: addRequirement,` を追加。

- [ ] **Step 2: updater テストファイル作成**

`tests/requirement-updater.test.js` を新規作成:

```javascript
'use strict';
var req = (typeof window !== 'undefined' && window.MA && window.MA.modules && window.MA.modules.requirementDiagram)
  || (global.window && global.window.MA && global.window.MA.modules && global.window.MA.modules.requirementDiagram);

describe('addRequirement', function() {
  test('adds requirement block at end', function() {
    var t = 'requirementDiagram\n';
    var out = req.addRequirement(t, 'functionalRequirement', 'fr1');
    expect(out).toContain('functionalRequirement fr1 {');
    expect(out).toContain('id: ');
    expect(out).toContain('risk: medium');
    expect(out).toContain('verifymethod: analysis');
  });

  test('adds with each reqType', function() {
    ['requirement', 'functionalRequirement', 'interfaceRequirement', 'performanceRequirement', 'physicalRequirement', 'designConstraint'].forEach(function(rt) {
      var out = req.addRequirement('requirementDiagram\n', rt, 'x');
      expect(out).toContain(rt + ' x {');
    });
  });
});
```

- [ ] **Step 3: Run tests**

Run: `node tests/run-tests.js tests/requirement-updater.test.js`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add src/modules/requirement.js tests/requirement-updater.test.js
git commit -m "feat(requirement): addRequirement updater"
```

---

## Task 7: addElement updater

**Files:**
- Modify: `src/modules/requirement.js`
- Modify: `tests/requirement-updater.test.js`

- [ ] **Step 1: addElement 関数追加**

`src/modules/requirement.js` の `addRequirement` の直後に追加:

```javascript
  function addElement(text, name) {
    var block = [
      'element ' + name + ' {',
      '    type: ',
      '    docref: ',
      '}',
    ];
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice.apply(lines, [insertAt, 0].concat(block));
    return lines.join('\n');
  }
```

return オブジェクトに `addElement: addElement,` を追加。

- [ ] **Step 2: テスト追加**

`tests/requirement-updater.test.js` に追記:

```javascript
describe('addElement', function() {
  test('adds element block', function() {
    var out = req.addElement('requirementDiagram\n', 'ecu');
    expect(out).toContain('element ecu {');
    expect(out).toContain('type: ');
    expect(out).toContain('docref: ');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `node tests/run-tests.js tests/requirement-updater.test.js`
Expected: 3 passed

- [ ] **Step 4: Commit**

```bash
git add src/modules/requirement.js tests/requirement-updater.test.js
git commit -m "feat(requirement): addElement updater"
```

---

## Task 8: addRelation updater

**Files:**
- Modify: `src/modules/requirement.js`
- Modify: `tests/requirement-updater.test.js`

- [ ] **Step 1: addRelation 関数追加**

```javascript
  function addRelation(text, from, reltype, to) {
    var newLine = from + ' - ' + reltype + ' -> ' + to;
    var lines = text.split('\n');
    var insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join('\n');
  }
```

return オブジェクトに `addRelation: addRelation,` を追加。

- [ ] **Step 2: テスト追加**

```javascript
describe('addRelation', function() {
  test('adds relation line', function() {
    var out = req.addRelation('requirementDiagram\n', 'a', 'satisfies', 'b');
    expect(out).toContain('a - satisfies -> b');
  });

  test('addRelation works with each of 7 reltype', function() {
    ['contains', 'copies', 'derives', 'satisfies', 'verifies', 'refines', 'traces'].forEach(function(rt) {
      var out = req.addRelation('requirementDiagram\n', 'x', rt, 'y');
      expect(out).toContain('x - ' + rt + ' -> y');
    });
  });
});
```

- [ ] **Step 3: Run tests**

Run: `node tests/run-tests.js tests/requirement-updater.test.js`
Expected: 5 passed

- [ ] **Step 4: Commit**

```bash
git add src/modules/requirement.js tests/requirement-updater.test.js
git commit -m "feat(requirement): addRelation updater"
```

---

## Task 9: deleteElement / deleteRelation with cascade

**Files:**
- Modify: `src/modules/requirement.js`
- Modify: `tests/requirement-updater.test.js`

- [ ] **Step 1: deleteElement / deleteRelation 関数追加**

`src/modules/requirement.js` に追加:

```javascript
  // Delete a requirement or element block (handles closing brace)
  // Also removes any relations referencing this element by name (cascade)
  function deleteElement(text, lineNum, elementName) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var trimmed = lines[idx].trim();
    if (/\{\s*$/.test(trimmed)) {
      var endIdx = idx;
      for (var j = idx + 1; j < lines.length; j++) {
        if (lines[j].trim() === '}') { endIdx = j; break; }
      }
      lines.splice(idx, (endIdx - idx + 1));
    } else {
      lines.splice(idx, 1);
    }
    // Cascade: remove relations referencing elementName
    if (elementName) {
      var relRe = new RegExp('^\\s*([A-Za-z_][A-Za-z0-9_-]*)\\s+-\\s+\\S+\\s+->\\s+([A-Za-z_][A-Za-z0-9_-]*)\\s*$');
      lines = lines.filter(function(ln) {
        var m = ln.match(relRe);
        if (!m) return true;
        return m[1] !== elementName && m[2] !== elementName;
      });
    }
    return lines.join('\n');
  }

  function deleteRelation(text, lineNum) {
    return window.MA.textUpdater.deleteLine(text, lineNum);
  }
```

return オブジェクトに `deleteElement: deleteElement, deleteRelation: deleteRelation,` を追加。

- [ ] **Step 2: テスト追加**

```javascript
describe('deleteElement', function() {
  test('removes requirement block', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: X\n}\n';
    var parsed = req.parseRequirement(t);
    var out = req.deleteElement(t, parsed.elements[0].line, 'r1');
    expect(out).not.toContain('requirement r1');
  });

  test('cascade removes relations referencing deleted element (as from)', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: A\n}\nrequirement r2 {\n    id: B\n}\nr1 - contains -> r2\n';
    var parsed = req.parseRequirement(t);
    var out = req.deleteElement(t, parsed.elements[0].line, 'r1');
    expect(out).not.toContain('r1 - contains -> r2');
  });

  test('cascade removes relations referencing deleted element (as to)', function() {
    var t = 'requirementDiagram\nrequirement r1 { id: A }\nrequirement r2 { id: B }\nr1 - contains -> r2\n';
    var parsed = req.parseRequirement(t);
    var out = req.deleteElement(t, parsed.elements[1].line, 'r2');
    expect(out).not.toContain('-> r2');
  });
});

describe('deleteRelation', function() {
  test('removes single relation line', function() {
    var t = 'requirementDiagram\nrequirement a { id: A }\nrequirement b { id: B }\na - contains -> b\n';
    var parsed = req.parseRequirement(t);
    var out = req.deleteRelation(t, parsed.relations[0].line);
    expect(out).not.toContain('a - contains -> b');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `node tests/run-tests.js tests/requirement-updater.test.js`
Expected: 9 passed

- [ ] **Step 4: Commit**

```bash
git add src/modules/requirement.js tests/requirement-updater.test.js
git commit -m "feat(requirement): delete with cascade for relations"
```

---

## Task 10: updateField (リクエスト・エレメント・リレーション)

**Files:**
- Modify: `src/modules/requirement.js`
- Modify: `tests/requirement-updater.test.js`

- [ ] **Step 1: updateField 関数群追加**

```javascript
  // Update requirement field: id / text / risk / verifymethod
  // lineNum is the requirement block start line
  function updateRequirementField(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var fieldKey = field.toLowerCase();
    // Search inside block for matching field line
    for (var j = idx + 1; j < lines.length; j++) {
      var t2 = lines[j].trim();
      if (t2 === '}') {
        // Field not found, append before close brace
        lines.splice(j, 0, '    ' + fieldKey + ': ' + value);
        return lines.join('\n');
      }
      var m = t2.match(/^([A-Za-z]+)\s*:\s*(.*)$/);
      if (m && m[1].toLowerCase() === fieldKey) {
        var indent = lines[j].match(/^(\s*)/)[1];
        lines[j] = indent + fieldKey + ': ' + value;
        return lines.join('\n');
      }
    }
    return text;
  }

  // Update reqType: change the block start word (e.g. requirement -> functionalRequirement)
  function updateRequirementType(text, lineNum, newReqType) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = lines[idx].trim().match(REQ_BLOCK_RE);
    if (!m) return text;
    lines[idx] = indent + newReqType + ' ' + m[2] + ' {';
    return lines.join('\n');
  }

  // Update element field: type / docref
  function updateElementField(text, lineNum, field, value) {
    return updateRequirementField(text, lineNum, field, value);  // same logic, key is lowercase
  }

  // Update relation: from / reltype / to
  function updateRelation(text, lineNum, field, value) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var m = lines[idx].trim().match(/^([A-Za-z_][A-Za-z0-9_-]*)\s+-\s+(\S+)\s+->\s+([A-Za-z_][A-Za-z0-9_-]*)\s*$/);
    if (!m) return text;
    var from = m[1], reltype = m[2], to = m[3];
    if (field === 'from') from = value;
    else if (field === 'reltype') reltype = value;
    else if (field === 'to') to = value;
    lines[idx] = indent + from + ' - ' + reltype + ' -> ' + to;
    return lines.join('\n');
  }
```

return オブジェクトに `updateRequirementField, updateRequirementType, updateElementField, updateRelation` を全て追加。

- [ ] **Step 2: テスト追加**

```javascript
describe('updateRequirementField', function() {
  test('updates id', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: OLD\n    text: hi\n}\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateRequirementField(t, parsed.elements[0].line, 'id', 'NEW');
    expect(out).toContain('id: NEW');
    expect(out).not.toContain('id: OLD');
  });

  test('updates text', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: X\n    text: hi\n}\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateRequirementField(t, parsed.elements[0].line, 'text', 'changed');
    expect(out).toContain('text: changed');
  });

  test('appends field if missing', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: X\n}\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateRequirementField(t, parsed.elements[0].line, 'risk', 'high');
    expect(out).toContain('risk: high');
  });
});

describe('updateRequirementType', function() {
  test('changes reqType', function() {
    var t = 'requirementDiagram\nrequirement r1 {\n    id: X\n}\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateRequirementType(t, parsed.elements[0].line, 'functionalRequirement');
    expect(out).toContain('functionalRequirement r1 {');
  });
});

describe('updateElementField', function() {
  test('updates docref', function() {
    var t = 'requirementDiagram\nelement e1 {\n    type: code\n    docref: old\n}\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateElementField(t, parsed.elements[0].line, 'docref', 'src/new.c');
    expect(out).toContain('docref: src/new.c');
  });
});

describe('updateRelation', function() {
  test('updates reltype', function() {
    var t = 'requirementDiagram\nrequirement a { id: A }\nrequirement b { id: B }\na - contains -> b\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateRelation(t, parsed.relations[0].line, 'reltype', 'derives');
    expect(out).toContain('a - derives -> b');
  });

  test('updates from', function() {
    var t = 'requirementDiagram\nrequirement a { id: A }\nrequirement b { id: B }\na - contains -> b\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateRelation(t, parsed.relations[0].line, 'from', 'c');
    expect(out).toContain('c - contains -> b');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `node tests/run-tests.js tests/requirement-updater.test.js`
Expected: 16 passed

- [ ] **Step 4: Commit**

```bash
git add src/modules/requirement.js tests/requirement-updater.test.js
git commit -m "feat(requirement): updateField for requirement/element/relation"
```

---

## Task 11: updateName (cascading rename in relations)

**Files:**
- Modify: `src/modules/requirement.js`
- Modify: `tests/requirement-updater.test.js`

- [ ] **Step 1: updateName 関数追加**

```javascript
  // Rename the element/requirement, AND update all relations referencing the old name
  function updateName(text, lineNum, oldName, newName) {
    var lines = text.split('\n');
    var idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return text;
    var indent = lines[idx].match(/^(\s*)/)[1];
    var trimmed = lines[idx].trim();
    var rm = trimmed.match(REQ_BLOCK_RE);
    if (rm) {
      lines[idx] = indent + rm[1] + ' ' + newName + ' {';
    } else {
      var em = trimmed.match(ELEMENT_BLOCK_RE);
      if (em) {
        lines[idx] = indent + 'element ' + newName + ' {';
      }
    }
    // Update relations
    var relRe = /^(\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s+-\s+\S+\s+->\s+)([A-Za-z_][A-Za-z0-9_-]*)(\s*)$/;
    for (var j = 0; j < lines.length; j++) {
      var rm2 = lines[j].match(relRe);
      if (rm2) {
        var from = rm2[2] === oldName ? newName : rm2[2];
        var to = rm2[4] === oldName ? newName : rm2[4];
        lines[j] = rm2[1] + from + rm2[3] + to + rm2[5];
      }
    }
    return lines.join('\n');
  }
```

return オブジェクトに `updateName: updateName,` を追加。

- [ ] **Step 2: テスト追加**

```javascript
describe('updateName', function() {
  test('renames requirement and updates from-references', function() {
    var t = 'requirementDiagram\nrequirement r1 { id: A }\nrequirement r2 { id: B }\nr1 - contains -> r2\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateName(t, parsed.elements[0].line, 'r1', 'renamed_r1');
    expect(out).toContain('requirement renamed_r1 {');
    expect(out).toContain('renamed_r1 - contains -> r2');
    expect(out).not.toContain('r1 - contains');
  });

  test('renames requirement and updates to-references', function() {
    var t = 'requirementDiagram\nrequirement r1 { id: A }\nrequirement r2 { id: B }\nr1 - contains -> r2\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateName(t, parsed.elements[1].line, 'r2', 'renamed_r2');
    expect(out).toContain('requirement renamed_r2 {');
    expect(out).toContain('-> renamed_r2');
  });

  test('renames element and updates references', function() {
    var t = 'requirementDiagram\nrequirement r1 { id: A }\nelement e1 { type: code }\ne1 - satisfies -> r1\n';
    var parsed = req.parseRequirement(t);
    var out = req.updateName(t, parsed.elements[1].line, 'e1', 'ecu');
    expect(out).toContain('element ecu {');
    expect(out).toContain('ecu - satisfies -> r1');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `node tests/run-tests.js tests/requirement-updater.test.js`
Expected: 19 passed

- [ ] **Step 4: Commit**

```bash
git add src/modules/requirement.js tests/requirement-updater.test.js
git commit -m "feat(requirement): updateName with relation reference cascading"
```

---

## Task 12: moveUp / moveDown via textUpdater

**Files:**
- Modify: `src/modules/requirement.js`
- Modify: `tests/requirement-updater.test.js`

- [ ] **Step 1: operations.moveUp/moveDown を実装に置き換え**

`src/modules/requirement.js` の return オブジェクトの `operations` 部分を以下に置き換え:

```javascript
    operations: {
      add: function(text, kind, props) {
        if (kind === 'requirement') return addRequirement(text, props.reqType || 'requirement', props.name);
        if (kind === 'element') return addElement(text, props.name);
        if (kind === 'relation') return addRelation(text, props.from, props.reltype, props.to);
        return text;
      },
      delete: function(text, lineNum, opts) {
        opts = opts || {};
        if (opts.kind === 'relation') return deleteRelation(text, lineNum);
        return deleteElement(text, lineNum, opts.elementName);
      },
      update: function(text, lineNum, field, value, opts) {
        opts = opts || {};
        if (opts.kind === 'relation') return updateRelation(text, lineNum, field, value);
        if (opts.kind === 'element') return updateElementField(text, lineNum, field, value);
        if (field === 'reqType') return updateRequirementType(text, lineNum, value);
        if (field === 'name') return updateName(text, lineNum, opts.oldName, value);
        return updateRequirementField(text, lineNum, field, value);
      },
      moveUp: function(text, lineNum) {
        if (lineNum <= 1) return text;
        return window.MA.textUpdater.swapLines(text, lineNum, lineNum - 1);
      },
      moveDown: function(text, lineNum) {
        var total = text.split('\n').length;
        if (lineNum >= total) return text;
        return window.MA.textUpdater.swapLines(text, lineNum, lineNum + 1);
      },
      connect: function(text, fromName, toName, props) {
        props = props || {};
        return addRelation(text, fromName, props.reltype || 'satisfies', toName);
      },
    },
```

- [ ] **Step 2: テスト追加 (moveUp / moveDown)**

```javascript
describe('operations.moveUp / moveDown', function() {
  test('moveUp swaps with previous line', function() {
    var mod = req;  // alias
    var t = 'A\nB\nC\n';
    var out = mod.operations.moveUp(t, 2);
    expect(out.split('\n')[0]).toBe('B');
    expect(out.split('\n')[1]).toBe('A');
  });

  test('moveDown swaps with next line', function() {
    var t = 'A\nB\nC\n';
    var out = req.operations.moveDown(t, 1);
    expect(out.split('\n')[0]).toBe('B');
    expect(out.split('\n')[1]).toBe('A');
  });

  test('connect creates a satisfies relation by default', function() {
    var t = 'requirementDiagram\nrequirement r1 { id: A }\nelement e1 { type: x }\n';
    var out = req.operations.connect(t, 'e1', 'r1');
    expect(out).toContain('e1 - satisfies -> r1');
  });

  test('connect with reltype prop', function() {
    var out = req.operations.connect('requirementDiagram\n', 'a', 'b', { reltype: 'derives' });
    expect(out).toContain('a - derives -> b');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `node tests/run-tests.js tests/requirement-updater.test.js`
Expected: 23 passed

- [ ] **Step 4: Commit**

```bash
git add src/modules/requirement.js tests/requirement-updater.test.js
git commit -m "feat(requirement): operations dispatch + moveUp/moveDown/connect"
```

---

## Task 13: renderProps — list view (add forms + lists)

**Files:**
- Modify: `src/modules/requirement.js`

- [ ] **Step 1: renderProps の list view 部分を実装に置き換え**

`src/modules/requirement.js` の `renderProps` 関数全体を以下に置き換え (selData が空 / 未選択時のリスト表示部分):

```javascript
    renderProps: function(selData, parsedData, propsEl, ctx) {
      if (!propsEl) return;
      var escHtml = window.MA.htmlUtils.escHtml;
      var P = window.MA.properties;

      var reqs = parsedData.elements.filter(function(e) { return e.kind === 'requirement'; });
      var elems = parsedData.elements.filter(function(e) { return e.kind === 'element'; });
      var rels = parsedData.relations;

      if (!selData || selData.length === 0) {
        var allNamesOpts = parsedData.elements.map(function(el) { return { value: el.name, label: el.name }; });
        if (allNamesOpts.length === 0) allNamesOpts = [{ value: '', label: '（要素を先に追加）' }];

        var reqTypeOpts = REQ_TYPES.map(function(rt) { return { value: rt, label: rt, selected: rt === 'requirement' }; });
        var reltypeOpts = RELTYPES.map(function(rt) { return { value: rt, label: rt, selected: rt === 'satisfies' }; });

        var reqsList = '';
        for (var i = 0; i < reqs.length; i++) {
          reqsList += P.listItemHtml({
            label: reqs[i].name,
            sublabel: '(' + reqs[i].reqType + (reqs[i].id ? ', id=' + reqs[i].id : '') + ')',
            selectClass: 'req-select-req', deleteClass: 'req-delete-req',
            dataElementId: reqs[i].name, dataLine: reqs[i].line,
          });
        }
        if (!reqsList) reqsList = P.emptyListHtml('（要件なし）');

        var elemsList = '';
        for (var j = 0; j < elems.length; j++) {
          elemsList += P.listItemHtml({
            label: elems[j].name,
            sublabel: elems[j].type ? '(' + elems[j].type + ')' : '',
            selectClass: 'req-select-elem', deleteClass: 'req-delete-elem',
            dataElementId: elems[j].name, dataLine: elems[j].line,
          });
        }
        if (!elemsList) elemsList = P.emptyListHtml('（要素なし）');

        var relsList = '';
        for (var k = 0; k < rels.length; k++) {
          relsList += P.listItemHtml({
            label: rels[k].from + ' - ' + rels[k].reltype + ' -> ' + rels[k].to,
            selectClass: 'req-select-rel', deleteClass: 'req-delete-rel',
            dataElementId: rels[k].id, dataLine: rels[k].line, mono: true,
          });
        }
        if (!relsList) relsList = P.emptyListHtml('（リレーションなし）');

        propsEl.innerHTML =
          '<div style="margin-bottom:12px;font-size:11px;color:var(--text-secondary);">Requirement Diagram</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">要件を追加</label>' +
            P.selectFieldHtml('Type', 'req-add-req-type', reqTypeOpts) +
            P.fieldHtml('Name', 'req-add-req-name', '', '') +
            P.primaryButtonHtml('req-add-req-btn', '+ 要件追加') +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">エレメントを追加</label>' +
            P.fieldHtml('Name', 'req-add-elem-name', '', '') +
            P.primaryButtonHtml('req-add-elem-btn', '+ エレメント追加') +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--accent);margin-bottom:4px;font-weight:bold;">リレーションを追加</label>' +
            P.selectFieldHtml('From', 'req-add-rel-from', allNamesOpts) +
            P.selectFieldHtml('Type', 'req-add-rel-type', reltypeOpts) +
            P.selectFieldHtml('To', 'req-add-rel-to', allNamesOpts) +
            P.primaryButtonHtml('req-add-rel-btn', '+ リレーション追加') +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">要件一覧</label>' +
            '<div>' + reqsList + '</div>' +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">エレメント一覧</label>' +
            '<div>' + elemsList + '</div>' +
          '</div>' +
          '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;">' +
            '<label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">リレーション一覧</label>' +
            '<div>' + relsList + '</div>' +
          '</div>';

        P.bindEvent('req-add-req-btn', 'click', function() {
          var rtv = document.getElementById('req-add-req-type').value;
          var nv = document.getElementById('req-add-req-name').value.trim();
          if (!nv) { alert('Name は必須です'); return; }
          window.MA.history.pushHistory();
          ctx.setMmdText(addRequirement(ctx.getMmdText(), rtv, nv));
          ctx.onUpdate();
        });
        P.bindEvent('req-add-elem-btn', 'click', function() {
          var nv = document.getElementById('req-add-elem-name').value.trim();
          if (!nv) { alert('Name は必須です'); return; }
          window.MA.history.pushHistory();
          ctx.setMmdText(addElement(ctx.getMmdText(), nv));
          ctx.onUpdate();
        });
        P.bindEvent('req-add-rel-btn', 'click', function() {
          var fv = document.getElementById('req-add-rel-from').value;
          var tv = document.getElementById('req-add-rel-to').value;
          var rtv = document.getElementById('req-add-rel-type').value;
          if (!fv || !tv) { alert('From / To を選択してください'); return; }
          window.MA.history.pushHistory();
          ctx.setMmdText(addRelation(ctx.getMmdText(), fv, rtv, tv));
          ctx.onUpdate();
        });

        P.bindSelectButtons(propsEl, 'req-select-req', 'requirement');
        P.bindSelectButtons(propsEl, 'req-select-elem', 'element');
        P.bindSelectButtons(propsEl, 'req-select-rel', 'relation');
        P.bindDeleteButtons(propsEl, 'req-delete-req', ctx, function(t, ln) {
          var nm = '';
          for (var di = 0; di < parsedData.elements.length; di++) if (parsedData.elements[di].line === ln) { nm = parsedData.elements[di].name; break; }
          return deleteElement(t, ln, nm);
        });
        P.bindDeleteButtons(propsEl, 'req-delete-elem', ctx, function(t, ln) {
          var nm = '';
          for (var di = 0; di < parsedData.elements.length; di++) if (parsedData.elements[di].line === ln) { nm = parsedData.elements[di].name; break; }
          return deleteElement(t, ln, nm);
        });
        P.bindDeleteButtons(propsEl, 'req-delete-rel', ctx, deleteRelation);
        return;
      }

      // Detail panels: see Task 14-16
      propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">詳細パネル (実装中)</p>';
    },
```

- [ ] **Step 2: ブラウザで手動確認 (オプション、Task 18 まで保留可)**

実機確認は HTML 配線後 (Task 18) なのでここではスキップ可。テストは E2E で Task 19 でカバー。

- [ ] **Step 3: Run all unit tests to verify regression-free**

Run: `node tests/run-tests.js`
Expected: 全モジュール PASS、新モジュールの既存テストもPASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/requirement.js
git commit -m "feat(requirement): renderProps list view with vertical add forms"
```

---

## Task 14: renderProps — requirement detail panel

**Files:**
- Modify: `src/modules/requirement.js`

- [ ] **Step 1: renderProps の単一選択 (requirement) 分岐を追加**

`renderProps` 関数の末尾 `propsEl.innerHTML = '<p>...詳細パネル (実装中)</p>';` を以下で置き換え:

```javascript
      // Single selection
      if (selData.length === 1) {
        var sel = selData[0];
        if (sel.type === 'requirement') {
          var rq = null;
          for (var ri = 0; ri < reqs.length; ri++) if (reqs[ri].name === sel.id) { rq = reqs[ri]; break; }
          if (!rq) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">要件が見つかりません</p>'; return; }
          var reqTypeOpts2 = REQ_TYPES.map(function(rt) { return { value: rt, label: rt, selected: rt === rq.reqType }; });
          var riskOpts = RISKS.map(function(rs) { return { value: rs, label: rs, selected: rs === rq.risk }; });
          var verifyOpts = VERIFY_METHODS.map(function(vm) { return { value: vm, label: vm, selected: vm === rq.verifymethod }; });

          propsEl.innerHTML =
            P.panelHeaderHtml(rq.name) +
            P.selectFieldHtml('Type', 'req-edit-type', reqTypeOpts2) +
            P.fieldHtml('Name', 'req-edit-name', rq.name) +
            P.fieldHtml('id', 'req-edit-id', rq.id) +
            '<div style="margin-bottom:8px;"><label style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:2px;">text</label><textarea id="req-edit-text" rows="3" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:3px 6px;border-radius:3px;font-size:12px;font-family:inherit;resize:vertical;">' + escHtml(rq.text) + '</textarea></div>' +
            P.selectFieldHtml('risk', 'req-edit-risk', riskOpts) +
            P.selectFieldHtml('verifymethod', 'req-edit-verify', verifyOpts) +
            P.dangerButtonHtml('req-edit-delete', '要件削除');

          var reqLine = rq.line, reqOldName = rq.name;
          document.getElementById('req-edit-type').addEventListener('change', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(updateRequirementType(ctx.getMmdText(), reqLine, this.value));
            ctx.onUpdate();
          });
          document.getElementById('req-edit-name').addEventListener('change', function() {
            var nv = this.value.trim();
            if (!nv || nv === reqOldName) return;
            window.MA.history.pushHistory();
            ctx.setMmdText(updateName(ctx.getMmdText(), reqLine, reqOldName, nv));
            ctx.onUpdate();
          });
          ['id', 'text', 'risk', 'verify'].forEach(function(suffix) {
            var inputId = 'req-edit-' + suffix;
            var fieldKey = suffix === 'verify' ? 'verifymethod' : suffix;
            document.getElementById(inputId).addEventListener('change', function() {
              window.MA.history.pushHistory();
              ctx.setMmdText(updateRequirementField(ctx.getMmdText(), reqLine, fieldKey, this.value));
              ctx.onUpdate();
            });
          });
          P.bindEvent('req-edit-delete', 'click', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(deleteElement(ctx.getMmdText(), reqLine, reqOldName));
            window.MA.selection.clearSelection();
            ctx.onUpdate();
          });
          return;
        }

        // element / relation panels: see Task 15, 16
      }

      propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">未対応の選択状態</p>';
```

- [ ] **Step 2: Unit tests regression-free を確認**

Run: `node tests/run-tests.js`
Expected: 全 PASS (UIコードは sandboxで素通り)

- [ ] **Step 3: Commit**

```bash
git add src/modules/requirement.js
git commit -m "feat(requirement): renderProps requirement detail panel"
```

---

## Task 15: renderProps — element detail panel

**Files:**
- Modify: `src/modules/requirement.js`

- [ ] **Step 1: element 分岐を追加**

Task 14 で追加した `// element / relation panels: see Task 15, 16` コメントの行を以下で置き換え:

```javascript
        if (sel.type === 'element') {
          var el = null;
          for (var ei = 0; ei < elems.length; ei++) if (elems[ei].name === sel.id) { el = elems[ei]; break; }
          if (!el) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">エレメントが見つかりません</p>'; return; }

          propsEl.innerHTML =
            P.panelHeaderHtml(el.name) +
            P.fieldHtml('Name', 'req-edit-elem-name', el.name) +
            P.fieldHtml('type', 'req-edit-elem-type', el.type) +
            P.fieldHtml('docref', 'req-edit-elem-docref', el.docref, '空可') +
            P.dangerButtonHtml('req-edit-elem-delete', 'エレメント削除');

          var elLine = el.line, elOldName = el.name;
          document.getElementById('req-edit-elem-name').addEventListener('change', function() {
            var nv = this.value.trim();
            if (!nv || nv === elOldName) return;
            window.MA.history.pushHistory();
            ctx.setMmdText(updateName(ctx.getMmdText(), elLine, elOldName, nv));
            ctx.onUpdate();
          });
          document.getElementById('req-edit-elem-type').addEventListener('change', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(updateElementField(ctx.getMmdText(), elLine, 'type', this.value));
            ctx.onUpdate();
          });
          document.getElementById('req-edit-elem-docref').addEventListener('change', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(updateElementField(ctx.getMmdText(), elLine, 'docref', this.value));
            ctx.onUpdate();
          });
          P.bindEvent('req-edit-elem-delete', 'click', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(deleteElement(ctx.getMmdText(), elLine, elOldName));
            window.MA.selection.clearSelection();
            ctx.onUpdate();
          });
          return;
        }

        // relation panel: see Task 16
```

- [ ] **Step 2: Unit tests**

Run: `node tests/run-tests.js`
Expected: 全 PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/requirement.js
git commit -m "feat(requirement): renderProps element detail panel"
```

---

## Task 16: renderProps — relation detail panel

**Files:**
- Modify: `src/modules/requirement.js`

- [ ] **Step 1: relation 分岐を追加**

Task 15 で追加した `// relation panel: see Task 16` を以下で置き換え:

```javascript
        if (sel.type === 'relation') {
          var rel = null;
          for (var rli = 0; rli < rels.length; rli++) if (rels[rli].id === sel.id) { rel = rels[rli]; break; }
          if (!rel) { propsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">リレーションが見つかりません</p>'; return; }

          var allOpts = parsedData.elements.map(function(e) { return { value: e.name, label: e.name }; });
          if (allOpts.length === 0) allOpts = [{ value: '', label: '（要素なし）' }];
          var fromOpts = allOpts.map(function(o) { return { value: o.value, label: o.label, selected: o.value === rel.from }; });
          var toOpts = allOpts.map(function(o) { return { value: o.value, label: o.label, selected: o.value === rel.to }; });
          var rtOpts = RELTYPES.map(function(rt) { return { value: rt, label: rt, selected: rt === rel.reltype }; });

          propsEl.innerHTML =
            P.panelHeaderHtml('Relation') +
            P.selectFieldHtml('From', 'req-edit-rel-from', fromOpts) +
            P.selectFieldHtml('Type', 'req-edit-rel-type', rtOpts) +
            P.selectFieldHtml('To', 'req-edit-rel-to', toOpts) +
            P.dangerButtonHtml('req-edit-rel-delete', 'リレーション削除');

          var relLine = rel.line;
          document.getElementById('req-edit-rel-from').addEventListener('change', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(updateRelation(ctx.getMmdText(), relLine, 'from', this.value));
            ctx.onUpdate();
          });
          document.getElementById('req-edit-rel-type').addEventListener('change', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(updateRelation(ctx.getMmdText(), relLine, 'reltype', this.value));
            ctx.onUpdate();
          });
          document.getElementById('req-edit-rel-to').addEventListener('change', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(updateRelation(ctx.getMmdText(), relLine, 'to', this.value));
            ctx.onUpdate();
          });
          P.bindEvent('req-edit-rel-delete', 'click', function() {
            window.MA.history.pushHistory();
            ctx.setMmdText(deleteRelation(ctx.getMmdText(), relLine));
            window.MA.selection.clearSelection();
            ctx.onUpdate();
          });
          return;
        }
```

- [ ] **Step 2: Unit tests**

Run: `node tests/run-tests.js`
Expected: 全 PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/requirement.js
git commit -m "feat(requirement): renderProps relation detail panel"
```

---

## Task 17: HTML 配線 (option追加 + script追加 + diagram-type select)

**Files:**
- Modify: `mermaid-assist.html:391-396`
- Modify: `mermaid-assist.html:465`

- [ ] **Step 1: diagram-type select に Requirement option 追加**

`mermaid-assist.html:396` の `<option value="erDiagram">ER</option>` の直後に追加:

```html
      <option value="requirementDiagram">Requirement</option>
```

- [ ] **Step 2: script タグ追加**

`mermaid-assist.html:465` の `<script src="src/modules/er.js"></script>` の直後に追加:

```html
<script src="src/modules/requirement.js"></script>
```

- [ ] **Step 3: 手動確認**

Run:
```bash
start mermaid-assist.html
```

UI で Requirement オプション選択 → template が表示される → property panel に「要件を追加」「エレメントを追加」「リレーションを追加」が出る → console error 0 を確認。

- [ ] **Step 4: Commit**

```bash
git add mermaid-assist.html
git commit -m "chore: register requirement module in HTML"
```

---

## Task 18: E2E test — requirement-basic.spec.js

**Files:**
- Create: `tests/e2e/requirement-basic.spec.js`

- [ ] **Step 1: E2E ファイル作成**

```javascript
// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const HTML_URL = 'file:///' + path.resolve(__dirname, '../../mermaid-assist.html').replace(/\\/g, '/');

async function waitForRender(page) {
  await page.waitForSelector('#preview-svg svg', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function switchToReq(page) {
  await page.locator('#diagram-type').selectOption('requirementDiagram');
  await page.waitForTimeout(1500);
}
async function editorText(page) { return page.locator('#editor').inputValue(); }

test.describe('Requirement: Switching', () => {
  test('switches to Requirement template', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    expect(await editorText(page)).toContain('requirementDiagram');
  });

  test('Requirement renders SVG', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await expect(page.locator('#preview-svg svg')).toBeVisible();
  });

  test('property panel shows requirement add UI', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#req-add-req-btn')).toBeVisible();
    await expect(page.locator('#req-add-elem-btn')).toBeVisible();
    await expect(page.locator('#req-add-rel-btn')).toBeVisible();
  });
});

test.describe('E25-E32: Requirement Operations', () => {
  test('E25: adding requirement with reqType updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(500);
    await page.locator('#req-add-req-type').selectOption('functionalRequirement');
    await page.locator('#req-add-req-name').fill('myReq');
    await page.locator('#req-add-req-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('functionalRequirement myReq {');
  });

  test('E26: adding element updates text', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(500);
    await page.locator('#req-add-elem-name').fill('ecu');
    await page.locator('#req-add-elem-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('element ecu {');
  });

  test('E27: adding relation with all 7 reltypes selectable', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(500);
    const opts = await page.locator('#req-add-rel-type option').allTextContents();
    expect(opts).toContain('contains');
    expect(opts).toContain('copies');
    expect(opts).toContain('derives');
    expect(opts).toContain('satisfies');
    expect(opts).toContain('verifies');
    expect(opts).toContain('refines');
    expect(opts).toContain('traces');
  });

  test('E28: add-relation creates the line', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(500);
    await page.locator('#req-add-elem-name').fill('elemA');
    await page.locator('#req-add-elem-btn').click();
    await page.waitForTimeout(300);
    await page.locator('#req-add-rel-from').selectOption('elemA');
    await page.locator('#req-add-rel-type').selectOption('verifies');
    await page.locator('#req-add-rel-to').selectOption('sample_req');
    await page.locator('#req-add-rel-btn').click();
    await page.waitForTimeout(500);
    expect(await editorText(page)).toContain('elemA - verifies -> sample_req');
  });

  test('E29: vertical add form labels visible (From/Type/To)', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(800);
    expect(await page.locator('label:has-text("From")').count()).toBeGreaterThan(0);
    expect(await page.locator('label:has-text("Type")').count()).toBeGreaterThan(0);
    expect(await page.locator('label:has-text("To")').count()).toBeGreaterThan(0);
  });

  test('E30: 6 reqType selectable in add form', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(500);
    const opts = await page.locator('#req-add-req-type option').allTextContents();
    expect(opts).toContain('requirement');
    expect(opts).toContain('functionalRequirement');
    expect(opts).toContain('interfaceRequirement');
    expect(opts).toContain('performanceRequirement');
    expect(opts).toContain('physicalRequirement');
    expect(opts).toContain('designConstraint');
  });

  test('E31: rename element updates relation reference', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(800);
    // Click select on sample_elem to open detail panel
    await page.locator('.req-select-elem[data-element-id="sample_elem"]').first().click();
    await page.waitForTimeout(400);
    await page.locator('#req-edit-elem-name').fill('renamed_elem');
    await page.locator('#req-edit-elem-name').dispatchEvent('change');
    await page.waitForTimeout(500);
    const txt = await editorText(page);
    expect(txt).toContain('element renamed_elem');
    expect(txt).toContain('renamed_elem - satisfies -> sample_req');
  });

  test('E32: delete element cascades relation removal', async ({ page }) => {
    await page.goto(HTML_URL);
    await waitForRender(page);
    await switchToReq(page);
    await page.waitForTimeout(800);
    await page.locator('.req-select-elem[data-element-id="sample_elem"]').first().click();
    await page.waitForTimeout(400);
    await page.locator('#req-edit-elem-delete').click();
    await page.waitForTimeout(500);
    const txt = await editorText(page);
    expect(txt).not.toContain('element sample_elem');
    expect(txt).not.toContain('sample_elem - satisfies');
  });
});
```

- [ ] **Step 2: E2E 実行**

Run: `npx playwright test tests/e2e/requirement-basic.spec.js`
Expected: 11 passed (3 switching + 8 operations)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/requirement-basic.spec.js
git commit -m "test(e2e): requirement-basic 11 cases (E25-E32 + 3 switching)"
```

---

## Task 19: 全テストスイート実行 + visual sweep

**Files:**
- Create: `.eval/v1.3.0/visual-sweep-v1.3.0/` ディレクトリ

- [ ] **Step 1: 全 unit + E2E**

Run: `npm run test:all`
Expected: 全 PASS (既存113 unit + 新規 〜25 unit、既存133 + 新規11 E2E)

- [ ] **Step 2: HTTP server 起動**

```bash
python -m http.server 8765
```
別ターミナルで作業継続。

- [ ] **Step 3: Playwright MCP で visual sweep**

`evaluator` agent を呼び出し、以下を実施:
- `127.0.0.1:8765/mermaid-assist.html` にアクセス
- diagram-type を Requirement に切替
- 6 reqType すべての描画スクリーンショット (各1枚)
- 7 reltype すべての描画スクリーンショット (1ファイルにまとめる)
- console error 0 を確認
- 結果を `.eval/v1.3.0/visual-sweep-v1.3.0/report.md` に書き出し

- [ ] **Step 4: visual sweep PASS 確認**

`.eval/v1.3.0/visual-sweep-v1.3.0/report.md` の判定が PASS、console error 0 なら次へ。

- [ ] **Step 5: Commit eval artifacts**

```bash
git add .eval/v1.3.0/
git commit -m "test: visual sweep v1.3.0 — 6 reqType + 7 reltype all rendered"
```

---

## Task 20: IEC 61508 風実用シナリオ MCP 検証

**Files:**
- Create: `.eval/v1.3.0/usecase-iec61508/`

- [ ] **Step 1: シナリオ仕様**

「ECU ファームの IEC 61508 風安全要件管理」シナリオを property panel から完成させる:

- 4 requirement: `over_current_stop` (functionalRequirement / risk:high / verifymethod:test), `detection_time` (performanceRequirement / risk:high / verifymethod:test), `self_diagnosis` (functionalRequirement / risk:medium / verifymethod:inspection), `safe_mode_transition` (functionalRequirement / risk:high / verifymethod:test)
- 2 element: `ecu_firmware` (type: code module, docref: src/ecu.c), `safety_test_suite` (type: test suite)
- 5 relations: `ecu_firmware - satisfies -> over_current_stop`, `ecu_firmware - satisfies -> detection_time`, `over_current_stop - derives -> safe_mode_transition`, `safety_test_suite - verifies -> over_current_stop`, `over_current_stop - refines -> self_diagnosis`

- [ ] **Step 2: evaluator agent で検証**

`evaluator` agent を呼び出し:
- `127.0.0.1:8765/mermaid-assist.html` でシナリオを property panel から完成 (上記4+2+5)
- 各要素追加後にスクリーンショット
- 完成後の最終 SVG / mmd を保存
- console error 0、`mermaid.parse()` 通過 を確認
- 結果を `.eval/v1.3.0/usecase-iec61508/report.md` に PASS/FAIL 判定

- [ ] **Step 3: Commit eval artifacts**

```bash
git add .eval/v1.3.0/usecase-iec61508/
git commit -m "test: IEC 61508-style safety requirement scenario PASS"
```

---

## Task 21: バージョン上げ + ECN-014 + master マージ + tag

**Files:**
- Create: `docs/ecn/ECN-014_tier2-phase1-requirement.md`
- Modify: `docs/ecn/README.md` (テーブル追記)
- Modify: package.json or version reference (Tier1 慣習に従う、なければスキップ)

- [ ] **Step 1: ECN-014 作成**

`docs/ecn/ECN-014_tier2-phase1-requirement.md`:

```markdown
# ECN-014: Tier2 Phase 1 — Requirement Diagram 対応

- **ステータス**: 適用済
- **種別**: 機能追加
- **バージョン**: v1.3.0
- **対象コミット**: (Task実装の全コミット)
- **影響ファイル**: `src/modules/requirement.js`, `src/core/parser-utils.js`, `mermaid-assist.html`, `tests/requirement-*.test.js`, `tests/e2e/requirement-basic.spec.js`, `tests/run-tests.js`
- **関連ADR**: ADR-011, ADR-012, ADR-014, ADR-015, ADR-016

## コンテキスト

Tier2 ロードマップ (`2026-04-16-tier2-diagrams-design.md`) Phase 1。組み込み実務 (IEC 61508 等の安全規格) で要件管理・トレーサビリティに使用される Mermaid Requirement Diagram を Tier1 同等の操作粒度で対応する。

## 対策

DiagramModule v2 で実装。ER モジュール骨格を流用:

- **コア要素**: 6 reqType (`requirement` / `functionalRequirement` / `interfaceRequirement` / `performanceRequirement` / `physicalRequirement` / `designConstraint`)
- **element**: type (自由テキスト) / docref (任意)
- **relation 7種**: contains / copies / derives / satisfies / verifies / refines / traces
- **operations**: add / delete (cascade) / update / updateName (relation参照追従) / moveUp/Down / connect (Connection Mode 流用)
- **UI**: 縦並びラベル付き追加フォーム (ECN-013 / ADR-015 準拠)

system-tester で 42 REQ / 42 EV / 42 TC、カバレッジ 100% / 禁止語 0 を確保 (ADR-016)。

## 結果

- 約 25 unit + 11 E2E 追加、合計 〜140 unit + 〜144 E2E 全 PASS
- visual sweep PASS (6 reqType + 7 reltype 全描画、console error 0)
- IEC 61508 シナリオ MCP 検証 PASS (4 requirement + 2 element + 5 relation)
- v1.3.0 リリース、Tier2 Phase 1 完了

教訓: (実装で発見された設計判断・教訓を後追記)
```

- [ ] **Step 2: ECN README 追記**

`docs/ecn/README.md` の表に行追加:

```markdown
| ECN-014 | Tier2 Phase 1 — Requirement Diagram | 機能追加 | v1.3.0 | 適用済 |
```

- [ ] **Step 3: PR-ready 確認 + merge**

```bash
git checkout master
git merge --no-ff tier2/phase1-requirement -m "Merge tier2/phase1-requirement: Requirement Diagram (v1.3.0)"
git tag -a v1.3.0 -m "v1.3.0: Tier2 Phase 1 — Requirement Diagram"
```

- [ ] **Step 4: ECN コミット + tag push**

```bash
git add docs/ecn/ECN-014_tier2-phase1-requirement.md docs/ecn/README.md
git commit -m "docs: ECN-014 Tier2 Phase 1 Requirement Diagram (v1.3.0)"
git push origin master
git push origin v1.3.0
```

- [ ] **Step 5: 完了確認**

GitHub の master + tag v1.3.0 を確認、Phase 1 完了。

---

## Self-Review チェックリスト (実装側ではなく Plan 作成者用)

- [x] Spec coverage: 6 reqType (Task 3), element (Task 4, 7, 15), 7 reltype (Task 5, 8), all operations (Task 6-12, 17), property panel (Task 13-16), HTML 配線 (Task 17), E2E (Task 18), visual sweep (Task 19), 実用シナリオ (Task 20), ECN/release (Task 21) — すべての spec 要素にタスクあり
- [x] Placeholder scan: TBD/TODO 無し、全コードブロック完全
- [x] Type consistency: `name`, `reqType`, `reltype`, `line` などのプロパティ名は parse output で定義したものを後続タスクで一貫使用
