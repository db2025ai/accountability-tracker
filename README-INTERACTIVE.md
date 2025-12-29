# 🎯 Interactive Accountability Tracker

Your living, breathing accountability system with interactive tracking, habit management, Google Sheets sync, and daily motivation!

## ✨ New Features

### 1. **Interactive Tracking** 📝
- **Click any cell to edit** strike counts
- Changes save automatically to browser storage
- Color-coded feedback (green = 0, yellow = 1-2, red = 3+)
- Real-time updates to charts and stats

### 2. **Habit Management** ⚙️
- **Add New Goals**: Click "+ Add New Goal" button
  - Choose category
  - Enter goal name
  - Instantly appears in your tracker
- **Remove Goals**: Hover over goal name, click ✕ button
  - Confirms before deleting
  - Permanently removes from tracking

### 3. **Week Management** 📅
- **Add New Weeks**: Click "+ Add New Week"
  - Suggests next week automatically
  - All existing goals carry forward
  - Start tracking immediately

### 4. **Google Sheets Sync** ☁️
- Export updated data as CSV
- Import back into your Google Sheet
- Preserves legacy data
- Instructions provided on-screen

### 5. **Motivational Quotes** 💪
- Rotating quotes every 15 seconds
- 15 hand-picked inspirational messages
- Keeps you motivated while tracking

### 6. **Data Persistence** 💾
- Auto-saves to browser localStorage
- Survives browser restarts
- Export anytime to CSV backup
- Visual "✓ Saved" indicator

## 🚀 Quick Start

1. **Download** `accountability-tracker-interactive.zip`
2. **Extract** all files to a folder
3. **Double-click** `index-interactive.html`
4. **Start tracking!**

## 📖 How to Use

### Tracking Your Habits

1. **View your current week** in the table
2. **Click any cell** to edit strike count
3. **Type the number** (0, 1, 2, etc.)
4. **Press Enter** or click outside to save
5. Charts and stats update instantly!

### Adding a New Habit

1. Click **"➕ Add New Goal"**
2. Select category from dropdown
3. Enter goal name (e.g., "Drink 8 glasses of water")
4. Click **"Save Goal"**
5. Goal appears in table, ready to track!

### Removing a Habit

1. **Hover** over the goal name
2. **Click the ✕ button** that appears
3. **Confirm** removal
4. Goal is permanently deleted

### Adding a New Week

1. Click **"➕ Add New Week"**
2. Enter week range (e.g., "1/6-1/12")
   - Or use the suggested date
3. New week appears as a column
4. All goals carry forward with 0 strikes

### Syncing to Google Sheets

**Current Approach (Simple):**
1. Click **"☁️ Sync to Google Sheets"**
2. CSV file downloads automatically
3. Open your Google Sheet
4. **File → Import → Upload**
5. Choose "Insert new sheet"
6. Your updated data is now in Google Sheets!

**Future Enhancement:**
Direct API integration with Google Sheets (requires OAuth setup)

### Exporting Your Data

1. Click **"📥 Export CSV"**
2. File downloads with today's date
3. Open in Excel, Numbers, or Google Sheets
4. Use for backup or analysis

### Changing View

Click **"📊 Show All/12/6 Weeks"** button to toggle:
- All weeks (full history)
- Recent 12 weeks (quarterly view)
- Recent 6 weeks (focused view)

## 💾 Data Storage

### Where is my data stored?

- **Primary**: Browser localStorage (automatic)
- **Backup**: Export CSV anytime
- **Cloud**: Manually sync to Google Sheets

### Will I lose my data?

Your data persists in your browser. You'll lose it if you:
- Clear browser data/cache
- Use incognito/private mode
- Switch computers

**Protection:**
- Export CSV regularly as backup
- Sync to Google Sheets weekly
- Keep the CSV files for historical record

## 🎨 Color Coding Guide

| Color | Strikes | Meaning |
|-------|---------|---------|
| 🟢 Green | 0 | Perfect! No strikes |
| 🟡 Yellow | 1-2 | Minor slip-ups |
| 🟠 Orange | 3-4 | Needs attention |
| 🔴 Red | 5+ | High strikes - refocus! |
| ⚪ Gray | - | Not tracked this week |

## 📊 Stats Explained

**Active Goals**: Total number of habits you're tracking

**Weeks Tracked**: How many weeks of data you have

**Avg Strikes/Week**: Your average across all goals and all weeks

**Current Week**: Total strikes for the most recent week

## 💡 Tips for Success

### Getting Started
1. Import your historical data (from master_list_clean.json)
2. Review your current goals
3. Remove any that are no longer relevant
4. Add any new habits you want to track

### Daily Routine
1. Open the tracker in the morning
2. Read the motivational quote
3. Review yesterday's tracking
4. Plan today's focus

### Weekly Routine
1. Click "Add New Week" on Sunday/Monday
2. Review last week's performance
3. Celebrate low strike counts!
4. Adjust goals if needed
5. Sync to Google Sheets for backup

### Monthly Routine
1. Export CSV for your records
2. Review trends in the chart
3. Consider consolidating similar goals
4. Add new categories if your life changes

## 🔧 Technical Details

### Files Needed
- `index-interactive.html` - Main dashboard
- `app-interactive.js` - JavaScript logic
- `master_list_clean.json` - Initial data (first load only)

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Any modern browser with ES6 and localStorage

### Data Format (localStorage)
```javascript
{
  weeks: ["1/12-1/18", "1/19-1/25", ...],
  total_weeks: 41,
  total_goals: 37,
  categories: {
    "Physical Health": [
      {
        name: "2 Strength Training...",
        strikes_by_week: [0, 1, 0, ...],
        total_strikes: 7,
        weeks_tracked: 38,
        first_seen: "1/12-1/18",
        last_seen: "12/28-1/3"
      }
    ]
  }
}
```

## 🆘 Troubleshooting

### Data not loading?
1. Make sure `master_list_clean.json` is in the same folder
2. Check browser console (F12) for errors
3. Try refreshing the page

### Changes not saving?
1. Check for "✓ Saved" indicator after edits
2. Don't use incognito mode
3. Make sure localStorage isn't disabled

### Can't click cells?
1. Make sure you're clicking the white/colored cells (not headers)
2. Try refreshing the page
3. Check if JavaScript is enabled

### Google Sheets sync not working?
Current version exports CSV - you manually import to Google Sheets.
Direct API sync requires OAuth setup (future enhancement).

## 🚀 Future Enhancements

Want even more? Future versions could include:

- [ ] Direct Google Sheets API integration (auto-sync)
- [ ] Mobile app version
- [ ] Streak tracking and celebrations
- [ ] Goal templates and categories
- [ ] Weekly email reports
- [ ] AI-powered insights and suggestions
- [ ] Team/accountability partner sharing
- [ ] Custom quote collections
- [ ] Dark mode
- [ ] Keyboard shortcuts

## 📝 Changelog

### Version 1.0 (Interactive Release)
- ✅ Click-to-edit cells
- ✅ Add/remove goals
- ✅ Add new weeks
- ✅ Rotating motivational quotes
- ✅ CSV export for Google Sheets
- ✅ LocalStorage persistence
- ✅ Real-time charts
- ✅ View toggles (all/12/6 weeks)

---

**Ready to level up your accountability game?** Open `index-interactive.html` and start tracking! 🎯
