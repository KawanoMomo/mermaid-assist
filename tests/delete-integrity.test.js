'use strict';
// 並行レビュー (R4 実UI) が見つけた、削除が図を壊す3件。
// いずれも「一覧の ✕ を1回押すだけ」で status が Error になる。

var MM = window.MA.modules.mindmap;
var PK = window.MA.modules.packetBeta;
var AR = window.MA.modules.architectureBeta;

describe('mindmap: ルート削除', function() {
  // ルートを消すと子孫も消えるのは正しい。だが結果が `mindmap` の1行だけになり、
  // mermaid はノードの無い mindmap を拒否する。**✕ を1回押しただけで図が
  // 消えてエラーになる。**
  var src = 'mindmap\n  root((中心))\n    枝A\n      葉1\n    枝B\n';

  test('MI-1: ルートは削除しない', function() {
    var root = MM.parse(src).elements[0];
    expect(MM.deleteNode(src, root.line, root.id)).toBe(src);
  });

  test('MI-2: 子ノードは子孫ごと消える', function() {
    var els = MM.parse(src).elements;
    var eda = els.filter(function(e) { return e.text === '枝A' || e.label === '枝A'; })[0];
    var out = MM.deleteNode(src, eda.line, eda.id);
    expect(out).not.toContain('枝A');
    expect(out).not.toContain('葉1');
    expect(out).toContain('枝B');
    expect(out).toContain('root((中心))');
  });

  test('MI-3: 最後の子を消してもルートは残る', function() {
    var t = 'mindmap\n  root((中心))\n    枝A\n';
    var els = MM.parse(t).elements;
    var out = MM.deleteNode(t, els[1].line, els[1].id);
    expect(out).toContain('root((中心))');
  });
});

describe('packet-beta: フィールド削除', function() {
  // ビット範囲は 0 から隙間なく並んでいる必要がある。先頭を消すと 16 から
  // 始まってしまい mermaid が拒否する。**穴の空いたパケット図は図として
  // 成立しない。**
  var src = 'packet-beta\n  0-15: "A"\n  16-31: "B"\n  32-63: "C"\n';

  test('PK-1: 先頭を消すと後続が詰められる', function() {
    var els = PK.parse(src).elements;
    var out = PK.deleteField(src, els[0].line, els[0].id);
    expect(out).toContain('0-15: "B"');
    expect(out).toContain('16-47: "C"');
    expect(out).not.toContain('"A"');
  });

  test('PK-2: 途中を消しても穴が空かない', function() {
    var els = PK.parse(src).elements;
    var out = PK.deleteField(src, els[1].line, els[1].id);
    expect(out).toContain('0-15: "A"');
    expect(out).toContain('16-47: "C"');
    expect(out).not.toContain('"B"');
  });

  test('PK-3: 各フィールドの幅は変わらない', function() {
    var els = PK.parse(src).elements;
    var out = PK.deleteField(src, els[0].line, els[0].id);
    var after = PK.parse(out).elements;
    // B は 16bit、C は 32bit のまま
    expect(after[0].endBit - after[0].startBit).toBe(15);
    expect(after[1].endBit - after[1].startBit).toBe(31);
  });

  test('PK-4: 単一ビットのフィールドも扱える', function() {
    var t = 'packet-beta\n  0: "F"\n  1-7: "G"\n';
    var els = PK.parse(t).elements;
    var out = PK.deleteField(t, els[0].line, els[0].id);
    expect(out).toContain('0-6: "G"');
  });
});

describe('architecture-beta: グループ削除', function() {
  // グループを消しても `in api` が残り、存在しないグループを指す。
  var src = 'architecture-beta\n    group api(cloud)[API]\n' +
            '    service db(database)[DB] in api\n' +
            '    service ext(internet)[Ext]\n    db:L -- R:ext\n';

  test('AR-1: グループを消すと in 参照も消える', function() {
    // group は elements ではなく groups に入る (service とは別の配列)
    var g = AR.parse(src).groups[0];
    var out = AR.deleteElement(src, g.line, g.id);
    expect(out).not.toContain('in api');
    expect(out).not.toContain('group api');
    // 中のサービスは残る (グループから出るだけ)
    expect(out).toContain('service db');
  });

  test('AR-2: サービスを消すとエッジも消える', function() {
    var s = AR.parse(src).elements.filter(function(e) { return e.id === 'db'; })[0];
    var out = AR.deleteElement(src, s.line, s.id);
    expect(out).not.toContain('service db');
    expect(out).not.toContain('db:L -- R:ext');
    expect(out).toContain('service ext');
  });

  test('AR-3: 前方一致する別サービスを巻き込まない', function() {
    var t = 'architecture-beta\n    service db(database)[A]\n' +
            '    service db2(database)[B]\n    db2:L -- R:db\n';
    var s = AR.parse(t).elements.filter(function(e) { return e.id === 'db'; })[0];
    var out = AR.deleteElement(t, s.line, s.id);
    expect(out).toContain('service db2');
    expect(out).not.toContain('db2:L -- R:db');
  });
});
