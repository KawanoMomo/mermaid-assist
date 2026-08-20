'use strict';
// Where an element inside the rendered diagram actually sits, in the coordinate
// system the overlay layer uses.
//
// `getBBox()` returns the box in the element's *own* coordinate system. mermaid
// positions its groups with `transform="translate(...)"`, so for a `<g class="node">`
// the bbox is measured around the local origin and says nothing about where the
// node was placed. flowchart's overlay used the raw bbox and stacked every one of
// its rects at the same spot — measured on a four-node chart, all four came out at
// (-48, -29). The overlay looked plausible in the DOM and was completely wrong on
// screen: only the topmost rect could be clicked, and it answered for every node.
//
// The overlay <svg> shares the diagram's viewBox, so mapping through the screen
// CTM of both elements gives the box in overlay coordinates. All four corners are
// transformed, not just the origin, so a rotated or scaled group still yields a
// correct axis-aligned box.
window.MA = window.MA || {};
window.MA.overlayGeom = (function() {

  function boxInSvgSpace(svgEl, el) {
    if (!svgEl || !el || !el.getBBox || !el.getScreenCTM || !svgEl.getScreenCTM) return null;
    var bb;
    try { bb = el.getBBox(); } catch (e) { return null; }
    if (!bb || !isFinite(bb.width) || !isFinite(bb.height)) return null;

    var rootCtm = svgEl.getScreenCTM();
    var elCtm = el.getScreenCTM();
    // Detached or display:none elements have no CTM. Falling back to the raw
    // bbox would put the rect in the wrong place, which is worse than omitting
    // it — a wrong hit area silently selects the wrong element.
    if (!rootCtm || !elCtm || !rootCtm.inverse) return null;

    var m;
    try { m = rootCtm.inverse().multiply(elCtm); } catch (e) { return null; }

    var xs = [], ys = [];
    var corners = [[bb.x, bb.y], [bb.x + bb.width, bb.y],
                   [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]];
    for (var i = 0; i < corners.length; i++) {
      var pt = svgEl.createSVGPoint();
      pt.x = corners[i][0];
      pt.y = corners[i][1];
      var out = pt.matrixTransform(m);
      xs.push(out.x);
      ys.push(out.y);
    }
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    if (!isFinite(minX) || !isFinite(minY)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  // mermaid names its node groups `<prefix>-<diagram id>-<counter>`, e.g.
  // `flowchart-A-0`. The diagram's own id may itself contain hyphens (`my-node`),
  // so the counter is stripped from the end rather than splitting on '-'.
  function idFromSvgNodeId(svgId, prefix) {
    if (!svgId) return null;
    var re = new RegExp('^' + prefix + '-(.+)-\\d+$');
    var m = String(svgId).match(re);
    return m ? m[1] : null;
  }

  // Copy the rendered size onto the overlay so the two layers line up.
  function syncViewport(svgEl, overlayEl) {
    if (!overlayEl) return;
    while (overlayEl.firstChild) overlayEl.removeChild(overlayEl.firstChild);
    if (!svgEl) return;
    var viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) overlayEl.setAttribute('viewBox', viewBox);
    var w = svgEl.getAttribute('width');
    var h = svgEl.getAttribute('height');
    if (w) overlayEl.setAttribute('width', w);
    if (h) overlayEl.setAttribute('height', h);
  }

  // A transparent hit area over `box`, tagged so the shared overlay click
  // handler in app.js can resolve it back to a diagram element.
  function hitRect(doc, box, opts) {
    var NS = 'http://www.w3.org/2000/svg';
    var pad = opts.pad === undefined ? 2 : opts.pad;
    var rect = doc.createElementNS(NS, 'rect');
    rect.setAttribute('x', box.x - pad);
    rect.setAttribute('y', box.y - pad);
    rect.setAttribute('width', Math.max(0, box.width + pad * 2));
    rect.setAttribute('height', Math.max(0, box.height + pad * 2));
    rect.setAttribute('fill', 'transparent');
    rect.setAttribute('stroke', opts.selected ? '#7ee787' : 'none');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('stroke-dasharray', '4');
    rect.setAttribute('cursor', 'pointer');
    rect.setAttribute('class', opts.className || 'overlay-node');
    rect.setAttribute('data-element-id', opts.id);
    rect.setAttribute('data-element-kind', opts.kind);
    if (opts.line !== undefined && opts.line !== null) rect.setAttribute('data-line', opts.line);
    return rect;
  }

  return {
    boxInSvgSpace: boxInSvgSpace,
    idFromSvgNodeId: idFromSvgNodeId,
    syncViewport: syncViewport,
    hitRect: hitRect,
  };
})();
