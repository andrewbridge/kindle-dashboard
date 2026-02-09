# Kindle E-ink Calendar & Clock

A minimal, battery-conscious calendar and clock web app designed to run in the Kindle browser as a replacement for a physical flip calendar.

## Target Device

- **Amazon Kindle 11th gen (2022)** — 6" display, 1072×1448 @ 300ppi
- Browser: "Experimental Web Browser" — WebKit-based, ES5 JS, HTML5/CSS3 support (firmware v5.16.4+)
- Usable viewport: approximately 1072×~1350 after browser chrome/taskbar

## What It Does

- **Main view:** Analogue clock (no numbers, quarter markers only) + today's date + current month calendar + next month calendar
- **Secondary views:** Tap to cycle through additional info screens (e.g. Octopus Agile energy rates). Auto-returns to main view after 30 seconds.
- Runs in **landscape orientation** via CSS rotation (the Kindle browser doesn't natively re-render in landscape)

## Hosting

Single static HTML file — designed for GitHub Pages or any static host. No build step, no dependencies.

## Running Locally

Just open `kindle-calendar.html` in a browser. The landscape rotation means it'll look odd in a normal browser window — resize your window to roughly portrait proportions (e.g. 400×600) to see the rotated layout properly.

On the Kindle, navigate to the hosted URL in the Experimental Browser.
