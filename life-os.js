/* ========================================
   Life OS - Personal Operating System
   Main Application Logic
   ======================================== */

class LifeOS {
    constructor() {
        this.STORAGE_KEY = 'lifeOSData';
        this.data = this.loadData();
        this.currentWeekIndex = -1; // -1 = latest
        this.charts = {};

        // Initialize Convex if URL is saved
        this.convex = null;
        const savedConvexUrl = localStorage.getItem('lifeOS_convexUrl');
        if (savedConvexUrl && window.ConvexDataLayer) {
            this.convex = new ConvexDataLayer(savedConvexUrl);
        }

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
                const parsed = JSON.parse(stored);
                // Merge with defaults for any missing keys
                const defaults = this.getDefaultData();
                for (const key of Object.keys(defaults)) {
                    if (!(key in parsed)) {
                        parsed[key] = defaults[key];
                    }
                }
                return parsed;
            }
        } catch (e) {
            console.error('Error loading data:', e);
        }
        return this.getDefaultData();
    }

    saveData() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error('Error saving data:', e);
            alert('Warning: Could not save data. LocalStorage may be full.');
        }
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
        this.bindFinance();
        this.bindGoals();
        this.bindSettings();
        this.bindMobileMenu();

        // Ensure at least one week exists
        if (this.data.weeks.length === 0) {
            this.createNewWeek();
        }

        this.renderDashboard();
        this.renderGoals();
        this.renderFinances();
        this.renderHealth();
        this.renderHabits();
        this.renderJournal();
        this.renderReview();

        // Set dashboard date
        document.getElementById('dashboardDate').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
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
            case 'finances': this.renderFinances(); break;
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

    createNewWeek() {
        const startDate = this.getWeekStartDate();
        // Check if this week already exists
        const exists = this.data.weeks.some(w => {
            const ws = new Date(w.startDate);
            return ws.toDateString() === startDate.toDateString();
        });

        if (exists) return;

        const week = {
            startDate: startDate.toISOString(),
            entries: {}
        };

        // Initialize entries for each goal
        this.data.goals.forEach((goal, i) => {
            week.entries[i] = {
                goal: { ...goal },
                tracking: ['', '', '', '', '', '', '']
            };
        });

        this.data.weeks.push(week);
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

    formatWeekDate(isoStr) {
        const d = new Date(isoStr);
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
        const opts = { month: 'short', day: 'numeric' };
        return `${d.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}, ${end.getFullYear()}`;
    }

    // ========================================
    // Dashboard
    // ========================================
    renderDashboard() {
        this.renderLifeScore();
        this.renderDashStats();
        this.renderCategoryBars();
        this.renderActivityFeed();
    }

    renderLifeScore() {
        const week = this.getCurrentWeek();
        if (!week) return;

        let totalGoals = 0;
        let completedGoals = 0;

        Object.values(week.entries).forEach(entry => {
            entry.tracking.forEach(val => {
                if (val === 'X' || val === 'x') completedGoals++;
                if (val !== '') totalGoals++;
            });
        });

        // Factor in habits
        const today = this.getTodayStr();
        const todayHabits = this.data.habitLog[today] || {};
        const habitsDone = Object.values(todayHabits).filter(v => v).length;
        const habitsTotal = this.data.habits.length;

        // Weighted score: 60% goals, 25% habits, 15% other factors
        const goalScore = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;
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
            const strikes = entry.tracking.filter(v => v === '1').length;
            if (strikes === 0) onTrack++;
        });
        document.getElementById('dashGoalsOnTrack').textContent = onTrack;
        document.getElementById('dashGoalsDetail').textContent = `of ${totalGoals} goals`;

        // Monthly spend
        const now = new Date();
        const monthTxns = this.data.transactions.filter(t => {
            const td = new Date(t.date);
            return td.getMonth() === now.getMonth() && td.getFullYear() === now.getFullYear() && t.type === 'expense';
        });
        const monthSpend = monthTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        document.getElementById('dashMonthlySpend').textContent = '$' + monthSpend.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        const totalBudget = Object.values(this.data.settings.defaultBudgets).reduce((s, v) => s + v, 0);
        const pct = totalBudget > 0 ? Math.round((monthSpend / totalBudget) * 100) : 0;
        document.getElementById('dashBudgetDetail').textContent = `${pct}% of budget`;

        // Health score (based on physical health goal completion this week)
        let healthCompleted = 0;
        let healthTotal = 0;
        Object.values(week.entries).forEach(entry => {
            if (entry.goal.category === 'Physical Health' || entry.goal.category === 'Mental Health') {
                entry.tracking.forEach(v => {
                    if (v !== '') healthTotal++;
                    if (v === 'X' || v === 'x') healthCompleted++;
                });
            }
        });
        const healthPct = healthTotal > 0 ? Math.round((healthCompleted / healthTotal) * 100) : 0;
        document.getElementById('dashHealthScore').textContent = healthPct + '%';

        // Habit streak
        const streak = this.calculateMaxStreak();
        document.getElementById('dashHabitStreak').textContent = streak;
    }

    calculateMaxStreak() {
        const today = new Date();
        let streak = 0;
        for (let i = 0; i < 365; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = this.dateToStr(d);
            const log = this.data.habitLog[key];
            if (!log) break;
            const done = Object.values(log).filter(v => v).length;
            const total = this.data.habits.length;
            if (total > 0 && done / total >= 0.7) {
                streak++;
            } else {
                break;
            }
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

        const catStats = {};
        Object.values(week.entries).forEach(entry => {
            const cat = entry.goal.category;
            if (!catStats[cat]) catStats[cat] = { total: 0, completed: 0 };
            entry.tracking.forEach(v => {
                if (v !== '') catStats[cat].total++;
                if (v === 'X' || v === 'x') catStats[cat].completed++;
            });
        });

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
            const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
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

        document.getElementById('importAccountabilityBtn').addEventListener('click', () => this.importFromAccountabilityTracker());
    }

    renderGoals() {
        const week = this.getCurrentWeek();
        if (!week) {
            document.getElementById('goalsGrid').innerHTML = '<div class="empty-state">No weeks yet. Click "+ New Week" to start.</div>';
            return;
        }

        // Week label
        document.getElementById('currentWeekLabel').textContent = this.formatWeekDate(week.startDate);

        // Build table
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let html = '<table><thead><tr><th>Goal</th>';
        days.forEach(d => html += `<th>${d}</th>`);
        html += '<th>Strikes</th></tr></thead><tbody>';

        // Group by category
        const grouped = {};
        Object.entries(week.entries).forEach(([idx, entry]) => {
            const cat = entry.goal.category;
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ idx: parseInt(idx), ...entry });
        });

        for (const [cat, entries] of Object.entries(grouped)) {
            html += `<tr><td class="cat-header" colspan="${days.length + 2}">${cat}</td></tr>`;
            entries.forEach(entry => {
                html += `<tr><td class="goal-name-cell">${this.escapeHtml(entry.goal.name)}</td>`;
                entry.tracking.forEach((val, dayIdx) => {
                    let cls = 'day-cell';
                    let display = '';
                    if (val === 'X' || val === 'x') {
                        cls += ' completed';
                        display = '\u2713';
                    } else if (val === '1') {
                        cls += ' missed';
                        display = '\u2717';
                    }
                    html += `<td class="${cls}" data-goal="${entry.idx}" data-day="${dayIdx}">${display}</td>`;
                });
                const strikes = entry.tracking.filter(v => v === '1').length;
                html += `<td class="strike-count">${strikes > 0 ? strikes : ''}</td></tr>`;
            });
        }

        html += '</tbody></table>';
        document.getElementById('goalsGrid').innerHTML = html;

        // Bind cell clicks
        document.querySelectorAll('#goalsGrid .day-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const goalIdx = parseInt(cell.dataset.goal);
                const dayIdx = parseInt(cell.dataset.day);
                this.toggleGoalCell(goalIdx, dayIdx);
            });
        });

        this.renderGoalCharts();
        this.renderGoalsList();
    }

    toggleGoalCell(goalIdx, dayIdx) {
        const week = this.getCurrentWeek();
        if (!week || !week.entries[goalIdx]) return;

        const current = week.entries[goalIdx].tracking[dayIdx];
        if (current === '') {
            week.entries[goalIdx].tracking[dayIdx] = 'X';
        } else if (current === 'X' || current === 'x') {
            week.entries[goalIdx].tracking[dayIdx] = '1';
        } else {
            week.entries[goalIdx].tracking[dayIdx] = '';
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
            let strikes = 0;
            Object.values(week.entries).forEach(entry => {
                strikes += entry.tracking.filter(v => v === '1').length;
            });
            strikesData.push(strikes);
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
        const catStats = {};
        const week = this.getCurrentWeek();
        if (week) {
            Object.values(week.entries).forEach(entry => {
                const cat = entry.goal.category;
                if (!catStats[cat]) catStats[cat] = { completed: 0, total: 0 };
                entry.tracking.forEach(v => {
                    if (v !== '') catStats[cat].total++;
                    if (v === 'X' || v === 'x') catStats[cat].completed++;
                });
            });
        }

        const catLabels = Object.keys(catStats);
        const catPcts = catLabels.map(c => {
            const s = catStats[c];
            return s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
        });

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

        let html = '';
        for (const [cat, goals] of Object.entries(grouped)) {
            html += `<div class="goal-category-group"><h4>${cat}</h4>`;
            goals.forEach(g => {
                html += `<div class="goal-list-item">
                    <span>${this.escapeHtml(g.name)} ${g.target ? '(' + this.escapeHtml(g.target) + ')' : ''}</span>
                    <button data-remove-goal="${g.index}">Remove</button>
                </div>`;
            });
            html += '</div>';
        }
        container.innerHTML = html;

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
    // Finance Section
    // ========================================
    bindFinance() {
        document.getElementById('importMonarchBtn').addEventListener('click', () => {
            document.getElementById('monarchFileInput').click();
        });

        document.getElementById('monarchFileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.importMonarchCSV(file);
        });

        document.getElementById('addTransactionBtn').addEventListener('click', () => {
            document.getElementById('txnDate').value = this.getTodayStr();
            this.openModal('addTransactionModal');
        });

        document.getElementById('editBudgetBtn').addEventListener('click', () => {
            this.renderBudgetModal();
            this.openModal('editBudgetModal');
        });

        document.getElementById('addAccountBtn').addEventListener('click', () => this.openModal('addAccountModal'));

        document.getElementById('txnCategoryFilter').addEventListener('change', () => this.renderTransactions());
        document.getElementById('txnSearch').addEventListener('input', () => this.renderTransactions());
    }

    importMonarchCSV(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let csv = e.target.result;

                // Handle BOM (byte order mark) that some exports include
                if (csv.charCodeAt(0) === 0xFEFF) csv = csv.slice(1);

                // Split lines, handle both \r\n and \n
                const lines = csv.split(/\r?\n/);

                // Skip blank lines at the top (messy exports sometimes have them)
                let headerLineIdx = 0;
                while (headerLineIdx < lines.length && !lines[headerLineIdx].trim()) {
                    headerLineIdx++;
                }

                if (headerLineIdx >= lines.length - 1) {
                    alert('CSV file appears empty.');
                    return;
                }

                // Fuzzy header matching - handles varied column names
                const headers = this.parseCSVLine(lines[headerLineIdx]).map(h => h.toLowerCase().trim().replace(/[^a-z]/g, ''));
                const findCol = (...names) => headers.findIndex(h => names.some(n => h.includes(n)));

                const dateIdx = findCol('date');
                const descIdx = findCol('merchant', 'description', 'payee', 'name', 'memo', 'statement');
                const catIdx = findCol('category', 'type');
                const amountIdx = findCol('amount', 'total', 'sum');
                const accountIdx = findCol('account', 'bank');
                const notesIdx = findCol('note', 'memo');

                if (dateIdx === -1 && amountIdx === -1) {
                    alert('Could not find Date or Amount columns. Found headers: ' + this.parseCSVLine(lines[headerLineIdx]).join(', '));
                    return;
                }

                // Build set of existing transaction keys to avoid duplicates
                const existingKeys = new Set(
                    this.data.transactions.map(t => `${t.date}|${t.description}|${t.amount}`)
                );

                let imported = 0;
                let skipped = 0;
                let errors = 0;

                for (let i = headerLineIdx + 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    try {
                        const fields = this.parseCSVLine(line);

                        // Try to get date - handle various formats
                        let date = (fields[dateIdx] || '').trim();
                        if (!date) { skipped++; continue; }
                        date = this.normalizeDate(date);
                        if (!date) { skipped++; continue; }

                        // Parse amount - strip currency symbols, parens for negatives
                        let rawAmount = (fields[amountIdx >= 0 ? amountIdx : -1] || '').trim();
                        if (!rawAmount) { skipped++; continue; }
                        // Handle parentheses as negative: (123.45) => -123.45
                        let isNeg = false;
                        if (rawAmount.startsWith('(') && rawAmount.endsWith(')')) {
                            rawAmount = rawAmount.slice(1, -1);
                            isNeg = true;
                        }
                        rawAmount = rawAmount.replace(/[$,\s]/g, '');
                        if (rawAmount.startsWith('-')) { isNeg = true; rawAmount = rawAmount.slice(1); }
                        const amount = parseFloat(rawAmount);
                        if (isNaN(amount) || amount === 0) { skipped++; continue; }

                        const desc = (fields[descIdx >= 0 ? descIdx : 0] || '').trim() || 'Unknown';
                        const cat = (fields[catIdx >= 0 ? catIdx : -1] || '').trim() || 'Other';
                        const account = (fields[accountIdx >= 0 ? accountIdx : -1] || '').trim() || '';

                        // Skip duplicates
                        const key = `${date}|${desc}|${amount}`;
                        if (existingKeys.has(key)) { skipped++; continue; }
                        existingKeys.add(key);

                        const txn = {
                            id: 'txn_' + Date.now() + '_' + i,
                            date: date,
                            description: desc,
                            category: cat,
                            amount: amount,
                            type: isNeg ? 'expense' : 'income',
                            account: account,
                            source: 'monarch'
                        };

                        this.data.transactions.push(txn);
                        imported++;
                    } catch (rowErr) {
                        errors++;
                    }
                }

                // Sort by date descending
                this.data.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
                this.updateTxnCategoryFilter();
                this.saveData();
                this.logActivity(`Imported ${imported} transactions from Monarch`);
                this.renderFinances();

                let msg = `Imported ${imported} transactions!`;
                if (skipped > 0) msg += `\n${skipped} rows skipped (duplicates or missing data).`;
                if (errors > 0) msg += `\n${errors} rows had errors and were skipped.`;
                alert(msg);
            } catch (err) {
                alert('Error parsing CSV: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    normalizeDate(dateStr) {
        // Handle common date formats: MM/DD/YYYY, YYYY-MM-DD, M/D/YY, etc.
        dateStr = dateStr.replace(/['"]/g, '').trim();

        // Already ISO format
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            return dateStr.split('T')[0];
        }

        // MM/DD/YYYY or M/D/YYYY
        const slashMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (slashMatch) {
            let [, month, day, year] = slashMatch;
            if (year.length === 2) year = '20' + year;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Try native Date parsing as fallback
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }

        return null;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else if (ch === '"') {
                    inQuotes = false;
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    result.push(current);
                    current = '';
                } else {
                    current += ch;
                }
            }
        }
        result.push(current);
        return result;
    }

    renderFinances() {
        this.renderFinanceOverview();
        this.renderBudgetBars();
        this.renderFinanceCharts();
        this.renderTransactions();
        this.renderAccounts();
        this.updateTxnCategoryFilter();
    }

    renderFinanceOverview() {
        const now = new Date();
        const monthTxns = this.data.transactions.filter(t => {
            const td = new Date(t.date);
            return td.getMonth() === now.getMonth() && td.getFullYear() === now.getFullYear();
        });

        const income = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expenses = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const net = income - expenses;
        const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0;

        document.getElementById('totalIncome').textContent = '$' + income.toLocaleString('en-US', { minimumFractionDigits: 2 });
        document.getElementById('totalExpenses').textContent = '$' + expenses.toLocaleString('en-US', { minimumFractionDigits: 2 });

        const netEl = document.getElementById('netAmount');
        netEl.textContent = (net >= 0 ? '+' : '') + '$' + Math.abs(net).toLocaleString('en-US', { minimumFractionDigits: 2 });
        netEl.className = 'finance-amount ' + (net >= 0 ? 'income' : 'expense');

        document.getElementById('savingsRate').textContent = savingsRate + '%';
    }

    renderBudgetBars() {
        const container = document.getElementById('budgetCategories');
        const budgets = this.data.settings.defaultBudgets;
        const now = new Date();

        const monthExpenses = {};
        this.data.transactions
            .filter(t => {
                const td = new Date(t.date);
                return t.type === 'expense' && td.getMonth() === now.getMonth() && td.getFullYear() === now.getFullYear();
            })
            .forEach(t => {
                const cat = t.category;
                monthExpenses[cat] = (monthExpenses[cat] || 0) + t.amount;
            });

        let html = '';
        for (const [cat, budget] of Object.entries(budgets)) {
            const spent = monthExpenses[cat] || 0;
            const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
            let cls = 'under';
            if (pct > 90) cls = 'over';
            else if (pct > 70) cls = 'near';

            html += `
                <div class="budget-bar-item">
                    <div class="budget-bar-header">
                        <span class="budget-name">${cat}</span>
                        <span class="budget-amounts">$${spent.toFixed(0)} / $${budget.toFixed(0)}</span>
                    </div>
                    <div class="budget-bar-track">
                        <div class="budget-bar-fill ${cls}" style="width:${Math.min(pct, 100)}%"></div>
                    </div>
                </div>`;
        }

        container.innerHTML = html || '<div class="empty-state">Set up your budget to track spending.</div>';
    }

    renderFinanceCharts() {
        const now = new Date();
        const monthExpenses = {};
        this.data.transactions
            .filter(t => {
                const td = new Date(t.date);
                return t.type === 'expense' && td.getMonth() === now.getMonth() && td.getFullYear() === now.getFullYear();
            })
            .forEach(t => {
                monthExpenses[t.category] = (monthExpenses[t.category] || 0) + t.amount;
            });

        // Spending by category (doughnut)
        const catLabels = Object.keys(monthExpenses);
        const catAmounts = Object.values(monthExpenses);
        const chartColors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#6b7280'];

        const spendingCanvas = document.getElementById('spendingCategoryChart');
        if (this.charts.spendingCategory) this.charts.spendingCategory.destroy();
        if (catLabels.length > 0) {
            this.charts.spendingCategory = new Chart(spendingCanvas, {
                type: 'doughnut',
                data: {
                    labels: catLabels,
                    datasets: [{ data: catAmounts, backgroundColor: chartColors.slice(0, catLabels.length) }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
                }
            });
        }

        // Monthly trend (last 6 months)
        const monthLabels = [];
        const incomeData = [];
        const expenseData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            monthLabels.push(d.toLocaleDateString('en-US', { month: 'short' }));
            const mTxns = this.data.transactions.filter(t => {
                const td = new Date(t.date);
                return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
            });
            incomeData.push(mTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
            expenseData.push(mTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
        }

        const trendCanvas = document.getElementById('monthlyTrendChart');
        if (this.charts.monthlyTrend) this.charts.monthlyTrend.destroy();
        this.charts.monthlyTrend = new Chart(trendCanvas, {
            type: 'bar',
            data: {
                labels: monthLabels,
                datasets: [
                    { label: 'Income', data: incomeData, backgroundColor: '#22c55e' },
                    { label: 'Expenses', data: expenseData, backgroundColor: '#ef4444' }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    renderTransactions() {
        const container = document.getElementById('transactionsList');
        const filter = document.getElementById('txnCategoryFilter').value;
        const search = document.getElementById('txnSearch').value.toLowerCase();

        let txns = this.data.transactions;
        if (filter !== 'all') txns = txns.filter(t => t.category === filter);
        if (search) txns = txns.filter(t => t.description.toLowerCase().includes(search) || t.category.toLowerCase().includes(search));

        if (txns.length === 0) {
            container.innerHTML = '<div class="empty-state">No transactions found. Import from Monarch or add manually.</div>';
            return;
        }

        container.innerHTML = txns.slice(0, 50).map(t => `
            <div class="transaction-item">
                <div class="txn-info">
                    <span class="txn-desc">${this.escapeHtml(t.description)}</span>
                    <span class="txn-meta">${t.date} &middot; ${t.category}${t.account ? ' &middot; ' + t.account : ''}</span>
                </div>
                <span class="txn-amount ${t.type}">${t.type === 'expense' ? '-' : '+'}$${t.amount.toFixed(2)}</span>
            </div>
        `).join('');
    }

    updateTxnCategoryFilter() {
        const select = document.getElementById('txnCategoryFilter');
        const cats = [...new Set(this.data.transactions.map(t => t.category))].sort();
        const current = select.value;
        select.innerHTML = '<option value="all">All Categories</option>' +
            cats.map(c => `<option value="${c}">${c}</option>`).join('');
        select.value = current || 'all';
    }

    renderAccounts() {
        const container = document.getElementById('accountsGrid');
        if (this.data.accounts.length === 0) {
            container.innerHTML = '<div class="empty-state">Add accounts to track your net worth.</div>';
            return;
        }

        container.innerHTML = this.data.accounts.map(a => `
            <div class="account-card">
                <span class="account-type">${a.type}</span>
                <h4>${this.escapeHtml(a.name)}</h4>
                <div class="account-balance" style="color:${a.balance >= 0 ? 'var(--success)' : 'var(--danger)'}">
                    ${a.balance >= 0 ? '' : '-'}$${Math.abs(a.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
            </div>
        `).join('');
    }

    renderBudgetModal() {
        const container = document.getElementById('budgetInputs');
        const budgets = this.data.settings.defaultBudgets;
        container.innerHTML = Object.entries(budgets).map(([cat, amount]) => `
            <div class="budget-input-row">
                <label>${cat}</label>
                <input type="number" data-budget-cat="${cat}" value="${amount}" step="50">
            </div>
        `).join('');
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

        // Workouts (Strength + Cardio from goals)
        let workouts = 0;
        const workoutTarget = 4; // 2 strength + 2 cardio
        Object.values(week.entries).forEach(entry => {
            if (entry.goal.name.includes('Strength') || entry.goal.name.includes('Cardio')) {
                workouts += entry.tracking.filter(v => v === 'X' || v === 'x').length;
            }
        });
        document.getElementById('workoutCount').textContent = `${workouts}/${workoutTarget}`;
        this.drawRing('workoutRing', workouts / workoutTarget, '#ef4444');

        // Sleep (bedtime compliance)
        let sleepDone = 0;
        let sleepTotal = 5; // weeknights
        Object.values(week.entries).forEach(entry => {
            if (entry.goal.name.includes('bed by')) {
                sleepDone = entry.tracking.filter(v => v === 'X' || v === 'x').length;
            }
        });
        document.getElementById('sleepScore').textContent = `${sleepDone}/${sleepTotal}`;
        this.drawRing('sleepRing', sleepDone / sleepTotal, '#3b82f6');

        // Mindfulness (Meditate)
        let mindful = 0;
        const mindfulTarget = 7;
        Object.values(week.entries).forEach(entry => {
            if (entry.goal.name.includes('Meditate')) {
                mindful = entry.tracking.filter(v => v === 'X' || v === 'x').length;
            }
        });
        document.getElementById('mindfulCount').textContent = `${mindful}/${mindfulTarget}`;
        this.drawRing('mindfulRing', mindful / mindfulTarget, '#8b5cf6');

        // Substances (Zyns + alcohol)
        let substancesClean = 0;
        let substancesTotal = 0;
        Object.values(week.entries).forEach(entry => {
            if (entry.goal.name.includes('Zyn') || entry.goal.name.includes('drink')) {
                entry.tracking.forEach(v => {
                    if (v !== '') substancesTotal++;
                    if (v === 'X' || v === 'x') substancesClean++;
                });
            }
        });
        const substPct = substancesTotal > 0 ? Math.round((substancesClean / substancesTotal) * 100) : 0;
        document.getElementById('substanceScore').textContent = substPct + '%';
        this.drawRing('substanceRing', substancesClean / Math.max(substancesTotal, 1), '#22c55e');
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
        document.getElementById('addHabitBtn').addEventListener('click', () => this.openModal('addHabitModal'));

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

    renderHabits() {
        document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
        });

        const checklist = document.getElementById('habitsChecklist');
        const week = this.getCurrentWeek();

        if (!week) {
            checklist.innerHTML = '<div class="empty-state">No active week. Go to Goals and click "+ New Week" first.</div>';
            this.renderAdhocTasks();
            return;
        }

        // Get today's day index (0=Sun, 1=Mon, ..., 6=Sat)
        const todayDayIdx = new Date().getDay();

        // Group entries by category, show protocol categories first
        const protocolCats = ['Morning Protocol', 'Midday Protocol', 'Evening Protocol'];
        const grouped = {};
        Object.entries(week.entries).forEach(([idx, entry]) => {
            const cat = entry.goal.category;
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ idx: parseInt(idx), ...entry });
        });

        // Show protocol categories as today's checklist
        const catsToShow = [...protocolCats, ...Object.keys(grouped).filter(c => !protocolCats.includes(c))];

        let html = '';
        catsToShow.forEach(cat => {
            const entries = grouped[cat];
            if (!entries || entries.length === 0) return;

            const doneCount = entries.filter(e => {
                const val = e.tracking[todayDayIdx];
                return val === 'X' || val === 'x' || val === '1';
            }).length;

            html += `<div class="protocol-group">
                <div class="protocol-header">
                    <span class="protocol-label">${cat}</span>
                    <span class="protocol-progress">${doneCount}/${entries.length}</span>
                </div>`;

            entries.forEach(entry => {
                const val = entry.tracking[todayDayIdx];
                const done = val === 'X' || val === 'x' || val === '1';
                html += `<div class="habit-check-item">
                    <div class="habit-checkbox ${done ? 'checked' : ''}" data-entry-idx="${entry.idx}" data-day="${todayDayIdx}">${done ? '\u2713' : ''}</div>
                    <span class="habit-name ${done ? 'completed' : ''}">${this.escapeHtml(entry.goal.name)}</span>
                </div>`;
            });
            html += '</div>';
        });

        checklist.innerHTML = html;

        // Click to toggle today's cell in the weekly grid
        checklist.querySelectorAll('.habit-checkbox').forEach(cb => {
            cb.addEventListener('click', () => {
                const entryIdx = cb.dataset.entryIdx;
                const dayIdx = parseInt(cb.dataset.day);
                const entry = week.entries[entryIdx];
                if (!entry) return;

                const current = entry.tracking[dayIdx];
                entry.tracking[dayIdx] = (current === 'X' || current === 'x') ? '' : 'X';
                this.saveData();
                this.renderHabits();
            });
        });

        this.renderAdhocTasks();
        this.renderStreaks();
        this.renderHeatmap();
    }

    renderStreaks() {
        const container = document.getElementById('streaksGrid');
        const week = this.getCurrentWeek();
        if (!week) { container.innerHTML = ''; return; }

        // Calculate streaks from the current week's data
        const todayDayIdx = new Date().getDay();
        const streaks = [];

        Object.entries(week.entries).forEach(([idx, entry]) => {
            let streak = 0;
            // Count consecutive days back from today
            for (let i = todayDayIdx; i >= 0; i--) {
                const val = entry.tracking[i];
                if (val === 'X' || val === 'x' || val === '1') {
                    streak++;
                } else {
                    break;
                }
            }
            if (streak > 0) {
                streaks.push({ name: entry.goal.name, streak });
            }
        });

        streaks.sort((a, b) => b.streak - a.streak);

        container.innerHTML = streaks.slice(0, 10).map(s => `
            <div class="streak-card">
                <div class="streak-count">${s.streak}</div>
                <div class="streak-label">days this week</div>
                <div class="streak-name">${this.escapeHtml(s.name)}</div>
            </div>
        `).join('') || '<div class="empty-state" style="padding:12px;font-size:0.85rem;">Start checking off items to build streaks.</div>';
    }

    renderHeatmap() {
        const container = document.getElementById('habitHeatmap');
        const week = this.getCurrentWeek();
        if (!week) { container.innerHTML = ''; return; }

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayDayIdx = new Date().getDay();

        // Show heatmap for protocol items only (keep it compact)
        const protocolCats = ['Morning Protocol', 'Midday Protocol', 'Evening Protocol'];
        let html = '';

        Object.entries(week.entries).forEach(([idx, entry]) => {
            if (!protocolCats.includes(entry.goal.category)) return;
            html += `<div class="heatmap-row">
                <span class="heatmap-label">${this.escapeHtml(entry.goal.name)}</span>
                <div class="heatmap-cells">`;
            for (let i = 0; i < 7; i++) {
                const val = entry.tracking[i];
                const done = val === 'X' || val === 'x' || val === '1';
                const isToday = i === todayDayIdx;
                const cls = done ? 'done' : (i <= todayDayIdx ? 'missed' : '');
                html += `<div class="heatmap-cell ${cls} ${isToday ? 'today' : ''}" title="${days[i]}">${days[i][0]}</div>`;
            }
            html += '</div></div>';
        });

        container.innerHTML = html || '<div class="empty-state" style="padding:12px;font-size:0.85rem;">No protocol items found.</div>';
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

        // Review scores from current week
        this.renderReviewScores();
        this.renderPastReviews();
    }

    renderReviewScores() {
        const container = document.getElementById('reviewScores');
        const week = this.getCurrentWeek();
        if (!week) {
            container.innerHTML = '';
            return;
        }

        const catStats = {};
        Object.values(week.entries).forEach(entry => {
            const cat = entry.goal.category;
            if (!catStats[cat]) catStats[cat] = { completed: 0, total: 0, strikes: 0 };
            entry.tracking.forEach(v => {
                if (v !== '') catStats[cat].total++;
                if (v === 'X' || v === 'x') catStats[cat].completed++;
                if (v === '1') catStats[cat].strikes++;
            });
        });

        container.innerHTML = Object.entries(catStats).map(([cat, s]) => {
            const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
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

        // Add Transaction
        document.getElementById('addTransactionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const txn = {
                id: 'txn_' + Date.now(),
                date: document.getElementById('txnDate').value,
                description: document.getElementById('txnDescription').value.trim(),
                category: document.getElementById('txnCategory').value,
                amount: parseFloat(document.getElementById('txnAmount').value),
                type: document.querySelector('input[name="txnType"]:checked').value,
                account: document.getElementById('txnAccount').value.trim(),
                source: 'manual'
            };

            this.data.transactions.unshift(txn);
            this.data.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.saveData();
            this.logActivity(`Added ${txn.type}: $${txn.amount.toFixed(2)} - ${txn.description}`);
            this.closeModal('addTransactionModal');
            document.getElementById('addTransactionForm').reset();
            this.renderFinances();
        });

        // Add Habit
        document.getElementById('addHabitForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const habit = {
                id: 'h_' + Date.now(),
                name: document.getElementById('habitName').value.trim(),
                frequency: document.getElementById('habitFrequency').value,
                category: document.getElementById('habitCategory').value
            };

            this.data.habits.push(habit);
            this.saveData();
            this.logActivity(`Added habit: ${habit.name}`);
            this.closeModal('addHabitModal');
            document.getElementById('addHabitForm').reset();
            this.renderHabits();
        });

        // Add Account
        document.getElementById('addAccountForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const account = {
                id: 'acc_' + Date.now(),
                name: document.getElementById('accountName').value.trim(),
                type: document.getElementById('accountType').value,
                balance: parseFloat(document.getElementById('accountBalance').value)
            };

            this.data.accounts.push(account);
            this.saveData();
            this.logActivity(`Added account: ${account.name}`);
            this.closeModal('addAccountModal');
            document.getElementById('addAccountForm').reset();
            this.renderFinances();
        });

        // Edit Budget
        document.getElementById('editBudgetForm').addEventListener('submit', (e) => {
            e.preventDefault();
            document.querySelectorAll('[data-budget-cat]').forEach(input => {
                const cat = input.dataset.budgetCat;
                const val = parseFloat(input.value);
                if (!isNaN(val)) {
                    this.data.settings.defaultBudgets[cat] = val;
                }
            });
            this.saveData();
            this.logActivity('Updated budget');
            this.closeModal('editBudgetModal');
            this.renderFinances();
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
                    case 'add-expense':
                        document.getElementById('txnDate').value = this.getTodayStr();
                        this.openModal('addTransactionModal');
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
        });

        // Convex connection
        document.getElementById('connectConvexBtn').addEventListener('click', () => {
            const url = document.getElementById('convexUrlInput').value.trim();
            if (!url) {
                alert('Please enter a Convex deployment URL');
                return;
            }
            localStorage.setItem('lifeOS_convexUrl', url);
            this.convex = new ConvexDataLayer(url);
            this.convex.on('connected', () => {
                this.updateConvexStatusUI();
            });
            setTimeout(() => this.updateConvexStatusUI(), 2000);
        });

        document.getElementById('syncToConvexBtn').addEventListener('click', async () => {
            if (!this.convex || !this.convex.isConnected()) {
                alert('Not connected to Convex');
                return;
            }
            const btn = document.getElementById('syncToConvexBtn');
            btn.textContent = 'Syncing...';
            btn.disabled = true;
            const success = await this.convex.syncFromLocalStorage(this.data);
            btn.textContent = success ? 'Sync Complete!' : 'Sync Failed';
            btn.disabled = false;
            if (success) {
                this.logActivity('Synced all data to Convex backend');
            }
        });

        document.getElementById('syncFromTrackerBtn').addEventListener('click', () => this.importFromAccountabilityTracker());

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
                    this.data = imported;
                    this.saveData();
                    this.logActivity('Restored from backup');
                    location.reload();
                } catch (err) {
                    alert('Error importing: ' + err.message);
                }
            };
            reader.readAsText(file);
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

    updateConvexStatusUI() {
        const statusEl = document.getElementById('convexStatus');
        const syncBtn = document.getElementById('syncToConvexBtn');
        const urlInput = document.getElementById('convexUrlInput');
        const savedUrl = localStorage.getItem('lifeOS_convexUrl');

        if (savedUrl) urlInput.value = savedUrl;

        if (this.convex && this.convex.isConnected()) {
            statusEl.textContent = 'Connected to Convex';
            statusEl.style.color = 'var(--success)';
            syncBtn.style.display = 'inline-block';
        } else if (savedUrl) {
            statusEl.textContent = 'Connecting...';
            statusEl.style.color = 'var(--warning)';
            syncBtn.style.display = 'none';
        } else {
            statusEl.textContent = 'Not connected - using local storage';
            statusEl.style.color = 'var(--text-muted)';
            syncBtn.style.display = 'none';
        }
    }

    // ========================================
    // Utilities
    // ========================================
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
