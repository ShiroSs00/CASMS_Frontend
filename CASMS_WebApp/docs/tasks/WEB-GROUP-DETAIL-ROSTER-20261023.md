# Group detail actions, capacity and roster SQL error

User scope: match excursion detail UX; remove group validation and capacity-check buttons; only show proportional capacity progress when assignedPassengers > 0 (1/4 = 25%); resolve the roster HTTP 500. Preserve the user's existing frontend-only/no-tests constraints.

Baseline: HEAD `ee89e6cfb53876951070c386a59d0333faf94aae`; full `git status --short` reviewed before edits. All existing modifications and untracked files are prior session work; retain the group inheritance form and all previous excursion/catalog changes.

Allowed paths relative to CASMS_WebApp:
- This document
- src/features/tour-groups/api/group-passenger-api.ts
- src/features/tour-groups/components/GroupControls.tsx
- src/features/tour-groups/components/GroupCapacity.tsx
- src/features/tour-groups/components/GroupPassengers.tsx
- src/features/tour-groups/components/TourUI.tsx
- src/features/tour-groups/components/TourGroups.module.css
- src/features/tour-groups/pages/TourGroupPages.tsx

Sources: existing excursion header pattern; BE TourGroupPassengerController/Service/Repository (read only). Any optional list filter selects Repository.search with nullable SQL parameters. Service.list without all filters selects findAllWithDetails, avoiding the faulty query. Read-only local API diagnostics confirmed groupId-only and groupId+each status return 500, while no filters returns 200 with one assignment. Use the supported unfiltered list under the same read permission, validate the full response, then filter by exact group ID in FE. Retain every assignment status/history; do not silently substitute an empty list on errors. This bypasses the broken BE filtered-query branch; it does not repair that BE query and retrieves all assignments available to the authorized staff account.

Acceptance: actions, Edit and Reload share the header row with status separate; confirmations, permissions, cancellation reason validation and mutation locks preserved. Keep passenger assignment and attendance flows functional. Related excursion navigation grouped consistently. Capacity is read from the existing group response, no manual capacity-check call; show fraction, percentage and styled determinate progress only for nonempty groups, preserving over-capacity warning. Errors remain visible with HTTP status, without exposing SQL internals in the UI.

Verification: source/diff review, lint/typecheck/build; no automated tests or business-data writes. Local API GET diagnostics permitted within the requested investigation. Report the session browser limitation if visual verification remains unavailable. No BE, schema, dependency or mobile changes.

## Result

GroupControls now renders beside Edit/Reload in the header, with a separate status group matching excursions. Removed the validation control/handler and manual capacity check. GroupCapacity uses the existing group response, displays assigned/maximum and remaining counts, and only renders determinate progress for assigned > 0. Progress value/max is the actual ratio, with a visible percentage (1/4 = 25%). Successful passenger mutations already reload the parent group so counts and progress refresh automatically. Empty-group removal is disabled; access/state/confirmation gates remain intact. Related excursion navigation is grouped in a Panel.

Roster reads now call the working unfiltered API, decode all returned records, then retain only the selected group. Both the roster and removal picker share this adapter. This keeps cancelled/history records and preserves failure reporting instead of fabricating empty data. SQL errors use a concise message with HTTP status in TourError, including passenger-picker errors.

Evidence: local filtered endpoint returned HTTP 500 with parameter $5 type error, including explicit-status requests; the supported unfiltered endpoint returned HTTP 200 with one assignment. No business data was created/changed. `npm run lint`, `npm run typecheck`, `npm run build`, a final scoped ESLint pass after the last component edit, and scoped `git diff --check` passed. No automated tests. Rendered layout and populated progress have not been visually verified because browser initialization in this session is unavailable (kernel-assets path error). The BE filtered query still requires a future BE repair; current FE avoids it without changing BE.
