'use strict';
window.MA = window.MA || {};
window.MA.properties = (function() {
  var state = {
    getMmdText: function() { return ''; },
    setMmdText: function(t) {},
    onUpdate: function() {},
    moduleUpdater: function(text, lineNum, field, value) { return text; },
  };

  function init(opts) {
    state.getMmdText = opts.getMmdText;
    state.setMmdText = opts.setMmdText;
    state.onUpdate = opts.onUpdate || function() {};
    state.moduleUpdater = opts.moduleUpdater;
  }

  // bindTextField: text input の change で moduleUpdater を呼んでテキスト更新
  function bindTextField(elId, lineNum, field) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.addEventListener('change', function() {
      window.MA.history.pushHistory();
      var newText = state.moduleUpdater(state.getMmdText(), lineNum, field, el.value);
      state.setMmdText(newText);
      state.onUpdate();
    });
  }

  // bindDateField: 開始日/終了日 ペアのバインド (datesUpdater は外部から注入)
  function bindDateField(startId, endId, lineNum, datesUpdater) {
    var startEl = document.getElementById(startId);
    var endEl = document.getElementById(endId);
    if (startEl) {
      startEl.addEventListener('change', function() {
        window.MA.history.pushHistory();
        var newText = datesUpdater(state.getMmdText(), lineNum, startEl.value, null);
        state.setMmdText(newText);
        state.onUpdate();
      });
    }
    if (endEl) {
      endEl.addEventListener('change', function() {
        window.MA.history.pushHistory();
        var newText = datesUpdater(state.getMmdText(), lineNum, null, endEl.value);
        state.setMmdText(newText);
        state.onUpdate();
      });
    }
  }

  return {
    init: init,
    bindTextField: bindTextField,
    bindDateField: bindDateField,
  };
})();
