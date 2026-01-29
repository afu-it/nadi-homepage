# AGENTS.md

## ⚠️ IMPORTANT: KEEP DOCUMENTATION UPDATED

**This file is the primary reference for AI assistants working on this project.**

To prevent AI hallucinations and incorrect assumptions:

1. **ALWAYS read this file first** before making any changes
2. **ALWAYS update this file** when making structural or architectural changes
3. **ALWAYS update related .md files** when this file changes:
   - `docs/MIGRATION-COMPLETE.md` - Database structure and migration history
   - `docs/OPTIMIZATIONS.md` - Performance optimizations
   - `docs/CHANGELOG.md` - Change history (mark outdated if needed)

**If you are unsure about current project state:**
- Read AGENTS.md first
- Check MIGRATION-COMPLETE.md for database structure
- Verify with actual code before assuming

**Never make up information.** If something is unclear, ask the user.

---

## Project Overview

Static web app for NADI SCSB community center featuring:
- Interactive calendar with events, holidays, and staff offdays
- Announcements system (Urgent, TP, Samudra, Maxis, SSO categories)
- Custom link sections with button grids
- **Supabase PostgreSQL integration** (migrated from Firebase)

## Database Structure (Supabase)

Data is split across multiple IDs in `site_settings` table for better organization:

| ID | Purpose | Data |
|----|---------|------|
| 1 | Basic config | title, subtitle, calendarFilters |
| 10 | Manager offdays | managerOffdays array |
| 11 | Assistant Manager offdays | assistantManagerOffdays array |
| 12 | Manager replacements | managerReplacements array |
| 13 | Assistant Manager replacements | assistantManagerReplacements array |
| 20 | Public holidays | publicHolidays object |
| 21 | School holidays | schoolHolidays object |
| 30 | Custom sections | sections array |
| 99 | Full backup | Complete siteSettings object |

Additional tables:
- **events** - Calendar events (separate table)
  - Columns: `id`, `title`, `category`, `subcategory`, `start`, `end`, `time`, `secondTime`, `info`, `links`
- **announcements** - Announcements (separate table)
  - Columns: `id`, `title`, `content`, `category`, `dueDate`, `createdAt`
  - **Note:** `category` field determines type (Values: "Urgent", "TP", "Samudra", "Maxis", "SSO")
  - **Note:** SSO subcategories (ssoMain, ssoSub) are NOT supported - database table doesn't have these columns

## Do's & Don'ts

**DO:**
- Use `DOMPurify.sanitize()` before rendering any user content
- Add `target="_blank"` and `rel="noopener noreferrer"` to external links
- Use `window.DEBUG_MODE` for debug logging (defaults to false)
- Add `autocomplete="off"` to form inputs to prevent browser autofill interference
- Use `aria-label` for labels without associated form fields

**DON'T:**
- Expose Supabase credentials in code or logs
- Use `var` - use `const` and `let` only
- Skip error handling in Supabase queries
- Skip HTML sanitization for user-generated content
- Use tabs for indentation - use 2 spaces only

## Build & Development

```bash
# Open website directly
start "" "C:\Users\User\Documents\PROJEK\NADI HOME\Test\index.html"

# Or serve locally
npx serve .

# Verify JavaScript syntax
node -c app.js
```

No linting or testing framework configured. Verify manually in browser.

## When Stuck or Uncertain

- Ask clarifying questions before making large architectural changes
- Propose implementation plans and wait for confirmation
- Never push speculative or untested code
- Highlight ambiguous requirements explicitly
- If data structures are unclear, request examples before writing code

## Testing & Verification

- Open `index.html` and `announcements.html` in browser
- Verify calendar navigation, event creation, and filtering work
- Check responsive layout on mobile and desktop
- Open browser console (F12) - verify no red errors on load
- Test Supabase read/write operations with actual data
- Confirm custom links open in new tabs with proper security attributes

## Code Style Guidelines

- **Naming:** camelCase for functions/variables, UPPER_SNAKE_CASE for constants, PascalCase for data objects
- **Quotes:** Double quotes for strings, single quotes only when double appear
- **Semicolons:** Omit (ASI style)
- **Indentation:** 2 spaces, no tabs
- **Objects:** Use padding `{ key: "value", another: "value" }`
- **Functions:** Verb-based names, under 100 lines when possible
- **Errors:** `console.error()` with context, `try/catch` for async
- **Dates:** ISO format `YYYY-MM-DD`
- **Debug mode:** Wrap debug logs in `if (window.DEBUG_MODE) { console.log(...) }`

## Custom CSS Classes

This project uses custom CSS classes defined in `styles.css` for the NADI brand color (#2228a4):

| Class | Purpose |
|-------|---------|
| `.header-bg` | Header background color `#2228a4` |
| `.bg-nadi` | Blue background color `#2228a4` |
| `.hover\:bg-nadi:hover` | Darker blue on hover `#1b1d8a` |
| `.text-nadi` | Blue text color `#2228a4` |
| `.hover\:text-nadi:hover` | Blue text on hover |
| `.group\:hover\:text-nadi:hover` | Blue text when group is hovered |
| `.border-nadi` | Blue border color `#2228a4` |
| `.hover\:border-nadi:hover` | Blue border on hover |
| `.focus\:border-nadi:focus` | Blue border on focus |
| `.peer-checked\:text-nadi:peer-checked` | Blue text when peer is checked |
| `.peer-checked\:border-nadi:peer-checked` | Blue border when peer is checked |
| `.cat-radio:checked + div` | Category radio button styling |
| `.filter-hidden` | Hidden filter sections with transitions |

**⚠️ CRITICAL:** 
- This project uses **Tailwind CSS v4** with a custom brand color "nadi" (#2228a4)
- The `@layer base` in HTML defines `--color-nadi` but Tailwind v4 **does not auto-generate utility classes** for custom colors
- All nadi-color variants **MUST be manually defined** in `styles.css`
- Before adding new nadi variants (like `active:bg-nadi`), add them to `styles.css` first

## Verification Checklist

**Before claiming a task is complete:**

1. **CSS Classes:** Verify custom classes (like `bg-nadi`, `hover:bg-nadi`) exist in `styles.css`
2. **HTML Elements:** Check all buttons, forms, and inputs render with correct styling
3. **Browser Console:** Open F12 console and verify no red errors on page load
4. **Functionality:** Test the actual functionality (clicks, saves, loads)
5. **Code Review:** Read the actual code, don't assume based on HTML alone

**Example verification process:**
```html
<!-- Don't assume this works just because it has a class -->
<button class="bg-nadi">Save</button>

<!-- Instead: -->
<!-- 1. Check styles.css for .bg-nadi definition -->
<!-- 2. Open in browser and verify blue background -->
<!-- 3. Check console for CSS errors -->
```

## Specialized Save Functions

Use specific save functions for targeted updates:

```javascript
saveBasicConfig()                    // ID 1
saveManagerOffdays()                 // ID 10
saveAssistantManagerOffdays()        // ID 11
saveManagerReplacements()            // ID 12
saveAssistantManagerReplacements()   // ID 13
savePublicHolidays()                 // ID 20
saveSchoolHolidays()                 // ID 21
saveCustomSections()                 // ID 30
saveAllSettings()                    // Saves everything + backup
updateFullBackup()                   // Updates ID 99 only
```

Each function saves to both the specific ID and ID 99 (backup).

## Code Examples

**Load from Supabase (split structure):**
```javascript
async function loadFromSupabase() {
  // Load basic config (ID 1)
  const { data: config } = await supabaseClient
    .from('site_settings').select('settings').eq('id', 1).single();
  
  // Load manager offdays (ID 10)
  const { data: offdays10 } = await supabaseClient
    .from('site_settings').select('settings').eq('id', 10).single();
  
  siteSettings.managerOffdays = offdays10?.settings?.managerOffdays || [];
}
```

**Save with error handling:**
```javascript
async function saveManagerOffdays() {
  const { error } = await supabaseClient.from('site_settings').upsert({
    id: 10,
    settings: { managerOffdays: siteSettings.managerOffdays }
  }, { onConflict: 'id' });
  
  if (error) {
    console.error('Failed to save manager offdays (ID 10):', error);
    throw error;
  }
  if (window.DEBUG_MODE) console.log('Saved manager offdays to ID 10');
  
  await updateFullBackup(); // Also update backup ID 99
}
```

**Event object structure:**
```javascript
const event = {
  id: "1704067200000",
  title: "e-Kelas Workshop",
  category: "entrepreneur",
  subcategory: "e-Kelas (Maxis)",
  start: "2026-01-25",
  end: "2026-01-25",
  time: "09:00 AM - 11:00 AM",
  info: "<p>Workshop details...</p>",
  links: [{ platform: "Zoom", url: "https://..." }],
  secondTime: ""
}
```

**DOMPurify HTML sanitization:**
```javascript
function sanitizeHTML(html) {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "target"],
    FORBID_TAGS: ["script", "style", "form"]
  })
}

function sanitizeHTMLWithLinks(html) {
  let sanitized = sanitizeHTML(html)
  const temp = document.createElement("div")
  temp.innerHTML = sanitized
  temp.querySelectorAll("a").forEach(a => {
    a.setAttribute("target", "_blank")
    a.setAttribute("rel", "noopener noreferrer")
  })
  return temp.innerHTML
}
```

## Performance Optimizations

The site includes several performance optimizations:

1. **Month-based event loading** - Only loads events for current month
2. **5-minute caching** - localStorage cache for faster repeat visits
3. **Pagination** - 20 events per page in event list
4. **Async announcements loading** - Announcements load after events
5. **Background rendering** - UI renders immediately, data loads async

## File Organization

| File | Purpose |
|------|---------|
| `config.js` | Supabase config, category definitions, default holidays |
| `app.js` | Main application logic, rendering functions, data loading/saving |
| `styles.css` | Custom CSS overrides |
| `index.html` | Main calendar page |
| `announcements.html` | Announcements listing and management |

## Browser Compatibility

Target modern browsers (Chrome, Firefox, Safari, Edge). No IE11 support required. Use ES6+ features freely.

## Debug Mode

Enable debug logging by running in browser console:
```javascript
window.DEBUG_MODE = true;
```

This will show detailed logging for data loading, saving, and caching operations.

---

## Documentation Maintenance

**AI Assistants:** When making changes to this project, always update the relevant documentation files:

| File | When to Update |
|------|----------------|
| `docs/AGENTS.md` | Any architectural/structural changes, new functions, database changes |
| `docs/MIGRATION-COMPLETE.md` | Database schema changes, new tables, API pattern changes |
| `docs/OPTIMIZATIONS.md` | Performance-related changes, new optimizations |
| `docs/CHANGELOG.md** | Add new entries at top, mark old entries as outdated |

**Before finishing your work:**
1. Verify AGENTS.md accurately reflects current state
2. Update MIGRATION-COMPLETE.md if database structure changed
3. Add to CHANGELOG.md if significant changes were made
4. **Run verification checklist** - Check custom CSS classes exist, test in browser, check console for errors

This prevents hallucinations and ensures future AI assistants have accurate context.
