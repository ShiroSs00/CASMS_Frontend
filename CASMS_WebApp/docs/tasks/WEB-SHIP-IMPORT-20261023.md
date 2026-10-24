# Admin ship information import

User scope: a separate Web Admin menu for importing ship information from the 3D ZIP bundle. No Ship Manager management/version activation UI. User authorized local backend permission changes; no push requested.

Follow-up explicitly authorized by the user: remove the fleet navigation group from Web Admin. Hide ships/decks/cabins entries for ADMIN accounts without the SHIP_MANAGER role. Keep import permissions and Ship Manager navigation unchanged. The earlier rejected proposal is now within the user's requested scope.

2026-10-24 error follow-up: the user's real-backend screenshot shows a missing stored conquest/v1 bundle. Within the existing feature scope, translate this registration error, distinguish a selected stored bundle from a verified upload, and allow returning to ZIP selection in the same modal before registration. No automatic upload/registration or DB writes for this fix. Baseline remains 88ab1f4 with all earlier task changes preserved.

Baseline FE: 88ab1f440ac3fefbe5b1b2a29b676b06e2ee3e01. Pre-existing untracked docs/tasks/WEB-operations-masterdata-test-20261023.md. BE: 660e891 with pre-existing activity/booking/payment/servicepackage entity edits, Destination/Port edits, application-prod.yml and local migration notes; preserve all.

Allowed paths: src/features/ship-model-import/**; src/app/router.tsx; src/shared/ui/admin-v3/admin-navigation.ts; src/shared/api/client.ts (multipart and per-request timeout support); tests/ship-model-import/**; this contract. BE: src/main/java/com/casms/identity/service/RolePermissionInitializer.java and its existing unit test only, to grant ADMIN the ship read/create/update authorities required by the import endpoints. No new dependencies, mobile edits, deployment, DB mutation or automatic model activation.

API source: BE 660e891 ShipModelController, ShipModelAssetService, ShipModelImportService and response records. Flow: upload ZIP -> register from manifest -> import structure on DRAFT model. Service decks remain model-only. Partial import must never be labelled complete. Display server issues and retain completed steps when a subsequent step fails. Respect fresh session permissions.

Menu implementation also allows src/shared/ui/admin-v3/AdminShell.tsx: render the new standalone import entry directly, avoiding a one-item disclosure with a duplicate title. This follows the user's explicit request for a separate Web Admin menu.

Acceptance: separate admin menu, concise Vietnamese wording, a single modal form, responsive non-overlapping layout, busy/empty/error/success/partial states, duplicate submit guard, restart/resume support, multipart upload without JSON serialization or a manually set boundary, no guessed percent progress. Validate lint, typecheck, build, relevant unit tests and browser fixture at desktop/mobile/short viewport with keyboard dismissal.

## Implementation and validation

- Added /admin/ship-import, a direct standalone ADMIN menu entry, and an isolated feature. Existing Ship Manager pages were not edited.
- Single modal progresses through ZIP upload (or an already stored bundle), manifest registration and structural import. Completed steps persist in per-account browser session storage. Server history is re-read before retrying; RUNNING jobs are polled. Results distinguish success, partial and failed imports; common object errors are translated, with original messages under technical details.
- Shared transport supports FormData without a manual Content-Type and explicit long timeouts only for upload/import. Other requests retain the existing timeout and JSON body handling.
- Local BE initializer grants ADMIN SHIP_CREATE/SHIP_READ/SHIP_UPDATE; 10 RolePermissionInitializerTest tests passed on the current source. Runtime DB permissions were not changed: no backend was listening on 8080 during verification. Restart local BE and sign in again to apply the initializer. No real model import or migration executed.
- Relevant web tests: 53 passed (import, shared create-body and UI/API compatibility). Full npm test: 356 tests, 315 passed, 40 failed, 1 skipped; not represented as passing. Failures include old workspace/navigation expectations, tour-group request expectations and destination integration mocks. No unrelated tests or product behavior were changed to clear these failures.
- Browser verification used isolated fixture API :5188 and Vite :5177; the actual backend preview is :5176. Verified multipart file selection, successful/partial/failed imports, refresh recovery, input errors, Escape/focus return, one open modal, and no document overflow at 390px or 1280x620. Modal footer remained visible on the short viewport. Desktop checked at 1440x900. Fixture results are synthetic, not evidence of DB writes. Temporary viewport override reset.
- Automatic review rejected hiding the existing fleet link for ADMIN as beyond scope; that proposal was abandoned. Existing fleet navigation remains unchanged.
- No commit or push. Pre-existing user changes preserved; Maven also updated its tracked generated target/maven-status test file lists.
- Final current-source npm run lint, npm run typecheck and npm run build passed (the final build also runs tsc -b). git diff --check passed in both repositories.
