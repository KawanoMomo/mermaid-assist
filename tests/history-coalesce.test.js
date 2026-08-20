'use strict';
// エディタ入力の履歴のまとめ方。
//
// editorEl の 'input' ごとに pushHistory() していたので、**1キーストローク=
// 1エントリ**だった。29文字の行を打つと Undo を29回押さないと戻らない。
// さらに MAX_HISTORY は 80 なので、**80文字打った時点で編集前の状態が
// 履歴から押し出され、元のテキストには二度と戻れなくなる。**
//
// 連続した入力は1つのまとまりとして積み、入力が途切れたら次のまとまりにする。
// 他の操作 (プロパティ変更・削除など) が挟まったら、その次の入力は必ず
// 新しいエントリにする — でないと、操作のあとに打った文字が
// 直前の操作と同じ Undo で巻き戻ってしまう。

var H = window.MA.history;

function setup() {
  var text = 'A';
  H.reset();
  H.init({
    getMmdText: function() { return text; },
    setMmdText: function(t) { text = t; },
    onUpdate: function() {},
  });
  return {
    set: function(t) { text = t; },
    get: function() { return text; },
  };
}

describe('pushHistoryCoalesced', function() {
  test('HC-1: 同じ種類の連続入力は1エントリにまとまる', function() {
    var s = setup();
    H.pushHistoryCoalesced('editor', 600, 1000); s.set('AB');
    H.pushHistoryCoalesced('editor', 600, 1100); s.set('ABC');
    H.pushHistoryCoalesced('editor', 600, 1200); s.set('ABCD');
    H.undo();
    expect(s.get()).toBe('A');
  });

  test('HC-2: 入力が途切れたら別エントリになる', function() {
    var s = setup();
    H.pushHistoryCoalesced('editor', 600, 1000); s.set('AB');
    H.pushHistoryCoalesced('editor', 600, 1100); s.set('ABC');
    // 600ms 以上あいた
    H.pushHistoryCoalesced('editor', 600, 2000); s.set('ABCD');
    H.undo();
    expect(s.get()).toBe('ABC');
    H.undo();
    expect(s.get()).toBe('A');
  });

  test('HC-3: 別の操作が挟まったら次の入力は新エントリ', function() {
    var s = setup();
    H.pushHistoryCoalesced('editor', 600, 1000); s.set('AB');
    // プロパティ操作など
    H.pushHistory(); s.set('AB+prop');
    // すぐ続けて入力しても、prop と同じまとまりにはしない
    H.pushHistoryCoalesced('editor', 600, 1050); s.set('AB+prop+C');
    H.undo();
    expect(s.get()).toBe('AB+prop');
    H.undo();
    expect(s.get()).toBe('AB');
  });

  test('HC-4: 種類が違えば別エントリ', function() {
    var s = setup();
    H.pushHistoryCoalesced('editor', 600, 1000); s.set('AB');
    H.pushHistoryCoalesced('drag', 600, 1010); s.set('ABC');
    H.undo();
    expect(s.get()).toBe('AB');
  });

  test('HC-5: まとめても redo は対称に動く', function() {
    var s = setup();
    H.pushHistoryCoalesced('editor', 600, 1000); s.set('AB');
    H.pushHistoryCoalesced('editor', 600, 1100); s.set('ABC');
    H.undo();
    expect(s.get()).toBe('A');
    H.redo();
    expect(s.get()).toBe('ABC');
  });

  test('HC-6: 長い入力でも履歴の上限を食い潰さない', function() {
    var s = setup();
    // 200文字を連続入力しても、まとまりは1つ
    for (var i = 0; i < 200; i++) {
      H.pushHistoryCoalesced('editor', 600, 1000 + i * 10);
      s.set('A' + new Array(i + 2).join('x'));
    }
    H.undo();
    // MAX_HISTORY=80 を超えて押し出されることなく、最初に戻れる
    expect(s.get()).toBe('A');
  });

  test('HC-7: reset で履歴が消える', function() {
    var s = setup();
    H.pushHistory(); s.set('AB');
    expect(H.canUndo()).toBe(true);
    H.reset();
    expect(H.canUndo()).toBe(false);
    expect(H.canRedo()).toBe(false);
  });
});
