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
  var POST_BIN_URL = '';

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
  function sendToBin(payload) {
    if (!POST_BIN_URL) return;

    var xhr = new XMLHttpRequest();
    xhr.open('POST', POST_BIN_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    try {
      xhr.send(JSON.stringify(payload));
    } catch (e) {
      // Silently fail — we're debugging, not adding more problems
    }
  }

  function flushToBin() {
    if (!POST_BIN_URL || entries.length === 0) return;

    sendToBin({
      userAgent: navigator.userAgent,
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        screenWidth: screen.width,
        screenHeight: screen.height,
        devicePixelRatio: window.devicePixelRatio || 'N/A'
      },
      entries: entries.slice(0)
    });
  }

  // ── Feature / environment detection ──
  function detectEnvironment() {
    addEntry('INFO', '=== Kindle Debug Tools Loaded ===');
    addEntry('INFO', 'UA: ' + navigator.userAgent);
    addEntry('INFO', 'Screen: ' + screen.width + 'x' + screen.height);
    addEntry('INFO', 'Viewport: ' + window.innerWidth + 'x' + window.innerHeight);
    addEntry('INFO', 'DPR: ' + (window.devicePixelRatio || 'N/A'));

    // CSS feature checks
    var tests = {
      'CSS Grid': 'display: grid',
      'CSS Custom Props': '--test: 1',
      'CSS Transform': 'transform: rotate(0deg)',
      'CSS Animation': 'animation: none'
    };

    var testEl = document.createElement('div');
    document.body.appendChild(testEl);

    for (var name in tests) {
      if (tests.hasOwnProperty(name)) {
        testEl.style.cssText = tests[name];
        // If the browser understood it, the computed style should reflect it
        var computed = window.getComputedStyle(testEl);
        var prop = tests[name].split(':')[0].replace('--test', 'display');
        var supported = testEl.style.cssText.length > 0;
        addEntry('INFO', name + ': ' + (supported ? 'YES' : 'NO'));
      }
    }

    document.body.removeChild(testEl);

    // JS feature checks
    var jsFeatures = {
      'JSON': typeof JSON !== 'undefined',
      'querySelector': typeof document.querySelector === 'function',
      'addEventListener': typeof document.addEventListener === 'function',
      'getComputedStyle': typeof window.getComputedStyle === 'function',
      'XMLHttpRequest': typeof XMLHttpRequest !== 'undefined',
      'classList': document.documentElement.classList !== undefined
    };

    for (var feat in jsFeatures) {
      if (jsFeatures.hasOwnProperty(feat)) {
        addEntry('INFO', feat + ': ' + (jsFeatures[feat] ? 'YES' : 'NO'));
      }
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
      addEntry('INFO', 'root transform: ' + rootStyle.transform);
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
