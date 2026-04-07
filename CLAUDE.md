# Life OS - Accountability Tracker

## Project Overview
Single-page web app (PWA) for personal goal tracking, health monitoring, and daily accountability. No framework — vanilla HTML, CSS, and JavaScript. All data lives in browser **localStorage** (key: `lifeOSData`). Optional Convex backend for cloud sync. Deployed via **GitHub Pages** from the `/docs` folder.

**Live URL:** https://db2025ai.github.io/accountability-tracker/

## File Structure

### Core Source Files (edit these)
- `life-os.html` — HTML structure with 6 sections (Dashboard, Goals, Health, Today, Reflection, Weekly Review)
- `life-os.js` — Single `LifeOS` class with all application logic (~2,700 lines)
- `life-os.css` — All styles including responsive design (~2,500 lines)
- `convex-client.js` — Optional Convex sync layer (HTTP-based, falls back silently)

### Generated Files (do NOT edit directly)
- `docs/index.html` — Auto-generated standalone HTML with CSS/JS inlined
- `life-os-standalone.html` — Same as docs/index.html (legacy copy)

### Build & Deploy
- `build_docs.py` — Python script that inlines CSS/JS into `docs/index.html`
- `docs/manifest.json` — PWA manifest
- `docs/sw.js` — Service worker for offline caching

### Optional Backend
- `convex/schema.ts` — Single `userData` table
- `convex/functions.ts` — getData, setData, getUpdatedAt

## Build & Deploy Process

After making any changes to `life-os.html`, `life-os.css`, or `life-os.js`:

```bash
python3 build_docs.py
```

This inlines CSS and JS into `docs/index.html`, copies `sw.js` and `manifest.json` to `/docs/`, and fixes service worker paths for the GitHub Pages subpath. Then commit and push — GitHub Pages auto-deploys from `/docs`.

## UI Conventions

### Frequency-Based Grouping (Today Tab)
All goals are grouped by frequency in the Today tab, displayed in this order:

1. **Daily Essentials** — `daily`, `weekdays`, `weeknights` targets
2. **A Few Times This Week** — `x2`, `x3` targets (shows progress bar like "2/3")
3. **Weekly Goals** — `weekly`, `x1` targets
4. **Limits & Boundaries** — `x1 max`, `x2 max` (red when exceeded)
5. **Monthly Goals** — `monthly` targets

Within each frequency group, items are sub-labeled by category (Morning Protocol, Midday Protocol, Evening Protocol first, then alphabetical).

### Goal Target Format
| Target | Meaning | Frequency Group |
|--------|---------|----------------|
| `daily` | Every day (7/week) | Daily Essentials |
| `weekdays` / `weeknights` | Mon-Fri (5/week) | Daily Essentials |
| `x2`, `x3`, etc. | N times per week | A Few Times This Week |
| `weekly` / `x1` | Once per week | Weekly Goals |
| `x1 max`, `x2 max` | Maximum allowed | Limits & Boundaries |
| `monthly` | Once per month | Monthly Goals |

### Weekly Tracking Data
Each week's `entries` array has one entry per goal with a 7-element `tracking` array:
- Index 0 = Sunday through 6 = Saturday
- Values: `'X'` (completed), `'1'` (strike/missed), `''` (not tracked yet)

Checking items in the Today tab writes to the same tracking data as the Goals grid — they are the same data, different views.

## Architecture Notes

- **Single LifeOS class** contains all logic — no separate modules
- **No test framework** — manual testing only
- **No build tools** beyond the Python inliner (no bundler, no transpiler)
- **Chart.js 4.4** loaded from CDN for all charts
- **CSS variables** in `:root` control theming (primary: `#6366f1` indigo)
- **Responsive at 768px** — sidebar collapses, mobile bottom nav appears

## Key Methods in life-os.js
- `renderHabits()` — Renders the Today tab with frequency grouping
- `renderGoals()` — Renders the weekly Goals grid
- `classifyFrequency(target)` — Maps target strings to frequency groups
- `createNewWeek()` — Creates a new week with entries for all goals
- `toggleGoalCell()` — Cycles tracking value: '' → 'X' → '1' → ''
- `saveData()` — Persists to localStorage (and Convex if connected)
