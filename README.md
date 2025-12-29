# 🎯 Accountability Tracker Dashboard

**Track your habits. Stay accountable. Achieve your goals.**

A web-based accountability system with interactive tracking, data visualization, and Google Sheets sync.

## 🚀 Quick Start - Pick Your Version

### **v2 - Interactive Tracker** ⭐ RECOMMENDED
**File:** `accountability-tracker-v2.html` (Download `accountability-tracker-v2.zip`)

Perfect for daily use:
- ✅ Click cells to edit strikes
- ✅ Add/remove goals anytime
- ✅ Add new weeks as needed
- ✅ Motivational quotes (15 rotating)
- ✅ Auto-save to browser
- ✅ Export CSV for Google Sheets

**Just double-click the HTML file - everything loads instantly!**

### **v1 - Clean Dashboard**
**File:** `accountability-tracker-v1.html` (Download `accountability-tracker-v1.zip`)

Perfect for viewing:
- Read-only analysis
- Historical trends
- Consolidated data view
- No editing needed

---

## 📋 What's Included

**Your Data:**
- 37 recurring goals across 7 categories
- 41 weeks of tracking (Jan 2024 - Jan 2025)
- Goals evolution captured (triathlon training, habit changes, etc.)

**Categories:**
- Physical Health (10 goals)
- Mental Health (9 goals)
- Budgeting (6 goals)
- Work (5 goals)
- Monthly (4 goals)
- Cooking (2 goals)
- Other (1 goal)

---

## Features

### 1. Interactive Dashboard
- Real-time statistics overview
- Current week strikes counter
- Average strikes calculation
- Best performing category identification

### 2. Weekly Tracking
- Track multiple goals across 7 categories:
  - Physical Health
  - Mental Health
  - Budgeting
  - Work
  - Monthly Goals
  - Cooking
  - Other
- Visual status indicators (✓ for completed, ✗ for missed)
- Click cells to cycle through states: Empty → Completed → Missed → Empty
- Navigate between weeks (Previous, Today, Next)

### 3. Data Persistence (Memory)
- Automatic saving to browser's LocalStorage
- Data persists between sessions
- No server required - all data stays local

### 4. CSV Import/Export
- Import existing Google Sheets or Excel data
- Export current data as CSV
- Preserves all tracking history and goals

### 5. Analytics & Visualizations
Four interactive charts powered by Chart.js:
- **Strikes Over Time**: Line chart showing weekly strike trends
- **Category Breakdown**: Bar chart of completion rates by category
- **Overall Completion Rate**: Doughnut chart showing completed vs missed vs not tracked
- **Weekday Pattern**: Bar chart comparing performance by day of week

### 6. Goal Management
- Add new goals with category and targets
- Remove goals (with confirmation)
- Organize goals by category
- Customize goal targets (e.g., "x7" for 7 times per week)

### 7. History View
- Review past weeks
- See historical strike counts
- Track progress over time

## Getting Started

### Quick Start (Recommended - Auto-Sync)
1. Open `index.html` in a modern web browser
2. Click **"🔄 Sync from Google Sheets"** button
3. Your data will automatically load from your Google Sheet!
4. Click sync anytime to get the latest updates

### Alternative: Manual CSV Import
1. Open `index.html` in a modern web browser
2. Export your Google Sheet as CSV (File → Download → CSV)
3. Click **"Import CSV File"** button and select your CSV
4. Start tracking your goals!

### First Time Setup
If you don't have existing data:
1. Open `index.html`
2. The app will initialize with default goals
3. Click "+ New Week" to create your first tracking week
4. Click on day cells to mark goals as completed (✓) or missed (✗)

## How to Use

### Syncing from Google Sheets (Easiest!)
The dashboard is pre-configured with your Google Sheets ID. Just:
1. Click **"🔄 Sync from Google Sheets"** in the header
2. Wait a few seconds while it fetches your data
3. Your dashboard will automatically populate with all your tracking data!

**To change the Google Sheet:**
1. Open `app.js` in a text editor
2. Find line 4: `const GOOGLE_SHEETS_ID = '...'`
3. Replace with your Google Sheets ID (from the URL)
4. Save and reload the page

### Manual CSV Import (Alternative)
1. Click the **Import CSV File** button in the header
2. Select your CSV file from Google Sheets or Excel
3. The app will parse and load all your historical data

To export from Google Sheets:
- File → Download → Comma Separated Values (.csv)

### Tracking Goals
1. Navigate to the current week using the week controls
2. Click on any day cell to toggle the status:
   - **Empty**: No data
   - **✓ (Green)**: Goal completed
   - **✗ (Red)**: Goal missed (counts as a strike)
3. Changes are automatically saved

### Adding New Goals
1. Click **+ Add New Goal** button
2. Select a category
3. Enter the goal name
4. Optionally add a target (e.g., "x2 per week")
5. Click **Add Goal**

### Creating New Weeks
1. Click **+ New Week** button
2. A new week starting from the most recent Sunday will be created
3. All your goals will be copied to the new week

### Viewing Analytics
- Scroll to the Analytics section
- Charts update automatically as you track goals
- Hover over charts for detailed information

## Data Structure

### Storage
- Data is stored in browser's LocalStorage
- Key: `accountabilityData`
- Format: JSON

### Data Schema
```javascript
{
  weeks: [
    {
      startDate: "ISO date string",
      days: ["Sunday", "Monday", ...],
      entries: {
        goalIndex: {
          goal: { category, name, target },
          tracking: ["X", "1", "", ...] // 7 values for 7 days
        }
      }
    }
  ],
  goals: [
    { category: "Physical Health", name: "Cardio", target: "x2" }
  ],
  categories: ["Physical Health", "Mental Health", ...]
}
```

### Tracking Values
- `"X"` or `"x"`: Goal completed (shown as ✓)
- `"1"`: Goal missed - counts as a strike (shown as ✗)
- `""` (empty): Not tracked or not applicable

## Technical Details

### Technologies
- **HTML5**: Structure
- **CSS3**: Styling with CSS Grid and Flexbox
- **Vanilla JavaScript**: Application logic
- **Chart.js 4.4.0**: Data visualization
- **LocalStorage API**: Data persistence

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Any modern browser with ES6 support

### Files
- `index.html` - Main application structure
- `styles.css` - Styling and responsive design
- `app.js` - Application logic and data management
- `accountability_data.csv` - Your original data (for reference)
- `README.md` - This documentation

## Features in Detail

### Memory Functionality
The tracker implements a robust memory system:
- **Auto-save**: Every action (toggling goals, adding/removing goals, creating weeks) automatically saves to LocalStorage
- **Auto-load**: When you open the app, it automatically loads your previous data
- **Persistence**: Data survives browser restarts and computer restarts
- **No database needed**: Everything works offline

### CSV Import Logic
The import function intelligently parses your spreadsheet:
- Detects week boundaries by looking for date headers
- Infers goal categories from section headers
- Handles quoted CSV fields
- Preserves all historical tracking data
- Maps tracking symbols (X for completed, 1 for missed)

### Analytics Calculations
- **Strikes**: Counts all "1" values in the tracking data
- **Completion Rate**: Percentage of "X" values vs total tracked days
- **Category Stats**: Aggregates completion rates by goal category
- **Weekday Patterns**: Analyzes performance trends by day of week

## Keyboard Shortcuts
Currently not implemented, but future enhancement could include:
- Arrow keys for navigation
- Space to toggle current cell
- N for new week
- E for export

## Customization

### Adding More Categories
Edit the `categories` array in `app.js`:
```javascript
this.data = {
  categories: [
    'Physical Health',
    'Your New Category',
    // ...
  ]
}
```

### Changing Color Scheme
Modify CSS variables in `styles.css`:
```css
:root {
  --primary-color: #4a90e2;
  --success-color: #52c41a;
  // ...
}
```

## Troubleshooting

### Data Not Saving
- Check if LocalStorage is enabled in your browser
- Check if you're in private/incognito mode (LocalStorage may be restricted)
- Clear browser cache if data seems corrupted

### Import Not Working
- Ensure CSV file is properly formatted
- Check that the file contains date headers
- Verify goal names don't have special characters

### Charts Not Displaying
- Ensure internet connection (Chart.js loads from CDN)
- Check browser console for errors
- Refresh the page

## Future Enhancements

Potential features to add:
- [ ] Cloud sync (Firebase, Supabase)
- [ ] Mobile app version
- [ ] Goal reminders/notifications
- [ ] Streak tracking
- [ ] AI-powered insights
- [ ] Multi-user support
- [ ] Data export to PDF
- [ ] Custom themes
- [ ] Keyboard shortcuts
- [ ] Goal templates
- [ ] Search and filter functionality

## Data Privacy

- All data is stored locally in your browser
- No data is sent to external servers
- No analytics or tracking
- You have full control over your data
- Use export function to backup your data

## Support

For issues or questions:
1. Check this README
2. Review browser console for errors
3. Export your data as backup before troubleshooting
4. Clear LocalStorage and re-import if needed

## License

This project is open source and available for personal use.

## Credits

Built with:
- Chart.js (https://www.chartjs.org/)
- Modern web standards

---

**Version**: 1.0.0
**Last Updated**: November 2024
