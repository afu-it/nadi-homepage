# CLAUDE.md

This file provides implementation guidance for AI coding agents working in this repository.

## Project Snapshot
NADI Home is a vanilla JavaScript app for 18 Pulau Pinang sites.
Modules include calendar, leave workflow, announcements, reminders, KPI tracking, and Smart Services NADI4U program operations.

## Stack
- HTML5 + Vanilla JS
- Tailwind CSS (CDN)
- Supabase (PostgreSQL + Realtime)
- NADI4U REST API
- DOMPurify + Font Awesome

## High-Priority Behavior

- Program List is Smart Services NADI4U only.
- NADI4U login + sync is automatic on site load/refresh.
- Total Programs uses sub-category counts with section breakdown:
  - Today Events
  - Multiple Day Events
  - Weekly Events (week-by-week)
  - Monthly Events
- Program List type buttons (`Today Events` / `Multiple Day Events`) only filter Program List rows.
- Total Programs sections/counts must stay visible and complete regardless of selected list type.
- Total labels are clickable and filter scope depends on clicked section.

## Commands

```bash
python -m http.server 5500
# or
npx serve -p 5500
```

```bash
node --check js/config.js
node --check js/app.js
node --check js/leave-integrated.js
node --check js/password-utils.js
node --check js/reminder-system.js
node --check js/kpi-system.js
node --check js/nadi4u-api.js
```

## Data Rules
- Never `select('*')` on Supabase `events`.
- Always query `events` by month range with projected columns.
- Preserve month cache behavior and selected-date month navigation logic.

## KPI Mapping
- entrepreneur: Preneur, EmpowHer, Kidventure
- learning: eKelas Keusahawanan, DiLea, Cybersecurity, eKelas Maxis, Tinytechies, eSport, Mahir
- wellbeing: CARE bundle behavior (CARE + MenWell + FlourisHer)
- awareness: KIS
- gov: MyDigital ID

## Notes
- `TEST PROGRAM` must remain excluded from Smart Services NADI4U list.
- Keep iframe compatibility and avoid popup-dependent workflows.
- Keep all modal layering and storage fallback logic intact.
