'use strict';
// tests/render-cases/rename-cascade.json を生成する。
// 「GUI で ID をリネームした結果のテキスト」を実モジュールに作らせ、
// リネーム前と並べて render-oracle に食わせるのが狙い。手書きの期待値を置くと
// 実装が変わったときに嘘になるので、必ず実モジュールの出力を使う。
//
//   node tests/gen-rename-cases.js && node tests/render-oracle.js tests/render-cases/rename-cascade.json
const fs = require('fs');
const path = require('path');

global.window = { MA: { modules: {} } };
[ 'core/text-updater', 'core/parser-utils', 'core/date-utils',
  'modules/c4', 'modules/flowchart', 'modules/architecture',
  'modules/gantt', 'modules/gitgraph', 'modules/sequence', 'modules/block', 'modules/state',
].forEach(m => require(path.join(__dirname, '..', 'src', m + '.js')));

const M = window.MA.modules;
const cases = [];
function pair(name, before, after, opts) {
  cases.push({ name: name + '/before', text: before });
  cases.push(Object.assign({ name: name + '/after', text: after }, opts || {}));
}

let t;

t = 'C4Context\n  title システム\n  Person(user, "利用者")\n  System(sys, "基幹")\n  Rel(user, sys, "利用")\n';
pair('c4-rename', t, M.c4.updateElement(t, 3, 'id', 'customer'));

t = 'flowchart TD\n    A[開始]\n    B[処理]\n    A --> B\n    B -.-> A\n';
pair('flowchart-rename', t, M.flowchart.updateNode(t, 2, 'id', 'Start'));

t = 'architecture-beta\n  group g(cloud)[Cloud]\n  service api(server)[API] in g\n' +
    '  service db(database)[DB] in g\n  api:R -- L:db\n';
pair('architecture-rename', t, M.architectureBeta.updateElement(t, 3, 'id', 'gateway'));

// 「後ろのタスクの方が先に書かれている」形にしてあるのは、after 参照が切れたときに
// 「直前のタスクの終わり」との区別がつくようにするため。両者が同じ位置だと、
// 参照が壊れていてもバーが動かず、テストが素通りする。
t = 'gantt\n    dateFormat YYYY-MM-DD\n    axisFormat %m/%d\n    section S\n' +
    '    検証 :v1, 2026-06-01, 5d\n    設計 :t1, 2026-03-01, 5d\n    実装 :impl, after t1, 10d\n';
pair('gantt-rename', t, M.gantt.updateTaskField(t, 6, 'id', 'design'));

t = 'gitGraph\n  commit\n  branch dev\n  checkout dev\n  commit\n  checkout main\n  merge dev\n';
// gitgraph は commit ハッシュを毎回ランダムに振るのでテキストは一致しない
pair('gitgraph-rename', t, M.gitGraph.updateBranch(t, 3, 'feature'), { allowTextChange: true });

t = 'sequenceDiagram\n    participant A as 端末\n    participant B as サーバ\n' +
    '    A->>B: 要求\n    activate B\n    B-->>A: 応答\n    deactivate B\n';
pair('sequence-rename', t, M.sequence.updateParticipant(t, 2, 'id', 'Client'));

// block-beta は1行に複数ブロックを書くのが標準形なので、ID が前方一致する組を
// 並べておく。トークン境界を取り違えると隣のブロックが巻き添えになるが、
// mermaid は黙って描いてしまうのでテキスト比較でしか気づけない。
t = 'block-beta\n  columns 3\n  a["A"] ab["AB"] abc["ABC"]\n  a --> ab\n';
pair('block-label-edit', t, M.blockBeta.updateBlockLabel(t, 3, 'a', 'センサ'), { expectText: 'センサABABC' });
pair('block-id-rename', t, M.blockBeta.updateBlockId(t, 3, 'a', 'sensor'));

// flowchart はエッジ行の中でノードを宣言するので、1行が複数ノードの宣言を兼ねる。
// 行ごと消すと押していないノードが消え、押したノードはラベルを失う。
// 描画テキストで「何が残ったか」を固定する。
t = 'flowchart TD\n    A[開始] --> B[処理]\n    B --> C[判定]\n    C --> D[終了]\n';
pair('flowchart-delete-node', t, M.flowchart.deleteNode(t, 2, 'B'), { expectText: '開始判定終了' });
pair('flowchart-delete-edge', t, M.flowchart.deleteEdge(t, 2), { expectText: '開始処理判定終了' });

t = 'flowchart TD\n    subgraph G[群]\n    X[x]\n    Y[y]\n    end\n    X --> Z[z]\n';
pair('flowchart-delete-subgraph', t, M.flowchart.deleteSubgraph(t, 2, 5), { expectText: 'z' });

// state は ID 欄が繋がっておらず、そもそもリネームできなかった (R18 で判明)。
// 状態は遷移行で宣言されるので、片側だけ書き換えると mermaid は残った参照から
// 古い ID の状態を作り直す。「消えたはずの状態が図に残る」のと同じ形なので、
// 描画テキストで固定する。
t = 'stateDiagram-v2\n    [*] --> Idle\n    Idle --> Running : start\n' +
    '    Running --> Idle : stop\n    Running --> [*]\n';
pair('state-id-rename', t, M.state.updateStateId(t, 'Idle', '待機'),
  // 並びは mermaid が決める (遷移ラベルが先に来る)。肝は Idle が1つも残らないこと。
  { expectText: 'startstop待機Running', expectAbsent: ['Idle'] });

// 別名宣言を持つ状態。ID を変えてもラベルは動かないこと。
t = 'stateDiagram-v2\n    state "実行中" as Running\n    [*] --> Running\n    Running --> [*]\n';
pair('state-id-rename-alias', t, M.state.updateStateId(t, 'Running', 'Active'),
  { expectText: '実行中' });

const out = path.join(__dirname, 'render-cases', 'rename-cascade.json');
fs.writeFileSync(out, JSON.stringify(cases, null, 1) + '\n');
console.log('wrote ' + cases.length + ' cases → ' + path.relative(path.join(__dirname, '..'), out));
