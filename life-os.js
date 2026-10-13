/* ========================================
   Life OS - Personal Operating System
   Main Application Logic
   ======================================== */

// Categories excluded from all-time stats (one-time tasks, low-signal noise)
const EXCLUDE_CATS = new Set(['other', 'one-time / other', 'one-time/other', 'general']);

// Weeks starting on/after this Sunday use the inferred-miss scoring rule (see scoreEntry)
const DEFAULT_SCORING_CUTOVER = '2026-10-11';
const DEFAULT_REMINDERS = { enabled: false, morning: '08:00', evening: '21:00', timezone: '' };

class LifeOS {
    constructor() {
        this.STORAGE_KEY = 'lifeOSData';
        this.data = this.loadData();
        this.currentWeekIndex = -1; // -1 = latest
        this.charts = {};

        // Initialize Convex sync if URL is saved
        this.convex = null;
        const savedConvexUrl = localStorage.getItem('lifeOS_convexUrl');
        if (savedConvexUrl && window.ConvexDataLayer) {
            this.convex = new ConvexDataLayer(savedConvexUrl);
        }
        this._convexInitialized = false;

        this.init();
    }

    // ========================================
    // Data Layer
    // ========================================
    getDefaultData() {
        return {
            goals: this.getDefaultGoals(),
            categories: ['Morning Protocol', 'Midday Protocol', 'Evening Protocol', 'Mental Health', 'Physical Health', 'Budgeting', 'Work', 'Monthly', 'Cooking', 'Other'],
            weeks: [],
            transactions: [],
            accounts: [],
            budgets: {},
            habits: this.getDefaultHabits(),
            habitLog: {},       // { 'YYYY-MM-DD': { habitId: true/false } }
            adhocTasks: [],     // { id, text, completed, weekStart, created }
            healthLog: [],      // { date, weight, sleep, energy }
            journalEntries: [], // { date, text, mood, type }
            weeklyReviews: [],  // { weekDate, wins, improvements, priorities, rating }
            eveningReflections: [], // { date, whatWentWell, whatCouldImprove, gratitude, didILiveByValues, tomorrowIntention }
            activityLog: [],
            settings: {
                scoringCutover: DEFAULT_SCORING_CUTOVER,
                defaultBudgets: {
                    'Food & Dining': 400,
                    'Groceries': 600,
                    'Transportation': 200,
                    'Housing': 2500,
                    'Utilities': 300,
                    'Entertainment': 200,
                    'Shopping': 300,
                    'Health': 200,
                    'Personal': 150,
                    'Other': 200
                }
            }
        };
    }

    getDefaultGoals() {
        return [
            // Morning Protocol
            { category: 'Morning Protocol', name: 'Phone away/airplane on wake', target: 'daily' },
            { category: 'Morning Protocol', name: 'Up by 7:15AM', target: 'weekdays' },
            { category: 'Morning Protocol', name: 'Hydrate 20oz immediately', target: 'daily' },
            { category: 'Morning Protocol', name: 'High protein/fat breakfast', target: 'daily' },
            { category: 'Morning Protocol', name: 'Skincare AM', target: 'daily' },
            { category: 'Morning Protocol', name: 'Caffeine delay 60 min', target: 'daily' },
            { category: 'Morning Protocol', name: 'Outdoor exposure 10-20 min', target: 'daily' },
            // Midday Protocol
            { category: 'Midday Protocol', name: 'Cold shower finish 60s', target: 'x1' },
            { category: 'Midday Protocol', name: 'NSDR 10-20 min', target: 'daily' },
            // Evening Protocol
            { category: 'Evening Protocol', name: 'Review expenses 5 min', target: 'daily' },
            { category: 'Evening Protocol', name: 'Skincare PM', target: 'daily' },
            { category: 'Evening Protocol', name: 'Phone parked before wind-down', target: 'daily' },
            { category: 'Evening Protocol', name: 'Gratitude Journal', target: 'x7' },
            { category: 'Evening Protocol', name: 'Read before bed', target: 'daily' },
            { category: 'Evening Protocol', name: 'Meditate (3-5 min, long exhales)', target: 'daily' },
            { category: 'Evening Protocol', name: 'Review strikes', target: 'daily' },
            { category: 'Evening Protocol', name: 'In bed by 11:15PM', target: 'weeknights' },
            { category: 'Evening Protocol', name: 'Stoic Review + Tomorrow\'s To-Do', target: 'daily' },
            // Mental Health
            { category: 'Mental Health', name: 'Written Journaling 10 min x2 (Wed & Sat)', target: 'x2' },
            { category: 'Mental Health', name: 'Open Writing Session (life stories, personal voice)', target: 'weekly' },
            { category: 'Mental Health', name: 'Read 50 pages non-fiction OR 2 audiobook chapters', target: 'weekly' },
            { category: 'Mental Health', name: 'Read 1 parenting book chapter/article', target: 'weekly' },
            { category: 'Mental Health', name: 'Max 15 min Instagram/day', target: 'daily' },
            { category: 'Mental Health', name: 'Set week specific goals on Monday', target: 'weekly' },
            // Physical Health
            { category: 'Physical Health', name: '1 Night of Drinking, 2 drinks max', target: 'x1 max' },
            { category: 'Physical Health', name: '2 Strength Training', target: 'x2' },
            { category: 'Physical Health', name: '2 Cardio Training (1 swim)', target: 'x2' },
            { category: 'Physical Health', name: '10 Min Stretching/Mobility', target: 'daily' },
            { category: 'Physical Health', name: 'Core Work Out x1 (can be cardio focused core)', target: 'x1' },
            // Budgeting
            { category: 'Budgeting', name: 'Buy breakfast x1/week', target: 'x1' },
            { category: 'Budgeting', name: 'Buy lunch max x2/weekdays', target: 'x2' },
            { category: 'Budgeting', name: 'Buy dinner max x2/weekdays', target: 'x2' },
            { category: 'Budgeting', name: 'Buy lunch max x1/weekend', target: 'x1' },
            { category: 'Budgeting', name: 'Buy dinner max x1/weekend', target: 'x1' },
            { category: 'Budgeting', name: 'Sunday Money Date with Chelsey', target: 'weekly' },
            // Work
            { category: 'Work', name: 'Begin active work by 9:30AM each day', target: 'daily' },
            { category: 'Work', name: 'Time block each day', target: 'daily' },
            { category: 'Work', name: '90 min focused DND work OR 4 pomodoro blocks', target: 'daily' },
            { category: 'Work', name: '15 min AI training', target: 'daily' },
            { category: 'Work', name: 'Information System: Daily synthesis review', target: 'daily' },
            { category: 'Work', name: 'Information System: Weekly quiz', target: 'weekly' },
            // Monthly
            { category: 'Monthly', name: 'Review financial health (expenses, savings)', target: 'monthly' },
            { category: 'Monthly', name: 'Check-in with Chelsey on relationship', target: 'monthly' },
            { category: 'Monthly', name: '1 networking event', target: 'monthly' },
            { category: 'Monthly', name: '2 nice planned date nights', target: 'monthly' },
            // Cooking
            { category: 'Cooking', name: 'Cook 1 new meal/week', target: 'weekly' },
            { category: 'Cooking', name: 'Read 10 pages of cookbook/week', target: 'weekly' },
        ];
    }

    getDefaultHabits() {
        return [
            // Morning Protocol
            { id: 'am1', name: 'Phone away/airplane on wake', frequency: 'daily', category: 'morning' },
            { id: 'am2', name: 'Up by 7:15AM', frequency: 'weekdays', category: 'morning' },
            { id: 'am3', name: 'Hydrate 20oz immediately', frequency: 'daily', category: 'morning' },
            { id: 'am4', name: 'High protein/fat breakfast', frequency: 'daily', category: 'morning' },
            { id: 'am5', name: 'Skincare AM', frequency: 'daily', category: 'morning' },
            { id: 'am6', name: 'Caffeine delay 60 min', frequency: 'daily', category: 'morning' },
            { id: 'am7', name: 'Outdoor exposure 10-20 min', frequency: 'daily', category: 'morning' },
            // Midday Protocol
            { id: 'mid1', name: 'Cold shower finish 60s', frequency: 'weekly', category: 'midday' },
            { id: 'mid2', name: 'NSDR 10-20 min', frequency: 'daily', category: 'midday' },
            // Evening Protocol
            { id: 'pm1', name: 'Review expenses 5 min', frequency: 'daily', category: 'evening' },
            { id: 'pm2', name: 'Skincare PM', frequency: 'daily', category: 'evening' },
            { id: 'pm3', name: 'Phone parked before wind-down', frequency: 'daily', category: 'evening' },
            { id: 'pm4', name: 'Gratitude Journal', frequency: 'daily', category: 'evening' },
            { id: 'pm5', name: 'Read before bed', frequency: 'daily', category: 'evening' },
            { id: 'pm6', name: 'Meditate (3-5 min, long exhales)', frequency: 'daily', category: 'evening' },
            { id: 'pm7', name: 'Review strikes', frequency: 'daily', category: 'evening' },
            { id: 'pm8', name: 'In bed by 11:15PM', frequency: 'weekdays', category: 'evening' },
            { id: 'pm9', name: 'Stoic Review + Tomorrow\'s To-Do', frequency: 'daily', category: 'evening' },
        ];
    }

    loadData() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                return this.normalizeData(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Error loading data:', e);
        }
        return this.getDefaultData();
    }

    // Fill in missing top-level keys and settings. Run on anything assigned to this.data.
    normalizeData(data) {
        const defaults = this.getDefaultData();
        for (const key of Object.keys(defaults)) {
            if (!(key in data)) data[key] = defaults[key];
        }
        if (!data.settings.scoringCutover) data.settings.scoringCutover = DEFAULT_SCORING_CUTOVER;
        return data;
    }

    saveData() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error('Error saving data:', e);
            alert('Warning: Could not save data. LocalStorage may be full.');
        }
        // Mirror to Convex in the background — no await, local save already done
        if (this.convex) this.convex.save(this.data);
    }

    logActivity(text) {
        this.data.activityLog.unshift({
            text,
            time: new Date().toISOString()
        });
        if (this.data.activityLog.length > 50) {
            this.data.activityLog = this.data.activityLog.slice(0, 50);
        }
        this.saveData();
    }

    // ========================================
    // Initialization
    // ========================================
    init() {
        this.bindNavigation();
        this.bindModals();
        this.bindForms();
        this.bindQuickActions();
        this.bindHealthLog();
        this.bindHabits();
        this.bindJournal();
        this.bindReview();
        this.bindGoals();
        this.bindSettings();
        this.bindMobileMenu();
        this.bindCatchUp();
        this.bindAppLifecycle();

        // Ensure at least one week exists
        if (this.data.weeks.length === 0) {
            this.createNewWeek();
        }

        // After local render, pull fresher data from Convex
        if (this.convex) {
            this.convex.load().then(remote => {
                if (remote) {
                    const remoteWeeks = (remote.weeks || []).length;
                    const localWeeks = (this.data.weeks || []).length;
                    if (remoteWeeks >= localWeeks) {
                        this.data = this.normalizeData(remote);
                        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
                        this.renderAll();
                    }
                }
                this.convex.subscribe((payload) => {
                    this.data = this.normalizeData(payload);
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
                    this.renderAll();
                });
                this.updateConvexStatusUI();
                this.maybeShowCatchUp(); // after the freshest data is in
            });
        }

        this.renderDashboard();
        this.renderGoals();
        this.renderHealth();
        this.renderHabits();
        this.renderJournal();
        this.renderReview();

        // Set dashboard date
        document.getElementById('dashboardDate').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // On mobile, default to Today tab instead of Dashboard
        if (window.innerWidth <= 768) {
            this.navigateTo('habits');
        }

        // Notification taps open ?section=habits
        this.openSectionFromUrl();
        if (!this.convex) this.maybeShowCatchUp();
    }

    openSectionFromUrl() {
        const params = new URLSearchParams(location.search);
        const section = params.get('section');
        if (!section || !document.getElementById(`section-${section}`)) return;
        this.navigateTo(section);
        params.delete('section');
        const query = params.toString();
        history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
    }

    bindAppLifecycle() {
        // The service worker asks an already-open window to show a section (notification tap)
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (e) => {
                if (e.data?.type === 'navigate' && e.data.section) this.navigateTo(e.data.section);
            });
            navigator.serviceWorker.startMessages();
        }
        // Home Screen apps resume from memory — refresh when the day has rolled over
        this._renderedDay = this.localDateKey(new Date());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            const day = this.localDateKey(new Date());
            if (day !== this._renderedDay) {
                this._renderedDay = day;
                this.renderAll();
                this.maybeShowCatchUp();
            }
            this.updateAppBadge();
        });
    }

    // Home Screen icon badge = scheduled daily items still unchecked today
    updateAppBadge() {
        if (!('setAppBadge' in navigator)) return;
        const n = this.todayRemainingCount();
        const p = n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge();
        if (p && p.catch) p.catch(() => {});
    }

    // ========================================
    // Yesterday catch-up
    // ========================================
    bindCatchUp() {
        document.getElementById('catchUpList').addEventListener('click', (e) => {
            const item = e.target.closest('.catchup-item');
            if (!item) return;
            const box = item.querySelector('.habit-checkbox');
            const on = !box.classList.contains('checked');
            box.classList.toggle('checked', on);
            box.textContent = on ? '\u2713' : '';
            item.classList.toggle('item-done', on);
        });
        document.getElementById('catchUpDoneBtn').addEventListener('click', () => this.finishCatchUp());
    }

    // Once a day, offer to check off yesterday's scheduled daily items that are still blank
    maybeShowCatchUp() {
        const todayKey = this.localDateKey(new Date());
        try {
            if (localStorage.getItem('lifeOS_catchUpShown') === todayKey) return;
        } catch (e) { /* storage unavailable — show anyway */ }
        const yesterday = this.startOfToday();
        yesterday.setDate(yesterday.getDate() - 1);
        const week = this.getWeekForDate(yesterday);
        if (!week || !this.isCutoverWeek(week)) return;
        const items = this.uncheckedDailyEntries(week, yesterday.getDay());
        if (items.length === 0) return;
        try { localStorage.setItem('lifeOS_catchUpShown', todayKey); } catch (e) { /* ignore */ }

        this._catchUpDate = yesterday;
        this._catchUpNames = items.map(i => i.entry.goal.name);
        document.getElementById('catchUpDate').textContent = yesterday.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
        });
        document.getElementById('catchUpList').innerHTML = items.map(({ entry }, i) => `
            <div class="habit-check-item catchup-item" data-catchup-idx="${i}">
                <div class="habit-checkbox"></div>
                <div class="habit-item-content">
                    <span class="habit-name">${this.escapeHtml(entry.goal.name)}</span>
                    <span class="off-reason">${this.escapeHtml(entry.goal.category)}</span>
                </div>
            </div>`).join('');
        this.openModal('catchUpModal');
    }

    finishCatchUp() {
        const names = [...document.querySelectorAll('#catchUpList .catchup-item')]
            .filter(el => el.querySelector('.habit-checkbox.checked'))
            .map(el => this._catchUpNames[parseInt(el.dataset.catchupIdx)]);
        // Look the week up again — a Convex sync may have replaced this.data meanwhile
        const day = this._catchUpDate;
        const week = day && this.getWeekForDate(day);
        if (week && names.length > 0) {
            const d = day.getDay();
            Object.values(week.entries).forEach(e => {
                if (names.includes(e.goal.name) && !this.isDone(e.tracking[d])) e.tracking[d] = 'X';
            });
            this.saveData();
            this.logActivity(`Caught up on yesterday: ${names.length} item${names.length > 1 ? 's' : ''} done`);
            this.renderAll();
        }
        this.closeModal('catchUpModal');
    }

    renderAll() {
        this.renderDashboard();
        this.renderGoals();
        this.renderHealth();
        this.renderHabits();
        this.renderJournal();
        this.renderReview();
    }

    // ========================================
    // Navigation
    // ========================================
    bindNavigation() {
        // Sidebar nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.navigateTo(section);
            });
        });

        // Mobile bottom nav buttons
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section;
                this.navigateTo(section);
            });
        });
    }

    navigateTo(section) {
        // Update sidebar nav
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector(`.nav-link[data-section="${section}"]`).classList.add('active');

        // Update mobile bottom nav
        document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
        const mobileBtn = document.querySelector(`.mobile-nav-btn[data-section="${section}"]`);
        if (mobileBtn) mobileBtn.classList.add('active');

        // Update sections
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${section}`).classList.add('active');

        // Close mobile menu
        document.getElementById('sidebar').classList.remove('open');

        // Scroll to top on mobile
        window.scrollTo(0, 0);

        // Refresh the section
        switch (section) {
            case 'dashboard': this.renderDashboard(); break;
            case 'goals': this.renderGoals(); break;
            case 'health': this.renderHealth(); break;
            case 'habits': this.renderHabits(); break;
            case 'journal': this.renderJournal(); break;
            case 'review': this.renderReview(); break;
        }
    }

    bindMobileMenu() {
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Close sidebar on clicking outside on mobile
        document.getElementById('mainContent').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
        });
    }

    // ========================================
    // Modals
    // ========================================
    bindModals() {
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.modal;
                document.getElementById(modalId).classList.remove('active');
            });
        });

        // Close on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    openModal(id) {
        document.getElementById(id).classList.add('active');
    }

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }

    // ========================================
    // Week Management
    // ========================================
    getWeekStartDate(date = new Date()) {
        const d = new Date(date);
        const day = d.getDay();
        d.setDate(d.getDate() - day); // Go to Sunday
        d.setHours(0, 0, 0, 0);
        return d;
    }

    // Returns 'YYYY-MM-DD' for the Sunday of the week containing the given date
    weekKey(date) {
        return this.getWeekStartDate(date).toISOString().slice(0, 10);
    }

    createNewWeek() {
        const startDate = this.getWeekStartDate();
        const key = this.weekKey(startDate);

        // Check if a week for this Sunday already exists (normalize by date only)
        const existing = this.data.weeks.find(w => this.weekKey(new Date(w.startDate)) === key);

        if (existing) {
            // If the existing week came from historical import and has no current goals,
            // update its startDate to match the app format and add current goals
            const hasCurrentGoals = this.data.goals.some(g =>
                Object.values(existing.entries).some(e => e.goal.name === g.name)
            );
            if (hasCurrentGoals) return; // Already set up — nothing to do

            // Add current goals that aren't already in the week
            const existingNames = new Set(Object.values(existing.entries).map(e => e.goal.name));
            const nextIdx = Object.keys(existing.entries).reduce((max, k) => Math.max(max, Number(k)), 0) + 1;
            this.data.goals.forEach((goal, i) => {
                if (!existingNames.has(goal.name)) {
                    existing.entries[nextIdx + i] = {
                        goal: { ...goal },
                        tracking: ['', '', '', '', '', '', '']
                    };
                }
            });
            this.saveData();
            this.logActivity('Added current goals to existing week');
            return;
        }

        const week = {
            startDate: startDate.toISOString(),
            entries: {}
        };

        this.data.goals.forEach((goal, i) => {
            week.entries[i] = {
                goal: { ...goal },
                tracking: ['', '', '', '', '', '', '']
            };
        });

        this.data.weeks.push(week);
        // Keep weeks sorted by date
        this.data.weeks.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        this.saveData();
        this.logActivity('New week started');
    }

    getCurrentWeek() {
        if (this.data.weeks.length === 0) return null;
        if (this.currentWeekIndex === -1) {
            return this.data.weeks[this.data.weeks.length - 1];
        }
        return this.data.weeks[this.currentWeekIndex];
    }

    // Always returns the week that contains today (for the Today/habits section).
    // Falls back to the most recent week if today doesn't fall in any stored week.
    getTodayWeek() {
        if (this.data.weeks.length === 0) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Search from most recent backward
        for (let i = this.data.weeks.length - 1; i >= 0; i--) {
            const w = this.data.weeks[i];
            const start = new Date(w.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            if (today >= start && today <= end) return w;
        }
        // No exact match — return the most recent week
        return this.data.weeks[this.data.weeks.length - 1];
    }

    formatWeekDate(isoStr) {
        const d = new Date(isoStr);
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
        const opts = { month: 'short', day: 'numeric' };
        return `${d.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}, ${end.getFullYear()}`;
    }

    // ========================================
    // Tracking Helpers (skipped cells, per-goal schedules)
    // ========================================
    // Cell values: 'X' done, '1'/'2'.. strikes, '-' skipped (doesn't apply), '' untracked
    isTracked(v) {
        return v !== '' && v !== '-' && v != null;
    }

    getVacationDays(week) {
        return week.vacationDays || (week.vacation ? [0, 1, 2, 3, 4, 5, 6] : []);
    }

    // Days of the week (0=Sun..6=Sat) a goal applies to. The schedule lives on the goal
    // in this.data.goals (matched by name) so it applies to every week, past and future;
    // otherwise derive from the target. Weeknights = Sun-Thu (nights before a workday).
    getGoalDays(goal) {
        const current = this.data.goals.find(g => g.name === goal.name);
        const days = current?.days ?? goal.days;
        if (Array.isArray(days)) return days;
        const t = (goal.target || '').toLowerCase().trim();
        if (t === 'weekdays') return [1, 2, 3, 4, 5];
        if (t === 'weeknights') return [0, 1, 2, 3, 4];
        return [0, 1, 2, 3, 4, 5, 6];
    }

    // Is this goal expected on this day? False for vacation days, skipped cells,
    // and days outside the goal's schedule.
    isExpected(week, entry, dayIdx) {
        if (this.getVacationDays(week).includes(dayIdx)) return false;
        if (entry.tracking[dayIdx] === '-') return false;
        return this.getGoalDays(entry.goal).includes(dayIdx);
    }

    setGoalDays(goalIdx, days) {
        const goal = this.data.goals[goalIdx];
        if (goal) goal.days = [...days].sort();
    }

    // ========================================
    // Scoring (one rule for every %, strike count and chart)
    // ========================================
    isDone(v) {
        return v === 'X' || v === 'x';
    }

    // 'YYYY-MM-DD' in local time (toISOString would shift evenings into tomorrow)
    localDateKey(date) {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    startOfToday() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    // Local midnight of the Sunday a stored week starts on. startDate is Sunday midnight
    // (or noon, for imports) in whatever timezone it was created; shifting by 12h first
    // keeps a few hours of timezone difference from landing it in the previous week.
    weekStartOf(week) {
        return this.getWeekStartDate(new Date(new Date(week.startDate).getTime() + 12 * 3600e3));
    }

    // Local midnight of day dayIdx (0=Sun) of a week
    weekDayDate(week, dayIdx) {
        const d = this.weekStartOf(week);
        d.setDate(d.getDate() + dayIdx);
        return d;
    }

    // The stored week containing date, or null (no fallback to another week)
    getWeekForDate(date) {
        const key = this.localDateKey(this.getWeekStartDate(date));
        for (let i = this.data.weeks.length - 1; i >= 0; i--) {
            if (this.localDateKey(this.weekStartOf(this.data.weeks[i])) === key) return this.data.weeks[i];
        }
        return null;
    }

    isCutoverWeek(week) {
        const cutover = this.data.settings?.scoringCutover || DEFAULT_SCORING_CUTOVER;
        return this.localDateKey(this.weekStartOf(week)) >= cutover;
    }

    hasCustomDays(goal) {
        const current = this.data.goals.find(g => g.name === goal.name);
        return Array.isArray(current?.days ?? goal.days);
    }

    // Which scoring rule a goal follows: 'limit' | 'monthly' | 'daily' | 'perWeek'
    scoringKind(goal) {
        const freq = this.classifyFrequency(goal.target);
        if (freq.isLimit || (goal.category || '').trim() === 'Budgeting') return 'limit';
        if (freq.group === 'monthly') return 'monthly';
        if (freq.group === 'daily' || this.hasCustomDays(goal)) return 'daily';
        return 'perWeek';
    }

    // Was a monthly goal checked on any day of the given month (any week)?
    isMonthlyDone(goalName, year, month) {
        return this.data.weeks.some(week => {
            const entry = Object.values(week.entries).find(e => e.goal.name === goalName);
            if (!entry) return false;
            return entry.tracking.some((v, d) => {
                if (!this.isDone(v)) return false;
                const date = this.weekDayDate(week, d);
                return date.getFullYear() === year && date.getMonth() === month;
            });
        });
    }

    // Score one goal for one week → { done, expected, misses, ... }.
    // done/expected feed every %; misses (incl. manual +/− adjustments) feed every strike count.
    // Weeks before the cutover: ✓ ÷ marked cells, explicit strikes only.
    // From the cutover on, only ✓ is entered and misses are inferred:
    //   daily    — each scheduled day that has passed and is still blank is a miss (today never is)
    //   perWeek  — only ✓ count; a shortfall counts once the week is over (until then the goal
    //              is left out unless the target is already met)
    //   limit    — ✓ = used one; at/under the limit = 100%, each use over = a miss
    //   monthly  — judged at month end, in the week holding the month's last day
    // Skipped '-', unscheduled and vacation days are excluded. Explicit ✗ still counts as a miss.
    scoreEntry(week, entry) {
        const t = entry.tracking || [];
        const vac = this.getVacationDays(week);
        const days = [0, 1, 2, 3, 4, 5, 6].filter(d => !vac.includes(d));
        const explicit = days.reduce((n, d) => n + (parseInt(t[d]) || 0), 0);
        const checks = days.filter(d => this.isDone(t[d])).length;
        const withManual = n => Math.max(0, n + (entry.manual || 0));

        const target = Math.round(this.classifyFrequency(entry.goal.target).perWeek);

        if (!this.isCutoverWeek(week)) {
            const marked = days.filter(d => this.isTracked(t[d])).length;
            return { kind: 'legacy', done: checks, expected: marked, misses: withManual(explicit), checks, target };
        }

        const kind = this.scoringKind(entry.goal);
        const today = this.startOfToday();
        const weekOver = this.weekDayDate(week, 6) < today;

        if (kind === 'daily') {
            let done = 0, expected = 0, inferred = 0;
            for (let d = 0; d < 7; d++) {
                if (!this.isExpected(week, entry, d)) continue;
                const v = t[d] ?? '';
                if (this.isDone(v)) { done++; expected++; }
                else if (parseInt(v) > 0) expected++; // explicit ✗, already in `explicit`
                else if (this.weekDayDate(week, d) < today) { expected++; inferred++; }
            }
            return { kind, done, expected, misses: withManual(explicit + inferred), checks, target: expected };
        }

        // Days the goal could still happen on (vacation and skipped days removed)
        const available = days.filter(d => t[d] !== '-').length;

        if (kind === 'limit') {
            if (available === 0) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target };
            const over = Math.max(0, checks - target);
            const missed = Math.max(explicit, over);
            return { kind, done: Math.max(0, target - missed), expected: target, misses: withManual(missed), checks, target };
        }

        if (kind === 'monthly') {
            const endDay = [0, 1, 2, 3, 4, 5, 6].find(d => {
                const next = this.weekDayDate(week, d + 1);
                return next.getDate() === 1;
            });
            if (endDay === undefined) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target: 0 };
            const end = this.weekDayDate(week, endDay);
            if (this.isMonthlyDone(entry.goal.name, end.getFullYear(), end.getMonth())) {
                return { kind, done: 1, expected: 1, misses: withManual(explicit), checks, target: 1 };
            }
            if (end >= today) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target: 1, pending: true };
            return { kind, done: 0, expected: 1, misses: withManual(Math.max(explicit, 1)), checks, target: 1 };
        }

        // perWeek: x2, x3, weekly, x1 — target shrinks if vacation/skips leave fewer days
        const need = Math.min(target, available);
        if (need === 0) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target: 0 };
        if (checks >= need) return { kind, done: need, expected: need, misses: withManual(explicit), checks, target: need };
        if (!weekOver) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target: need, pending: true };
        return { kind, done: checks, expected: need, misses: withManual(Math.max(explicit, need - checks)), checks, target: need };
    }

    // Sum scoreEntry over a week's entries, optionally filtered
    scoreWeek(week, filter = () => true) {
        const total = { done: 0, expected: 0, misses: 0 };
        Object.values(week.entries).forEach(entry => {
            if (!filter(entry)) return;
            const s = this.scoreEntry(week, entry);
            total.done += s.done;
            total.expected += s.expected;
            total.misses += s.misses;
        });
        return total;
    }

    // { category: { done, expected, misses } } for one week
    scoreByCategory(week) {
        const cats = {};
        Object.values(week.entries).forEach(entry => {
            const cat = entry.goal.category;
            if (!cats[cat]) cats[cat] = { done: 0, expected: 0, misses: 0 };
            const s = this.scoreEntry(week, entry);
            cats[cat].done += s.done;
            cats[cat].expected += s.expected;
            cats[cat].misses += s.misses;
        });
        return cats;
    }

    scorePct(s) {
        return s.expected > 0 ? Math.min(100, Math.round((s.done / s.expected) * 100)) : 0;
    }

    // Is this cell an inferred miss (blank on a scheduled day that has passed)?
    isInferredMiss(week, entry, dayIdx) {
        return this.isCutoverWeek(week) &&
            this.scoringKind(entry.goal) === 'daily' &&
            (entry.tracking[dayIdx] ?? '') === '' &&
            this.isExpected(week, entry, dayIdx) &&
            this.weekDayDate(week, dayIdx) < this.startOfToday();
    }

    // Scheduled daily items on dayIdx of week that are still blank
    uncheckedDailyEntries(week, dayIdx) {
        return Object.entries(week.entries)
            .filter(([, e]) => this.scoringKind(e.goal) === 'daily' &&
                this.isExpected(week, e, dayIdx) &&
                (e.tracking[dayIdx] ?? '') === '')
            .map(([idx, e]) => ({ idx, entry: e }));
    }

    todayRemainingCount() {
        const today = this.startOfToday();
        const week = this.getWeekForDate(today);
        return week ? this.uncheckedDailyEntries(week, today.getDay()).length : 0;
    }

    // ========================================
    // Dashboard
    // ========================================
    renderDashboard() {
        this.updateAppBadge();
        this.renderLifeScore();
        this.renderDashStats();
        this.renderWeeklyTrend();
        this.renderCategoryBars();
        this.renderProblemAreas();
        this.renderAllTimeStats();
        this.renderDeepDive();
        this.renderActivityFeed();
    }

    renderLifeScore() {
        const week = this.getCurrentWeek();
        if (!week) return;

        const goalStats = this.scoreWeek(week);

        // Factor in habits
        const today = this.getTodayStr();
        const todayHabits = this.data.habitLog[today] || {};
        const habitsDone = Object.values(todayHabits).filter(v => v).length;
        const habitsTotal = this.data.habits.length;

        // Weighted score: 60% goals, 25% habits, 15% other factors
        const goalScore = goalStats.expected > 0 ? (goalStats.done / goalStats.expected) * 100 : 0;
        const habitScore = habitsTotal > 0 ? (habitsDone / habitsTotal) * 100 : 0;
        const lifeScore = Math.round(goalScore * 0.6 + habitScore * 0.25 + 15); // 15 base points

        document.getElementById('lifeScoreValue').textContent = Math.min(lifeScore, 100);

        // Draw ring chart
        const canvas = document.getElementById('lifeScoreChart');
        if (this.charts.lifeScore) this.charts.lifeScore.destroy();
        this.charts.lifeScore = new Chart(canvas, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [Math.min(lifeScore, 100), Math.max(100 - lifeScore, 0)],
                    backgroundColor: ['#6366f1', '#f1f5f9'],
                    borderWidth: 0,
                }]
            },
            options: {
                cutout: '78%',
                responsive: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                animation: { animateRotate: true }
            }
        });
    }

    renderDashStats() {
        const week = this.getCurrentWeek();
        if (!week) return;

        // Goals on track
        let onTrack = 0;
        const totalGoals = Object.keys(week.entries).length;
        Object.values(week.entries).forEach(entry => {
            if (this.scoreEntry(week, entry).misses === 0) onTrack++;
        });
        document.getElementById('dashGoalsOnTrack').textContent = onTrack;
        document.getElementById('dashGoalsDetail').textContent = `of ${totalGoals} goals`;

        // Today's progress
        const todayDayIdx = new Date().getDay();
        let todayDone = 0, todayTotal = 0;
        if (week) {
            Object.values(week.entries).forEach(entry => {
                const freq = this.classifyFrequency(entry.goal.target);
                // Only count items applicable today
                const applicable = (freq.group === 'daily' || freq.group === 'fewPerWeek') &&
                    this.scoringKind(entry.goal) !== 'limit' &&
                    this.isExpected(week, entry, todayDayIdx);
                if (applicable) {
                    todayTotal++;
                    const val = entry.tracking[todayDayIdx];
                    if (val === 'X' || val === 'x') todayDone++;
                }
            });
        }
        document.getElementById('dashTodayProgress').textContent = `${todayDone}/${todayTotal}`;
        document.getElementById('dashTodayDetail').textContent = 'items done today';

        // Health score (based on physical health goal completion this week)
        const healthPct = this.scorePct(this.scoreWeek(week, e =>
            e.goal.category === 'Physical Health' || e.goal.category === 'Mental Health'));
        document.getElementById('dashHealthScore').textContent = healthPct + '%';

        // Habit streak
        const streak = this.calculateMaxStreak();
        document.getElementById('dashHabitStreak').textContent = streak;
    }

    calculateMaxStreak() {
        // Count consecutive days (including today) where ≥70% of daily goals were completed
        const sortedWeeks = [...this.data.weeks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        if (sortedWeeks.length === 0) return 0;

        const today = new Date();
        const todayDayIdx = today.getDay();
        let streak = 0;
        let weekIdx = sortedWeeks.length - 1;
        let dayIdx = todayDayIdx;

        while (weekIdx >= 0) {
            const week = sortedWeeks[weekIdx];
            const entries = Object.values(week.entries).filter(e => {
                const freq = this.classifyFrequency(e.goal.target);
                return freq.group === 'daily';
            });
            if (entries.length === 0) break;

            for (let d = dayIdx; d >= 0; d--) {
                // Only goals expected that day count; days with nothing expected are skipped
                const expected = entries.filter(e => this.isExpected(week, e, d));
                if (expected.length === 0) continue;
                const done = expected.filter(e => e.tracking[d] === 'X' || e.tracking[d] === 'x').length;
                if (done / expected.length >= 0.7) {
                    streak++;
                } else if (weekIdx === sortedWeeks.length - 1 && d === todayDayIdx) {
                    continue; // today is still in progress — don't break the streak yet
                } else {
                    return streak;
                }
            }
            weekIdx--;
            dayIdx = 6;
        }
        return streak;
    }

    renderCategoryBars() {
        const week = this.getCurrentWeek();
        const container = document.getElementById('dashCategoryBars');
        if (!week) {
            container.innerHTML = '<div class="empty-state">No data yet.</div>';
            return;
        }

        const catStats = this.scoreByCategory(week);

        const colors = {
            'Physical Health': '#ef4444',
            'Mental Health': '#8b5cf6',
            'Budgeting': '#22c55e',
            'Work': '#3b82f6',
            'Monthly': '#f59e0b',
            'Cooking': '#f97316',
            'Other': '#6b7280'
        };

        let html = '';
        for (const [cat, stats] of Object.entries(catStats)) {
            const pct = this.scorePct(stats);
            html += `
                <div class="category-bar-item">
                    <div class="category-bar-label">
                        <span>${cat}</span>
                        <span>${pct}%</span>
                    </div>
                    <div class="category-bar-track">
                        <div class="category-bar-fill" style="width:${pct}%;background:${colors[cat] || '#6366f1'}"></div>
                    </div>
                </div>`;
        }
        container.innerHTML = html;
    }

    renderWeeklyTrend() {
        const el = document.getElementById('weeklyTrend');
        if (!el) return;
        const sorted = [...this.data.weeks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        if (sorted.length < 2) { el.textContent = ''; return; }

        const getScore = (week) => this.scorePct(this.scoreWeek(week));

        const curr = getScore(sorted[sorted.length - 1]);
        const prev = getScore(sorted[sorted.length - 2]);
        const diff = curr - prev;

        if (diff > 0) { el.textContent = `↑ ${diff}% vs last week`; el.className = 'weekly-trend up'; }
        else if (diff < 0) { el.textContent = `↓ ${Math.abs(diff)}% vs last week`; el.className = 'weekly-trend down'; }
        else { el.textContent = '→ Same as last week'; el.className = 'weekly-trend neutral'; }
    }

    renderProblemAreas() {
        const container = document.getElementById('problemAreas');
        if (!container) return;
        const week = this.getCurrentWeek();
        if (!week) { container.innerHTML = ''; return; }

        const catStats = this.scoreByCategory(week);

        const worst = Object.entries(catStats)
            .filter(([, s]) => s.expected > 0)
            .map(([cat, s]) => ({ cat, pct: this.scorePct(s), strikes: s.misses }))
            .sort((a, b) => a.pct - b.pct)
            .slice(0, 3)
            .filter(s => s.pct < 80);

        if (worst.length === 0) { container.innerHTML = ''; return; }

        container.innerHTML = `
            <div class="problem-areas">
                <h3>Needs Attention This Week</h3>
                <div class="problem-areas-list">
                    ${worst.map(s => `
                        <div class="problem-area-item">
                            <div class="problem-area-header">
                                <span class="problem-area-name">${s.cat}</span>
                                <span class="problem-area-pct" style="color:${s.pct < 50 ? 'var(--danger)' : 'var(--warning)'}">${s.pct}%${s.strikes > 0 ? ` · ${s.strikes} strike${s.strikes > 1 ? 's' : ''}` : ''}</span>
                            </div>
                            <div class="problem-bar-track">
                                <div class="problem-bar-fill" style="width:${s.pct}%;background:${s.pct < 50 ? 'var(--danger)' : 'var(--warning)'}"></div>
                            </div>
                        </div>`).join('')}
                </div>
            </div>`;
    }

    renderAllTimeStats(period) {
        const container = document.getElementById('allTimeStats');
        if (!container) return;
        if (this.data.weeks.length <= 1) { container.style.display = 'none'; return; }
        container.style.display = 'block';

        if (!period) period = this.allStatsPeriod || 'all';
        this.allStatsPeriod = period;

        const now = new Date();
        const periodCutoff = {
            '1m':  new Date(now - 30 * 864e5),
            '3m':  new Date(now - 91 * 864e5),
            'ytd': new Date(now.getFullYear(), 0, 1),
            'all': new Date(0)
        }[period];
        const weeks = this.data.weeks.filter(w => new Date(w.startDate) >= periodCutoff);

        const catStats = {};   // cat -> { done, strikes, total, weekCount: Set, goals: { name -> {done,strikes,total} } }
        weeks.forEach(week => {
            Object.values(week.entries).forEach(entry => {
                const cat = (entry.goal.category || 'Other').trim();
                if (EXCLUDE_CATS.has(cat.toLowerCase())) return;
                if (!catStats[cat]) catStats[cat] = { done: 0, strikes: 0, total: 0, weekCount: new Set(), goals: {} };
                const cStat = catStats[cat];
                cStat.weekCount.add(week.startDate);
                const gName = entry.goal.name;
                if (!cStat.goals[gName]) cStat.goals[gName] = { done: 0, strikes: 0, total: 0 };
                const gStat = cStat.goals[gName];
                const s = this.scoreEntry(week, entry);
                cStat.total += s.expected; gStat.total += s.expected;
                cStat.done += s.done; gStat.done += s.done;
                cStat.strikes += s.misses; gStat.strikes += s.misses;
            });
        });

        // Filter out categories with very little data (< 20 tracked instances)
        const sorted = Object.entries(catStats)
            .filter(([, s]) => s.total >= 20)
            .sort((a, b) => (b[1].done / b[1].total) - (a[1].done / a[1].total));

        if (sorted.length === 0) { container.style.display = 'none'; return; }

        const cards = sorted.map(([cat, s]) => {
            const pct = Math.round((s.done / s.total) * 100);
            const cls = pct >= 80 ? 'good' : pct >= 60 ? 'okay' : 'needs-work';
            const wks = s.weekCount.size;

            // Top goals by frequency (most tracked), show pct for each
            const topGoals = Object.entries(s.goals)
                .filter(([, g]) => g.total >= 5)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 5)
                .map(([name, g]) => {
                    const gpct = Math.round((g.done / g.total) * 100);
                    const gcls = gpct >= 80 ? 'var(--success)' : gpct >= 60 ? 'var(--warning)' : 'var(--danger)';
                    return `<div class="alltime-goal-row">
                        <span class="alltime-goal-name">${this.escapeHtml(name)}</span>
                        <span class="alltime-goal-pct" style="color:${gcls}">${gpct}%</span>
                    </div>`;
                }).join('');

            return `<div class="alltime-cat-card ${cls}">
                <div class="alltime-cat-header">
                    <span class="alltime-cat-name">${cat}</span>
                    <span class="alltime-cat-pct">${pct}%</span>
                </div>
                <div class="alltime-cat-detail">${s.done}✓ · ${s.strikes > 0 ? s.strikes + '✗ · ' : ''}${wks}wks</div>
                ${topGoals ? `<div class="alltime-goals-list">${topGoals}</div>` : ''}
            </div>`;
        }).join('');

        const periodBtns = [
            { id: '1m', label: '1M' }, { id: '3m', label: '3M' },
            { id: 'ytd', label: 'YTD' }, { id: 'all', label: 'All' }
        ].map(p => `<button class="deepdive-period-btn allstats-period-btn${period === p.id ? ' active' : ''}" data-period="${p.id}">${p.label}</button>`).join('');

        container.innerHTML = `
            <div class="alltime-stats">
                <div class="alltime-header">
                    <h3>By Category <span class="alltime-weeks-label">${weeks.length} weeks</span></h3>
                    <div class="deepdive-period-filter">${periodBtns}</div>
                </div>
                <div class="alltime-grid">${cards}</div>
            </div>`;

        container.querySelectorAll('.allstats-period-btn').forEach(btn => {
            btn.addEventListener('click', () => this.renderAllTimeStats(btn.dataset.period));
        });
    }

    renderDeepDive(period) {
        const container = document.getElementById('deepDive');
        if (!container) return;
        if (this.data.weeks.length < 4) { container.style.display = 'none'; return; }
        container.style.display = 'block';

        // Preserve open/closed state across re-renders
        const wasOpen = document.getElementById('deepDiveBody')?.style.display !== 'none';
        if (!period) period = this.deepDivePeriod || 'all';
        this.deepDivePeriod = period;

        // Filter weeks by selected period
        const now = new Date();
        const periodCutoff = {
            '1m':  new Date(now - 30 * 864e5),
            '3m':  new Date(now - 91 * 864e5),
            'ytd': new Date(now.getFullYear(), 0, 1),
            'all': new Date(0)
        }[period];
        const weeks = this.data.weeks.filter(w => new Date(w.startDate) >= periodCutoff);

        // ── Month-over-month bars ───────────────────────────────────────
        const monthStats = {};
        weeks.forEach(week => {
            const d = new Date(week.startDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthStats[key]) monthStats[key] = { done: 0, total: 0 };
            const s = this.scoreWeek(week);
            monthStats[key].done += s.done;
            monthStats[key].total += s.expected;
        });
        const monthKeys = Object.keys(monthStats).sort().slice(-12);
        const monthBars = monthKeys.map(key => {
            const s = monthStats[key];
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            const color = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';
            const monthName = new Date(key + '-15').toLocaleDateString('en-US', { month: 'short' });
            return `<div class="trend-bar-col">
                <div class="trend-bar-wrap">
                    <div class="trend-bar-fill" style="height:${pct}%;background:${color};" title="${pct}%"></div>
                </div>
                <div class="trend-bar-label">${monthName}</div>
            </div>`;
        }).join('');

        // ── Active streaks (always all-time — streaks are live) ─────────
        const goalNames = new Set();
        this.data.weeks.forEach(w => Object.values(w.entries).forEach(e => goalNames.add(e.goal.name)));
        const streaks = [...goalNames].map(name => ({ name, streak: this.calculateGoalStreak(name) }))
            .filter(g => g.streak >= 3).sort((a, b) => b.streak - a.streak).slice(0, 5);
        const streakRows = streaks.length ? streaks.map(g => {
            const badge = g.streak >= 30 ? '👑' : g.streak >= 14 ? '💎' : g.streak >= 7 ? '⭐' : '🔥';
            return `<div class="deepdive-row">
                <span class="deepdive-name">${this.escapeHtml(g.name)}</span>
                <span class="deepdive-val">${badge} ${g.streak}d</span>
            </div>`;
        }).join('') : '<div class="deepdive-empty">No active streaks ≥ 3 days</div>';

        // ── Top & bottom goals ──────────────────────────────────────────
        const goalStats = {};
        weeks.forEach(week => {
            Object.values(week.entries).forEach(entry => {
                const name = entry.goal.name;
                if (!goalStats[name]) goalStats[name] = { done: 0, total: 0 };
                const s = this.scoreEntry(week, entry);
                goalStats[name].done += s.done;
                goalStats[name].total += s.expected;
            });
        });
        const minTotal = period === '1m' ? 3 : 10;
        const rankedGoals = Object.entries(goalStats)
            .filter(([, s]) => s.total >= minTotal)
            .map(([name, s]) => ({ name, pct: Math.round((s.done / s.total) * 100) }))
            .sort((a, b) => b.pct - a.pct);
        const top5 = rankedGoals.slice(0, 5);
        const bot5 = rankedGoals.slice(-5).reverse();
        const goalRow = (g, colorVar) => `<div class="deepdive-row">
            <span class="deepdive-name">${this.escapeHtml(g.name)}</span>
            <span class="deepdive-val" style="color:${colorVar}">${g.pct}%</span>
        </div>`;

        const periods = [
            { id: '1m', label: '1M' },
            { id: '3m', label: '3M' },
            { id: 'ytd', label: 'YTD' },
            { id: 'all', label: 'All' }
        ];
        const filterBtns = periods.map(p =>
            `<button class="deepdive-period-btn${period === p.id ? ' active' : ''}" data-period="${p.id}">${p.label}</button>`
        ).join('');

        container.innerHTML = `
            <div class="deepdive-wrap">
                <button class="deepdive-toggle" id="deepDiveToggle">
                    <span>📊 Deep Dive</span>
                    <span class="deepdive-chevron" id="deepDiveChevron">${wasOpen ? '▼' : '▶'}</span>
                </button>
                <div class="deepdive-body" id="deepDiveBody" style="display:${wasOpen ? 'block' : 'none'};">
                    <div class="deepdive-period-filter">${filterBtns}</div>
                    <div class="deepdive-section">
                        <h4>Month-over-Month</h4>
                        <div class="trend-bars">${monthBars || '<span class="deepdive-empty">No data for this period</span>'}</div>
                    </div>
                    <div class="deepdive-cols">
                        <div class="deepdive-section">
                            <h4>Active Streaks</h4>
                            ${streakRows}
                        </div>
                        <div class="deepdive-section">
                            <h4>Best</h4>
                            ${top5.map(g => goalRow(g, 'var(--success)')).join('') || '<div class="deepdive-empty">Not enough data</div>'}
                        </div>
                        <div class="deepdive-section">
                            <h4>Needs Work</h4>
                            ${bot5.map(g => goalRow(g, 'var(--danger)')).join('') || '<div class="deepdive-empty">Not enough data</div>'}
                        </div>
                    </div>
                </div>
            </div>`;

        document.getElementById('deepDiveToggle').addEventListener('click', () => {
            const body = document.getElementById('deepDiveBody');
            const chevron = document.getElementById('deepDiveChevron');
            const open = body.style.display === 'none';
            body.style.display = open ? 'block' : 'none';
            chevron.textContent = open ? '▼' : '▶';
        });

        container.querySelectorAll('.deepdive-period-btn').forEach(btn => {
            btn.addEventListener('click', () => this.renderDeepDive(btn.dataset.period));
        });
    }

    renderActivityFeed() {
        const feed = document.getElementById('activityFeed');
        if (this.data.activityLog.length === 0) {
            feed.innerHTML = `<div class="activity-item">
                <span class="activity-dot"></span>
                <span class="activity-text">Welcome to Life OS. Start tracking to see activity here.</span>
                <span class="activity-time">just now</span>
            </div>`;
            return;
        }

        feed.innerHTML = this.data.activityLog.slice(0, 10).map(a => {
            const ago = this.timeAgo(new Date(a.time));
            return `<div class="activity-item">
                <span class="activity-dot"></span>
                <span class="activity-text">${this.escapeHtml(a.text)}</span>
                <span class="activity-time">${ago}</span>
            </div>`;
        }).join('');
    }

    // ========================================
    // Goals Section
    // ========================================
    bindGoals() {
        document.getElementById('prevWeekBtn').addEventListener('click', () => {
            const realIndex = this.currentWeekIndex === -1 ? this.data.weeks.length - 1 : this.currentWeekIndex;
            if (realIndex > 0) {
                this.currentWeekIndex = realIndex - 1;
                this.renderGoals();
            }
        });

        document.getElementById('nextWeekBtn').addEventListener('click', () => {
            const realIndex = this.currentWeekIndex === -1 ? this.data.weeks.length - 1 : this.currentWeekIndex;
            if (realIndex < this.data.weeks.length - 1) {
                this.currentWeekIndex = realIndex + 1;
                this.renderGoals();
            } else {
                this.currentWeekIndex = -1;
                this.renderGoals();
            }
        });

        document.getElementById('newWeekBtn').addEventListener('click', () => {
            this.createNewWeek();
            this.currentWeekIndex = -1;
            this.renderGoals();
        });

        document.getElementById('addGoalBtn').addEventListener('click', () => this.openModal('addGoalModal'));

        // Delegated: cell clicks, strike +/-, and day-header vacation toggles
        // Bound once here instead of re-binding inside renderGoals on every render
        document.getElementById('goalsGrid').addEventListener('click', (e) => {
            const cell = e.target.closest('.day-cell:not(.vacation-day)');
            if (cell) {
                this.toggleGoalCell(parseInt(cell.dataset.goal), parseInt(cell.dataset.day));
                return;
            }
            const incBtn = e.target.closest('.strike-inc');
            if (incBtn) {
                const week = this.getCurrentWeek();
                if (!week) return;
                const idx = incBtn.dataset.goal;
                const entry = week.entries[idx] ?? week.entries[parseInt(idx)];
                if (!entry) return;
                entry.manual = (entry.manual || 0) + 1;
                this.saveData();
                this.renderGoals();
                return;
            }
            const decBtn = e.target.closest('.strike-dec');
            if (decBtn) {
                const week = this.getCurrentWeek();
                if (!week) return;
                const idx = decBtn.dataset.goal;
                const entry = week.entries[idx] ?? week.entries[parseInt(idx)];
                if (!entry) return;
                // Manual adjustments can go negative to cancel inferred misses; the total never drops below 0
                if (this.scoreEntry(week, entry).misses > 0) entry.manual = (entry.manual || 0) - 1;
                this.saveData();
                this.renderGoals();
                return;
            }
            const th = e.target.closest('.day-header');
            if (th) {
                const dayIdx = parseInt(th.dataset.day);
                const w = this.getCurrentWeek();
                if (!w) return;
                if (!w.vacationDays) w.vacationDays = [];
                const isVac = w.vacationDays.includes(dayIdx);
                w.vacationDays = isVac
                    ? w.vacationDays.filter(d => d !== dayIdx)
                    : [...w.vacationDays, dayIdx].sort();
                w.vacation = w.vacationDays.length === 7;
                this.saveData();
                this.renderGoals();
            }
        });

        document.getElementById('vacationWeekBtn').addEventListener('click', () => {
            const week = this.getCurrentWeek();
            if (!week) return;
            // Toggle: full week vacation flips all 7 days
            if (!week.vacationDays) week.vacationDays = [];
            const allVacation = week.vacationDays.length === 7;
            week.vacationDays = allVacation ? [] : [0,1,2,3,4,5,6];
            // Keep legacy vacation flag in sync
            week.vacation = !allVacation;
            this.saveData();
            this.logActivity(week.vacation ? 'Marked full week as vacation' : 'Removed vacation from week');
            this.renderGoals();
        });
    }

    renderGoals() {
        this.updateAppBadge();
        const week = this.getCurrentWeek();
        if (!week) {
            document.getElementById('goalsGrid').innerHTML = '<div class="empty-state">No weeks yet. Click "+ New Week" to start.</div>';
            return;
        }

        // Week label + vacation indicator
        const vacDays = week.vacationDays || (week.vacation ? [0,1,2,3,4,5,6] : []);
        const isFullVacation = vacDays.length === 7;
        document.getElementById('currentWeekLabel').textContent = (isFullVacation ? '🏖️ ' : '') + this.formatWeekDate(week.startDate);
        const vacBtn = document.getElementById('vacationWeekBtn');
        vacBtn.textContent = isFullVacation ? '✓ Full Vacation' : '🏖️ Vacation';
        vacBtn.className = `btn btn-sm ${isFullVacation ? 'btn-primary' : 'btn-secondary'}`;

        // Build table
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekVacDays = week.vacationDays || (week.vacation ? [0,1,2,3,4,5,6] : []);
        let html = '<table><thead><tr><th>Goal</th>';
        days.forEach((d, i) => {
            const isVac = weekVacDays.includes(i);
            html += `<th class="day-header${isVac ? ' vac-header' : ''}" data-day="${i}" title="${isVac ? 'Click to remove vacation' : 'Click to mark as vacation'}">${isVac ? '🏖️' : d}</th>`;
        });
        html += '<th>Strikes</th></tr></thead><tbody>';

        // Group by category
        const grouped = {};
        Object.entries(week.entries).forEach(([idx, entry]) => {
            const cat = entry.goal.category;
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ idx: parseInt(idx), ...entry });
        });

        let grandTotal = 0;
        for (const [cat, entries] of Object.entries(grouped)) {
            html += `<tr><td class="cat-header" colspan="${days.length + 2}">${cat}</td></tr>`;
            let catTotal = 0;
            entries.forEach(entry => {
                html += `<tr><td class="goal-name-cell">${this.escapeHtml(entry.goal.name)}</td>`;
                const goalDays = this.getGoalDays(entry.goal);
                entry.tracking.forEach((val, dayIdx) => {
                    let cls = 'day-cell';
                    let display = '';
                    if (weekVacDays.includes(dayIdx)) {
                        cls += ' vacation-day';
                        display = '🏖️';
                    } else if (val === 'X' || val === 'x') {
                        cls += ' completed';
                        display = '\u2713';
                    } else if (val === '1') {
                        cls += ' missed';
                        display = '\u2717';
                    } else if (val === '-') {
                        cls += ' skipped';
                        display = '\u2013';
                    } else if (val === '' && !goalDays.includes(dayIdx)) {
                        cls += ' off-day';
                    } else if (this.isInferredMiss(week, entry, dayIdx)) {
                        cls += ' inferred-miss';
                        display = '\u2717';
                    }
                    html += `<td class="${cls}" data-goal="${entry.idx}" data-day="${dayIdx}">${display}</td>`;
                });
                const totalStrikes = this.scoreEntry(week, entry).misses;
                catTotal += totalStrikes;
                grandTotal += totalStrikes;
                const decBtn = totalStrikes > 0 ? `<button class="strike-dec" data-goal="${entry.idx}">−</button>` : '';
                html += `<td class="strike-count strike-cell" data-goal="${entry.idx}">
                    ${decBtn}<span class="strike-num">${totalStrikes > 0 ? totalStrikes : ''}</span><button class="strike-inc" data-goal="${entry.idx}">+</button>
                </td></tr>`;
            });
            // Category subtotal row
            html += `<tr class="subtotal-row"><td colspan="${days.length + 1}" class="subtotal-label">${cat} subtotal</td><td class="strike-count subtotal-val">${catTotal > 0 ? catTotal : '—'}</td></tr>`;
        }

        // Grand total row
        html += `<tr class="grand-total-row"><td colspan="${days.length + 1}" class="grand-total-label">Total Strikes This Week</td><td class="strike-count grand-total-val">${grandTotal > 0 ? grandTotal : '0'}</td></tr>`;
        html += '</tbody></table>';
        document.getElementById('goalsGrid').innerHTML = html;

        this.renderGoalCharts();
        this.renderGoalsList();
    }

    toggleGoalCell(goalIdx, dayIdx) {
        const week = this.getCurrentWeek();
        if (!week) return;
        // Entries may be keyed as strings or integers depending on import source
        const entry = week.entries[goalIdx] ?? week.entries[String(goalIdx)];
        if (!entry) return;

        // Cycle: empty → ✓ done → ✗ strike → – skipped (doesn't apply) → empty
        const current = entry.tracking[dayIdx];
        if (current === '') {
            entry.tracking[dayIdx] = 'X';
        } else if (current === 'X' || current === 'x') {
            entry.tracking[dayIdx] = '1';
        } else if (current === '-') {
            entry.tracking[dayIdx] = '';
        } else {
            entry.tracking[dayIdx] = '-';
        }

        this.saveData();
        this.renderGoals();
    }

    renderGoalCharts() {
        // Strikes over time
        const labels = [];
        const strikesData = [];
        this.data.weeks.slice(-12).forEach(week => {
            const d = new Date(week.startDate);
            labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            strikesData.push(this.scoreWeek(week).misses);
        });

        const strikesCanvas = document.getElementById('goalStrikesChart');
        if (this.charts.goalStrikes) this.charts.goalStrikes.destroy();
        this.charts.goalStrikes = new Chart(strikesCanvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Strikes',
                    data: strikesData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Category performance
        const week = this.getCurrentWeek();
        const catStats = week ? this.scoreByCategory(week) : {};

        const catLabels = Object.keys(catStats);
        const catPcts = catLabels.map(c => this.scorePct(catStats[c]));

        const catCanvas = document.getElementById('goalCategoryChart');
        if (this.charts.goalCategory) this.charts.goalCategory.destroy();
        this.charts.goalCategory = new Chart(catCanvas, {
            type: 'bar',
            data: {
                labels: catLabels,
                datasets: [{
                    label: 'Completion %',
                    data: catPcts,
                    backgroundColor: ['#ef4444', '#8b5cf6', '#22c55e', '#3b82f6', '#f59e0b', '#f97316', '#6b7280']
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, max: 100 }
                }
            }
        });
    }

    renderGoalsList() {
        const container = document.getElementById('goalsList');
        const grouped = {};
        this.data.goals.forEach((goal, i) => {
            if (!grouped[goal.category]) grouped[goal.category] = [];
            grouped[goal.category].push({ ...goal, index: i });
        });

        const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const cats = Object.keys(grouped);

        let html = '<p class="setting-desc">Tap the day letters to set which days each goal applies to. Greyed-out days don\'t count against you.</p>';
        cats.forEach((cat, catIdx) => {
            html += `<div class="goal-category-group">
                <h4><span>${this.escapeHtml(cat)}</span>
                    <span class="cat-days-actions">
                        <button class="cat-days-btn" data-cat-idx="${catIdx}" data-cat-days="weekdays">Mon–Fri</button>
                        <button class="cat-days-btn" data-cat-idx="${catIdx}" data-cat-days="all">Every day</button>
                    </span>
                </h4>`;
            grouped[cat].forEach(g => {
                const activeDays = this.getGoalDays(g);
                const chips = dayLetters.map((letter, d) =>
                    `<button class="day-chip${activeDays.includes(d) ? ' on' : ''}" data-goal-idx="${g.index}" data-day="${d}" title="${dayNames[d]}">${letter}</button>`
                ).join('');
                html += `<div class="goal-list-item">
                    <span class="goal-list-name">${this.escapeHtml(g.name)} ${g.target ? '(' + this.escapeHtml(g.target) + ')' : ''}</span>
                    <div class="goal-list-actions">
                        <div class="day-chips">${chips}</div>
                        <button class="goal-remove-btn" data-remove-goal="${g.index}">Remove</button>
                    </div>
                </div>`;
            });
            html += '</div>';
        });
        container.innerHTML = html;

        // Toggle a single day on a goal's schedule
        container.querySelectorAll('.day-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const goalIdx = parseInt(chip.dataset.goalIdx);
                const day = parseInt(chip.dataset.day);
                const days = new Set(this.getGoalDays(this.data.goals[goalIdx]));
                if (days.has(day)) {
                    if (days.size === 1) return; // a goal needs at least one day
                    days.delete(day);
                } else {
                    days.add(day);
                }
                this.setGoalDays(goalIdx, days);
                this.saveData();
                this.renderGoals();
            });
        });

        // Apply Mon–Fri or every day to a whole category
        container.querySelectorAll('.cat-days-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = cats[parseInt(btn.dataset.catIdx)];
                const days = btn.dataset.catDays === 'weekdays' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
                grouped[cat].forEach(g => this.setGoalDays(g.index, days));
                this.saveData();
                this.logActivity(`Set ${cat} to ${btn.dataset.catDays === 'weekdays' ? 'Mon–Fri' : 'every day'}`);
                this.renderGoals();
            });
        });

        // Bind remove buttons
        container.querySelectorAll('[data-remove-goal]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.removeGoal);
                if (confirm('Remove this goal?')) {
                    this.data.goals.splice(idx, 1);
                    this.saveData();
                    this.logActivity('Removed a goal');
                    this.renderGoals();
                }
            });
        });
    }

    importFromAccountabilityTracker() {
        try {
            const raw = localStorage.getItem('accountabilityData');
            if (!raw) {
                alert('No accountability tracker data found in LocalStorage (key: accountabilityData).');
                return;
            }
            const trackerData = JSON.parse(raw);
            let importedItems = [];

            // Import goals - handle various formats
            if (trackerData.goals && Array.isArray(trackerData.goals)) {
                this.data.goals = trackerData.goals.map(g => ({
                    category: g.category || 'Other',
                    name: g.name || g.title || g.goal || 'Unnamed Goal',
                    target: g.target || g.frequency || ''
                }));
                importedItems.push(`${this.data.goals.length} goals`);
            }

            // Import weeks - normalize entries structure
            if (trackerData.weeks && Array.isArray(trackerData.weeks)) {
                this.data.weeks = trackerData.weeks.map(w => {
                    const week = {
                        startDate: w.startDate || w.start || w.date || new Date().toISOString(),
                        entries: {}
                    };
                    // Handle entries as object or array
                    const entries = w.entries || w.data || {};
                    if (Array.isArray(entries)) {
                        entries.forEach((entry, idx) => {
                            week.entries[idx] = {
                                goal: entry.goal || { category: 'Other', name: 'Goal ' + idx },
                                tracking: Array.isArray(entry.tracking) ? entry.tracking : ['', '', '', '', '', '', '']
                            };
                        });
                    } else {
                        Object.entries(entries).forEach(([key, entry]) => {
                            week.entries[key] = {
                                goal: entry.goal || { category: 'Other', name: 'Goal ' + key },
                                tracking: Array.isArray(entry.tracking) ? entry.tracking : ['', '', '', '', '', '', '']
                            };
                        });
                    }
                    return week;
                });
                importedItems.push(`${this.data.weeks.length} weeks`);
            }

            if (trackerData.categories && Array.isArray(trackerData.categories)) {
                this.data.categories = trackerData.categories;
            }

            this.saveData();
            this.logActivity('Imported data from Accountability Tracker');
            this.renderGoals();
            alert(importedItems.length > 0
                ? `Imported: ${importedItems.join(', ')} from Accountability Tracker!`
                : 'No data found to import.');
        } catch (e) {
            alert('Error importing data: ' + e.message);
        }
    }

    // ========================================
    // Health Section
    // ========================================
    bindHealthLog() {
        document.getElementById('logWeightBtn').addEventListener('click', () => {
            const val = parseFloat(document.getElementById('weightInput').value);
            if (isNaN(val)) return;
            this.logHealthMetric('weight', val);
            document.getElementById('weightInput').value = '';
        });

        document.getElementById('logSleepBtn').addEventListener('click', () => {
            const val = parseFloat(document.getElementById('sleepInput').value);
            if (isNaN(val)) return;
            this.logHealthMetric('sleep', val);
            document.getElementById('sleepInput').value = '';
        });

        document.getElementById('energyButtons').addEventListener('click', (e) => {
            if (e.target.classList.contains('energy-btn')) {
                document.querySelectorAll('.energy-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.logHealthMetric('energy', parseInt(e.target.dataset.level));
            }
        });
    }

    logHealthMetric(type, value) {
        const today = this.getTodayStr();
        let entry = this.data.healthLog.find(e => e.date === today);
        if (!entry) {
            entry = { date: today };
            this.data.healthLog.push(entry);
        }
        entry[type] = value;
        this.saveData();
        this.logActivity(`Logged ${type}: ${value}`);
        this.renderHealth();
    }

    renderHealth() {
        this.renderHealthRings();
        this.renderHealthCharts();
    }

    renderHealthRings() {
        const week = this.getCurrentWeek();
        if (!week) return;

        const scored = name => Object.values(week.entries)
            .filter(e => e.goal.name.includes(name))
            .map(e => this.scoreEntry(week, e));

        // Workouts (Strength + Cardio): progress toward the weekly targets — only ✓ count
        let workouts = 0, workoutTarget = 0;
        [...scored('Strength'), ...scored('Cardio')].forEach(s => {
            workouts += Math.min(s.checks, s.target);
            workoutTarget += s.target;
        });
        document.getElementById('workoutCount').textContent = `${workouts}/${workoutTarget}`;
        this.drawRing('workoutRing', workouts / Math.max(workoutTarget, 1), '#ef4444');

        // Sleep (bedtime) and mindfulness (Meditate): nights done of nights expected so far
        const ring = (name, countId, ringId, color) => {
            const s = scored(name)[0] || { done: 0, expected: 0 };
            document.getElementById(countId).textContent = `${s.done}/${s.expected}`;
            this.drawRing(ringId, s.done / Math.max(s.expected, 1), color);
        };
        ring('bed by', 'sleepScore', 'sleepRing', '#3b82f6');
        ring('Meditate', 'mindfulCount', 'mindfulRing', '#8b5cf6');

        // Substances (Zyns + alcohol) — limits: at/under the max = 100%
        const subst = [...scored('Zyn'), ...scored('drink')].reduce(
            (a, s) => ({ done: a.done + s.done, expected: a.expected + s.expected }), { done: 0, expected: 0 });
        const substPct = this.scorePct(subst);
        document.getElementById('substanceScore').textContent = substPct + '%';
        this.drawRing('substanceRing', substPct / 100, '#22c55e');
    }

    drawRing(canvasId, progress, color) {
        const canvas = document.getElementById(canvasId);
        if (this.charts[canvasId]) this.charts[canvasId].destroy();
        this.charts[canvasId] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [Math.min(progress, 1) * 100, Math.max((1 - progress), 0) * 100],
                    backgroundColor: [color, '#f1f5f9'],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '75%',
                responsive: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
    }

    renderHealthCharts() {
        const logs = this.data.healthLog.slice(-30);

        // Weight trend
        const weightLogs = logs.filter(l => l.weight);
        const weightCanvas = document.getElementById('weightChart');
        if (this.charts.weight) this.charts.weight.destroy();
        if (weightLogs.length > 0) {
            this.charts.weight = new Chart(weightCanvas, {
                type: 'line',
                data: {
                    labels: weightLogs.map(l => l.date),
                    datasets: [{
                        label: 'Weight (lbs)',
                        data: weightLogs.map(l => l.weight),
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99,102,241,0.1)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } }
                }
            });
        }

        // Sleep trend
        const sleepLogs = logs.filter(l => l.sleep);
        const sleepCanvas = document.getElementById('sleepChart');
        if (this.charts.sleep) this.charts.sleep.destroy();
        if (sleepLogs.length > 0) {
            this.charts.sleep = new Chart(sleepCanvas, {
                type: 'bar',
                data: {
                    labels: sleepLogs.map(l => l.date),
                    datasets: [{
                        label: 'Hours',
                        data: sleepLogs.map(l => l.sleep),
                        backgroundColor: sleepLogs.map(l => l.sleep >= 7 ? '#22c55e' : l.sleep >= 6 ? '#f59e0b' : '#ef4444'),
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, max: 12 } }
                }
            });
        }
    }

    // ========================================
    // Habits Section (Daily Protocols + Ad-Hoc Tasks)
    // ========================================
    bindHabits() {
        document.getElementById('addHabitBtn').addEventListener('click', () => this.openModal('addGoalModal'));

        // Delegated: habit checkbox clicks — bound once, survives re-renders
        document.getElementById('habitsChecklist').addEventListener('click', (e) => {
            // Remember whether the "Doesn't apply today" section is open across re-renders
            const summary = e.target.closest('.off-today summary');
            if (summary) {
                this._offTodayOpen = !summary.parentElement.open;
                return;
            }
            const btn = e.target.closest('.habit-checkbox, .habit-skip-btn, .habit-unskip-btn');
            if (!btn) return;
            const week = this.getTodayWeek();
            if (!week) return;
            const entryIdx = btn.dataset.entryIdx;
            const dayIdx = parseInt(btn.dataset.day);
            const entry = week.entries[entryIdx] ?? week.entries[parseInt(entryIdx)];
            if (!entry) return;
            const current = entry.tracking[dayIdx];
            if (btn.classList.contains('habit-skip-btn')) {
                entry.tracking[dayIdx] = '-';
            } else if (btn.classList.contains('habit-unskip-btn')) {
                entry.tracking[dayIdx] = '';
            } else {
                entry.tracking[dayIdx] = (current === 'X' || current === 'x') ? '' : 'X';
            }
            this.saveData();
            this.renderHabits();
        });

        document.getElementById('vacationDayBtn').addEventListener('click', () => {
            const week = this.getTodayWeek();
            if (!week) return;
            if (!week.vacationDays) week.vacationDays = [];
            const todayIdx = new Date().getDay();
            const isVacation = week.vacationDays.includes(todayIdx);
            if (isVacation) {
                week.vacationDays = week.vacationDays.filter(d => d !== todayIdx);
            } else {
                week.vacationDays.push(todayIdx);
            }
            // Keep legacy week.vacation in sync (true only if all 7 days are vacation)
            week.vacation = week.vacationDays.length === 7;
            this.saveData();
            this.logActivity(isVacation ? 'Removed travel day' : 'Marked today as travel day');
            this.renderHabits();
        });

        // Ad-hoc tasks
        document.getElementById('addAdhocTaskBtn').addEventListener('click', () => this.addAdhocTask());
        document.getElementById('adhocTaskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addAdhocTask();
        });
    }

    addAdhocTask() {
        const input = document.getElementById('adhocTaskInput');
        const text = input.value.trim();
        if (!text) return;

        if (!this.data.adhocTasks) this.data.adhocTasks = [];

        const weekStart = this.getWeekStartDate();
        this.data.adhocTasks.push({
            id: 'task_' + Date.now(),
            text: text,
            completed: false,
            weekStart: weekStart.toISOString(),
            created: new Date().toISOString()
        });

        input.value = '';
        this.saveData();
        this.logActivity(`Added task: ${text}`);
        this.renderAdhocTasks();
    }

    renderAdhocTasks() {
        const container = document.getElementById('adhocTasksList');
        if (!this.data.adhocTasks) this.data.adhocTasks = [];

        // Show tasks for current week
        const weekStart = this.getWeekStartDate();
        const weekTasks = this.data.adhocTasks.filter(t => {
            const taskWeek = new Date(t.weekStart);
            return taskWeek.toDateString() === weekStart.toDateString();
        });

        if (weekTasks.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:12px;font-size:0.85rem;">No ad-hoc tasks this week. Add tasks above.</div>';
            return;
        }

        container.innerHTML = weekTasks.map(t => `
            <div class="adhoc-task-item ${t.completed ? 'completed' : ''}">
                <div class="habit-checkbox ${t.completed ? 'checked' : ''}" data-adhoc="${t.id}">${t.completed ? '\u2713' : ''}</div>
                <span class="adhoc-task-text ${t.completed ? 'completed' : ''}">${this.escapeHtml(t.text)}</span>
                <button class="adhoc-delete" data-delete-adhoc="${t.id}">&times;</button>
            </div>
        `).join('');

        container.querySelectorAll('[data-adhoc]').forEach(cb => {
            cb.addEventListener('click', () => {
                const task = this.data.adhocTasks.find(t => t.id === cb.dataset.adhoc);
                if (task) {
                    task.completed = !task.completed;
                    this.saveData();
                    this.renderAdhocTasks();
                }
            });
        });

        container.querySelectorAll('[data-delete-adhoc]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.data.adhocTasks = this.data.adhocTasks.filter(t => t.id !== btn.dataset.deleteAdhoc);
                this.saveData();
                this.renderAdhocTasks();
            });
        });
    }

    // Classify a goal's target into a frequency bucket
    classifyFrequency(target) {
        if (!target) return { group: 'daily', label: 'Daily', perWeek: 7 };
        const t = target.toLowerCase().trim();
        if (t === 'daily') return { group: 'daily', label: 'Every day', perWeek: 7 };
        if (t === 'weekdays' || t === 'weeknights') return { group: 'daily', label: 'Weekdays', perWeek: 5 };
        if (t === 'weekly') return { group: 'weekly', label: '1x/week', perWeek: 1 };
        if (t === 'monthly') return { group: 'monthly', label: 'Monthly', perWeek: 0.25 };
        // Parse "x1", "x2", "x1 max", "x2 max" etc.
        const xMatch = t.match(/x(\d+)/);
        if (xMatch) {
            const n = parseInt(xMatch[1]);
            const isMax = t.includes('max');
            if (isMax) return { group: 'limit', label: `${n}x max/week`, perWeek: n, isLimit: true };
            if (n <= 1) return { group: 'weekly', label: '1x/week', perWeek: 1 };
            return { group: 'fewPerWeek', label: `${n}x/week`, perWeek: n };
        }
        return { group: 'daily', label: target, perWeek: 7 };
    }

    renderHabits() {
        this.updateAppBadge();
        document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
        });

        const checklist = document.getElementById('habitsChecklist');
        const week = this.getTodayWeek();

        if (!week) {
            checklist.innerHTML = '<div class="empty-state">No active week. Go to Goals and click "+ New Week" first.</div>';
            this.renderAdhocTasks();
            return;
        }

        const todayDayIdx = new Date().getDay();

        // Travel day state
        const vacationDays = week.vacationDays || (week.vacation ? [0,1,2,3,4,5,6] : []);
        const isTravelDay = vacationDays.includes(todayDayIdx);
        const vacBtn = document.getElementById('vacationDayBtn');
        if (vacBtn) {
            vacBtn.textContent = isTravelDay ? '✓ Travel Day' : '🏖️ Travel Day';
            vacBtn.className = `vacation-day-btn${isTravelDay ? ' active' : ''}`;
        }

        if (isTravelDay) {
            checklist.innerHTML = `<div class="travel-day-notice">🏖️ <strong>Travel day!</strong> Streaks are preserved — enjoy your time off.</div>`;
            this.renderAdhocTasks();
            this.renderStreaks();
            this.renderHeatmap();
            return;
        }

        // Precompute streaks for badge display
        const streakMap = {};
        Object.values(week.entries).forEach(entry => {
            streakMap[entry.goal.name] = this.calculateGoalStreak(entry.goal.name);
        });

        // Build entries with frequency info
        const allEntries = [];
        const now = new Date();
        Object.entries(week.entries).forEach(([idx, entry]) => {
            // Group by the scoring rule: Budgeting is a limit, a custom day schedule makes a goal daily
            let freq = this.classifyFrequency(entry.goal.target);
            const kind = this.scoringKind(entry.goal);
            if (kind === 'limit' && !freq.isLimit) freq = { ...freq, group: 'limit', label: `${freq.perWeek}x max/week`, isLimit: true };
            else if (kind === 'daily' && freq.group !== 'daily') freq = { ...freq, group: 'daily' };
            const weekDone = entry.tracking.filter(v => v === 'X' || v === 'x').length;
            const weekStrikes = entry.tracking.filter(v => v === '1').length;
            const todayVal = entry.tracking[todayDayIdx];
            const todayDone = todayVal === 'X' || todayVal === 'x';
            const todayStrike = todayVal === '1';
            const todaySkipped = todayVal === '-';
            // Not scheduled today and untouched → off today (checking it anyway still counts)
            const offSchedule = !this.getGoalDays(entry.goal).includes(todayDayIdx) && todayVal === '';
            allEntries.push({
                idx: parseInt(idx),
                ...entry,
                freq,
                weekDone,
                weekStrikes,
                monthDone: kind === 'monthly' && this.isMonthlyDone(entry.goal.name, now.getFullYear(), now.getMonth()),
                todayDone,
                todayStrike,
                todaySkipped,
                offToday: todaySkipped || offSchedule
            });
        });

        // Define frequency groups in display order
        const groups = [
            { key: 'daily', title: 'Daily Essentials', icon: '&#9788;', desc: 'Do these every day' },
            { key: 'fewPerWeek', title: 'A Few Times This Week', icon: '&#8635;', desc: 'Hit your target this week' },
            { key: 'weekly', title: 'Weekly Goals', icon: '&#9733;', desc: 'Complete once this week' },
            { key: 'limit', title: 'Limits & Boundaries', icon: '&#9888;', desc: 'Stay within these limits' },
            { key: 'monthly', title: 'Monthly Goals', icon: '&#128197;', desc: 'Once this month' }
        ];

        let html = '';
        groups.forEach(group => {
            const entries = allEntries.filter(e => e.freq.group === group.key && !e.offToday);
            if (entries.length === 0) return;

            // Calculate group-level progress
            const todayChecked = entries.filter(e => e.todayDone || e.todayStrike).length;
            const groupTotal = entries.length;

            html += `<div class="freq-group">
                <div class="freq-group-header">
                    <div class="freq-group-title">
                        <span class="freq-icon">${group.icon}</span>
                        <span class="freq-label">${group.title}</span>
                    </div>
                    <span class="freq-group-count">${todayChecked}/${groupTotal}</span>
                </div>`;

            // Sub-group by category within each frequency group
            const byCat = {};
            entries.forEach(e => {
                const cat = e.goal.category;
                if (!byCat[cat]) byCat[cat] = [];
                byCat[cat].push(e);
            });

            // Protocol categories first, then alphabetical
            const protocolOrder = ['Morning Protocol', 'Midday Protocol', 'Evening Protocol'];
            const catKeys = [...protocolOrder.filter(c => byCat[c]), ...Object.keys(byCat).filter(c => !protocolOrder.includes(c)).sort()];

            catKeys.forEach(cat => {
                const catEntries = byCat[cat];
                if (catEntries.length > 1 || Object.keys(byCat).length > 1) {
                    html += `<div class="freq-cat-label">${cat}</div>`;
                }
                catEntries.forEach(entry => {
                    const done = entry.todayDone;
                    const isLimit = entry.freq.isLimit;

                    // Streak badge
                    const streak = streakMap[entry.goal.name] || 0;
                    let badgeHtml = '';
                    if (streak >= 30) badgeHtml = `<span class="streak-badge crown" title="${streak}-day streak">👑 ${streak}</span>`;
                    else if (streak >= 14) badgeHtml = `<span class="streak-badge diamond" title="${streak}-day streak">💎 ${streak}</span>`;
                    else if (streak >= 7) badgeHtml = `<span class="streak-badge star" title="${streak}-day streak">⭐ ${streak}</span>`;
                    else if (streak >= 3) badgeHtml = `<span class="streak-badge fire" title="${streak}-day streak">🔥 ${streak}</span>`;

                    // Weekly progress bar
                    let progressHtml = '';
                    if (group.key !== 'daily') {
                        const target = entry.freq.perWeek;
                        if (isLimit) {
                            // For limits: show usage vs max (red when over)
                            const used = entry.weekDone + entry.weekStrikes;
                            const over = used > target;
                            progressHtml = `<span class="freq-progress ${over ? 'over-limit' : 'under-limit'}">${used}/${target} used</span>`;
                        } else if (group.key === 'monthly') {
                            progressHtml = `<span class="freq-progress ${entry.monthDone ? 'on-track' : ''}">${entry.monthDone ? 'Done' : 'Not yet'}</span>`;
                        } else {
                            const pct = Math.min(100, Math.round((entry.weekDone / target) * 100));
                            const met = entry.weekDone >= target;
                            progressHtml = `<span class="freq-progress ${met ? 'on-track' : ''}">${entry.weekDone}/${target}</span>
                                <div class="freq-progress-bar"><div class="freq-progress-fill ${met ? 'met' : ''}" style="width:${pct}%"></div></div>`;
                        }
                    }

                    html += `<div class="habit-check-item ${done ? 'item-done' : ''}">
                        <div class="habit-checkbox ${done ? 'checked' : ''}" data-entry-idx="${entry.idx}" data-day="${todayDayIdx}">${done ? '\u2713' : ''}</div>
                        <div class="habit-item-content">
                            <div class="habit-name-row">
                                <span class="habit-name ${done ? 'completed' : ''}">${this.escapeHtml(entry.goal.name)}</span>
                                ${badgeHtml}
                            </div>
                            ${progressHtml}
                        </div>
                        <button class="habit-skip-btn" data-entry-idx="${entry.idx}" data-day="${todayDayIdx}" title="Doesn't apply today">Skip</button>
                    </div>`;
                });
            });

            html += '</div>';
        });

        // Items skipped today or not scheduled today, collapsed at the bottom
        const offEntries = allEntries.filter(e => e.offToday);
        if (offEntries.length > 0) {
            const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            html += `<details class="off-today"${this._offTodayOpen ? ' open' : ''}>
                <summary>Doesn't apply today <span class="off-today-count">${offEntries.length}</span></summary>`;
            offEntries.forEach(entry => {
                const reason = entry.todaySkipped ? 'Skipped' : `Not on ${dayName}s`;
                const action = entry.todaySkipped
                    ? `<button class="habit-unskip-btn" data-entry-idx="${entry.idx}" data-day="${todayDayIdx}">Undo</button>`
                    : '';
                html += `<div class="habit-check-item off-item">
                    <div class="habit-checkbox" data-entry-idx="${entry.idx}" data-day="${todayDayIdx}" title="Did it anyway"></div>
                    <div class="habit-item-content">
                        <span class="habit-name">${this.escapeHtml(entry.goal.name)}</span>
                        <span class="off-reason">${reason}</span>
                    </div>
                    ${action}
                </div>`;
            });
            html += `<p class="off-today-hint">Set recurring days for a goal under Goals &rarr; Manage Goals.</p></details>`;
        }

        checklist.innerHTML = html;

        this.renderAdhocTasks();
        this.renderStreaks();
        this.renderHeatmap();
    }

    calculateGoalStreak(goalName) {
        // Count consecutive days completed going backward from today, across all weeks
        const sortedWeeks = [...this.data.weeks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        if (sortedWeeks.length === 0) return 0;

        let streak = 0;
        let weekIdx = sortedWeeks.length - 1;
        const todayIdx = new Date().getDay();
        let dayIdx = todayIdx;

        while (weekIdx >= 0) {
            const week = sortedWeeks[weekIdx];
            const vacDays = week.vacationDays || (week.vacation ? [0,1,2,3,4,5,6] : []);

            const entry = Object.values(week.entries).find(e => e.goal.name === goalName);
            if (!entry) break;

            for (let d = dayIdx; d >= 0; d--) {
                // Skip vacation days — don't break or count
                if (vacDays.includes(d)) continue;
                const val = entry.tracking[d];
                if (val === 'X' || val === 'x') {
                    streak++;
                } else if (!this.isExpected(week, entry, d)) {
                    continue; // skipped or not scheduled that day — doesn't break the streak
                } else if (weekIdx === sortedWeeks.length - 1 && d === todayIdx) {
                    continue; // today is still in progress
                } else {
                    return streak;
                }
            }
            weekIdx--;
            dayIdx = 6;
        }
        return streak;
    }

    renderStreaks() {
        const container = document.getElementById('streaksGrid');
        if (this.data.weeks.length === 0) { container.innerHTML = ''; return; }

        const week = this.getTodayWeek();
        if (!week) { container.innerHTML = ''; return; }

        const streaks = [];
        Object.values(week.entries).forEach(entry => {
            const streak = this.calculateGoalStreak(entry.goal.name);
            if (streak > 0) streaks.push({ name: entry.goal.name, streak });
        });

        streaks.sort((a, b) => b.streak - a.streak);

        container.innerHTML = streaks.slice(0, 10).map(s => `
            <div class="streak-card">
                <div class="streak-count">${s.streak}</div>
                <div class="streak-label">${s.streak === 1 ? 'day' : 'days'}</div>
                <div class="streak-name">${this.escapeHtml(s.name)}</div>
            </div>
        `).join('') || '<div class="empty-state" style="padding:12px;font-size:0.85rem;">Start checking off items to build streaks.</div>';
    }

    renderHeatmap() {
        const container = document.getElementById('habitHeatmap');
        const week = this.getTodayWeek();
        if (!week) { container.innerHTML = ''; return; }

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayDayIdx = new Date().getDay();

        // Show heatmap for daily items only (keeps it readable)
        let html = '';
        Object.entries(week.entries).forEach(([idx, entry]) => {
            if (this.scoringKind(entry.goal) !== 'daily') return;
            html += `<div class="heatmap-row">
                <span class="heatmap-label">${this.escapeHtml(entry.goal.name)}</span>
                <div class="heatmap-cells">`;
            for (let i = 0; i < 7; i++) {
                const val = entry.tracking[i];
                const done = val === 'X' || val === 'x';
                const strike = val === '1';
                const isToday = i === todayDayIdx;
                const cls = done ? 'done'
                    : strike ? 'strike'
                    : !this.isExpected(week, entry, i) ? 'off'
                    : (i < todayDayIdx ? 'missed' : '');
                html += `<div class="heatmap-cell ${cls} ${isToday ? 'today' : ''}" title="${days[i]}">${days[i][0]}</div>`;
            }
            html += '</div></div>';
        });

        container.innerHTML = html || '<div class="empty-state" style="padding:12px;font-size:0.85rem;">No daily items found.</div>';
    }

    // ========================================
    // Evening Reflection (Stoic Journal)
    // ========================================
    bindJournal() {
        document.getElementById('saveEveningReflectionBtn').addEventListener('click', () => this.saveEveningReflection());

        // Bind values rating buttons
        document.getElementById('stoicValuesRating').addEventListener('click', (e) => {
            if (e.target.classList.contains('rating-btn')) {
                document.querySelectorAll('#stoicValuesRating .rating-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    }

    saveEveningReflection() {
        const wentWell = document.getElementById('stoicWentWell')?.value?.trim();
        const fellShort = document.getElementById('stoicFellShort')?.value?.trim();
        const gratitude = document.getElementById('stoicGratitude')?.value?.trim();
        const intention = document.getElementById('stoicIntention')?.value?.trim();

        const ratingBtn = document.querySelector('#stoicValuesRating .rating-btn.active');
        const valuesRating = ratingBtn ? parseInt(ratingBtn.dataset.rating) : null;

        if (!wentWell && !fellShort && !gratitude) {
            alert('Please fill in at least one reflection field.');
            return;
        }

        const reflection = {
            date: this.getTodayStr(),
            timestamp: new Date().toISOString(),
            wentWell,
            fellShort,
            gratitude,
            valuesRating,
            intention
        };

        this.data.eveningReflections.unshift(reflection);

        // Also save as a journal entry for unified history
        this.data.journalEntries.unshift({
            date: this.getTodayStr(),
            timestamp: new Date().toISOString(),
            text: `**What went well:** ${wentWell || '-'}\n\n**Where I fell short:** ${fellShort || '-'}\n\n**Gratitude:** ${gratitude || '-'}\n\n**Values Rating:** ${valuesRating || '-'}/10\n\n**Tomorrow's Intention:** ${intention || '-'}`,
            mood: valuesRating >= 7 ? 'good' : valuesRating >= 5 ? 'okay' : 'low',
            type: 'stoic'
        });

        this.saveData();
        this.logActivity('Completed evening reflection');

        // Clear form
        ['stoicWentWell', 'stoicFellShort', 'stoicGratitude', 'stoicIntention'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.querySelectorAll('#stoicValuesRating .rating-btn').forEach(b => b.classList.remove('active'));

        this.renderJournal();
        alert('Evening reflection saved!');
    }

    renderJournal() {
        const container = document.getElementById('journalEntriesList');
        const entries = this.data.eveningReflections;

        if (!entries || entries.length === 0) {
            container.innerHTML = '<div class="empty-state">Complete your first evening reflection to see your history.</div>';
            return;
        }

        container.innerHTML = entries.slice(0, 20).map(entry => {
            const dateStr = entry.timestamp
                ? new Date(entry.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : entry.date;

            return `<div class="journal-entry-card" style="border-left-color:var(--secondary)">
                <div class="journal-entry-header">
                    <span class="journal-entry-date">${dateStr}</span>
                    ${entry.valuesRating ? `<span class="journal-entry-mood">Values: ${entry.valuesRating}/10</span>` : ''}
                </div>
                <div class="journal-entry-text">
                    ${entry.wentWell ? `<p><strong>Went well:</strong> ${this.escapeHtml(entry.wentWell)}</p>` : ''}
                    ${entry.fellShort ? `<p><strong>Fell short:</strong> ${this.escapeHtml(entry.fellShort)}</p>` : ''}
                    ${entry.gratitude ? `<p><strong>Grateful for:</strong> ${this.escapeHtml(entry.gratitude)}</p>` : ''}
                    ${entry.intention ? `<p><strong>Tomorrow:</strong> ${this.escapeHtml(entry.intention)}</p>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    // ========================================
    // Weekly Review Section
    // ========================================
    bindReview() {
        document.getElementById('saveReviewBtn').addEventListener('click', () => this.saveWeeklyReview());

        // Rating buttons
        document.getElementById('weekRating').addEventListener('click', (e) => {
            if (e.target.classList.contains('rating-btn')) {
                document.querySelectorAll('#weekRating .rating-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    }

    renderReview() {
        const week = this.getCurrentWeek();
        if (week) {
            document.getElementById('reviewWeekDate').textContent = this.formatWeekDate(week.startDate);
        }

        // Strike summary
        this.renderStrikeSummary();

        // Review scores from current week
        this.renderReviewScores();
        this.renderPastReviews();
    }

    generateStrikeSummary(week) {
        if (!week) return null;

        // Collect strikes per goal (key by entry index since goals have no id)
        const strikeList = [];
        Object.values(week.entries).forEach(entry => {
            const strikes = this.scoreEntry(week, entry).misses;
            if (strikes > 0) {
                strikeList.push({
                    name: entry.goal.name,
                    category: entry.goal.category,
                    count: strikes
                });
            }
        });
        strikeList.sort((a, b) => b.count - a.count);

        if (strikeList.length === 0) return null;

        const totalStrikes = strikeList.reduce((s, g) => s + g.count, 0);

        // Group by category
        const catStrikes = {};
        strikeList.forEach(g => {
            if (!catStrikes[g.category]) catStrikes[g.category] = { count: 0, goals: [] };
            catStrikes[g.category].count += g.count;
            catStrikes[g.category].goals.push(g.name);
        });

        // Pick top categories
        const topCats = Object.entries(catStrikes)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 2);

        // Build sentence
        let summary = '';
        if (strikeList.length === 0) {
            summary = 'Clean week — no strikes recorded.';
        } else if (strikeList.length === 1) {
            const g = strikeList[0];
            summary = `This week's only strike was ${g.name} (${g.count}x). One thing to tighten up next week.`;
        } else {
            const parts = topCats.map(([cat, data]) => {
                const topGoal = data.goals[0];
                return data.goals.length > 1
                    ? `${cat} (${data.count} strikes including ${topGoal})`
                    : `${topGoal} in ${cat} (${data.count}x)`;
            });

            summary = `This week's biggest struggles: ${parts.join(' and ')}.`;
            if (totalStrikes > 3) {
                summary += ` ${totalStrikes} total strikes — focus here heading into next week.`;
            } else {
                summary += ` Small gaps — easy to close next week.`;
            }
        }

        return { summary, totalStrikes, topGoals: strikeList.slice(0, 3) };
    }

    renderStrikeSummary() {
        const card = document.getElementById('strikeSummaryCard');
        const textEl = document.getElementById('strikeSummaryText');
        if (!card || !textEl) return;

        // Use the same week that the review scores show (the currently viewed week)
        const targetWeek = this.getCurrentWeek();
        if (!targetWeek) {
            card.style.display = 'none';
            return;
        }

        const result = this.generateStrikeSummary(targetWeek);
        const hasData = Object.values(targetWeek.entries).some(e => e.tracking.some(v => v !== ''));
        if (!hasData && !result) {
            card.style.display = 'none';
            return;
        }

        const lastWeekDate = this.startOfToday();
        lastWeekDate.setDate(lastWeekDate.getDate() - 7);
        const weekLabel = targetWeek === this.getWeekForDate(new Date()) ? 'This week'
            : targetWeek === this.getWeekForDate(lastWeekDate) ? 'Last week' : 'That week';

        if (!result) {
            card.style.display = 'flex';
            card.classList.add('strike-summary-clean');
            textEl.textContent = `${weekLabel}: no strikes — clean week!`;
            return;
        }

        card.style.display = 'flex';
        card.classList.remove('strike-summary-clean');
        const weekDateStr = targetWeek.startDate ? new Date(targetWeek.startDate).toLocaleDateString() : '?';
        const baseSummary = result.summary.replace(/^This week/, weekLabel);
        textEl.textContent = `[Week of ${weekDateStr} | ${result.totalStrikes} strikes found] ${baseSummary}`;
    }

    renderReviewScores() {
        const container = document.getElementById('reviewScores');
        const week = this.getCurrentWeek();
        if (!week) {
            container.innerHTML = '';
            return;
        }

        const catStats = this.scoreByCategory(week);

        container.innerHTML = Object.entries(catStats).map(([cat, s]) => {
            const pct = this.scorePct(s);
            return `<div class="review-score-card">
                <div class="score-value">${pct}%</div>
                <div class="score-label">${cat}</div>
            </div>`;
        }).join('');
    }

    saveWeeklyReview() {
        const wins = document.getElementById('reviewWins').value.trim();
        const improvements = document.getElementById('reviewImprovements').value.trim();
        const p1 = document.getElementById('reviewPriority1').value.trim();
        const p2 = document.getElementById('reviewPriority2').value.trim();
        const p3 = document.getElementById('reviewPriority3').value.trim();
        const ratingBtn = document.querySelector('#weekRating .rating-btn.active');
        const rating = ratingBtn ? parseInt(ratingBtn.dataset.rating) : null;

        if (!wins && !improvements) {
            alert('Please fill in at least one field.');
            return;
        }

        const week = this.getCurrentWeek();
        const review = {
            weekDate: week ? this.formatWeekDate(week.startDate) : this.getTodayStr(),
            timestamp: new Date().toISOString(),
            wins,
            improvements,
            priorities: [p1, p2, p3].filter(Boolean),
            rating
        };

        this.data.weeklyReviews.unshift(review);
        this.saveData();
        this.logActivity('Completed weekly review' + (rating ? ` (rated ${rating}/10)` : ''));

        // Clear form
        document.getElementById('reviewWins').value = '';
        document.getElementById('reviewImprovements').value = '';
        document.getElementById('reviewPriority1').value = '';
        document.getElementById('reviewPriority2').value = '';
        document.getElementById('reviewPriority3').value = '';
        document.querySelectorAll('#weekRating .rating-btn').forEach(b => b.classList.remove('active'));

        this.renderReview();
        alert('Weekly review saved!');
    }

    renderPastReviews() {
        const container = document.getElementById('pastReviewsList');

        if (this.data.weeklyReviews.length === 0) {
            container.innerHTML = '<div class="empty-state">Complete your first weekly review to see history here.</div>';
            return;
        }

        container.innerHTML = this.data.weeklyReviews.slice(0, 10).map(r => `
            <div class="review-history-card">
                <div class="review-history-header">
                    <span class="review-history-date">${r.weekDate}</span>
                    ${r.rating ? `<span class="review-history-rating">${r.rating}/10</span>` : ''}
                </div>
                <div class="review-history-content">
                    ${r.wins ? `<p><strong>Wins:</strong> ${this.escapeHtml(r.wins)}</p>` : ''}
                    ${r.improvements ? `<p><strong>Improve:</strong> ${this.escapeHtml(r.improvements)}</p>` : ''}
                    ${r.priorities?.length ? `<p><strong>Priorities:</strong> ${r.priorities.map(p => this.escapeHtml(p)).join(', ')}</p>` : ''}
                </div>
            </div>
        `).join('');
    }

    // ========================================
    // Forms
    // ========================================
    bindForms() {
        // Add Goal
        document.getElementById('addGoalForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const cat = document.getElementById('goalCategory').value;
            const name = document.getElementById('goalName').value.trim();
            const target = document.getElementById('goalTarget').value.trim();

            if (!name) return;

            this.data.goals.push({ category: cat, name, target });

            // Add to current week
            const week = this.getCurrentWeek();
            if (week) {
                const idx = Object.keys(week.entries).length;
                week.entries[idx] = {
                    goal: { category: cat, name, target },
                    tracking: ['', '', '', '', '', '', '']
                };
            }

            this.saveData();
            this.logActivity(`Added goal: ${name}`);
            this.closeModal('addGoalModal');
            document.getElementById('addGoalForm').reset();
            this.renderGoals();
        });

    }

    // ========================================
    // Quick Actions
    // ========================================
    bindQuickActions() {
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                switch (action) {
                    case 'log-habit':
                        this.navigateTo('habits');
                        break;
                    case 'journal-entry':
                        this.navigateTo('journal');
                        break;
                    case 'weekly-review':
                        this.navigateTo('review');
                        break;
                }
            });
        });
    }

    // ========================================
    // Settings
    // ========================================
    bindSettings() {
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openModal('settingsModal');
            this.updateConvexStatusUI();
            this.renderReminderSettings();
        });

        // Reminders — times and timezone live in data.settings.reminders, which the Convex cron reads
        ['reminderMorning', 'reminderEvening', 'reminderTimezone'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.saveReminderSettings(this.readReminderInputs());
                this.renderReminderStatus();
            });
        });
        document.getElementById('enableRemindersBtn').addEventListener('click', () => this.toggleReminders());
        document.getElementById('testReminderBtn').addEventListener('click', () => this.sendTestReminder());

        // Convex connection
        document.getElementById('connectConvexBtn').addEventListener('click', async () => {
            const url = document.getElementById('convexUrlInput').value.trim();
            if (!url) { alert('Please enter a Convex deployment URL'); return; }
            localStorage.setItem('lifeOS_convexUrl', url);
            if (this.convex) this.convex.unsubscribe();
            this.convex = new ConvexDataLayer(url);
            this.updateConvexStatusUI();
            // Load remote first — only push if local has more data
            const remote = await this.convex.load();
            const remoteWeeks = (remote?.weeks || []).length;
            const localWeeks = (this.data.weeks || []).length;
            if (remote && remoteWeeks >= localWeeks) {
                this.data = this.normalizeData(remote);
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
                this.renderAll();
            } else {
                await this.convex.save(this.data);
            }
            this.convex.subscribe((payload) => {
                this.data = this.normalizeData(payload);
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
                this.renderAll();
            });
            this.logActivity('Connected to Convex — sync active');
        });

        document.getElementById('syncToConvexBtn').addEventListener('click', async () => {
            if (!this.convex || !this.convex.isConnected()) {
                alert('Not connected to Convex. Save your URL first.');
                return;
            }
            const btn = document.getElementById('syncToConvexBtn');
            btn.textContent = 'Pushing...';
            btn.disabled = true;
            await this.convex.save(this.data);
            btn.textContent = 'Pushed ✓';
            btn.disabled = false;
            setTimeout(() => { btn.textContent = 'Push to Convex'; }, 2000);
            this.logActivity('Manually pushed data to Convex');
        });

        document.getElementById('pullFromConvexBtn').addEventListener('click', async () => {
            if (!this.convex || !this.convex.isConnected()) {
                alert('Not connected to Convex. Save your URL first.');
                return;
            }
            const btn = document.getElementById('pullFromConvexBtn');
            btn.textContent = 'Pulling...';
            btn.disabled = true;
            const remote = await this.convex.load();
            if (remote) {
                this.data = this.normalizeData(remote);
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
                this.renderAll();
                btn.textContent = 'Pulled ✓';
                this.logActivity('Manually pulled data from Convex');
            } else {
                btn.textContent = 'Nothing found';
            }
            btn.disabled = false;
            setTimeout(() => { btn.textContent = 'Pull from Convex'; }, 2000);
        });

        document.getElementById('mergeHistoricalBtn').addEventListener('click', () => {
            document.getElementById('mergeHistoricalInput').click();
        });
        document.getElementById('mergeHistoricalInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.mergeHistoricalJSON(file);
        });

        document.getElementById('importSheetsBtn').addEventListener('click', () => {
            document.getElementById('sheetsFileInput').click();
        });
        document.getElementById('sheetsFileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.importGoogleSheetsCSV(file);
        });

        document.getElementById('exportAllBtn').addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `life-os-backup-${this.getTodayStr()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });

        document.getElementById('importAllBtn').addEventListener('click', () => {
            document.getElementById('importJsonInput').click();
        });

        document.getElementById('importJsonInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const imported = JSON.parse(ev.target.result);
                    this.data = this.normalizeData(imported);
                    this.saveData();
                    this.logActivity('Restored from backup');
                    location.reload();
                } catch (err) {
                    alert('Error importing: ' + err.message);
                }
            };
            reader.readAsText(file);
        });

        document.getElementById('dedupWeeksBtn').addEventListener('click', () => {
            const before = this.data.weeks.length;
            // Group weeks by their Sunday date key; keep the one with more tracked cells
            const byKey = {};
            this.data.weeks.forEach(w => {
                const key = this.weekKey(new Date(w.startDate));
                if (!byKey[key]) { byKey[key] = w; return; }
                // Count non-empty tracking cells for each candidate
                const countCells = week => Object.values(week.entries)
                    .reduce((n, e) => n + e.tracking.filter(v => v !== '').length, 0);
                if (countCells(w) > countCells(byKey[key])) byKey[key] = w;
            });
            this.data.weeks = Object.values(byKey)
                .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            const removed = before - this.data.weeks.length;
            this.saveData();
            if (removed > 0) {
                alert(`Removed ${removed} duplicate week${removed > 1 ? 's' : ''}. Page will reload.`);
                location.reload();
            } else {
                alert('No duplicate weeks found — your data is clean!');
            }
        });

        document.getElementById('resetAllBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset ALL Life OS data? This cannot be undone.')) {
                if (confirm('This will delete everything. Last chance - are you sure?')) {
                    localStorage.removeItem(this.STORAGE_KEY);
                    location.reload();
                }
            }
        });
    }

    // ========================================
    // Reminders (Web Push via Convex)
    // ========================================
    getReminderSettings() {
        const r = { ...DEFAULT_REMINDERS, ...(this.data.settings.reminders || {}) };
        if (!r.timezone) r.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
        return r;
    }

    saveReminderSettings(patch) {
        this.data.settings.reminders = { ...this.getReminderSettings(), ...patch };
        this.saveData();
    }

    readReminderInputs() {
        return {
            morning: document.getElementById('reminderMorning').value || DEFAULT_REMINDERS.morning,
            evening: document.getElementById('reminderEvening').value || DEFAULT_REMINDERS.evening,
            timezone: document.getElementById('reminderTimezone').value
        };
    }

    renderReminderSettings() {
        const r = this.getReminderSettings();
        document.getElementById('reminderMorning').value = r.morning;
        document.getElementById('reminderEvening').value = r.evening;
        const tzSelect = document.getElementById('reminderTimezone');
        let zones = [];
        try { zones = Intl.supportedValuesOf('timeZone'); } catch (e) { /* older browsers */ }
        if (!zones.includes(r.timezone)) zones = [r.timezone, ...zones];
        tzSelect.innerHTML = zones.map(z => `<option value="${z}">${z.replace(/_/g, ' ')}</option>`).join('');
        tzSelect.value = r.timezone;
        this.renderReminderStatus();
        // Fetch the VAPID key now so nothing is awaited before the permission prompt on tap
        if (this.convex && !this._vapidKeyPromise) this.prefetchVapidKey();
    }

    prefetchVapidKey() {
        this._vapidKeyPromise = this.convex.query('push:getVapidPublicKey').then(key => {
            if (!key) throw new Error('reminders are not set up on the Convex backend yet');
            return key;
        });
        this._vapidKeyPromise.catch(() => { this._vapidKeyPromise = null; });
        return this._vapidKeyPromise;
    }

    async getPushSubscription() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
        const reg = await navigator.serviceWorker.getRegistration();
        return reg ? reg.pushManager.getSubscription() : null;
    }

    setReminderStatus(text, tone) {
        const el = document.getElementById('reminderStatus');
        el.textContent = text;
        el.style.color = tone === 'ok' ? 'var(--success)' : tone === 'warn' ? 'var(--warning)' : 'var(--text-muted)';
    }

    formatTime12(hhmm) {
        const [h, m] = hhmm.split(':').map(Number);
        return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    }

    async renderReminderStatus() {
        const r = this.getReminderSettings();
        let sub = null;
        try { sub = await this.getPushSubscription(); } catch (e) { /* unsupported */ }
        this._pushSubscribed = !!sub;
        const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
        const on = r.enabled && !!sub && granted;
        const btn = document.getElementById('enableRemindersBtn');
        btn.textContent = on ? 'Turn off reminders' : 'Enable reminders';
        btn.className = `btn ${on ? 'btn-secondary' : 'btn-primary'}`;
        document.getElementById('testReminderBtn').style.display = on ? 'inline-block' : 'none';
        if (on) {
            this.setReminderStatus(`🔔 On for this device — ${this.formatTime12(r.morning)} nudge, ${this.formatTime12(r.evening)} "items left" (${r.timezone}).`, 'ok');
        } else if (r.enabled) {
            this.setReminderStatus('Reminders are on, but not for this device. Tap Enable reminders to add it.');
        } else {
            this.setReminderStatus('Off.');
        }
    }

    // Enable (or turn off) push reminders for this device. Called straight from the tap.
    async toggleReminders() {
        if (this.getReminderSettings().enabled && this._pushSubscribed) return this.disableReminders();

        if (!this.convex) {
            this.setReminderStatus('Connect Convex above first — reminders are sent from your Convex backend.', 'warn');
            return;
        }
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
            this.setReminderStatus('This browser can\'t receive push. On iPhone: Safari → Share → Add to Home Screen, then open Life OS from the Home Screen icon (iOS 16.4+) and tap again.', 'warn');
            return;
        }
        // Must be the first await: iOS only shows the prompt in direct response to a tap
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            this.setReminderStatus('Notifications are blocked. Allow them in iPhone Settings → Notifications → Life OS, then tap again.', 'warn');
            return;
        }

        const btn = document.getElementById('enableRemindersBtn');
        btn.disabled = true;
        this.setReminderStatus('Subscribing…');
        try {
            const key = await (this._vapidKeyPromise || this.prefetchVapidKey());
            const reg = await Promise.race([
                navigator.serviceWorker.ready,
                new Promise((_, reject) => setTimeout(() => reject(new Error('service worker not active — reload the app and try again')), 10000))
            ]);
            const appKey = this.base64UrlToBytes(key);
            let sub = await reg.pushManager.getSubscription();
            if (sub && !this.sameBytes(sub.options?.applicationServerKey, appKey)) {
                await sub.unsubscribe(); // subscribed under an old key
                sub = null;
            }
            if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
            const json = sub.toJSON();
            await this.convex.mutation('push:saveSubscription', {
                subscription: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
                userAgent: navigator.userAgent.slice(0, 200)
            });
            this.saveReminderSettings({ ...this.readReminderInputs(), enabled: true });
            this.logActivity('Turned on reminders');
            this.updateAppBadge();
        } catch (err) {
            this.setReminderStatus('Could not enable reminders: ' + err.message, 'warn');
            btn.disabled = false;
            return;
        }
        btn.disabled = false;
        this.renderReminderStatus();
    }

    async disableReminders() {
        this.saveReminderSettings({ enabled: false });
        try {
            const sub = await this.getPushSubscription();
            if (sub) {
                if (this.convex) await this.convex.mutation('push:removeSubscription', { endpoint: sub.endpoint }).catch(() => {});
                await sub.unsubscribe();
            }
        } catch (e) { /* already gone */ }
        this.logActivity('Turned off reminders');
        this.renderReminderStatus();
    }

    async sendTestReminder() {
        const btn = document.getElementById('testReminderBtn');
        btn.disabled = true;
        try {
            const res = await this.convex.action('pushNode:sendTest', { timezone: this.getReminderSettings().timezone });
            this.setReminderStatus(`Test sent to ${res.sent} device${res.sent === 1 ? '' : 's'}${res.failed ? ` (${res.failed} failed)` : ''}.`, res.sent ? 'ok' : 'warn');
        } catch (err) {
            this.setReminderStatus('Test failed: ' + err.message, 'warn');
        }
        btn.disabled = false;
    }

    base64UrlToBytes(b64url) {
        const b64 = (b64url + '='.repeat((4 - b64url.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
        return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    }

    sameBytes(buf, bytes) {
        if (!buf) return true; // browser doesn't expose the key — assume it matches
        const a = new Uint8Array(buf);
        return a.length === bytes.length && a.every((x, i) => x === bytes[i]);
    }

    updateConvexStatusUI() {
        const statusEl = document.getElementById('convexStatus');
        const syncBtn = document.getElementById('syncToConvexBtn');
        const urlInput = document.getElementById('convexUrlInput');
        const savedUrl = localStorage.getItem('lifeOS_convexUrl');

        if (savedUrl) urlInput.value = savedUrl;

        const pullBtn = document.getElementById('pullFromConvexBtn');
        if (this.convex && this.convex.isConnected()) {
            statusEl.textContent = '🟢 Syncing across devices';
            statusEl.style.color = 'var(--success)';
            syncBtn.style.display = 'inline-block';
            pullBtn.style.display = 'inline-block';
        } else if (savedUrl) {
            statusEl.textContent = '🟡 Connecting…';
            statusEl.style.color = 'var(--warning)';
            syncBtn.style.display = 'none';
            pullBtn.style.display = 'none';
        } else {
            statusEl.textContent = '⚪ Local only — enter a Convex URL to sync';
            statusEl.style.color = 'var(--text-muted)';
            syncBtn.style.display = 'none';
            pullBtn.style.display = 'none';
        }
    }

    // ========================================
    // Utilities
    // ========================================
    // ========================================
    // Google Sheets CSV Import
    // ========================================
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
                else if (ch === '"') inQuotes = false;
                else current += ch;
            } else {
                if (ch === '"') inQuotes = true;
                else if (ch === ',') { result.push(current); current = ''; }
                else current += ch;
            }
        }
        result.push(current);
        return result;
    }

    mergeHistoricalJSON(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                const historicalWeeks = imported.weeks || [];
                if (!historicalWeeks.length) {
                    alert('No weeks found in the JSON file.');
                    return;
                }

                // Build a map keyed by the Sunday date (YYYY-MM-DD) — ignores time zone differences
                const existingMap = {};
                (this.data.weeks || []).forEach(w => {
                    existingMap[this.weekKey(new Date(w.startDate))] = w;
                });

                let added = 0, skipped = 0;
                historicalWeeks.forEach(hw => {
                    const key = this.weekKey(new Date(hw.startDate));
                    if (existingMap[key]) {
                        // Week already exists — skip (don't overwrite user's current data)
                        skipped++;
                    } else {
                        existingMap[key] = hw;
                        added++;
                    }
                });

                // Sort weeks by date and save
                this.data.weeks = Object.values(existingMap)
                    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

                this.saveData();
                this.logActivity(`Merged ${added} historical weeks (${skipped} already existed)`);
                alert(`Import complete!\n✅ ${added} weeks added\n⏭ ${skipped} weeks already existed (not overwritten)\n\nPage will reload to apply changes.`);
                location.reload();
            } catch (err) {
                alert('Error reading file: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    importGoogleSheetsCSV(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let csv = e.target.result;
                if (csv.charCodeAt(0) === 0xFEFF) csv = csv.slice(1);
                const lines = csv.split(/\r?\n/);

                const importedWeeks = [];
                let currentWeek = null;
                let currentCategory = null;
                let currentYear = null;
                let lastMonth = null;

                const knownCats = ['physical health', 'mental health', 'budgeting', 'work',
                    'cooking', 'monthly', 'other', 'morning protocol', 'midday protocol',
                    'evening protocol'];
                const skipPatterns = ['grand total', 'total strikes', 'week specific',
                    'misses:', 'keep strike', 'this week'];
                const dayLabels = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

                const inferYear = (month) => {
                    if (!currentYear) {
                        return month >= 9 ? 2024 : 2025;
                    }
                    if (lastMonth && lastMonth > month + 2) return currentYear + 1;
                    return currentYear;
                };

                const startWeek = (monthDayStr) => {
                    const [m, d] = monthDayStr.split('/').map(Number);
                    if (isNaN(m) || isNaN(d)) return;
                    currentYear = inferYear(m);
                    lastMonth = m;
                    if (currentWeek && Object.keys(currentWeek.entries).length > 0) {
                        importedWeeks.push(currentWeek);
                    }
                    const startStr = `${currentYear}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                    currentWeek = { startDate: new Date(startStr + 'T12:00:00').toISOString(), entries: {}, source: 'imported' };
                    currentCategory = null;
                };

                for (const rawLine of lines) {
                    const cells = this.parseCSVLine(rawLine);
                    if (cells.length < 2) continue;

                    const c0 = (cells[0] || '').trim();
                    const c1 = (cells[1] || '').trim();
                    const c2 = (cells[2] || '').trim();
                    const lc0 = c0.toLowerCase();
                    const lc1 = c1.toLowerCase();

                    // Skip noise rows
                    if (skipPatterns.some(p => lc0.startsWith(p) || lc1.startsWith(p))) continue;
                    if (dayLabels.includes(c2.toLowerCase())) continue;

                    // FORMAT 1: ,,MM/DD,MM/DD,... (dates in cols 2+, c0 and c1 empty)
                    if (c0 === '' && c1 === '' && /^\d{1,2}\/\d{1,2}$/.test(c2)) {
                        startWeek(c2);
                        continue;
                    }

                    // FORMAT 2: MM/DD-MM/DD,,,... (date range in col 0)
                    if (/^\d{1,2}\/\d{1,2}-\d{1,2}\/\d{1,2}$/.test(c0)) {
                        startWeek(c0.split('-')[0]);
                        continue;
                    }

                    if (!currentWeek || !c1) continue;

                    // Category row detection
                    const tracking7 = cells.slice(2, 9);
                    const hasTracking = tracking7.some(v => (v || '').trim() === 'X' || (v || '').trim() === 'x' || (v || '').trim() === '1');

                    if (knownCats.includes(lc1) || (!hasTracking && c1.length < 45)) {
                        currentCategory = c1;
                        continue;
                    }

                    // Goal row — extract tracking from cols 2-8
                    const tracking = tracking7.map(v => {
                        const t = (v || '').trim();
                        if (t === 'X' || t === 'x') return 'X';
                        if (t === '1') return '1';
                        return '';
                    });
                    while (tracking.length < 7) tracking.push('');

                    const idx = Object.keys(currentWeek.entries).length;
                    currentWeek.entries[idx] = {
                        goal: { name: c1, category: currentCategory || 'Other', target: '' },
                        tracking
                    };
                }

                if (currentWeek && Object.keys(currentWeek.entries).length > 0) {
                    importedWeeks.push(currentWeek);
                }

                if (importedWeeks.length === 0) {
                    alert('No weeks found. Make sure this is a Google Sheets CSV export from your accountability tracker.');
                    return;
                }

                let added = 0;
                for (const week of importedWeeks) {
                    const exists = this.data.weeks.some(w =>
                        new Date(w.startDate).toDateString() === new Date(week.startDate).toDateString()
                    );
                    if (!exists) { this.data.weeks.push(week); added++; }
                }

                this.data.weeks.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                this.saveData();
                this.logActivity(`Imported ${added} historical weeks from Google Sheets`);
                this.renderDashboard();
                this.closeModal('settingsModal');
                alert(`Imported ${added} historical weeks from Google Sheets!\n\n` +
                    `Your all-time stats now appear on the Dashboard.\n` +
                    `Use Previous/Next in the Goals tab to browse past weeks.`);
            } catch (err) {
                alert('Error parsing CSV: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    getTodayStr() {
        return this.dateToStr(new Date());
    }

    dateToStr(date) {
        return date.toISOString().split('T')[0];
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
        if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
        return Math.floor(seconds / 86400) + 'd ago';
    }
}

// ========================================
// Initialize
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    window.lifeOS = new LifeOS();
});
