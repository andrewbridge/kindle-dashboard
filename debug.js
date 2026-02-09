/* =============================================================
 * Kindle Dashboard — Beacon-only Diagnostics (v2)
 *
 * No UI — sends diagnostics purely via Image beacon to a POST bin.
 * Does not create any DOM elements or intercept touch events.
 *
 * ES5 only.
 * ============================================================= */

(function() {
  'use strict';

  var POST_BIN_URL = 'https://www.postb.in/1770678784588-3683571361470';

  // ── Beacon sender ──
  // Sends a labelled JSON payload as a GET query param via Image.
  // Splits into numbered chunks if too large for a single URL.
  function sendBeacon(label, data) {
    try {
      var payload = JSON.stringify({ label: label, data: data });
      var maxLen = 1600;
      var encoded = encodeURIComponent(payload);

      if (encoded.length <= maxLen) {
        fireBeacon(encoded);
      } else {
        // Split into chunks
        var chunks = [];
        for (var i = 0; i < encoded.length; i += maxLen) {
          chunks.push(encoded.substring(i, i + maxLen));
        }
        for (var c = 0; c < chunks.length; c++) {
          var meta = encodeURIComponent(label + '_chunk_' + (c + 1) + 'of' + chunks.length + '=');
          fireBeacon(meta + chunks[c]);
        }
      }
    } catch (e) {
      // Nothing we can do
    }
  }

  function fireBeacon(encodedData) {
    var sep = POST_BIN_URL.indexOf('?') === -1 ? '?' : '&';
    var img = new Image();
    img.src = POST_BIN_URL + sep + 'data=' + encodedData;
  }

  // ── Error capture ──
  var errors = [];
  window.onerror = function(msg, url, line, col) {
    var err = msg + ' @ ' + (url || '?') + ':' + (line || '?') + ':' + (col || '?');
    errors.push(err);
    // Send immediately — errors are critical
    sendBeacon('js_error', { error: err, timestamp: new Date().getTime() });
    return false;
  };

  // ── Helper: get computed style safely ──
  function cs(el, prop) {
    try {
      var style = window.getComputedStyle(el);
      return style[prop] || style.getPropertyValue(prop) || 'N/A';
    } catch (e) {
      return 'ERR:' + e.message;
    }
  }

  // ── Run diagnostics after everything has loaded ──
  window.addEventListener('load', function() {

    // Small delay to let the app's init() finish
    setTimeout(function() {
      var diag = {};

      // 1. Environment
      diag.ua = navigator.userAgent;
      diag.viewport = window.innerWidth + 'x' + window.innerHeight;
      diag.screen = screen.width + 'x' + screen.height;
      diag.hasHead = !!document.head;

      // 2. Root / landscape wrapper
      var root = document.getElementById('root');
      if (root) {
        diag.rootInlineStyle = root.style.cssText;
        diag.rootDisplay = cs(root, 'display');
        diag.rootWidth = cs(root, 'width');
        diag.rootHeight = cs(root, 'height');
        diag.rootOverflow = cs(root, 'overflow');
        diag.rootWebkitTransform = cs(root, '-webkit-transform');
        diag.rootTransform = cs(root, 'transform');
        diag.rootMarginLeft = cs(root, 'margin-left');
      } else {
        diag.root = 'MISSING';
      }

      sendBeacon('diag_root', diag);

      // 3. View-0 (main view)
      var v0 = {};
      var view0 = document.getElementById('view-0');
      if (view0) {
        v0.className = view0.className;
        v0.display = cs(view0, 'display');
        v0.width = cs(view0, 'width');
        v0.height = cs(view0, 'height');
        v0.webkitBoxOrient = cs(view0, '-webkit-box-orient');
        v0.webkitBoxAlign = cs(view0, '-webkit-box-align');
        v0.webkitBoxPack = cs(view0, '-webkit-box-pack');
        v0.childCount = view0.childNodes.length;
        v0.innerHTML_len = view0.innerHTML.length;
      } else {
        v0.view0 = 'MISSING';
      }

      sendBeacon('diag_view0', v0);

      // 4. Panels
      var panels = {};
      var lp = view0 ? view0.querySelector('.left-panel') : null;
      var rp = view0 ? view0.querySelector('.right-panel') : null;
      if (lp) {
        panels.leftDisplay = cs(lp, 'display');
        panels.leftWidth = cs(lp, 'width');
        panels.leftHeight = cs(lp, 'height');
      } else {
        panels.leftPanel = 'MISSING';
      }
      if (rp) {
        panels.rightDisplay = cs(rp, 'display');
        panels.rightWidth = cs(rp, 'width');
        panels.rightHeight = cs(rp, 'height');
      } else {
        panels.rightPanel = 'MISSING';
      }

      sendBeacon('diag_panels', panels);

      // 5. Clock & calendar check
      var content = {};
      var clock = document.getElementById('clock');
      if (clock) {
        content.clockDisplay = cs(clock, 'display');
        content.clockWidth = cs(clock, 'width');
        content.clockHeight = cs(clock, 'height');
      }
      var cal = document.getElementById('cal-current');
      if (cal) {
        content.calInnerLen = cal.innerHTML.length;
        content.calFirstChild = cal.firstChild ? cal.firstChild.nodeName : 'none';
      }
      var dateEl = document.getElementById('dateFull');
      if (dateEl) {
        content.dateText = dateEl.textContent || dateEl.innerText || 'empty';
      }

      // Check the injected animation style element
      var styles = document.getElementsByTagName('style');
      content.styleCount = styles.length;
      if (styles.length > 0) {
        var lastStyle = styles[styles.length - 1];
        var cssText = lastStyle.textContent || lastStyle.innerText || '';
        content.lastStyleLen = cssText.length;
        content.lastStyleSnippet = cssText.substring(0, 120);
      }

      sendBeacon('diag_content', content);

      // 6. Live -webkit-box layout test
      // Create a test box and measure if children actually lay out
      var boxTest = {};
      try {
        var parent = document.createElement('div');
        parent.style.cssText = 'display:-webkit-box;-webkit-box-orient:horizontal;width:200px;height:50px;position:absolute;top:-9999px;left:0;';
        var child1 = document.createElement('div');
        child1.style.cssText = 'width:100px;height:50px;';
        var child2 = document.createElement('div');
        child2.style.cssText = 'width:100px;height:50px;';
        parent.appendChild(child1);
        parent.appendChild(child2);
        document.body.appendChild(parent);

        var pcs = window.getComputedStyle(parent);
        boxTest.parentDisplay = pcs.display;
        boxTest.parentWidth = pcs.width;

        var c1r = child1.getBoundingClientRect();
        var c2r = child2.getBoundingClientRect();
        boxTest.child1Left = c1r.left;
        boxTest.child1Width = c1r.width;
        boxTest.child2Left = c2r.left;
        boxTest.child2Width = c2r.width;
        boxTest.sameRow = (c1r.top === c2r.top);

        document.body.removeChild(parent);
      } catch (e) {
        boxTest.error = e.message;
      }

      sendBeacon('diag_boxtest', boxTest);

      // 7. Errors collected
      sendBeacon('diag_errors', { errors: errors, count: errors.length });

    }, 200);
  }, false);
})();
