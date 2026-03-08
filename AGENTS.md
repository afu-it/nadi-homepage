# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-27
**Commit:** ffcba03
**Branch:** main

## OVERVIEW
Static vanilla-JS operations app for NADI Pulau Pinang. Primary risk is behavior regression in NADI4U list/totals/filter semantics and embedded Google Sites session behavior.

## STRUCTURE
```text
./
├── index.html              # Main app shell, modal containers, script bootstrap
├── announcements.html      # Announcements-focused surface
├── js/                     # Core runtime logic and integrations
├── css/                    # Feature-scoped stylesheets
├── AGENTS.md               # Root guardrails (this file)
├── js/AGENTS.md            # JS subsystem conventions
└── css/AGENTS.md           # CSS subsystem conventions
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Program list/totals/filter behavior | `js/app.js` | Highest-centrality file; do not break scoped filter rules |
| NADI4U auth/token/session | `js/nadi4u-api.js`, `js/app.js` | Storage + reauth + sync pipeline |
| Leave login/logout/session | `js/leave-integrated.js` | `leave_user` drives KPI + NES personalization |
| KPI badge/panel | `js/kpi-system.js`, `css/kpi-system.css` | Badge must update without opening panel |
| Reminder modal | `js/reminder-system.js`, `css/reminder-system.css` | Overlay/dialog top-position behavior |
| Supabase client/config | `js/supabase.js`, `js/config.js` | Keep projected month-window event queries |

## CODE MAP
- `js/app.js`: orchestration, rendering, NADI4U list transforms, top-level filters, bootstrap.
- `js/leave-integrated.js`: leave auth/session restore, panel rendering, logout pathways.
- `js/kpi-system.js`: KPI model, monthly calculations, top badge state, dialog lifecycle.
- `index.html`: critical iframe-storage fallback bootstrap and root DOM containers.

## CONVENTIONS (PROJECT-SPECIFIC)
- Program List remains Smart Services NADI4U only.
- Auto-login + auto-sync NADI4U on load must remain intact.
- Total Programs (Today/Multiple Day/Weekly/Monthly) remain complete and always visible.
- List type buttons affect rows only; they must not mutate total counters.
- Total section labels are interactive scoped filters (Today/Multiple/Week/Monthly).
- Use storage wrappers (`safeStorage` / `appStorage`) for embed safety.

## ANTI-PATTERNS (DO NOT INTRODUCE)
- `select('*')` against `events`.
- Full-table events prefetch in browser.
- Unsanitized HTML render paths (always sanitize before `innerHTML`).
- Reintroducing recent-events list behavior or removing NADI4U-only mode.
- Breaking embedded refresh/session persistence in Google Sites iframe flows.

## KPI DEFINITIONS
- `entrepreneur`: Preneur, EmpowHer, Kidventure
- `learning`: eKelas Keusahawanan, DiLea, Cybersecurity, eKelas Maxis, Tinytechies, eSport, Mahir
- `wellbeing`: CARE bundle rule (CARE + MenWell + FlourisHer)
- `awareness`: KIS
- `gov`: MyDigital ID

## COMMANDS
```bash
python -m http.server 5500
# or
npx serve -p 5500

node --check js/config.js
node --check js/app.js
node --check js/leave-integrated.js
node --check js/password-utils.js
node --check js/reminder-system.js
node --check js/kpi-system.js
node --check js/nadi4u-api.js
```

## NOTES
- Repo is shallow (depth 1) but hotspot-heavy (`js/app.js`, `js/leave-integrated.js`, `js/kpi-system.js`).
- Use child AGENTS for details before editing under `js/` or `css/`.
