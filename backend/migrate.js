require('dotenv').config();
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const SQLITE_FILE = path.join(__dirname, 'ironlog.db');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const sqlite = new Database(SQLITE_FILE);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = [
  'organizations', 'gyms', 'users', 'programs', 'assignments', 'mealLogs',
  'messages', 'reviews', 'subscriptions', 'payments', 'programCheckoffs',
  'attendance', 'membershipPlans', 'memberSubscriptions', 'memberPayments',
  'notifications', 'auditLog', 'platformPlans', 'achievements', 'personalRecords'
];

async function migrate() {
  console.log('🚀 Starting migration from SQLite to Supabase...');

  for (const table of TABLES) {
    console.log(`📦 Migrating table: ${table}...`);

    try {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();

      if (rows.length === 0) {
        console.log(`   - No data found in ${table}, skipping.`);
        continue;
      }

      // Process rows to ensure types match PostgreSQL
      const processedRows = rows.map(row => {
        const newRow = { ...row };
        for (const key in newRow) {
          // Convert SQLite 0/1 to Boolean if it looks like a boolean field
          // (Note: This is a heuristic; for better precision, we'd use a mapping)
          if (typeof newRow[key] === 'number' && (newRow[key] === 0 || newRow[key] === 1)) {
            // Check if it's one of the known boolean columns
            const boolCols = ['suspended', 'read', 'autoRenew'];
            if (boolCols.includes(key)) {
              newRow[key] = newRow[key] === 1;
            }
          }
        }
        return newRow;
      });

      const { error } = await supabase
        .from(table)
        .upsert(processedRows);

      if (error) throw error;
      console.log(`   ✅ Successfully migrated ${rows.length} rows.`);
    } catch (e) {
      console.error(`   ❌ Error migrating ${table}:`, e.message);
    }
  }

  console.log('\n✨ Migration complete! Your data is now in the cloud.');
}

migrate().catch(console.error);
