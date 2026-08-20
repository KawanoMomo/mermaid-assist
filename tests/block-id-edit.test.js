'use strict';
// block-beta のブロック編集パネル (ID / Label) の検証。
//
// 1) updateBlockLabel が、前方一致する別ブロックまで書き換えて行を壊していた。
//    `\b` + id の正規表現には後方の境界が無いので、`a` を編集すると `ab` `abc` の
//    先頭にもマッチしていた。parse も render も成功するので、図に無いブロックが
//    生えるだけでエラーは出ない。
// 2) 選択パネルの ID 欄 (#block-edit-id) は表示されるだけで change ハンドラが
//    無く、入力しても何も起きない死んだ入力だった。e2e は「見えること」しか
//    assert していないので通っていた。

var B = window.MA.modules.blockBeta;

describe('block: ラベル編集が前方一致する別ブロックを壊さない', function() {
  var src = 'block-beta\n  columns 3\n  a["A"] ab["AB"] abc["ABC"]\n  a --> ab\n';

  test('BL-1: 指定したブロックだけラベルが変わる', function() {
    var out = B.updateBlockLabel(src, 3, 'a', 'センサ').split('\n');
    expect(out[2]).toBe('  a["センサ"] ab["AB"] abc["ABC"]');
  });

  test('BL-2: 前方一致するブロックのIDが壊れない', function() {
    var out = B.updateBlockLabel(src, 3, 'a', 'センサ');
    var ids = B.parseBlock(out).elements.map(function(e) { return e.id; });
    expect(ids).toEqual(['a', 'ab', 'abc']);
  });

  test('BL-3: 途中のブロックを編集しても他は無傷', function() {
    var out = B.updateBlockLabel(src, 3, 'ab', 'マイコン').split('\n');
    expect(out[2]).toBe('  a["A"] ab["マイコン"] abc["ABC"]');
  });

  test('BL-4: ラベルを空にするとラベル部分だけ落ちる', function() {
    var out = B.updateBlockLabel(src, 3, 'ab', '').split('\n');
    expect(out[2]).toBe('  a["A"] ab abc["ABC"]');
  });

  test('BL-5: リンク行は触らない', function() {
    var out = B.updateBlockLabel(src, 3, 'a', 'センサ').split('\n');
    expect(out[3]).toBe('  a --> ab');
  });
});

describe('block: ブロックIDのリネーム', function() {
  var src = 'block-beta\n  columns 3\n  a["A"] ab["AB"]\n  a --> ab\n  ab -- "戻り" --> a\n';

  test('BI-1: 指定したブロックのIDだけ変わる', function() {
    var out = B.updateBlockId(src, 3, 'a', 'sensor').split('\n');
    expect(out[2]).toBe('  sensor["A"] ab["AB"]');
  });

  test('BI-2: リンクの from/to が追従する', function() {
    var out = B.updateBlockId(src, 3, 'a', 'sensor').split('\n');
    expect(out[3]).toBe('  sensor --> ab');
    expect(out[4]).toBe('  ab -- "戻り" --> sensor');
  });

  test('BI-3: 前方一致する別ブロックを巻き込まない', function() {
    var out = B.updateBlockId(src, 3, 'a', 'sensor');
    var ids = B.parseBlock(out).elements.map(function(e) { return e.id; });
    expect(ids).toEqual(['sensor', 'ab']);
  });

  test('BI-4: グループIDのリネームは block: 行とリンクの両方に効く', function() {
    var t = 'block-beta\n  block:g1\n    x["X"]\n  end\n  g1 --> y\n';
    var out = B.updateBlockId(t, 2, 'g1', 'ecu').split('\n');
    expect(out[1]).toBe('  block:ecu');
    expect(out[4]).toBe('  ecu --> y');
  });

  test('BI-5: columns 指定つきのグループ行でも桁数を保つ', function() {
    var t = 'block-beta\n  block:g1:2\n    x["X"]\n  end\n';
    var out = B.updateBlockId(t, 2, 'g1', 'ecu').split('\n');
    expect(out[1]).toBe('  block:ecu:2');
  });

  test('BI-6: 既存IDと衝突するリネームは行わない', function() {
    // 通してしまうと2つのブロックが1つに融合する。mermaid は何も言わないので
    // 「消えた」ようにしか見えない。
    var out = B.updateBlockId(src, 3, 'a', 'ab');
    expect(out).toBe(src);
  });

  test('BI-7: ラベル文字列は書き換えない', function() {
    var t = 'block-beta\n  a["a を表す"] b["B"]\n  a --> b\n';
    var out = B.updateBlockId(t, 2, 'a', 'z').split('\n');
    expect(out[1]).toBe('  z["a を表す"] b["B"]');
  });

  test('BI-8: 同じIDへのリネームは何もしない', function() {
    expect(B.updateBlockId(src, 3, 'a', 'a')).toBe(src);
  });
});

// 変異テストで生き残った穴の補強。
// 「ラベル無しのブロックをリネームすると id と同じラベルが生える」変異が
// 検出できていなかった (既存テストは全てラベル付きのブロックだった)。
describe('block: リネームがラベルの有無を保つ', function() {
  test('BI-9: ラベル無しのブロックはラベル無しのまま', function() {
    var t = 'block-beta\n  a b["B"]\n  a --> b\n';
    var out = B.updateBlockId(t, 2, 'a', 'z').split('\n');
    expect(out[1]).toBe('  z b["B"]');
  });

  test('BI-10: 空IDへのリネームは行わない', function() {
    var t = 'block-beta\n  a["A"]\n';
    expect(B.updateBlockId(t, 2, 'a', '')).toBe(t);
  });

  test('BI-11: 丸括弧形状のラベルも保つ', function() {
    var t = 'block-beta\n  a("A") b["B"]\n';
    var out = B.updateBlockId(t, 2, 'a', 'z').split('\n');
    expect(out[1]).toContain('z["A"]');
  });
});
