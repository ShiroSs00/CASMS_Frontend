# Cruise categories and informational note cleanup

Baseline: 38b0d4816c350487e64198b336c7c51bcf7f7399, with all earlier session changes preserved.

User scope: exactly two cruise form categories: short (1–2 calendar days) and long (3–5 calendar days); remove explanatory blue note boxes throughout the web app. Allowed: src/features/** for affected form/type labels and explanatory notes; src/shared/ui/AdminUI.tsx for neutral presentation of retained operational states; this contract. Existing API enum values ONE_DAY/MULTI_DAYS remain the transport mapping; no backend or mobile changes.

Use inclusive calendar days in Asia/Ho_Chi_Minh for form eligibility. Retain operational errors, empty states, permission feedback and actual check results. User requests code only: do not run tests, lint, typecheck, build or browser checks.

Implemented: two explicit form options, calendar-day validation for 1–2/3–5 days and a 5-day form maximum; matching category labels in management, homepage and public catalogue filters. Removed 15 explanatory notes across cruise, booking, itinerary, regulation, service-request, fleet and issue screens. Remaining operational state notices default to neutral styling; stop check results and the current issue assignee remain visible without blue explanatory boxes. Existing source reviewed only; no automated or browser checks run.

Follow-up: defer field errors and error summary until the first Create/Save submission. After that attempt, edits update existing validation feedback. Reset attempted submission/errors when loading another cruise. No automated checks run at user request.
