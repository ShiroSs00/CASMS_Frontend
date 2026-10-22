# BE role alignment and grouped navigation results

Backend source contract: 15a113ac3b8917d8150d69225a3b785f49a60b0e. FE base and pre-existing index/worktree recorded in WEB-be-role-alignment-20261022.md. Existing staged changes preserved; no commits or pushes.

Implemented all 11 backend role names, unified ACTIVITY_SERVICE_MANAGER workspace, removal of retired SHORE_MANAGER/ACTIVITY_MANAGER session recognition, role-specific landing and combined-role permissions. Runtime navigation and direct create/edit/read routes use /auth/me.effectivePermissions and require matching user identity. ADMIN has no business-permission bypass. Same-account/roles/path refresh preserves an admitted form; other identities/routes and revocations retire it. Login return-to uses the BE source snapshot for preliminary routing and still passes the runtime guard.

Booking confirmation now requires BOOKING_CONFIRM. Create buttons follow BOOKING_CREATE; cancellation and cabin changes match controller authorities. Service request edit routes include SERVICE_REQUEST_EXECUTE, while creation requires SERVICE_REQUEST_CREATE. Catalog tabs and return links honor current session permissions.

Sidebar now groups related resources under native expandable parents, retaining permission filtering, selected child state and automatic expansion for the active resource. System/finance remain direct links. Groups cover activities/tours, services/products/requests, packages/assignments, locations/suppliers, fleet, cruises/itineraries, bookings/check-in and operations/regulations.

Validation after final source changes:
- npm run lint: passed.
- npm run typecheck: passed during alignment; final npm run build also reruns tsc -b and passed.
- npm run build: passed.
- npm test: 319 total, 318 passed, 0 failed, 1 opt-in live test skipped.
- git diff --check: passed (line-ending notices only).
- Initial sandboxed Vite test execution could not initialize its helper process; reran the suite with process permissions, passed without changing its assertions for that environment issue.

Browser checks used the real FE on :5180, proxying exclusively to a temporary fixture server on :5181 with permissions extracted from BE source, not a database. Verified unified manager login/landing, shore and onboard tools, ONBOARD_STAFF fulfilment landing and denied service creation, ADMIN system-only menu and denied finance route. Verified desktop 1440x1000, narrow viewport 390x844, disclosure opening by pointer/Enter and collapsing, hidden children in collapsed AX tree, no horizontal overflow (375px document and scroll widths with scrollbar), and outer mobile menu closing after navigation. Temporary viewport reset. Screenshots are in the task visualization directory: ocevie-admin-grouped-menu.png and ocevie-admin-grouped-menu-mobile.png.

No QA/production database connections, account changes, migrations, BE runtime restarts, BE source edits or Mobile App edits were performed. Backend working tree remains clean at 15a113a. The UI fixture preview stays available for review; it does not prove real account/migration/API readiness. Real deployment must expose the migrated ACTIVITY_SERVICE_MANAGER role and current /auth/me contract; old browser sessions with retired roles must sign in again. New BE payment/check-in/model feature implementation is outside this access/menu change.

## Follow-up: all roles and action permission parity

Applied role-specific menu priority and distinct staff labels for every role. SHIP_MANAGER has its own fleet workspace title, copy and SHIP_CREATE action; inaccessible workspace cards are omitted. Corrected shared registration read/mutation/attendance guards against the actual ActivityController, and stopped unauthorized registration/participation queries. Restored BOOKING_READ for package-assignment views and readonly package catalog context. Role identity does not grant creation or mutation; fresh effectivePermissions remain required.

Final checks: npm run lint passed; npm run typecheck passed; final npm run build (including tsc -b) passed; npm test 335 total / 334 passed / 0 failed / 1 opt-in live skipped; git diff --check passed. Added all-role menu matrices, rendered staff-menu/SHIP_MANAGER workspace regressions, action-permission coverage and unauthorized-request regression tests.

Browser fixture login and landing checked individually for ADMIN, CRUISE_MANAGER, SHIP_MANAGER, OPERATIONS_MANAGER, ACTIVITY_SERVICE_MANAGER, ONBOARD_STAFF, BOOKING_AGENT, CUSTOMER_SERVICE, CHECKIN_STAFF and FINANCE_OFFICER. Each exposed the expected role-specific menu and heading. PASSENGER was separately signed in, then direct /admin/ships redirected to /403. Results saved in visualization all-role-ui-results.json; screenshot ocevie-fleet-role-permissions.png. Existing user preview tab/session was preserved; checks used a separate temporary tab. No real BE/database authorization transactions were performed.

## Permission-specific action UI (2026-10-23)
- Omit unauthorized actions instead of showing disabled mutation buttons: excursions/tour groups and attendance, activities/registrations, booking operations, catalog/request/package management, fleet, cruise planning, itinerary day/stop operations, issues, regulations and suppliers. Continue using live effectivePermissions; no role-name shortcut.
- Read-only details retain data, lookup and retry. Omit management-only fields, package editors and fleet deletion panels; show stop details as text. Day/stop selectors include only authorized operations, including accounts with a single configuration permission.
- Open action dialogs disappear when their required grant is revoked; mutation handlers retain independent permission/lifecycle guards. Permission-driven fallback configuration requires confirmation again.
- Regression suite: 343 total, 342 passed, 0 failed, 1 opt-in live test skipped. Includes rendered read-only/partial-grant controls, all 11 BE role excursion-action matrices, authorized lifecycle constraints and permission revocation. Updated former disabled-control expectations without removing adapter/mutation tests.
- Browser QA: isolated fixture on ports 5182/5183 only; CRUISE_MANAGER detail has only read content/reload, ACTIVITY_SERVICE_MANAGER list retains create. Desktop screenshot and 390px mobile screenshot in task visualization directory; mobile width equals scroll width (390px). No real BE/DB integration claim. Temporary QA tab/server cleaned up; existing preview on 5180 preserved.
- Production build and TypeScript passed. No BE/mobile changes, database operations, staging, commits or pushes.
Final required checks: npm run lint, npm run typecheck, npm run build, npm test and git diff --check all passed. Preview fixture session stopped after closing the temporary QA tab.
