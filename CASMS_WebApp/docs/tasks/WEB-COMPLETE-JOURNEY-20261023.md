# Complete supported journey workflows

User scope: create a new FE branch, fix remaining FE gaps, and apply existing BE migrations to the local database. The user explicitly selected FE-only source changes; no BE API/schema changes, Mobile changes, push or fabricated contract/boarding/payment-allocation operations.

Baseline FE: `0b1645b` on `codex/complete-journey-workflows-20261023`; existing untracked `docs/tasks/WEB-operations-masterdata-test-20261023.md` is preserved. BE `5756081` has pre-existing local CHAR mapping imports and generated files; preserve these.

Allowed paths under CASMS_WebApp: this contract; features/booking/pages/{FinanceBookingsPage,RealBookingPages,CheckinDesk}.tsx; features/booking/components/{PaymentLedger,BookingInstallments}.tsx; features/booking/api/payment-api.ts; features/service-packages/api/{service-package-api,schedule-api}.ts; features/service-packages/model/{catalog,catalog-contract}.ts and catalog-contract.test.mjs; features/service-packages/components/{PackageBenefitsEditor,ServiceSchedules}.tsx; features/service-packages/pages/{CatalogDetailPage,ServiceRequestFormPage}.tsx.

Sources: current BE controllers/services and V20–V23 migrations, current FE journey handoff. Read-only DB inspection verified localhost:5432/casms is at V19. Back up before migrating. Run only existing Flyway migrations, no clean/repair/demo seeding/Hibernate update.

Acceptance: inherited benefits retain their source package and display correctly; edits/removals apply only to local components. Finance ledger can be read with payment permissions independently of booking detail, selected booking metadata survives pagination, and errors are accurately classified. Scheduled service requests retain slot/price snapshots and provide reload/revalidation. Booking confirmation is blocked while contract is not Accepted. Check-in acts only on active passengers and provides status recovery after uncertain responses. Unsupported contract acceptance, per-installment allocation and boarding remain explicitly unavailable.

Validation: lint, typecheck, production build, relevant regression tests and source review. Verify database Flyway history reaches V23. Record runtime/browser limits and remaining BE dependencies.

Scope extension during source review: features/booking/api/customer-extras-api.ts also rejects inherited components on the passenger-facing screen, so include that adapter. Update existing VM test loaders in tests/admin/{onboard-contracts,v31-service-contract}.test.mjs for the new pure decoder dependency, tests/booking/production-flow.test.mjs for the Notice dependency and tests/booking/ui-api-repair.test.mjs to verify inherited package sources. Temporary read-only UI harness lives only in ignored node_modules/.cache/journey-qa and intercepts all requests; it never sends writes to the real API.

Include features/booking/api/payment-api.test.mjs for regression coverage of foreign/duplicate/malformed ledger rows and mismatched confirmation responses.

## Result

- FE branch: codex/complete-journey-workflows-20261023. No commits or pushes made.
- Local database localhost:5432/casms migrated from V19 to V23 using the existing BE Flyway dependencies and unchanged migration files. Verified V20/V21/V22/V23 success, zero failed migrations. No clean, repair, Hibernate update or demo seed. Backup archive verified readable: C:/Users/quanh/AppData/Local/Temp/casms-db-backups/casms-before-v23-20261023-112615.dump.
- Fixed inherited package components for admin and public adapters. Preserve ancestor package IDs, validate effective entitlements, and prevent modifying/removing inherited rows from child packages.
- Finance ledger is independent of BOOKING_READ. Direct ID lookup uses only the existing permission-checked payment API; no ownership bypass. Selected booking reference/currency persists across list pages. Only HTTP 403 gets the booking-permission explanation. Creation waits for booking currency; existing payments retain their own currency for confirmation. Added response validation and explicit refresh.
- Draft booking confirmation requires the persisted Accepted contract status. Contract acceptance and installment allocation are still BE dependencies; no manufactured paid states or new signing action.
- Scheduled request details preserve schedule and price/currency snapshots. Slot rows are validated, reload is available, and scheduled quantity edits are disabled because current BE updatePending checks global service capacity rather than slot capacity. Notes remain editable through the existing API.
- Check-in limits mutations to Active passengers, validates returned status, supports NotStarted, and requires a status reread after failed/uncertain mutation responses.

Validation: lint and typecheck passed. New inherited-benefit and payment-response tests passed, as did public inheritance and installment regression checks. Full suite before adding the two payment cases: 309 pass, 39 fail, 1 skip. A temporary clean export of base commit 0b1645b produced 307 pass, the same 39 named failures, and 1 skip; the failing-test sets are identical. The legacy failures involve existing navigation/catalog expectations, destination VM imports and roster query expectations. Do not report the full suite as passing.

Browser: read-only fixture verified inherited rows have no edit/delete actions, and a session without BOOKING_READ can still open a payment ledger. Mutations were intercepted; no live booking/payment/check-in data was changed. This verifies rendering and interaction with fixtures, not end-to-end server mutation behavior. BE working-tree status/diff remains identical to the recorded baseline.

Still dependent on BE: contract acceptance endpoint; finance booking detail access; installment payment allocation; readiness status consistency; writable service scheduling flag/category entitlements; multi-package checkout and actual boarding/QR operations. These were intentionally left explicit because the user authorized FE-only source work.
`npm run lint`, `npm run typecheck`, production Vite build and `git diff --check` passed after the final source edits. Temporary UI harness removed and QA Vite servers stopped.
