# Testing TaskFlow Bug Fixes

## How to Test Each Fix

### Test Bug 1 - Deadline Saving
1. Open http://localhost:5175/ in your browser
2. Click "+ New Task"
3. Enter a task title (e.g., "Test Task")
4. Select a deadline using the datetime picker
5. Click "Create Task"
6. **Expected:** Task should appear with the deadline displayed in DD/MM/YYYY HH:mm format
7. Refresh the page
8. **Expected:** Task should still have the deadline (it persists in localStorage)

### Test Bug 2 - Calendar View
1. Create a task with a deadline (as above)
2. Click "Calendar" in the sidebar
3. Navigate to the month of the deadline
4. **Expected:** You should see a colored dot on the day of the deadline
5. Click on that day
6. **Expected:** The task should appear in the list below the calendar

### Test Bug 3 - Delete Confirmation
1. Hover over any task card
2. Click the delete button (X icon)
3. **Expected:** A modal should appear saying "Are you sure you want to delete this task? This action cannot be undone."
4. **Expected:** Modal should have "Cancel" and "Delete" buttons
5. Click "Cancel" - task should remain
6. Click delete again, then "Delete" - task should be removed

### Test Bug 5 - Notification Settings
1. Click "Settings" in the sidebar (gear icon)
2. **Expected:** You should see "Notification Preferences" section
3. **Expected:** Toggles for:
   - Enable All Reminders (master toggle)
   - 10-minute pre-deadline reminder
   - 1-hour pre-deadline reminder
   - Deadline reminder (at exact time)
   - Overdue task alerts
4. Toggle any setting off/on
5. Refresh the page
6. **Expected:** Your settings should be preserved

### Test Bug 6 - Date Format
1. Create tasks with various deadlines
2. **Expected:** All dates should display in DD/MM/YYYY HH:mm format
3. Check dates in:
   - Task cards (main view)
   - Calendar view
   - Analytics view
4. **Expected:** All dates consistently show DD/MM/YYYY HH:mm format

## Current Status

All fixes have been applied to src/App.jsx:
✅ formatDeadline() - Updated to DD/MM/YYYY HH:mm format
✅ TaskModal - Added getLocalDatetimeString() helper
✅ handleSave() - Proper ISO string conversion with validation
✅ CalendarView tasksForDay() - Enhanced error handling
✅ DB object - Added saveNotificationPrefs() and loadNotificationPrefs()
✅ Form labels - Added DD/MM/YYYY HH:mm hint

## If Issues Persist

If you're still experiencing issues, please:
1. Clear your browser's localStorage (F12 > Application > Local Storage > Clear)
2. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
3. Check the browser console (F12) for any error messages
4. Let me know the specific error or behavior you're seeing
