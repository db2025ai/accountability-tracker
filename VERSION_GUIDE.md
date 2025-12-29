# Accountability Tracker - Version Guide

## 📦 Current Versions

### v1 - Clean Consolidated Dashboard (Read-Only)
**File:** `accountability-tracker-v1.html`
**Best for:** Viewing your data, analyzing trends, understanding history
- 37 consolidated goals
- 41 weeks of historical data
- Color-coded strikes table
- Evolution chart
- View toggles (all/12/6 weeks)
- **Read-only** - just for viewing

### v2 - Interactive Live Tracker
**File:** `accountability-tracker-v2.html`
**Best for:** Weekly tracking with simple strike counts
- ✅ **Click cells to edit** strikes
- ✅ **Add/remove goals** anytime
- ✅ **Add new weeks** as you go
- ✅ **Motivational quotes** (rotate every 15s)
- ✅ **Auto-save** to browser
- ✅ **Export to CSV** for Google Sheets sync
- Tracks one strike count per week

### v3 - Day-by-Day Tracker
**File:** `accountability-tracker-v3.html`
**Best for:** Full historical daily tracking (all 41 weeks)
- ✅ **Track by individual day** (Sun-Sat for EVERY week)
- ✅ **See averages** alongside totals
- ✅ **Click any day cell to edit**
- ✅ **Add new weeks** with 7-day tracking
- ⚠️ **Large file** (260KB) - all historical data in daily format

### v3.1 - Live + Historical Tracker (Recommended) ⭐
**File:** `accountability-tracker-v3.1.html`
**Best for:** Daily tracking with clean historical context
- ✅ **Live current week** - Track day-by-day (Sun-Sat)
- ✅ **Historical view** - 41 weeks in simple weekly format
- ✅ **Compare performance** - See if you're beating your avg
- ✅ **Start new weeks** - Auto-archives to history
- ✅ **Efficient** - Only 84KB (vs v3's 260KB)
- Perfect balance of detail and performance!

---

## 🚀 Which Version Should I Use?

### Use **v3.1** if you want to: ⭐ RECOMMENDED
- Track current week day-by-day (Sun-Sat)
- Compare against your historical weekly averages
- See clear separation between live tracking and history
- Archive weeks automatically as you progress
- **Best UX and most efficient - this is the recommended version!**

### Use **v3** if you want to:
- Full daily granularity for ALL historical weeks
- Edit individual days across entire history
- Most detailed tracking (but larger file size)

### Use **v2** if you want to:
- Simple weekly strike counts
- Lighter weight tracking
- Don't need daily granularity
- All the interactive features without the detail

### Use **v1** if you only want to:
- View historical data
- Analyze trends without editing
- Share read-only dashboard with others
- Quick lightweight view

---

## 📥 Download Links

All versions available at:
`https://github.com/db2025ai/accountability-tracker`

**Latest (v3.1):** `accountability-tracker-v3.1.zip` (84KB) ⭐ RECOMMENDED
**Alternative (v3):** `accountability-tracker-v3.zip` (260KB - full daily history)
**Previous (v2):** `accountability-tracker-v2.zip` (60KB)
**Original (v1):** `accountability-tracker-v1.zip` (46KB)

---

## 🔄 Version History

### v3.1 (Live + Historical) - December 2024 ⭐ LATEST
- **NEW:** Two-section layout (Live current week + Historical weekly)
- **NEW:** Current week with day-by-day tracking (Sun-Sat)
- **NEW:** Historical section with 41 weeks in simple weekly format
- **NEW:** Performance comparison (current week vs personal average)
- **NEW:** "Start New Week" button archives current to history
- **NEW:** Visual indicators (better/worse than average)
- Enhanced stats dashboard
- Efficient 84KB file size (vs v3's 260KB)
- Stores data in localStorage as 'accountabilityTrackerV3_1'

### v3 (Day-by-Day Tracker) - December 2024
- **NEW:** Day-by-day tracking (Sun-Sat for each week)
- **NEW:** Average strikes per week displayed
- **NEW:** Click individual days to edit
- **NEW:** Historical data converted to daily format
- Add new weeks with 7-day structure
- CSV export includes daily columns
- All v2 features retained
- Stores data in localStorage as 'accountabilityTrackerV3'

### v2 (Interactive) - December 2024
- Added click-to-edit functionality
- Add/remove goals dynamically
- Add new weeks with one button
- 15 rotating motivational quotes
- Auto-save to localStorage
- CSV export for Google Sheets sync
- Real-time chart updates
- All data embedded (no CORS issues)

### v1 (Clean Consolidated) - December 2024
- Consolidated 67 unique goals → 37 recurring goals
- Organized by 7 categories
- 41 weeks of historical data (Jan 2024 - Jan 2025)
- Color-coded strikes visualization
- Evolution chart showing trends
- Read-only analysis dashboard
- Self-contained HTML file

---

## 🆕 Future Versions

### v4 (Planned)
- Direct Google Sheets API integration (OAuth)
- Streak tracking and celebrations
- Mobile app version
- Goal templates and categories
- Weekly email reports
- AI-powered insights
- Custom quote collections
- Dark mode
- Keyboard shortcuts

**Got feature requests?** Open an issue on GitHub!

---

## 💡 Naming Convention

Going forward, all files use simple version numbers:
- `accountability-tracker-v1.html` - Version 1 (Read-only)
- `accountability-tracker-v2.html` - Version 2 (Interactive weekly)
- `accountability-tracker-v3.html` - Version 3 (Full daily history)
- `accountability-tracker-v3.1.html` - Version 3.1 (Live + Historical) ⭐ LATEST
- `accountability-tracker-v4.html` - Version 4 (Coming soon)

Clean, simple, easy to remember! 🎯
