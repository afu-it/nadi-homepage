# Fix NES Registration Link site_id

**Goal**: Fix NADI4U (NES) event registration links so `?site_id=` always uses the logged-in user's own NADI site_id, not the event's arbitrary site_id from the API.

**File**: `js/app.js` only

**Date**: 2026-02-27

---

## Problem Statement

- `buildNadi4uDisplayEvents()` (line 1485) passes `eventMeta?.site_id` to `buildNadi4uRegistrationUrl()`.
- `eventMeta.site_id` comes from the NADI4U REST API's `nd_event` table — it is the site that *owns* the event in the central DB, which may be any of the 18 sites.
- The app auto-logs in as `assistantmanager@kebun-bunga.nadi.my` and fetches events for ALL sites simultaneously, so `eventMeta.site_id` is essentially random per event.
- The correct `site_id` in the registration link must always be the **logged-in user's own site**, not the event's origin site.

## Correct Behavior

```
https://app.nadi.my/event-registration/{event-uuid}?site_id={USER_SITE_ID}
```

Where `{USER_SITE_ID}` = the numeric Supabase `site_id` of the user currently logged in to the leave system (same ID as the NADI4U `site_id` — they are the same cross-system value).

## User's site_id Source Chain (priority order)

1. `parseNadi4uSettingsFromStorage().templateSiteId` — most reliable when set
2. `leaveUser.site_id` read directly from localStorage (`leave_user` key) — works for all roles, not just manager
3. `eventMeta?.site_id` — last-resort fallback only; still shown when neither preferred source is available (no error thrown, just imperfect URL); document with code comment

## Site Mapping Reference (for documentation only — no code lookup needed)

| site_id | Site Name |
|---------|-----------|
| 951 | NADI Air Putih |
| 952 | NADI Kebun Bunga |
| 953 | NADI Pulau Tikus |
| 954 | NADI Tanjong Bunga |
| 955 | NADI Komtar |
| 956 | NADI Padang Kota |
| 957 | NADI Pengkalan Kota |
| 958 | NADI Batu Lancang |
| 959 | NADI Datok Keramat |
| 960 | NADI Sungai Pinang |
| 961 | NADI Air Itam |
| 962 | NADI Paya Terubong |
| 963 | NADI Seri Delima |
| 964 | NADI Batu Uban |
| 965 | NADI Batu Maung |
| 966 | NADI Pantai Jerejak |
| 967 | NADI Bayan Lepas |
| 968 | NADI Pulau Betong |

---

## Constraints & Guardrails (from Metis)

- **MUST NOT** modify `buildNadi4uRegistrationUrl()` signature or internal logic
- **MUST NOT** modify `getNadi4uTemplateFromLeaveSession()` — it has role-guard semantics needed by other callers
- **MUST NOT** modify `buildAutoNadi4uSettings()` — `templateSiteId` intentionally absent there
- **MUST NOT** call `parseNadi4uSettingsFromStorage()` inside the `forEach` loop — call once before the loop
- **MUST NOT** touch any file other than `js/app.js`
- **MUST**: In `autoLoginAndSyncNadi4uOnLoad()`, set `templateSiteId` **before** the `persistNadi4uSettings()` call so it is written to storage before sync begins
- **MUST**: Guard the write: only set `templateSiteId` if a non-empty string is found — never overwrite a valid value with empty string
- **MUST**: Use direct `leaveUser.site_id` from localStorage as Site ID source (NOT via `getNadi4uTemplateFromLeaveSession()` which has a role guard blocking non-manager roles)
- **MUST**: Keep `eventMeta?.site_id` as final fallback (last-resort, not removed) so links always render

---

## Implementation Tasks

### Task 1 — Add `getUserSiteId()` helper

**Location**: Add after `getPrimaryNadi4uSiteId()` function (line ~1295 in `js/app.js`)

**What**: Create a small helper that reads the user's site_id from the two available sources in priority order.

**Code to add**:
```javascript
/**
 * Returns the current user's NADI site_id from:
 * 1. NADI4U settings templateSiteId (set after any login)
 * 2. Leave session leaveUser.site_id (direct Supabase value, works for all roles)
 * Returns empty string if neither source is available.
 */
function getUserNadi4uSiteId() {
  // Source 1: NADI4U settings (most reliable — set after login)
  const settings = parseNadi4uSettingsFromStorage();
  const templateSiteId = settings?.templateSiteId;
  if (templateSiteId && String(templateSiteId).trim()) {
    return String(templateSiteId).trim();
  }
  // Source 2: Leave session site_id (works for all user roles)
  try {
    const raw = localStorage.getItem('leave_user');
    if (raw) {
      const leaveUser = JSON.parse(raw);
      const leaveId = leaveUser?.site_id;
      if (leaveId != null && String(leaveId).trim()) {
        return String(leaveId).trim();
      }
    }
  } catch (_) {
    // Storage read failed — fall through
  }
  return '';
}
```

**QA**: After adding, `node --check js/app.js` must pass zero errors. Function must be accessible at module scope (not nested inside another function).

---

### Task 2 — Use `getUserNadi4uSiteId()` in `buildNadi4uDisplayEvents()`

**Location**: `js/app.js`, inside `buildNadi4uDisplayEvents()`, before the `metaById.forEach()` loop (around line 1460)

**What**: Resolve the user's site_id once before the loop, then pass it to every `buildNadi4uRegistrationUrl()` call instead of `eventMeta?.site_id`.

**Current code** (line 1485):
```javascript
const nadi4uRegistrationUrl = buildNadi4uRegistrationUrl(sourceEventId, eventMeta?.site_id);
```

**Step A — Add before the forEach loop** (insert after variable declarations, before `metaById.forEach(`):
```javascript
// Resolve user's own site_id once — registration links must use the user's site,
// not the event's origin site from the API (which may be any of 18 sites).
const userSiteId = getUserNadi4uSiteId();
```

**Step B — Replace the problematic line 1485**:
```javascript
// Use userSiteId (user's own site). Falls back to eventMeta.site_id only as last resort
// when user has no leave session and no prior NADI4U login (e.g. fresh browser, no login).
const nadi4uRegistrationUrl = buildNadi4uRegistrationUrl(
  sourceEventId,
  userSiteId || eventMeta?.site_id
);
```

**QA**: After edit, `node --check js/app.js` must pass. Verify `metaById.forEach` is NOT inside the `forEach` (no nested call).

---

### Task 3 — Persist `templateSiteId` during auto-login from leave session

**Location**: `js/app.js`, inside `autoLoginAndSyncNadi4uOnLoad()`, after `mergedSettings.userEmail = NADI4U_AUTO_LOGIN_EMAIL;` (around line 6472) and **before** the `persistNadi4uSettings(mergedSettings)` call.

**What**: After auto-login succeeds, write the leave user's `site_id` to `mergedSettings.templateSiteId` so it is available when `syncNADI4UData()` renders links.

**Why here**: `persistNadi4uSettings()` is called right after this block. Setting `templateSiteId` here ensures it's persisted before sync starts.

**Code to insert** (after the `mergedSettings.userEmail` assignment, BEFORE `persistNadi4uSettings(mergedSettings)`):
```javascript
// Persist user's site_id from leave session so registration links use correct site.
// Guard: only set if a valid value found — do not overwrite existing valid templateSiteId with empty.
if (!mergedSettings.templateSiteId) {
  try {
    const raw = localStorage.getItem('leave_user');
    if (raw) {
      const leaveUser = JSON.parse(raw);
      const leaveId = leaveUser?.site_id;
      if (leaveId != null && String(leaveId).trim()) {
        mergedSettings.templateSiteId = String(leaveId).trim();
      }
    }
  } catch (_) {
    // Storage read failed — templateSiteId left unset
  }
}
```

**QA**: After edit:
- `node --check js/app.js` must pass
- Confirm the new block is inserted BEFORE `persistNadi4uSettings(mergedSettings)`, not after
- Confirm the guard `if (!mergedSettings.templateSiteId)` prevents overwriting a valid pre-existing value

---

## Final Verification Wave

### Step 1 — Syntax Check
```bash
node --check js/app.js
```
Expected: No errors. If any error, fix before proceeding.

### Step 2 — Logic Trace (dry run, no browser needed)

Read `buildNadi4uDisplayEvents()` after edits and confirm:
- `getUserNadi4uSiteId()` is called ONCE, before `metaById.forEach()`
- `userSiteId` variable is in scope inside the forEach
- `buildNadi4uRegistrationUrl(sourceEventId, userSiteId || eventMeta?.site_id)` is the updated call

Read `autoLoginAndSyncNadi4uOnLoad()` after edits and confirm:
- The leave_user localStorage read block appears BEFORE `persistNadi4uSettings(mergedSettings)`
- The guard `if (!mergedSettings.templateSiteId)` is present

### Step 3 — Browser Verification (open localhost:5500)

Open browser DevTools console after page load + auto-sync completes (wait ~5–10s):

```javascript
// A: templateSiteId must match leave_user.site_id after auto-login
const settings = JSON.parse(localStorage.getItem('nadi4uSettings') || '{}');
const leaveUser = JSON.parse(localStorage.getItem('leave_user') || '{}');
console.log('templateSiteId:', settings.templateSiteId);
console.log('leaveUser.site_id:', leaveUser.site_id);
console.assert(
  String(settings.templateSiteId) === String(leaveUser.site_id),
  'FAIL: templateSiteId does not match leaveUser.site_id'
);
```

```javascript
// B: Find a registration link in the DOM and check site_id parameter
const links = Array.from(document.querySelectorAll('a[href*="event-registration"]'));
const userSiteId = String(leaveUser.site_id);
const wrongLinks = links.filter(a => !a.href.includes(`site_id=${userSiteId}`));
console.log('Total registration links:', links.length);
console.log('Links with wrong site_id:', wrongLinks.map(a => a.href));
console.assert(wrongLinks.length === 0, 'FAIL: Some registration links have wrong site_id');
```

```javascript
// C: Fallback robustness — clear storage and reload
// (run in a second tab or after clearing storage manually)
localStorage.removeItem('leave_user');
localStorage.removeItem('nadi4uSettings');
location.reload();
// After reload: registration links should still render (not throw), using eventMeta.site_id as fallback
```

---

## Acceptance Criteria

| # | Criterion | How to verify |
|---|-----------|---------------|
| 1 | `node --check js/app.js` exits with code 0 | Task 1 verification step |
| 2 | `settings.templateSiteId === String(leaveUser.site_id)` after auto-login | Browser console assertion A |
| 3 | All DOM registration links contain `?site_id={user_site_id}` | Browser console assertion B |
| 4 | No JS error thrown when `leave_user` and `nadi4uSettings` are absent | Browser console assertion C |
| 5 | `getUserNadi4uSiteId()` called once (before forEach), not per-event | Code read trace |
| 6 | `buildNadi4uRegistrationUrl()` signature unchanged | Code read trace |
| 7 | `getNadi4uTemplateFromLeaveSession()` unchanged | Code read trace |
| 8 | Only `js/app.js` modified | `git diff --name-only` |

---

## Out of Scope

- Modifying `getNadi4uTemplateFromLeaveSession()` — it has correct role-guard behavior for login flows
- Modifying `buildNadi4uRegistrationUrl()` signature
- Modifying `buildAutoNadi4uSettings()`
- Changing the auto-login credentials or site
- Adding site_id to the `Data NADI SITE.csv` lookup in code (not needed — `leaveUser.site_id` is already the correct numeric ID)
- Any changes to CSS, HTML, or other JS files
