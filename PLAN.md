# Implementation Plan & Design Decisions

## Architecture

### Single HTML File
Everything lives in one self-contained HTML file — inline `<style>`, inline `<script>`. No external dependencies, no build tools, no fetching. This eliminates extra HTTP requests and keeps things maximally simple for the constrained Kindle browser.

### ES5 JavaScript
The Kindle 11th gen browser supports ES5. Avoid ES6+ features (arrow functions, let/const, template literals, destructuring, promises, etc.) to be safe. Use `var`, string concatenation, and function expressions.

## E-ink Design Principles

These are non-negotiable for the target device:

- **System sans-serif font only** — no web fonts (avoids FOIT/FOUT and full-page repaint on font load)
- **Borders over fills** — minimises repaint area on partial e-ink refreshes
- **No animations or transitions** — except the clock hands (which use stepped CSS animation, see below)
- **No shadows, gradients, or transparency**
- **High contrast** — black (#000) on light grey (#f5f5f5), with grey (#ccc) for secondary gridlines
- **No hover states** — this is a touch-only device
- **Chunky line weights** — all borders/lines are thick enough to render cleanly on e-ink (3-6px for key elements)
- **Today's date** uses solid black fill with white text (inverted cell)
- **Past dates** are greyed out (#999)

Reference: The [eink-ui](https://github.com/marcomattes/eink-css-ui-framework) CSS library follows similar principles. We borrow its philosophy but don't use the library itself.

## Clock Implementation

### CSS Stepped Animation (not JS-driven)
The clock hands are positioned using CSS `transform: rotate()` and animated using CSS `@keyframes` with `steps()` timing.

**Why:** The primary goal is to reduce JS timer wake-ups from once per minute to once per 15 minutes. This is well-supported by browser engine guidance:

- The WebKit team (directly relevant — the Kindle browser is WebKit-based) explicitly advises: *"Minimize the use of timers to avoid waking up the CPU. Try to coalesce timer-based work into a few, infrequent timers."* They explain that modern CPUs ramp between low-power idle and high-power states, and *"to maximize battery life, you want to reduce the amount of time spent in high-power states, and let the hardware go back to idle as much as possible."* ([WebKit Blog: How Web Content Can Affect Power Usage](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/))

- MDN corroborates: *"Modern CPUs can enter a lower-power mode when mostly idle. Applications that constantly fire timers or keep unnecessary animations running prevent CPUs from entering low-power mode."* ([MDN: Performance Fundamentals](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Fundamentals))

So a `setInterval` firing every 60 seconds vs every 900 seconds is legitimately different — each timer fire is a CPU wake-up that prevents the processor from staying in its deepest idle state. Reducing from 60 wake-ups per hour to 4 is a meaningful improvement.

**Nuance — CSS animations aren't free either:** The same WebKit article warns to *"be particularly vigilant to avoid CSS animations that continually trigger painting."* Our CSS `steps(15)` animation over 900 seconds is still a running animation that the browser's compositor tracks. It causes a repaint every 60 seconds when the step changes — the same visual update frequency as a JS timer would produce.

The theoretical advantage is *what happens between those visual updates*. With JS `setInterval`, the JS engine must schedule, fire, and execute a callback on the main thread every minute. With a CSS stepped animation, the browser's internal animation scheduler handles timing at a lower level — it doesn't need to wake the JS engine, parse/execute a callback, or trigger garbage collection. On modern browsers, `transform: rotate()` changes can be handled by the compositor thread without touching the main thread at all.

**However**, we cannot confirm the Kindle's older WebKit (circa 2009 vintage, updated in firmware v5.16.4) compositor-accelerates CSS transform animations independently of the main thread. That's a feature of modern browser engines. The Kindle's WebKit may run CSS animations on the main thread anyway, in which case the power difference between CSS steps and JS timers at the per-minute level is negligible.

**Our position:** The 15-minute JS recalibration cycle is clearly better than 60-second timers, backed by authoritative sources. The CSS stepped animation *may* provide additional savings by keeping per-minute work off the JS main thread, but on the Kindle's older WebKit this benefit is uncertain. Worst case, it's equivalent to JS timers. Best case, it's genuinely more efficient. Either way, the approach is sound — it's at least as good as the alternative and potentially better.

**How it works:**
- The minute hand runs a 15-step CSS animation over 900 seconds (15 minutes), stepping once per minute (6° per step)
- The hour hand runs a 3-step CSS animation over the same 900 seconds, stepping every 5 minutes (2.5° per step)
- JS recalibrates every 15 minutes: recalculates start angles, restarts animations, and checks if the date changed
- On initial load, a negative `animation-delay` phase-aligns the hands to the current time within the 15-minute block

**Recalibration alignment:** The first recalibration timeout is calculated to fire exactly on the next 15-minute boundary (e.g., :00, :15, :30, :45), then a regular `setInterval` takes over.

### No Second Hand
A second hand would cause constant e-ink partial refreshes (once per second), draining battery and causing visible flashing. The minute hand stepping once per minute is the finest granularity that makes sense on e-ink.

## Landscape Rotation

The Kindle browser doesn't natively re-render in landscape. We use a CSS transform on a wrapper div:

```css
.landscape-wrap {
  width: 100vh;
  height: 100vw;
  transform: rotate(90deg);
  transform-origin: top left;
  margin-left: 100vw;
}
```

This rotates the entire DOM tree. Because it's real DOM (not canvas), browser hit-testing works correctly through the transform — click/touch events fire on the correct elements without any coordinate remapping.

## Refresh / Battery Strategy

The goal is to minimise e-ink screen refreshes and JS CPU wake-ups:

- **No `<meta http-equiv="refresh">`** — full page reloads cause full e-ink screen flashes
- **No canvas** — canvas redraws trigger large repaint regions
- **No `requestAnimationFrame` loops** — these keep the CPU busy at 60fps
- **Clock:** CSS animation handles minute-by-minute updates without JS involvement
- **JS runs every 15 minutes** only, to recalibrate clock and check date
- **Calendar grid only re-renders when the date changes** (i.e. at midnight)
- **The only per-minute screen change** is two small CSS transform rotations on the clock hands, which should trigger only a small partial e-ink refresh in that region

## View System

### Multi-view with tap navigation
- Views are `<section>` elements shown/hidden with a CSS `.active` class
- Tap anywhere to cycle to the next view
- Auto-returns to the main (clock/calendar) view after 30 seconds of inactivity
- View indicator dots at the bottom show current position

### Extensibility
Adding a new view:
1. Add a new `<div class="view secondary-view" id="view-N">` in the HTML
2. Increment `totalViews` in JS
3. Optionally add an update function called from `recalibrate()` if the view needs periodic data

### Planned secondary view: Octopus Agile rates
- Will need to fetch data from the Octopus Energy API
- Kindle browser may have CORS restrictions — might need a simple proxy/serverless function, or the API might support CORS directly
- Implementation deferred to later

## Calendar Rendering

- **Monday start** (UK standard)
- Current month + next month, always
- Day labels: M T W T F S S
- Full gridlines (light grey between cells, heavier black outer borders and under day labels) for easy column tracking
- Today: solid black cell with white text
- Past dates: grey text
- Re-renders only when the date string changes (checked every 15 minutes)

## Layout (Landscape)

```
┌─────────────────────────────────────────┐
│                                         │
│   ┌──────────┐    ┌──────────────────┐  │
│   │          │    │ February 2026    │  │
│   │  Clock   │    │ M T W T F S S   │  │
│   │  (260px) │    │ gridded calendar │  │
│   │          │    ├──────────────────┤  │
│   └──────────┘    │ March 2026      │  │
│                   │ M T W T F S S   │  │
│   Sunday          │ gridded calendar │  │
│   8 February 2026 └──────────────────┘  │
│                                         │
│              · ○                        │
└─────────────────────────────────────────┘
```

Left panel (45%): clock + date display
Right panel (55%): two calendar months stacked vertically

## File Structure

```
/
├── kindle-calendar.html    # The entire app — single file
├── README.md
├── CLAUDE.md               # Agent instructions for Claude Code
└── PLAN.md                 # This file
```
