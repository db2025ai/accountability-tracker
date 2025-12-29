// Interactive Accountability Tracker

const GOOGLE_SHEETS_ID = '1QAqERRHCrw22hSjLFY3WBY95W2W9jBxik6Lw5jHtMy0';

// Motivational quotes
const QUOTES = [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
    { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
    { text: "The difference between who you are and who you want to be is what you do.", author: "Bill Phillips" },
    { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
    { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
    { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
    { text: "Excellence is not a destination; it is a continuous journey that never ends.", author: "Brian Tracy" },
    { text: "Success doesn't come from what you do occasionally. It comes from what you do consistently.", author: "Marie Forleo" },
    { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Anonymous" },
    { text: "Dream bigger. Do bigger.", author: "Anonymous" },
    { text: "Don't stop when you're tired. Stop when you're done.", author: "Anonymous" }
];

class InteractiveTracker {
    constructor() {
        this.data = null;
        this.displayMode = 'all'; // all, 12, 6
        this.chart = null;
        this.currentQuoteIndex = 0;
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.rotateQuote();
        this.render();
        setInterval(() => this.rotateQuote(), 15000); // Change quote every 15 seconds
    }

    async loadData() {
        // Try to load from localStorage first
        const stored = localStorage.getItem('accountabilityTrackerInteractive');

        if (stored) {
            this.data = JSON.parse(stored);
            console.log('Loaded data from localStorage');
        } else {
            // Load from master list
            try {
                const response = await fetch('master_list_clean.json');
                this.data = await response.json();
                this.saveData();
                console.log('Loaded data from master_list_clean.json');
            } catch (error) {
                console.error('Error loading data:', error);
                alert('Error loading data. Please make sure master_list_clean.json is in the same folder.');
            }
        }
    }

    saveData() {
        localStorage.setItem('accountabilityTrackerInteractive', JSON.stringify(this.data));
        this.showSaveIndicator();
    }

    showSaveIndicator() {
        const indicator = document.getElementById('saveIndicator');
        indicator.classList.add('show');
        setTimeout(() => indicator.classList.remove('show'), 2000);
    }

    rotateQuote() {
        const quote = QUOTES[this.currentQuoteIndex];
        document.getElementById('quoteText').textContent = `"${quote.text}"`;
        document.getElementById('quoteAuthor').textContent = `— ${quote.author}`;
        this.currentQuoteIndex = (this.currentQuoteIndex + 1) % QUOTES.length;
    }

    setupEventListeners() {
        // Sync to Google Sheets
        document.getElementById('syncToSheetsBtn').addEventListener('click', () => {
            this.syncToGoogleSheets();
        });

        // Add new week
        document.getElementById('addWeekBtn').addEventListener('click', () => {
            this.addNewWeek();
        });

        // Add new goal
        document.getElementById('addGoalBtn').addEventListener('click', () => {
            document.getElementById('addGoalModal').classList.add('active');
        });

        document.getElementById('cancelGoalBtn').addEventListener('click', () => {
            document.getElementById('addGoalModal').classList.remove('active');
        });

        document.getElementById('saveGoalBtn').addEventListener('click', () => {
            this.addNewGoal();
        });

        // Export CSV
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportCSV();
        });

        // View toggle
        document.getElementById('viewToggle').addEventListener('click', (e) => {
            if (this.displayMode === 'all') {
                this.displayMode = 12;
                e.target.textContent = '📊 Show Recent 12';
            } else if (this.displayMode === 12) {
                this.displayMode = 6;
                e.target.textContent = '📊 Show Recent 6';
            } else {
                this.displayMode = 'all';
                e.target.textContent = '📊 Show All Weeks';
            }
            this.renderTable();
        });
    }

    addNewWeek() {
        const lastWeek = this.data.weeks[this.data.weeks.length - 1];
        const weekName = prompt('Enter new week (e.g., 1/4-1/10):', this.getNextWeekName(lastWeek));

        if (weekName) {
            this.data.weeks.push(weekName);
            this.data.total_weeks++;

            // Add null entries for all goals for this week
            for (const category in this.data.categories) {
                this.data.categories[category].forEach(goal => {
                    goal.strikes_by_week.push(0);
                });
            }

            this.saveData();
            this.render();
            alert(`Week "${weekName}" added! Start tracking your goals.`);
        }
    }

    getNextWeekName(lastWeek) {
        // Simple helper to suggest next week name
        // This is basic - user can override
        const today = new Date();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        return `${month}/${day}-${month}/${day + 6}`;
    }

    addNewGoal() {
        const category = document.getElementById('goalCategory').value;
        const name = document.getElementById('goalName').value.trim();

        if (!name) {
            alert('Please enter a goal name');
            return;
        }

        const newGoal = {
            name: name,
            category: category,
            strikes_by_week: new Array(this.data.weeks.length).fill(0),
            total_strikes: 0,
            weeks_tracked: 0,
            first_seen: this.data.weeks[this.data.weeks.length - 1],
            last_seen: this.data.weeks[this.data.weeks.length - 1]
        };

        this.data.categories[category].push(newGoal);
        this.data.total_goals++;

        this.saveData();
        this.render();

        document.getElementById('addGoalModal').classList.remove('active');
        document.getElementById('goalName').value = '';

        alert(`Goal "${name}" added to ${category}!`);
    }

    removeGoal(category, goalIndex) {
        const goal = this.data.categories[category][goalIndex];

        if (confirm(`Remove goal "${goal.name}"?`)) {
            this.data.categories[category].splice(goalIndex, 1);
            this.data.total_goals--;
            this.saveData();
            this.render();
        }
    }

    updateStrike(category, goalIndex, weekIndex, newValue) {
        const goal = this.data.categories[category][goalIndex];
        const oldValue = goal.strikes_by_week[weekIndex];

        goal.strikes_by_week[weekIndex] = newValue;

        // Recalculate totals
        goal.total_strikes = goal.strikes_by_week.reduce((sum, val) => sum + (val || 0), 0);
        goal.weeks_tracked = goal.strikes_by_week.filter(val => val !== null).length;

        this.saveData();
        this.renderTable();
        this.renderStats();
        this.renderChart();
    }

    async syncToGoogleSheets() {
        const confirmed = confirm(
            'This will export your current data as a CSV and show instructions to upload to Google Sheets.\n\n' +
            'Note: Direct write access to Google Sheets requires authentication.\n\n' +
            'For now, we\'ll export a CSV that you can:\n' +
            '1. Download\n' +
            '2. Open in Google Sheets\n' +
            '3. Copy/paste into your existing sheet\n\n' +
            'Continue?'
        );

        if (confirmed) {
            this.exportCSV();
            alert(
                'CSV exported! To update your Google Sheet:\n\n' +
                '1. Open the downloaded CSV\n' +
                '2. Go to your Google Sheet\n' +
                '3. Create a new tab called "Updated Data"\n' +
                '4. File → Import → Upload → drag the CSV\n' +
                '5. Choose "Replace current sheet"\n\n' +
                'This preserves your original data while adding the new tab.'
            );
        }
    }

    exportCSV() {
        let csv = 'Category,Goal,Total Strikes,Weeks Tracked,First Seen,Last Seen';

        // Add week headers
        this.data.weeks.forEach(week => {
            csv += `,${week}`;
        });
        csv += '\\n';

        // Add data rows
        for (const category in this.data.categories) {
            this.data.categories[category].forEach(goal => {
                csv += `"${category}","${goal.name}",${goal.total_strikes},${goal.weeks_tracked},"${goal.first_seen}","${goal.last_seen}"`;

                goal.strikes_by_week.forEach(strikes => {
                    csv += `,${strikes === null ? '' : strikes}`;
                });
                csv += '\\n';
            });
        }

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `accountability-tracker-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }

    render() {
        this.renderStats();
        this.renderTable();
        this.renderChart();
    }

    renderStats() {
        const totalGoals = this.data.total_goals;
        const totalWeeks = this.data.total_weeks;

        let totalStrikes = 0;
        let recentWeekStrikes = 0;

        for (const category in this.data.categories) {
            this.data.categories[category].forEach(goal => {
                totalStrikes += goal.total_strikes;
                const lastStrike = goal.strikes_by_week[goal.strikes_by_week.length - 1];
                if (lastStrike !== null) {
                    recentWeekStrikes += lastStrike;
                }
            });
        }

        const avgStrikesPerWeek = (totalStrikes / totalWeeks).toFixed(1);

        const html = `
            <div class="stat-card">
                <h3>Active Goals</h3>
                <div class="value">${totalGoals}</div>
            </div>
            <div class="stat-card">
                <h3>Weeks Tracked</h3>
                <div class="value">${totalWeeks}</div>
            </div>
            <div class="stat-card">
                <h3>Avg Strikes/Week</h3>
                <div class="value">${avgStrikesPerWeek}</div>
            </div>
            <div class="stat-card">
                <h3>Current Week</h3>
                <div class="value">${recentWeekStrikes}</div>
            </div>
        `;

        document.getElementById('stats').innerHTML = html;
    }

    renderTable() {
        const weeks = this.data.weeks;
        const displayWeeksCount = this.displayMode === 'all' ? weeks.length : this.displayMode;
        const startWeek = Math.max(0, weeks.length - displayWeeksCount);
        const visibleWeeks = weeks.slice(startWeek);

        let html = '<table><thead><tr><th>Goal</th>';

        visibleWeeks.forEach(week => {
            html += `<th class="week-header">${week}</th>`;
        });
        html += '<th>Total</th></tr></thead><tbody>';

        // Render by category
        for (const category in this.data.categories) {
            const goals = this.data.categories[category];
            if (goals.length === 0) continue;

            html += `<tr><td colspan="${visibleWeeks.length + 2}" class="category-row">${category}</td></tr>`;

            goals.forEach((goal, goalIndex) => {
                html += '<tr>';
                html += `<td class="goal-name">
                    ${goal.name}
                    <button class="remove-btn" onclick="tracker.removeGoal('${category}', ${goalIndex})">✕</button>
                </td>`;

                // Show strikes for visible weeks
                const visibleStrikes = goal.strikes_by_week.slice(startWeek);
                visibleStrikes.forEach((strikes, idx) => {
                    const weekIndex = startWeek + idx;
                    let className = 'editable ';
                    let display = strikes === null ? '-' : strikes;

                    if (strikes !== null) {
                        if (strikes === 0) className += 'strike-0';
                        else if (strikes === 1) className += 'strike-1';
                        else if (strikes === 2) className += 'strike-2';
                        else if (strikes === 3) className += 'strike-3';
                        else if (strikes === 4) className += 'strike-4';
                        else className += 'strike-5-plus';
                    } else {
                        className += 'strike-null';
                    }

                    html += `<td class="${className}" onclick="tracker.editCell('${category}', ${goalIndex}, ${weekIndex}, this)">
                        <span>${display}</span>
                    </td>`;
                });

                html += `<td style="font-weight: bold; background: #e9ecef;">${goal.total_strikes}</td>`;
                html += '</tr>';
            });
        }

        html += '</tbody></table>';
        document.getElementById('tableContainer').innerHTML = html;
    }

    editCell(category, goalIndex, weekIndex, cell) {
        const span = cell.querySelector('span');
        const currentValue = span.textContent === '-' ? 0 : parseInt(span.textContent);

        // Create input
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.value = currentValue;
        input.style.width = '100%';
        input.style.textAlign = 'center';

        // Replace span with input
        span.style.display = 'none';
        cell.appendChild(input);
        input.focus();
        input.select();

        // Handle save
        const save = () => {
            const newValue = parseInt(input.value) || 0;
            this.updateStrike(category, goalIndex, weekIndex, newValue);
            input.remove();
            span.style.display = '';
        };

        input.addEventListener('blur', save);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') save();
        });
    }

    renderChart() {
        const ctx = document.getElementById('evolutionChart');

        // Calculate total strikes per week
        const weeklyTotals = new Array(this.data.weeks.length).fill(0);

        for (const category in this.data.categories) {
            this.data.categories[category].forEach(goal => {
                goal.strikes_by_week.forEach((strikes, idx) => {
                    if (strikes !== null) {
                        weeklyTotals[idx] += strikes;
                    }
                });
            });
        }

        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.data.weeks,
                datasets: [{
                    label: 'Total Strikes Per Week',
                    data: weeklyTotals,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Your Accountability Journey - Strikes Over Time',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Total Strikes'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Week'
                        }
                    }
                }
            }
        });
    }
}

// Initialize
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    tracker = new InteractiveTracker();
});
