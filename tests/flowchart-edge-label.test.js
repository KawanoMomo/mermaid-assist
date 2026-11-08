'use strict';
// flowchart のエッジのラベル欄を直す(台本 primary 手順 4 のエッジ文言)。
//
// 直す前の実測: `Check -->|はい| Send[送信]` のラベルを「可」にすると
// `Check --> |可| |可| Send[送信]` になった。ラベル欄の確定は打鍵中の反映と Enter で
// 2 回走り、1 回目が `--> |可| ` と空白を足して組み直し、2 回目はその空白のせいで
// 既存のラベルを読めず、もう 1 つラベルを足していた。addEdge 自身が `--> |x| ` で
// 書くので、GUI で足したエッジのラベルは 1 回目から積み重なっていた。
var fc = window.MA.modules.flowchart;
var NL = String.fromCharCode(10);

function edgeLabel(src, lineNum, value) {
  return fc.operations.update(src, lineNum, 'label', value, { kind: 'edge' }).split(NL)[lineNum - 1];
}

describe('エッジのラベルだけを直す', function() {
  var src = ['flowchart TD',
    '    Check{送信可?} -->|はい| Send[送信]',
    '    Check --> |いいえ| Wait[待機]',
    '    Wait-->|再試行|Check',
    '    Send --> Done[終了]'].join(NL);

  test('`-->|x|` はラベルの字だけが変わる', function() {
    expect(edgeLabel(src, 2, '可')).toBe('    Check{送信可?} -->|可| Send[送信]');
  });

  test('2 回続けて確定してもラベルは 1 つ(打鍵中の反映 + Enter)', function() {
    var once = fc.operations.update(src, 2, 'label', '可', { kind: 'edge' });
    var twice = fc.operations.update(once, 2, 'label', '可', { kind: 'edge' });
    expect(twice).toBe(once);
  });

  test('空白を挟んだ `--> |x|`(addEdge の書き方)も読めて、積み重ならない', function() {
    expect(edgeLabel(src, 3, '不可')).toBe('    Check --> |不可| Wait[待機]');
  });

  test('空白の無い `A-->|x|B` も空白を足さない', function() {
    expect(edgeLabel(src, 4, 'リトライ')).toBe('    Wait-->|リトライ|Check');
  });

  test('GUI で足したエッジのラベルを直しても 1 つ', function() {
    var t = fc.addEdge('flowchart TD' + NL + '    A[a]' + NL + '    B[b]' + NL, 'A', 'B', '-->', 'go');
    var line = t.split(NL).indexOf('    A --> |go| B') + 1;
    expect(line > 0).toBe(true);
    expect(edgeLabel(t, line, 'stop')).toBe('    A --> |stop| B');
  });

  test('ラベルの無いエッジに足す / ラベルを空にする は従来どおり', function() {
    expect(edgeLabel(src, 5, '完了')).toBe('    Send --> |完了| Done[終了]');
    expect(edgeLabel(src, 3, '')).toBe('    Check --> Wait[待機]');
  });

  test('他の欄(to)を直しても、空白を挟んだラベルを落とさない', function() {
    var out = fc.operations.update(src, 3, 'to', 'Done', { kind: 'edge' }).split(NL)[2];
    expect(out).toBe('    Check --> |いいえ| Done');
  });
});
