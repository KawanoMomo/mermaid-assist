'use strict';
window.MA = window.MA || {};
window.MA.history = (function() {
  var MAX_HISTORY = 80;
  var undoStack = [];
  var future = [];
  var state = {
    getMmdText: function() { return ''; },
    setMmdText: function(t) {},
    onUpdate: function() {},
  };

  function init(opts) {
    state.getMmdText = opts.getMmdText;
    state.setMmdText = opts.setMmdText;
    state.onUpdate = opts.onUpdate || function() {};
  }

  // What the last coalesced push was, so a run of the same kind of change can be
  // folded into one undo step.
  var lastTag = null;
  var lastAt = 0;

  function pushHistory() {
    undoStack.push(state.getMmdText());
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    future = [];
    // An explicit push ends any run in progress: a keystroke typed right after a
    // property edit must not be undone together with it.
    lastTag = null;
    state.onUpdate();
  }

  // Push, unless this is a continuation of the same kind of change within
  // `windowMs`.
  //
  // Editor typing used to call pushHistory() on every `input` event, so one
  // 29-character line cost 29 presses of undo to reverse — and since only
  // MAX_HISTORY (80) states are kept, typing 80 characters pushed the pre-edit
  // text off the end of the stack and it could never be recovered at all.
  //
  // `now` is a parameter so the coalescing window is testable without waiting.
  function pushHistoryCoalesced(tag, windowMs, now) {
    var t = (now === undefined) ? Date.now() : now;
    if (lastTag === tag && (t - lastAt) < windowMs) {
      lastAt = t;
      return;
    }
    pushHistory();
    lastTag = tag;
    lastAt = t;
  }

  // Start over — used when the document is replaced wholesale (file open,
  // diagram-type switch), where undoing into the previous document would be
  // surprising rather than helpful.
  function reset() {
    undoStack = [];
    future = [];
    lastTag = null;
    lastAt = 0;
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
    pushHistoryCoalesced: pushHistoryCoalesced,
    reset: reset,
    undo: undo,
    redo: redo,
    canUndo: canUndo,
    canRedo: canRedo,
  };
})();
