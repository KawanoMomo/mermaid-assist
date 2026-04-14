# Tier1 Phase 0: 共通基盤整備リファクタ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の単一HTMLファイル構成から `src/{core,ui,modules}/*.js` への分割リファクタを行い、Tier1 マルチ図形対応の共通基盤を整備する（機能変更ゼロ、既存テスト全合格を維持）。

**Architecture:** `mermaid-assist.html` のインライン `<script>` を `src/` 配下に分割し、`<script src="...">` で個別読み込み。グローバル名前空間 `window.MA` で各モジュール間の参照を統一。ビルドステップ無し、ローカルファイルから直接実行可能を維持。

**Tech Stack:** バニラJS、Playwright (E2E), Node.js custom test runner (Unit)

**前提:** v0.4.0 (Gantt 単体対応版)、master ブランチ
**ベースライン:** 90 E2E + 35 Unit テスト全PASS
**完了基準:** リファクタ後も同じ 90 + 35 = 125 テストが全PASS

---

## Task 1: ブランチ作成 + ディレクトリ構造 + JS全移動

**Files:**
- Create: `E:/00_Git/05_MermaidAssist/src/app.js`
- Modify: `E:/00_Git/05_MermaidAssist/mermaid-assist.html`
- Modify: `E:/00_Git/05_MermaidAssist/tests/run-tests.js`

- [ ] **Step 1: ブランチ作成 + ディレクトリ作成**

```bash
cd "E:/00_Git/05_MermaidAssist"
git checkout master
git pull origin master  # 最新を取得
git checkout -b tier1/phase-0
mkdir -p src/core src/ui src/modules
```

- [ ] **Step 2: mermaid-assist.html から JS を src/app.js に移動**

`mermaid-assist.html` 内のインライン `<script>'use strict'; ... </script>` ブロック全体（約L432-L2276）の中身を `src/app.js` にコピー（`<script>` `</script>` タグは含めない、純粋なJSコードのみ）。

`mermaid-assist.html` の対応箇所を以下に置換:

```html
<script src="src/app.js"></script>
<!-- mermaid.js: loaded after main script; available by DOMContentLoaded -->
<script src="lib/mermaid.min.js"></script>
```

- [ ] **Step 3: tests/run-tests.js を src/app.js から読み込むように修正**

`tests/run-tests.js` の冒頭部分（HTMLからスクリプト抽出する部分）を以下に置換:

```javascript
'use strict';
const fs = require('fs');
const path = require('path');

// ── Load source files for unit tests ──
const projectRoot = path.resolve(__dirname, '..');
const sourceFiles = [
  'src/app.js',
];

let fns = {};
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
  __exportForTest: (obj) => { fns = obj; },
};

const keys = Object.keys(sandbox);
const vals = keys.map(k => sandbox[k]);

for (const relPath of sourceFiles) {
  const filePath = path.join(projectRoot, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`${relPath} not found yet — skipping`);
    continue;
  }
  const code = fs.readFileSync(filePath, 'utf-8');
  try {
    const fn = new Function(...keys, code);
    fn(...vals);
  } catch (e) {
    console.error(`Script eval error in ${relPath}:`, e.message);
  }
}

global.fns = fns;

// ── Minimal test framework (unchanged) ──
```

`// ── Minimal test framework ──` から下は既存のままにする。

- [ ] **Step 4: ユニットテスト実行で確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -5
```
Expected: `35 passed, 0 failed`

- [ ] **Step 5: E2Eテスト実行で確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && npx playwright test --reporter=list 2>&1 | tail -10
```
Expected: 90 passed, 0 failed

- [ ] **Step 6: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/app.js mermaid-assist.html tests/run-tests.js
git commit -m "refactor: move inline JS to src/app.js (Phase 0 setup)

- Created src/{core,ui,modules}/ directory structure
- Moved all inline script content from mermaid-assist.html to src/app.js
- Updated tests/run-tests.js to load src/app.js instead of HTML extraction
- All 90 E2E + 35 Unit tests still pass

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: MA名前空間導入 + core/date-utils.js + core/html-utils.js 抽出

**Files:**
- Create: `E:/00_Git/05_MermaidAssist/src/core/date-utils.js`
- Create: `E:/00_Git/05_MermaidAssist/src/core/html-utils.js`
- Modify: `E:/00_Git/05_MermaidAssist/src/app.js`
- Modify: `E:/00_Git/05_MermaidAssist/mermaid-assist.html`
- Modify: `E:/00_Git/05_MermaidAssist/tests/run-tests.js`

- [ ] **Step 1: src/core/date-utils.js を作成**

```javascript
'use strict';
window.MA = window.MA || {};
window.MA.dateUtils = (function() {
  function daysBetween(dateStr1, dateStr2) {
    var d1 = new Date(dateStr1), d2 = new Date(dateStr2);
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  function addDays(dateStr, days) {
    var d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().substring(0, 10);
  }

  return { daysBetween: daysBetween, addDays: addDays };
})();
```

- [ ] **Step 2: src/core/html-utils.js を作成**

```javascript
'use strict';
window.MA = window.MA || {};
window.MA.htmlUtils = (function() {
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { escHtml: escHtml };
})();
```

- [ ] **Step 3: src/app.js から `daysBetween`, `addDays`, `escHtml` を削除し、参照を MA経由に変更**

`src/app.js` 内で `function daysBetween(...)`, `function addDays(...)`, `function escHtml(...)` の3つの定義ブロックを削除（既存の`// ── Date Helpers ──`セクション、`// ── HTML Escape Helper ──`セクション）。

それらを呼び出している全箇所を以下に置換:
- `daysBetween(` → `MA.dateUtils.daysBetween(`
- `addDays(` → `MA.dateUtils.addDays(`
- `escHtml(` → `MA.htmlUtils.escHtml(`

ただし、`__exportForTest` で渡されている `daysBetween: daysBetween, addDays: addDays` の部分は `daysBetween: MA.dateUtils.daysBetween, addDays: MA.dateUtils.addDays` に変更。

- [ ] **Step 4: mermaid-assist.html の script タグ追加**

`<script src="src/app.js">` の **直前** に追加:

```html
<script src="src/core/date-utils.js"></script>
<script src="src/core/html-utils.js"></script>
```

- [ ] **Step 5: tests/run-tests.js のロード対象を更新**

`sourceFiles` 配列を以下に更新:

```javascript
const sourceFiles = [
  'src/core/date-utils.js',
  'src/core/html-utils.js',
  'src/app.js',
];
```

また、sandbox に `window` 名前空間が `MA` を保持できるよう確認: 既存の `window: { addEventListener: () => {} }` は問題なし（`window.MA = window.MA || {};` のパターンで動作）。

- [ ] **Step 6: テスト実行で確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -5 && npx playwright test --reporter=list 2>&1 | tail -10
```
Expected: 35 unit passed + 90 E2E passed

- [ ] **Step 7: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/core/ src/app.js mermaid-assist.html tests/run-tests.js
git commit -m "refactor: extract date-utils and html-utils to src/core/

Introduces window.MA namespace pattern for cross-module access.
All 125 tests still pass.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: core/text-updater.js 抽出

**Files:**
- Create: `E:/00_Git/05_MermaidAssist/src/core/text-updater.js`
- Modify: `E:/00_Git/05_MermaidAssist/src/app.js`
- Modify: `E:/00_Git/05_MermaidAssist/mermaid-assist.html`
- Modify: `E:/00_Git/05_MermaidAssist/tests/run-tests.js`

- [ ] **Step 1: src/core/text-updater.js を作成**

汎用テキスト操作プリミティブ。Gantt 専用の関数（`updateTaskDates`等）は対象外、行ベースの汎用操作のみ。

```javascript
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
    swapLines: swapLines,
    appendToFile: appendToFile,
  };
})();
```

- [ ] **Step 2: src/app.js の `deleteTask` 関数を MA.textUpdater.deleteLine 経由に書き換え**

既存の `deleteTask`:
```javascript
function deleteTask(text, lineNum) {
  var lines = text.split('\n');
  var idx = lineNum - 1;
  if (idx < 0 || idx >= lines.length) return text;
  lines.splice(idx, 1);
  return lines.join('\n');
}
```

を以下に変更:
```javascript
function deleteTask(text, lineNum) {
  return MA.textUpdater.deleteLine(text, lineNum);
}
```

`moveTaskWithinSection` 内の手動swap処理:
```javascript
  var lines = text.split('\n');
  var aLine = lineNum - 1;
  var bLine = siblings[swapIdx].line - 1;
  var tmp = lines[aLine];
  lines[aLine] = lines[bLine];
  lines[bLine] = tmp;
  return lines.join('\n');
```
を以下に変更:
```javascript
  return MA.textUpdater.swapLines(text, lineNum, siblings[swapIdx].line);
```

- [ ] **Step 3: HTMLとtests/run-tests.jsに text-updater.js を追加**

`mermaid-assist.html` の `<script src="src/core/html-utils.js">` の **後** に追加:
```html
<script src="src/core/text-updater.js"></script>
```

`tests/run-tests.js` の `sourceFiles` を更新:
```javascript
const sourceFiles = [
  'src/core/date-utils.js',
  'src/core/html-utils.js',
  'src/core/text-updater.js',
  'src/app.js',
];
```

- [ ] **Step 4: テスト実行で確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -5 && npx playwright test --reporter=list 2>&1 | tail -10
```
Expected: 35 unit + 90 E2E passed

- [ ] **Step 5: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/core/text-updater.js src/app.js mermaid-assist.html tests/run-tests.js
git commit -m "refactor: extract text-updater primitives to src/core/

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: core/parser-utils.js 抽出

**Files:**
- Create: `E:/00_Git/05_MermaidAssist/src/core/parser-utils.js`
- Modify: `E:/00_Git/05_MermaidAssist/src/app.js`
- Modify: `E:/00_Git/05_MermaidAssist/mermaid-assist.html`
- Modify: `E:/00_Git/05_MermaidAssist/tests/run-tests.js`

- [ ] **Step 1: src/core/parser-utils.js を作成**

```javascript
'use strict';
window.MA = window.MA || {};
window.MA.parserUtils = (function() {
  // detectDiagramType: 第1キーワードから図形タイプを判定
  // 戻り値: "gantt" | "sequenceDiagram" | "flowchart" | "classDiagram"
  //        | "stateDiagram" | "erDiagram" | null
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
```

- [ ] **Step 2: src/app.js の関連箇所を MA.parserUtils 経由に変更**

`parseGantt` 内の `var autoIdCounter = 0;` 後、`var taskId = p.id !== null ? p.id : '__auto_' + (autoIdCounter++);` を:
```javascript
    var taskId = p.id !== null ? p.id : MA.parserUtils.generateAutoId('auto', autoIdCounter++);
```

`rebuildTaskMeta` 内の `if (id && id.indexOf('__auto_') !== 0)` を:
```javascript
    if (id && !MA.parserUtils.isAutoId(id)) parts.push(id);
```

renderProps 内の `task.id.indexOf('__auto_') === 0` を:
```javascript
MA.parserUtils.isAutoId(task.id)
```

`detectModule` 関数は将来的に `parserUtils.detectDiagramType` を使うが、現在はモジュール側 `detect()` を呼ぶ実装なのでそのまま残す。

- [ ] **Step 3: HTML と tests/run-tests.js に追加**

`mermaid-assist.html` の `<script src="src/core/text-updater.js">` の後に:
```html
<script src="src/core/parser-utils.js"></script>
```

`tests/run-tests.js` の sourceFiles 配列に `'src/core/parser-utils.js'` を `text-updater.js` の後、`app.js` の前に追加。

- [ ] **Step 4: テスト実行で確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -5 && npx playwright test --reporter=list 2>&1 | tail -10
```
Expected: 35 + 90 passed

- [ ] **Step 5: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/core/parser-utils.js src/app.js mermaid-assist.html tests/run-tests.js
git commit -m "refactor: extract parser-utils (detectDiagramType, generateAutoId, etc.)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: core/history.js + core/selection.js 抽出

**Files:**
- Create: `E:/00_Git/05_MermaidAssist/src/core/history.js`
- Create: `E:/00_Git/05_MermaidAssist/src/core/selection.js`
- Modify: `E:/00_Git/05_MermaidAssist/src/app.js`
- Modify: `E:/00_Git/05_MermaidAssist/mermaid-assist.html`
- Modify: `E:/00_Git/05_MermaidAssist/tests/run-tests.js`

- [ ] **Step 1: src/core/history.js を作成**

このモジュールは `mmdText` を読み書きする必要がある。`MA.state` 経由でアクセスする方針。

```javascript
'use strict';
window.MA = window.MA || {};
window.MA.history = (function() {
  var MAX_HISTORY = 80;
  var undoStack = [];
  var future = [];

  // 初期化: app.js から呼ばれる
  function init(getMmdText, setMmdText, onUpdate) {
    // store callbacks for later use
    state.getMmdText = getMmdText;
    state.setMmdText = setMmdText;
    state.onUpdate = onUpdate;
  }

  var state = {
    getMmdText: function() { return ''; },
    setMmdText: function(t) {},
    onUpdate: function() {},
  };

  function pushHistory() {
    undoStack.push(state.getMmdText());
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    future = [];
    state.onUpdate();
  }

  function undo() {
    if (undoStack.length === 0) return;
    future.push(state.getMmdText());
    state.setMmdText(undoStack.pop());
    state.onUpdate();
  }

  function redo() {
    if (future.length === 0) return;
    undoStack.push(state.getMmdText());
    state.setMmdText(future.pop());
    state.onUpdate();
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return future.length > 0; }

  return {
    init: init,
    pushHistory: pushHistory,
    undo: undo,
    redo: redo,
    canUndo: canUndo,
    canRedo: canRedo,
  };
})();
```

- [ ] **Step 2: src/core/selection.js を作成**

```javascript
'use strict';
window.MA = window.MA || {};
window.MA.selection = (function() {
  var sel = [];
  var onChange = function() {};

  function init(callback) {
    onChange = callback || function() {};
  }

  function getSelected() {
    return sel.slice();
  }

  function setSelected(newSel) {
    sel = newSel.slice();
    onChange();
  }

  function isSelected(id) {
    return sel.some(function(s) { return s.id === id; });
  }

  function selectItem(type, id, multi) {
    if (multi) {
      var found = false;
      for (var i = 0; i < sel.length; i++) {
        if (sel[i].id === id) {
          sel.splice(i, 1);
          found = true;
          break;
        }
      }
      if (!found) {
        sel.push({ type: type, id: id });
      }
    } else {
      if (sel.length === 1 && sel[0].id === id) {
        sel = [];
      } else {
        sel = [{ type: type, id: id }];
      }
    }
    onChange();
  }

  function clearSelection() {
    sel = [];
    onChange();
  }

  return {
    init: init,
    getSelected: getSelected,
    setSelected: setSelected,
    isSelected: isSelected,
    selectItem: selectItem,
    clearSelection: clearSelection,
  };
})();
```

- [ ] **Step 3: src/app.js から該当ロジックを削除し MA経由で呼び出すように変更**

既存の `pushHistory`, `undo`, `redo`, `updateHistoryButtons`, `MAX_HISTORY`, `undoStack`, `future` の定義を削除（ボタン更新は後段で復活させる）。

`updateHistoryButtons` は UI 関連なので src/app.js の init 内に残し、`MA.history.init` のコールバックとして登録する:

`init()` 関数内で以下を追加（DOM参照取得後）:
```javascript
  // History initialization
  MA.history.init(
    function() { return mmdText; },
    function(t) { mmdText = t; suppressSync = true; editorEl.value = mmdText; suppressSync = false; syncLineNumbers(); scheduleRefresh(); },
    function() {
      var btnUndo = document.getElementById('btn-undo');
      var btnRedo = document.getElementById('btn-redo');
      if (btnUndo) btnUndo.disabled = !MA.history.canUndo();
      if (btnRedo) btnRedo.disabled = !MA.history.canRedo();
    }
  );

  // Selection initialization
  MA.selection.init(function() {
    sel = MA.selection.getSelected();
    renderProps();
    rebuildOverlay();
  });
```

`sel` は引き続きグローバル変数として保持し、`MA.selection.getSelected()` の結果を同期する形にする（移行期間の後方互換のため）。

`pushHistory()` の呼び出し全箇所を `MA.history.pushHistory()` に置換。
`undo()` を `MA.history.undo()` に。
`redo()` を `MA.history.redo()` に。

`selectItem`, `clearSelection`, `isSelected` の定義を削除し、呼び出しを `MA.selection.selectItem`, `MA.selection.clearSelection`, `MA.selection.isSelected` に変更。

`sel = [];` などの直接代入箇所は `MA.selection.setSelected([]);` に変更。
`sel = [{ type: 'task', id: id }];` は `MA.selection.setSelected([{ type: 'task', id: id }]);` に変更。
`sel.push(...)` などの直接操作は対応する MA.selection 経由の呼び出しに変更。

- [ ] **Step 4: HTML と tests/run-tests.js に追加**

`mermaid-assist.html` の `<script src="src/core/parser-utils.js">` の後に:
```html
<script src="src/core/history.js"></script>
<script src="src/core/selection.js"></script>
```

`tests/run-tests.js` の sourceFiles 配列に追加（`parser-utils.js` の後、`app.js` の前）:
```javascript
  'src/core/history.js',
  'src/core/selection.js',
```

- [ ] **Step 5: テスト実行で確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -5 && npx playwright test --reporter=list 2>&1 | tail -10
```
Expected: 35 + 90 passed

- [ ] **Step 6: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/core/history.js src/core/selection.js src/app.js mermaid-assist.html tests/run-tests.js
git commit -m "refactor: extract history and selection modules to src/core/

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: core/connection-mode.js スケルトン作成

**Files:**
- Create: `E:/00_Git/05_MermaidAssist/src/core/connection-mode.js`
- Modify: `E:/00_Git/05_MermaidAssist/mermaid-assist.html`
- Modify: `E:/00_Git/05_MermaidAssist/tests/run-tests.js`

このモジュールは Phase 1 以降で使用するため、スケルトン（API定義のみ）を作成する。

- [ ] **Step 1: src/core/connection-mode.js を作成**

```javascript
'use strict';
window.MA = window.MA || {};
window.MA.connectionMode = (function() {
  var active = false;
  var sourceType = null;
  var sourceId = null;
  var onCompleteCallback = null;

  // startConnectionMode: ソース要素を確定して接続モードに入る
  // 次のクリックでターゲットが選択され onComplete(targetType, targetId) が呼ばれる
  function startConnectionMode(srcType, srcId, onComplete) {
    active = true;
    sourceType = srcType;
    sourceId = srcId;
    onCompleteCallback = onComplete;
  }

  function cancelConnectionMode() {
    active = false;
    sourceType = null;
    sourceId = null;
    onCompleteCallback = null;
  }

  function isInConnectionMode() {
    return active;
  }

  // notifyTarget: overlay handler から target を確定したときに呼ぶ
  function notifyTarget(targetType, targetId) {
    if (!active || !onCompleteCallback) return;
    var cb = onCompleteCallback;
    var src = { type: sourceType, id: sourceId };
    cancelConnectionMode();
    cb(src, { type: targetType, id: targetId });
  }

  function getSource() {
    return active ? { type: sourceType, id: sourceId } : null;
  }

  return {
    startConnectionMode: startConnectionMode,
    cancelConnectionMode: cancelConnectionMode,
    isInConnectionMode: isInConnectionMode,
    notifyTarget: notifyTarget,
    getSource: getSource,
  };
})();
```

- [ ] **Step 2: HTML と tests/run-tests.js に追加**

`mermaid-assist.html` の `<script src="src/core/selection.js">` の後に:
```html
<script src="src/core/connection-mode.js"></script>
```

`tests/run-tests.js` の sourceFiles に `'src/core/connection-mode.js'` を追加。

- [ ] **Step 3: テスト実行で確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -5 && npx playwright test --reporter=list 2>&1 | tail -10
```
Expected: 35 + 90 passed（このファイルは未使用なので影響なし）

- [ ] **Step 4: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/core/connection-mode.js mermaid-assist.html tests/run-tests.js
git commit -m "feat: add connection-mode skeleton for future edge creation (Phase 1+)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: ui/properties.js 抽出（共通プロパティパネル基盤）

**Files:**
- Create: `E:/00_Git/05_MermaidAssist/src/ui/properties.js`
- Modify: `E:/00_Git/05_MermaidAssist/src/app.js`
- Modify: `E:/00_Git/05_MermaidAssist/mermaid-assist.html`
- Modify: `E:/00_Git/05_MermaidAssist/tests/run-tests.js`

- [ ] **Step 1: src/ui/properties.js を作成**

汎用プロパティパネルバインダ。app.js 内の `bindPropInput`, `bindPropDate` を移植 + 汎用化。

```javascript
'use strict';
window.MA = window.MA || {};
window.MA.properties = (function() {
  var state = {
    getMmdText: function() { return ''; },
    setMmdText: function(t) {},
    onUpdate: function() {},
    moduleUpdater: function(text, lineNum, field, value) { return text; },
  };

  function init(opts) {
    state.getMmdText = opts.getMmdText;
    state.setMmdText = opts.setMmdText;
    state.onUpdate = opts.onUpdate;
    state.moduleUpdater = opts.moduleUpdater;
  }

  // bindTextField: text input の change で moduleUpdater を呼んでテキスト更新
  function bindTextField(elId, lineNum, field) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.addEventListener('change', function() {
      MA.history.pushHistory();
      var newText = state.moduleUpdater(state.getMmdText(), lineNum, field, el.value);
      state.setMmdText(newText);
      state.onUpdate();
    });
  }

  // bindDateField: 開始日/終了日 ペアのバインド（gantt用、汎用化のため引数で関数注入）
  function bindDateField(startId, endId, lineNum, datesUpdater) {
    var startEl = document.getElementById(startId);
    var endEl = document.getElementById(endId);
    if (startEl) {
      startEl.addEventListener('change', function() {
        MA.history.pushHistory();
        var newText = datesUpdater(state.getMmdText(), lineNum, startEl.value, null);
        state.setMmdText(newText);
        state.onUpdate();
      });
    }
    if (endEl) {
      endEl.addEventListener('change', function() {
        MA.history.pushHistory();
        var newText = datesUpdater(state.getMmdText(), lineNum, null, endEl.value);
        state.setMmdText(newText);
        state.onUpdate();
      });
    }
  }

  return {
    init: init,
    bindTextField: bindTextField,
    bindDateField: bindDateField,
  };
})();
```

- [ ] **Step 2: src/app.js の `bindPropInput`, `bindPropDate` を MA.properties 経由に置換**

`bindPropInput(elId, lineNum, field)` の呼び出しを `MA.properties.bindTextField(elId, lineNum, field)` に。
`bindPropDate(startId, endId, lineNum)` の呼び出しを `MA.properties.bindDateField(startId, endId, lineNum, updateTaskDates)` に。

`bindPropInput` と `bindPropDate` の定義は削除。

`init()` 関数内に追加:
```javascript
  MA.properties.init({
    getMmdText: function() { return mmdText; },
    setMmdText: function(t) {
      mmdText = t;
      suppressSync = true;
      editorEl.value = mmdText;
      suppressSync = false;
      syncLineNumbers();
      scheduleRefresh();
    },
    onUpdate: function() { /* setMmdText already triggers refresh */ },
    moduleUpdater: function(text, lineNum, field, value) {
      return updateTaskField(text, lineNum, field, value);
    },
  });
```

- [ ] **Step 3: HTML と tests/run-tests.js に追加**

`mermaid-assist.html` の `<script src="src/core/connection-mode.js">` の後に:
```html
<script src="src/ui/properties.js"></script>
```

`tests/run-tests.js` の sourceFiles に `'src/ui/properties.js'` を追加（`connection-mode.js` の後、`app.js` の前）。

- [ ] **Step 4: テスト実行で確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -5 && npx playwright test --reporter=list 2>&1 | tail -10
```
Expected: 35 + 90 passed

- [ ] **Step 5: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/ui/properties.js src/app.js mermaid-assist.html tests/run-tests.js
git commit -m "refactor: extract properties UI helpers to src/ui/properties.js

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: src/modules/gantt.js 抽出（Gantt 全ロジック）

**Files:**
- Create: `E:/00_Git/05_MermaidAssist/src/modules/gantt.js`
- Modify: `E:/00_Git/05_MermaidAssist/src/app.js`
- Modify: `E:/00_Git/05_MermaidAssist/mermaid-assist.html`
- Modify: `E:/00_Git/05_MermaidAssist/tests/run-tests.js`

これが最大のタスク。Gantt 関連の全関数を `src/modules/gantt.js` に移動。

- [ ] **Step 1: src/modules/gantt.js を作成**

`src/app.js` から以下の関数を全て移動:
- `STATUS_KEYWORDS`, `DATE_RE`, `DURATION_RE` (定数)
- `parseGantt`
- `isDate`, `isDuration`, `isAfter`
- `rebuildTaskMeta`
- `parseTaskLine`
- `updateTaskDates`
- `updateTaskField`
- `addTask`
- `deleteTask`
- `sanitizeAfterDependencies`
- `addSection`
- `deleteSection`
- `updateGlobalSetting`
- `moveTaskWithinSection`
- `moveTaskToSection`
- `calibrateScale`
- `pxToDate`, `dateToPx`
- `var calibration = ...`
- `modules.gantt = { ... }` 定義全体（buildOverlay, renderProps, updateText, exportMmd, etc.）

ファイルの構造:
```javascript
'use strict';
window.MA = window.MA || {};
window.MA.modules = window.MA.modules || {};

(function() {
  // ── Constants ──
  var STATUS_KEYWORDS = [...];
  var DATE_RE = ...;
  var DURATION_RE = ...;

  // ── Helpers ──
  function isDate(s) { ... }
  // ... (全関数定義)

  // ── State (calibration is gantt-internal) ──
  var calibration = { pxPerDay: 0, originX: 0, baseDate: '', barRects: [] };

  // ── Module export ──
  window.MA.modules.gantt = {
    type: 'gantt',
    displayName: 'Gantt',
    detect: function(text) { return text.trim().startsWith('gantt'); },
    parse: parseGantt,
    buildOverlay: function(svgEl, parsedData) { /* 既存実装 */ },
    renderProps: function(selData, parsedData) { /* 既存実装、外部依存はwindow経由 */ },
    operations: {
      add: function(text, kind, props) { return addTask(text, props.sectionIndex, props.label, props.id, props.startDate, props.endDate); },
      delete: deleteTask,
      update: updateTaskField,
      moveUp: function(text, lineNum) { return moveTaskWithinSection(text, lineNum, -1); },
      moveDown: function(text, lineNum) { return moveTaskWithinSection(text, lineNum, 1); },
      connect: function() { return arguments[0]; }, // gantt は after依存だけ、connect は使わない
    },
    updateText: function(text, change) {
      if (change.type === 'dates')  return updateTaskDates(text, change.line, change.startDate, change.endDate);
      if (change.type === 'field')  return updateTaskField(text, change.line, change.field, change.value);
      if (change.type === 'add')    return addTask(text, change.sectionIndex, change.label, change.id, change.startDate, change.endDate);
      if (change.type === 'delete') return deleteTask(text, change.line);
      return text;
    },
    exportMmd: function(parsedData) { /* 既存実装、ただしmmdTextを直接参照する箇所を見直す */ },
    template: function() {
      return [
        'gantt',
        '    title プロジェクト計画',
        '    dateFormat YYYY-MM-DD',
        '    axisFormat %m/%d',
        '',
        '    section 要件定義',
        '    要件分析           :a1, 2026-04-01, 2026-04-15',
      ].join('\n');
    },

    // 内部関数も公開（テストおよびドラッグ等の app.js 側で必要）
    _internal: {
      parseGantt: parseGantt,
      parseTaskLine: parseTaskLine,
      rebuildTaskMeta: rebuildTaskMeta,
      updateTaskDates: updateTaskDates,
      updateTaskField: updateTaskField,
      addTask: addTask,
      deleteTask: deleteTask,
      sanitizeAfterDependencies: sanitizeAfterDependencies,
      addSection: addSection,
      deleteSection: deleteSection,
      updateGlobalSetting: updateGlobalSetting,
      moveTaskWithinSection: moveTaskWithinSection,
      moveTaskToSection: moveTaskToSection,
      calibrateScale: calibrateScale,
      pxToDate: pxToDate,
      dateToPx: dateToPx,
      getCalibration: function() { return calibration; },
      DATE_RE: DATE_RE,
      DURATION_RE: DURATION_RE,
      STATUS_KEYWORDS: STATUS_KEYWORDS,
    },
  };
})();
```

注意点:
- `MA.dateUtils.daysBetween` / `MA.dateUtils.addDays` を内部で使用
- `MA.htmlUtils.escHtml` を内部で使用
- `MA.parserUtils.isAutoId`, `generateAutoId` を内部で使用
- `MA.textUpdater.deleteLine`, `swapLines` を内部で使用
- `MA.history.pushHistory` を直接呼ぶのではなく、外側 (app.js) に委ねる

`renderProps` 内で `pushHistory()` を呼んでいる箇所は `MA.history.pushHistory()` に。
`mmdText` の参照は、関数引数で受け取るか、`MA.state.mmdText` のような共有state経由にする（後段で整理）。

実装時の注意: gantt.js から `mmdText` への直接参照が多数ある。これらは引数化するか、ミニマルには `window.mmdText` 経由でアクセスする一時しのぎでも良い（次タスクで整理）。本タスクでは「機能等価の維持」が最優先。

- [ ] **Step 2: src/app.js から Gantt 関連定義を全削除**

Gantt関連の関数定義（前述のリスト）を削除。
`modules.gantt = { ... }` の代入も削除。
`var modules = {};` `var currentModule = null;` は app.js に残す（モジュール検出用）。
`detectModule` 関数は `window.MA.modules` を見るように変更:

```javascript
function detectModule(text) {
  var keys = Object.keys(MA.modules || {});
  for (var i = 0; i < keys.length; i++) {
    if (MA.modules[keys[i]].detect(text)) return MA.modules[keys[i]];
  }
  return null;
}
```

`__exportForTest` の呼び出し箇所を更新（gantt._internal経由でアクセス）:

```javascript
if (typeof __exportForTest === 'function') {
  __exportForTest({
    parseGantt: MA.modules.gantt._internal.parseGantt,
    updateTaskDates: MA.modules.gantt._internal.updateTaskDates,
    updateTaskField: MA.modules.gantt._internal.updateTaskField,
    addTask: function(text, sectionIndex, label, id, startDate, endDate) {
      return MA.modules.gantt._internal.addTask(text, sectionIndex, label, id, startDate, endDate);
    },
    deleteTask: MA.modules.gantt._internal.deleteTask,
    daysBetween: MA.dateUtils.daysBetween,
    addDays: MA.dateUtils.addDays,
  });
}
```

- [ ] **Step 3: HTML と tests/run-tests.js に追加**

`mermaid-assist.html` の `<script src="src/ui/properties.js">` の後、`<script src="src/app.js">` の前に:
```html
<script src="src/modules/gantt.js"></script>
```

`tests/run-tests.js` の sourceFiles に `'src/modules/gantt.js'` を追加（`src/ui/properties.js` の後、`src/app.js` の前）。

- [ ] **Step 4: テスト実行で確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -5 && npx playwright test --reporter=list 2>&1 | tail -10
```
Expected: 35 + 90 passed

このタスクは難易度が高いため失敗時はデバッグ・反復必要。テストFAIL時の典型原因:
- 関数間の依存（parseGantt → parseTaskLine等）が同一IIFE内に閉じこもっていない
- mmdText など外部変数の参照が壊れている
- `MA.modules.gantt._internal` 経由の参照ミス

- [ ] **Step 5: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/modules/gantt.js src/app.js mermaid-assist.html tests/run-tests.js
git commit -m "refactor: extract Gantt module to src/modules/gantt.js

Largest extraction in Phase 0: all gantt parser/updater/overlay/render
logic moved to a self-contained module exposing the v2 DiagramModule
interface (with operations.{add,delete,update,moveUp,moveDown}).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: app.js 整理（残ったロジックの整理）

**Files:**
- Modify: `E:/00_Git/05_MermaidAssist/src/app.js`

Task 1-8 完了時点で `src/app.js` は init/state/pipeline と一部のUIハンドラ（drag, keyboard等）が残っているはず。整理して責務を明確化する。

- [ ] **Step 1: src/app.js の構造を整理**

src/app.js は以下のセクションのみを含む状態にする:

```javascript
'use strict';

// ── Application State ──
var mmdText = '';
var parsed = { ... };
var sel = [];
var zoom = 1.0;
var suppressSync = false;
var debounceTimer = null;
var DRAG_RENDER_INTERVAL = 100;
var dragRenderTimer = null;
var renderCounter = 0;
var clipboard = null;
var addCounter = 0;
var currentModule = null;

// ── DOM References ──
var editorEl, lineNumEl, previewSvgEl, overlayEl, propsEl;
var statusParseEl, statusInfoEl, zoomDisplayEl;

// ── Drag State ──
var dragState = null;

// ── Module Detection / Refresh Pipeline ──
function detectModule(text) { ... }
function scheduleRefresh() { ... }
async function refresh(skipRender) { ... }
function rebuildOverlay() { ... }
function syncLineNumbers() { ... }
function renderStatus() { ... }
function renderProps() { ... }

// ── Zoom ──
function setZoom(z) { ... }
function zoomToFit() { ... }

// ── File I/O / Export ──
function openFile() { ... }
function saveFile() { ... }
function exportSVG() { ... }
function svgToCanvas(transparent, callback) { ... }
function exportPNG(transparent) { ... }
function exportClipboard() { ... }

// ── Init ──
function init() {
  // DOM refs
  // mermaid.initialize
  // History init (MA.history.init)
  // Selection init (MA.selection.init)
  // Properties init (MA.properties.init)
  // Default content
  // Editor events
  // Toolbar bindings
  // File input handler
  // Export menu
  // Wheel zoom
  // Overlay click + drag
  // Document mousemove (drag)
  // Document mouseup
  // Keyboard shortcuts
  // Pane resizers
  // Initial render
}

document.addEventListener('DOMContentLoaded', init);

// ── Test export ──
if (typeof __exportForTest === 'function') {
  __exportForTest({ ... });
}
```

このタスクでは大きな機能変更はせず、Task 1-8 で削除し損ねた死コードや重複の整理が中心。

- [ ] **Step 2: 重複・死コード除去**

- `escHtml` が残っていれば削除（MA.htmlUtils.escHtml を使う）
- `daysBetween`, `addDays` が残っていれば削除（MA.dateUtils を使う）
- `bindPropInput`, `bindPropDate` が残っていれば削除（MA.properties.bind* を使う）
- `pushHistory`, `undo`, `redo`, `updateHistoryButtons`, `MAX_HISTORY`, `undoStack`, `future` が残っていれば削除
- `selectItem`, `clearSelection`, `isSelected` が残っていれば削除
- gantt 関連関数の残骸を削除

- [ ] **Step 3: テスト実行で確認**

```bash
cd "E:/00_Git/05_MermaidAssist" && node tests/run-tests.js 2>&1 | tail -5 && npx playwright test --reporter=list 2>&1 | tail -10
```
Expected: 35 + 90 passed

- [ ] **Step 4: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add src/app.js
git commit -m "refactor: clean up src/app.js (remove dead code, consolidate sections)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: ADR 011-014 追加

**Files:**
- Create: `E:/00_Git/05_MermaidAssist/docs/adr/ADR-011-js-modular-split.md`
- Create: `E:/00_Git/05_MermaidAssist/docs/adr/ADR-012-diagram-module-v2.md`
- Create: `E:/00_Git/05_MermaidAssist/docs/adr/ADR-013-connection-mode.md`
- Create: `E:/00_Git/05_MermaidAssist/docs/adr/ADR-014-groups-substructure.md`

プロジェクト内 `docs/adr/` ディレクトリにADRを作成。Context / Decision / Consequences の標準形式で記述。

- [ ] **Step 1: ADRディレクトリ作成**

```bash
mkdir -p "E:/00_Git/05_MermaidAssist/docs/adr"
```

- [ ] **Step 2: ADR-011 JS外部分割**

```bash
cat > "E:/00_Git/05_MermaidAssist/docs/adr/ADR-011-js-modular-split.md" << 'EOF'
# ADR-011: JS外部分割によるモジュール構造

**Status:** Accepted
**Date:** 2026-04-14
**Project:** 05_MermaidAssist

## Context

Tier1 マルチ図形対応に伴い、`mermaid-assist.html` 単一ファイル（約2400行）
の規模が拡大する。1ファイルでの管理は次の問題を生む:
- AIエージェントの編集精度低下（コンテキスト超過）
- レビュー難航
- 並列開発困難

一方、配布の手軽さ（ブラウザでHTML開くだけで動作、ビルド不要）は維持したい。

## Decision

JSを `src/{core,ui,modules}/*.js` に分割し、`mermaid-assist.html` から
`<script src="...">` で個別読み込み。バンドラー導入はせず、グローバル
名前空間 `window.MA` で各モジュール間の参照を統一する。

## Consequences

### Positive
- ファイル単位の責務明確化、可読性向上
- AIエージェントの編集精度改善
- ビルドステップ不要、配布シンプル
- 既存テストランナーは複数JS連結で対応

### Negative
- スクリプト読み込み順序の管理が必要
- グローバル名前空間汚染（`MA` 1つ）
- ES modules的な依存解決を持たない

### Neutral
- 必要になればバンドラー導入は容易（ADR-015で検討予定）
EOF
```

- [ ] **Step 3: ADR-012 DiagramModule v2**

```bash
cat > "E:/00_Git/05_MermaidAssist/docs/adr/ADR-012-diagram-module-v2.md" << 'EOF'
# ADR-012: DiagramModule v2 インターフェース

**Status:** Accepted
**Date:** 2026-04-14
**Project:** 05_MermaidAssist

## Context

v0.4.0 までの DiagramModule (ADR-009) は Gantt 専用に設計されており、
他図形（Flowchart, Sequence等）では編集プリミティブの共通化が困難だった。
Tier1 マルチ図形対応に向けて統一インターフェースが必要。

## Decision

DiagramModule v2 として以下を標準化:
- `operations: { add, delete, update, moveUp, moveDown, connect }` を共通
  プリミティブとして定義
- `parse()` の戻り値に `groups` フィールドを追加（subgraph, composite
  state, loop/alt 等のサブ要素表現）
- `template()` を追加（新規作成時のひな型生成）

## Consequences

### Positive
- 全図形モジュールが同一インターフェースで実装できる
- UI層（properties.js）が統一APIで動作
- 新図形追加時の認知負荷低減

### Negative
- Gantt の既存 `updateText(text, change)` は互換のため残置
- `connect` は Gantt では使わないが noop 実装が必要
EOF
```

- [ ] **Step 4: ADR-013 Connection Mode**

```bash
cat > "E:/00_Git/05_MermaidAssist/docs/adr/ADR-013-connection-mode.md" << 'EOF'
# ADR-013: Connection Mode による汎用エッジ作成

**Status:** Accepted
**Date:** 2026-04-14
**Project:** 05_MermaidAssist

## Context

Flowchart, Sequence, Class, State, ER の各図形でエッジ/関係/遷移を
GUI で作成する操作が必要。図形ごとに操作モデルを変えると学習負荷が高い。

## Decision

クリック2回でソース→ターゲット指定するConnection Modeを共通機構として
`src/core/connection-mode.js` に実装。各図形モジュールの
`operations.connect(text, fromId, toId, props)` を呼び出す。

API:
- `startConnectionMode(srcType, srcId, onComplete)` — モード突入
- `cancelConnectionMode()` — Esc等で中断
- `notifyTarget(targetType, targetId)` — overlay click handlerから呼ぶ

## Consequences

### Positive
- 全図形で統一の接続操作
- カーソル変化等のUIフィードバックを共通化可能
- 単独テスト容易（モード状態を持つだけ）

### Negative
- モード状態管理が必要（active/inactive）
- 誤操作時のキャンセル経路（Esc, 別要素クリック）を全図形で考慮必要
EOF
```

- [ ] **Step 5: ADR-014 Groups Substructure**

```bash
cat > "E:/00_Git/05_MermaidAssist/docs/adr/ADR-014-groups-substructure.md" << 'EOF'
# ADR-014: サブ要素 (groups) のパース・編集モデル

**Status:** Accepted
**Date:** 2026-04-14
**Project:** 05_MermaidAssist

## Context

Mermaid の図形には階層構造を持つ要素がある:
- Flowchart: subgraph
- Sequence: loop, alt, par, opt
- State: composite state, fork/join
- Class: namespace

これらを統一形式でパース・編集する必要がある。

## Decision

ParsedData に `groups` 配列を追加:
```javascript
groups: [
  {
    kind: "subgraph"|"loop"|"alt"|"composite"|...,
    id: "...",
    line: ...,        // 開始行 (1-based)
    endLine: ...,     // 終了行 (end キーワード)
    label: "...",
    children: [...]   // 含まれる element ID
  }
]
```

## Consequences

### Positive
- 階層を持つ図形を統一表現できる
- ネスト構造の検証が共通ロジックで可能

### Negative
- ER 等のシンプルな図形では未使用フィールドとなる
- 行範囲（line, endLine）の整合性管理が必要
EOF
```

- [ ] **Step 6: コミット**

```bash
cd "E:/00_Git/05_MermaidAssist" && git add docs/adr/
git commit -m "docs: add ADRs 011-014 for Tier1 architecture decisions

- ADR-011: JS modular split with global namespace MA
- ADR-012: DiagramModule v2 interface (operations, groups, template)
- ADR-013: Connection mode for generic edge creation
- ADR-014: Groups model for substructure (subgraph, composite, loop/alt)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: 最終検証 + VERSIONバンプ + マージ準備

**Files:**
- Modify: `E:/00_Git/05_MermaidAssist/VERSION`
- Modify: `E:/00_Git/05_MermaidAssist/CLAUDE.md` (アーキテクチャセクション更新)

- [ ] **Step 1: 全テスト実行（最終）**

```bash
cd "E:/00_Git/05_MermaidAssist"
node tests/run-tests.js 2>&1 | tail -5
npx playwright test --reporter=list 2>&1 | tail -10
```
Expected: 35 unit + 90 E2E = 125 全PASS

- [ ] **Step 2: ブラウザでHTMLを直接開いて目視確認**

```bash
# Windows の場合
start "" "E:\00_Git\05_MermaidAssist\mermaid-assist.html"
```

確認項目:
- ガントチャートが描画されている
- バーをクリックして選択できる
- バーをドラッグして日付が変わる
- プロパティパネルが動作する
- セクション一覧、削除ができる
- axisFormatプリセット選択ができる
- ブラウザコンソールにエラーがない

- [ ] **Step 3: VERSION を 0.5.0 に更新**

```
0.5.0
```

- [ ] **Step 4: CLAUDE.md のアーキテクチャセクション更新**

`E:/00_Git/05_MermaidAssist/CLAUDE.md` の「アーキテクチャ」セクションを以下に置換:

```markdown
## アーキテクチャ

- 単一HTML配布 (mermaid-assist.html)、ビルドステップなし
- JS外部分割 src/{core,ui,modules}/*.js + window.MA 名前空間 (ADR-011)
- mermaid.js v11 (lib/mermaid.min.js, MIT) で SVG描画
- SVGオーバーレイ層 (ADR-008) で透明な操作要素を重畳
- DiagramModule v2 インターフェース (ADR-012) で図形拡張可能
  - core/: parser-utils, text-updater, history, selection, connection-mode
  - ui/: properties (toolbar/editor/preview/overlay/statusbar は次フェーズ)
  - modules/: gantt（v0.5.0時点）、sequence/flowchart/state/class/er を順次追加予定
```

- [ ] **Step 5: コミット + master へマージ**

```bash
cd "E:/00_Git/05_MermaidAssist"
git add VERSION CLAUDE.md
git commit -m "chore: bump version to 0.5.0 for Phase 0 refactor

Phase 0 complete: JS externalized to src/{core,ui,modules}/, all 125
tests pass. No behavior change. Foundation for Tier1 multi-diagram
support is now in place.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"

# masterへマージ（承認済み）
git checkout master
git merge --no-ff tier1/phase-0 -m "Merge tier1/phase-0: refactor for multi-diagram architecture (v0.5.0)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"

# GitHub にプッシュ
git push origin master
git tag -a v0.5.0 -m "v0.5.0 — Phase 0: JS modular split (no behavior change)"
git push origin v0.5.0
```

- [ ] **Step 6: 完了報告**

Phase 0 完了。次は Phase 1 (Sequence Diagram) の brainstorming → spec → plan → 実装。
