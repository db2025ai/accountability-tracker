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
            categories: ['Physical Health', 'Mental Health', 'Budgeting', 'Work', 'Monthly', 'Cooking', 'Other'],
            weeks: [],
            transactions: [],
            accounts: [],
            budgets: {},
            habits: this.getDefaultHabits(),
            habitLog: {},       // { 'YYYY-MM-DD': { habitId: true/false } }
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
            { category: 'Physical Health', name: '2 Strength Training', target: 'x2' },
            { category: 'Physical Health', name: '2 Cardio Training (1 swim)', target: 'x2' },
            { category: 'Physical Health', name: '10 Min Stretching/Mobility', target: 'daily' },
            { category: 'Physical Health', name: 'Core Work Out', target: 'x1' },
            { category: 'Physical Health', name: 'No Zyns', target: 'daily' },
            { category: 'Physical Health', name: 'In bed by 11:15PM weeknights', target: 'weeknights' },
            { category: 'Physical Health', name: '1 night of up to 2 drinks', target: 'x1 max' },
            { category: 'Mental Health', name: 'Meditate', target: 'x7' },
            { category: 'Mental Health', name: 'Gratitude Journal', target: 'x7' },
            { category: 'Mental Health', name: 'Written Journaling 10 min', target: 'x2' },
            { category: 'Mental Health', name: 'Read 50 pages non-fiction or 2 audiobook chapters', target: 'weekly' },
            { category: 'Mental Health', name: 'Read 1 parenting book chapter/article', target: 'weekly' },
            { category: 'Mental Health', name: 'Read 10 min morning/evening', target: 'daily' },
            { category: 'Mental Health', name: 'Max 15 min Instagram/day', target: 'daily' },
            { category: 'Mental Health', name: 'Set week goals on Monday', target: 'weekly' },
            { category: 'Mental Health', name: 'Review strikes daily', target: 'daily' },
            { category: 'Budgeting', name: 'Buy breakfast max x1/week', target: 'x1' },
            { category: 'Budgeting', name: 'Buy lunch max x2/weekdays', target: 'x2' },
            { category: 'Budgeting', name: 'Buy dinner max x2/weekdays', target: 'x2' },
            { category: 'Budgeting', name: 'Buy lunch max x1/weekend', target: 'x1' },
            { category: 'Budgeting', name: 'Buy dinner max x1/weekend', target: 'x1' },
            { category: 'Budgeting', name: 'Review expenses 5 min daily', target: 'daily' },
            { category: 'Work', name: 'Begin active work by 9:30AM', target: 'daily' },
            { category: 'Work', name: 'Time block each day', target: 'daily' },
            { category: 'Work', name: '90 min focused work or 4 pomodoro blocks', target: 'daily' },
            { category: 'Work', name: '15 min AI training', target: 'daily' },
            { category: 'Monthly', name: 'Review financial health', target: 'monthly' },
            { category: 'Monthly', name: 'Check-in with Chelsey', target: 'monthly' },
            { category: 'Monthly', name: '1 networking event', target: 'monthly' },
            { category: 'Monthly', name: '2 planned date nights', target: 'monthly' },
            { category: 'Cooking', name: 'Cook 1 new meal/week', target: 'weekly' },
            { category: 'Cooking', name: 'Read 10 pages cookbook/week', target: 'weekly' },
        ];
    }

    getDefaultHabits() {
        return [
            { id: 'h1', name: 'Meditate', frequency: 'daily', category: 'mindfulness' },
            { id: 'h2', name: 'Gratitude Journal', frequency: 'daily', category: 'mindfulness' },
            { id: 'h3', name: 'Read 10 minutes', frequency: 'daily', category: 'learning' },
            { id: 'h4', name: 'Stretching/Mobility', frequency: 'daily', category: 'health' },
            { id: 'h5', name: 'Review expenses', frequency: 'daily', category: 'productivity' },
            { id: 'h6', name: 'Review strikes', frequency: 'daily', category: 'productivity' },
            { id: 'h7', name: 'In bed by 11:15PM', frequency: 'weekdays', category: 'health' },
            { id: 'h8', name: 'No Zyns', frequency: 'daily', category: 'health' },
            { id: 'h9', name: 'Max 15 min Instagram', frequency: 'daily', category: 'mindfulness' },
            { id: 'h10', name: 'Evening Reflection', frequency: 'daily', category: 'mindfulness' },
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
            if (trackerData.goals) {
                this.data.goals = trackerData.goals;
            }
            if (trackerData.weeks) {
                this.data.weeks = trackerData.weeks;
            }
            if (trackerData.categories) {
                this.data.categories = trackerData.categories;
            }
            this.saveData();
            this.logActivity('Imported data from Accountability Tracker');
            this.renderGoals();
            alert('Data imported successfully from Accountability Tracker!');
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
                const csv = e.target.result;
                const lines = csv.split('\n');
                if (lines.length < 2) {
                    alert('CSV file appears empty.');
                    return;
                }

                // Parse header
                const headers = this.parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
                const dateIdx = headers.findIndex(h => h === 'date');
                const descIdx = headers.findIndex(h => h === 'merchant' || h === 'description' || h === 'original statement');
                const catIdx = headers.findIndex(h => h === 'category');
                const amountIdx = headers.findIndex(h => h === 'amount');
                const accountIdx = headers.findIndex(h => h === 'account');
                const notesIdx = headers.findIndex(h => h === 'notes' || h === 'note');

                if (dateIdx === -1 || amountIdx === -1) {
                    alert('Could not find required columns (Date, Amount) in the CSV. Found headers: ' + headers.join(', '));
                    return;
                }

                let imported = 0;
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const fields = this.parseCSVLine(line);
                    const date = fields[dateIdx]?.trim();
                    const amount = parseFloat(fields[amountIdx]?.replace(/[$,]/g, '') || '0');
                    const desc = fields[descIdx >= 0 ? descIdx : 0]?.trim() || 'Unknown';
                    const cat = fields[catIdx >= 0 ? catIdx : -1]?.trim() || 'Other';
                    const account = fields[accountIdx >= 0 ? accountIdx : -1]?.trim() || '';

                    if (!date || isNaN(amount)) continue;

                    // Monarch uses negative for expenses, positive for income
                    const txn = {
                        id: 'txn_' + Date.now() + '_' + i,
                        date: date,
                        description: desc,
                        category: cat,
                        amount: Math.abs(amount),
                        type: amount < 0 ? 'expense' : 'income',
                        account: account,
                        source: 'monarch'
                    };

                    this.data.transactions.push(txn);
                    imported++;
                }

                // Sort by date descending
                this.data.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

                // Update category filter options
                this.updateTxnCategoryFilter();

                this.saveData();
                this.logActivity(`Imported ${imported} transactions from Monarch`);
                this.renderFinances();
                alert(`Successfully imported ${imported} transactions from Monarch!`);
            } catch (err) {
                alert('Error parsing CSV: ' + err.message);
            }
        };
        reader.readAsText(file);
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
    // Habits Section
    // ========================================
    bindHabits() {
        document.getElementById('addHabitBtn').addEventListener('click', () => this.openModal('addHabitModal'));
    }

    renderHabits() {
        const today = this.getTodayStr();
        document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
        });

        const todayLog = this.data.habitLog[today] || {};
        const checklist = document.getElementById('habitsChecklist');

        checklist.innerHTML = this.data.habits.map(h => {
            const done = todayLog[h.id] || false;
            return `<div class="habit-check-item">
                <div class="habit-checkbox ${done ? 'checked' : ''}" data-habit="${h.id}">${done ? '\u2713' : ''}</div>
                <span class="habit-name ${done ? 'completed' : ''}">${this.escapeHtml(h.name)}</span>
                <span class="habit-category-tag">${h.category}</span>
            </div>`;
        }).join('');

        checklist.querySelectorAll('.habit-checkbox').forEach(cb => {
            cb.addEventListener('click', () => {
                const id = cb.dataset.habit;
                if (!this.data.habitLog[today]) this.data.habitLog[today] = {};
                this.data.habitLog[today][id] = !this.data.habitLog[today][id];
                this.saveData();
                this.renderHabits();
            });
        });

        this.renderStreaks();
        this.renderHeatmap();
    }

    renderStreaks() {
        const container = document.getElementById('streaksGrid');
        const today = new Date();

        const streaks = this.data.habits.map(h => {
            let streak = 0;
            for (let i = 0; i < 365; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const key = this.dateToStr(d);
                const log = this.data.habitLog[key];
                if (log && log[h.id]) {
                    streak++;
                } else {
                    break;
                }
            }
            return { ...h, streak };
        }).sort((a, b) => b.streak - a.streak);

        container.innerHTML = streaks.map(s => `
            <div class="streak-card">
                <div class="streak-count">${s.streak}</div>
                <div class="streak-label">day streak</div>
                <div class="streak-name">${this.escapeHtml(s.name)}</div>
            </div>
        `).join('');
    }

    renderHeatmap() {
        const container = document.getElementById('habitHeatmap');
        const today = new Date();

        let html = '';
        this.data.habits.forEach(h => {
            html += `<div class="heatmap-row">
                <span class="heatmap-label">${this.escapeHtml(h.name)}</span>
                <div class="heatmap-cells">`;
            for (let i = 29; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const key = this.dateToStr(d);
                const log = this.data.habitLog[key];
                const done = log && log[h.id];
                const cls = done ? 'done' : (log ? 'missed' : '');
                const title = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                html += `<div class="heatmap-cell ${cls}" title="${title}"></div>`;
            }
            html += '</div></div>';
        });

        container.innerHTML = html;
    }

    // ========================================
    // Journal Section (includes Stoic Evening Reflection)
    // ========================================
    bindJournal() {
        const prompts = {
            free: '',
            gratitude: 'What are 3 things you are grateful for today?',
            reflection: 'What did you learn today? What challenged you?',
            goals: 'How did you progress toward your goals today? What adjustments are needed?',
            stoic: 'Seneca\'s Evening Review: "I examine my entire day and go back over what I\'ve done and said, hiding nothing from myself and passing nothing by."'
        };

        document.querySelectorAll('.prompt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.prompt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const type = btn.dataset.prompt;
                document.getElementById('journalPrompt').textContent = prompts[type] || '';

                // If stoic mode, show the evening reflection form
                if (type === 'stoic') {
                    this.showEveningReflection();
                } else {
                    this.hideEveningReflection();
                }
            });
        });

        document.getElementById('saveJournalBtn').addEventListener('click', () => this.saveJournalEntry());
        document.getElementById('saveEveningReflectionBtn')?.addEventListener('click', () => this.saveEveningReflection());
    }

    showEveningReflection() {
        document.getElementById('journalTextarea').style.display = 'none';
        document.getElementById('journalMood').parentElement.style.display = 'none';

        let container = document.getElementById('eveningReflectionForm');
        if (!container) {
            container = document.createElement('div');
            container.id = 'eveningReflectionForm';
            container.innerHTML = `
                <div style="background:var(--border-light);border-radius:var(--radius-sm);padding:16px;margin-bottom:12px;">
                    <p style="font-style:italic;color:var(--text-muted);font-size:0.85rem;margin-bottom:12px;">
                        "Every night before going to sleep, we must ask ourselves: what weakness did I overcome today? What virtue did I acquire?" - Seneca
                    </p>
                    <div style="margin-bottom:12px;">
                        <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px;">What went well today? What am I proud of?</label>
                        <textarea id="stoicWentWell" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:0.85rem;resize:vertical;" placeholder="Celebrate the wins, however small..."></textarea>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px;">Where did I fall short? What could I improve?</label>
                        <textarea id="stoicFellShort" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:0.85rem;resize:vertical;" placeholder="Be honest but compassionate with yourself..."></textarea>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px;">What am I grateful for today? (3 things)</label>
                        <textarea id="stoicGratitude" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:0.85rem;resize:vertical;" placeholder="1. \n2. \n3. "></textarea>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px;">Did I live according to my values today? (Rate 1-10)</label>
                        <div id="stoicValuesRating" style="display:flex;gap:6px;">
                            ${[1,2,3,4,5,6,7,8,9,10].map(n => `<button class="rating-btn stoic-rating-btn" data-rating="${n}" style="width:36px;height:36px;border:2px solid var(--border);border-radius:6px;background:var(--card-bg);cursor:pointer;font-weight:600;font-size:0.85rem;">${n}</button>`).join('')}
                        </div>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px;">What is my intention for tomorrow?</label>
                        <textarea id="stoicIntention" rows="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:0.85rem;resize:vertical;" placeholder="What one thing will I focus on?"></textarea>
                    </div>
                    <button class="btn btn-primary" id="saveEveningReflectionBtn" style="width:100%;">Save Evening Reflection</button>
                </div>
            `;
            document.getElementById('journalTextarea').parentElement.insertBefore(container, document.getElementById('journalTextarea').nextSibling);

            // Bind rating buttons
            container.querySelectorAll('.stoic-rating-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    container.querySelectorAll('.stoic-rating-btn').forEach(b => {
                        b.style.background = 'var(--card-bg)';
                        b.style.color = 'var(--text)';
                        b.style.borderColor = 'var(--border)';
                    });
                    btn.style.background = 'var(--primary)';
                    btn.style.color = 'white';
                    btn.style.borderColor = 'var(--primary)';
                });
            });

            // Bind save
            document.getElementById('saveEveningReflectionBtn').addEventListener('click', () => this.saveEveningReflection());
        }

        container.style.display = 'block';
    }

    hideEveningReflection() {
        document.getElementById('journalTextarea').style.display = '';
        document.getElementById('journalMood').parentElement.style.display = '';
        const container = document.getElementById('eveningReflectionForm');
        if (container) container.style.display = 'none';
    }

    saveEveningReflection() {
        const wentWell = document.getElementById('stoicWentWell')?.value?.trim();
        const fellShort = document.getElementById('stoicFellShort')?.value?.trim();
        const gratitude = document.getElementById('stoicGratitude')?.value?.trim();
        const intention = document.getElementById('stoicIntention')?.value?.trim();

        const ratingBtn = document.querySelector('.stoic-rating-btn[style*="var(--primary)"]');
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
            text: `**Evening Reflection**\n\n**What went well:** ${wentWell || '-'}\n\n**Where I fell short:** ${fellShort || '-'}\n\n**Gratitude:** ${gratitude || '-'}\n\n**Values Rating:** ${valuesRating || '-'}/10\n\n**Tomorrow's Intention:** ${intention || '-'}`,
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
        document.querySelectorAll('.stoic-rating-btn').forEach(b => {
            b.style.background = 'var(--card-bg)';
            b.style.color = 'var(--text)';
            b.style.borderColor = 'var(--border)';
        });

        this.renderJournal();
        alert('Evening reflection saved!');
    }

    saveJournalEntry() {
        const text = document.getElementById('journalTextarea').value.trim();
        const mood = document.getElementById('journalMood').value;
        const activePrompt = document.querySelector('.prompt-btn.active');
        const type = activePrompt ? activePrompt.dataset.prompt : 'free';

        if (!text) {
            alert('Please write something before saving.');
            return;
        }

        this.data.journalEntries.unshift({
            date: this.getTodayStr(),
            timestamp: new Date().toISOString(),
            text,
            mood,
            type
        });

        this.saveData();
        this.logActivity('Wrote a journal entry');

        document.getElementById('journalTextarea').value = '';
        document.getElementById('journalMood').value = '';
        this.renderJournal();
    }

    renderJournal() {
        const container = document.getElementById('journalEntriesList');

        if (this.data.journalEntries.length === 0) {
            container.innerHTML = '<div class="empty-state">No journal entries yet. Start writing to see your history.</div>';
            return;
        }

        container.innerHTML = this.data.journalEntries.slice(0, 20).map(entry => {
            const moodLabels = { great: 'Great', good: 'Good', okay: 'Okay', low: 'Low', rough: 'Rough' };
            const typeLabels = { free: 'Free Write', gratitude: 'Gratitude', reflection: 'Reflection', goals: 'Goal Check-in', stoic: 'Evening Reflection' };
            const borderColor = entry.type === 'stoic' ? 'var(--secondary)' : 'var(--primary)';

            return `<div class="journal-entry-card" style="border-left-color:${borderColor}">
                <div class="journal-entry-header">
                    <span class="journal-entry-date">${new Date(entry.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <div>
                        ${entry.mood ? `<span class="journal-entry-mood">${moodLabels[entry.mood] || entry.mood}</span>` : ''}
                        <span class="journal-entry-type">${typeLabels[entry.type] || entry.type}</span>
                    </div>
                </div>
                <div class="journal-entry-text">${this.formatJournalText(entry.text)}</div>
            </div>`;
        }).join('');
    }

    formatJournalText(text) {
        // Simple markdown bold
        return this.escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
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
