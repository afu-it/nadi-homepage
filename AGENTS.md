# AGENTS.md - NADI Home Operational Guide

## Project Overview
Vanilla JavaScript web app for NADI Pulau Pinang (18 sites) with:
- Calendar management
- Leave request workflow (staff + supervisors)
- Announcement board
- Reminder system
- KPI tracking
- Smart Services NADI4U program monitoring

Primary deployment: GitHub Pages embedded in Google Sites iframe.

## Current Product Behavior (Preserve)

- Program List is Smart Services NADI4U only.
- App auto-logs into NADI4U on load using configured assistant account and auto-syncs current month.
- Total Programs panel always shows:
  - Today Events
  - Multiple Day Events
  - Weekly Events (per-week breakdown)
  - Monthly Events
- Program List type buttons (`Today Events` / `Multiple Day Events`) affect list rows only.
- Total Programs counts remain complete and visible regardless of selected list-type button.
- Total Programs labels are clickable and apply scoped list filters:
  - Today -> day-only
  - Multiple Day -> multi-day-only
  - Week N -> selected week
  - Monthly -> full month
- Program List has top buttons:
  - Today Events
  - Multiple Day Events

## Technology Stack
- Frontend: HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (CDN)
- Backend: Supabase (PostgreSQL + Realtime)
- External API: NADI4U REST API
- Icons: Font Awesome 6.4.0
- Sanitization: DOMPurify
- Static architecture (no build step)

## Development Commands

### Local Server
```bash
python -m http.server 5500
# or
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
node --check js/nadi4u-api.js
```

## Manual Testing
1. Open `index.html`.
2. Verify calendar month navigation and selected-date behavior.
3. Verify leave flow (staff request + supervisor review).
4. Verify announcements/reminders CRUD.
5. Verify KPI tracking and KPI Info permissions.
6. Verify Smart Services NADI4U:
   - Auto login and auto sync on load/refresh
   - Program list rendering
   - Program type display
   - Registration links
   - Exclusion of `TEST PROGRAM`
7. Verify Total Programs filter click behavior for all sections.
8. Verify toggling Program List `Today Events` / `Multiple Day Events` does not hide or zero the opposite Total Programs section.

## File Structure
```text
├── index.html
├── announcements.html
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── SECURITY.md
├── CHANGELOG.md
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
    ├── nadi4u-api.js
    ├── supabase.js
    └── supabase.config.js
```

## Supabase Rules
1. Never use `select('*')` on `events`.
2. Use projected columns only.
3. Query `events` by month window.
4. Keep month cache logic enabled.
5. Avoid full-table prefetch in browser.

## KPI Definitions
- `entrepreneur`: Preneur, EmpowHer, Kidventure
- `learning`: eKelas Keusahawanan, DiLea, Cybersecurity, eKelas Maxis, Tinytechies, eSport, Mahir
- `wellbeing`: CARE bundle rule (CARE + MenWell + FlourisHer)
- `awareness`: KIS
- `gov`: MyDigital ID

## Common Pitfalls
1. Breaking scoped filter logic in NADI4U list.
2. Re-introducing Recent Events list view.
3. Removing auto-login/auto-sync bootstrap for NADI4U.
4. Breaking month auto-selected date behavior.
5. Unsanitized HTML rendering.
6. Using `select('*')` on `events`.
