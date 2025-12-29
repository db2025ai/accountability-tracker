# v2 Troubleshooting Checklist

When you open `accountability-tracker-v2.html`, you should see:

✅ **Header with motivational quote** (purple gradient background)
✅ **4 stat cards** (Active Goals, Weeks Tracked, etc.)
✅ **Action buttons** (Sync to Google Sheets, Add New Week, Add New Goal, Export CSV, View Toggle)
✅ **Line chart** showing strikes over time
✅ **Color-coded table** with your 37 goals

What are you NOT seeing?

Common issues:

1. **No chart appears?**
   - You need internet connection for Chart.js to load
   - The rest should still work

2. **Table is empty?**
   - Check browser console (F12) for errors
   - Try a different browser

3. **"Can't find file" error?**
   - Make sure you extracted the zip completely
   - Don't open from inside the zip file

4. **Old data appears?**
   - Clear browser localStorage
   - Or just click cells to update

Tell me exactly what you see (or don't see) and I can fix it!
