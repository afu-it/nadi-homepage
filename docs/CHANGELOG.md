# CHANGELOG - Recent Updates

## ⚠️ NOTE: PARTIALLY OUTDATED

This file contains early updates that reference Firebase. The project has since migrated to Supabase.
For current documentation, see:
- **docs/MIGRATION-COMPLETE.md** - Supabase migration details
- **docs/AGENTS.md** - Current project structure and guidelines
- **docs/OPTIMIZATIONS.md** - Performance optimizations

---

## Date: January 29, 2026

### Split Site Settings Structure

**Change:** Data split across multiple IDs for better organization.

**IDs Used:**
| ID | Purpose |
|----|---------|
| 1 | Basic config |
| 10 | Manager offdays |
| 11 | Assistant Manager offdays |
| 12 | Manager replacements |
| 13 | Assistant Manager replacements |
| 20 | Public holidays |
| 21 | School holidays |
| 30 | Custom sections |
| 99 | Full backup |

**New Functions:**
- `saveManagerReplacements()` - Saves to ID 12 + ID 99
- `saveAssistantManagerReplacements()` - Saves to ID 13 + ID 99

---

## Date: January 28, 2026

### Firebase → Supabase Migration

**Change:** Migrated from Firebase Realtime Database to Supabase PostgreSQL.

**Files Modified:**
- `config.js` - Supabase client initialization
- `index.html` - Updated CDN and function calls
- `announcements.html` - Updated CDN and database operations
- `app.js` - Complete rewrite for Supabase

**Key Changes:**
- Events now in separate `events` table
- Announcements now in separate `announcements` table
- Settings in `site_settings` table with ID 1
- Backup in `site_settings` table with ID 2

---

For complete and up-to-date information, refer to the other documentation files in the `docs/` folder.
