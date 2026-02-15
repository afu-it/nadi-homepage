# AGENTS.md - NADI Calendar, Leave, and Reminder System

## Project Overview
Vanilla JavaScript web app for NADI Pulau Pinang (18 sites) with:
- Calendar management
- Leave request workflow (staff + supervisors)
- Announcement board
- Reminder system
- KPI tracking system (categories + sub-KPIs per site/month)

Primary deployment is GitHub Pages, embedded in Google Sites via iframe:
- `https://afu-it.github.io/nadi-homepage/`
- Must remain iframe-safe (storage fallback, no dependency on popup windows)
- No build step, no package manager requirement for runtime

## Technology Stack
- Frontend: HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (CDN)
- Backend: Supabase (PostgreSQL + Realtime)
- Icons: Font Awesome 6.4.0 (CDN)
- Sanitization: DOMPurify (CDN)
- Static architecture: direct browser execution

## Development Commands

### Local Server
```bash
# VS Code Live Server
# Right-click index.html -> Open with Live Server

# Python
python -m http.server 5500

# Node
npx serve -p 5500
```

### JavaScript Syntax Check
```bash
node --check js/config.js
node --check js/app.js
node --check js/leave-integrated.js
node --check js/password-utils.js
node --check js/reminder-system.js
node --check js/kpi-system.js

node --check js/config.js && node --check js/app.js && node --check js/leave-integrated.js && node --check js/password-utils.js && node --check js/reminder-system.js && node --check js/kpi-system.js
```

### Manual Testing
1. Open `index.html`.
2. Navigate month left/right and verify auto-selected date behavior.
3. Open Leave panel and submit/cancel a test request flow.
4. Open Announcements page and verify CRUD + filter behavior.
5. Open Reminder panel and verify create/edit/delete sync.
6. Open Program modal -> Edit Program Info and verify:
   - Image add via file picker, drag-and-drop, and clipboard paste.
   - Pasted images are separated into Program Images (not embedded in rich text).
   - Program card shows images at top of Program Info area.
   - Clicking image opens viewer with next/prev, fullscreen, copy, and download.
7. Open KPI panel and verify:
   - Site dropdown loads all 18 sites.
   - Month navigation works correctly.
   - Checkboxes toggle and persist to database.
   - Progress counts update per category.

## Current File Structure
```text
├── index.html
├── announcements.html
├── AGENTS.md
├── README.md
├── .gitignore
├── css/
│   ├── styles.css
│   ├── leave-system.css
│   ├── reminder-system.css
│   └── kpi-system.css
└── js/
    ├── app.js
    ├── config.js
    ├── leave-integrated.js
    ├── password-utils.js
    ├── reminder-system.js
    ├── kpi-system.js
    ├── supabase.js
    └── supabase.config.js
```

## Critical Egress Rules (Supabase)
The `events` table is the primary bandwidth risk. Follow these rules strictly:

1. Never use `select('*')` on `events`.
2. Use projected columns:
   - Summary list: `EVENT_SUMMARY_SELECT_COLUMNS`
   - Detail modal: `EVENT_DETAIL_SELECT_COLUMNS`
3. Query events by month window only:
```javascript
const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

const { data, error } = await supabaseClient
  .from('events')
  .select(EVENT_SUMMARY_SELECT_COLUMNS)
  .lte('start', lastDay)
  .gte('end', firstDay)
  .order('start', { ascending: true });
```
4. Keep month cache enabled (`eventsCache`, local cache key `events_cache`).
5. Do not prefetch full-year/full-table events in browser.
6. Preserve this navigation behavior:
   - Moving to non-current month: auto-select last date of that month.
   - Returning to current local month: auto-select local today date.

## Program Info Images (Current Behavior)

1. `events.images` is used for Program Info image metadata (JSON array).
2. Program detail loading must use projected columns only:
   - Primary: `EVENT_DETAIL_SELECT_COLUMNS` (`id,info,images`)
   - Fallback when `images` column is missing: `EVENT_DETAIL_FALLBACK_SELECT_COLUMNS` (`id,info`)
3. Storage bucket for Program Info images:
   - Bucket: `announcement-images`
   - Path prefix: `events/program-info/<eventId>/...`
4. Do not embed base64 images in Program Info HTML.
   - Clipboard/dropped images should be stored as Program Images, separate from rich text.
5. Program card rendering:
   - Images render at top of Program Info area.
   - Click image opens viewer modal (multi-image navigation, fullscreen, copy, download).
6. Required Supabase setup:
   - SQL column: `events.images jsonb not null default '[]'::jsonb`
   - Storage RLS policies must allow role `anon` for `insert/delete/select` on
     `announcement-images/events/program-info/...` objects.

## Supabase Data Patterns

### `site_settings` IDs in use
| ID | Purpose |
|----|---------|
| 1  | Basic config (title, subtitle, filters) |
| 2  | Runtime backup snapshot |
| 10 | Manager offdays |
| 11 | Assistant Manager offdays |
| 12 | Manager replacements |
| 13 | Assistant Manager replacements |
| 20 | Public holidays |
| 21 | School holidays |
| 30 | Custom sections + deletion logs |
| 99 | Full backup |

### KPI Categories (kpi_records table)
| Category Key | Label | Sub-KPIs |
|-------------|-------|----------|
| entrepreneur | Entrepreneurship | Preneur, EmpowHer, Kidventure |
| learning | Lifelong Learning | Nurture x eKelas Keusahawanan (Maxis), Nurture x DiLea, Nurture x Cybersecurity, eKelas Maxis, NADI Book x TinyTechies, Skillforge x eSport, Skillforge x Mahir |
| wellbeing | Wellbeing | CARE |
| awareness | Awareness | KIS |
| gov | Gov Initiative | MyDigital ID |

### Query Standard
```javascript
const { data, error } = await supabaseClient
  .from('table_name')
  .select('needed,columns,only')
  .eq('column', value);

if (error) throw error;
```

### Performance Pattern
- Batch `site_settings` loads into one `.in('id', [...])` query where possible.
- Keep real-time subscriptions scoped and cleaned up.
- Reload only affected month data after event updates/deletes.

## JavaScript Conventions

### Naming
- Functions: `camelCase` with verb prefix (`loadData`, `renderCalendar`)
- Variables: `camelCase`
- Constants: `UPPER_SNAKE` for primitive constants, `camelCase` for objects
- DOM IDs: `camelCase`
- CSS classes: `kebab-case`

### Error Handling
- Wrap Supabase calls in `try/catch`.
- Use `if (error) throw error;`.
- Show user-facing failures with `showToast(message, 'error')`.
- Keep debug logs behind `window.DEBUG_MODE`.

### DOM Safety
- Null-check all queried elements before use.
- Sanitize user-generated HTML via DOMPurify helpers.
- Avoid attaching duplicate listeners on repeated renders.

## CSS Conventions
- Use Tailwind utility classes for layout/spacing.
- Keep complex visuals and connector lines in dedicated CSS files.
- Maintain role colors:
  - Manager: blue `#00aff0`
  - Assistant Manager: green `#90cf53`
  - Replacement markers: orange `#ff8c00`

## UI and Iframe Notes
- App runs inside Google Sites iframe; keep storage fallback logic intact.
- Keep overlay/modal z-index layering consistent:
  - Standard overlays: `z-50`
  - Nested overlays: `z-[60]` or above
- Prefer targeted close handlers by element ID.

## Common Pitfalls to Avoid
1. Querying full `events` payload (`select('*')`) instead of projected monthly queries.
2. Breaking month navigation auto-selected date behavior.
3. Forgetting to clear/reload month cache after event mutation.
4. Adding unguarded `console.log` in production paths.
5. Rendering unsanitized rich text from announcements/reminders.
6. Breaking static path assumptions (`css/...`, `js/...`) in HTML files.
7. Using inconsistent close button styles - use `lm-tab` class with X icon + "Close" text.
