# Changelog

All notable changes to this project are documented here.

## [Unreleased] - 2026-02-24

### Added
- Smart Services NADI4U month sync now pulls richer metadata:
  - Pillar/subcategory relation
  - Programme relation
  - Programme mode/type
- Fallback NADI4U API query when metadata joins are unavailable.
- Automatic NADI4U login and auto-sync on page load/refresh.
- NADI4U-only Program List mode (Recent Events view removed).
- Program List type buttons:
  - Today Events
  - Multiple Day Events
- Program Type display above NADI4U program titles.
- Registration link improvements:
  - NES registration URL generation
  - Website link extraction from Program Info
- NADI4U search UX:
  - Debounced search
  - Month-wide search scope when searching
- Total Programs enhancements:
  - Weekly breakdown by Week 1..N for the month
  - Monthly totals
  - Sub-category based counting and display
  - Clickable sub-category labels with scoped filtering
- Dynamic Program List height sync with Total Programs panel on desktop.
- New `CHANGELOG.md`.

### Changed
- KPI mapping for NADI4U now prioritizes official metadata (Pillar/Programme) with keyword fallback.
- Total Programs sorting now follows KPI category order.
- NADI4U labels and filters now use section-aware logic:
  - Today -> day-only scope
  - Multiple Day -> multi-day-only scope
  - Week N -> selected week scope
  - Monthly -> full month scope
- Total Programs text standardized to:
  - Today Events
  - Multiple Day Events

### Fixed
- Resolved runtime error: `shouldUseMonthScope is not defined`.
- Fixed broken KPI filter/list behavior caused by mixed scope conditions.
- Excluded `TEST PROGRAM` entries from Smart Services NADI4U list and totals.
- Stabilized KPI/Program list rendering interactions when applying label filters.
- Fixed Total Programs mismatch when toggling Program List type buttons:
  - `Today Events` / `Multiple Day Events` list toggle no longer causes false `No events` in the opposite totals section.
  - Today and Multiple Day totals now stay visible and accurate from scoped source data.

### Security/Operations
- Documented operational risk of embedded NADI4U auto-login credentials and least-privilege expectation.
