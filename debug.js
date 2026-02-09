/* =============================================================
 * Kindle Dashboard — Debug Tools
 *
 * Load this FIRST (blocking) in <head> to capture everything:
 *   <script src="debug.js"></script>
 *
 * Comment out or remove the <script> tag to disable.
 *
 * Features:
 * - Captures window.onerror and unhandled exceptions
 * - Intercepts console.log / .warn / .error / .info
 * - Logs DOMContentLoaded and load timing
 * - Reports viewport, UA, and feature detection
 * - On-screen overlay showing recent log entries
 * - Optional POST bin for sending full logs remotely
 *
 * ES5 only — no arrow functions, no let/const, no template
 * literals, no promises, no destructuring.
 * ============================================================= */

(function() {
  'use strict';

  // ── Configuration ──
  // Set this to your POST bin URL (e.g. https://webhook.site/xxx)
  // Leave empty string to disable remote logging.
  var POST_BIN_URL = 'https://www.postb.in/1770677449534-2940259755123';

  // Maximum entries kept in memory
  var MAX_ENTRIES = 200;

  // How many lines to show on the on-screen overlay
  var OVERLAY_LINES = 20;

  // Whether the overlay is visible by default
  var OVERLAY_VISIBLE = true;

  // ── State ──
  var entries = [];
  var overlayEl = null;
  var toggleEl = null;
  var startTime = new Date().getTime();

  // ── Helpers ──
  function timestamp() {
    var elapsed = new Date().getTime() - startTime;
    return '+' + elapsed + 'ms';
  }

  function safeStr(val) {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'object') {
      try { return JSON.stringify(val); }
      catch (e) { return String(val); }
    }
    return String(val);
  }

  function argsToString(args) {
    var parts = [];
    for (var i = 0; i < args.length; i++) {
      parts.push(safeStr(args[i]));
    }
    return parts.join(' ');
  }

  // ── Core logging ──
  function addEntry(level, message) {
    var entry = {
      time: timestamp(),
      level: level,
      message: message
    };

    entries.push(entry);
    if (entries.length > MAX_ENTRIES) {
      entries.shift();
    }

    updateOverlay();
  }

  // ── Console interception ──
  var origConsole = {
    log:   console.log,
    warn:  console.warn,
    error: console.error,
    info:  console.info
  };

  console.log = function() {
    origConsole.log.apply(console, arguments);
    addEntry('LOG', argsToString(arguments));
  };

  console.warn = function() {
    origConsole.warn.apply(console, arguments);
    addEntry('WARN', argsToString(arguments));
  };

  console.error = function() {
    origConsole.error.apply(console, arguments);
    addEntry('ERR', argsToString(arguments));
  };

  console.info = function() {
    origConsole.info.apply(console, arguments);
    addEntry('INFO', argsToString(arguments));
  };

  // ── Global error handler ──
  var origOnError = window.onerror;
  window.onerror = function(msg, url, line, col, err) {
    var detail = msg + ' at ' + (url || '?') + ':' + (line || '?') + ':' + (col || '?');
    if (err && err.stack) {
      detail += '\n' + err.stack;
    }
    addEntry('EXCEPTION', detail);

    if (typeof origOnError === 'function') {
      return origOnError.apply(this, arguments);
    }
    return false;
  };

  // ── On-screen overlay ──
  function createOverlay() {
    // Container
    overlayEl = document.createElement('div');
    overlayEl.id = 'debug-overlay';
    overlayEl.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'background: #f5f5f5',
      'color: #000',
      'font-family: monospace, sans-serif',
      'font-size: 11px',
      'line-height: 1.3',
      'padding: 8px',
      'overflow-y: auto',
      'z-index: 99999',
      'white-space: pre-wrap',
      'word-wrap: break-word',
      'display: ' + (OVERLAY_VISIBLE ? 'block' : 'none')
    ].join('; ') + ';';

    // Toggle button — small tap target in top-right
    toggleEl = document.createElement('div');
    toggleEl.id = 'debug-toggle';
    toggleEl.style.cssText = [
      'position: fixed',
      'top: 0',
      'right: 0',
      'width: 40px',
      'height: 40px',
      'background: #000',
      'color: #fff',
      'font-family: monospace, sans-serif',
      'font-size: 18px',
      'font-weight: bold',
      'text-align: center',
      'line-height: 40px',
      'z-index: 100000',
      'cursor: pointer'
    ].join('; ') + ';';
    toggleEl.textContent = OVERLAY_VISIBLE ? 'X' : 'D';

    function onToggle(e) {
      if (e.type === 'touchstart') {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.type === 'click') {
        e.stopPropagation();
      }
      OVERLAY_VISIBLE = !OVERLAY_VISIBLE;
      overlayEl.style.display = OVERLAY_VISIBLE ? 'block' : 'none';
      toggleEl.textContent = OVERLAY_VISIBLE ? 'X' : 'D';
      if (OVERLAY_VISIBLE) {
        updateOverlay();
      }
    }

    toggleEl.addEventListener('touchstart', onToggle, false);
    toggleEl.addEventListener('click', onToggle, false);

    document.body.appendChild(overlayEl);
    document.body.appendChild(toggleEl);
  }

  function updateOverlay() {
    if (!overlayEl || !OVERLAY_VISIBLE) return;

    var start = Math.max(0, entries.length - OVERLAY_LINES);
    var lines = [];
    for (var i = start; i < entries.length; i++) {
      var e = entries[i];
      lines.push('[' + e.level + ' ' + e.time + '] ' + e.message);
    }
    overlayEl.textContent = lines.join('\n');
    overlayEl.scrollTop = overlayEl.scrollHeight;
  }

  // ── POST bin ──
  // Tries XHR POST first, then falls back to Image beacon (GET).
  // Image beacons bypass CORS since they're just <img> loads.

  function buildPayload() {
    return {
      userAgent: navigator.userAgent,
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        screenWidth: screen.width,
        screenHeight: screen.height,
        devicePixelRatio: window.devicePixelRatio || 'N/A'
      },
      entries: entries.slice(0)
    };
  }

  function sendViaXHR(url, data, onFail) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            addEntry('INFO', 'POST bin: XHR sent OK (status ' + xhr.status + ')');
          } else {
            addEntry('WARN', 'POST bin: XHR status ' + xhr.status + ', trying beacon');
            if (onFail) onFail();
          }
        }
      };
      xhr.onerror = function() {
        addEntry('WARN', 'POST bin: XHR failed (network/CORS), trying beacon');
        if (onFail) onFail();
      };
      xhr.send(JSON.stringify(data));
    } catch (e) {
      addEntry('WARN', 'POST bin: XHR exception: ' + e.message);
      if (onFail) onFail();
    }
  }

  function sendViaBeacon(url, data) {
    // Encode payload as a query param on a GET request via Image.
    // Most POST bins won't accept this, so we use a chunked approach:
    // send a summary as a single beacon hit.
    try {
      var summary = {
        ua: navigator.userAgent,
        vp: window.innerWidth + 'x' + window.innerHeight,
        scr: screen.width + 'x' + screen.height,
        dpr: window.devicePixelRatio || 'N/A',
        logCount: data.entries.length,
        errors: [],
        log: []
      };

      // Collect errors and last N log lines
      for (var i = 0; i < data.entries.length; i++) {
        var e = data.entries[i];
        if (e.level === 'EXCEPTION' || e.level === 'ERR') {
          summary.errors.push(e.time + ' ' + e.message);
        }
        summary.log.push('[' + e.level + ' ' + e.time + '] ' + e.message);
      }

      // URL-encode and truncate to stay under ~2000 chars for the URL
      var encoded = encodeURIComponent(JSON.stringify(summary));
      if (encoded.length > 1800) {
        // Trim log entries to fit
        while (summary.log.length > 0 && encodeURIComponent(JSON.stringify(summary)).length > 1800) {
          summary.log.shift();
        }
        encoded = encodeURIComponent(JSON.stringify(summary));
      }

      var sep = url.indexOf('?') === -1 ? '?' : '&';
      var img = new Image();
      img.onload = function() {
        addEntry('INFO', 'POST bin: beacon sent OK');
      };
      img.onerror = function() {
        addEntry('WARN', 'POST bin: beacon also failed (img blocked or URL rejected)');
      };
      img.src = url + sep + 'data=' + encoded;
    } catch (e) {
      addEntry('WARN', 'POST bin: beacon exception: ' + e.message);
    }
  }

  function flushToBin() {
    if (!POST_BIN_URL || entries.length === 0) return;

    var data = buildPayload();
    sendViaXHR(POST_BIN_URL, data, function() {
      sendViaBeacon(POST_BIN_URL, data);
    });
  }

  // ── Feature / environment detection ──

  // Test a single CSS declaration. Returns true if the browser accepts it.
  function testCSS(declaration) {
    var el = document.createElement('div');
    el.style.cssText = declaration;
    return el.style.cssText.length > 0;
  }

  function detectEnvironment() {
    addEntry('INFO', '=== Kindle Debug Tools Loaded ===');
    addEntry('INFO', 'UA: ' + navigator.userAgent);
    addEntry('INFO', 'Screen: ' + screen.width + 'x' + screen.height);
    addEntry('INFO', 'Viewport: ' + window.innerWidth + 'x' + window.innerHeight);
    addEntry('INFO', 'DPR: ' + (window.devicePixelRatio || 'N/A'));

    // CSS feature checks — test both unprefixed and -webkit- variants
    var cssTests = [
      ['display: flex',              'display: -webkit-flex',             'display: -webkit-box',    'Flexbox'],
      ['display: grid',              null,                                null,                      'CSS Grid'],
      ['--test: 1',                  null,                                null,                      'Custom Props'],
      ['transform: rotate(0deg)',    '-webkit-transform: rotate(0deg)',   null,                      'Transform'],
      ['animation: none',            '-webkit-animation: none',           null,                      'Animation'],
      ['position: fixed',            null,                                null,                      'Position Fixed'],
      ['width: 100vh',               null,                                null,                      'Viewport Units']
    ];

    for (var i = 0; i < cssTests.length; i++) {
      var row = cssTests[i];
      var label = row[row.length - 1];
      var result = 'NO';

      for (var j = 0; j < row.length - 1; j++) {
        if (row[j] && testCSS(row[j])) {
          result = (j === 0) ? 'YES' : 'YES (via ' + row[j].split(':')[0] + ')';
          break;
        }
      }

      addEntry('INFO', label + ': ' + result);
    }

    // JS feature checks
    var jsFeatures = [
      ['JSON',             typeof JSON !== 'undefined'],
      ['querySelector',    typeof document.querySelector === 'function'],
      ['addEventListener', typeof document.addEventListener === 'function'],
      ['getComputedStyle', typeof window.getComputedStyle === 'function'],
      ['XMLHttpRequest',   typeof XMLHttpRequest !== 'undefined'],
      ['classList',        document.documentElement.classList !== undefined]
    ];

    for (var k = 0; k < jsFeatures.length; k++) {
      addEntry('INFO', jsFeatures[k][0] + ': ' + (jsFeatures[k][1] ? 'YES' : 'NO'));
    }
  }

  // ── Lifecycle hooks ──
  function onDOMReady() {
    addEntry('INFO', 'DOMContentLoaded fired');
    createOverlay();
    updateOverlay();
  }

  function onLoad() {
    addEntry('INFO', 'window.load fired');
    updateOverlay();

    // Check if the main app elements exist
    var checks = [
      'root', 'clock', 'hourHand', 'minuteHand',
      'dateDayName', 'dateFull', 'cal-current', 'cal-next',
      'view-0', 'view-1', 'viewDots'
    ];
    for (var i = 0; i < checks.length; i++) {
      var el = document.getElementById(checks[i]);
      addEntry('INFO', 'DOM #' + checks[i] + ': ' + (el ? 'found' : 'MISSING'));
    }

    // Check if view-0 is active
    var view0 = document.getElementById('view-0');
    if (view0) {
      addEntry('INFO', 'view-0 classes: "' + view0.className + '"');
      var style = window.getComputedStyle(view0);
      addEntry('INFO', 'view-0 display: ' + style.display);
      addEntry('INFO', 'view-0 size: ' + style.width + ' x ' + style.height);
    }

    // Check landscape wrapper
    var rootEl = document.getElementById('root');
    if (rootEl) {
      var rootStyle = window.getComputedStyle(rootEl);
      addEntry('INFO', 'root size: ' + rootStyle.width + ' x ' + rootStyle.height);
      var tf = rootStyle.transform || rootStyle.webkitTransform || rootStyle.getPropertyValue('-webkit-transform') || 'N/A';
      addEntry('INFO', 'root transform: ' + tf);
    }

    // Send everything to POST bin if configured
    flushToBin();
  }

  // If body already exists (script in body), create overlay immediately
  // Otherwise wait for DOMContentLoaded
  if (document.body) {
    createOverlay();
    detectEnvironment();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      if (!overlayEl) {
        createOverlay();
        detectEnvironment();
      }
      onDOMReady();
    }, false);
  } else {
    // DOM already ready
    if (!overlayEl && document.body) {
      createOverlay();
      detectEnvironment();
    }
    onDOMReady();
  }

  window.addEventListener('load', onLoad, false);

  // ── Public API ──
  // Accessible as window.kindleDebug for manual use from console
  window.kindleDebug = {
    log: function(msg) { addEntry('LOG', msg); },
    warn: function(msg) { addEntry('WARN', msg); },
    error: function(msg) { addEntry('ERR', msg); },
    entries: function() { return entries.slice(0); },
    flush: flushToBin,
    show: function() {
      OVERLAY_VISIBLE = true;
      if (overlayEl) overlayEl.style.display = 'block';
      if (toggleEl) toggleEl.textContent = 'X';
      updateOverlay();
    },
    hide: function() {
      OVERLAY_VISIBLE = false;
      if (overlayEl) overlayEl.style.display = 'none';
      if (toggleEl) toggleEl.textContent = 'D';
    }
  };
})();
