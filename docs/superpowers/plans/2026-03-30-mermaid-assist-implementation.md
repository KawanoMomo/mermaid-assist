# MermaidAssist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file HTML Gantt chart editor that renders Mermaid syntax via mermaid.js and allows GUI manipulation through a transparent SVG overlay layer.

**Architecture:** Mermaid text is the source of truth. A custom parser extracts structured data for the property panel and overlay. mermaid.js renders the SVG preview. A transparent overlay layer on top of the SVG provides drag/resize interactions. All GUI operations write back to the Mermaid text via regex-based updaters (ADR-006 write-time normalization).

**Tech Stack:** Vanilla JS (no frameworks), mermaid.js (MIT, local bundle), HTML5/CSS3, SVG

---

## File Structure

```
05_MermaidAssist/
├── mermaid-assist.html          # Single-file app (all JS/CSS/HTML)
├── lib/
│   └── mermaid.min.js           # mermaid.js v11 bundle (MIT license)
├── CLAUDE.md                    # Dev guide
├── VERSION                      # Version string
├── LICENSE                      # MIT + mermaid.js attribution
├── .gitignore
├── docs/
│   └── ecn/                     # Engineering Change Notices (empty initially)
└── tests/
    ├── run-tests.js             # Node.js test runner (extracts fns from HTML)
    ├── gantt-parser.test.js     # Parser unit tests
    └── gantt-updater.test.js    # Text updater unit tests
```

**Key design decisions:**
- `mermaid-assist.html` contains ALL application JS inside a single `<script>` block. Pure functions (parser, updater, helpers) are extracted by the test runner for Node.js testing.
- `lib/mermaid.min.js` is loaded via `<script src>` — not inlined — to keep the HTML readable and allow independent mermaid.js updates.
- Tests follow StableBlock's pattern: `run-tests.js` reads the HTML, extracts the `<script>` block, evaluates it in a sandbox, and exposes pure functions to test files.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `CLAUDE.md`
- Create: `VERSION`
- Create: `LICENSE`
- Create: `.gitignore`
- Create: `lib/mermaid.min.js` (downloaded)
- Create: `docs/ecn/.gitkeep`

- [ ] **Step 1: Create CLAUDE.md**

```markdown
# CLAUDE.md

## プロジェクト概要

MermaidAssist — Mermaid記法のGUI編集ツール。Mermaidテキストをソースオブトゥルースとし、GUIで直感的に編集可能。初回リリースはガントチャートに対応。

## 技術スタック

- 単一HTMLファイル（mermaid-assist.html）
- バニラJS（フレームワーク無し）
- mermaid.js v11（lib/mermaid.min.js、MITライセンス）
- SVGオーバーレイ層によるインタラクション

## アーキテクチャ

- Mermaidテキスト → 独自パーサー → 構造化データ → プロパティパネル
- Mermaidテキスト → mermaid.js → SVG → オーバーレイ層 → ドラッグ操作
- GUI操作 → Regex Updater → Mermaidテキスト書き戻し
- 図種モジュール構造（DiagramModule）で拡張可能

## 開発コマンド

- テスト実行: `node tests/run-tests.js`
- ブラウザ確認: `mermaid-assist.html` をブラウザで開く

## 設計ドキュメント

- 設計仕様書: `docs/superpowers/specs/2026-03-30-mermaid-assist-design.md`
- 実装計画: `docs/superpowers/plans/2026-03-30-mermaid-assist-implementation.md`
- ADR: `E:\00_Git\docs\adr\` (ワークスペース共通)
```

- [ ] **Step 2: Create VERSION and LICENSE**

VERSION:
```
0.1.0
```

LICENSE:
```
MIT License

Copyright (c) 2026 Kawano Momo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

This software includes mermaid.js, Copyright (c) 2014-2022 Knut Sveidqvist,
licensed under the MIT License. See https://github.com/mermaid-js/mermaid
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
.superpowers/
*.log
```

- [ ] **Step 4: Download mermaid.js to lib/**

```bash
mkdir -p lib
npm pack mermaid@11 --pack-destination /tmp
tar -xzf /tmp/mermaid-11.*.tgz -C /tmp
cp /tmp/package/dist/mermaid.min.js lib/mermaid.min.js
rm -rf /tmp/mermaid-11.*.tgz /tmp/package
```

If npm is unavailable, download directly:
```bash
curl -L "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js" -o lib/mermaid.min.js
```

- [ ] **Step 5: Create docs/ecn/.gitkeep**

```bash
mkdir -p docs/ecn
touch docs/ecn/.gitkeep
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md VERSION LICENSE .gitignore lib/mermaid.min.js docs/ecn/.gitkeep
git commit -m "chore: project scaffolding with mermaid.js bundle"
```

---

### Task 2: Test Runner Infrastructure

**Files:**
- Create: `tests/run-tests.js`

- [ ] **Step 1: Create test runner**

`tests/run-tests.js` — extracts pure functions from `mermaid-assist.html`'s `<script>` block and provides a minimal test framework:

```javascript
'use strict';
const fs = require('fs');
const path = require('path');

// ── Extract functions from HTML ──
const htmlPath = path.resolve(__dirname, '..', 'mermaid-assist.html');
let htmlSrc;
try {
  htmlSrc = fs.readFileSync(htmlPath, 'utf-8');
} catch (e) {
  console.log('mermaid-assist.html not found yet — skipping extraction');
  htmlSrc = '';
}

let fns = {};
if (htmlSrc) {
  const m = htmlSrc.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    // Stub browser globals so the script can be evaluated in Node
    const sandbox = {
      document: { addEventListener: () => {}, getElementById: () => null, querySelector: () => null, createElement: () => ({ style: {}, addEventListener: () => {} }) },
      window: { addEventListener: () => {} },
      mermaid: { initialize: () => {}, render: async () => ({ svg: '' }) },
      localStorage: { getItem: () => null, setItem: () => {} },
      navigator: { clipboard: { write: async () => {} } },
      requestAnimationFrame: (cb) => cb(),
      setTimeout: (cb) => cb(),
      clearTimeout: () => {},
      alert: () => {},
      confirm: () => true,
      Blob: class { constructor() {} },
      URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
      File: class { constructor() {} },
      FileReader: class { readAsText() {} },
      ClipboardItem: class { constructor() {} },
      HTMLElement: class {},
      Image: class { set onload(fn) { fn && fn(); } set src(v) {} get width() { return 100; } get height() { return 100; } },
      // Expose collected functions
      __exportForTest: (obj) => { fns = obj; },
    };
    const keys = Object.keys(sandbox);
    const vals = keys.map(k => sandbox[k]);
    try {
      const fn = new Function(...keys, m[1]);
      fn(...vals);
    } catch (e) {
      console.error('Script eval error:', e.message);
    }
  }
}

// Make fns global for test files
global.fns = fns;

// ── Minimal test framework ──
let passed = 0, failed = 0, currentDescribe = '';

global.describe = function(name, fn) {
  currentDescribe = name;
  console.log(`\n  ${name}`);
  fn();
  currentDescribe = '';
};

global.test = function(name, fn) {
  try {
    fn();
    passed++;
    console.log(`    ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`    ✗ ${name}`);
    console.log(`      ${e.message}`);
  }
};

global.expect = function(actual) {
  const assert = {
    toBe(expected) {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual(expected) {
      const a = JSON.stringify(actual), b = JSON.stringify(expected);
      if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
    },
    toBeDefined() {
      if (actual === undefined) throw new Error('Expected defined, got undefined');
    },
    toBeGreaterThan(n) {
      if (!(actual > n)) throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeLessThan(n) {
      if (!(actual < n)) throw new Error(`Expected ${actual} < ${n}`);
    },
    toContain(item) {
      if (Array.isArray(actual)) {
        if (!actual.includes(item)) throw new Error(`Array does not contain ${JSON.stringify(item)}`);
      } else if (typeof actual === 'string') {
        if (!actual.includes(item)) throw new Error(`String does not contain "${item}"`);
      }
    },
    not: {
      toBe(expected) { if (actual === expected) throw new Error(`Expected not ${JSON.stringify(expected)}`); },
      toBeNull() { if (actual === null) throw new Error('Expected not null'); },
      toContain(item) {
        if (typeof actual === 'string' && actual.includes(item)) throw new Error(`String should not contain "${item}"`);
        if (Array.isArray(actual) && actual.includes(item)) throw new Error(`Array should not contain ${JSON.stringify(item)}`);
      },
    },
  };
  return assert;
};

// ── Run test files ──
const testFiles = process.argv.slice(2);
const files = testFiles.length > 0
  ? testFiles.map(f => path.resolve(f))
  : fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.test.js'))
      .map(f => path.join(__dirname, f));

for (const f of files) {
  console.log(`\n── ${path.basename(f)} ──`);
  require(f);
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Verify runner loads without errors (no HTML yet)**

```bash
node tests/run-tests.js
```

Expected: prints "mermaid-assist.html not found yet — skipping extraction" then "0 passed, 0 failed" with exit code 0.

- [ ] **Step 3: Commit**

```bash
git add tests/run-tests.js
git commit -m "chore: add test runner infrastructure"
```

---

### Task 3: Gantt Parser (TDD)

**Files:**
- Create: `tests/gantt-parser.test.js`
- Create: `mermaid-assist.html` (initial — just a `<script>` block with parser + export hook)

The parser is a pure function `parseGantt(text) → ParsedData`. It lives inside `mermaid-assist.html`'s `<script>` and is exported via `__exportForTest`.

- [ ] **Step 1: Write failing parser tests**

`tests/gantt-parser.test.js`:

```javascript
'use strict';
const { parseGantt } = fns;

describe('parseGantt — metadata', function() {
  test('parses title', function() {
    const r = parseGantt('gantt\n    title My Project\n');
    expect(r.title).toBe('My Project');
  });

  test('parses dateFormat', function() {
    const r = parseGantt('gantt\n    dateFormat YYYY-MM-DD\n');
    expect(r.dateFormat).toBe('YYYY-MM-DD');
  });

  test('parses axisFormat', function() {
    const r = parseGantt('gantt\n    axisFormat %m/%d\n');
    expect(r.axisFormat).toBe('%m/%d');
  });

  test('defaults dateFormat to YYYY-MM-DD', function() {
    const r = parseGantt('gantt\n');
    expect(r.dateFormat).toBe('YYYY-MM-DD');
  });
});

describe('parseGantt — sections', function() {
  test('parses section names with line numbers', function() {
    const text = 'gantt\n    title T\n\n    section Alpha\n    section Beta\n';
    const r = parseGantt(text);
    expect(r.sections.length).toBe(2);
    expect(r.sections[0].name).toBe('Alpha');
    expect(r.sections[0].line).toBe(4);
    expect(r.sections[1].name).toBe('Beta');
    expect(r.sections[1].line).toBe(5);
  });

  test('handles no sections', function() {
    const text = 'gantt\n    title T\n    Task A :a1, 2026-04-01, 2026-04-10\n';
    const r = parseGantt(text);
    expect(r.sections.length).toBe(0);
    expect(r.tasks.length).toBe(1);
    expect(r.tasks[0].sectionIndex).toBe(-1);
  });
});

describe('parseGantt — tasks', function() {
  test('parses id, startDate, endDate', function() {
    const text = 'gantt\n    section S\n    Task A :a1, 2026-04-01, 2026-04-15\n';
    const r = parseGantt(text);
    expect(r.tasks.length).toBe(1);
    const t = r.tasks[0];
    expect(t.id).toBe('a1');
    expect(t.label).toBe('Task A');
    expect(t.startDate).toBe('2026-04-01');
    expect(t.endDate).toBe('2026-04-15');
    expect(t.after).toBeNull();
    expect(t.status).toBeNull();
    expect(t.line).toBe(3);
    expect(t.sectionIndex).toBe(0);
  });

  test('parses status + id + dates', function() {
    const text = 'gantt\n    section S\n    Coding :crit, c1, 2026-05-10, 2026-06-10\n';
    const r = parseGantt(text);
    const t = r.tasks[0];
    expect(t.status).toBe('crit');
    expect(t.id).toBe('c1');
    expect(t.startDate).toBe('2026-05-10');
    expect(t.endDate).toBe('2026-06-10');
  });

  test('parses done status', function() {
    const text = 'gantt\n    section S\n    Done Task :done, d1, 2026-01-01, 2026-01-10\n';
    const r = parseGantt(text);
    expect(r.tasks[0].status).toBe('done');
  });

  test('parses active status', function() {
    const text = 'gantt\n    section S\n    Active Task :active, x1, 2026-01-01, 2026-01-10\n';
    const r = parseGantt(text);
    expect(r.tasks[0].status).toBe('active');
  });

  test('parses after dependency', function() {
    const text = 'gantt\n    section S\n    Task A :a1, 2026-04-01, 2026-04-10\n    Task B :b1, after a1, 2026-04-20\n';
    const r = parseGantt(text);
    const t = r.tasks[1];
    expect(t.id).toBe('b1');
    expect(t.after).toBe('a1');
    expect(t.startDate).toBeNull();
    expect(t.endDate).toBe('2026-04-20');
  });

  test('parses status + after', function() {
    const text = 'gantt\n    section S\n    Task A :a1, 2026-04-01, 2026-04-10\n    Task B :crit, b1, after a1, 2026-04-20\n';
    const r = parseGantt(text);
    const t = r.tasks[1];
    expect(t.status).toBe('crit');
    expect(t.after).toBe('a1');
  });

  test('parses duration format', function() {
    const text = 'gantt\n    section S\n    Task A :a1, 2026-04-01, 30d\n';
    const r = parseGantt(text);
    const t = r.tasks[0];
    expect(t.startDate).toBe('2026-04-01');
    expect(t.endDate).toBe('30d');
  });

  test('auto-generates ID for tasks without explicit ID', function() {
    const text = 'gantt\n    section S\n    Task A :2026-04-01, 2026-04-10\n';
    const r = parseGantt(text);
    const t = r.tasks[0];
    expect(t.id).toContain('__auto_');
    expect(t.startDate).toBe('2026-04-01');
    expect(t.endDate).toBe('2026-04-10');
  });

  test('assigns correct sectionIndex across multiple sections', function() {
    const text = [
      'gantt',
      '    section A',
      '    T1 :t1, 2026-01-01, 2026-01-10',
      '    section B',
      '    T2 :t2, 2026-02-01, 2026-02-10',
      '    T3 :t3, 2026-03-01, 2026-03-10',
    ].join('\n');
    const r = parseGantt(text);
    expect(r.tasks[0].sectionIndex).toBe(0);
    expect(r.tasks[1].sectionIndex).toBe(1);
    expect(r.tasks[2].sectionIndex).toBe(1);
  });

  test('line numbers are 1-based and accurate', function() {
    const text = [
      'gantt',            // 1
      '    title T',      // 2
      '',                 // 3
      '    section S',    // 4
      '    A :a1, 2026-01-01, 2026-01-10',  // 5
      '    B :b1, 2026-02-01, 2026-02-10',  // 6
    ].join('\n');
    const r = parseGantt(text);
    expect(r.tasks[0].line).toBe(5);
    expect(r.tasks[1].line).toBe(6);
    expect(r.sections[0].line).toBe(4);
  });
});

describe('parseGantt — edge cases', function() {
  test('empty input returns empty structure', function() {
    const r = parseGantt('');
    expect(r.title).toBe('');
    expect(r.sections.length).toBe(0);
    expect(r.tasks.length).toBe(0);
  });

  test('gantt keyword only', function() {
    const r = parseGantt('gantt\n');
    expect(r.title).toBe('');
    expect(r.tasks.length).toBe(0);
  });

  test('ignores comment lines', function() {
    const text = 'gantt\n    %% this is a comment\n    title T\n';
    const r = parseGantt(text);
    expect(r.title).toBe('T');
  });

  test('handles Japanese labels', function() {
    const text = 'gantt\n    section 要件定義\n    要件分析 :a1, 2026-04-01, 2026-04-15\n';
    const r = parseGantt(text);
    expect(r.sections[0].name).toBe('要件定義');
    expect(r.tasks[0].label).toBe('要件分析');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node tests/run-tests.js tests/gantt-parser.test.js
```

Expected: All tests FAIL because `parseGantt` is not defined in `fns`.

- [ ] **Step 3: Create initial mermaid-assist.html with parser implementation**

Create `mermaid-assist.html` with only the `<script>` block containing the parser:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>MermaidAssist</title>
</head>
<body>
<script>
'use strict';

// ══════════════════════════════════════════════
//  Gantt Parser
// ══════════════════════════════════════════════

var STATUS_KEYWORDS = ['done', 'active', 'crit'];
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
var DURATION_RE = /^\d+[dwmyhMs]$/;

function isDate(s) { return DATE_RE.test(s); }
function isDuration(s) { return DURATION_RE.test(s); }
function isAfter(s) { return s.startsWith('after '); }

function parseGantt(text) {
  var result = {
    title: '',
    dateFormat: 'YYYY-MM-DD',
    axisFormat: '',
    sections: [],
    tasks: [],
  };
  if (!text || !text.trim()) return result;

  var lines = text.split('\n');
  var currentSectionIndex = -1;
  var autoId = 0;

  for (var i = 0; i < lines.length; i++) {
    var lineNum = i + 1;  // 1-based
    var raw = lines[i];
    var trimmed = raw.trim();

    // Skip empty, comments, or the gantt keyword
    if (!trimmed || trimmed === 'gantt' || trimmed.startsWith('%%')) continue;

    // Metadata directives
    if (trimmed.startsWith('title ')) {
      result.title = trimmed.substring(6).trim();
      continue;
    }
    if (trimmed.startsWith('dateFormat ')) {
      result.dateFormat = trimmed.substring(11).trim();
      continue;
    }
    if (trimmed.startsWith('axisFormat ')) {
      result.axisFormat = trimmed.substring(11).trim();
      continue;
    }
    if (trimmed.startsWith('excludes ') || trimmed.startsWith('todayMarker ')) {
      continue;  // acknowledged but not stored for editing
    }

    // Section
    if (trimmed.startsWith('section ')) {
      result.sections.push({ name: trimmed.substring(8).trim(), line: lineNum });
      currentSectionIndex = result.sections.length - 1;
      continue;
    }

    // Task line: "Label :metadata"
    var colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;  // not a task line

    var label = trimmed.substring(0, colonIdx).trim();
    var metaStr = trimmed.substring(colonIdx + 1).trim();
    var parts = metaStr.split(',').map(function(s) { return s.trim(); }).filter(Boolean);

    var task = {
      id: null,
      label: label,
      status: null,
      startDate: null,
      endDate: null,
      after: null,
      line: lineNum,
      sectionIndex: currentSectionIndex,
    };

    // Parse metadata parts in order
    var idx = 0;

    // 1) Status keyword (first position)
    if (idx < parts.length && STATUS_KEYWORDS.indexOf(parts[idx]) !== -1) {
      task.status = parts[idx];
      idx++;
    }

    // 2) ID — not a date, not a duration, not "after ..."
    if (idx < parts.length && !isDate(parts[idx]) && !isDuration(parts[idx]) && !isAfter(parts[idx])) {
      task.id = parts[idx];
      idx++;
    }

    // 3) Start — either a date or "after id"
    if (idx < parts.length) {
      if (isAfter(parts[idx])) {
        task.after = parts[idx].substring(6).trim();
        idx++;
      } else if (isDate(parts[idx])) {
        task.startDate = parts[idx];
        idx++;
      }
    }

    // 4) End — date or duration
    if (idx < parts.length) {
      task.endDate = parts[idx];
      idx++;
    }

    // Auto-generate ID if not specified
    if (!task.id) {
      autoId++;
      task.id = '__auto_' + autoId;
    }

    result.tasks.push(task);
  }

  return result;
}

// ══════════════════════════════════════════════
//  Test export hook
// ══════════════════════════════════════════════
if (typeof __exportForTest === 'function') {
  __exportForTest({ parseGantt: parseGantt });
}

</script>
</body>
</html>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node tests/run-tests.js tests/gantt-parser.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/gantt-parser.test.js mermaid-assist.html
git commit -m "feat: gantt parser with TDD — parse metadata, sections, tasks, line numbers"
```

---

### Task 4: Gantt Text Updater (TDD)

**Files:**
- Create: `tests/gantt-updater.test.js`
- Modify: `mermaid-assist.html` (add updater functions + extend export)

The updater is a set of pure functions that take Mermaid text + a change descriptor and return updated text. All mutations use line-number matching (ADR-003).

- [ ] **Step 1: Write failing updater tests**

`tests/gantt-updater.test.js`:

```javascript
'use strict';
var updateTaskDates = fns.updateTaskDates;
var updateTaskField = fns.updateTaskField;
var addTask         = fns.addTask;
var deleteTask      = fns.deleteTask;
var parseGantt      = fns.parseGantt;

describe('updateTaskDates', function() {
  var base = [
    'gantt',
    '    title T',
    '    dateFormat YYYY-MM-DD',
    '    section S',
    '    Task A :a1, 2026-04-01, 2026-04-15',
  ].join('\n');

  test('updates start date by line number', function() {
    var out = updateTaskDates(base, 5, '2026-05-01', null);
    expect(out).toContain(':a1, 2026-05-01, 2026-04-15');
  });

  test('updates end date by line number', function() {
    var out = updateTaskDates(base, 5, null, '2026-05-15');
    expect(out).toContain(':a1, 2026-04-01, 2026-05-15');
  });

  test('updates both dates', function() {
    var out = updateTaskDates(base, 5, '2026-06-01', '2026-06-30');
    expect(out).toContain(':a1, 2026-06-01, 2026-06-30');
  });

  test('converts after-based task to explicit dates', function() {
    var text = [
      'gantt',
      '    section S',
      '    Task A :a1, 2026-04-01, 2026-04-10',
      '    Task B :b1, after a1, 2026-04-20',
    ].join('\n');
    var out = updateTaskDates(text, 4, '2026-04-12', '2026-04-25');
    expect(out).toContain(':b1, 2026-04-12, 2026-04-25');
    expect(out).not.toContain('after');
  });

  test('preserves status keyword when updating dates', function() {
    var text = 'gantt\n    section S\n    C :crit, c1, 2026-05-01, 2026-06-01\n';
    var out = updateTaskDates(text, 3, '2026-07-01', '2026-08-01');
    expect(out).toContain(':crit, c1, 2026-07-01, 2026-08-01');
  });
});

describe('updateTaskField', function() {
  var base = [
    'gantt',
    '    section S',
    '    Task A :a1, 2026-04-01, 2026-04-15',
  ].join('\n');

  test('updates label', function() {
    var out = updateTaskField(base, 3, 'label', 'New Name');
    expect(out).toContain('New Name :a1,');
  });

  test('updates status from null to crit', function() {
    var out = updateTaskField(base, 3, 'status', 'crit');
    expect(out).toContain(':crit, a1, 2026-04-01, 2026-04-15');
  });

  test('removes status by setting to null', function() {
    var text = 'gantt\n    section S\n    T :crit, a1, 2026-04-01, 2026-04-15\n';
    var out = updateTaskField(text, 3, 'status', null);
    expect(out).toContain(':a1, 2026-04-01, 2026-04-15');
    expect(out).not.toContain('crit');
  });

  test('updates id', function() {
    var out = updateTaskField(base, 3, 'id', 'newId');
    expect(out).toContain(':newId, 2026-04-01, 2026-04-15');
  });
});

describe('addTask', function() {
  test('adds task at end of section', function() {
    var text = [
      'gantt',
      '    section Alpha',
      '    T1 :t1, 2026-01-01, 2026-01-10',
      '    section Beta',
      '    T2 :t2, 2026-02-01, 2026-02-10',
    ].join('\n');
    var out = addTask(text, 0, 'New Task', 'n1', '2026-01-15', '2026-01-20');
    expect(out).toContain('New Task :n1, 2026-01-15, 2026-01-20');
    // Should be inserted after T1 (line 3) and before section Beta (line 4)
    var lines = out.split('\n');
    var newLine = lines.findIndex(function(l) { return l.includes('New Task'); });
    var betaLine = lines.findIndex(function(l) { return l.includes('section Beta'); });
    expect(newLine).toBeLessThan(betaLine);
  });

  test('adds task when no sections exist', function() {
    var text = 'gantt\n    title T\n';
    var out = addTask(text, -1, 'Solo Task', 's1', '2026-01-01', '2026-01-10');
    expect(out).toContain('Solo Task :s1, 2026-01-01, 2026-01-10');
  });
});

describe('deleteTask', function() {
  test('removes task line by line number', function() {
    var text = [
      'gantt',
      '    section S',
      '    T1 :t1, 2026-01-01, 2026-01-10',
      '    T2 :t2, 2026-02-01, 2026-02-10',
    ].join('\n');
    var out = deleteTask(text, 3);
    expect(out).not.toContain('T1');
    expect(out).toContain('T2');
  });
});

describe('round-trip: parse → update → re-parse', function() {
  test('dates survive round-trip', function() {
    var text = [
      'gantt',
      '    dateFormat YYYY-MM-DD',
      '    section S',
      '    Task A :a1, 2026-04-01, 2026-04-15',
    ].join('\n');
    var updated = updateTaskDates(text, 4, '2026-05-01', '2026-05-20');
    var r = parseGantt(updated);
    expect(r.tasks[0].startDate).toBe('2026-05-01');
    expect(r.tasks[0].endDate).toBe('2026-05-20');
    expect(r.tasks[0].id).toBe('a1');
  });

  test('field update survives round-trip', function() {
    var text = [
      'gantt',
      '    section S',
      '    Old Name :a1, 2026-04-01, 2026-04-15',
    ].join('\n');
    var updated = updateTaskField(text, 3, 'label', 'New Name');
    var r = parseGantt(updated);
    expect(r.tasks[0].label).toBe('New Name');
    expect(r.tasks[0].id).toBe('a1');
  });

  test('add + parse round-trip', function() {
    var text = 'gantt\n    section S\n    T1 :t1, 2026-01-01, 2026-01-10\n';
    var updated = addTask(text, 0, 'T2', 't2', '2026-02-01', '2026-02-15');
    var r = parseGantt(updated);
    expect(r.tasks.length).toBe(2);
    expect(r.tasks[1].id).toBe('t2');
    expect(r.tasks[1].label).toBe('T2');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node tests/run-tests.js tests/gantt-updater.test.js
```

Expected: All tests FAIL because updater functions are not yet in `fns`.

- [ ] **Step 3: Implement updater functions in mermaid-assist.html**

Add these functions **before** the `__exportForTest` call in `mermaid-assist.html`:

```javascript
// ══════════════════════════════════════════════
//  Gantt Text Updater (ADR-003: line-number based, ADR-006: write-time normalization)
// ══════════════════════════════════════════════

function rebuildTaskMeta(status, id, startDate, endDate, after) {
  var parts = [];
  if (status) parts.push(status);
  if (id && !id.startsWith('__auto_')) parts.push(id);
  if (after) {
    parts.push('after ' + after);
  } else if (startDate) {
    parts.push(startDate);
  }
  if (endDate) parts.push(endDate);
  return parts.join(', ');
}

function parseTaskLine(line) {
  var colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;
  var label = line.substring(0, colonIdx).trim();
  var indent = line.match(/^(\s*)/)[1];
  var metaStr = line.substring(colonIdx + 1).trim();
  var parts = metaStr.split(',').map(function(s) { return s.trim(); }).filter(Boolean);

  var status = null, id = null, startDate = null, endDate = null, after = null;
  var idx = 0;

  if (idx < parts.length && STATUS_KEYWORDS.indexOf(parts[idx]) !== -1) {
    status = parts[idx]; idx++;
  }
  if (idx < parts.length && !isDate(parts[idx]) && !isDuration(parts[idx]) && !isAfter(parts[idx])) {
    id = parts[idx]; idx++;
  }
  if (idx < parts.length) {
    if (isAfter(parts[idx])) { after = parts[idx].substring(6).trim(); idx++; }
    else if (isDate(parts[idx])) { startDate = parts[idx]; idx++; }
  }
  if (idx < parts.length) { endDate = parts[idx]; idx++; }

  return { label: label, indent: indent, status: status, id: id, startDate: startDate, endDate: endDate, after: after };
}

function updateTaskDates(text, lineNum, newStart, newEnd) {
  var lines = text.split('\n');
  var lineIdx = lineNum - 1;
  if (lineIdx < 0 || lineIdx >= lines.length) return text;

  var p = parseTaskLine(lines[lineIdx]);
  if (!p) return text;

  var startDate = newStart !== null ? newStart : p.startDate;
  var endDate = newEnd !== null ? newEnd : p.endDate;
  // When setting explicit start date, clear 'after' dependency
  var after = newStart !== null ? null : p.after;

  var meta = rebuildTaskMeta(p.status, p.id, startDate, endDate, after);
  lines[lineIdx] = p.indent + p.label + ' :' + meta;
  return lines.join('\n');
}

function updateTaskField(text, lineNum, field, value) {
  var lines = text.split('\n');
  var lineIdx = lineNum - 1;
  if (lineIdx < 0 || lineIdx >= lines.length) return text;

  var p = parseTaskLine(lines[lineIdx]);
  if (!p) return text;

  if (field === 'label') {
    p.label = value;
  } else if (field === 'status') {
    p.status = value;
  } else if (field === 'id') {
    p.id = value;
  }

  var meta = rebuildTaskMeta(p.status, p.id, p.startDate, p.endDate, p.after);
  lines[lineIdx] = p.indent + p.label + ' :' + meta;
  return lines.join('\n');
}

function addTask(text, sectionIndex, label, id, startDate, endDate) {
  var lines = text.split('\n');
  var insertIdx = lines.length;  // default: end of file

  if (sectionIndex >= 0) {
    // Find the end of the target section
    var sectionCount = -1;
    var sectionStart = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('section ')) {
        sectionCount++;
        if (sectionCount === sectionIndex) sectionStart = i;
        else if (sectionCount === sectionIndex + 1) { insertIdx = i; break; }
      }
    }
    if (insertIdx === lines.length && sectionStart >= 0) {
      // Last section — insert at end
      insertIdx = lines.length;
    }
  }

  var indent = '    ';
  var meta = rebuildTaskMeta(null, id, startDate, endDate, null);
  var newLine = indent + label + ' :' + meta;
  lines.splice(insertIdx, 0, newLine);
  return lines.join('\n');
}

function deleteTask(text, lineNum) {
  var lines = text.split('\n');
  var lineIdx = lineNum - 1;
  if (lineIdx < 0 || lineIdx >= lines.length) return text;
  lines.splice(lineIdx, 1);
  return lines.join('\n');
}
```

Update the `__exportForTest` call:

```javascript
if (typeof __exportForTest === 'function') {
  __exportForTest({
    parseGantt: parseGantt,
    updateTaskDates: updateTaskDates,
    updateTaskField: updateTaskField,
    addTask: addTask,
    deleteTask: deleteTask,
  });
}
```

- [ ] **Step 4: Run all tests**

```bash
node tests/run-tests.js
```

Expected: All tests in both `gantt-parser.test.js` and `gantt-updater.test.js` PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/gantt-updater.test.js mermaid-assist.html
git commit -m "feat: gantt text updater with TDD — date/field update, add/delete tasks"
```

---

### Task 5: HTML Shell — 3-Pane Layout

**Files:**
- Modify: `mermaid-assist.html` (add full HTML structure, CSS, toolbar)

This task builds the complete visual shell: toolbar, 3-pane layout, status bar, dark theme CSS. No interactivity yet — just the DOM structure.

- [ ] **Step 1: Replace the HTML skeleton with full layout**

Replace everything in `mermaid-assist.html` **outside** the `<script>` block. Keep the existing `<script>` block with parser + updater intact. The new HTML structure:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MermaidAssist</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
<style>
/* ── Reset & Base ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --border: #30363d;
  --text-primary: #c9d1d9;
  --text-secondary: #8b949e;
  --text-muted: #484f58;
  --accent: #7c8cf8;
  --accent-green: #7ee787;
  --accent-red: #f74a4a;
  --accent-orange: #ffa657;
  --font-mono: 'IBM Plex Mono', monospace;
  --font-sans: 'Noto Sans JP', sans-serif;
}
html, body { height: 100%; overflow: hidden; background: var(--bg-primary); color: var(--text-primary); font-family: var(--font-sans); font-size: 13px; }

/* ── App Layout ── */
#app { display: flex; flex-direction: column; height: 100vh; }

/* ── Toolbar ── */
#toolbar {
  display: flex; align-items: center; gap: 6px; padding: 4px 12px;
  background: var(--bg-secondary); border-bottom: 1px solid var(--border);
  font-size: 12px; flex-shrink: 0;
}
#toolbar .logo { color: var(--accent); font-weight: bold; font-family: var(--font-mono); }
#toolbar .sep { color: var(--text-muted); user-select: none; }
#toolbar button {
  background: none; border: 1px solid var(--border); color: var(--text-primary);
  padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; font-family: var(--font-sans);
}
#toolbar button:hover { background: var(--bg-tertiary); }
#toolbar .zoom-display {
  background: var(--bg-tertiary); padding: 2px 8px; border-radius: 3px;
  min-width: 44px; text-align: center; font-family: var(--font-mono);
}
#toolbar .diagram-type {
  margin-left: auto;
  background: var(--bg-tertiary); padding: 2px 8px; border-radius: 3px;
  color: var(--accent-green); font-family: var(--font-mono);
}
.export-wrap { position: relative; }
.export-menu {
  display: none; position: absolute; top: 100%; left: 0; z-index: 100;
  background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 4px;
  min-width: 180px; padding: 4px 0; margin-top: 2px;
}
.export-menu.open { display: block; }
.export-menu button { display: block; width: 100%; text-align: left; border: none; padding: 6px 12px; }

/* ── Main Panes ── */
#main { display: flex; flex: 1; overflow: hidden; }

/* Editor */
#editor-pane {
  width: 30%; min-width: 200px; border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
}
#editor-pane .pane-header {
  padding: 4px 8px; background: var(--bg-secondary); border-bottom: 1px solid var(--border);
  font-size: 11px; color: var(--text-secondary);
}
#editor-wrap { display: flex; flex: 1; overflow: hidden; }
#line-numbers {
  width: 36px; padding: 8px 4px; text-align: right; font-family: var(--font-mono);
  font-size: 12px; line-height: 1.5; color: var(--text-muted); background: var(--bg-secondary);
  overflow: hidden; user-select: none; flex-shrink: 0;
}
#editor {
  flex: 1; padding: 8px; font-family: var(--font-mono); font-size: 12px;
  line-height: 1.5; color: var(--text-primary); background: var(--bg-primary);
  border: none; outline: none; resize: none; overflow: auto; white-space: pre; tab-size: 4;
}

/* Preview */
#preview-pane {
  flex: 1; display: flex; flex-direction: column; position: relative;
}
#preview-pane .pane-header {
  padding: 4px 8px; background: var(--bg-secondary); border-bottom: 1px solid var(--border);
  font-size: 11px; color: var(--text-secondary);
}
#preview-container {
  flex: 1; overflow: auto; position: relative; background: var(--bg-primary);
}
#preview-svg { transform-origin: 0 0; }
#overlay-layer {
  position: absolute; top: 0; left: 0; pointer-events: none;
}
#overlay-layer * { pointer-events: auto; }

/* Property Panel */
#props-pane {
  width: 220px; min-width: 180px; border-left: 1px solid var(--border);
  display: flex; flex-direction: column;
}
#props-pane .pane-header {
  padding: 4px 8px; background: var(--bg-secondary); border-bottom: 1px solid var(--border);
  font-size: 11px; color: var(--text-secondary);
}
#props-content { flex: 1; padding: 10px; overflow-y: auto; }
#props-content label { display: block; color: var(--text-secondary); font-size: 10px; margin-bottom: 2px; margin-top: 8px; }
#props-content label:first-child { margin-top: 0; }
#props-content input, #props-content select {
  width: 100%; background: var(--bg-tertiary); border: 1px solid var(--border);
  border-radius: 3px; padding: 4px 6px; color: var(--text-primary); font-family: var(--font-mono);
  font-size: 12px;
}
#props-content .status-btns { display: flex; gap: 4px; flex-wrap: wrap; }
#props-content .status-btns button {
  background: var(--bg-tertiary); border: 1px solid var(--border);
  border-radius: 3px; padding: 2px 8px; font-size: 11px; color: var(--text-primary); cursor: pointer;
}
#props-content .status-btns button.active { border-color: var(--accent); color: var(--accent); }
#props-content .status-btns button.crit-active { border-color: var(--accent-red); color: var(--accent-red); }
#props-content .btn-delete {
  width: 100%; background: var(--accent-red); border: none; color: #fff;
  padding: 6px; border-radius: 3px; font-size: 11px; cursor: pointer; margin-top: 16px;
}
#props-content .btn-add {
  width: 100%; background: var(--accent); border: none; color: #fff;
  padding: 6px; border-radius: 3px; font-size: 11px; cursor: pointer; margin-top: 8px;
}

/* ── Status Bar ── */
#statusbar {
  display: flex; justify-content: space-between; padding: 3px 12px;
  background: var(--bg-secondary); border-top: 1px solid var(--border);
  font-size: 10px; color: var(--text-secondary); flex-shrink: 0;
}
#statusbar .error { color: var(--accent-red); }
#statusbar .ok { color: var(--accent-green); }
</style>
</head>
<body>
<div id="app">
  <!-- Toolbar -->
  <div id="toolbar">
    <span class="logo">MermaidAssist</span>
    <span class="sep">|</span>
    <button id="btn-open" title="Open (Ctrl+O)">Open</button>
    <button id="btn-save" title="Save (Ctrl+S)">Save</button>
    <span class="sep">|</span>
    <button id="btn-undo" title="Undo (Ctrl+Z)">Undo</button>
    <button id="btn-redo" title="Redo (Ctrl+Y)">Redo</button>
    <span class="sep">|</span>
    <button id="btn-zoom-out" title="Zoom Out">−</button>
    <span class="zoom-display" id="zoom-display">100%</span>
    <button id="btn-zoom-in" title="Zoom In">+</button>
    <span class="sep">|</span>
    <div class="export-wrap">
      <button id="btn-export">Export ▾</button>
      <div class="export-menu" id="export-menu">
        <button id="exp-svg">SVG</button>
        <button id="exp-png">PNG</button>
        <button id="exp-png-transparent">PNG (transparent)</button>
        <button id="exp-clipboard">PNG → Clipboard</button>
      </div>
    </div>
    <span class="diagram-type" id="diagram-type">gantt</span>
  </div>

  <!-- Main Panes -->
  <div id="main">
    <div id="editor-pane">
      <div class="pane-header">Editor</div>
      <div id="editor-wrap">
        <div id="line-numbers"></div>
        <textarea id="editor" spellcheck="false"></textarea>
      </div>
    </div>
    <div id="preview-pane">
      <div class="pane-header">Preview</div>
      <div id="preview-container">
        <div id="preview-svg"></div>
        <svg id="overlay-layer"></svg>
      </div>
    </div>
    <div id="props-pane">
      <div class="pane-header">Properties</div>
      <div id="props-content"></div>
    </div>
  </div>

  <!-- Status Bar -->
  <div id="statusbar">
    <span id="status-parse"></span>
    <span id="status-info"></span>
  </div>
</div>

<input type="file" id="file-input" accept=".mmd,.mermaid,.txt" style="display:none">
<script src="lib/mermaid.min.js"></script>
<script>
'use strict';
// ... (existing parser + updater code goes here — keep it all)
</script>
</body>
</html>
```

The complete `<script>` block should include all existing parser + updater code **plus** the new application initialization code added in subsequent tasks.

- [ ] **Step 2: Open in browser, verify 3-pane layout renders**

Open `mermaid-assist.html` in a browser. Verify:
- Toolbar with buttons visible at top
- 3 panes side by side (editor, preview, properties)
- Status bar at bottom
- Dark theme applied

- [ ] **Step 3: Run existing tests to verify no regressions**

```bash
node tests/run-tests.js
```

Expected: All parser and updater tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add mermaid-assist.html
git commit -m "feat: 3-pane HTML shell with toolbar, dark theme CSS"
```

---

### Task 6: Editor + mermaid.js Preview + Refresh Pipeline

**Files:**
- Modify: `mermaid-assist.html` (add init, editor sync, mermaid.js rendering, line numbers, debounce)

This task wires up the editor textarea to mermaid.js rendering with 300ms debounce and line number sync.

- [ ] **Step 1: Add application state and initialization code**

Add after the updater functions, before `__exportForTest`:

```javascript
// ══════════════════════════════════════════════
//  Global State
// ══════════════════════════════════════════════
var mmdText = '';
var parsed = { title: '', dateFormat: 'YYYY-MM-DD', axisFormat: '', sections: [], tasks: [] };
var sel = [];
var zoom = 1.0;
var history = [];
var future = [];
var MAX_HISTORY = 80;
var suppressSync = false;
var debounceTimer = null;
var DEBOUNCE_MS = 300;
var renderCounter = 0;
var clipboard = null;
var addCounter = 0;

// DiagramModule registry
var modules = {};
var currentModule = null;

// ══════════════════════════════════════════════
//  DOM References
// ══════════════════════════════════════════════
var editorEl, lineNumEl, previewSvgEl, overlayEl, propsEl;
var statusParseEl, statusInfoEl, zoomDisplayEl;

// ══════════════════════════════════════════════
//  Gantt Module (partial — parser + updater registered)
// ══════════════════════════════════════════════
modules.gantt = {
  type: 'gantt',
  detect: function(text) { return text.trim().startsWith('gantt'); },
  parse: parseGantt,
  buildOverlay: function(svgEl, parsed) { /* Task 7 */ },
  renderProps: function(sel, parsed) { /* Task 8 */ },
  updateText: function(text, change) {
    if (change.type === 'dates') return updateTaskDates(text, change.line, change.startDate, change.endDate);
    if (change.type === 'field') return updateTaskField(text, change.line, change.field, change.value);
    if (change.type === 'add') return addTask(text, change.sectionIndex, change.label, change.id, change.startDate, change.endDate);
    if (change.type === 'delete') return deleteTask(text, change.line);
    return text;
  },
};

// ══════════════════════════════════════════════
//  Line Numbers
// ══════════════════════════════════════════════
function syncLineNumbers() {
  var lines = editorEl.value.split('\n').length;
  var html = '';
  for (var i = 1; i <= lines; i++) html += i + '\n';
  lineNumEl.textContent = html;
  lineNumEl.scrollTop = editorEl.scrollTop;
}

// ══════════════════════════════════════════════
//  History (Undo/Redo)
// ══════════════════════════════════════════════
function pushHistory() {
  history.push(mmdText);
  if (history.length > MAX_HISTORY) history.shift();
  future = [];
}

function undo() {
  if (history.length === 0) return;
  future.push(mmdText);
  mmdText = history.pop();
  suppressSync = true;
  editorEl.value = mmdText;
  suppressSync = false;
  scheduleRefresh();
}

function redo() {
  if (future.length === 0) return;
  history.push(mmdText);
  mmdText = future.pop();
  suppressSync = true;
  editorEl.value = mmdText;
  suppressSync = false;
  scheduleRefresh();
}

// ══════════════════════════════════════════════
//  Refresh Pipeline
// ══════════════════════════════════════════════
function detectModule(text) {
  for (var key in modules) {
    if (modules[key].detect(text)) return modules[key];
  }
  return null;
}

function scheduleRefresh() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, DEBOUNCE_MS);
}

async function refresh() {
  // 1. Detect module
  currentModule = detectModule(mmdText);
  var typeEl = document.getElementById('diagram-type');
  typeEl.textContent = currentModule ? currentModule.type : '—';

  // 2. Parse
  if (currentModule) {
    parsed = currentModule.parse(mmdText);
  } else {
    parsed = { title: '', dateFormat: 'YYYY-MM-DD', axisFormat: '', sections: [], tasks: [] };
  }

  // 3. Render via mermaid.js
  renderCounter++;
  var renderId = 'mermaid-' + renderCounter;
  try {
    var result = await mermaid.render(renderId, mmdText);
    previewSvgEl.innerHTML = result.svg;
    statusParseEl.className = 'ok';
    statusParseEl.textContent = '✓ パースOK';
  } catch (e) {
    statusParseEl.className = 'error';
    statusParseEl.textContent = '✗ ' + (e.message || 'パースエラー').substring(0, 80);
    // Remove error element that mermaid.js inserts
    var errEl = document.getElementById('d' + renderId);
    if (errEl) errEl.remove();
  }

  // 4. Build overlay
  if (currentModule && currentModule.buildOverlay) {
    var svgEl = previewSvgEl.querySelector('svg');
    if (svgEl) currentModule.buildOverlay(svgEl, parsed);
  }

  // 5. Render props & status
  renderProps();
  renderStatus();
  syncLineNumbers();
}

function renderStatus() {
  var info = '';
  if (parsed.tasks.length > 0) {
    info = 'タスク: ' + parsed.tasks.length;
    if (parsed.sections.length > 0) info += ' | セクション: ' + parsed.sections.length;
  }
  statusInfoEl.textContent = info;
}

function renderProps() {
  if (currentModule && currentModule.renderProps) {
    currentModule.renderProps(sel, parsed);
  }
}

// ══════════════════════════════════════════════
//  Zoom
// ══════════════════════════════════════════════
function setZoom(z) {
  zoom = Math.max(0.25, Math.min(3.0, z));
  zoomDisplayEl.textContent = Math.round(zoom * 100) + '%';
  previewSvgEl.style.transform = 'scale(' + zoom + ')';
  overlayEl.style.transform = 'scale(' + zoom + ')';
  overlayEl.style.transformOrigin = '0 0';
}

// ══════════════════════════════════════════════
//  Initialization
// ══════════════════════════════════════════════
function init() {
  editorEl = document.getElementById('editor');
  lineNumEl = document.getElementById('line-numbers');
  previewSvgEl = document.getElementById('preview-svg');
  overlayEl = document.getElementById('overlay-layer');
  propsEl = document.getElementById('props-content');
  statusParseEl = document.getElementById('status-parse');
  statusInfoEl = document.getElementById('status-info');
  zoomDisplayEl = document.getElementById('zoom-display');

  // mermaid.js config
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    gantt: { useWidth: undefined },
    securityLevel: 'loose',
  });

  // Default content
  mmdText = [
    'gantt',
    '    title プロジェクト計画',
    '    dateFormat YYYY-MM-DD',
    '    axisFormat %m/%d',
    '',
    '    section 要件定義',
    '    要件分析           :a1, 2026-04-01, 2026-04-15',
    '    仕様書作成         :a2, after a1, 2026-04-25',
    '',
    '    section 設計',
    '    基本設計           :b1, 2026-04-20, 2026-05-05',
    '    詳細設計           :b2, after b1, 2026-05-15',
  ].join('\n');
  editorEl.value = mmdText;

  // Editor input → debounce refresh
  editorEl.addEventListener('input', function() {
    if (suppressSync) return;
    pushHistory();
    mmdText = editorEl.value;
    scheduleRefresh();
  });
  editorEl.addEventListener('scroll', function() {
    lineNumEl.scrollTop = editorEl.scrollTop;
  });

  // Toolbar buttons
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);
  document.getElementById('btn-zoom-in').addEventListener('click', function() { setZoom(zoom + 0.1); });
  document.getElementById('btn-zoom-out').addEventListener('click', function() { setZoom(zoom - 0.1); });

  // Zoom with Ctrl+wheel
  document.getElementById('preview-container').addEventListener('wheel', function(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      setZoom(zoom + (e.deltaY < 0 ? 0.1 : -0.1));
    }
  }, { passive: false });

  // Export menu toggle
  document.getElementById('btn-export').addEventListener('click', function() {
    document.getElementById('export-menu').classList.toggle('open');
  });
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.export-wrap')) {
      document.getElementById('export-menu').classList.remove('open');
    }
  });

  // Initial render
  refresh();
}

document.addEventListener('DOMContentLoaded', init);
```

- [ ] **Step 2: Open in browser, verify mermaid.js renders the default gantt chart**

Open `mermaid-assist.html` in browser. Verify:
- Default gantt text appears in editor with line numbers
- mermaid.js renders a gantt chart in the preview pane
- Status bar shows "✓ パースOK" and task/section counts
- Editing text triggers preview re-render after 300ms
- Zoom buttons work

- [ ] **Step 3: Run tests to verify no regressions**

```bash
node tests/run-tests.js
```

Expected: All tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add mermaid-assist.html
git commit -m "feat: editor + mermaid.js preview with 300ms debounce refresh pipeline"
```

---

### Task 7: Overlay Builder + Date↔Pixel Calibration

**Files:**
- Modify: `mermaid-assist.html` (implement `buildOverlay` in gantt module, add calibration functions)

This is the core of the overlay approach (ADR-008). Analyze the mermaid.js SVG to find task bar rects, compute pxPerDay scale, and create transparent overlay elements for interaction.

- [ ] **Step 1: Add calibration and overlay builder functions**

Add before the `modules.gantt` definition:

```javascript
// ══════════════════════════════════════════════
//  Date Helpers
// ══════════════════════════════════════════════
function daysBetween(dateStr1, dateStr2) {
  var d1 = new Date(dateStr1), d2 = new Date(dateStr2);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function addDays(dateStr, days) {
  var d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().substring(0, 10);
}

// ══════════════════════════════════════════════
//  SVG Calibration (ADR-010)
// ══════════════════════════════════════════════
var calibration = { pxPerDay: 0, originX: 0, baseDate: '', barRects: [] };

function calibrateScale(svgEl, parsedData) {
  // Collect task bar rects from mermaid.js SVG
  // mermaid.js renders gantt bars as <rect> inside <g class="section*"> groups
  var rects = [];
  var allRects = svgEl.querySelectorAll('rect.task, rect.task0, rect.task1, rect.task2, rect.task3');

  if (allRects.length === 0) {
    // Fallback: find rects by section groups
    var sectionGroups = svgEl.querySelectorAll('.section0, .section1, .section2, .section3');
    sectionGroups.forEach(function(g) {
      var r = g.querySelectorAll('rect');
      r.forEach(function(rect) { rects.push(rect); });
    });
  } else {
    allRects.forEach(function(r) { rects.push(r); });
  }

  if (rects.length === 0) {
    // Last fallback: collect all non-background rects of reasonable size
    svgEl.querySelectorAll('rect').forEach(function(r) {
      var bbox = r.getBBox();
      if (bbox.height > 10 && bbox.height < 50 && bbox.width > 10) {
        rects.push(r);
      }
    });
  }

  calibration.barRects = rects;

  // Find two tasks with different known start dates for scale calculation
  var tasksWithDates = parsedData.tasks.filter(function(t) { return t.startDate; });
  if (tasksWithDates.length >= 2 && rects.length >= 2) {
    // Map by index (tasks are in definition order, same as SVG rendering order)
    var t1Idx = parsedData.tasks.indexOf(tasksWithDates[0]);
    var t2Idx = parsedData.tasks.indexOf(tasksWithDates[1]);
    if (t1Idx < rects.length && t2Idx < rects.length) {
      var r1 = rects[t1Idx].getBBox();
      var r2 = rects[t2Idx].getBBox();
      var days = daysBetween(tasksWithDates[0].startDate, tasksWithDates[1].startDate);
      if (days !== 0) {
        calibration.pxPerDay = (r2.x - r1.x) / days;
        calibration.baseDate = tasksWithDates[0].startDate;
        calibration.originX = r1.x;
        return;
      }
    }
  }

  // Single-task fallback: use width and date range
  if (tasksWithDates.length >= 1 && rects.length >= 1) {
    var t = tasksWithDates[0];
    var tIdx = parsedData.tasks.indexOf(t);
    if (tIdx < rects.length && t.endDate && !isDuration(t.endDate)) {
      var r = rects[tIdx].getBBox();
      var span = daysBetween(t.startDate, t.endDate);
      if (span > 0) {
        calibration.pxPerDay = r.width / span;
        calibration.baseDate = t.startDate;
        calibration.originX = r.x;
        return;
      }
    }
  }

  // Cannot calibrate — disable drag
  calibration.pxPerDay = 0;
}

function pxToDate(px) {
  if (calibration.pxPerDay === 0) return null;
  var days = Math.round((px - calibration.originX) / calibration.pxPerDay);
  return addDays(calibration.baseDate, days);
}

function dateToPx(dateStr) {
  if (calibration.pxPerDay === 0) return 0;
  var days = daysBetween(calibration.baseDate, dateStr);
  return calibration.originX + days * calibration.pxPerDay;
}
```

- [ ] **Step 2: Implement buildOverlay in gantt module**

Replace the `buildOverlay` stub in `modules.gantt`:

```javascript
buildOverlay: function(svgEl, parsedData) {
  // Clear previous overlay
  overlayEl.innerHTML = '';

  calibrateScale(svgEl, parsedData);
  var rects = calibration.barRects;

  // Match overlay dimensions to SVG
  var svgBBox = svgEl.getBBox();
  var svgWidth = svgEl.getAttribute('width') || svgEl.viewBox.baseVal.width || svgBBox.width + svgBBox.x;
  var svgHeight = svgEl.getAttribute('height') || svgEl.viewBox.baseVal.height || svgBBox.height + svgBBox.y;
  overlayEl.setAttribute('width', svgWidth);
  overlayEl.setAttribute('height', svgHeight);
  overlayEl.setAttribute('viewBox', svgEl.getAttribute('viewBox') || '0 0 ' + svgWidth + ' ' + svgHeight);
  overlayEl.style.width = svgWidth + 'px';
  overlayEl.style.height = svgHeight + 'px';
  overlayEl.style.position = 'absolute';
  overlayEl.style.top = '0';
  overlayEl.style.left = '0';

  for (var i = 0; i < parsedData.tasks.length && i < rects.length; i++) {
    var task = parsedData.tasks[i];
    var bbox = rects[i].getBBox();
    var isSelected = sel.some(function(s) { return s.id === task.id; });

    // Selection highlight (behind the overlay bar)
    if (isSelected) {
      var hlRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hlRect.setAttribute('x', bbox.x - 2);
      hlRect.setAttribute('y', bbox.y - 2);
      hlRect.setAttribute('width', bbox.width + 4);
      hlRect.setAttribute('height', bbox.height + 4);
      hlRect.setAttribute('fill', 'none');
      hlRect.setAttribute('stroke', '#7ee787');
      hlRect.setAttribute('stroke-width', '2');
      hlRect.setAttribute('stroke-dasharray', '4');
      hlRect.setAttribute('class', 'selection-highlight');
      overlayEl.appendChild(hlRect);
    }

    // Transparent overlay bar (click target for selection + drag)
    var bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bar.setAttribute('x', bbox.x);
    bar.setAttribute('y', bbox.y);
    bar.setAttribute('width', bbox.width);
    bar.setAttribute('height', bbox.height);
    bar.setAttribute('fill', 'transparent');
    bar.setAttribute('stroke', 'none');
    bar.setAttribute('cursor', 'move');
    bar.setAttribute('data-task-id', task.id);
    bar.setAttribute('data-type', 'task');
    bar.setAttribute('data-line', task.line);
    bar.setAttribute('data-index', i);
    bar.setAttribute('class', 'overlay-bar');
    overlayEl.appendChild(bar);

    // Left resize handle
    var handleW = 6;
    var lh = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    lh.setAttribute('x', bbox.x - handleW / 2);
    lh.setAttribute('y', bbox.y);
    lh.setAttribute('width', handleW);
    lh.setAttribute('height', bbox.height);
    lh.setAttribute('fill', isSelected ? '#7ee787' : 'transparent');
    lh.setAttribute('fill-opacity', isSelected ? '0.7' : '0');
    lh.setAttribute('cursor', 'w-resize');
    lh.setAttribute('data-task-id', task.id);
    lh.setAttribute('data-handle', 'left');
    lh.setAttribute('data-line', task.line);
    lh.setAttribute('class', 'resize-handle');
    overlayEl.appendChild(lh);

    // Right resize handle
    var rh = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rh.setAttribute('x', bbox.x + bbox.width - handleW / 2);
    rh.setAttribute('y', bbox.y);
    rh.setAttribute('width', handleW);
    rh.setAttribute('height', bbox.height);
    rh.setAttribute('fill', isSelected ? '#7ee787' : 'transparent');
    rh.setAttribute('fill-opacity', isSelected ? '0.7' : '0');
    rh.setAttribute('cursor', 'e-resize');
    rh.setAttribute('data-task-id', task.id);
    rh.setAttribute('data-handle', 'right');
    rh.setAttribute('data-line', task.line);
    rh.setAttribute('class', 'resize-handle');
    overlayEl.appendChild(rh);
  }
},
```

- [ ] **Step 3: Open in browser, verify overlay elements appear**

Open browser DevTools → Elements. After rendering, the `#overlay-layer` SVG should contain transparent `rect` elements with `data-task-id` attributes matching each task. Hovering over a task bar area should show `cursor: move`.

- [ ] **Step 4: Run tests to verify no regressions**

```bash
node tests/run-tests.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add mermaid-assist.html
git commit -m "feat: overlay builder with date/pixel calibration (ADR-008, ADR-010)"
```

---

### Task 8: Selection Model + Property Panel

**Files:**
- Modify: `mermaid-assist.html` (selection handling, property panel rendering, property editing)

Implements click-to-select (ADR-001 DOM-based), Shift+Click multi-select, and the 4-state property panel (ADR-002 selection model).

- [ ] **Step 1: Add selection logic**

Add after the zoom functions:

```javascript
// ══════════════════════════════════════════════
//  Selection (ADR-001 DOM-based, ADR-002 array model)
// ══════════════════════════════════════════════
function isSelected(id) {
  return sel.some(function(s) { return s.id === id; });
}

function selectItem(type, id, multi) {
  if (multi) {
    // Toggle
    var idx = sel.findIndex(function(s) { return s.id === id; });
    if (idx >= 0) sel.splice(idx, 1);
    else sel.push({ type: type, id: id });
  } else {
    sel = [{ type: type, id: id }];
  }
  renderProps();
  // Rebuild overlay to update selection highlights
  if (currentModule) {
    var svgEl = previewSvgEl.querySelector('svg');
    if (svgEl) currentModule.buildOverlay(svgEl, parsed);
  }
}

function clearSelection() {
  sel = [];
  renderProps();
  if (currentModule) {
    var svgEl = previewSvgEl.querySelector('svg');
    if (svgEl) currentModule.buildOverlay(svgEl, parsed);
  }
}
```

- [ ] **Step 2: Add overlay click handler (event delegation)**

Add inside `init()`:

```javascript
// Overlay click handling (event delegation on overlay SVG)
overlayEl.addEventListener('mousedown', function(e) {
  var target = e.target;
  var taskId = target.getAttribute('data-task-id');
  var type = target.getAttribute('data-type');
  var handle = target.getAttribute('data-handle');

  if (!taskId) {
    if (!e.shiftKey) clearSelection();
    return;
  }

  // Handle resize/drag in Task 9 — for now, just handle selection
  if (!handle) {
    selectItem(type || 'task', taskId, e.shiftKey);
  }
});

// Click on preview background clears selection
document.getElementById('preview-container').addEventListener('mousedown', function(e) {
  if (e.target === this || e.target === previewSvgEl) {
    clearSelection();
  }
});
```

- [ ] **Step 3: Implement renderProps in gantt module**

Replace the `renderProps` stub in `modules.gantt`:

```javascript
renderProps: function(selArr, parsedData) {
  var container = propsEl;
  container.innerHTML = '';

  // ── No selection: show add form + shortcuts ──
  if (selArr.length === 0) {
    container.innerHTML =
      '<label>タスク追加</label>' +
      '<input id="prop-new-label" placeholder="タスク名">' +
      '<input id="prop-new-id" placeholder="ID (任意)">' +
      '<input id="prop-new-start" type="date">' +
      '<input id="prop-new-end" type="date">' +
      '<label>セクション</label>' +
      '<select id="prop-new-section">' +
        '<option value="-1">(なし)</option>' +
        parsedData.sections.map(function(s, i) { return '<option value="' + i + '">' + s.name + '</option>'; }).join('') +
      '</select>' +
      '<button class="btn-add" id="btn-add-task">+ タスク追加</button>' +
      '<div style="margin-top:16px;padding-top:10px;border-top:1px solid var(--border);font-size:10px;color:var(--text-muted);">' +
        '<div>Shift+Click — 複数選択</div>' +
        '<div>Delete — タスク削除</div>' +
        '<div>Ctrl+Z/Y — Undo/Redo</div>' +
        '<div>Ctrl+S — 保存</div>' +
      '</div>';

    document.getElementById('btn-add-task').addEventListener('click', function() {
      var label = document.getElementById('prop-new-label').value.trim();
      if (!label) return;
      var id = document.getElementById('prop-new-id').value.trim() || null;
      var start = document.getElementById('prop-new-start').value;
      var end = document.getElementById('prop-new-end').value;
      var secIdx = parseInt(document.getElementById('prop-new-section').value, 10);
      if (!start || !end) return;
      pushHistory();
      mmdText = addTask(mmdText, secIdx, label, id, start, end);
      editorEl.value = mmdText;
      scheduleRefresh();
    });
    return;
  }

  // ── Single task selected ──
  if (selArr.length === 1 && selArr[0].type === 'task') {
    var t = parsedData.tasks.find(function(tk) { return tk.id === selArr[0].id; });
    if (!t) return;

    container.innerHTML =
      '<div style="color:var(--accent-green);font-size:10px;margin-bottom:8px;">● タスク選択中</div>' +
      '<label>タスク名</label><input id="prop-label" value="' + escHtml(t.label) + '">' +
      '<label>ID</label><input id="prop-id" value="' + escHtml(t.id.startsWith('__auto_') ? '' : t.id) + '" placeholder="(自動生成)">' +
      '<label>開始日</label><input id="prop-start" type="date" value="' + (t.startDate || '') + '">' +
      '<label>終了日</label><input id="prop-end" type="date" value="' + (t.endDate && !isDuration(t.endDate) ? t.endDate : '') + '">' +
      '<label>状態</label>' +
      '<div class="status-btns">' +
        '<button data-status="" class="' + (t.status === null ? 'active' : '') + '">none</button>' +
        '<button data-status="done" class="' + (t.status === 'done' ? 'active' : '') + '">done</button>' +
        '<button data-status="active" class="' + (t.status === 'active' ? 'active' : '') + '">active</button>' +
        '<button data-status="crit" class="' + (t.status === 'crit' ? 'crit-active' : '') + '">crit</button>' +
      '</div>' +
      '<label>依存 (after)</label><input id="prop-after" value="' + (t.after || '') + '" placeholder="なし">' +
      '<button class="btn-delete" id="btn-delete-task">タスク削除</button>';

    // Bind change handlers
    var lineNum = t.line;
    bindPropInput('prop-label', lineNum, 'label');
    bindPropInput('prop-id', lineNum, 'id');
    bindPropDate('prop-start', 'prop-end', lineNum);

    // Status buttons
    container.querySelectorAll('.status-btns button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var newStatus = btn.getAttribute('data-status') || null;
        pushHistory();
        mmdText = updateTaskField(mmdText, lineNum, 'status', newStatus);
        editorEl.value = mmdText;
        scheduleRefresh();
      });
    });

    document.getElementById('btn-delete-task').addEventListener('click', function() {
      pushHistory();
      mmdText = deleteTask(mmdText, lineNum);
      editorEl.value = mmdText;
      sel = [];
      scheduleRefresh();
    });
    return;
  }

  // ── Multi-select ──
  if (selArr.length > 1) {
    container.innerHTML =
      '<div style="color:var(--accent-green);font-size:10px;margin-bottom:8px;">● ' + selArr.length + '件選択中</div>' +
      '<label>一括状態変更</label>' +
      '<div class="status-btns">' +
        '<button data-status="">none</button>' +
        '<button data-status="done">done</button>' +
        '<button data-status="active">active</button>' +
        '<button data-status="crit">crit</button>' +
      '</div>' +
      '<label>一括日付シフト (日数)</label>' +
      '<div style="display:flex;gap:4px;">' +
        '<input id="prop-shift-days" type="number" value="0" style="flex:1;">' +
        '<button class="btn-add" id="btn-shift" style="margin:0;width:auto;padding:4px 12px;">適用</button>' +
      '</div>' +
      '<button class="btn-delete" id="btn-delete-multi">一括削除</button>';

    // Batch status
    container.querySelectorAll('.status-btns button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var newStatus = btn.getAttribute('data-status') || null;
        pushHistory();
        selArr.forEach(function(s) {
          var t = parsedData.tasks.find(function(tk) { return tk.id === s.id; });
          if (t) mmdText = updateTaskField(mmdText, t.line, 'status', newStatus);
        });
        editorEl.value = mmdText;
        scheduleRefresh();
      });
    });

    // Batch date shift
    document.getElementById('btn-shift').addEventListener('click', function() {
      var days = parseInt(document.getElementById('prop-shift-days').value, 10);
      if (!days || isNaN(days)) return;
      pushHistory();
      selArr.forEach(function(s) {
        var t = parsedData.tasks.find(function(tk) { return tk.id === s.id; });
        if (t && t.startDate && t.endDate && !isDuration(t.endDate)) {
          var newStart = addDays(t.startDate, days);
          var newEnd = addDays(t.endDate, days);
          mmdText = updateTaskDates(mmdText, t.line, newStart, newEnd);
        }
      });
      editorEl.value = mmdText;
      scheduleRefresh();
    });

    // Batch delete (reverse line order to preserve line numbers)
    document.getElementById('btn-delete-multi').addEventListener('click', function() {
      pushHistory();
      var lines = selArr.map(function(s) {
        var t = parsedData.tasks.find(function(tk) { return tk.id === s.id; });
        return t ? t.line : -1;
      }).filter(function(l) { return l > 0; }).sort(function(a, b) { return b - a; });
      lines.forEach(function(l) { mmdText = deleteTask(mmdText, l); });
      editorEl.value = mmdText;
      sel = [];
      scheduleRefresh();
    });
    return;
  }

  // ── Section selected ──
  if (selArr.length === 1 && selArr[0].type === 'section') {
    var sec = parsedData.sections.find(function(s) { return s.name === selArr[0].id; });
    if (!sec) return;
    var secTasks = parsedData.tasks.filter(function(t) { return t.sectionIndex === parsedData.sections.indexOf(sec); });

    container.innerHTML =
      '<div style="color:var(--accent-orange);font-size:10px;margin-bottom:8px;">● セクション選択中</div>' +
      '<label>セクション名</label><input id="prop-sec-name" value="' + escHtml(sec.name) + '">' +
      '<label>タスク一覧</label>' +
      '<div style="font-size:11px;color:var(--text-secondary);">' +
        secTasks.map(function(t) { return '<div style="padding:2px 0;">' + escHtml(t.label) + '</div>'; }).join('') +
      '</div>';

    document.getElementById('prop-sec-name').addEventListener('change', function() {
      var newName = this.value.trim();
      if (!newName) return;
      pushHistory();
      var lines = mmdText.split('\n');
      lines[sec.line - 1] = lines[sec.line - 1].replace(/section .+/, 'section ' + newName);
      mmdText = lines.join('\n');
      editorEl.value = mmdText;
      sel = [{ type: 'section', id: newName }];
      scheduleRefresh();
    });
  }
},
```

- [ ] **Step 4: Add helper functions**

Add these utility functions before the module definitions:

```javascript
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function bindPropInput(elId, lineNum, field) {
  document.getElementById(elId).addEventListener('change', function() {
    pushHistory();
    mmdText = updateTaskField(mmdText, lineNum, field, this.value);
    editorEl.value = mmdText;
    scheduleRefresh();
  });
}

function bindPropDate(startId, endId, lineNum) {
  document.getElementById(startId).addEventListener('change', function() {
    var endEl = document.getElementById(endId);
    pushHistory();
    mmdText = updateTaskDates(mmdText, lineNum, this.value || null, endEl.value || null);
    editorEl.value = mmdText;
    scheduleRefresh();
  });
  document.getElementById(endId).addEventListener('change', function() {
    var startEl = document.getElementById(startId);
    pushHistory();
    mmdText = updateTaskDates(mmdText, lineNum, startEl.value || null, this.value || null);
    editorEl.value = mmdText;
    scheduleRefresh();
  });
}
```

- [ ] **Step 5: Browser verification**

Open in browser. Verify:
- Clicking a task bar shows green dashed highlight and property panel with fields
- Shift+Click adds to selection, showing multi-select panel
- Clicking empty area clears selection, shows add task form
- Editing property panel fields (status, label, dates) updates the Mermaid text in editor
- Adding a task from the form inserts a new line
- Delete button removes the task

- [ ] **Step 6: Run tests**

```bash
node tests/run-tests.js
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add mermaid-assist.html
git commit -m "feat: selection model (ADR-001/002) + 4-state property panel"
```

---

### Task 9: Drag Interactions (Move + Resize)

**Files:**
- Modify: `mermaid-assist.html` (drag handler for bar move and left/right resize)

- [ ] **Step 1: Add drag handler to overlay mousedown**

Replace the overlay mousedown handler from Task 8 with this complete version:

```javascript
// ══════════════════════════════════════════════
//  Drag Interactions
// ══════════════════════════════════════════════
var dragState = null;

overlayEl.addEventListener('mousedown', function(e) {
  if (e.button !== 0) return;
  var target = e.target;
  var taskId = target.getAttribute('data-task-id');
  var handle = target.getAttribute('data-handle');
  var lineNum = parseInt(target.getAttribute('data-line'), 10);

  if (!taskId) {
    if (!e.shiftKey) clearSelection();
    return;
  }

  // Select on click (always, before drag)
  if (!handle) {
    selectItem('task', taskId, e.shiftKey);
  } else {
    if (!isSelected(taskId)) selectItem('task', taskId, false);
  }

  // Start drag if calibration is available
  if (calibration.pxPerDay === 0) return;

  var task = parsed.tasks.find(function(t) { return t.id === taskId; });
  if (!task) return;

  var svgPoint = overlayEl.createSVGPoint();
  svgPoint.x = e.clientX;
  svgPoint.y = e.clientY;
  var ctm = overlayEl.getScreenCTM().inverse();
  var startPt = svgPoint.matrixTransform(ctm);

  var barEl = overlayEl.querySelector('.overlay-bar[data-task-id="' + taskId + '"]');
  var barBBox = barEl ? { x: parseFloat(barEl.getAttribute('x')), width: parseFloat(barEl.getAttribute('width')) } : null;

  dragState = {
    taskId: taskId,
    lineNum: lineNum,
    handle: handle,  // null=move, "left", "right"
    startX: startPt.x,
    origStartDate: task.startDate,
    origEndDate: task.endDate,
    origBarX: barBBox ? barBBox.x : 0,
    origBarW: barBBox ? barBBox.width : 0,
  };

  e.preventDefault();
  pushHistory();
});

document.addEventListener('mousemove', function(e) {
  if (!dragState) return;

  var svgPoint = overlayEl.createSVGPoint();
  svgPoint.x = e.clientX;
  svgPoint.y = e.clientY;
  var ctm = overlayEl.getScreenCTM().inverse();
  var pt = svgPoint.matrixTransform(ctm);
  var dx = pt.x - dragState.startX;

  var daysDelta = Math.round(dx / calibration.pxPerDay);
  if (daysDelta === 0) return;

  var newStart, newEnd;

  if (dragState.handle === 'left') {
    // Resize from left: change start date only
    newStart = dragState.origStartDate ? addDays(dragState.origStartDate, daysDelta) : null;
    newEnd = null;  // keep original
  } else if (dragState.handle === 'right') {
    // Resize from right: change end date only
    newStart = null;  // keep original
    newEnd = dragState.origEndDate && !isDuration(dragState.origEndDate) ? addDays(dragState.origEndDate, daysDelta) : null;
  } else {
    // Move: shift both dates
    newStart = dragState.origStartDate ? addDays(dragState.origStartDate, daysDelta) : null;
    newEnd = dragState.origEndDate && !isDuration(dragState.origEndDate) ? addDays(dragState.origEndDate, daysDelta) : null;
  }

  mmdText = updateTaskDates(mmdText, dragState.lineNum, newStart, newEnd);
  suppressSync = true;
  editorEl.value = mmdText;
  suppressSync = false;
  scheduleRefresh();
});

document.addEventListener('mouseup', function(e) {
  if (!dragState) return;
  dragState = null;
});
```

- [ ] **Step 2: Browser verification**

Open in browser. Verify:
- Dragging a task bar left/right shifts both dates in the editor
- Dragging the left edge changes start date only
- Dragging the right edge changes end date only
- Preview re-renders during drag (with debounce)
- Dates snap to whole days

- [ ] **Step 3: Run tests**

```bash
node tests/run-tests.js
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add mermaid-assist.html
git commit -m "feat: drag interactions — bar move and left/right resize handles"
```

---

### Task 10: File I/O + Export

**Files:**
- Modify: `mermaid-assist.html` (file open/save, SVG/PNG/clipboard export)

- [ ] **Step 1: Add file I/O functions**

Add after the zoom functions:

```javascript
// ══════════════════════════════════════════════
//  File I/O
// ══════════════════════════════════════════════
function saveFile() {
  var blob = new Blob([mmdText], { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (parsed.title || 'untitled') + '.mmd';
  a.click();
  URL.revokeObjectURL(a.href);
}

function openFile() {
  document.getElementById('file-input').click();
}

// ══════════════════════════════════════════════
//  Export
// ══════════════════════════════════════════════
function exportSVG() {
  var svgEl = previewSvgEl.querySelector('svg');
  if (!svgEl) return;
  var clone = svgEl.cloneNode(true);
  var blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (parsed.title || 'untitled') + '.svg';
  a.click();
  URL.revokeObjectURL(a.href);
}

function svgToCanvas(transparent, callback) {
  var svgEl = previewSvgEl.querySelector('svg');
  if (!svgEl) return;
  var clone = svgEl.cloneNode(true);
  var svgData = new XMLSerializer().serializeToString(clone);
  var img = new Image();
  img.onload = function() {
    var canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext('2d');
    if (!transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0);
    callback(canvas);
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
}

function exportPNG(transparent) {
  svgToCanvas(transparent, function(canvas) {
    canvas.toBlob(function(blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (parsed.title || 'untitled') + '.png';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  });
}

function exportClipboard() {
  svgToCanvas(false, function(canvas) {
    canvas.toBlob(function(blob) {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    });
  });
}
```

- [ ] **Step 2: Wire up toolbar buttons in init()**

Add inside `init()`:

```javascript
// File I/O
document.getElementById('btn-open').addEventListener('click', openFile);
document.getElementById('btn-save').addEventListener('click', saveFile);
document.getElementById('file-input').addEventListener('change', function(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function() {
    pushHistory();
    mmdText = reader.result;
    editorEl.value = mmdText;
    scheduleRefresh();
  };
  reader.readAsText(file);
  e.target.value = '';  // allow re-opening same file
});

// Export
document.getElementById('exp-svg').addEventListener('click', function() { exportSVG(); });
document.getElementById('exp-png').addEventListener('click', function() { exportPNG(false); });
document.getElementById('exp-png-transparent').addEventListener('click', function() { exportPNG(true); });
document.getElementById('exp-clipboard').addEventListener('click', function() { exportClipboard(); });
```

- [ ] **Step 3: Browser verification**

Verify:
- Ctrl+S or Save button downloads a `.mmd` file
- Open button loads a `.mmd` file into the editor
- Export SVG downloads an SVG file
- Export PNG downloads a PNG with white background
- Export PNG (transparent) downloads a PNG with transparent background
- PNG → Clipboard copies to clipboard (verify with paste in an image editor)

- [ ] **Step 4: Commit**

```bash
git add mermaid-assist.html
git commit -m "feat: file I/O (.mmd open/save) and export (SVG, PNG, clipboard)"
```

---

### Task 11: Keyboard Shortcuts

**Files:**
- Modify: `mermaid-assist.html` (keydown handler)

- [ ] **Step 1: Add keyboard handler in init()**

```javascript
// ══════════════════════════════════════════════
//  Keyboard Shortcuts
// ══════════════════════════════════════════════
document.addEventListener('keydown', function(e) {
  // Don't intercept when typing in editor or input fields
  var tag = e.target.tagName;
  var inInput = (tag === 'INPUT' || tag === 'SELECT');
  var inEditor = (e.target === editorEl);

  if (e.ctrlKey && e.key === 'z') {
    if (inEditor) return;  // let browser handle textarea undo
    e.preventDefault(); undo();
  } else if (e.ctrlKey && e.key === 'y') {
    if (inEditor) return;
    e.preventDefault(); redo();
  } else if (e.ctrlKey && e.key === 's') {
    e.preventDefault(); saveFile();
  } else if (e.ctrlKey && e.key === 'o') {
    e.preventDefault(); openFile();
  } else if (e.key === 'Delete' && !inInput && !inEditor) {
    if (sel.length === 0) return;
    pushHistory();
    var lines = sel.map(function(s) {
      var t = parsed.tasks.find(function(tk) { return tk.id === s.id; });
      return t ? t.line : -1;
    }).filter(function(l) { return l > 0; }).sort(function(a, b) { return b - a; });
    lines.forEach(function(l) { mmdText = deleteTask(mmdText, l); });
    editorEl.value = mmdText;
    sel = [];
    scheduleRefresh();
  } else if (e.key === 'Escape') {
    clearSelection();
  } else if (e.ctrlKey && e.key === 'a' && !inEditor && !inInput) {
    e.preventDefault();
    sel = parsed.tasks.map(function(t) { return { type: 'task', id: t.id }; });
    renderProps();
    if (currentModule) {
      var svgEl = previewSvgEl.querySelector('svg');
      if (svgEl) currentModule.buildOverlay(svgEl, parsed);
    }
  } else if (e.ctrlKey && e.shiftKey && e.key === 'C') {
    e.preventDefault(); exportClipboard();
  } else if (e.ctrlKey && e.key === 'c' && !inEditor && !inInput && sel.length > 0) {
    e.preventDefault();
    clipboard = sel.map(function(s) {
      return parsed.tasks.find(function(t) { return t.id === s.id; });
    }).filter(Boolean);
  } else if (e.ctrlKey && e.key === 'v' && !inEditor && !inInput && clipboard && clipboard.length > 0) {
    e.preventDefault();
    pushHistory();
    clipboard.forEach(function(t) {
      var newId = '__new_' + (++addCounter);
      var newStart = t.startDate ? addDays(t.startDate, 7) : null;
      var newEnd = t.endDate && !isDuration(t.endDate) ? addDays(t.endDate, 7) : t.endDate;
      mmdText = addTask(mmdText, t.sectionIndex, t.label, newId, newStart, newEnd);
    });
    editorEl.value = mmdText;
    scheduleRefresh();
  }
});
```

- [ ] **Step 2: Browser verification**

Verify all shortcuts work:
- Ctrl+S saves, Ctrl+O opens
- Delete removes selected tasks
- Escape clears selection
- Ctrl+A selects all tasks (when not in editor)
- Ctrl+Shift+C copies PNG to clipboard

- [ ] **Step 3: Commit**

```bash
git add mermaid-assist.html
git commit -m "feat: keyboard shortcuts (Ctrl+Z/Y/S/O, Delete, Escape, Ctrl+A)"
```

---

### Task 12: ADR-008, ADR-009, ADR-010

**Files:**
- Create: `E:\00_Git\docs\adr\008-mermaidjs-svg-overlay.md`
- Create: `E:\00_Git\docs\adr\009-diagram-module-structure.md`
- Create: `E:\00_Git\docs\adr\010-date-pixel-calibration.md`

- [ ] **Step 1: Write ADR-008**

`E:\00_Git\docs\adr\008-mermaidjs-svg-overlay.md`:

```markdown
# ADR-008: mermaid.js SVGオーバーレイ方式

- **ステータス**: 承認
- **カテゴリ**: rendering
- **日付**: 2026-03-30
- **対象プロジェクト**: MermaidAssist
- **関連ADR**: ADR-001

## コンテキスト

MermaidAssistはMermaidテキストからガントチャートを描画し、GUIで直感的に編集できるツールである。mermaid.jsが描画したSVGに対してドラッグ・リサイズなどのインタラクションを追加する方法が問題となった。

## 検討した選択肢

### A) StableBlock完全踏襲型
mermaid.jsでプレビュー描画し、描画済みSVGに直接DOMイベントリスナーを付与する。

- **メリット**: シンプルな構造
- **デメリット**: mermaid.jsのSVG構造が変更されるとイベントリスナーが壊れる。mermaid.jsはclass名やDOM階層をバージョン間で変更することがある。

### B) デュアルレンダリング型
編集用は自前SVG描画（完全制御可能）、プレビュー確認用にmermaid.jsレンダリングを切り替える。

- **メリット**: 編集用SVGを完全制御でき自由にインタラクション実装可能
- **デメリット**: ガントチャートの自前描画が必要（工数大）。自前プレビューとmermaid.jsの見た目に差異が生じる。

### C) mermaid.js SVG + 透明オーバーレイ層
mermaid.jsで描画したSVGの上に、同サイズの透明SVGレイヤーを重ねる。オーバーレイ層に操作用の透明rect要素を配置し、data-task-id属性でDOMイベント処理を行う。

- **メリット**: プレビューは常にmermaid.js本来の正確な見た目。オーバーレイ層で自由にドラッグ・リサイズ実装可能。mermaid.jsのSVG構造が変わっても、バーの位置取得ロジック（オーバーレイ解析部）のみ修正すれば良い。
- **デメリット**: mermaid.jsのSVGからバー位置を解析するロジックが必要。オーバーレイ位置とmermaid.js描画の同期が必要。

## 決定

C) mermaid.js SVG + 透明オーバーレイ層を採用。

ADR-001の教訓（DOM-basedイベント処理を優先）を適用し、オーバーレイ要素にdata-task-id, data-type, data-line属性を付与してブラウザネイティブのイベント伝播を利用する。座標ベースのhitTestは使用しない。

## 結果

- mermaid.jsが描画したSVGのrect要素からgetBBox()でバー位置を取得し、透明オーバーレイを生成する仕組みを実装。
- 選択ハイライト（破線枠）、リサイズハンドルもオーバーレイ層に配置。
- mermaid.jsのSVG構造変更の影響がbuildOverlay関数のバー検出ロジックに局所化された。

## 教訓

描画ライブラリのSVG出力に直接DOMイベントを付与するのではなく、透明オーバーレイ層を分離することで、描画ライブラリのバージョン変更に対する耐性と操作の自由度を両立できる。StableBlockのADR-001の教訓（DOM-basedイベント処理優先）は、外部ライブラリのSVG出力に対しても有効である。
```

- [ ] **Step 2: Write ADR-009**

`E:\00_Git\docs\adr\009-diagram-module-structure.md`:

```markdown
# ADR-009: 図種モジュール構造

- **ステータス**: 承認
- **カテゴリ**: architecture
- **日付**: 2026-03-30
- **対象プロジェクト**: MermaidAssist
- **関連ADR**: なし

## コンテキスト

MermaidAssistは初回リリースでガントチャートに対応するが、将来的にシーケンス図やフローチャートなどの他のMermaid図種もサポートする可能性がある。図種ごとにパーサー、オーバーレイ構築、プロパティパネル、テキスト更新のロジックが異なるため、拡張可能な構造が必要である。

## 検討した選択肢

### A) ハードコード分岐
if/switch文で図種を判定し、処理を分岐する。

- **メリット**: 初期実装が最もシンプル
- **デメリット**: 図種追加のたびに既存コードのif/switch文を修正する必要がある。分岐箇所が散在し保守困難。

### B) DiagramModuleインターフェース
図種ごとにdetect/parse/buildOverlay/renderProps/updateTextの共通インターフェースを持つモジュールオブジェクトを定義し、レジストリに登録する。

- **メリット**: 図種追加時に新しいモジュールオブジェクトを登録するだけで良い。既存コードへの変更が不要。各モジュールの責務が明確に分離される。
- **デメリット**: インターフェースの設計が必要。初回リリースではganttモジュールのみのため、オーバーエンジニアリングに見える可能性がある。

## 決定

B) DiagramModuleインターフェースを採用。

ただしYAGNI原則に従い、初回リリースではganttモジュールのみを実装し、抽象化のレイヤーは最小限に留める。モジュールレジストリ（modules{}）と自動検出（detect関数）の仕組みだけを用意し、過度なプラグインアーキテクチャは構築しない。

## 結果

```javascript
DiagramModule = {
  type:        "gantt",
  detect(text) → bool,
  parse(text)  → ParsedData,
  buildOverlay(svg, parsed) → void,
  renderProps(sel, parsed) → void,
  updateText(text, change) → text,
}
```

- detectはテキスト先頭のキーワードで図種を判定（ganttの場合は`text.trim().startsWith('gantt')`）。
- メインのrefresh関数はcurrentModuleの各メソッドを呼び出すだけで、図種固有のロジックに依存しない。
- 将来の図種追加は`modules.sequence = { ... }`のように登録するだけで完了する。

## 教訓

将来の拡張性を確保しつつYAGNIを守るバランスとして、「インターフェースだけ定義し、実装は必要になるまで作らない」アプローチが有効。レジストリパターンは既存コードへの変更なしに拡張可能であり、1つ目の実装（gantt）でインターフェースの妥当性を検証できる。
```

- [ ] **Step 3: Write ADR-010**

`E:\00_Git\docs\adr\010-date-pixel-calibration.md`:

```markdown
# ADR-010: 日付⇔ピクセル変換のキャリブレーション

- **ステータス**: 承認
- **カテゴリ**: rendering
- **日付**: 2026-03-30
- **対象プロジェクト**: MermaidAssist
- **関連ADR**: ADR-008

## コンテキスト

MermaidAssistではmermaid.jsが描画したガントチャートのバーをドラッグして日付を変更する機能を提供する。ドラッグのピクセル移動量を日数に変換するために、mermaid.jsのSVG座標系と日付の対応関係を把握する必要がある。

mermaid.jsはSVG座標系のスケール情報（1日あたり何ピクセルか）をAPIとして公開していないため、SVG出力から逆算する必要がある。

## 検討した選択肢

### A) mermaid.jsの内部パラメータ参照
mermaid.jsのソースコードを解析し、内部で使用しているスケール計算関数やD3スケールオブジェクトに直接アクセスする。

- **メリット**: 正確なスケール情報が得られる
- **デメリット**: mermaid.jsの内部APIに依存し、バージョン更新で壊れるリスクが極めて高い。内部APIは非公開であり安定性の保証がない。

### B) 既知タスクのSVG座標から逆算
パーサーが把握している開始日が異なる2つのタスクについて、mermaid.jsが描画したrect要素のx座標をgetBBox()で取得し、日付差とピクセル差からpxPerDayを算出する。

- **メリット**: mermaid.jsの外部出力（SVG DOM）のみに依存し、内部実装変更に強い。ADR-008のオーバーレイ方式と整合性がある。
- **デメリット**: 既知の2タスクが必要。タスクが1件以下や全タスクが同一開始日の場合はキャリブレーション不可。

## 決定

B) 既知タスクのSVG座標から逆算する方式を採用。

キャリブレーション手順：
1. パーサー結果から開始日が既知の2タスクを選択
2. 対応するSVG rect要素のx座標を取得
3. `pxPerDay = (rect2.x - rect1.x) / daysBetween(task1.start, task2.start)` で算出
4. `originX = rect1.x` を基準点として保持

フォールバック：
- タスク1件のみ：rect幅と日付範囲（endDate - startDate）から算出
- キャリブレーション不可の場合：ドラッグ操作を無効化（プロパティパネルでの日付編集は引き続き可能）

## 結果

- calibrateScale関数がmermaid.js描画後に毎回実行され、pxPerDay/originXを更新する。
- pxToDate/dateToPx関数がドラッグ操作でのピクセル↔日付変換を担当。
- 日単位への丸め処理（Math.round）により、ドラッグ操作が常に日単位でスナップする。

## 教訓

外部ライブラリのSVG出力からスケール情報を逆算する場合、最低限の既知データ（2点）で線形スケールを推定するアプローチが堅牢。内部API参照は短期的に正確でも長期的な保守コストが高い。キャリブレーション不可のケースでは機能を無効化して安全にフォールバックすることが重要。
```

- [ ] **Step 4: Commit ADRs**

```bash
cd /e/00_Git
git -C docs/adr/.. add docs/adr/008-mermaidjs-svg-overlay.md docs/adr/009-diagram-module-structure.md docs/adr/010-date-pixel-calibration.md
git -C docs/adr/.. commit -m "docs: add ADR-008, 009, 010 for MermaidAssist architecture decisions"
```

Note: ADRs live in the workspace-level `E:\00_Git\docs\adr\` repository, not in the MermaidAssist project repo. Ensure the working directory and git context are correct.

- [ ] **Step 5: Commit reference in MermaidAssist repo**

If the ADR directory is in a separate git repo, no further action needed in MermaidAssist. The CLAUDE.md already references the workspace-level ADR directory.

---

### Task 13: Final Integration + Browser Smoke Test

**Files:**
- Modify: `mermaid-assist.html` (final polish — ensure all pieces are wired together)

- [ ] **Step 1: Run full test suite**

```bash
cd /e/00_Git/05_MermaidAssist
node tests/run-tests.js
```

Expected: All parser and updater tests PASS.

- [ ] **Step 2: Browser smoke test checklist**

Open `mermaid-assist.html` in browser and verify each feature:

1. Default gantt chart renders in preview
2. Edit text → preview re-renders after 300ms
3. Click task bar → selection highlight + property panel shows fields
4. Edit property fields → text updates → preview re-renders
5. Drag task bar → dates change in text
6. Drag left/right handle → start/end date changes
7. Shift+Click → multi-select → batch operations work
8. Add task via property panel form
9. Delete task via button or Delete key
10. Ctrl+Z/Y → undo/redo works
11. Zoom buttons and Ctrl+wheel work
12. Save (.mmd) and Open file work
13. Export SVG, PNG, PNG transparent, clipboard all produce output
14. Ctrl+S saves, Escape clears selection

- [ ] **Step 3: Fix any issues found in smoke test**

Address any bugs discovered during manual testing.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: MermaidAssist v0.1.0 — gantt chart GUI editor with mermaid.js overlay"
```
