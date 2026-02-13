# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Vanilla JavaScript web application for NADI Pulau Pinang (18 sites) with calendar management, leave request workflow, announcement board, and reminder system. Primary deployment is GitHub Pages embedded in Google Sites via iframe.

## Technology Stack
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (CDN v4)
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Icons**: Font Awesome 6.4.0 (CDN)
- **Sanitization**: DOMPurify (CDN)
- **No build step** - Static files served directly

## Development Commands

### Local Server (required for JavaScript modules)
```bash
# Python
python -m http.server 5500

# Node
npx serve -p 5500

# VS Code: Right-click index.html -> "Open with Live Server"
```

### JavaScript Syntax Check
```bash
node --check js/config.js && node --check js/app.js && node --check js/leave-integrated.js && node --check js/password-utils.js && node --check js/reminder-system.js
```

### Manual Testing Checklist
1. Open `index.html` and navigate month left/right - verify auto-selected date behavior
2. Leave panel: submit and cancel test request flow
3. Announcements page: verify CRUD and filter behavior
4. Reminder panel: verify create/edit/delete sync
5. Program modal: verify rich text editor, image handling (file picker, drag-drop, clipboard paste), image viewer with next/prev/fullscreen

## Architecture

### File Structure
```
├── index.html              # Main calendar interface
├── announcements.html      # Announcements admin panel
├── css/
│   ├── styles.css          # Main calendar styling
│   ├── leave-system.css    # Leave management UI
│   └── reminder-system.css
└── js/
    ├── app.js              # Calendar rendering, navigation, event display
    ├── config.js           # Constants, holiday data, site settings defaults
    ├── leave-integrated.js # Complete leave workflow (requests, approvals, dashboard)
    ├── password-utils.js   # PBKDF2-SHA256 hashing for supervisor auth
    ├── reminder-system.js  # Personal reminder CRUD
    ├── supabase.js         # Supabase client library
    └── supabase.config.js # Credentials (never commit)
```

### Database Schema (Supabase)
- **sites**: 18 NADI locations
- **leave_users**: Staff (Manager/AM) and Supervisors with roles
- **leave_requests**: Leave/replacement day submissions with status workflow
- **site_settings**: Config stored by ID (offdays, holidays, title/subtitle, backups)
- **events**: Program/announcement data with rich text and images
- **reminders**: Personal user reminders

### Key Supabase Patterns
- Use projected columns only, never `select('*')` on events
- Query events by month window: `lte('start', lastDay) AND gte('end', firstDay)`
- Enable month caching (`events_cache` localStorage)
- Real-time subscriptions on `leave_requests` table

### site_settings IDs
| ID | Purpose |
|----|---------|
| 1  | Title, subtitle, filters |
| 10 | Manager offdays |
| 11 | Assistant Manager offdays |
| 12 | Manager replacements |
| 13 | AM replacements |
| 20 | Public holidays |
| 21 | School holidays |
| 30 | Custom sections |
| 99 | Full backup |

## Critical Rules

### Supabase Egress
Never query full `events` payload. Use column projection:
```javascript
const { data } = await supabaseClient
  .from('events')
  .select('id,info,images')  // Never select(*)
  .lte('start', lastDay)
  .gte('end', firstDay);
```

### Iframe Compatibility
- Must work embedded in Google Sites iframe
- No dependency on popup windows
- Maintain storage fallback logic
- Z-index layering: standard overlays `z-50`, nested `z-[60]+`

### Role Colors
- Manager: blue `#00aff0`
- Assistant Manager: green `#90cf53`
- Replacement: orange `#ff8c00`

### Month Navigation Behavior
- Moving to non-current month: auto-select last date of that month
- Returning to current local month: auto-select today's date

## Common Pitfalls
1. Using `select('*')` on events instead of projected columns
2. Breaking month navigation auto-select date behavior
3. Forgetting to clear/reload month cache after event mutations
4. Rendering unsanitized HTML from announcements/reminders
5. Breaking static path assumptions (`css/`, `js/`) in HTML
