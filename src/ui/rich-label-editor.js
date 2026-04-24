'use strict';
// Rich label editor for Mermaid Sequence messages / notes.
// Ported from PlantUMLAssist src/ui/rich-label-editor.js, adapted to
// Mermaid's label syntax:
//   - <b>text</b>   bold                (Mermaid supported)
//   - <i>text</i>   italic              (Mermaid supported)
//   - <br/>         line break          (Mermaid supported)
// Color (<color:#HEX>…</color>) and underline (<u>) are NOT supported by
// Mermaid Sequence so the buttons are omitted. See
// docs/cross-ref/direct-manipulation-ux-checklist.md for the constraint note.
window.MA = window.MA || {};
window.MA.richLabelEditor = (function() {

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Mermaid label 表記 → プレビュー HTML
  function mermaidToHtml(s) {
    if (!s) return '';
    var out = escHtml(s);
    // Mermaid 改行プリミティブは <br/>
    out = out.replace(/&lt;br\s*\/?&gt;/g, '<br>');
    out = out.replace(/\n/g, '<br>');
    out = out.replace(/&lt;b&gt;([\s\S]*?)&lt;\/b&gt;/g, '<b>$1</b>');
    out = out.replace(/&lt;i&gt;([\s\S]*?)&lt;\/i&gt;/g, '<i>$1</i>');
    return out;
  }

  function fireInput(ta) {
    var EvtCtor = (typeof window !== 'undefined' && window.Event) ? window.Event : Event;
    ta.dispatchEvent(new EvtCtor('input'));
  }

  function fireChange(ta) {
    // Toolbar buttons do not blur the textarea, so onChange never fires
    // naturally. Dispatch it explicitly so ctx.setMmdText → re-render path
    // runs after every B/I/newline click. (PlantUMLAssist feature #9 parity.)
    var EvtCtor = (typeof window !== 'undefined' && window.Event) ? window.Event : Event;
    try {
      ta.dispatchEvent(new EvtCtor('change', { bubbles: true }));
    } catch (e) {
      ta.dispatchEvent(new EvtCtor('change'));
    }
  }

  function insertWrapAtSelection(ta, openTag, closeTag) {
    var s = ta.selectionStart, e = ta.selectionEnd;
    var before = ta.value.substring(0, s);
    var sel = ta.value.substring(s, e);
    var after = ta.value.substring(e);
    ta.value = before + openTag + sel + closeTag + after;
    var newPos = s + openTag.length + sel.length;
    ta.setSelectionRange(newPos, newPos);
    fireInput(ta);
  }

  function insertAtCursor(ta, str) {
    var s = ta.selectionStart;
    ta.value = ta.value.substring(0, s) + str + ta.value.substring(ta.selectionEnd);
    ta.setSelectionRange(s + str.length, s + str.length);
    fireInput(ta);
  }

  function mount(container, initialValue, onChange) {
    // Display `<br/>` as a visible newline in the textarea so line breaks are
    // obvious while editing. getValue() reverses this before returning to DSL.
    var initialForEdit = String(initialValue || '').replace(/<br\s*\/?>(?=.|$)/g, '\n');
    container.innerHTML =
      '<div class="rle-toolbar" style="display:flex;gap:4px;padding:4px;background:var(--bg-primary);border:1px solid var(--border);border-bottom:none;border-radius:3px 3px 0 0;align-items:center;flex-wrap:wrap;">' +
        '<button type="button" class="rle-b" title="太字" style="background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);width:24px;height:24px;cursor:pointer;font-weight:700;border-radius:3px;">B</button>' +
        '<button type="button" class="rle-i" title="斜体" style="background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);width:24px;height:24px;cursor:pointer;font-style:italic;border-radius:3px;">I</button>' +
        '<span style="border-left:1px solid var(--border);height:18px;margin:0 4px;"></span>' +
        '<button type="button" class="rle-newline" title="改行 <br/>" style="background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);width:24px;height:24px;cursor:pointer;border-radius:3px;">↵</button>' +
      '</div>' +
      '<textarea class="rle-textarea" style="width:100%;min-height:60px;background:var(--bg-tertiary);border:1px solid var(--border);border-top:none;color:var(--text-primary);padding:6px;border-radius:0 0 3px 3px;font-family:var(--font-mono);font-size:12px;resize:vertical;box-sizing:border-box;">' + escHtml(initialForEdit) + '</textarea>' +
      '<div class="rle-preview" style="margin-top:6px;padding:6px 8px;background:#fff;color:#000;border-radius:3px;font-size:12px;font-family:-apple-system,Segoe UI,sans-serif;min-height:24px;">' + mermaidToHtml(initialValue || '') + '</div>';

    var ta = container.querySelector('.rle-textarea');
    var preview = container.querySelector('.rle-preview');

    function refreshPreview() {
      preview.innerHTML = mermaidToHtml(ta.value);
    }

    // Input per keystroke: update preview only (do not trigger DSL refresh).
    // onChange on blur: persist to DSL. Preserves focus during typing.
    ta.addEventListener('input', function() {
      refreshPreview();
    });
    ta.addEventListener('change', function() {
      // Normalise real newlines → <br/> before handing off to the DSL so the
      // label round-trips cleanly. Keep in sync with getValue() below.
      if (onChange) onChange(ta.value.replace(/\n/g, '<br/>'));
    });
    ta.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        container.dispatchEvent(new window.CustomEvent('rle-escape', { bubbles: true }));
      }
    });

    container.querySelector('.rle-b').addEventListener('click', function() { insertWrapAtSelection(ta, '<b>', '</b>'); fireChange(ta); });
    container.querySelector('.rle-i').addEventListener('click', function() { insertWrapAtSelection(ta, '<i>', '</i>'); fireChange(ta); });
    // Insert a real newline into the textarea; getValue() converts it to
    // <br/> before handing off to the DSL so Mermaid renders the line break.
    container.querySelector('.rle-newline').addEventListener('click', function() { insertAtCursor(ta, '\n'); fireChange(ta); });

    return {
      getValue: function() {
        // Real newlines in the textarea (user pressed Enter) would collide with
        // the DSL's line separator and break the sequence line. Normalise to
        // Mermaid's literal <br/> so the label survives the round-trip.
        return ta.value.replace(/\n/g, '<br/>');
      },
      setValue: function(v) {
        // Reverse: display <br/> as real newlines in the textarea for easy
        // editing. Round-trip keeps the DSL stable.
        ta.value = (v || '').replace(/<br\s*\/?>(?=.|$)/g, '\n');
        refreshPreview();
      },
      element: ta,
    };
  }

  return { mount: mount, mermaidToHtml: mermaidToHtml, insertWrapAtSelection: insertWrapAtSelection };
})();
