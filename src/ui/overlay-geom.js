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
  // 選択の印の色。scrollSelectedIntoView が同じ値で印を探すので、
  // リテラルを2か所に書かない (片方だけ変えると探せなくなる)。
  var SELECTED_STROKE = '#7ee787';
  // 接続モードの起点の印。**選択とは別の色**にする。
  // 同じ色だと「選ばれている」のか「ここから線を引こうとしている」のかが
  // 区別できない。橙は選択の緑と紛れない。
  var CONNECT_SOURCE_STROKE = '#f0883e';

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
    // **接続モードの起点は、選択の印より優先して出す。**
    //
    // 実測 (直す前): 要素を選ぶと図で光る (stroke が1個) が、
    // 「ここから線を引く」を押すと**0個になる**。ステータス行は
    // 「接続モード: C から線を引きます」と言うが、視線は図にある。
    // 起点を確かめるにはステータス行へ視線を移す1手が要った。
    // **接続元の判定はここでする。** hitRect を直接呼ぶモジュールが
    // 4つある (flowchart / block / c4 / kanban)。呼び出し側に渡させると
    // 21図種のうち一部だけ光る不揃いを作る — このコードベースが繰り返し
    // 踏んできた型 (UI 経路だけ直して契約経路を忘れる) そのもの。
    var isConnectSrc = (function() {
      if (opts.connectSource) return true;
      var s = window.MA.connectionMode && window.MA.connectionMode.getSource();
      return !!(s && s.id === opts.id);
    })();
    rect.setAttribute('stroke',
      isConnectSrc ? CONNECT_SOURCE_STROKE :
      (opts.selected ? SELECTED_STROKE : 'none'));
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('stroke-dasharray', '4');
    rect.setAttribute('cursor', 'pointer');
    rect.setAttribute('class', opts.className || 'overlay-node');
    rect.setAttribute('data-element-id', opts.id);
    rect.setAttribute('data-element-kind', opts.kind);
    if (opts.line !== undefined && opts.line !== null) rect.setAttribute('data-line', opts.line);
    return rect;
  }

  // The whole node overlay for a diagram that renders one `<g class="node">` per
  // element. Every such module was writing the same twenty lines, and the three
  // that had written them had each got a different part of it wrong.
  //
  // opts.prefix : mermaid's element-id prefix (`flowchart-A-0` → 'flowchart').
  //               Omit when the renderer uses the DSL id verbatim (block-beta,
  //               requirementDiagram).
  // opts.kindOf : element → the selection kind the module's renderProps expects.
  //               Defaults to the parsed element's own `kind`.
  // opts.keyOf  : element → the value mermaid used as the SVG id, and
  //               opts.idOf → the value the module's renderProps looks a
  //               selection up by. Both default to `id`. requirementDiagram
  //               needs them: it renders `<g id="sample_req">` from the DSL
  //               *name*, while the element's `id` field is a separate
  //               user-facing value (`REQ-001`). Matching on `id` there found
  //               nothing and produced no overlay at all.
  function buildNodeOverlay(svgEl, parsedData, overlayEl, opts) {
    opts = opts || {};
    var keyOf = opts.keyOf || function(e) { return e.id; };
    var idOf = opts.idOf || keyOf;
    syncViewport(svgEl, overlayEl);
    if (!overlayEl || !svgEl || !parsedData || !parsedData.elements) return;

    var byId = {};
    for (var i = 0; i < parsedData.elements.length; i++) {
      var e = parsedData.elements[i];
      var k = e && keyOf(e);
      if (k) byId[k] = e;
    }

    var nodes = svgEl.querySelectorAll(opts.selector || '.node');
    for (var n = 0; n < nodes.length; n++) {
      var svgId = nodes[n].getAttribute('id');
      var key = opts.svgIdToKey ? opts.svgIdToKey(svgId)
        : (opts.prefix ? idFromSvgNodeId(svgId, opts.prefix) : svgId);
      var el = key ? byId[key] : null;
      if (!el) continue;
      var box = boxInSvgSpace(svgEl, nodes[n]);
      if (!box) continue;
      var selId = idOf(el);
      overlayEl.appendChild(hitRect(document, box, {
        id: selId,
        kind: opts.kindOf ? opts.kindOf(el) : el.kind,
        line: el.line,
        // The same value the click writes into the selection, not el.id — in
        // requirementDiagram those differ, so asking about el.id would report
        // "not selected" for the element the user just clicked and the
        // highlight would never appear.
        selected: window.MA.selection.isSelected(selId),
        className: 'overlay-node',
      }));
    }
  }

  // 選んだ要素まで図を動かす。
  //
  // 選ぶと図は光る (hitRect が stroke を #7ee787 にする) が、**画面の外だと
  // 光っても見えない**。実測: 40要素の図で選んだ要素は枠の上端から 3974px、
  // 枠の高さは 681px、scrollTop は 0 のままだった。
  // 一覧で選んだ人は、そこからホイールで探すことになる。
  //
  // **どこから呼ぶかが全て。**
  //
  // 1) buildNodeOverlay から呼んではいけない。この関数を使うのは 21図種のうち
  //    5つ (architecture / class / er / requirement / state) だけで、flowchart は
  //    自前で hitRect を並べている。最初ここから呼んで flowchart で効かなかった。
  //
  // 2) 描画経路 (app.js:413 が buildOverlay を直接呼ぶ) からも呼んではいけない。
  //    オーバレイは打鍵のたびに作り直されるので、そこから呼ぶと手で合わせた
  //    スクロール位置を毎回奪う。
  //
  // 呼ぶのは **app.js の rebuildOverlay() だけ**。これは選択が変わったときの
  // onChange からしか呼ばれない (app.js:1933)。全図種が通り、かつ打鍵では通らない。
  //
  // 最初「同じ選択なら動かさない」ガードを入れたが、**変異を入れても挙動が
  // 変わらず、死んだコードだと分かった** — 打鍵経路がそもそもここを通らない。
  // 効かないガードを「位置を守っている」と書き残すのは嘘になるので外した。
  // 打鍵で位置が動かないことは e2e が直接押さえている。
  function scrollSelectedIntoView(overlayEl) {
    if (!overlayEl) return;
    var box = document.getElementById('preview-container');
    if (!box) return;
    var sel = window.MA.selection.getSelected();
    if (!sel.length) return;
    var mark = null;
    var kids = overlayEl.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].getAttribute('stroke') === SELECTED_STROKE) { mark = kids[i]; break; }
    }
    if (!mark) return;
    var mb = mark.getBoundingClientRect();
    var bb = box.getBoundingClientRect();
    if (mb.top >= bb.top && mb.bottom <= bb.bottom &&
        mb.left >= bb.left && mb.right <= bb.right) return;   // もう見えている
    // 枠の中央に置く。端に寄せると前後の文脈が見えない。
    box.scrollTop += (mb.top - bb.top) - (bb.height - mb.height) / 2;
    box.scrollLeft += (mb.left - bb.left) - (bb.width - mb.width) / 2;
  }

  return {
    boxInSvgSpace: boxInSvgSpace,
    idFromSvgNodeId: idFromSvgNodeId,
    syncViewport: syncViewport,
    hitRect: hitRect,
    buildNodeOverlay: buildNodeOverlay,
    scrollSelectedIntoView: scrollSelectedIntoView,
  };
})();
