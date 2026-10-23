# Catalog form width

User requests removing the unused right-side strip inside service/product/package forms shown in the screenshot. Baseline HEAD `ee89e6cfb53876951070c386a59d0333faf94aae`; full git status reviewed before edits. All earlier session modifications/untracked files are pre-existing and must remain.

Allowed paths relative to CASMS_WebApp: this document and `src/features/service-packages/components/Catalog.module.css`.

Cause: the shared `.editor` grid is limited to 900px inside a wider Panel. Remove the internal width cap and set full available width/min-width:0. Keep the page's centered outer width, two equal desktop columns, existing single-column mobile breakpoint, full-width description and footer. Notices must span both columns so error/permission/retry states do not displace fields. The same editor class is also used by the service schedule form; verify its existing two-column structure is compatible. No data/API/validation, BE, dependency, mobile or database changes. No automated tests per user preference.

Verification: scoped diff review, lint, typecheck and production build. Report any unavailable browser verification accurately.

Result: shared editor now fills the Panel's available content width, eliminating the 900px-capped right-side strip for create/edit services, products and packages, and the service schedule editor using the same class. Retained existing desktop/mobile columns and full-row description/footer; error/status notices now span the full grid. Only the two CSS rules above changed for this task; all preceding session work is preserved.

Validation: `npm run lint`, `npm run typecheck`, `npm run build` and scoped `git diff --check` passed. No automated tests or business-data writes. Rendered browser verification remains unavailable due to the session's previously confirmed kernel-assets initialization failure. No BE changes.
