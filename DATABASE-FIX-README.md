# Database Issue Fix - Emergency Recovery

## What Happened?

A bug was introduced in commit `aab9df1` (PR #20) that caused an **infinite render loop** when users logged in. This bug had two major effects:

### 1. **Strobing/Glitchy Screen** ✅ FIXED
- The screen would flash/reload 15+ times per second when logged in
- **Root Cause**: Auth listener useEffect depended on `[entries]`, creating a circular dependency
- **Fix**: Removed the dependency and refactored to use refs (commit 5f5ee1b)

### 2. **Data Corruption** ⚠️ NEEDS CLEANUP
- Existing entries were duplicated hundreds or thousands of times
- Some dates may show 1000+ copies of the same entry
- **Root Cause**: The infinite loop kept re-inserting entries into the database
- **Fix**: Bug is now fixed, but duplicates remain in the database

## How the Bug Worked

When you logged in after the buggy PR was merged:

1. ✅ User clicks "Log in"
2. ✅ System loads your existing entries from database
3. 🐛 **BUG**: Auth listener sees entries and thinks they're "anonymous entries"
4. 🐛 System tries to "migrate" them by inserting them AGAIN into database
5. 🐛 Loading new entries triggers the auth listener again
6. 🐛 **INFINITE LOOP**: Go back to step 3

This loop ran hundreds of times until you closed the tab or the browser crashed.

## How to Fix Your Data

### Step 1: Install Dependencies (if needed)

```bash
npm install
```

### Step 2: Create .env.local File

If you don't already have a `.env.local` file in the project root, create one:

```bash
# .env.local
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

(Use the same values from your Vercel deployment environment variables)

### Step 3: Log Into the App

**Important**: Open the app in your browser and log in FIRST. The cleanup script needs an active session.

```bash
npm run dev
# Open http://localhost:3001 and log in
```

### Step 4: Run the Diagnostic Script

In a separate terminal (keep the app running):

```bash
node fix-database.js
```

This will:
- ✅ Show you how many entries you have
- ✅ List duplicates by date
- ✅ Show total number of duplicates to remove
- ❓ Ask for confirmation before making changes

### Step 5: Review and Confirm

The script will show you:
```
📊 Total entries in database: 15,432
📅 Dates with entries: 45

🔍 Duplicate Analysis:

  📅 2026-01-17:
    - "a slice of pepperoni pizza, a green apple..." appears 1000 times
  📅 2026-01-15:
    - "chicken breast, brown rice, broccoli..." appears 500 times

⚠️  Found 1498 duplicate entries across 2 dates.

Would you like to remove duplicates? (keeping the earliest entry of each duplicate)
Proceed with cleanup? (yes/no):
```

Type `yes` and press Enter to clean up.

### Step 6: Refresh Your Browser

After the script completes, refresh your browser. Your entries should now be correct!

## Verification

After running the cleanup:

1. Check that all your dates show the correct number of entries
2. Verify that Jan 17 (or other problematic dates) no longer have 1000 duplicates
3. Confirm that all your historical data is visible

## What If Entries Are Still Missing?

If entries are missing after cleanup:

### Check the Supabase Dashboard

1. Go to your Supabase project
2. Navigate to Table Editor → `entries` table
3. Filter by your `user_id`
4. Check if the entries exist in the database

### Possible Causes:
- **Wrong date format**: Entries might have invalid date values (the script will detect this)
- **Wrong user_id**: Entries might be associated with a different user account
- **Actual data loss**: If you deleted entries during the glitchy period, they might be permanently gone

### Recovery Options:
1. Check if you have multiple accounts (OAuth vs email/password creates different users)
2. Check Supabase logs for any deletion activity
3. If you had a backup, we can restore from that

## Prevention

The bug has been fixed in the latest code (commit 5f5ee1b). The fix includes:

1. ✅ Auth listener no longer depends on `[entries]`
2. ✅ Anonymous entry capture moved to separate useEffect
3. ✅ Removed circular dependencies between useEffects
4. ✅ Added refs to track state without triggering re-renders

This ensures:
- ✅ No more infinite loops
- ✅ No more screen strobing when logging in
- ✅ No more duplicate data corruption
- ✅ Anonymous entries still properly migrate when users sign up

## Need Help?

If you encounter issues:
1. Check the browser console for errors
2. Check the terminal output from `fix-database.js`
3. Check your Supabase dashboard → Table Editor → entries
4. Report the issue with specific error messages

---

**Status**:
- ✅ Infinite loop bug FIXED (commit 5f5ee1b)
- ⚠️ Data cleanup REQUIRED (run fix-database.js)
- 🚀 New code deployed and safe to use
