'use strict';
// 削除の実描画ケースを作る。
//
// 単体テストは「パーサが要素を返さなくなった」までしか見ない。mermaid は
// 参照 (`A->>B`) だけで要素を作るので、パーサ的に消えていても図には残る。
// 消えたことを主張できるのは実描画だけなので、before/after の図を実際に
// mermaid で描かせ、消したラベルが消えたことと、他が巻き添えを食っていない
// ことを見る。
//
//   node tests/gen-delete-cases.js        → tests/render-cases/delete-cascade.json
const fs = require('fs');
const path = require('path');

global.window = { MA: { modules: {} } };
['core/date-utils', 'core/html-utils', 'core/text-updater', 'core/parser-utils']
  .forEach(f => { try { require(path.join(__dirname, '..', 'src', f + '.js')); } catch (e) {} });
fs.readdirSync(path.join(__dirname, '..', 'src', 'modules'))
  .filter(f => f.endsWith('.js'))
  .forEach(f => { try { require(path.join(__dirname, '..', 'src', 'modules', f)); } catch (e) {} });
const M = global.window.MA.modules;

// [名前, モジュール, 元テキスト, 削除の呼び方, 消えるべき語, 残るべき語]
const SPECS = [
  ['sequence-participant', 'sequence',
    'sequenceDiagram\n    participant A as アルファ\n    participant B as ブラボー\n' +
    '    participant C as チャーリー\n    A->>B: m1\n    B->>C: m2\n    A->>C: m3\n',
    m => m.deleteParticipant, 3, 'B', ['ブラボー', 'm1', 'm2'], ['アルファ', 'チャーリー', 'm3']],

  ['class-delete', 'classDiagram',
    'classDiagram\n    class Animal {\n        +String name\n    }\n    class Dog\n    Animal <|-- Dog\n',
    m => m.deleteClass, 2, 'Animal', ['Animal', 'name'], ['Dog']],

  ['state-delete', 'state',
    'stateDiagram-v2\n    [*] --> Idle\n    Idle --> Run\n    Run --> Idle\n    Run --> [*]\n',
    m => m.deleteState, 2, 'Idle', ['Idle'], ['Run']],

  ['flowchart-delete', 'flowchart',
    'flowchart TD\n    A["開始"]\n    B["処理"]\n    C["終了"]\n    A --> B\n    B --> C\n',
    m => m.deleteNode, 3, 'B', ['処理'], ['開始', '終了']],
];

const cases = [];
SPECS.forEach((s) => {
  const [name, modKey, text, pick, line, id, absent, present] = s;
  const mod = M[modKey];
  if (!mod) { console.error('モジュールが無い: ' + modKey); process.exit(1); }
  const fn = pick(mod);
  if (typeof fn !== 'function') { console.error('削除関数が無い: ' + modKey); process.exit(1); }
  const after = fn(text, line, id);
  if (after === text) { console.error('削除が本文を変えていない: ' + name); process.exit(1); }
  cases.push({ name: name + '/before', text: text });
  cases.push({ name: name + '/after', text: after, expectAbsent: absent, expectPresent: present });
});

const out = path.join(__dirname, 'render-cases', 'delete-cascade.json');
fs.writeFileSync(out, JSON.stringify(cases, null, 1));
console.log('削除ケース ' + (cases.length / 2) + ' 組を生成: ' + out);
