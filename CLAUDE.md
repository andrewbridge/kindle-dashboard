# CLAUDE.md

## Project Overview

This is a single-file web app (HTML/CSS/JS) that runs in the Amazon Kindle 11th gen (2022) browser as a calendar and clock display. It replaces a paper flip calendar — the Kindle sits propped up on a desk showing the time, date, and calendar.

Read PLAN.md for full design decisions and architecture.

## Critical Constraints

### Kindle Browser Compatibility
- **ES5 only** — no arrow functions, no let/const, no template literals, no destructuring, no promises, no async/await, no ES6 modules
- Use `var`, function expressions, string concatenation with `+`
- The browser is WebKit-based (circa 2009 vintage, updated in firmware v5.16.4)
- CSS3 is supported including transforms, animations, grid, and custom properties
- No web fonts — system sans-serif only
- Canvas is supported but we deliberately avoid it (causes large repaint regions)

### E-ink Display Rules
- **Never** add CSS animations or transitions except on the clock hands
- **Never** use shadows, gradients, opacity, or transparency
- **Never** use hover states
- All borders should be chunky (3-6px for structural elements, 1px for grid lines)
- Prefer borders over background fills to minimise repaint area
- Today's calendar cell is an exception — it uses solid black fill with white text for visibility
- Use high contrast: #000 on #f5f5f5, with #ccc for secondary lines, #999 for de-emphasised text

### Performance / Battery
- JS should execute as infrequently as possible — currently every 15 minutes for recalibration
- The clock hands are driven by CSS stepped animations between recalibrations
- The calendar only re-renders when the date actually changes
- Never use requestAnimationFrame loops, continuous setInterval, or meta refresh
- Every DOM change causes a partial e-ink refresh (visible flash) — minimise them

## Architecture

- **Single HTML file** — all CSS in `<style>`, all JS in `<script>`, no external dependencies
- **Landscape rotation** — CSS transform on wrapper div, not canvas
- **View system** — multiple `<div class="view">` sections, toggled via `.active` class, tap to cycle, auto-return after 30s

## Development

No build step. Just edit `kindle-calendar.html` and open in a browser to test. The landscape rotation means you'll want to resize your browser to portrait-ish proportions to see the rotated layout.

For testing on the actual Kindle:
1. Host the file (e.g. `python3 -m http.server` on the local network, or push to GitHub Pages)
2. Open the Kindle's Experimental Browser
3. Navigate to the URL

## What's Done
- [x] Basic layout: clock (left) + two calendar months (right)
- [x] Landscape rotation via CSS
- [x] Analogue clock with quarter markers, no numbers, no second hand
- [x] CSS stepped animations for clock hands (15 steps/15 mins for minute, 3 steps/15 mins for hour)
- [x] JS recalibration every 15 minutes, aligned to :00/:15/:30/:45 boundaries
- [x] Calendar rendering: Monday start, gridlines, solid black today cell, greyed past dates
- [x] View switching with tap, auto-return, indicator dots
- [x] Placeholder secondary view for Octopus Agile rates

## What's Next
- [ ] Test on actual Kindle and adjust sizing/proportions
- [ ] Implement Octopus Agile rates view (needs API integration, possibly a CORS proxy)
- [ ] Consider adding more secondary views
- [ ] GitHub Pages deployment setup
- [ ] Fine-tune clock hand lengths relative to clock face on device
- [ ] Verify CSS animation stepping works correctly on Kindle browser
- [ ] Consider a "no landscape" fallback or toggle if rotation causes issues
- [ ] Battery life testing — monitor actual Kindle battery drain over a week
