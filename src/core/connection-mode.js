'use strict';
window.MA = window.MA || {};
window.MA.connectionMode = (function() {
  var active = false;
  var sourceType = null;
  var sourceId = null;
  var onCompleteCallback = null;
  // 起点が変わったことを知らせる。**selection.js と同じ形。**
  //
  // UI-077 で接続モードの起点を図に描くようにしたら、**中止しても印が
  // 残った** — オーバレイを描き直す人がいなかったため。
  // cancelConnectionMode の呼び出しは app.js に3か所あり、そこへ個別に
  // 再描画を足すと**1つ忘れて図種で不揃いになる** (このコードベースが
  // 17回踏んだ型)。状態を持つ側から1回だけ知らせる。
  var onChange = function() {};

  function init(callback) {
    onChange = callback || function() {};
  }

  function startConnectionMode(srcType, srcId, onComplete) {
    active = true;
    sourceType = srcType;
    sourceId = srcId;
    onCompleteCallback = onComplete;
    onChange();
  }

  function cancelConnectionMode() {
    var was = active;
    active = false;
    sourceType = null;
    sourceId = null;
    onCompleteCallback = null;
    if (was) onChange();
  }

  function isInConnectionMode() {
    return active;
  }

  // 相手が決まったことを知らせる。
  //
  // **先に解除してはいけない (UI-078)。** 元は cb を呼ぶ前に
  // cancelConnectionMode() していたので、**コールバックが相手を拒んでも
  // モードだけは消えた**。押した人から見ると「何も起きず、接続モードも
  // 消えた」状態で、やり直しに3クリック要る (実測)。
  //
  // コールバックが false を返したら受理しなかったということなので、
  // **モードを続ける**。理由はコールバック側が告げる。
  // 戻り値を返さない既存の呼び出し (undefined) は受理として扱い、
  // 従来どおり解除する。
  function notifyTarget(targetType, targetId) {
    if (!active || !onCompleteCallback) return;
    var cb = onCompleteCallback;
    var src = { type: sourceType, id: sourceId };
    var accepted = cb(src, { type: targetType, id: targetId });
    if (accepted === false) return;
    cancelConnectionMode();
  }

  function getSource() {
    return active ? { type: sourceType, id: sourceId } : null;
  }

  return {
    init: init,
    startConnectionMode: startConnectionMode,
    cancelConnectionMode: cancelConnectionMode,
    isInConnectionMode: isInConnectionMode,
    notifyTarget: notifyTarget,
    getSource: getSource,
  };
})();
