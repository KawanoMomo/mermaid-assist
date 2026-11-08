'use strict';
// flowchart の ID 改名で、ラベル定義より前にある参照行に旧 ID をラベルとして
// 書き足していた(TICKET-owner-20261109-0028-2)。
//   N9[処理9] --> N10        ← パーサは N10 をここ(最初に出た行)に置く
//   N10[処理10] --> N11      ← ラベル定義はこちら
// N10 を M10 に改名すると 1 行目が `N9[処理9] --> M10[N10]` になり、押していない字
// (`[N10]`)が増えた。mermaid は後の定義を採るので見た目は変わらず、定義行を消すと
// 旧 ID がラベルとして表に出る。差分は ID の箇所だけで閉じること(G1)。

var F = window.MA.modules.flowchart;

function diff(before, after) {
  var a = before.split('\n'), b = after.split('\n');
  var out = [];
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) out.push([a[i], b[i]]);
  }
  return out;
}

describe('flowchart: 定義より前の参照行からの改名', function() {
  var src = [
    'flowchart TD',
    '    N9[処理9] --> N10',
    '    N10[処理10] --> N11',
    '    N1[N10 の前] --> N100[処理100]',
    '    N11[N10]',
  ].join('\n');

  test('FB-1: パーサは N10 を参照行(2 行目)に置き、ラベルは定義から取る', function() {
    var n = F.parse(src).elements.filter(function(e) { return e.id === 'N10'; })[0];
    expect(n.line).toBe(2);
    expect(n.label).toBe('処理10');
  });

  test('FB-2: 改名の差分は ID の置換だけ(接頭辞を共有する id・同名ラベルを巻き込まない)', function() {
    var out = F.updateNode(src, 2, 'id', 'M10', 'N10');
    expect(diff(src, out)).toEqual([
      ['    N9[処理9] --> N10', '    N9[処理9] --> M10'],
      ['    N10[処理10] --> N11', '    M10[処理10] --> N11'],
    ]);
  });

  test('FB-3: 左辺の素の参照でも同じ', function() {
    var t = 'flowchart LR\n    A --> B\n    A[開始] --> C[終了]\n';
    var out = F.updateNode(t, 2, 'id', 'S', 'A');
    expect(diff(t, out)).toEqual([
      ['    A --> B', '    S --> B'],
      ['    A[開始] --> C[終了]', '    S[開始] --> C[終了]'],
    ]);
  });

  test('FB-4: 単独行の素の参照(subgraph 内の列挙)でも同じ', function() {
    var t = 'flowchart TD\n    subgraph G\n    X\n    end\n    X[入力] --> Y\n';
    var out = F.updateNode(t, 3, 'id', 'In', 'X');
    expect(diff(t, out)).toEqual([
      ['    X', '    In'],
      ['    X[入力] --> Y', '    In[入力] --> Y'],
    ]);
  });

  test('FB-5: primary の形(SpiDrv の定義が後ろ)。二重定義にならない', function() {
    var t = 'flowchart TD\n    Spi[SPI 初期化] --> SpiDrv\n    SpiDrv[SpiDrv] --> SpiDrvInit\n';
    var out = F.updateNode(t, 2, 'id', 'QspiDrv', 'SpiDrv');
    expect(diff(t, out)).toEqual([
      ['    Spi[SPI 初期化] --> SpiDrv', '    Spi[SPI 初期化] --> QspiDrv'],
      ['    SpiDrv[SpiDrv] --> SpiDrvInit', '    QspiDrv[SpiDrv] --> SpiDrvInit'],
    ]);
  });

  test('FB-6: ラベル定義がどこにも無いノードは今の方針どおり表示を保つ', function() {
    var t = 'flowchart TD\n    A --> B\n    B --> C\n';
    var out = F.updateNode(t, 2, 'id', 'Z', 'B');
    expect(out.split('\n')[1]).toBe('    A --> Z[B]');
    expect(out.split('\n')[2]).toBe('    Z --> C');
  });

  test('FB-7: 参照行でラベルを直すと定義行が変わり、参照行は変わらない', function() {
    var out = F.updateNode(src, 2, 'label', '処理10改', 'N10');
    expect(diff(src, out)).toEqual([
      ['    N10[処理10] --> N11', '    N10[処理10改] --> N11'],
    ]);
  });

  test('FB-8: 参照行で形を変えても定義行のラベルのまま形だけ変わる', function() {
    var out = F.updateNode(src, 2, 'shape', 'round', 'N10');
    expect(diff(src, out)).toEqual([
      ['    N10[処理10] --> N11', '    N10(処理10) --> N11'],
    ]);
  });

  test('FB-9: 定義が先にある図は従来どおり(定義行から改名)', function() {
    var t = 'flowchart TD\n    B --> C[終了]\n    C --> B\n';
    var out = F.updateNode(t, 2, 'id', 'D', 'C');
    expect(diff(t, out)).toEqual([
      ['    B --> C[終了]', '    B --> D[終了]'],
      ['    C --> B', '    D --> B'],
    ]);
  });

  test('FB-10: operations.update 経由でも同じ', function() {
    var out = F.operations.update(src, 2, 'id', 'M10', { id: 'N10' });
    expect(out.split('\n')[1]).toBe('    N9[処理9] --> M10');
  });
});
