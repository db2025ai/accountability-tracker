// Accountability Tracker Dashboard Application

class AccountabilityTracker {
    constructor() {
        this.data = {
            weeks: [],
            goals: [],
            categories: [
                'Physical Health',
                'Mental Health',
                'Budgeting',
                'Work',
                'Monthly Goals',
                'Cooking',
                'Other'
            ]
        };
        this.currentWeekIndex = 0;
        this.charts = {};
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.render();
        this.renderCharts();
    }

    // Data Persistence (Memory)
    saveData() {
        localStorage.setItem('accountabilityData', JSON.stringify(this.data));
        console.log('Data saved to local storage');
    }

    loadData() {
        const stored = localStorage.getItem('accountabilityData');
        if (stored) {
            this.data = JSON.parse(stored);
            console.log('Data loaded from local storage');
        } else {
            // Initialize with default goals
            this.initializeDefaultGoals();
        }

        // Ensure we have at least one week
        if (this.data.weeks.length === 0) {
            this.createNewWeek();
        }

        // Set current week to the most recent
        this.currentWeekIndex = this.data.weeks.length - 1;
    }

    initializeDefaultGoals() {
        this.data.goals = [
            { category: 'Physical Health', name: 'Cardio Work Outs', target: 'x2' },
            { category: 'Physical Health', name: 'Strength Work Outs', target: 'x2' },
            { category: 'Physical Health', name: 'Weeknight Drinking', target: 'x1, Max 2 Drinks' },
            { category: 'Physical Health', name: 'Weekend Drinking', target: 'Max 8 drinks, max 4 in 1 day' },
            { category: 'Physical Health', name: 'No Zyns', target: '' },
            { category: 'Physical Health', name: 'In bed by 11:30PM on weeknights', target: '' },
            { category: 'Physical Health', name: 'Awake by 7:30AM on weekdays', target: '' },

            { category: 'Mental Health', name: 'Meditate', target: 'x4' },
            { category: 'Mental Health', name: 'Gratitude Journal', target: 'x7' },
            { category: 'Mental Health', name: 'Read 50 pages of non-fiction', target: '' },
            { category: 'Mental Health', name: 'Max 30 minutes of Instagram per day', target: '' },

            { category: 'Budgeting', name: 'Buy breakfast', target: 'x1 per week' },
            { category: 'Budgeting', name: 'Buy lunch', target: 'x2 per weekdays' },
            { category: 'Budgeting', name: 'Buy dinner', target: 'x2 per weekdays' },
            { category: 'Budgeting', name: 'Buy lunch', target: 'x1 per weekend' },
            { category: 'Budgeting', name: 'Buy dinner', target: 'x1 per weekend' },

            { category: 'Work', name: 'Begin active work by 9:30AM each day', target: '' },
            { category: 'Work', name: 'Time block each day, intent to better plan day', target: '' },

            { category: 'Other', name: 'Finish 1 storyworth for Dad per day', target: '' },
            { category: 'Other', name: 'Set week specific goals Sunday night', target: '' }
        ];
    }

    createNewWeek() {
        const today = new Date();
        // Find the most recent Sunday
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - today.getDay());

        const weekData = {
            startDate: sunday.toISOString(),
            days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            entries: {}
        };

        // Initialize entries for all goals
        this.data.goals.forEach((goal, index) => {
            weekData.entries[index] = {
                goal: goal,
                tracking: ['', '', '', '', '', '', ''] // 7 days
            };
        });

        this.data.weeks.push(weekData);
        this.currentWeekIndex = this.data.weeks.length - 1;
        this.saveData();
        this.render();
    }

    // CSV Import/Export
    importCSV(csvText) {
        const lines = csvText.split('\n');
        const weeks = [];
        let currentWeek = null;
        let goals = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cells = this.parseCSVLine(line);

            // Check if this is a week header (contains dates)
            if (cells[0] && cells[0].includes('Week') || this.isDateFormat(cells[1])) {
                if (currentWeek) {
                    weeks.push(currentWeek);
                }

                // Parse the week dates
                const dateStr = cells[1];
                currentWeek = {
                    startDate: this.parseDate(dateStr).toISOString(),
                    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                    entries: {}
                };
                continue;
            }

            // Check if this is the day header row
            if (cells.some(cell => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(cell))) {
                continue;
            }

            // Check if this is a category header
            if (cells[0] && this.data.categories.some(cat => cells[0].includes(cat)) && !cells[1]) {
                continue;
            }

            // Parse goal entry
            if (cells[1] && currentWeek) {
                const goalName = cells[1];
                const category = this.inferCategory(goalName, i, lines);

                // Find or create goal
                let goalIndex = goals.findIndex(g => g.name === goalName && g.category === category);
                if (goalIndex === -1) {
                    goals.push({ category, name: goalName, target: '' });
                    goalIndex = goals.length - 1;
                }

                // Parse tracking data (cells 2-8 are the days)
                const tracking = [];
                for (let d = 2; d < 9; d++) {
                    const value = cells[d] || '';
                    tracking.push(value);
                }

                currentWeek.entries[goalIndex] = {
                    goal: goals[goalIndex],
                    tracking: tracking
                };
            }
        }

        if (currentWeek) {
            weeks.push(currentWeek);
        }

        // Update data
        this.data.goals = goals;
        this.data.weeks = weeks;
        this.currentWeekIndex = weeks.length - 1;
        this.saveData();
        this.render();
        this.renderCharts();

        alert(`Successfully imported ${weeks.length} weeks and ${goals.length} goals!`);
    }

    parseCSVLine(line) {
        const cells = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                cells.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        cells.push(current.trim());
        return cells;
    }

    isDateFormat(str) {
        return /^\d{1,2}\/\d{1,2}/.test(str);
    }

    parseDate(dateStr) {
        // Handle formats like "11/2" (month/day)
        const parts = dateStr.split('/');
        if (parts.length >= 2) {
            const month = parseInt(parts[0]) - 1; // JavaScript months are 0-indexed
            const day = parseInt(parts[1]);
            const year = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();
            return new Date(year, month, day);
        }
        return new Date();
    }

    inferCategory(goalName, lineIndex, lines) {
        // Look backwards to find the category header
        for (let i = lineIndex - 1; i >= 0; i--) {
            const line = lines[i];
            for (const category of this.data.categories) {
                if (line.includes(category)) {
                    return category;
                }
            }
        }
        return 'Other';
    }

    exportCSV() {
        let csv = 'This Week\'s Date,' + this.data.weeks.map(w => {
            const date = new Date(w.startDate);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        }).join(',') + '\n';

        csv += ',,' + this.data.weeks.map(() => 'Sun,Mon,Tue,Wed,Thu,Fri,Sat').join(',') + '\n';

        this.data.categories.forEach(category => {
            csv += `\n${category}\n`;

            const goalsInCategory = this.data.goals.filter(g => g.category === category);
            goalsInCategory.forEach(goal => {
                const goalIndex = this.data.goals.indexOf(goal);
                csv += `,"${goal.name} ${goal.target}"`;

                this.data.weeks.forEach(week => {
                    const entry = week.entries[goalIndex];
                    if (entry) {
                        csv += ',' + entry.tracking.join(',');
                    } else {
                        csv += ',,,,,,,';
                    }
                });
                csv += '\n';
            });
        });

        return csv;
    }

    downloadCSV() {
        const csv = this.exportCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `accountability-tracker-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }

    // Event Listeners
    setupEventListeners() {
        // Import/Export
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('csvFileInput').click();
        });

        document.getElementById('csvFileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.importCSV(event.target.result);
                };
                reader.readAsText(file);
            }
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.downloadCSV();
        });

        // Week Navigation
        document.getElementById('prevWeek').addEventListener('click', () => {
            if (this.currentWeekIndex > 0) {
                this.currentWeekIndex--;
                this.render();
            }
        });

        document.getElementById('nextWeek').addEventListener('click', () => {
            if (this.currentWeekIndex < this.data.weeks.length - 1) {
                this.currentWeekIndex++;
                this.render();
            }
        });

        document.getElementById('todayBtn').addEventListener('click', () => {
            this.currentWeekIndex = this.data.weeks.length - 1;
            this.render();
        });

        document.getElementById('newWeekBtn').addEventListener('click', () => {
            this.createNewWeek();
        });

        // Add Goal Modal
        document.getElementById('addGoalBtn').addEventListener('click', () => {
            document.getElementById('addGoalModal').classList.add('active');
        });

        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('addGoalModal').classList.remove('active');
        });

        document.getElementById('addGoalForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const category = document.getElementById('goalCategory').value;
            const name = document.getElementById('goalName').value;
            const target = document.getElementById('goalTarget').value;

            this.addGoal(category, name, target);
            document.getElementById('addGoalModal').classList.remove('active');
            document.getElementById('addGoalForm').reset();
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('addGoalModal');
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }

    addGoal(category, name, target) {
        const newGoal = { category, name, target };
        this.data.goals.push(newGoal);

        // Add entry for this goal to all weeks
        const goalIndex = this.data.goals.length - 1;
        this.data.weeks.forEach(week => {
            week.entries[goalIndex] = {
                goal: newGoal,
                tracking: ['', '', '', '', '', '', '']
            };
        });

        this.saveData();
        this.render();
    }

    removeGoal(goalIndex) {
        if (confirm('Are you sure you want to remove this goal?')) {
            this.data.goals.splice(goalIndex, 1);

            // Remove entries from all weeks
            this.data.weeks.forEach(week => {
                delete week.entries[goalIndex];
                // Reindex entries
                const newEntries = {};
                Object.keys(week.entries).forEach(key => {
                    const idx = parseInt(key);
                    if (idx > goalIndex) {
                        newEntries[idx - 1] = week.entries[key];
                    } else {
                        newEntries[key] = week.entries[key];
                    }
                });
                week.entries = newEntries;
            });

            this.saveData();
            this.render();
        }
    }

    // Rendering
    render() {
        this.renderStats();
        this.renderCurrentWeek();
        this.renderCategories();
        this.renderHistory();
        this.renderCharts();
    }

    renderStats() {
        const currentWeek = this.data.weeks[this.currentWeekIndex];
        const currentStrikes = this.calculateWeekStrikes(currentWeek);

        const totalStrikes = this.data.weeks.reduce((sum, week) =>
            sum + this.calculateWeekStrikes(week), 0);
        const avgStrikes = this.data.weeks.length > 0 ?
            (totalStrikes / this.data.weeks.length).toFixed(1) : 0;

        const categoryStats = this.calculateCategoryStats();
        const bestCategory = categoryStats.length > 0 ?
            categoryStats[0].category : '-';

        document.getElementById('currentStrikes').textContent = currentStrikes;
        document.getElementById('totalWeeks').textContent = this.data.weeks.length;
        document.getElementById('avgStrikes').textContent = avgStrikes;
        document.getElementById('bestCategory').textContent = bestCategory;
    }

    calculateWeekStrikes(week) {
        let strikes = 0;
        Object.values(week.entries).forEach(entry => {
            entry.tracking.forEach(value => {
                if (value === '1') strikes++;
            });
        });
        return strikes;
    }

    calculateCategoryStats() {
        const stats = {};

        this.data.categories.forEach(category => {
            stats[category] = { completed: 0, total: 0 };
        });

        this.data.weeks.forEach(week => {
            Object.values(week.entries).forEach(entry => {
                const category = entry.goal.category;
                entry.tracking.forEach(value => {
                    if (value) {
                        stats[category].total++;
                        if (value.toUpperCase() === 'X') {
                            stats[category].completed++;
                        }
                    }
                });
            });
        });

        return Object.entries(stats)
            .map(([category, data]) => ({
                category,
                rate: data.total > 0 ? (data.completed / data.total * 100).toFixed(1) : 0
            }))
            .sort((a, b) => b.rate - a.rate);
    }

    renderCurrentWeek() {
        const week = this.data.weeks[this.currentWeekIndex];
        const date = new Date(week.startDate);
        document.getElementById('currentWeekDate').textContent =
            date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        let html = '<table class="week-table"><thead><tr>';
        html += '<th>Category</th><th>Goal</th>';
        week.days.forEach(day => {
            html += `<th>${day}</th>`;
        });
        html += '<th>Strikes</th></tr></thead><tbody>';

        let currentCategory = null;
        this.data.goals.forEach((goal, goalIndex) => {
            if (goal.category !== currentCategory) {
                currentCategory = goal.category;
                html += `<tr><td colspan="${week.days.length + 3}" class="category-header">${currentCategory}</td></tr>`;
            }

            const entry = week.entries[goalIndex];
            if (entry) {
                html += '<tr>';
                html += `<td></td><td class="goal-name">${goal.name} ${goal.target}</td>`;

                entry.tracking.forEach((value, dayIndex) => {
                    const statusClass = value.toUpperCase() === 'X' ? 'completed' :
                                      value === '1' ? 'missed' : '';
                    html += `<td class="day-cell ${statusClass}" data-goal="${goalIndex}" data-day="${dayIndex}"></td>`;
                });

                const strikes = entry.tracking.filter(v => v === '1').length;
                html += `<td class="strike-cell">${strikes > 0 ? strikes : ''}</td>`;
                html += '</tr>';
            }
        });

        html += '</tbody></table>';
        document.getElementById('weekGrid').innerHTML = html;

        // Add click handlers for day cells
        document.querySelectorAll('.day-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const goalIndex = parseInt(e.target.dataset.goal);
                const dayIndex = parseInt(e.target.dataset.day);
                this.toggleDayValue(goalIndex, dayIndex);
            });
        });
    }

    toggleDayValue(goalIndex, dayIndex) {
        const week = this.data.weeks[this.currentWeekIndex];
        const entry = week.entries[goalIndex];

        if (entry) {
            const currentValue = entry.tracking[dayIndex];
            // Cycle through: empty -> X (completed) -> 1 (missed) -> empty
            if (!currentValue) {
                entry.tracking[dayIndex] = 'X';
            } else if (currentValue.toUpperCase() === 'X') {
                entry.tracking[dayIndex] = '1';
            } else {
                entry.tracking[dayIndex] = '';
            }

            this.saveData();
            this.renderCurrentWeek();
            this.renderStats();
            this.renderCharts();
        }
    }

    renderCategories() {
        let html = '';

        this.data.categories.forEach(category => {
            const goalsInCategory = this.data.goals.filter(g => g.category === category);
            if (goalsInCategory.length > 0) {
                html += `<div class="category-section">`;
                html += `<h3>${category}</h3>`;

                goalsInCategory.forEach(goal => {
                    const goalIndex = this.data.goals.indexOf(goal);
                    html += `<div class="goal-item">`;
                    html += `<span>${goal.name} ${goal.target}</span>`;
                    html += `<button onclick="tracker.removeGoal(${goalIndex})">Remove</button>`;
                    html += `</div>`;
                });

                html += `</div>`;
            }
        });

        document.getElementById('categoriesList').innerHTML = html;
    }

    renderHistory() {
        let html = '';

        // Show last 10 weeks
        const recentWeeks = this.data.weeks.slice(-10).reverse();

        recentWeeks.forEach((week, index) => {
            const date = new Date(week.startDate);
            const strikes = this.calculateWeekStrikes(week);
            const dateStr = date.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });

            html += `<div class="history-item">`;
            html += `<h4>Week of ${dateStr}</h4>`;
            html += `<p>Total Strikes: ${strikes}</p>`;
            html += `</div>`;
        });

        document.getElementById('historyList').innerHTML = html;
    }

    renderCharts() {
        this.renderStrikesOverTimeChart();
        this.renderCategoryBreakdownChart();
        this.renderCompletionRateChart();
        this.renderWeekdayPatternChart();
    }

    renderStrikesOverTimeChart() {
        const ctx = document.getElementById('strikesOverTimeChart');
        if (!ctx) return;

        const labels = this.data.weeks.map(week => {
            const date = new Date(week.startDate);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });

        const data = this.data.weeks.map(week => this.calculateWeekStrikes(week));

        if (this.charts.strikesOverTime) {
            this.charts.strikesOverTime.destroy();
        }

        this.charts.strikesOverTime = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Weekly Strikes',
                    data: data,
                    borderColor: '#f5222d',
                    backgroundColor: 'rgba(245, 34, 45, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Strikes Over Time'
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderCategoryBreakdownChart() {
        const ctx = document.getElementById('categoryBreakdownChart');
        if (!ctx) return;

        const categoryStats = this.calculateCategoryStats();
        const labels = categoryStats.map(s => s.category);
        const data = categoryStats.map(s => parseFloat(s.rate));

        if (this.charts.categoryBreakdown) {
            this.charts.categoryBreakdown.destroy();
        }

        this.charts.categoryBreakdown = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Completion Rate (%)',
                    data: data,
                    backgroundColor: [
                        '#4a90e2',
                        '#7b68ee',
                        '#52c41a',
                        '#faad14',
                        '#f5222d',
                        '#13c2c2',
                        '#eb2f96'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Completion Rate by Category'
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    renderCompletionRateChart() {
        const ctx = document.getElementById('completionRateChart');
        if (!ctx) return;

        let totalCompleted = 0;
        let totalMissed = 0;
        let totalEmpty = 0;

        this.data.weeks.forEach(week => {
            Object.values(week.entries).forEach(entry => {
                entry.tracking.forEach(value => {
                    if (value.toUpperCase() === 'X') totalCompleted++;
                    else if (value === '1') totalMissed++;
                    else if (value === '') totalEmpty++;
                });
            });
        });

        if (this.charts.completionRate) {
            this.charts.completionRate.destroy();
        }

        this.charts.completionRate = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Missed', 'Not Tracked'],
                datasets: [{
                    data: [totalCompleted, totalMissed, totalEmpty],
                    backgroundColor: ['#52c41a', '#f5222d', '#d9d9d9']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Overall Completion Rate'
                    }
                }
            }
        });
    }

    renderWeekdayPatternChart() {
        const ctx = document.getElementById('weekdayPatternChart');
        if (!ctx) return;

        const dayStats = {
            'Sunday': { completed: 0, missed: 0 },
            'Monday': { completed: 0, missed: 0 },
            'Tuesday': { completed: 0, missed: 0 },
            'Wednesday': { completed: 0, missed: 0 },
            'Thursday': { completed: 0, missed: 0 },
            'Friday': { completed: 0, missed: 0 },
            'Saturday': { completed: 0, missed: 0 }
        };

        this.data.weeks.forEach(week => {
            Object.values(week.entries).forEach(entry => {
                entry.tracking.forEach((value, dayIndex) => {
                    const dayName = week.days[dayIndex];
                    if (value.toUpperCase() === 'X') {
                        dayStats[dayName].completed++;
                    } else if (value === '1') {
                        dayStats[dayName].missed++;
                    }
                });
            });
        });

        const labels = Object.keys(dayStats);
        const completedData = labels.map(day => dayStats[day].completed);
        const missedData = labels.map(day => dayStats[day].missed);

        if (this.charts.weekdayPattern) {
            this.charts.weekdayPattern.destroy();
        }

        this.charts.weekdayPattern = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Completed',
                        data: completedData,
                        backgroundColor: '#52c41a'
                    },
                    {
                        label: 'Missed',
                        data: missedData,
                        backgroundColor: '#f5222d'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Performance by Day of Week'
                    }
                },
                scales: {
                    x: {
                        stacked: false
                    },
                    y: {
                        stacked: false,
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// Initialize the tracker
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    tracker = new AccountabilityTracker();
});
