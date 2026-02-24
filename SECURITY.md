# Security Policy

## Supported Versions

This project is maintained on the main branch and latest deployment state.

| Version | Supported |
| ------- | --------- |
| Current main | Yes |
| Older snapshots | No |

## Reporting a Vulnerability

Please report security issues privately to the project maintainer instead of opening a public issue.
Include:
- Affected feature/path
- Reproduction steps
- Impact assessment
- Suggested mitigation (if any)

Acknowledgement target: within 3 business days.

## Security Notes for This Project

- Supabase `events` queries must use projected columns and month-range filtering.
- Do not commit private Supabase keys.
- Rich text rendering must stay sanitized (DOMPurify).
- Auto-login for NADI4U is currently enabled for operations convenience.
  - Treat that account as low-privilege.
  - Rotate credentials regularly.
  - Avoid granting write/admin capabilities to that account.
- Keep Total Programs aggregation independent from list-type UI toggles to avoid misleading operational reporting.
