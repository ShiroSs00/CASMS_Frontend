# FE journey integration

User authorizes catalog UX repair and implementing journey workflows without changing BE. Interest percentages explicitly excluded. Base ee89e6cfb53876951070c386a59d0333faf94aae; baseline git status inspected. Preserve preceding changes to MasterDataPages and admin-navigation and existing documentation.

Allowed: src/features/service-packages/**, src/features/booking/**, src/features/cruises/**, src/app/pages/AdminStaffFunctionPage.tsx and this document. No BE, schema, permissions, dependencies or MobileApp changes. Wire only available APIs. Contract acceptance, finance access, installment allocation, scheduled-service configuration, actual boarding and lifecycle business enforcement remain BE blockers. Never simulate successful writes or bypass a 403. Custom packages use user-chosen names and composition with supported package types; Extra maps to ADD_ON. Keep backend readiness authoritative.

Scope expansion: fix the synchronous effect-state lint issue introduced in the previous port cancellation repair in MasterDataPages.tsx. Preserve that repair and the action-row changes; remount PortForm by route ID and clear stale error only from a live successful load.

Deliver: compact responsive catalog forms; all supported package tiers and readable benefits; slot selection; payment ledger/create/confirm backed by API; cruise staff/manifest/guidance and check-in backed by existing API. Explicit unavailable states where BE lacks support. No automated tests per user. Production build for compilation; no live business writes during implementation.
