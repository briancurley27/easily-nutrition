/**
 * Database Diagnostic and Cleanup Script
 *
 * This script will:
 * 1. Check for duplicate entries in the database
 * 2. Remove duplicates while keeping the original entry
 * 3. Show statistics about what was cleaned up
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Please create a .env.local file with:');
  console.error('REACT_APP_SUPABASE_URL=your_url');
  console.error('REACT_APP_SUPABASE_ANON_KEY=your_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('🔍 Analyzing database...\n');

  // Get current user (you'll need to be logged in)
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.error('❌ No active session. Please log in first.');
    console.error('Run this script while logged into the app in your browser.');
    process.exit(1);
  }

  const userId = session.user.id;
  console.log(`👤 Checking entries for user: ${userId}\n`);

  // Fetch all entries
  const { data: entries, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('❌ Error fetching entries:', error);
    process.exit(1);
  }

  console.log(`📊 Total entries in database: ${entries.length}\n`);

  // Check for entries with null/invalid dates
  const invalidEntries = entries.filter(e => !e.date || e.date === 'null' || e.date === 'undefined');
  if (invalidEntries.length > 0) {
    console.log(`⚠️  Warning: ${invalidEntries.length} entries have invalid dates!`);
    invalidEntries.forEach(e => {
      console.log(`  - Entry ${e.id}: date="${e.date}", input="${e.input?.substring(0, 30)}..."`);
    });
    console.log();
  }

  // Group by date
  const byDate = {};
  entries.forEach(entry => {
    const date = entry.date || 'INVALID_DATE';
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(entry);
  });

  console.log(`📅 Dates with entries: ${Object.keys(byDate).length}\n`);

  // Find duplicates
  const duplicates = {};
  for (const [date, dateEntries] of Object.entries(byDate)) {
    // Group by input + timestamp to find exact duplicates
    const groups = {};
    dateEntries.forEach(entry => {
      const key = `${entry.input}|${entry.timestamp}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });

    // Find groups with more than one entry (duplicates)
    const dupes = Object.values(groups).filter(group => group.length > 1);
    if (dupes.length > 0) {
      duplicates[date] = dupes;
    }
  }

  console.log('🔍 Duplicate Analysis:\n');
  let totalDuplicates = 0;
  for (const [date, dupeGroups] of Object.entries(duplicates)) {
    console.log(`  📅 ${date}:`);
    dupeGroups.forEach(group => {
      const count = group.length;
      totalDuplicates += count - 1; // -1 because we keep one
      console.log(`    - "${group[0].input.substring(0, 50)}..." appears ${count} times`);
    });
  }

  if (totalDuplicates === 0) {
    console.log('\n✅ No duplicates found! Your database is clean.\n');

    // Show entry counts by date
    console.log('📊 Entries per date:');
    for (const [date, dateEntries] of Object.entries(byDate)) {
      console.log(`  ${date}: ${dateEntries.length} entries`);
    }
    return;
  }

  console.log(`\n⚠️  Found ${totalDuplicates} duplicate entries across ${Object.keys(duplicates).length} dates.\n`);

  // Ask for confirmation
  console.log('Would you like to remove duplicates? (keeping the earliest entry of each duplicate)');
  console.log('This will delete duplicate entries from the database.\n');

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const shouldClean = await new Promise(resolve => {
    readline.question('Proceed with cleanup? (yes/no): ', answer => {
      readline.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });

  if (!shouldClean) {
    console.log('\n❌ Cleanup cancelled.');
    return;
  }

  // Perform cleanup
  console.log('\n🧹 Cleaning up duplicates...\n');
  let deletedCount = 0;

  for (const [date, dupeGroups] of Object.entries(duplicates)) {
    for (const group of dupeGroups) {
      // Sort by created_at or id to keep the earliest
      group.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Keep the first, delete the rest
      const toKeep = group[0];
      const toDelete = group.slice(1);

      console.log(`  Keeping entry ${toKeep.id}, deleting ${toDelete.length} duplicates...`);

      for (const entry of toDelete) {
        const { error } = await supabase
          .from('entries')
          .delete()
          .eq('id', entry.id);

        if (error) {
          console.error(`    ❌ Error deleting ${entry.id}:`, error);
        } else {
          deletedCount++;
        }
      }
    }
  }

  console.log(`\n✅ Cleanup complete! Deleted ${deletedCount} duplicate entries.\n`);

  // Show final stats
  const { data: finalEntries } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId);

  const finalByDate = {};
  finalEntries.forEach(entry => {
    if (!finalByDate[entry.date]) finalByDate[entry.date] = [];
    finalByDate[entry.date].push(entry);
  });

  console.log('📊 Final entries per date:');
  for (const [date, dateEntries] of Object.entries(finalByDate)) {
    console.log(`  ${date}: ${dateEntries.length} entries`);
  }

  console.log('\n✅ Database is now clean! Please refresh your browser to see the updated data.\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
