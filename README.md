# NADI Home (Pulau Pinang)

NADI Home is a static, iframe-safe web application for 18 NADI sites in Pulau Pinang.
It combines calendar operations, leave workflow, announcements, reminders, KPI tracking, and Smart Services NADI4U program monitoring.

## Core Features

- Calendar management with month navigation and auto-selected date behavior.
- Leave workflow for staff and supervisors (request, review, status visibility).
- Announcements board and reminder system.
- KPI tracking across 18 sites and 13 KPI targets.
- KPI Info panel (supervisor editable, staff view mode).
- Smart Services NADI4U program list with automatic sync.

## Smart Services NADI4U (Current Behavior)

- Program List is NADI4U-only (Recent Events view removed).
- Auto-login and auto-sync run on site load/refresh.
- Current implementation uses a fixed account:
  - `assistantmanager@kebun-bunga.nadi.my`
- Auto-sync pulls current month schedule + event metadata.
- Program cards show:
  - Program Type (uppercase label above title)
  - KPI category/subcategory mapping
  - Registration links (NES + detected website links from Program Info)
- `TEST PROGRAM` entries are excluded from the NADI4U list.

## NADI4U Totals and Filtering

Total Programs panel includes:
- Today Events
- Multiple Day Events
- Weekly Events (Week 1, Week 2, ... by month day ranges)
- Monthly Events

Total Programs is always visible for all sections above.
Program List type buttons (`Today Events` / `Multiple Day Events`) only affect the Program List card and do not suppress Total Programs sections.

Totals are grouped by sub-category and sorted by KPI category order:
1. Entrepreneurship
2. Lifelong Learning
3. Wellbeing
4. Awareness
5. Gov Initiative

All sub-category labels are clickable.
Filter scope follows clicked section:
- Today Events label -> day-only list scope
- Multiple Day Events label -> multi-day-only list scope
- Week N label -> that week only
- Monthly Events label -> full month scope

Program List header has two quick buttons:
- Today Events
- Multiple Day Events

## KPI Notes

KPI categories:
- Entrepreneurship: Preneur, EmpowHer, Kidventure
- Lifelong Learning: eKelas Keusahawanan, DiLea, Cybersecurity, eKelas Maxis, Tinytechies, eSport, Mahir
- Wellbeing: CARE bundle (CARE + MenWell + FlourisHer tracked together as one KPI completion rule)
- Awareness: KIS
- Gov Initiative: MyDigital ID

## Project Structure

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

## Development

Run locally:

```bash
python -m http.server 5500
# or
npx serve -p 5500
```

Syntax checks:

```bash
node --check js/config.js
node --check js/app.js
node --check js/leave-integrated.js
node --check js/password-utils.js
node --check js/reminder-system.js
node --check js/kpi-system.js
node --check js/nadi4u-api.js
```

## Data and Query Rules

- Never use `select('*')` on Supabase `events`.
- Use projected columns only.
- Query events by month window.
- Keep month cache logic intact.

## Security Warning

Auto-login credentials for NADI4U are currently embedded for operational convenience.
Treat this account as low-privilege and rotate credentials regularly.

## Versioning

See `CHANGELOG.md` for recent updates.
