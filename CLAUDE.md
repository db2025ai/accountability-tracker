# Life OS - Accountability Tracker

## Project Overview
Single-page web app (PWA) for personal goal tracking, health monitoring, and daily accountability. No framework — vanilla HTML, CSS, and JavaScript. All data lives in browser **localStorage** (key: `lifeOSData`). Optional Convex backend for cloud sync. Deployed via **GitHub Pages** from the `/docs` folder.

**Live URL:** https://db2025ai.github.io/accountability-tracker/

## File Structure

### Core Source Files (edit these)
- `life-os.html` — HTML structure with 7 sections (Dashboard, Goals, Health, Today, Reflection, Meditate, Weekly Review)
- `life-os.js` — Single `LifeOS` class with all application logic (~4,100 lines)
- `life-os.css` — All styles including responsive design (~3,500 lines)
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
- `convex/nutrition.ts` — meals, saved meals, daily targets and weigh-ins (tables `meals`, `savedMeals`, `nutritionSettings`, `weighIns`). Public: `getRange` (per-day totals for the app), `pendingWeighIns`, `markWeighInsApplied`. Everything that writes meals is `internal` and only reachable through the connector
- `convex/workouts.ts` — workout sessions (table `workouts`): exercises with sets, the key lifts (bench, squat, deadlift, ohp) and muscle groups. Public: `getRange` (session summaries for the app), `lastSets` (workout mode's Previous column), `finishSession` (workout mode's Finish). Everything else writes through the connector
- `convex/plans.ts` — workout mode: `workoutPlans` (sessions Claude plans) and `trainingProfile` (injuries, equipment, schedule, goals Claude should remember). Public: `forRange`. Writes are `internal`, through the connector
- `convex/http.ts` — **Claude connector**: a minimal MCP server (JSON-RPC over POST) at `https://energetic-fly-308.convex.site/mcp/<MCP_TOKEN>`. Tools: log_meal, update_meal, delete_meal, get_day, get_summary, list/save/delete saved meals, set_targets, log_weight, get_weights, log_workout, update_workout, delete_workout, get_workouts, get_lift_progress, get_sleep, get/set_training_profile, plan_workout, get_plans, delete_plan. The token in the path is the only key (404 without it). `POST /ingest/sleep` is the Apple Watch Shortcut's endpoint, with its own key
- `convex/health.ts` + `convex/lib/sleep.ts` — Apple Watch sleep (table `sleepLogs`): the Shortcut's samples become one night (see Apple Watch sleep). Public: `pendingSleep`, `markSleepApplied`
- `convex/lib/auth.ts` — `requireAppKey(appKey)`: every public function calls it first (see Security)
- `convex/lib/reminders.ts` — "what's left today" + message text. **Mirrors the schedule rules in life-os.js** (classifyFrequency, scoringKind, getGoalDays, isExpected) — change both together
- Env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (site URL), `MCP_TOKEN` (connector key, 24+ chars), `APP_KEY` (the app's key, 24+ chars), `SHORTCUT_KEY` (the sleep Shortcut's key, 24+ chars). Never print the private key or any of the keys
- Deploy: `npx convex deploy` (uses `CONVEX_DEPLOY_KEY`)

## Security (app key)
- **This repo is public and names the deployment, so the URL is not a secret.** What protects the data is `APP_KEY`: every public Convex function (query, mutation, action) takes `appKey: v.optional(v.string())` and calls `requireAppKey(appKey)` before anything else. It throws `ConvexError("Unauthorized")` on a missing or wrong key, and refuses everything if `APP_KEY` is unset or shorter than 24 characters. **Any new public function must do the same and be added to the list in the "the app key locks every public function" test.** Internal functions (cron, connector) don't need it.
- The app keeps the key per device (`lifeOS_appKey`, Settings → Convex Backend, a password field). `ConvexDataLayer.call` adds it to every request. A refusal sets `convex.unauthorized`, which shows `#syncBanner` ("Cloud sync is paused") and a red status line in Settings; Connect with a wrong key never writes to Convex.
- The Apple Watch Shortcut has its own key (`SHORTCUT_KEY`, sent as `Authorization: Bearer …` to `/ingest/sleep`). It can only add sleep, because a shared Shortcut carries its headers with it.
- The Claude connector has its own key (`MCP_TOKEN`, in the URL path). Rotate either by setting a new value with `npx convex env set`, then re-entering the app key on each device or re-adding the connector in Claude.
- **Only this site's code runs.** A Content-Security-Policy `<meta>` in life-os.html allows scripts, styles and workers from the site itself (inline is allowed, since the build inlines everything), media and images from the site plus `data:`/`blob:`, and network requests only to the site and `https://*.convex.cloud`. Libraries live in `vendor/` (copied to `docs/vendor/` by build_docs.py; versions and checksums in vendor/README.md). Don't add a CDN `<script>`: vendor the file. A new outside connection needs a `connect-src` entry, or the browser blocks it.
- **Rollout order** when the server starts requiring something new from the app: set the env var, deploy Convex, then merge the app (GitHub Pages publishes on merge, and the service worker is network-first). A device without the key keeps working locally but doesn't sync until the key is entered, and the next sync takes the cloud copy, so enter the key before logging anything new.

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
- **Night mode**: dark tokens live in two identical blocks — `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and `:root[data-theme="dark"]` — change both together. Never hard-code a colour: use tokens (`--on-primary` for text on blue/terracotta fills, `--header-bg`, `--nav-bg`, `--overlay`, `--orb`…). Settings → Appearance is Auto / Light / Dark (`lifeOS_theme`, per device); an inline script in `<head>` sets `data-theme` before first paint, and `applyTheme()` updates the `theme-color` metas and redraws charts (they read colours when drawn).

### Frequency-Based Grouping (Today Tab)
All goals are grouped by frequency in the Today tab, displayed in this order:

1. **Daily Essentials** — `daily`, `weekdays`, `weeknights` targets, and any goal with a custom `days` schedule
2. **A Few Times This Week** — `x2`, `x3` targets (shows progress bar like "2/3")
3. **Weekly Goals** — `weekly`, `x1` targets
4. **Limits & Boundaries** — `x1 max`, `x2 max`, and every Budgeting goal (red when exceeded)
5. **Monthly Goals** — `monthly` targets

Grouping follows `scoringKind(goal)` so the Today tab matches how a goal is scored.

**Shrinking list:** only what's left today is listed. Daily rows have ○ (done → `'X'`) and ✗ (missed → `'1'`); both fold the row into collapsed **Done** / **Missed** groups at the bottom (Missed rows offer Undo and "Doesn't apply" → `'-'`, which moves them to **Doesn't apply today**). Untouched items still become misses after midnight (scoring rule). N×/week and monthly rows have ○ only; Limits are a folded group where ○ logs a use today. Buttons carry `data-action` (`done` / `miss` / `skip` / `undo` / `toggle` / `meditate`), handled by one delegated listener in `bindHabits()`; open/closed folds are remembered in `this._todayFolds`. The Meditate goal row has a ▶ that opens the Meditate section.

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
- A week's start is `weekStartOf(week)`: `startDate` + 12h, floored to Sunday, so weeks created in another timezone (e.g. `T04:00Z` from Eastern time, imports at local noon) still land on the right Sunday. Use `getWeekForDate(date)` (exact match, no fallback) and `weekDayDate(week, d)` for day dates, and `localDateKey(date)` — not `toISOString()` — for local `YYYY-MM-DD` keys. `getTodayStr()` is local too (it was UTC, which filed US-evening check-ins under tomorrow).

### Daily check-in (Health tab)
- Weight, sleep and energy share one **Save check-in** button (`saveCheckin`); tapping an energy number only selects it. Empty fields keep what's already saved for today. `renderCheckin` puts today's saved values back in the fields and shows "Saved for today: …".

## Yesterday Catch-up, Badge and Reminders
- **Catch-up**: on open (after the Convex load, if connected) `maybeShowCatchUp()` shows "Yesterday — did you do these?" for yesterday's still-blank scheduled daily items, cutover weeks only, at most once per day (localStorage `lifeOS_catchUpShown`). Never before `LATE_NIGHT_HOURS` (yesterday is still open for a late reflection or meditation); it's checked again whenever the app comes back to the front. Done writes `'X'` for checked items; unchecked stay misses.
- **Badge**: `updateAppBadge()` runs on every dashboard/goals/today render and sets the Home Screen badge to `todayRemainingCount()` (clears at 0).
- **Reminders** (`data.settings.reminders = { enabled, morning, evening, timezone }`, defaults 08:00 / 21:00 / device timezone): Settings → Enable reminders asks for notification permission from the tap, subscribes with the VAPID key from `push:getVapidPublicKey`, and saves the subscription to Convex. The cron sends a morning nudge and, at the evening time, "N items left today" only if N > 0; `pushSends` records each send so nothing goes out twice. The service worker always shows a notification on push, sets the badge from `payload.count`, and a tap opens `./?section=habits` (the Today tab).

## Reflection (journal)
- Evening reflection fields: went well, fell short, **3 highlights / things to remember** (`reflection.highlights[]`; older entries have `gratitude`, still displayed), values rating, intention. Reflections are dated with `reflectionDay()`: the local date, or the day before until `LATE_NIGHT_HOURS` (3 AM), so being up past midnight still counts for that night. `#lateNightNote` says so on the form; the streak and history apply the same rule to each reflection's timestamp.
- **Catching up** (`#reflectDay`, "Reflecting on", `fillReflectDays`): today ("Tonight" before 3 AM) or one of the 6 days before. An entry for an earlier day is saved with that `date` plus `backdated: true`, ticks that day's goal, counts toward the streak, and sits under its own day in the history with "written Oct 25". `reflectionKey(r)` is the day any saved reflection is for. A day picked on purpose survives re-renders and the draft; otherwise the picker follows the clock, and it resets to today after saving.
- Saving a reflection checks off today's cell for the goal whose name matches /evening reflection/i (`checkOffGoal(pattern, date)` — the same helper finished 3/5-minute meditations use for /meditat/i).
- **Typing on a phone** (`bindTyping`): `textarea.autogrow` boxes grow with their text (`autoGrow`; hidden sections can't be measured, so `navigateTo` sizes them when shown); while a field has focus `body.typing` hides the bottom tab bar and `keepFieldVisible` keeps the field above the keyboard. Return in a highlight moves to the next. Saving shows a quiet note (`#stoicSaveNote`, `setSaveNote`) — no `alert()`. A half-written reflection is kept per device in `lifeOS_reflectionDraft` (24h) and cleared on save.
- **Journal streak** (`getJournalStreak()`): consecutive local days with a saved reflection or an imported entry; today not done yet doesn't break it. Shows current, best, days journaled and the last 14 days.
- **Import** (Settings → Import Journal Entries): PDF (pdf.js from `vendor/pdfjs`, loaded only when needed) or .txt/.md. `parseJournalEntries(pages)` drops lines repeated on most pages (headers/footers) and page numbers, then starts a new entry at each line that is just a date (+ optional time) — see `parseDateHeading`. Preview, then import: text goes to Convex `journalArchive` (or localStorage `lifeOS_journalArchive` without Convex); only the dates go in `data.journalImportDates` (for the streak). Shown read-only and searchable under "Journal archive" on the Reflection tab.

## Meditate (guided sessions)
- Four sessions × 1 / 3 / 5 minutes: **Breathe** (sigh, long exhales, box), **Reflect** (the day's theme, below), **Body** (scan + seated stretches), **Sleep** (4-7-8, letting the day go). Scripts are data in `MEDITATIONS` (top of life-os.js); breathing patterns in `BREATH_PATTERNS`.
- **Reflect = a daily theme** (Headspace-style talk, then practice). `REFLECT_THEMES` holds 30 themes, Stoic and therapy-style (ACT, CBT, DBT, self-compassion) in turn; each has a `title`, 3 `talk` lines, 3 `prompts` and a `carry` line. `themeOfDay(themes)` picks one a day in order from the date (same on every device; before 3 AM it's still the night before's). 3 and 5 min: arrive, the talk, 2 or 3 prompts (pauses 12 / 20 s), quiet breathing, then the carry line; 1 min: the title, the first talk line, one prompt, the carry line. The card shows "Today: …" and the log stores `theme`. Quotes are paraphrased (no copyrighted translations). The test checks every theme fits every length with nothing skipped.
- Script steps: `{ say, pause }`, `{ breathe, cycles, cues }`, `{ breathe, fill: true }` (breathes until the closing), `{ closing: true }`. Steps that don't fit are skipped and the closing is always played, so a session ends on its length whatever the voice speed.
- **Voice = recordings.** iPhone Home Screen apps can't use `speechSynthesis` (it's silent there), so every line is pre-recorded in a warm, calm voice ("Michael", Kokoro-82M v1.0 `am_michael` at 0.9 speed, Apache-2.0, run with kokoro-onnx) and played with Web Audio like the chimes. Files: `docs/audio/med/*.mp3` + `manifest.json` (text → file; the file name hashes voice + text, so a new voice gets new files and phones can't replay a cached old one). `medClip(text)` fetches/decodes and caches (the list is fetched with `cache: 'no-cache'`, and a line missing from it or a 404 refetches the list once, so a phone that kept the app open across a voice or script update recovers); `medSpeak` plays and waits on the session clock, so Pause/Resume continue mid-line. A line without a recording falls back to captions only.
- **After editing any script text or cue, re-record:** `python3 -m venv .venv-tts && .venv-tts/bin/pip install --only-binary=:all: kokoro-onnx==0.6.1` (once), then `.venv-tts/bin/python tools/meditation_audio.py` (needs node + ffmpeg; `tools/meditation-lines.mjs` lists every line). The model comes from the kokoro-onnx GitHub release (no Hugging Face needed) and is checked against the SHA-256 sums in the script. Recording takes a few minutes for everything. Unchanged lines are kept, removed ones deleted. The test fails if any line lacks a recording.
- Device voices (`speechSynthesis`, rate 0.88) are still offered in the Voice picker for desktop browsers / Safari tabs. Captions always show. Voice choice (`lifeOS_medVoiceChoice`, default `recorded`), voice on/off and last length are per-device localStorage. Locking the phone pauses; a screen wake lock is requested while playing. Recordings only exist under `docs/` (the built site), so opening `life-os.html` from the repo root falls back to device voices.
- **iPhone audio rules** (break these and it's silent on iOS while every desktop test passes):
  - Device speech only starts from a tap: `startMeditation` speaks a device voice's first line synchronously, before any `await` (recordings don't need this — the AudioContext is resumed in the tap).
  - Never `cancel()` then immediately `speak()` — WebKit drops the new utterance. Cues are skipped if speech is still playing.
  - Web Audio follows the silent switch: `medPrimeAudio()` (from the tap) sets `navigator.audioSession.type = 'playback'` and loops a generated silent WAV so chimes and voice play like media; `medReleaseAudio()` undoes it.
  - Recordings in a session: lines load one at a time in spoken order and decode one at a time (`medDecode`, callback form) — decoding a whole session at once can fail on iPhone. Before each line `medAudioReady()` resumes the AudioContext (iOS can leave it `suspended`/`interrupted`); a line that can't load within 8s falls back to captions.
  - Never `await` the screen wake lock before the first line (it can hang in Home Screen apps).
  - Test button (`medSoundCheck`) and the in-player hint (`medVoiceProblem`) say *why* there's no voice: "Speak the guidance" off (the Test button plays regardless, so it warns), a download/decode error, or the iPhone pausing the sound (Pause → Resume wakes it). The generic volume hint shows only when there's no specific reason.
- Finished sessions go in `data.meditationLog` (`{ date, ts, kind, minutes, theme? }`); 3- and 5-minute sessions also check off the goal whose name matches /meditat/i. Both use `reflectionDay()`, so a session before 3 AM counts for the day before (the Meditate page says so then). Ending early (<90%) logs nothing.
- The session clock is pause-aware (`medElapsed`, `medSleepUntil`); tests speed it up with `lifeOS._medTimeScale`.

## Nutrition (meals logged from Claude)
- **Claude does the work, the app keeps score.** The user tells Claude what they ate (photo, dictation, text); Claude logs it through the connector. The app never writes meals and has no meal forms: keep it that way, it's what keeps this feature small.
- The Health tab **Nutrition card** (`renderNutrition` / `loadNutrition`) reads `nutrition:getRange` for the last 14 days: today's calories and protein against target, carbs/fat line, and a 14-day protein strip. Data is cached in `this._nutrition` and refetched when older than 60s or the day changed.
- **Protein goal**: a goal whose name matches `PROTEIN_GOAL` (/protein target/i, e.g. "Protein target (190g)") is ticked `'X'` on each loaded day protein reached the target (`applyProteinCheckoffs`). "Doesn't apply" `'-'` days are left alone. Don't widen the pattern: "High protein/fat breakfast" must not match.
- **Weigh-ins** from Claude land in `weighIns`; on load `applyWeighIns` copies them into `data.healthLog`, saves, then calls `markWeighInsApplied`. The server never rewrites the `userData` blob, so it can't race the app's own saves.
- Tests: `tests/app.test.mjs` (Nutrition card scenario, Convex stubbed with `context.route`) and `npm run test:convex` (connector end to end in memory with convex-test).
- `autoTickGoal(pattern, dateKey)` is the shared tick for synced data (protein, workouts): it never overrides a done cell or a `'-'`. `checkOffGoal` is for taps (meditation, reflection) and does.

## Training (workouts logged from Claude)
- Claude logs sessions through the connector (`log_workout`, or `update_workout` to add lifts to an Apple Watch session), or the user runs one in **workout mode** (below). The card reads `workouts:getRange` for the last 12 weeks and `plans:forRange` for the next 7 days.
- A session: `type` (strength | cardio | swim | core | mobility | other), `minutes`, optional `distance` + `distanceUnit`, and for lifting `exercises[]` = `{ name, lift?, muscles[], sets[{ reps, weight }] }` (lb, 0 = bodyweight). `lift` is set only on the key lifts (bench, squat, deadlift, ohp); muscles are chest | back | shoulders | arms | legs | core. `externalId` (e.g. the watch workout's start) makes a resend a no-op.
- **Estimated 1-rep max** = Epley, `weight × (1 + reps/30)`, from sets of 12 reps or fewer (`e1rm` in workouts.ts). `log_workout` / `update_workout` return `newBests` when a key lift beats every other logged session.
- The Health tab **Training card** (`renderTraining` / `loadTraining`, cached in `this._training`, refetched after 60s or a new day): sessions + minutes this week (Sun–Sat), muscle-group chips with "Not yet", each key lift's best e1RM of the last 4 weeks vs the 4 before (ochre "Not trained in 4 weeks" when it's slipping), and the last 2 weeks of sessions. Names come from chat: always `escapeHtml`.
- **Goal ticks** (`WORKOUT_GOALS`, `applyWorkoutCheckoffs`): strength → /strength training/i, cardio or swim → /cardio training/i, type core → /core work ?out/i, on the session's date. Core moves inside a lift don't tick the core goal. The Workouts ring reads those ticks, so it fills on its own. Deleting a workout doesn't untick.
- Tests: Training card scenario in `tests/app.test.mjs`; "workouts end to end" in `tests/convex.test.ts`.

## Workout mode (Strong/Hevy-style, Claude as coach)
- **Claude coaches, the app runs the session.** In chat, Claude reads `get_training_profile`, recent `get_workouts` (including exercise notes like "Felt discomfort") and `get_lift_progress`, then `plan_workout` writes the session: exercises with target sets (`reps`, optional `repsMax`, `weight`, `warmup`), `restSec` and a coaching `note`. One plan per date; re-planning replaces an unstarted one. Progression rules live in the `plan_workout` description in http.ts.
- The Training card's top block (`workoutTodayHtml`) offers Resume, today's plan (or the next one) with Start, or an Empty workout. `startWorkout` builds the session; `loadPreviousSets` fills the Previous column (and empty weights) from `workouts:lastSets`.
- The **workout screen** (`#workoutScreen`, full screen like the Meditate player): per exercise a Set / Previous / lb / Reps / ✓ table, + Add set, "Felt discomfort" (saved as the exercise's `note`), Skip, and Add exercise (`guessLift` tags the key lifts by name). Ticking a set starts the rest timer (`restSec`; warm-ups 60s max). Hide leaves it running; Finish → notes for the coach → `workouts:finishSession`, which saves only ticked working sets, appends "Skipped: …" to the notes, marks the plan done and returns new bests.
- The session in progress lives in localStorage `lifeOS_activeWorkout` (saved on every change), so a locked phone or reload loses nothing. Its `id` is the row's `externalId`, so a retried Finish never saves twice. Clock and rest timer are computed from timestamps. The end-of-rest chime is Web Audio unlocked by the ✓ tap (silent with the iPhone's silent switch on; the bar also turns blue).
- Names in plans come from chat: `escapeHtml` in text, `escapeAttr` in attributes.
- Tests: Workout mode scenario in `tests/app.test.mjs`; "workout mode: profile, plans, Previous and Finish" in `tests/convex.test.ts`.

## Apple Watch sleep
- An iPhone Shortcut (run each morning by a Personal Automation) finds the last day of Sleep Analysis samples in Apple Health and POSTs them to `https://energetic-fly-308.convex.site/ingest/sleep` as `{ "samples": "START|END|VALUE\n…" }`. Times are ISO 8601 with the phone's offset; VALUE is "In Bed", "Core", "Deep", "REM", "Awake", "Asleep (Unspecified)" or HealthKit's 0-5 codes. `{ date, hours, bedtime? }` also works. The reply is one plain-text line ("Logged 7.4 h of sleep for Tue, Oct 20 (in bed 10:55 PM, up 6:40 AM).") for the Shortcut to show.
- `summarizeNight` (lib/sleep.ts): asleep stages are merged across sources (no double counting) and split into sessions at gaps over 2 h. The latest session with 2+ h asleep is the night. Bedtime is the In Bed start if the phone recorded one, else when sleep began; `date` is the wake-up date and `nightOf` the evening it began. Times are wall clock from the strings, so no timezone table is needed. One `sleepLogs` row per date; re-sending replaces it.
- The app (`syncSleep`, after the first Convex load and on Health renders, at most once a minute) copies pending nights into `data.healthLog` (`sleep`, `sleepSource: 'watch'`, `bedtime`), saves, then `markSleepApplied`. The check-in labels it "(Apple Watch)"; typing a different number clears the label. `tickBedtime` ticks the goal matching /in bed by/i on `nightOf` when the bedtime beat the time in its name (after midnight is always late; `isExpected` days only).
- Claude reads nights with `get_sleep` (watch rows plus check-in sleep), and `plan_workout` tells it to go lighter after under 6 h.
- Tests: "Apple Watch sleep" in both test files.

## Architecture Notes

- **Single LifeOS class** contains all logic — no separate modules
- **No test framework** — `tests/app.test.mjs` is a Playwright script (seeded data, stubbed Chart.js, fixed clock) covering scoring before/after the cutover, catch-up, badge, reminders settings and the service worker. Also covers highlights, journal streak, PDF import (generates a PDF, uses the vendored pdf.js), the Content Security Policy, the Today shrinking list, every meditation session (stubbed speech, sped-up clock), night mode (Auto / Light / Dark) and journal typing (growing boxes, tab bar, Return, draft, save note). Run `npm ci && python3 build_docs.py && node tests/app.test.mjs`
- **No build tools** beyond the Python inliner (no bundler, no transpiler)
- **Chart.js 4.4.0** for all charts, served from `vendor/` (no CDN; see Security)
- **CSS variables** in `:root` control theming (see Look & feel)
- **Responsive at 768px** — sidebar collapses, mobile bottom nav appears
- **Mobile chrome** — light header with menu + settings buttons and a 6-tab bottom bar — Home, Goals, Health, Today, Journal, Meditate (Weekly Review lives in the ☰ menu) — with 12px labels, ~26px icons, full-width tap targets. `viewport-fit=cover` + `env(safe-area-inset-*)` keep both clear of the notch and home indicator; status bar style is `default` (dark text on the paper background)
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
- `renderMeditation()` / `startMeditation(kind, minutes)` / `finishMeditation()` — Guided sessions
- `renderNutrition()` / `renderTraining()` / `autoTickGoal(pattern, dateKey)` — Health tab cards fed by the Claude connector, and their goal ticks
- `startWorkout(planId)` / `renderWorkout()` / `saveWorkout()` — Workout mode
- `saveData()` — Persists to localStorage (and Convex if connected)
