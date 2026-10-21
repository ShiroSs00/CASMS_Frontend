# V15 — Customer Booking API coverage and verification

21/10/2026. **FE WIRED + CONTRACT-TESTED; LIVE E2E BLOCKED.** The public create journey, account list/detail and direct authorized Booking operations already had real adapters before V15; this task completes the remaining permission, DTO, management-view and live/preview separation gaps. No claim that all15 endpoints are newly introduced.

Base/branch preserved: `e58770aa954be2508b5aedd0d7843e9890c74a28`, `codex/ocv-booking-ux-admin-logout-v7`. Snapshot of57 dirty files at `C:/Users/USER/AppData/Local/Temp/ocv-v15-baseline-86bga0gw`. Eight pre-existing Booking files were updated within contract;49 others remain byte-identical. Other edits are scoped Booking files previously clean/new. No Home, CSS, dependency, auth/security, router, Backend/DB/Flyway, Admin page/shell or Git history changes. Shared Booking API helpers still serve Admin callers; existing Admin behavior/tests retained, no new Admin functionality.

## Endpoint-to-screen matrix

Paths below omit the shared `/api` context prefix. **WIRED + CONTRACT-TESTED** means real `@/shared/api` transport with validated source DTOs and explicit mocked HTTP tests, not successful live API verification. Every live dependency below is currently **BE BLOCKED**. No endpoint is marked LIVE VERIFIED.

| Screen/action | Method/path | FE implementation | Implementation status | Live dependency / notes |
| --- | --- | --- | --- | --- |
| Landing finder → discovery; checkout cruise choices | GET `/cruise` | `api/booking-api.ts` liveCruiseCatalogApi.list; `api/real-booking-api.ts` cruises; `components/LiveCruiseCatalog.tsx`; Home finder unchanged | WIRED + CONTRACT-TESTED | Fresh list502. PUBLISHED, zero-based server paging, size/sort/type mapped; checkout fetches all published pages. No unsupported region/date filter. |
| Cruise detail | GET `/cruise/{cruiseId}` | `booking-api.ts` detail; LiveCruiseCatalog | WIRED + CONTRACT-TESTED | Valid UUID only, returned ID must match; nonpublished/unavailable state, safe retry. No live published ID available. Canonical links no longer require `catalog=live`. |
| Supplemental ship | GET `/ships/{shipId}` | booking-api.ship; LiveCruiseCatalog extended details | WIRED + CONTRACT-TESTED | SHIP_READ required by current BE. Guest uses Cruise DTO's shipName if returned; no unauthorized request or invented ship facts. |
| Find itinerary by actual Cruise ID | GET `/itineraries?page=...` | booking-api.itinerary; live-itinerary-contract.lookupItinerary | WIRED + CONTRACT-TESTED | ITINERARY_READ. Bounded paged search using itinerary.cruiseId, no invented direct-by-cruise route. Limit/missing/error distinct. |
| Itinerary days | GET `/itineraries/{itineraryId}/days` | booking-api.days; live-itinerary-contract.toLiveDays | WIRED + CONTRACT-TESTED | ITINERARY_READ. Correct verified parent ID, day order/nullable metadata validated. |
| Itinerary port calls | GET `/cruise-stops/by-itinerary/{itineraryId}` | booking-api.stops; live-itinerary-contract.toLivePortCalls | WIRED + CONTRACT-TESTED | CRUISE_STOP_READ independently required. Missing permission does not prevent loading allowed ship/days/core or Booking entry. |
| Cabin selection / permitted cabin change | GET `/booking/available-cabins?cruiseId=...` | real-booking-api.cabins; LiveBookingFields; RealBookingPages operations | WIRED + CONTRACT-TESTED | Public endpoint; grouped capacity/409 recovery retained. Null deck/accessibility and optional estimatedPrice/priceMultiplier mapped. Estimate lacks currency; UI does not assign one or total it. |
| Optional package selection | GET `/servicepackage/packages` | real-booking-api.packages; LiveBookingFields | WIRED + CONTRACT-TESTED | Fresh packages502. ACTIVE only, exact price/currency; no invented cruise-specific applicability, service reservation or entitlement. |
| Passenger → Review → Create → result | POST `/booking` | real-booking-api.serializeBooking/create; RealBookingCreatePage unchanged | WIRED + CONTRACT-TESTED | Guest allowed; whitelisted passenger/cabin/package/plan/currency/notes DTO. Result Cruise ID checked. Confirmation lock/4xx rejection/409 refresh/unknown lock retained. **Only simulated POST executed.** |
| Result → guest lookup | GET `/booking/lookup?reference=...&email=...` or `phoneNumber=...` | real-booking-api.lookup; RealBookingPages.BookingLookupPage | WIRED + CONTRACT-TESTED | Contact values trimmed/optional query omitted; returned reference checked. Neutral403/404, safe502/network/null-response recovery; no live authorized reference supplied. |
| `/my-bookings` | GET `/booking?page=...&size=20&status=...&cruiseId=...` | real-booking-api.list; ManagementPages gate; RealBookingPages.RealBookingList | WIRED + CONTRACT-TESTED | BOOKING_READ from authoritative session; source BE controls ownership/staff scope. Page identity checked, server amounts/currency/count/departure retained and shown. Filters reset server page. |
| Account detail/manage/travellers/payment and existing preparation routes | GET `/booking/{bookingId}` | real-booking-api.get/decodeBookingDetail; ManagementPages; RealBookingPages; PublicBookingRecord | WIRED + CONTRACT-TESTED | BOOKING_READ. ID check; actual Booking/contract/installments separate; null plan explicit. Travellers view reads DOB/nationality/email/phone; protected document number excluded. Preparation mutations without a BE handler remain unavailable. |
| Explicit authorized confirm | POST `/booking/{id}/confirm` | real-booking-api.confirm; RealBookingPages.BookingOperations | WIRED + CONTRACT-TESTED | Draft + BOOKING_UPDATE or BOOKING_CREATE, explicit modal/manual reconciliation acknowledgement; read back server status. Does not claim money received. |
| Explicit authorized cancel | POST `/booking/{id}/cancel` | real-booking-api.cancel; BookingOperations | WIRED + CONTRACT-TESTED | Noncancelled + BOOKING_CANCEL; reason trimmed/required. No guest control, no automatic retry on unknown result. |
| Explicit authorized cabin change | POST `/booking/change-cabin` | real-booking-api.changeCabin; BookingOperations | WIRED + CONTRACT-TESTED | BOOKING_CABIN_ASSIGN or BOOKING_UPDATE + permitted state/person/new available cabin; exact bookingPassengerId/newCabinId/changeReason. One explicit POST then detail refetch. |

Existing auth/session transport (`/auth/login`, `/auth/me`, logout/refresh) is reused unchanged. Guest lookup/create remains outside the customer auth guard; account pages wait for effective BOOKING_READ and fail closed when missing/loading. V15 synthetic login/session data are HTTP-intercept fixtures, not real credentials.

## Missing Backend capabilities

| Existing screen/action | Coverage status | Source / current UI |
| --- | --- | --- |
| Online payment/transaction evidence/online contract signature | BE ENDPOINT MISSING | PaymentController `/payment` has no mapped handlers. Page reads real Booking fare/deposit/instructions/schedule only. Scheduled is not Paid. |
| Online check-in/status submission | BE ENDPOINT MISSING | CheckinController `/checkin` has no handlers. No mock completion. |
| Arrival slots/reservation | BE ENDPOINT MISSING | No customer handler in current controllers. No sample capacity/slot presented as real. |
| Boarding-pass issue/read/download | BE ENDPOINT MISSING | No handler. No QR/pass invented from Booking/contract states. |
| Passenger profile update/document upload | BE ENDPOINT MISSING | No customer Booking passenger write handler. Actual readonly profile supported; no fake save or protected document display. |
| Customer change-request approval workflow | BE ENDPOINT MISSING | BookingController has direct confirm/cancel/change-cabin, no request/approval handler. Only existing direct permitted operations are shown. |

Detailed source evidence, exact current502/startup failure, public-vs-passenger policy question and retest gates: [OCV_V15_BE_HANDOFF.md](C:/Users/USER/OneDrive/Documents/GitHub/CASMS_Frontend/CASMS_WebApp/OCV_V15_BE_HANDOFF.md).

## What V15 changed

Paths relative to `CASMS_WebApp/src/features/booking`:

| Files | Purpose |
| --- | --- |
| `api/booking-api.ts` | Pure live catalogue/supplement transport, no mock imports; verify Cruise response identity. |
| `api/booking-preview-api.ts` (new) | Isolated legacy fixture adapter; data/action calls require DEV **and** explicit `preview=1`. Never selected on403/502. |
| `api/real-booking-api.ts` | Nullable source contracts, strict enum/amount/metadata validation; summary fields; lookup/create identity; readonly profile metadata without protected document fields. |
| `model/booking-state.ts` | Live async data only; retire old data immediately on request identity/retry change and ignore aborted completions. |
| `model/booking-preview-state.ts` (new) | Move simulated actions out of the live hook module. |
| `model/real-booking-view.ts` | Accurate unknown/null payment-plan label; no inferred paid state. |
| `components/LiveCruiseCatalog.tsx` | Canonical detail links; permission-aware independent ship/itinerary/day/stop reads; truthful restricted information state. |
| `components/LiveBookingFields.tsx` | Actual nullable deck metadata/reference estimate; no guessed currency or summed fare. |
| `components/PublicBookingRecord.tsx` | Null plan and optional authenticated readonly passenger profile panel using existing design components. |
| `pages/ManagementPages.tsx` | Customer BOOKING_READ boundary; working existing management route navigation; precise per-capability missing-API notices; same live detail behind each read view. |
| `pages/RealBookingPages.tsx` | Public summary fields and safe read errors; hide unusable privileged controls for readonly customer; single customer frame/intro/profile composition. Existing Admin path/controls retained. |
| `components/BookingFlow.tsx`, `BookingManagement.tsx`, `PreCruise.tsx`, `BookingTransactions.tsx`, `CruiseDiscovery.tsx` | Legacy-only import relocation to guarded preview adapter/hook; not normal customer route implementations. |
| `tests/booking/v15-contract.test.mjs` (new) | Five endpoint/DTO/identity/preview/request-lifecycle contract tests. |
| `tests/booking/v15-integration.browser.mjs` (new) | Six isolated browser tests of permissions, metadata, management routes, real transport calls, authorized operations/unknown locks. |
| `docs/tasks/WEB-BOOKING-V15.md`, this report, BE handoff | Local task contract and evidence. |

## Current customer walkthrough

`/` finder → `/cruises?cruiseType=ONE_DAY|MULTI_DAYS` → `/cruises/{publishedUUID}?from=...` → `/booking/cabin-experience?cruiseId=...` → `/booking/travellers` → `/booking/review` → explicit submit/result → `/booking/lookup?reference=...`.

All of these normal routes use real typed API adapters by default. Query flags `catalog=live`/`preview=1` do not turn canonical public pages into a fixture fallback. Account menu → `/my-bookings` → `/my-bookings/{id}` and its existing subroutes uses the same real Booking DTOs with authoritative read access. Legacy fixture components are not exported/routed into this flow. Explicit V13 preview server5177 remains available, labels all simulated data/API responses and never forwards API to Backend; production bundles contain no preview adapter/DEV reference/banner markers.

## Verification

| Check | Fresh result |
| --- | --- |
| `npm run lint` | PASS, zero warnings |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; existing chunk>500kB warning remains |
| Unit/contract/lifecycle | **34/34 PASS** (previous29 + five V15 tests), no skips |
| V15 browser | **6/6 PASS**, all HTTP intercepted, no live mutations |
| Unchanged V11/V12/V13/V14 browser suites | **18/18 PASS**, includes full public simulated create/result/lookup and navigation/focus/error states |
| Unchanged existing Booking/auth/logout browser suite | **5/5 PASS**; main public create→lookup case additionally rerun after final profile mapping; not a real staff session test |
| Distinct browser cases | **29/29 PASS**, reruns not counted as new cases |
| Layout evidence | Customer detail captures at1280/1440/1920, no horizontal overflow; screenshot inspection caught a double full-height frame introduced during composition, fixed and guarded by heading-position regression. No CSS redesign. |
| Preservation | `git diff --check` PASS;49/57 pre-existing files byte-identical, eight scoped Booking files updated; branch/HEAD unchanged. No new production preview markers. |

Contract command: `node --test tests/booking/v15-contract.test.mjs` plus the previous29 test set. Browser: set bundled `CASMS_PLAYWRIGHT_MODULE`, then `node --test tests/booking/v15-integration.browser.mjs` with `CASMS_TEST_URL=http://127.0.0.1:5173`. Entire `/api/` namespace intercepted, unknown paths fail closed and UI visibly labelled `UI PREVIEW — NO LIVE BACKEND`. Never reuse these fixture credentials as real login credentials. Existing preview suites run serially against5177 as in V13/V14 runbooks.

Fresh screenshots: [Customer detail1440](C:/Users/USER/AppData/Local/Temp/ocv-v15-browser/customer-detail-1440.png);1280/1920 siblings in that folder. Public/landing regression captures: `C:/Users/USER/AppData/Local/Temp/ocv-v15-regression`. Manual NVDA/JAWS, cross-browser completeness and live financial/contract/boarding outcomes not verified.

Fresh live GET probes at10:11:53 UTC returned502 for public Cruise/Package/auth-me via FE5173; direct8080 refused connections. Container restarts on Flyway V3 missing `UserRole`. No valid live published UUID, sandbox lookup data, permitted staff/passenger session or explicit isolated mutation authorization exists. Therefore **no live Booking E2E, payment success, signed contract, check-in or staff logout success is claimed**. See BE handoff for exact source/runtime distinctions and action owners.
