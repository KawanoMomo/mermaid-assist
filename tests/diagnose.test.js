'use strict';
// 描画が失敗したときに、原因を利用者の言葉で名指しする。
//
// R11 (特殊文字) で分かった mermaid 側の制限が2つある。どちらも直せないが、
// 出るエラーが原因を指していない:
//
//   architecture-beta のラベルは [A-Za-z0-9_ ] しか受け付けない。
//   「サーバ」と打つと `Lexer error on line 3, column 25` とだけ出る。
//   利用者は自分の入力のどの文字が悪いのか分からない。
//
//   sequence の participant 別名に ; を入れると `Parse error on line 2`。
//   引用で囲んでも通らない。
//
// 直せないものを黙って壊れさせない。何が原因かは言える。

var D = window.MA.diagnose;

describe('diagnose: 原因を名指しする', function() {
  test('DG-1: architecture の日本語ラベルを指摘する', function() {
    var t = 'architecture-beta\n    group api(cloud)[API Cluster]\n' +
            '    service db(database)[データベース] in api\n';
    var msg = D.diagnose(t, new Error('Lexer error on line 3, column 25'));
    expect(msg).toContain('architecture');
    expect(msg).toContain('データベース');
  });

  test('DG-2: 使える文字を具体的に書く', function() {
    var t = 'architecture-beta\n    service db(database)[入出力]\n';
    var msg = D.diagnose(t, new Error('Lexer error'));
    expect(msg).toContain('半角英数字');
  });

  test('DG-3: 通る文字なら指摘しない', function() {
    var t = 'architecture-beta\n    service db(database)[Data Base]\n';
    expect(D.diagnose(t, new Error('Lexer error'))).toBe('');
  });

  test('DG-4: sequence の別名に含まれる ; を指摘する', function() {
    var t = 'sequenceDiagram\n    participant A as A;B\n    A->>A: x\n';
    var msg = D.diagnose(t, new Error('Parse error on line 2'));
    expect(msg).toContain('sequence');
    expect(msg).toContain(';');
  });

  test('DG-5: 該当が無ければ空文字 (余計な推測をしない)', function() {
    var t = 'flowchart TD\n    A --> B\n';
    expect(D.diagnose(t, new Error('なにか別の失敗'))).toBe('');
  });

  test('DG-6: 図種が違えば architecture の規則を当てはめない', function() {
    var t = 'flowchart TD\n    A["データベース"] --> B\n';
    expect(D.diagnose(t, new Error('Lexer error'))).toBe('');
  });
});
