# Booking Web — implementation and verified handoff

2026-10-21. FE base `e58770aa954be2508b5aedd0d7843e9890c74a28`, existing branch `codex/ocv-booking-ux-admin-logout-v7`. V11–V15 retained. No commits/pushes, Backend/DB/Admin/security/dependency changes or live mutations.

**FE_INTEGRATION_READY: PARTIAL** — every selected existing customer operation with a usable permission/parent-data path is wired and contract-tested; 17 supporting reads require a BE public/owned contract before normal customer wiring. **LIVE_E2E_READY: BLOCKED** — Backend fails startup; real owner links, credentials/data and mutation sandbox authorization are absent.

## Coverage

| Measure | Verified result |
|---|---|
| Current Java operations / paths | **311 / 244** |
| Saved OpenAPI operations / paths | 268 / 210; all matched source; 43 source operations absent from saved snapshot |
| Booking-relevant operations | **58** = 34 customer + 21 supporting + 3 retained authorized Booking staff actions |
| WIRED + CONTRACT_TESTED | **41** (19 existing + 22 added in this task); actual routes/controls, not unused API functions |
| Required supporting reads not wired | **17 PUBLIC_ACCESS_BLOCKED / BE BLOCKED**, exact rows and permissions in coverage file |
| Other operations excluded | **253** Admin/operations/3D/BLE etc.; includes two explicit501 capabilities |
| LIVE_VERIFIED | **0**; all58 still depend on unavailable BE, with additional capability/ownership prerequisites on some wired flows |
| BE_MISSING | Check-in/payment/notifications and other absent customer capabilities; no fabricated operation count for TODO controllers |

Conditional wiring does not imply ordinary PASSENGER access. Service self-service needs SERVICE_READ/SERVICE_REQUEST permissions. Excursion catalog proves cruise→itinerary→stop and requires EXCURSION_READ plus ITINERARY_READ/CRUISE_STOP_READ; creation also EXCURSION_BOOKING. Existing Booking confirm/cancel/change-cabin controls retain their existing effective-permission gates. No new staff workflow or Admin redesign was added.

## Completed vertical slices

1. **Optional package detail** on `/booking/cabin-experience`: selected passenger package → explicit detail control → GET exact package ID; typed source fields/price/date/status; loading, safe error/retry, inactive notice. No invented benefits, availability, package fare aggregation or silent fixture fallback.
2. **Customer experiences** at `/my-bookings/:bookingId/experiences`, linked from Booking detail navigation: BOOKING_READ boundary and real parent Booking lookup. Separate capability-gated panels for same-cruise activities, own registrations, services/requests and excursions. Edit forms start from actual saved quantity and service note; mutation DTOs reject a response whose status/quantity does not match the requested operation.
3. **Activities**: complete unpaged list filtered by verified cruiseId; detail/availability; own passenger selection and positive quantity; create, read list/detail, edit pending, confirm, cancel. Server status shown separately from payment/check-in. BE enforces actual Passenger ownership; FE never identifies owner by name/email.
4. **Services**: active list, detail, quantity availability; create own Booking-linked request with note; own list/detail, edit REQUESTED, cancel REQUESTED/ACCEPTED. No staff lifecycle/action endpoint invoked. Missing rights show an honest restricted state without sending that group's requests.
5. **Excursions**: reuse existing authorized paged itinerary/stop adapters, select a proven same-cruise stop, then raw (non-envelope) list/detail/availability with exact `participants` query and registration. Reject mismatched stop/identity; existing tour registrations share the owner-scoped registration controls. Ordinary customer lacking stop mapping receives the explicit blocked state.
6. **Mutation recovery**: synchronous double-click lock, disabled controls, authoritative read reloads and persistent per-user/Booking uncertainty lock on ambiguous write outcomes. List/detail reads remain available for reconciliation; no automatic POST retry or pretend rejection. Lock survives route remount/refresh in the browser session; if unresolved, support must reconcile before more writes in that affected operation scope. No self-service unlock is provided because no definitive idempotency/reconciliation contract exists.

Existing Landing→discovery→detail→cabin/package→passengers→review→result→guest lookup and management/auth/logout behavior remain in place. All new API fixtures live only in isolated tests; production adapters always use the shared real transport. No stylesheet/design-token changes.

## Changed files in this task

| Path relative to CASMS_WebApp | Change |
|---|---|
| `src/features/booking/api/customer-extras-api.ts` | New typed decoders and22 endpoint integrations; envelope/raw response separation; parent/identity/status/quantity/currency/abort validation |
| `src/features/booking/components/CustomerPackageDetails.tsx` | Selected package detail and recovery |
| `src/features/booking/components/LiveBookingFields.tsx` | Public-only package detail entry; existing Admin composition unaffected |
| `src/features/booking/components/CustomerExperiences.tsx` | Permission-gated activity, excursion, service and own-record controls |
| `src/features/booking/model/use-extras-mutation.ts` | Busy/uncertain/error/success handling using existing mutation classification |
| `src/features/booking/pages/CustomerExperiencesPage.tsx` | Linked customer page, parent Booking read, capability/identity prerequisites |
| `src/features/booking/pages/ManagementPages.tsx` | Add customer experiences navigation link |
| `src/features/booking/index.ts` | Export customer page for app composition |
| `src/app/router.tsx` | Add only the customer experiences import/route |
| `tests/booking/complete-contract.test.mjs` | Six targeted package/activity/excursion/service/registration/request contract cases |
| `tests/booking/complete-auth.test.mjs` | Two existing auth login/refresh/logout/me/permission lifecycle contract cases; no auth production edit |
| `tests/booking/complete-integration.browser.mjs` | Eight isolated browser cases, all HTTP intercepted; unknown requests fail closed |
| `tests/booking/endpoint-inventory.py` | Reproducible read-only controller/OpenAPI reconciliation, full inventory and coverage generation |
| `docs/tasks/WEB-BOOKING-COMPLETE.md` | Local implementation scope/baseline contract |
| `OCV_BOOKING_ENDPOINT_INVENTORY.md`, `OCV_BOOKING_API_COVERAGE.md`, `OCV_BOOKING_BE_HANDOFF.md`, this file | Requested inventory, workflow/permission/function/test matrix, BE evidence and summary |

## Verification

| Check | Result |
|---|---|
| Unit/contract | **36/36 PASS**, no skips; commands below |
| Browser regression + new cases | **37/37 PASS**, no skips; 29 unchanged V11–V15/core/auth/logout cases +8 new cases |
| `npm run lint` | PASS, zero warnings |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; existing >500KB bundle warning remains (approximately937KB main JS) |
| Source inventory | 311 Java mappings / 268 snapshot entries reconciled; no snapshot operation missing in source |
| Desktop browser | 1280/1440/1920; new experiences have named fields, no horizontal overflow, no page errors/unhandled API paths. Screenshots captured and1440 inspected. Existing public journey screenshots/regression checks also pass |
| Preservation | 66/69 pre-existing dirty files byte-identical, three modified only for scoped entry/navigation. One previously clean file (Booking public entry) extended. No pre-existing file deleted. HEAD/branch unchanged; BE remains only pre-existing `.idea/misc.xml` modification and untracked `openapi.json` |
| `git diff --check` | PASS |
| Live reads | Eight anonymous GET probes all502 at10:46:07 UTC, no response body/code/trace; direct8080 refused. See handoff. Detail/cabin/lookup with real authorized IDs not run |

Contract command (from CASMS_WebApp):

```powershell
node --test tests/booking/complete-auth.test.mjs tests/booking/complete-contract.test.mjs tests/booking/v15-contract.test.mjs tests/booking/feedback.test.mjs tests/booking/presentation.test.mjs tests/home/search.test.mjs tests/admin/booking-recovery-logout.test.mjs tests/admin/booking-session-isolation.test.mjs tests/admin/v31-booking-activity.test.mjs src/features/auth/model/auth-return.test.mjs src/features/booking/api/live-cruise-contract.test.mjs src/features/booking/api/live-itinerary-contract.test.mjs
```

Browser command: start existing labelled fixture server5177 separately with `node tests/booking/preview-server.mjs`; real Vite serves5173. Set `CASMS_PLAYWRIGHT_MODULE` to installed Playwright, `CASMS_TEST_URL=http://127.0.0.1:5173`, `CASMS_PREVIEW_URL=http://127.0.0.1:5177`, then:

```powershell
node --test --test-concurrency=1 tests/booking/refinement.browser.mjs tests/booking/v12-recovery.browser.mjs tests/booking/v13-scenarios.browser.mjs tests/home/landing.browser.mjs tests/booking/v15-integration.browser.mjs tests/admin/booking-logout.browser.mjs tests/booking/complete-integration.browser.mjs
```

Fixture server never forwards API requests to BE; new/5173 tests intercept every API and show UI PREVIEW labels. Test credentials are invented and never submitted to real auth. Browser proof is simulated API behavior, not live Booking/payment/staff session verification. Manual assistive technology and complete cross-browser coverage not run.

Screenshots and regression evidence: `C:/Users/USER/AppData/Local/Temp/ocv-booking-complete-evidence/`, including `customer-experiences-1280.png`, `-1440.png`, `-1920.png`. Hash preservation evidence: `C:/Users/USER/AppData/Local/Temp/ocv-booking-complete-preservation.json`.

## Exact remaining queue, blocked by BE contracts

| Endpoint group (all GET; full signatures in coverage) | Intended FE file/control after BE decision | Required check |
|---|---|---|
| `/ports/active`, `/ports/{id}`, `/destinations/active`, `/destinations/{id}` | Future Booking-local public-content adapter + discovery/detail context; only add supported filters if BE supplies them | Public published/ACTIVE access; exact IDs; no fake complete-dataset search |
| `/decks/{id}`, `/decks/{id}/cabins`, `/decks/by-ship/{id}`, `/cabins/{id}`, `/cabins/by-ship/{id}`, `/cabins/by-deck/{id}` | Booking cabin detail adapter/panel; reuse available-cabins for availability | Scoped published/owned metadata; pagination and parent ship/deck checks; no internal assignment leaks |
| `/itineraries/{id}` | Existing `booking-api.ts` supplemental metadata if missing beyond current list DTO | Narrow published/owned access; parent cruise identity |
| `/servicepackage/packages/{id}/benefits`, `/services`, `/activities`, `/excursions` under that package | Extend CustomerPackageDetails with actual read-only benefits, not management permissions | DTO/benefit identity, INCLUDED/OPTIONAL without invented reservations |
| `/servicepackage/package-assignments`, `/servicepackage/package-assignments/{bookingPassengerId}` | Owned BookingRecord package agreed-price panel | BE owned read contract, agreed currency/amount distinct from catalog price |

Other critical BE tasks: fix Flyway bootstrap; export current311-operation API schema; ensure authenticated PASSENGER can read ACTIVE packages; resolve verified Passenger↔User linking and expose safe own-profile metadata; decide service and excursion read permissions; provide isolated sandbox, valid customer/staff accounts and approved lookup data. Source-linked details and safe reproduction are in `OCV_BOOKING_BE_HANDOFF.md`. No independent approved customer write endpoint is left as an unused API function in this delivery.
