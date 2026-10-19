// Browser checks for scoring, yesterday catch-up, badge, reminders settings and the service worker.
// Run after `python3 build_docs.py`:  node tests/app.test.mjs
// Uses Playwright (local install, or PLAYWRIGHT_PATH); Chart.js is stubbed and the clock is fixed.
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); }
const { chromium } = playwright;

// Serve docs/ at /accountability-tracker/ like GitHub Pages
const DOCS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const PDFJS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'pdfjs-dist', 'build');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/accountability-tracker\/?/, '') || 'index.html';
    const file = path.join(DOCS, rel);
    if (!file.startsWith(DOCS) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const BASE = `${ORIGIN}/accountability-tracker/`;
const TZ = 'America/New_York';
let failures = 0;
const check = (name, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`}`);
};

// ---- Seed data ----
const goal = (category, name, target, extra = {}) => ({ category, name, target, ...extra });
const goals = [
    goal('Morning Protocol', 'Skincare AM', 'daily'),
    goal('Morning Protocol', 'Up by 7:15AM', 'weekdays'),
    goal('Evening Protocol', 'In bed by 11:15PM', 'weeknights'),
    goal('Evening Protocol', 'Meditate (3-5 min, long exhales)', 'daily'),
    goal('Physical Health', '2 Strength Training', 'x2'),
    goal('Physical Health', '2 Cardio Training (1 swim)', 'x2'),
    goal('Midday Protocol', 'Cold shower finish 60s', 'x1'),
    goal('Physical Health', '1 Night of Drinking, 2 drinks max', 'x1 max'),
    goal('Budgeting', 'Buy lunch max x2/weekdays', 'x2'),
    goal('Budgeting', 'Sunday Money Date with Chelsey', 'weekly'),
    goal('Monthly', 'Review financial health (expenses, savings)', 'monthly'),
    goal('Mental Health', 'Written Journaling 10 min x2 (Wed & Sat)', 'x2', { days: [3, 6] }),
];
// Local-midnight Sunday in Chicago, like createNewWeek stores it
const sunday = (ymd) => new Date(`${ymd}T05:00:00Z`).toISOString(); // CDT (UTC-5)
const week = (ymd, rows, extra = {}) => ({
    startDate: sunday(ymd),
    entries: Object.fromEntries(goals.map((g, i) => [i, {
        goal: { category: g.category, name: g.name, target: g.target },
        tracking: rows[g.name] ? [...rows[g.name]] : ['', '', '', '', '', '', ''],
        ...(g.name === 'Meditate (3-5 min, long exhales)' && extra.manualMeditate ? { manual: extra.manualMeditate } : {})
    }])),
    ...(extra.vacationDays ? { vacationDays: extra.vacationDays } : {})
});

// Pre-cutover week (Oct 4): legacy math
const W0 = week('2026-10-04', {
    'Skincare AM': ['X', '', 'X', '1', '', '', ''],
    'In bed by 11:15PM': ['X', 'X', '', '', '', '', ''],
    '2 Strength Training': ['', '', '', '', '', '', ''],
    '1 Night of Drinking, 2 drinks max': ['X', '', '', '', '', '', ''],
    'Buy lunch max x2/weekdays': ['', 'X', '', '', '', '', ''],
});
// Cutover week (Oct 11) — "today" is Tue Oct 13 (dayIdx 2)
const W1 = week('2026-10-11', {
    'Skincare AM': ['X', '', '', '', '', '', ''],
    'Up by 7:15AM': ['', '', 'X', '', '', '', ''],
    'In bed by 11:15PM': ['X', '1', '', '', '', '', ''],
    'Meditate (3-5 min, long exhales)': ['-', 'X', '', '', '', '', ''],
    '2 Strength Training': ['', 'X', '', '', '', '', ''],
    '2 Cardio Training (1 swim)': ['X', 'X', '', '', '', '', ''],
    '1 Night of Drinking, 2 drinks max': ['X', 'X', '', '', '', '', ''],
    'Buy lunch max x2/weekdays': ['', 'X', '', '', '', '', ''],
}, { manualMeditate: 1 });

const seed = {
    goals,
    categories: ['Morning Protocol', 'Midday Protocol', 'Evening Protocol', 'Mental Health', 'Physical Health', 'Budgeting', 'Monthly'],
    weeks: [W0, W1],
    transactions: [], accounts: [], budgets: {}, habits: [], habitLog: {}, adhocTasks: [], healthLog: [],
    journalEntries: [], weeklyReviews: [], eveningReflections: [], activityLog: [],
    settings: { defaultBudgets: {} } // no scoringCutover on purpose: normalizeData should add it
};

const CHART_STUB = `window.Chart = class { constructor(canvas, cfg) { (window.__charts ||= {})[canvas.id] = cfg; } destroy() {} };`;

const browser = await chromium.launch({ channel: 'chromium' }); // new headless: supports notifications

async function newPage({ width = 1280, seedData = seed, time = '2026-10-13T15:00:00-05:00', notifications = false, init = null } = {}) {
    const context = await browser.newContext({ timezoneId: TZ, viewport: { width, height: 900 } });
    if (init) await context.addInitScript(init);
    if (notifications) await context.grantPermissions(['notifications'], { origin: ORIGIN });
    await context.route('**/chart.umd.min.js', r => r.fulfill({ contentType: 'application/javascript', body: CHART_STUB }));
    await context.addInitScript(([data]) => {
        if (!localStorage.getItem('__seeded')) {
            localStorage.setItem('lifeOSData', data);
            localStorage.setItem('__seeded', '1');
        }
        // Record badge calls
        window.__badge = [];
        navigator.setAppBadge = (n) => { window.__badge.push(n); return Promise.resolve(); };
        navigator.clearAppBadge = () => { window.__badge.push(0); return Promise.resolve(); };
    }, [JSON.stringify(seedData)]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(new Date(time));
    await page.goto(BASE);
    await page.waitForFunction(() => window.lifeOS);
    return { context, page, errors };
}

const score = (page, weekIdx, name) => page.evaluate(([wi, n]) => {
    const w = lifeOS.data.weeks[wi];
    const e = Object.values(w.entries).find(x => x.goal.name === n);
    const s = lifeOS.scoreEntry(w, e);
    return { done: s.done, expected: s.expected, misses: s.misses };
}, [weekIdx, name]);

// ================= Scenario 1: Tue Oct 13, mid cutover week =================
{
    const { context, page, errors } = await newPage();
    console.log('\n— Tue Oct 13, 3pm (cutover week in progress) —');
    check('cutover stored in settings', await page.evaluate(() => lifeOS.data.settings.scoringCutover), '2026-10-11');
    check('W0 (Oct 4) is legacy, W1 (Oct 11) is cutover', await page.evaluate(() => lifeOS.data.weeks.map(w => lifeOS.isCutoverWeek(w))), [false, true]);

    // Legacy week: ✓ ÷ marked cells, explicit strikes only (blanks ignored)
    check('legacy daily: 2✓ of 3 marked, 1 explicit strike', await score(page, 0, 'Skincare AM'), { done: 2, expected: 3, misses: 1 });
    check('legacy blanks never count', await score(page, 0, '2 Strength Training'), { done: 0, expected: 0, misses: 0 });
    check('legacy limit ✓ counts as done', await score(page, 0, '1 Night of Drinking, 2 drinks max'), { done: 1, expected: 1, misses: 0 });

    // Cutover week
    check('daily: Mon blank = miss, today blank ≠ miss', await score(page, 1, 'Skincare AM'), { done: 1, expected: 2, misses: 1 });
    check('weekdays: Sun unscheduled, Mon blank miss, Tue ✓', await score(page, 1, 'Up by 7:15AM'), { done: 1, expected: 2, misses: 1 });
    check('weeknights: explicit ✗ counted once, not doubled', await score(page, 1, 'In bed by 11:15PM'), { done: 1, expected: 2, misses: 1 });
    check('daily: skipped day excluded, manual +1 applies', await score(page, 1, 'Meditate (3-5 min, long exhales)'), { done: 1, expected: 1, misses: 1 });
    check('x2 not yet met mid-week: left out', await score(page, 1, '2 Strength Training'), { done: 0, expected: 0, misses: 0 });
    check('x2 already met: 100%', await score(page, 1, '2 Cardio Training (1 swim)'), { done: 2, expected: 2, misses: 0 });
    check('x1 untouched mid-week: left out', await score(page, 1, 'Cold shower finish 60s'), { done: 0, expected: 0, misses: 0 });
    check('x1 max used twice: 1 over = 1 miss', await score(page, 1, '1 Night of Drinking, 2 drinks max'), { done: 0, expected: 1, misses: 1 });
    check('Budgeting x2 used once: under limit = 100%', await score(page, 1, 'Buy lunch max x2/weekdays'), { done: 2, expected: 2, misses: 0 });
    check('Budgeting weekly untouched: under limit = 100%', await score(page, 1, 'Sunday Money Date with Chelsey'), { done: 1, expected: 1, misses: 0 });
    check('monthly mid-month: not judged', await score(page, 1, 'Review financial health (expenses, savings)'), { done: 0, expected: 0, misses: 0 });
    check('x2 with days [Wed,Sat] is daily; both still ahead', await score(page, 1, 'Written Journaling 10 min x2 (Wed & Sat)'), { done: 0, expected: 0, misses: 0 });

    // Grid (desktop shows Goals grid for latest week)
    await page.evaluate(() => lifeOS.navigateTo('goals'));
    check('grid total strikes this week', await page.textContent('.grand-total-val'), '5');
    const skincareRow = await page.$$eval('#goalsGrid tr', rows => {
        const r = rows.find(tr => tr.querySelector('.goal-name-cell')?.textContent === 'Skincare AM');
        return [...r.querySelectorAll('.day-cell')].map(td => td.className.replace('day-cell', '').trim()).slice(0, 3);
    });
    check('grid marks Mon blank as inferred miss, today plain', skincareRow, ['completed', 'inferred-miss', '']);
    check('Morning Protocol subtotal', await page.$$eval('.subtotal-row', rows => rows.find(r => r.textContent.includes('Morning Protocol')).querySelector('.subtotal-val').textContent), '2');

    // − on an inferred miss lowers the count (manual goes negative), never below 0
    await page.evaluate(() => {
        const btn = [...document.querySelectorAll('#goalsGrid tr')].find(tr => tr.querySelector('.goal-name-cell')?.textContent === 'Skincare AM').querySelector('.strike-dec');
        btn.click();
    });
    check('strike − cancels an inferred miss', await score(page, 1, 'Skincare AM'), { done: 1, expected: 2, misses: 0 });
    check('no − button once at 0', await page.evaluate(() => !![...document.querySelectorAll('#goalsGrid tr')].find(tr => tr.querySelector('.goal-name-cell')?.textContent === 'Skincare AM').querySelector('.strike-dec')), false);
    await page.evaluate(() => {
        const e = Object.values(lifeOS.data.weeks[1].entries).find(x => x.goal.name === 'Skincare AM');
        delete e.manual; lifeOS.saveData(); lifeOS.renderAll();
    });

    // Strikes chart uses the same misses
    check('strikes chart: legacy week 1, cutover week 5', await page.evaluate(() => window.__charts.goalStrikesChart.data.datasets[0].data), [1, 5]);

    // Dashboard numbers (same helper)
    const dash = await page.evaluate(() => {
        const w = lifeOS.data.weeks[1];
        const s = lifeOS.scoreWeek(w);
        return { s, bars: [...document.querySelectorAll('.category-bar-item')].map(el => el.textContent.replace(/\s+/g, ' ').trim()) };
    });
    check('week totals', dash.s, { done: 9, expected: 13, misses: 5 });
    check('category bars', dash.bars, ['Morning Protocol 50%', 'Evening Protocol 67%', 'Physical Health 67%', 'Midday Protocol 0%', 'Budgeting 100%', 'Monthly 0%', 'Mental Health 0%']);
    check('life score uses done/expected', await page.textContent('#lifeScoreValue'), String(Math.min(100, Math.round((9 / 13) * 100 * 0.6 + 15))));
    check('goals on track (misses = 0)', await page.textContent('#dashGoalsOnTrack'), '7');

    // Health rings
    await page.evaluate(() => lifeOS.navigateTo('health'));
    check('health rings', await page.evaluate(() => ['workoutCount', 'sleepScore', 'mindfulCount', 'substanceScore'].map(id => document.getElementById(id).textContent)),
        ['3/4', '1/2', '1/1', '0%']);

    // Weekly review: scores + strike summary (used to throw on any strike)
    await page.evaluate(() => lifeOS.navigateTo('review'));
    const review = await page.evaluate(() => ({
        scores: [...document.querySelectorAll('.review-score-card')].map(c => c.textContent.replace(/\s+/g, ' ').trim()),
        summary: document.getElementById('strikeSummaryText').textContent
    }));
    check('review scores', review.scores, ['50% Morning Protocol', '67% Evening Protocol', '67% Physical Health', '0% Midday Protocol', '100% Budgeting', '0% Monthly', '0% Mental Health']);
    check('strike summary counts 5 strikes', review.summary.startsWith('5 strikes · '), true);

    // Today tab grouping follows the scoring rule
    await page.evaluate(() => { lifeOS.closeModal('catchUpModal'); lifeOS.navigateTo('habits'); });
    const groups = await page.$$eval('.freq-group', gs => gs.map(g => [g.querySelector('.freq-label').textContent, [...g.querySelectorAll('.habit-name')].map(n => n.textContent)]));
    const limits = groups.find(([t]) => t === 'Limits & Boundaries')[1];
    check('Budgeting shows under Limits & Boundaries', limits.includes('Buy lunch max x2/weekdays') && limits.includes('Sunday Money Date with Chelsey'), true);

    check('no page errors', errors, []);
    await context.close();
}

// ================= Scenario 2: catch-up prompt + badge =================
{
    const { context, page, errors } = await newPage({ width: 390 });
    console.log('\n— Catch-up prompt + badge (mobile) —');
    // Mon Oct 12 unchecked + scheduled: Skincare AM, Up by 7:15AM (In bed has ✗, Meditate ✓, Journaling not on Mon)
    check('catch-up modal open', await page.isVisible('#catchUpModal.active'), true);
    check('catch-up title', await page.textContent('#catchUpModal h2'), 'Yesterday — did you do these?');
    check('catch-up items', await page.$$eval('#catchUpList .habit-name', els => els.map(e => e.textContent)), ['Skincare AM', 'Up by 7:15AM']);
    check('badge = today remaining (Skincare, In bed, Meditate)', await page.evaluate(() => window.__badge.at(-1)), 3);
    await page.click('#catchUpList .catchup-item:first-child');
    await page.click('#catchUpDoneBtn');
    check('modal closed after Done', await page.isVisible('#catchUpModal.active'), false);
    check('checked item written as ✓ yesterday; unchecked stays blank', await page.evaluate(() => {
        const w = lifeOS.data.weeks[1];
        const t = n => Object.values(w.entries).find(e => e.goal.name === n).tracking[1];
        return [t('Skincare AM'), t('Up by 7:15AM')];
    }), ['X', '']);
    check('unchecked one is still a miss', await score(page, 1, 'Up by 7:15AM'), { done: 1, expected: 2, misses: 1 });
    check('Skincare now 2/2', await score(page, 1, 'Skincare AM'), { done: 2, expected: 2, misses: 0 });
    check('mobile lands on Today tab', await page.isVisible('#section-habits.active'), true);

    await page.reload();
    await page.waitForFunction(() => window.lifeOS);
    check('not shown again the same day', await page.isVisible('#catchUpModal.active'), false);

    // Check off the rest of today → badge clears
    await page.evaluate(() => {
        const w = lifeOS.data.weeks[1];
        ['Skincare AM', 'In bed by 11:15PM', 'Meditate (3-5 min, long exhales)'].forEach(n => {
            Object.values(w.entries).find(e => e.goal.name === n).tracking[2] = 'X';
        });
        lifeOS.saveData(); lifeOS.renderHabits();
    });
    check('badge cleared at 0', await page.evaluate(() => window.__badge.at(-1)), 0);

    // Next day (Wed) after midnight, app resumes → prompt for Tue
    await page.evaluate(() => {
        const w = lifeOS.data.weeks[1];
        Object.values(w.entries).find(e => e.goal.name === 'Up by 7:15AM').tracking[2] = 'X';
        lifeOS.saveData();
    });
    await page.clock.setFixedTime(new Date('2026-10-14T07:30:00-05:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    check('new day: no prompt when yesterday is all done', await page.isVisible('#catchUpModal.active'), false);
    check('new day: badge = Wed items (Skincare, Up by, In bed, Meditate, Journaling)', await page.evaluate(() => window.__badge.at(-1)), 5);

    // ?section=habits (notification tap) opens Today
    check('no page errors', errors, []);
    await context.close();
}

// ================= Scenario 3: weeks that are over, monthly, vacation =================
{
    const W2 = week('2026-10-18', {}, {});
    const W3 = week('2026-10-25', { 'Review financial health (expenses, savings)': ['', '', '', '', '', '', ''] }, { vacationDays: [0, 1, 2, 3, 4, 5, 6] });
    const data = { ...seed, weeks: [W0, W1, W2, W3] };
    const { context, page, errors } = await newPage({ seedData: data, time: '2026-11-02T12:00:00-06:00' });
    console.log('\n— Mon Nov 2 (cutover weeks finished) —');
    check('x2 week over: 1 short = 1 miss', await score(page, 1, '2 Strength Training'), { done: 1, expected: 2, misses: 1 });
    check('x1 week over, none = 1 miss', await score(page, 1, 'Cold shower finish 60s'), { done: 0, expected: 1, misses: 1 });
    check('weeknights week over: Tue–Thu blanks are misses', await score(page, 1, 'In bed by 11:15PM'), { done: 1, expected: 5, misses: 4 });
    check('x2 with days: Wed & Sat blank = 2 misses', await score(page, 1, 'Written Journaling 10 min x2 (Wed & Sat)'), { done: 0, expected: 2, misses: 2 });
    check('full vacation week: daily excluded', await score(page, 3, 'Skincare AM'), { done: 0, expected: 0, misses: 0 });
    check('full vacation week: x2 excluded', await score(page, 3, '2 Strength Training'), { done: 0, expected: 0, misses: 0 });
    check('full vacation week: limit excluded', await score(page, 3, 'Buy lunch max x2/weekdays'), { done: 0, expected: 0, misses: 0 });
    check('monthly: Oct over, not done = 1 miss in the week holding Oct 31', await score(page, 3, 'Review financial health (expenses, savings)'), { done: 0, expected: 1, misses: 1 });
    check('monthly: other weeks of the month not judged', await score(page, 2, 'Review financial health (expenses, savings)'), { done: 0, expected: 0, misses: 0 });
    await page.evaluate(() => {
        // Done on Mon Oct 5 (in the pre-cutover week) still counts for October
        Object.values(lifeOS.data.weeks[0].entries).find(e => e.goal.name.startsWith('Review financial')).tracking[1] = 'X';
    });
    check('monthly: done any day of the month = 100%', await score(page, 3, 'Review financial health (expenses, savings)'), { done: 1, expected: 1, misses: 0 });
    check('legacy week unchanged by the new rule', await score(page, 0, 'Skincare AM'), { done: 2, expected: 3, misses: 1 });
    check('weekly trend renders', await page.evaluate(() => document.getElementById('weeklyTrend').textContent.length > 0), true);
    check('no page errors', errors, []);
    await context.close();
}

// ================= Scenario 4: reminders settings + service worker =================
{
    const { context, page, errors } = await newPage({ notifications: true });
    console.log('\n— Reminders settings + service worker —');
    await page.evaluate(() => lifeOS.closeModal('catchUpModal'));
    await page.click('#settingsBtn');
    check('default times', [await page.inputValue('#reminderMorning'), await page.inputValue('#reminderEvening')], ['08:00', '21:00']);
    check('default timezone = device timezone', await page.inputValue('#reminderTimezone'), TZ);
    await page.fill('#reminderEvening', '21:30');
    await page.dispatchEvent('#reminderEvening', 'change');
    check('settings stored in data.settings.reminders', await page.evaluate(() => lifeOS.data.settings.reminders),
        { enabled: false, morning: '08:00', evening: '21:30', timezone: TZ });
    await page.click('#enableRemindersBtn');
    check('enable without Convex explains what to do', /Connect Convex/.test(await page.textContent('#reminderStatus')), true);

    // Service worker: push shows a notification + sets badge; tap opens Today
    await page.evaluate(() => navigator.serviceWorker.ready);
    const sw = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    check('cache bumped', await sw.evaluate(() => caches.keys()), ['life-os-v4']);
    const pushed = await sw.evaluate(async () => {
        const badge = [];
        self.navigator.setAppBadge = (n) => { badge.push(n); return Promise.resolve(); };
        self.navigator.clearAppBadge = () => { badge.push(0); return Promise.resolve(); };
        const ev = new PushEvent('push', { data: JSON.stringify({ title: '3 items left today', body: 'Skincare PM · Read before bed · Meditate', count: 3, url: './?section=habits', tag: 'life-os-evening' }) });
        self.dispatchEvent(ev);
        await new Promise(r => setTimeout(r, 300));
        const shown = await self.registration.getNotifications();
        return { badge, notes: shown.map(n => ({ title: n.title, body: n.body, url: n.data.url })) };
    });
    check('push → notification shown', pushed.notes, [{ title: '3 items left today', body: 'Skincare PM · Read before bed · Meditate', url: './?section=habits' }]);
    check('push → badge set', pushed.badge, [3]);
    const blank = await sw.evaluate(async () => {
        (await self.registration.getNotifications()).forEach(n => n.close());
        self.dispatchEvent(new PushEvent('push', {}));
        await new Promise(r => setTimeout(r, 300));
        return (await self.registration.getNotifications()).map(n => n.title);
    });
    check('push with no payload still shows a notification', blank, ['Life OS']);

    await page.evaluate(() => { lifeOS.closeModal('settingsModal'); lifeOS.navigateTo('dashboard'); });
    await sw.evaluate(async () => {
        self.dispatchEvent(new PushEvent('push', { data: JSON.stringify({ title: 't', count: 1 }) }));
        await new Promise(r => setTimeout(r, 300));
        const [n] = await self.registration.getNotifications({ tag: 'life-os' });
        self.dispatchEvent(new NotificationEvent('notificationclick', { notification: n }));
    });
    await page.waitForTimeout(500);
    check('notification tap → open window shows Today', await page.isVisible('#section-habits.active'), true);

    // Cold start from a notification: ?section=habits
    await page.goto(BASE + '?section=habits');
    await page.waitForFunction(() => window.lifeOS);
    check('?section=habits opens Today and cleans the URL', [await page.isVisible('#section-habits.active'), new URL(page.url()).search], [true, '']);
    check('no page errors', errors, []);
    await context.close();
}

// ================= Scenario 5: small screens =================
// iPhone Display Zoom ("Larger Text") or page zoom leaves ~320 CSS px of width
{
    const { context, page, errors } = await newPage({ width: 320 });
    console.log('\n— 320px wide (iPhone with Display Zoom) —');
    check('catch-up Done reachable without scrolling', await page.evaluate(() => document.getElementById('catchUpDoneBtn').getBoundingClientRect().bottom <= innerHeight), true);
    await page.click('#catchUpDoneBtn');
    const wide = [];
    for (const s of ['dashboard', 'goals', 'health', 'habits', 'journal', 'review']) {
        await page.evaluate(x => lifeOS.navigateTo(x), s);
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) wide.push(s);
    }
    check('no screen scrolls sideways', wide, []);
    await page.evaluate(() => lifeOS.openModal('settingsModal'));
    check('settings fit the width', await page.evaluate(() => {
        const b = document.querySelector('#settingsModal .modal-content');
        return b.scrollWidth <= b.clientWidth;
    }), true);
    check('fields are 16px (iOS zooms in on smaller ones)', await page.evaluate(() =>
        [...new Set([...document.querySelectorAll('input:not([type=file]), select, textarea')].map(e => getComputedStyle(e).fontSize))]), ['16px']);
    check('no page errors', errors, []);
    await context.close();
}

// ================= Scenario 6: journal — highlights, streak, import, archive =================
{
    // A journal export like the Journal app's PDF: a header on every page, page numbers,
    // mixed date headings, two entries on one day, and prose that starts with a date.
    const pdfPage = await browser.newPage();
    const entry = (heading, ...paras) => `<section><h2>${heading}</h2>${paras.map(p => `<p>${p}</p>`).join('')}</section>`;
    await pdfPage.setContent(`<style>section { page-break-after: always; font: 14px Georgia; } h2 { font-size: 18px; }</style>
        ${entry('Wednesday, September 30, 2026', 'Long day at work.', 'Ended with a good walk.')}
        ${entry('Thursday, October 8, 2026', 'Felt strong this morning.', 'October 1, 2026 was when I started running again.')}
        ${entry('Oct 9, 2026 at 9:41 PM', 'Dinner with friends.')}
        ${entry('2026-10-10', 'Quiet Saturday morning.')}
        ${entry('Saturday, October 10, 2026', 'Evening: finished the book.')}`);
    const pdfPath = path.join(os.tmpdir(), `journal-export-${process.pid}.pdf`);
    await pdfPage.pdf({
        path: pdfPath, format: 'Letter', displayHeaderFooter: true,
        headerTemplate: '<div style="font-size:10px;width:100%;text-align:center;">My Journal</div>',
        footerTemplate: '<div style="font-size:10px;width:100%;text-align:center;"><span class="pageNumber"></span></div>',
        margin: { top: '60px', bottom: '60px' }
    });
    await pdfPage.close();

    const reflection = (ts) => ({ date: ts.slice(0, 10), timestamp: new Date(ts).toISOString(), wentWell: 'ok' });
    const journalSeed = { ...seed, eveningReflections: [reflection('2026-10-12T21:30:00-04:00'), reflection('2026-10-11T22:00:00-04:00')] };
    const { context, page, errors } = await newPage({ seedData: journalSeed, time: '2026-10-13T21:00:00-04:00' });
    await context.route('**/pdfjs-dist@*/build/*', r => r.fulfill({
        contentType: 'application/javascript',
        body: fs.readFileSync(path.join(PDFJS_DIR, path.basename(new URL(r.request().url()).pathname)))
    }));
    page.on('dialog', d => d.accept());
    console.log('\n— Journal: highlights, streak, import —');
    await page.evaluate(() => { lifeOS.closeModal('catchUpModal'); lifeOS.navigateTo('journal'); });

    check('streak before import (Oct 11–12, today pending)', await page.evaluate(() => {
        const s = lifeOS.getJournalStreak();
        return [s.current, s.best, s.total, document.querySelector('.journal-streak-count').textContent];
    }), [2, 2, 2, '2']);
    check('three highlight fields replace gratitude', await page.evaluate(() =>
        [!!document.getElementById('stoicGratitude'), document.querySelectorAll('.highlight-input').length]), [false, 3]);
    check('archive hidden until something is imported', await page.isHidden('#journalArchive'), true);

    // Import (no Convex here, so the archive text goes to localStorage)
    await page.setInputFiles('#journalImportInput', pdfPath);
    await page.waitForSelector('#journalImportModal.active', { timeout: 20000 });
    check('import preview summary', await page.textContent('#journalImportSummary'), 'Found 5 entries from Sep 30, 2026 to Oct 10, 2026.');
    await page.click('#journalImportConfirm');
    await page.waitForFunction(() => !document.querySelector('#journalImportModal.active'));
    const archived = await page.evaluate(() => JSON.parse(localStorage.getItem('lifeOS_journalArchive')));
    check('entries split at each date heading', archived.map(e => e.date).sort(), ['2026-09-30', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-10']);
    const oct8 = archived.find(e => e.date === '2026-10-08').text;
    check('prose starting with a date stays in its entry', oct8.includes('October 1, 2026 was when I started running again.'), true);
    check('page headers and numbers stripped', archived.some(e => /My Journal|^\d+$/m.test(e.text)), false);
    check('imported dates stored for the streak', await page.evaluate(() => lifeOS.data.journalImportDates), ['2026-09-30', '2026-10-08', '2026-10-09', '2026-10-10']);
    check('streak now includes imported days (Oct 8–12)', await page.evaluate(() => {
        const s = lifeOS.getJournalStreak();
        return [s.current, s.best, s.total];
    }), [5, 5, 6]);

    // Archive on the Reflection tab
    await page.click('#journalArchive summary');
    await page.waitForSelector('#archiveList .archive-entry');
    check('archive lists newest first', await page.$$eval('#archiveList .archive-date', els => els.map(e => e.textContent)),
        ['Sat, Oct 10, 2026', 'Sat, Oct 10, 2026', 'Fri, Oct 9, 2026', 'Thu, Oct 8, 2026', 'Wed, Sep 30, 2026']);
    await page.fill('#archiveSearch', 'running');
    check('archive search', await page.$$eval('#archiveList .archive-date', els => els.map(e => e.textContent)), ['Thu, Oct 8, 2026']);

    // Importing the same file again adds nothing
    await page.setInputFiles('#journalImportInput', pdfPath);
    await page.waitForSelector('#journalImportModal.active', { timeout: 20000 });
    await page.click('#journalImportConfirm');
    await page.waitForFunction(() => !document.querySelector('#journalImportModal.active'));
    check('re-import skips duplicates', await page.textContent('#journalImportStatus'), "Imported 0 entries (5 already there). They're under Journal archive on the Reflection tab.");

    // Tonight's reflection with highlights (and a goal it checks off)
    await page.evaluate(() => {
        const week = lifeOS.getWeekForDate(new Date());
        week.entries[Object.keys(week.entries).length] = {
            goal: { category: 'Evening Protocol', name: 'Evening reflection (3 highlights)', target: 'daily' },
            tracking: ['', '', '', '', '', '', '']
        };
    });
    await page.fill('#stoicWentWell', 'Good focus block');
    await page.fill('#stoicHighlight1', 'Long walk with Chelsey');
    await page.fill('#stoicHighlight3', 'Remember: book the dentist');
    await page.click('#saveEveningReflectionBtn');
    check('highlights saved (blanks dropped)', await page.evaluate(() => lifeOS.data.eveningReflections[0].highlights), ['Long walk with Chelsey', 'Remember: book the dentist']);
    check('saved under the local date', await page.evaluate(() => lifeOS.data.eveningReflections[0].date), '2026-10-13');
    check('saving checks off the Evening reflection goal for today', [await page.evaluate(() =>
        Object.values(lifeOS.getWeekForDate(new Date()).entries).find(e => /Evening reflection/.test(e.goal.name)).tracking[2]),
        await page.textContent('#stoicSaveNote')], ['X', 'Saved · 6 days in a row · checked off for today ✓']);
    check('past reflection shows highlights', await page.$$eval('#journalEntriesList .journal-entry-card:first-child .highlight-list li', els => els.map(e => e.textContent)),
        ['Long walk with Chelsey', 'Remember: book the dentist']);
    check('streak counts today', await page.evaluate(() => [lifeOS.getJournalStreak().current, document.querySelector('.journal-streak-note').textContent]), [6, 'Done for today.']);

    // Remove imported entries
    await page.click('#settingsBtn').catch(() => page.evaluate(() => lifeOS.openModal('settingsModal')));
    await page.evaluate(() => document.getElementById('journalClearBtn').click());
    await page.waitForFunction(() => lifeOS.data.journalImportDates.length === 0);
    check('removing imports clears archive + their streak days', await page.evaluate(() =>
        [localStorage.getItem('lifeOS_journalArchive'), document.getElementById('journalArchive').hidden, lifeOS.getJournalStreak().current]), [null, true, 3]);
    check('no page errors', errors, []);
    await context.close();
    fs.unlinkSync(pdfPath);
}

// ================= Scenario 7: Today — shrinking list =================
{
    const { context, page, errors } = await newPage({ width: 390 });
    console.log('\n— Today: shrinking list —');
    await page.evaluate(() => { lifeOS.closeModal('catchUpModal'); lifeOS.navigateTo('habits'); });
    const cell = n => page.evaluate(name => Object.values(lifeOS.data.weeks[1].entries).find(e => e.goal.name === name).tracking[2], n);
    const pendingNames = () => page.$$eval('.freq-group:not(.limits-group) .pending-item .habit-name', els => els.map(e => e.textContent));
    const foldNames = key => page.$$eval(`[data-fold="${key}"] .habit-name`, els => els.map(e => e.textContent));
    const row = name => page.locator('.pending-item', { hasText: name });

    // Tue: Up by 7:15AM already ✓; Skincare AM, In bed, Meditate still to do; Journaling (Wed/Sat) not today
    check('daily list shows only what is left', (await pendingNames()).filter(n => !/Strength|Cardio|Cold|Review fin/.test(n)),
        ['Skincare AM', 'In bed by 11:15PM', 'Meditate (3-5 min, long exhales)']);
    check('header counts what is left', await page.textContent('.freq-group .freq-group-count'), '3 left');
    check('done today folded away', await foldNames('done'), ['Up by 7:15AM']);
    check('limits start folded, with a summary', await page.evaluate(() => {
        const d = document.querySelector('.limits-group');
        return [d.open, d.querySelector('.freq-group-count').textContent];
    }), [false, '1 over']);
    check('only daily items get ✗; Meditate gets ▶', await page.evaluate(() => [
        document.querySelectorAll('.freq-group:first-child .habit-miss-btn').length,
        [...document.querySelectorAll('.pending-item')].filter(r => r.querySelector('.habit-play-btn')).map(r => r.querySelector('.habit-name').textContent)
    ]), [3, ['Meditate (3-5 min, long exhales)']]);

    await row('Skincare AM').locator('.habit-miss-btn').click();
    await page.waitForFunction(() => document.querySelector('[data-fold="missed"]'));
    check('✗ marks a strike and moves it to Missed', [await cell('Skincare AM'), await foldNames('missed')], ['1', ['Skincare AM']]);
    check('missed items drop out of the badge', await page.evaluate(() => window.__badge.at(-1)), 2);
    await page.click('[data-fold="missed"] > summary');
    await page.click('[data-fold="missed"] [data-action="undo"]');
    check('Undo puts it back', [await cell('Skincare AM'), (await pendingNames()).includes('Skincare AM')], ['', true]);

    await row('Skincare AM').locator('.habit-miss-btn').click();
    await page.waitForFunction(() => document.querySelector('[data-fold="missed"] [data-action="skip"]'));
    check('Missed stays open across re-renders', await page.evaluate(() => document.querySelector('[data-fold="missed"]').open), true);
    await page.click('[data-fold="missed"] [data-action="skip"]');
    check("Doesn't apply → skipped, listed under Doesn't apply today", [await cell('Skincare AM'), (await foldNames('off')).includes('Skincare AM')], ['-', true]);

    await row('In bed by 11:15PM').locator('.habit-checkbox').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-fold="done"] .habit-name').length === 2);
    check('○ marks done and moves it to Done', [await cell('In bed by 11:15PM'), await page.textContent('.freq-group .freq-group-count')], ['X', '1 left']);
    await page.click('[data-fold="done"] > summary');
    await page.locator('[data-fold="done"] .habit-check-item', { hasText: 'In bed' }).locator('.habit-checkbox').click();
    check('tapping a check in Done undoes it', await cell('In bed by 11:15PM'), '');

    await row('In bed by 11:15PM').locator('.habit-checkbox').click();
    await row('Meditate').locator('.habit-checkbox').click();
    await page.waitForFunction(() => document.querySelector('.freq-group .freq-group-count').textContent.includes('All done'));
    check('all daily items handled', await page.textContent('.freq-group .today-all-done'), 'Nothing left for today. Nice work.');
    check('no page errors', errors, []);
    await context.close();
}

// ================= Scenario 8: Meditate =================
{
    // Stub the speech engine: record what's said, finish each utterance right away
    const speechStub = () => {
        window.__spoken = [];
        window.__speechCalls = [];   // 'speak' / 'cancel' in order
        window.__spokenInTap = [];   // was speak() called while a click was being handled?
        window.__mute = false;       // simulate a voice that never starts
        navigator.audioSession = { type: 'auto' };
        window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
            speaking: false, pending: false, paused: false,
            cancel() { window.__speechCalls.push('cancel'); }, addEventListener() {}, resume() {},
            getVoices: () => [
                { name: 'Fred', lang: 'en-US', voiceURI: 'fred' },
                { name: 'Amélie', lang: 'fr-CA', voiceURI: 'amelie' },
                { name: 'Ava (Premium)', lang: 'en-US', voiceURI: 'ava-premium' }
            ],
            speak(u) {
                window.__spoken.push(u.text);
                window.__speechCalls.push('speak');
                window.__spokenInTap.push(window.event?.type === 'click');
                setTimeout(() => { if (!window.__mute) u.onstart?.(); u.onend?.(); }, 5);
            }
        } });
    };
    const { context, page, errors } = await newPage({ width: 390, init: speechStub });
    console.log('\n— Meditate —');
    await page.evaluate(() => { lifeOS.closeModal('catchUpModal'); lifeOS.navigateTo('habits'); });
    await page.locator('.pending-item .habit-play-btn').click();
    check('▶ on Meditate opens the Meditate page', await page.isVisible('#section-meditate.active'), true);
    check('four sessions, 3 min by default', await page.evaluate(() => [
        [...document.querySelectorAll('.med-card b')].map(b => b.textContent),
        document.querySelector('.med-length.active').textContent
    ]), [['Breathe', 'Reflect', 'Body', 'Sleep'], '3 min']);
    check('Cori first, then English device voices', await page.$$eval('#medVoice option', os => os.map(o => o.textContent)),
        ['Cori — calm recorded voice (recommended)', 'Ava (Premium) (en-US)', 'Fred (en-US)']);

    // Every line a session can say has a recording, and each one decodes
    const coverage = await page.evaluate(async () => {
        const lines = new Set([MED_TEST_LINE]);
        Object.values(MEDITATIONS).forEach(s => [1, 3, 5].forEach(min => s.build(min).forEach(st => st.say && lines.add(st.say))));
        Object.values(BREATH_PATTERNS).flat().forEach(p => p.cue && lines.add(p.cue));
        const buffers = await Promise.all([...lines].map(l => lifeOS.medClip(l)));
        return { count: lines.size, missing: [...lines].filter((l, i) => !buffers[i]) };
    });
    check('every line has a recording that loads', [coverage.count > 50, coverage.missing], [true, []]);

    await page.click('#medVoiceTest');
    await page.waitForFunction(() => document.getElementById('medVoiceStatus').textContent.startsWith('✓'), null, { timeout: 15000 });
    check('Test plays the recorded voice', (await page.textContent('#medVoiceStatus')).startsWith('✓ Voice played'), true);

    // A 3-minute Breathe session with Cori, 60x faster
    await page.evaluate(() => { lifeOS._medTimeScale = 60; });
    await page.click('[data-med="breathe"]');
    check('player opens full screen', await page.isVisible('#medPlayer'), true);
    check('audio session set to media playback', await page.evaluate(() => navigator.audioSession.type), 'playback');
    await page.waitForSelector('#medDone:not([hidden])', { timeout: 20000 });
    const run = await page.evaluate(() => ({ elapsed: lifeOS._med.endedAt, played: lifeOS._med.played, spoken: window.__spoken, log: lifeOS.data.meditationLog }));
    check('session lasts its length (180s)', run.elapsed >= 179 && run.elapsed < 186, true);
    check('Cori speaks the guidance and breath cues (no device speech)', [run.played[0], run.played.includes('Breathe in'), run.played.at(-1), run.spoken.length],
        ["Welcome. Let's take a moment to slow down.", true, 'Notice how you feel now, compared with a few minutes ago. Take that calm with you.', 0]);
    check('session logged', run.log.map(l => [l.kind, l.minutes, l.date]), [['breathe', 3, '2026-10-13']]);
    check('no "can\'t hear" hint when the voice plays', await page.isHidden('#medHint'), true);
    check('3-min session checks off Meditate for today', await page.evaluate(() =>
        Object.values(lifeOS.data.weeks[1].entries).find(e => /Meditate/.test(e.goal.name)).tracking[2]), 'X');
    check('completion note', await page.textContent('#medDoneDetail'), 'Breathe · 3 min. Meditate is checked off for today ✓');
    await page.click('#medDoneBtn');
    check('Done closes the player', await page.isHidden('#medPlayer'), true);
    check('audio handed back after the session', await page.evaluate(() => navigator.audioSession.type), 'auto');

    // Device voice (desktop browsers / Safari tabs): starts inside the tap, never cancel-then-speak.
    // Also: a 1-minute session is logged but doesn't check anything off.
    await page.selectOption('#medVoice', 'ava-premium');
    await page.evaluate(() => {
        window.__spoken = []; window.__speechCalls = []; window.__spokenInTap = [];
        Object.values(lifeOS.data.weeks[1].entries).find(e => /Meditate/.test(e.goal.name)).tracking[2] = '';
    });
    await page.click('.med-length[data-min="1"]');
    await page.click('[data-med="reflect"]');
    check('device voice: first line spoken inside the tap', await page.evaluate(() => [window.__spoken[0], window.__spokenInTap[0]]),
        ['Welcome. Find a comfortable position, and close your eyes if you like.', true]);
    await page.waitForSelector('#medDone:not([hidden])', { timeout: 20000 });
    check('device voice is never cancelled and restarted back to back', await page.evaluate(() =>
        window.__speechCalls.some((c, i) => c === 'cancel' && window.__speechCalls[i + 1] === 'speak')), false);
    check('1-min session logged, Meditate not checked', await page.evaluate(() => [
        lifeOS.data.meditationLog.length,
        Object.values(lifeOS.data.weeks[1].entries).find(e => /Meditate/.test(e.goal.name)).tracking[2],
        document.getElementById('medDoneDetail').textContent.includes('Short sessions are logged')
    ]), [2, '', true]);
    await page.click('#medDoneBtn');

    // A device voice that never starts → the player shows the volume hint
    await page.evaluate(() => { window.__mute = true; });
    await page.click('[data-med="body"]');
    await page.waitForSelector('#medHint:not([hidden])', { timeout: 5000 });
    check('silent voice shows the volume hint', (await page.textContent('#medHint')).startsWith("Can't hear the voice?"), true);
    await page.click('#medEndBtn');
    await page.waitForSelector('#medPlayer', { state: 'hidden' });
    await page.evaluate(() => { window.__mute = false; });
    await page.selectOption('#medVoice', 'recorded');

    // Pause freezes the clock; End early closes without logging
    await page.click('.med-length[data-min="5"]');
    await page.click('[data-med="sleep"]');
    await page.waitForTimeout(400);
    await page.click('#medPauseBtn');
    const t1 = await page.textContent('#medRemaining');
    await page.waitForTimeout(600);
    check('pause stops the clock', [await page.textContent('#medRemaining'), await page.textContent('#medPauseBtn')], [t1, 'Resume']);
    await page.click('#medEndBtn');
    await page.waitForSelector('#medPlayer', { state: 'hidden' });
    check('ending early logs nothing', await page.evaluate(() => lifeOS.data.meditationLog.length), 2);

    // Why a session is silent while Test plays: the player names the reason
    const endSession = async () => { await page.click('#medEndBtn'); await page.waitForSelector('#medPlayer', { state: 'hidden' }); };
    await page.evaluate(() => { lifeOS._medTimeScale = 1; });
    await page.click('.med-length[data-min="1"]');
    // 1) "Speak the guidance" is off
    await page.uncheck('#medVoiceOn');
    await page.click('#medVoiceTest');
    await page.waitForFunction(() => document.getElementById('medVoiceStatus').textContent.startsWith('✓'), null, { timeout: 15000 });
    check('Test warns that sessions are silent when "Speak the guidance" is off',
        (await page.textContent('#medVoiceStatus')).includes('sessions are silent'), true);
    await page.click('[data-med="breathe"]');
    check('voice off: the player says so right away', [await page.isVisible('#medHint'), await page.textContent('#medHint')],
        [true, 'Voice is off. Turn on “Speak the guidance” on the Meditate page to hear Cori.']);
    await endSession();
    await page.check('#medVoiceOn');
    // 2) A recording can't be downloaded
    await page.evaluate(() => {
        // (the service worker fetches the files, so stub fetch in the page rather than page.route)
        window.__fetch = window.fetch;
        window.fetch = (url, ...rest) => String(url).endsWith('.mp3') ? Promise.resolve(new Response('', { status: 404 })) : window.__fetch(url, ...rest);
        lifeOS._medClips.clear(); lifeOS._medClipReady.clear();
    });
    await page.click('[data-med="reflect"]');
    await page.waitForSelector('#medHint:not([hidden])', { timeout: 5000 });
    check('failed download is named in the hint, captions continue', [await page.textContent('#medHint'), (await page.textContent('#medCaption')).length > 0],
        ["Couldn't load the voice (download failed, 404). The captions keep going — check your connection.", true]);
    await endSession();
    await page.evaluate(() => { window.fetch = window.__fetch; });
    // 3) The phone suspends the audio engine; Pause → Resume (a tap) wakes it
    await page.evaluate(async () => {
        const ctx = lifeOS.medAudioContext();
        await ctx.suspend();
        ctx.resume = () => Promise.resolve(); // stays suspended, like an interrupted iPhone
    });
    await page.click('[data-med="body"]');
    await page.waitForSelector('#medHint:not([hidden])', { timeout: 5000 });
    check('suspended audio is named in the hint', await page.textContent('#medHint'), 'The iPhone paused the sound (suspended). Tap Pause, then Resume, to wake it.');
    await page.evaluate(() => { delete lifeOS.medAudioContext().resume; });
    await page.click('#medPauseBtn');
    await page.click('#medPauseBtn');
    await page.waitForSelector('#medHint', { state: 'hidden', timeout: 3000 });
    check('Resume wakes the audio and clears the hint', await page.evaluate(() => [lifeOS.medAudioContext().state, lifeOS._med.voiceProblem]), ['running', null]);
    await endSession();
    check('still only the two finished sessions logged', await page.evaluate(() => lifeOS.data.meditationLog.length), 2);

    // Every session × length, voice off (captions only): each ends on time
    const timings = await page.evaluate(async () => {
        lifeOS._medTimeScale = 150;
        localStorage.setItem('lifeOS_medVoiceOn', '0');
        const out = [];
        for (const kind of Object.keys(MEDITATIONS)) {
            for (const min of [1, 3, 5]) {
                await lifeOS.startMeditation(kind, min);
                out.push(`${kind}/${min}:${Math.abs(lifeOS._med.endedAt - min * 60) <= 5 ? 'ok' : Math.round(lifeOS._med.endedAt)}`);
                lifeOS.closeMedPlayer();
            }
        }
        return out;
    });
    check('all 12 sessions end on time', timings.filter(t => !t.endsWith(':ok')), []);
    check('stats line', await page.textContent('#medStats'), 'This week: 14 sessions · 40 min. 3- and 5-minute sessions check off Meditate in Today.');
    check('no page errors', errors, []);
    await context.close();
}

// ================= Scenario 9: night mode + typing in the journal (phone) =================
{
    const { context, page, errors } = await newPage({ width: 390, time: '2026-10-13T21:30:00-04:00' });
    console.log('\n— Night mode + journal typing —');
    await page.evaluate(() => lifeOS.closeModal('catchUpModal'));
    const look = () => page.evaluate(() => ({
        bg: getComputedStyle(document.body).backgroundColor,
        theme: document.documentElement.getAttribute('data-theme'),
        metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content),
        active: document.querySelector('#themeChoice .active')?.dataset.themeChoice
    }));
    const LIGHT = 'rgb(246, 244, 239)', DARK = 'rgb(21, 23, 27)';
    check('Auto: light when the phone is light', (await look()).bg, LIGHT);
    await page.emulateMedia({ colorScheme: 'dark' });
    check('Auto: dark when the phone switches to Dark Mode', await look(), { bg: DARK, theme: null, metas: ['#f6f4ef', '#15171b'], active: 'auto' });
    await page.evaluate(() => lifeOS.openModal('settingsModal'));
    await page.click('#themeChoice [data-theme-choice="light"]');
    check('Light pins light even in Dark Mode (status bar too)', await look(), { bg: LIGHT, theme: 'light', metas: ['#f6f4ef', '#f6f4ef'], active: 'light' });
    await page.reload();
    await page.waitForFunction(() => window.lifeOS);
    check('the choice survives a reload, before first paint', [(await look()).bg, await page.evaluate(() => localStorage.getItem('lifeOS_theme'))], [LIGHT, 'light']);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(() => { lifeOS.closeModal('catchUpModal'); lifeOS.openModal('settingsModal'); });
    await page.click('#themeChoice [data-theme-choice="dark"]');
    check('Dark pins dark in light mode', await look(), { bg: DARK, theme: 'dark', metas: ['#15171b', '#15171b'], active: 'dark' });
    check('buttons keep readable text on blue in the dark', await page.evaluate(() =>
        getComputedStyle(document.querySelector('#themeChoice .active')).color), 'rgb(18, 22, 27)');
    await page.click('#themeChoice [data-theme-choice="auto"]');
    check('Auto again follows the phone', await look(), { bg: LIGHT, theme: null, metas: ['#f6f4ef', '#15171b'], active: 'auto' });
    await page.evaluate(() => lifeOS.closeModal('settingsModal'));

    // Journal typing on a phone
    await page.click('.mobile-nav-btn[data-section="journal"]');
    const wentWell = page.locator('#stoicWentWell');
    const h0 = await wentWell.evaluate(el => el.offsetHeight);
    await wentWell.focus();
    check('typing hides the tab bar so the keyboard has room', await page.evaluate(() =>
        [document.body.classList.contains('typing'), getComputedStyle(document.querySelector('.mobile-bottom-nav')).display]), [true, 'none']);
    await page.keyboard.type('Long walk.\nGood focus block.\nCalled Mom.\nCooked a new meal.\nRead 20 pages.\nSlept on time.');
    const h1 = await wentWell.evaluate(el => [el.offsetHeight, el.scrollHeight, el.clientHeight]);
    check('the box grows with the text (no scrolling inside it)', [h1[0] > h0, h1[1] <= h1[2]], [true, true]);
    await page.click('#stoicHighlight1');
    await page.keyboard.type('Sunset run');
    await page.keyboard.press('Enter');
    check('Return moves to the next highlight', await page.evaluate(() => document.activeElement.id), 'stoicHighlight2');
    await page.click('#stoicHighlight3');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
    check('Return on the last highlight closes the keyboard, tab bar returns', await page.evaluate(() =>
        [document.activeElement.id, document.body.classList.contains('typing')]), ['', false]);

    // Leave mid-entry: the draft comes back
    await page.click('#stoicValuesRating [data-rating="8"]');
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForFunction(() => window.lifeOS);
    await page.evaluate(() => { lifeOS.closeModal('catchUpModal'); lifeOS.navigateTo('journal'); });
    check('a half-written reflection is still there after leaving', await page.evaluate(() => [
        document.getElementById('stoicWentWell').value.split('\n').length,
        document.getElementById('stoicHighlight1').value,
        document.querySelector('#stoicValuesRating .rating-btn.active')?.dataset.rating,
        document.getElementById('stoicSaveNote').textContent,
        document.getElementById('stoicWentWell').offsetHeight > 120
    ]), [6, 'Sunset run', '8', 'Picked up where you left off.', true]);

    // Save: quiet note instead of a pop-up; form and draft cleared
    const dialogs = [];
    page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
    await page.click('#saveEveningReflectionBtn');
    check('saving shows a quiet note, no pop-up', [await page.textContent('#stoicSaveNote'), dialogs], ['Saved', []]);
    check('form, draft and box size reset', await page.evaluate(() => [
        document.getElementById('stoicWentWell').value, localStorage.getItem('lifeOS_reflectionDraft'),
        document.getElementById('stoicWentWell').offsetHeight < 120
    ]), ['', '', true]);
    await page.click('#saveEveningReflectionBtn');
    check('saving an empty form says what to do', await page.evaluate(() => {
        const n = document.getElementById('stoicSaveNote');
        return [n.textContent, n.classList.contains('warn'), document.activeElement.id];
    }), ['Write at least one line first.', true, 'stoicWentWell']);
    check('no page errors', errors, []);
    await context.close();
}

// ================= Nutrition card (meals logged from Claude via Convex) =================
{
    console.log('\n— Nutrition card —');
    // Without Convex the card says how to turn it on
    {
        const { context, page } = await newPage();
        await page.evaluate(() => lifeOS.navigateTo('health'));
        check('no Convex: card explains how to connect', /Connect Convex/.test(await page.textContent('#nutritionBody')), true);
        await context.close();
    }
    const nGoal = { category: 'Physical Health', name: 'Protein target (190g)', target: 'daily' };
    const nSeed = JSON.parse(JSON.stringify(seed));
    nSeed.goals.push(nGoal);
    nSeed.weeks[1].entries[goals.length] = { goal: { ...nGoal }, tracking: ['', '', '', '', '', '', ''] };
    nSeed.healthLog = [{ date: '2026-10-10', weight: 207 }];
    const calls = [];
    let weighInsServed = false;
    const ok = value => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', value }) });
    const { context, page, errors } = await newPage({
        seedData: nSeed,
        init: () => localStorage.setItem('lifeOS_convexUrl', 'https://fake-test.convex.cloud'),
    });
    await context.route('https://fake-test.convex.cloud/**', r => {
        const { path, args } = JSON.parse(r.request().postData() || '{}');
        calls.push([path, args]);
        if (path === 'nutrition:getRange') return r.fulfill(ok({
            targets: { calories: 2400, protein: 190, carbs: 240, fat: 75 },
            days: [
                { date: '2026-10-12', meals: 4, calories: 2350, protein: 196, carbs: 220, fat: 70 },
                { date: '2026-10-13', meals: 2, calories: 1500, protein: 120, carbs: 100, fat: 50 },
            ],
        }));
        if (path === 'nutrition:pendingWeighIns') {
            const v = weighInsServed ? [] : [{ id: 'w1', date: '2026-10-13', lb: 205.4 }];
            weighInsServed = true;
            return r.fulfill(ok(v));
        }
        return r.fulfill(ok(null));
    });
    await page.reload();
    await page.waitForFunction(() => window.lifeOS);
    await page.evaluate(() => { lifeOS.closeModal('catchUpModal'); lifeOS.navigateTo('health'); });
    await page.waitForFunction(() => lifeOS._nutrition && !lifeOS._nutrition.error && !lifeOS._nutritionLoading);
    await page.waitForTimeout(200);
    const text = await page.textContent('#nutritionBody');
    check('today: calories and protein left', [/1,500/.test(text), /900 to go/.test(text), /70g to go/.test(text)], [true, true, true]);
    check('protein streak counts hit days', /hit 1 of the last 14 days/.test(text), true);
    check('protein goal ticked on the day it was hit, not today', await page.evaluate(() => {
        const e = Object.values(lifeOS.data.weeks[1].entries).find(x => /protein target/i.test(x.goal.name));
        return [e.tracking[1], e.tracking[2]];
    }), ['X', '']);
    check('"High protein" breakfast goal is not mistaken for it', await page.evaluate(() =>
        Object.values(lifeOS.data.weeks[1].entries).filter(x => lifeOS.PROTEIN_GOAL.test(x.goal.name)).length), 1);
    check('weigh-in from Claude lands in the Health log', await page.evaluate(() =>
        lifeOS.data.healthLog.map(e => [e.date, e.weight])), [['2026-10-10', 207], ['2026-10-13', 205.4]]);
    check('weigh-in marked applied after saving', calls.filter(c => c[0] === 'nutrition:markWeighInsApplied').map(c => c[1]), [{ ids: ['w1'] }]);
    check('day cells: hit, short, empty', await page.evaluate(() =>
        [...document.querySelectorAll('.nutrition-day')].slice(-3).map(d => d.className.replace('nutrition-day ', ''))), ['none', 'hit', 'short']);
    check('no page errors', errors, []);
    await context.close();
}

// ================= Daily check-in (one Save, local date) =================
{
    console.log('\n— Daily check-in —');
    // 10:30pm Eastern is already the next day in UTC: the check-in must still land on Oct 13
    const { context, page, errors } = await newPage({ width: 390, time: '2026-10-13T22:30:00-04:00' });
    await page.evaluate(() => { lifeOS.closeModal('catchUpModal'); lifeOS.navigateTo('health'); });
    const log = () => page.evaluate(() => JSON.parse(JSON.stringify(lifeOS.data.healthLog)));
    check('nothing saved yet', await page.textContent('#checkinStatus'), 'Nothing saved yet today.');
    await page.click('.energy-btn[data-level="4"]');
    check('tapping energy only selects it', await log(), []);
    await page.click('#saveCheckinBtn');
    check('energy alone can be saved', await log(), [{ date: '2026-10-13', energy: 4 }]);
    await page.fill('#weightInput', '205.4');
    await page.fill('#sleepInput', '7.5');
    await page.click('#saveCheckinBtn');
    check('one Save logs all three on the local date', await log(), [{ date: '2026-10-13', energy: 4, weight: 205.4, sleep: 7.5 }]);
    check('status shows what was saved', await page.textContent('#checkinStatus'), 'Saved for today: 205.4 lb · 7.5 h sleep · energy 4/5');
    check('button becomes Update', await page.textContent('#saveCheckinBtn'), 'Update check-in');
    await page.evaluate(() => lifeOS.navigateTo('dashboard'));
    await page.evaluate(() => lifeOS.navigateTo('health'));
    check('fields come back filled in', [await page.inputValue('#weightInput'), await page.inputValue('#sleepInput'),
        await page.getAttribute('.energy-btn[data-level="4"]', 'aria-pressed')], ['205.4', '7.5', 'true']);
    await page.fill('#weightInput', '5');
    await page.click('#saveCheckinBtn');
    check('implausible weight is refused', [/Weight looks off/.test(await page.textContent('#checkinStatus')), (await log())[0].weight], [true, 205.4]);
    check('no page errors', errors, []);
    await context.close();
}

// ================= Training card (workouts logged from Claude via Convex) =================
{
    console.log('\n— Training card —');
    {
        const { context, page } = await newPage();
        await page.evaluate(() => lifeOS.navigateTo('health'));
        check('no Convex: card explains how to connect', /Connect Convex/.test(await page.textContent('#trainingBody')), true);
        await context.close();
    }
    const coreGoal = { category: 'Physical Health', name: 'Core Work Out x1 (can be cardio focused core)', target: 'x1' };
    const tSeed = JSON.parse(JSON.stringify(seed));
    tSeed.goals.push(coreGoal);
    tSeed.weeks[1].entries[goals.length] = { goal: { ...coreGoal }, tracking: ['', '', '', '', '', '', ''] };
    const entryOf = name => Object.values(tSeed.weeks[1].entries).find(e => e.goal.name === name);
    entryOf('2 Strength Training').tracking = ['', '', '', '', '', '', ''];
    entryOf('2 Cardio Training (1 swim)').tracking = ['X', '', '-', '', '', '', ''];
    // What workouts:getRange returns: summaries with muscle groups and key-lift bests
    const sessions = [
        { date: '2026-09-08', type: 'strength', name: 'Heavy day', minutes: 60, muscles: ['chest', 'legs'],
          lifts: { bench: { e1rm: 255, weight: 225, reps: 4 }, squat: { e1rm: 300, weight: 260, reps: 5 } } },
        { date: '2026-10-11', type: 'core', name: 'Core circuit', minutes: 20, muscles: ['core'], lifts: {} },
        { date: '2026-10-12', type: 'strength', name: 'Push <day>', minutes: 55, muscles: ['chest', 'shoulders', 'arms'],
          lifts: { bench: { e1rm: 263, weight: 225, reps: 5 }, ohp: { e1rm: 149, weight: 135, reps: 3 } } },
        { date: '2026-10-12', type: 'cardio', name: 'Easy run', minutes: 28, distance: 3.1, distanceUnit: 'mi', muscles: [], lifts: {} },
        { date: '2026-10-13', type: 'swim', name: 'Pool swim', minutes: 40, distance: 1500, distanceUnit: 'yd', muscles: [], lifts: {} },
    ];
    const ok = value => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', value }) });
    const { context, page, errors } = await newPage({
        seedData: tSeed,
        init: () => localStorage.setItem('lifeOS_convexUrl', 'https://fake-test.convex.cloud'),
    });
    await context.route('https://fake-test.convex.cloud/**', r => {
        const { path } = JSON.parse(r.request().postData() || '{}');
        if (path === 'workouts:getRange') return r.fulfill(ok({ sessions }));
        if (path === 'nutrition:getRange') return r.fulfill(ok({ targets: { calories: 2400, protein: 190, carbs: 240, fat: 75 }, days: [] }));
        if (path === 'nutrition:pendingWeighIns') return r.fulfill(ok([]));
        return r.fulfill(ok(null));
    });
    await page.reload();
    await page.waitForFunction(() => window.lifeOS);
    await page.evaluate(() => { lifeOS.closeModal('catchUpModal'); lifeOS.navigateTo('health'); });
    await page.waitForFunction(() => lifeOS._training && !lifeOS._training.error && !lifeOS._trainingLoading);
    await page.waitForTimeout(200);
    const text = (await page.textContent('#trainingBody')).replace(/\s+/g, ' ');
    check('this week: sessions, minutes and types', [/4 sessions · 143 min/.test(text), /1 strength · 1 cardio · 1 swim · 1 core/.test(text)], [true, true]);
    check('muscle groups hit this week', await page.$$eval('.training-muscle.hit', els => els.map(e => e.textContent)), ['Chest', 'Shoulders', 'Arms', 'Core']);
    check('untrained groups called out', /Not yet: back, legs/.test(text), true);
    const lift = key => page.textContent(`.training-lift[data-lift="${key}"]`).then(s => s.replace(/\s+/g, ' ').trim());
    check('bench: best of 4 weeks, change vs the 4 before', await lift('bench'), 'Bench press 263 lb Best set 225 × 5 on Oct 12 · +8 lb vs the 4 weeks before');
    check('squat: flagged when not trained in 4 weeks', await lift('squat'), 'Squat – Not trained in 4 weeks · last 260 × 5 on Sep 8');
    check('deadlift: never logged', await lift('deadlift'), 'Deadlift – Not logged in the last 12 weeks');
    check('overhead press: no earlier sessions, no change shown', await lift('ohp'), 'Overhead press 149 lb Best set 135 × 3 on Oct 12');
    check('recent sessions newest first, names escaped', await page.$$eval('.training-recent li', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim())),
        ['Tue, Oct 13 Pool swim · 40 min · 1,500 yd', 'Mon, Oct 12 Easy run · 28 min · 3.1 mi', 'Mon, Oct 12 Push <day> · 55 min', 'Sun, Oct 11 Core circuit · 20 min']);
    const cells = name => page.evaluate(n => Object.values(lifeOS.data.weeks[1].entries).find(e => e.goal.name === n).tracking.slice(0, 3), name);
    check('strength goal ticked on the lifting day', await cells('2 Strength Training'), ['', 'X', '']);
    check('cardio goal ticked for the run; the swim leaves a "doesn\'t apply" day alone', await cells('2 Cardio Training (1 swim)'), ['X', 'X', '-']);
    check('core goal ticked by the core session', await cells(coreGoal.name), ['X', '', '']);
    check('ticks saved', await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('lifeOSData')).weeks[1].entries)
        .find(e => e.goal.name === '2 Strength Training').tracking[1]), 'X');
    check('workouts ring counts the ticks', await page.textContent('#workoutCount'), '3/4');
    check('no page errors', errors, []);
    await context.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
