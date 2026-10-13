# Life OS - Accountability Tracker

## Project Overview
Single-page web app (PWA) for personal goal tracking, health monitoring, and daily accountability. No framework — vanilla HTML, CSS, and JavaScript. All data lives in browser **localStorage** (key: `lifeOSData`). Optional Convex backend for cloud sync. Deployed via **GitHub Pages** from the `/docs` folder.

**Live URL:** https://db2025ai.github.io/accountability-tracker/

## File Structure

### Core Source Files (edit these)
- `life-os.html` — HTML structure with 6 sections (Dashboard, Goals, Health, Today, Reflection, Weekly Review)
- `life-os.js` — Single `LifeOS` class with all application logic (~3,600 lines)
- `life-os.css` — All styles including responsive design (~3,050 lines)
- `convex-client.js` — Optional Convex sync layer (HTTP-based, falls back silently)

### Generated Files (do NOT edit directly)
- `docs/index.html` — Auto-generated standalone HTML with CSS/JS inlined
- `life-os-standalone.html` — Same as docs/index.html (legacy copy)

### Build & Deploy
- `build_docs.py` — Python script that inlines CSS/JS into `docs/index.html`
- `docs/manifest.json` — PWA manifest
- `docs/sw.js` — Service worker for offline caching

### Optional Backend (Convex, deployment `energetic-fly-308`)
- `convex/schema.ts` — `userData` (the data blob), `pushSubscriptions`, `reminderSettings`, `pushSends`, `journalArchive`
- `convex/functions.ts` — getData, setData, getUpdatedAt. `setData` also mirrors `data.settings.reminders` into `reminderSettings`
- `convex/push.ts` — getVapidPublicKey, saveSubscription, removeSubscription + internal helpers for the cron
- `convex/pushNode.ts` — `"use node"` actions using `web-push`: `sendReminders` (cron) and `sendTest` (Settings button)
- `convex/crons.ts` — runs `sendReminders` every 15 minutes
- `convex/journal.ts` — importEntries (dedupes by date + text hash), listArchive, clearArchive for imported journal entries. **Keep large text out of the `userData` blob** — Convex documents max out at 1 MB and the blob is ~0.5 MB
- `convex/lib/reminders.ts` — "what's left today" + message text. **Mirrors the schedule rules in life-os.js** (classifyFrequency, scoringKind, getGoalDays, isExpected) — change both together
- Env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (site URL). Never print the private key
- Deploy: `npx convex deploy` (uses `CONVEX_DEPLOY_KEY`)

## Build & Deploy Process

After making any changes to `life-os.html`, `life-os.css`, or `life-os.js`:

```bash
python3 build_docs.py
```

This inlines CSS and JS into `docs/index.html`, copies `sw.js` and `manifest.json` to `/docs/`, and fixes service worker paths for the GitHub Pages subpath. Copy `docs/index.html` to `life-os-standalone.html` too. Then commit and push — GitHub Pages auto-deploys from `/docs`.

Bump `CACHE_NAME` in `sw.js` when the service worker changes.

## UI Conventions

### Look & feel (paper + ink blue)
- Colors are CSS variables in `:root`: warm paper `--bg`, white cards with hairline `--shadow`, charcoal `--text`, ink blue `--primary`. **Blue = something you tap, finished or on track** (`--success` is the same blue), terracotta `--danger` = miss / over limit, ochre `--warning` = middling. No gradients, no purple, no per-category rainbow colors. Tints: `--primary-tint`, `--danger-tint`, `--warning-tint`, `--surface`.
- Titles (h1/h2, card/section names, big numbers) use `--font-serif` (`ui-serif` = New York on Apple devices, no web font); body text uses `--font-sans`.
- Icons are inline SVG line icons with `class="icon"` (stroke = currentColor). Don't use emoji/glyph icons for UI chrome.
- Charts can't read CSS variables, so JS uses `this.themeColor('primary')` etc.; `applyChartTheme()` sets Chart.js font/colour defaults.

### Frequency-Based Grouping (Today Tab)
All goals are grouped by frequency in the Today tab, displayed in this order:

1. **Daily Essentials** — `daily`, `weekdays`, `weeknights` targets, and any goal with a custom `days` schedule
2. **A Few Times This Week** — `x2`, `x3` targets (shows progress bar like "2/3")
3. **Weekly Goals** — `weekly`, `x1` targets
4. **Limits & Boundaries** — `x1 max`, `x2 max`, and every Budgeting goal (red when exceeded)
5. **Monthly Goals** — `monthly` targets

Grouping follows `scoringKind(goal)` so the Today tab matches how a goal is scored.

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
- Values: `'X'` (completed), `'1'`/`'2'`… (strikes), `'-'` (skipped — doesn't apply that day), `''` (not tracked yet)

Checking items in the Today tab writes to the same tracking data as the Goals grid — they are the same data, different views.

### Greyed-out Days (skips and schedules)
- **Per-cell skip**: `'-'` marks one goal on one day as "doesn't apply". Set via the Skip button on the Today tab or the grid tap cycle.
- **Per-goal schedule**: optional `goal.days` (array of 0–6) on `this.data.goals`, edited with the day chips in Manage Goals. It applies to every week (looked up by goal name). Without it, days derive from the target (`weekdays` = Mon–Fri, `weeknights` = Sun–Thu, otherwise all days).
- Skipped days, unscheduled days and vacation days are excluded from expected counts and never break streaks. Use `isTracked(v)` instead of `v !== ''` when counting tracked cells, and `isExpected(week, entry, day)` when a goal should only count on days it applies.

## Scoring Rule (one helper for everything)

**Every % and strike count goes through `scoreEntry(week, entry)` → `{ done, expected, misses }`** (or `scoreWeek` / `scoreByCategory` / `scorePct`, which sum it). That covers the life score, dashboard stats, category bars, weekly trend, problem areas, all-time stats, deep dive, goals-grid strike column and subtotals, strikes + category charts, health rings, weekly review scores and the strike summary. Don't count cells by hand in a view.

Weeks starting **on/after `data.settings.scoringCutover` (`'2026-10-11'`)**: the user only checks off what they did and misses are inferred.

| Kind (`scoringKind`) | Goals | done / expected | misses |
|---|---|---|---|
| `daily` | `daily`, `weekdays`, `weeknights`, or any goal with `days` | ✓ / scheduled days that are done, struck or have passed | each scheduled day that has passed and is still blank (today is never a miss until it's over) |
| `perWeek` | `x2`, `x3`, `weekly`, `x1` | only ✓ count, capped at the target. In the current week the goal is left out unless the target is already met | shortfall, once the week is over |
| `limit` | `x… max` and the whole Budgeting category | ✓ = used one; at/under the limit = 100% | each use over the limit |
| `monthly` | `monthly` | judged in the week holding the month's last day: done if ✓ on any day of that month; left out until the month is over | 1 if the month ended undone |

- Skipped `'-'`, unscheduled and vacation days are excluded. Vacation/skips shrink an N×/week target when fewer days are left than N.
- An explicit ✗ (`'1'`) still counts as a miss, never double-counted with the inferred one (per cell for daily goals, `max(explicit, inferred)` otherwise).
- Manual +/− on the grid (`entry.manual`, may go negative) adjusts `misses`; the total never drops below 0.
- Weeks before the cutover keep the old math: ✓ ÷ marked cells, explicit strikes only (+ manual).
- Grid cells that are inferred misses get the `inferred-miss` class (faint ✗).

### Dates
- A week's start is `weekStartOf(week)`: `startDate` + 12h, floored to Sunday, so weeks created in another timezone (e.g. `T04:00Z` from Eastern time, imports at local noon) still land on the right Sunday. Use `getWeekForDate(date)` (exact match, no fallback) and `weekDayDate(week, d)` for day dates, and `localDateKey(date)` — not `toISOString()` — for local `YYYY-MM-DD` keys.

## Yesterday Catch-up, Badge and Reminders
- **Catch-up**: on open (after the Convex load, if connected) `maybeShowCatchUp()` shows "Yesterday — did you do these?" for yesterday's still-blank scheduled daily items, cutover weeks only, at most once per day (localStorage `lifeOS_catchUpShown`). Done writes `'X'` for checked items; unchecked stay misses.
- **Badge**: `updateAppBadge()` runs on every dashboard/goals/today render and sets the Home Screen badge to `todayRemainingCount()` (clears at 0).
- **Reminders** (`data.settings.reminders = { enabled, morning, evening, timezone }`, defaults 08:00 / 21:00 / device timezone): Settings → Enable reminders asks for notification permission from the tap, subscribes with the VAPID key from `push:getVapidPublicKey`, and saves the subscription to Convex. The cron sends a morning nudge and, at the evening time, "N items left today" only if N > 0; `pushSends` records each send so nothing goes out twice. The service worker always shows a notification on push, sets the badge from `payload.count`, and a tap opens `./?section=habits` (the Today tab).

## Reflection (journal)
- Evening reflection fields: went well, fell short, **3 highlights / things to remember** (`reflection.highlights[]`; older entries have `gratitude`, still displayed), values rating, intention. Reflections are dated with the local date.
- **Journal streak** (`getJournalStreak()`): consecutive local days with a saved reflection or an imported entry; today not done yet doesn't break it. Shows current, best, days journaled and the last 14 days.
- **Import** (Settings → Import Journal Entries): PDF (pdf.js loaded from the CDN only when needed) or .txt/.md. `parseJournalEntries(pages)` drops lines repeated on most pages (headers/footers) and page numbers, then starts a new entry at each line that is just a date (+ optional time) — see `parseDateHeading`. Preview, then import: text goes to Convex `journalArchive` (or localStorage `lifeOS_journalArchive` without Convex); only the dates go in `data.journalImportDates` (for the streak). Shown read-only and searchable under "Journal archive" on the Reflection tab.

## Architecture Notes

- **Single LifeOS class** contains all logic — no separate modules
- **No test framework** — `tests/app.test.mjs` is a Playwright script (seeded data, stubbed Chart.js, fixed clock) covering scoring before/after the cutover, catch-up, badge, reminders settings and the service worker. Also covers highlights, journal streak and PDF import (generates a PDF, serves pdf.js from the `pdfjs-dist` dev dependency). Run `npm ci && python3 build_docs.py && node tests/app.test.mjs`
- **No build tools** beyond the Python inliner (no bundler, no transpiler)
- **Chart.js 4.4** loaded from CDN for all charts
- **CSS variables** in `:root` control theming (primary: `#6366f1` indigo)
- **Responsive at 768px** — sidebar collapses, mobile bottom nav appears
- **Mobile chrome** — light header with menu + settings buttons and a 6-tab bottom bar (12px labels, ~26px icons, full-width tap targets). `viewport-fit=cover` + `env(safe-area-inset-*)` keep both clear of the notch and home indicator; status bar style is `default` (dark text on the paper background)
- **Phones down to 320px** — iPhone Display Zoom ("Larger Text") or page zoom leaves ~320 CSS px. Flex/grid children that hold wide content need `min-width: 0` (so tables/charts scroll inside their box, not the page), and fields are 16px on phones so iOS doesn't zoom in when one is tapped. The iOS Text Size slider doesn't affect this app (it uses `-apple-system`, not `-apple-system-body`)

## Key Methods in life-os.js
- `renderHabits()` — Renders the Today tab with frequency grouping
- `renderGoals()` — Renders the weekly Goals grid
- `classifyFrequency(target)` — Maps target strings to frequency groups
- `createNewWeek()` — Creates a new week with entries for all goals
- `toggleGoalCell()` — Cycles tracking value: '' → 'X' → '1' → '-' → ''
- `getGoalDays(goal)` / `isExpected(week, entry, day)` / `isTracked(v)` — Schedule and skip helpers
- `scoreEntry(week, entry)` / `scoreWeek` / `scoreByCategory` / `scoringKind(goal)` — The scoring rule
- `maybeShowCatchUp()` / `updateAppBadge()` / `toggleReminders()` — Catch-up prompt, badge, push reminders
- `getJournalStreak()` / `previewJournalImport(file)` / `parseJournalEntries(pages)` / `renderArchive()` — Journal streak, import and archive
- `saveData()` — Persists to localStorage (and Convex if connected)
