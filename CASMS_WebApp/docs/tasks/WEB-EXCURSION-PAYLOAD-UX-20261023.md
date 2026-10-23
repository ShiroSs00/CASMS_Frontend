# Excursion, catalog UX and request alignment

User scope: repair catalog navigation/status layout, excursion creation, regulation assignment bodies, required tour-group capacity and customer package types. Frontend only; no automated tests per user preference.

Baseline: FE HEAD `ee89e6cfb53876951070c386a59d0333faf94aae`; `git status --short` inspected before editing. All existing modifications and untracked files are pre-existing work. In particular, retain prior catalog UI/API changes. No backend, database, dependencies or mobile changes.

Allowed paths (relative to CASMS_WebApp):
- This document.
- src/features/regulations/api/regulations-api.ts
- src/features/tour-groups/model/tour-group.ts
- src/features/tour-groups/components/GroupForm.tsx
- src/features/booking/api/customer-extras-api.ts
- src/features/booking/components/CustomerPackageDetails.tsx (type labels found to have the same incomplete three-type mapping)
- src/features/service-packages/components/CatalogActions.tsx
- src/features/service-packages/components/Catalog.module.css
- src/features/service-packages/pages/CatalogDetailPage.tsx
- src/features/shore-excursions/api/excursion-context-api.ts
- src/features/shore-excursions/components/ExcursionForm.tsx
- src/features/shore-excursions/components/ShoreExcursions.module.css
- src/features/shore-excursions/model/shore-excursion.ts

Acceptance: navigation separate from record commands/status across the shared service/product/package detail; mandatory host ID included when assigning regulations; capacity required at input, validation and serialization for create/edit groups; all six BE package types decoded. Excursions show selected stop dates, earliest start including tender transfer and strict return deadline, with explicit time suggestion and field errors. Preserve timezone-to-UTC conversion, permissions and BE enforcement. Do not bypass invalid dates or silently replace edited dates.

Sources: current Swagger audit snapshot and BE DTOs/controllers/services (read only), especially ShoreExcursionService.validateSchedule/validateReturnTime. Return must be strictly before allAboardTime (or plannedDeparture if absent); tenderTransferMinutes applies when positive regardless of arrivalMethod. BE also rejects overlapping excursions.

Verification: lint, typecheck and production build; source/diff review. No automated tests. Browser verification subject to available browser tooling; report any limitation explicitly.

## Result

Implemented all requested FE repairs. The excursion form also lists occupied intervals for the selected stop and suggests the first available interval at minute precision, excluding the current excursion during editing. Selecting the suggestion is explicit; existing dates are preserved otherwise. Supplier eligibility, chronological order, minimum/maximum participant relation, strict deadline and known schedule conflicts are checked before submission. Backend remains authoritative for concurrent changes and failed schedule reads.

`npm run lint`, `npm run typecheck`, `npm run build` and `git diff --check` completed successfully. No automated tests or live business-data writes were run. Browser tools in this session are unavailable due to the kernel-assets path error, so the rendered layout and end-to-end creation have not been visually verified. BE git status matches the pre-existing baseline.
