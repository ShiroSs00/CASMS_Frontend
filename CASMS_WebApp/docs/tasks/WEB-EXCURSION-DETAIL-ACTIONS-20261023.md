# Excursion detail action layout

User requests a consistent excursion detail UX and removal of the condition-check and capacity-refresh buttons. Align record commands with Edit, following the shared port/catalog detail pattern. Group supplier, tour-group and passenger-registration navigation in one related-information section. Keep the OPEN excursion availability lookup separate from record commands.

Baseline: HEAD `ee89e6cfb53876951070c386a59d0333faf94aae`; complete `git status --short` reviewed before edits. All existing modifications/untracked files are pre-existing work, including excursion form and CSS repairs from the preceding request.

Allowed paths relative to CASMS_WebApp:
- This document
- src/features/shore-excursions/pages/ShoreExcursionPages.tsx
- src/features/shore-excursions/components/ExcursionActions.tsx
- src/features/shore-excursions/components/ShoreExcursions.module.css

Preserve permission/state gates, confirmation dialogs, cancellation reason validation, mutation locks and error handling. No backend/API contract changes, dependencies, database writes, mobile changes, automated tests or unrelated refactors. Use existing shared UI primitives and feature CSS Modules. Actions wrap at narrow widths, with status distinct from controls and links consistently sized.

Verification: source/diff review, lint, typecheck and production build. Browser verification may be limited by the session's browser kernel-assets error; report the actual verification performed.

Result: lifecycle/delete controls now share the header row with Edit and Reload; status stays in a distinct group. Removed both requested buttons and their handlers from the component. Related links share one wrapping navigation row inside a Panel. Availability lookup is a separate OPEN/read-permission section, with independent busy/error/result state. Existing confirmations and access/state gates retained.

Validation: `npm run lint`, `npm run typecheck`, `npm run build`, and scoped `git diff --check` all exited 0. No automated tests or business-data writes. Browser initialization was attempted again and failed with `failed to write kernel assets ... os error 3`, so rendered desktop/narrow viewport layout remains unverified. No BE changes.
