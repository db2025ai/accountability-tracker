# Life OS

A personal operating system for tracking goals, habits, health, and journaling — built as a single-page web app with no framework or backend required.

**Live:** https://db2025ai.github.io/accountability-tracker/

---

## What It Does

- **Goals & Accountability** — weekly tracking grid with categories, strike counts, subtotals, and a grand total. Click day headers to mark vacation days.
- **Today** — daily checklist grouped by frequency (morning/midday/evening protocols, daily habits, weekly goals). Marks travel days to preserve streaks.
- **Dashboard** — life score, weekly trend, problem areas, all-time stats by category with goal breakdowns, and a collapsible Deep Dive with month-over-month bars, active streaks, and top/bottom goals filtered by 3W / 3M / YTD / All.
- **Health** — sleep, energy, mood, substance tracking with weekly charts.
- **Journal** — daily reflection, evening review, and weekly review entries.

## Data & Privacy

All data lives in your browser's **LocalStorage** — nothing is sent to any server. Use **Settings → Export JSON** to back up your data.

## Setup

No installation needed. Open the live URL in any modern browser. On iPhone, tap Share → "Add to Home Screen" to use it like a native app.

## Importing Historical Data

1. Export your Google Sheets as CSV
2. Run `python3 parse_csv.py` (in `Downloads/`) to generate `life-os-historical-import.json`
3. Go to **Settings → Merge Historical Weeks** and select the JSON file

## Building / Deploying

The `docs/` folder is served by GitHub Pages. To rebuild after editing source files:

```bash
python3 build_docs.py
```

This inlines `life-os.css` and `life-os.js` into `docs/index.html`.

## Files

| File | Purpose |
|---|---|
| `life-os.html` | App structure |
| `life-os.js` | All application logic |
| `life-os.css` | Styles |
| `build_docs.py` | Inlines CSS/JS into `docs/index.html` for GitHub Pages |
| `docs/index.html` | Live build (auto-generated, don't edit directly) |
| `manifest.json` / `sw.js` | PWA support (add to home screen) |
