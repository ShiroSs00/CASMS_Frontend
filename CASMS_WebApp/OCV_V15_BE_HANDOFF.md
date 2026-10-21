# V15 — Backend dependencies for customer Booking

21/10/2026. FE implementation continues despite runtime outage. **No live Booking mutation was sent.** No Backend, Docker, DB, Flyway, permissions, credentials or Git history changed. Source references below are relative to `C:/Users/USER/OneDrive/Documents/GitHub/CASMS_Backend`.

Java paths shortened as `config/...`, `booking/...`, `ship/...`, `payment/...`, `checkin/...` or `identity/...` start under `src/main/java/com/casms/`.

## Current evidence, separate from historical403

Fresh anonymous GET probes at **10:11:53–10:11:59 UTC** (17:11 Việt Nam):

| Exact method/path | FE5173 | Direct8080 | Code/trace/authentication |
| --- | --- | --- | --- |
| GET `/api/cruise?status=PUBLISHED` | 502, empty body | Connection refused | No error code/trace/correlation; no Bearer/cookies |
| GET `/api/servicepackage/packages` | 502, empty body | Connection refused | Same |
| GET `/api/auth/me` | 502, empty body | Connection refused | Same; this is not a successful anonymous auth check |

Probe JSON: `C:/Users/USER/AppData/Local/Temp/ocv-v15-live-probes.json`. `docker ps -a` showed `casms-backend Restarting`, Postgres healthy. Read-only `docker logs --tail70 casms-backend` again showed `Migration V3__insert_default_users.sql failed` / `ERROR: relation "UserRole" does not exist`. There is no application request trace to correlate to proxy502 while startup fails.

Historical V9 Cruise/Package403 came from an older artifact lacking URL public GET matchers and carrying old method guards; V13 inspected a different image. That evidence is retained in `OCV_V9_LIVE_BOOKING_DIAGNOSIS.md` / `OCV_V13_BE_HANDOFF.md`. **V15 does not infer the current runtime security policy from that historical JAR, or claim403 has been repaired.**

No verified live published UUID was available, so valid-ID detail/cabins were not probed using fake UUIDs. No authorized sandbox reference/contact or staff session was available. Lookup, protected GET and POST live results remain unverified.

## Specific owner actions / retest gates

| Dependency | Source evidence | BE owner action | Retest gate |
| --- | --- | --- | --- |
| Startup / artifact identity | `src/main/resources/db/migration/V3__insert_default_users.sql:7` alters `"UserRole"`; Flyway startup failure repeated in current log | Diagnose schema/migration order/profile/database against the intended revision through reviewed migration procedures. Do not reset data or skip/repair history merely to hide the failure. Supply running commit/image identity. | Stable healthy container, direct HTTP response, reviewed artifact identity |
| Public Cruise/Package access for logged-in passengers | `config/SecurityConfig.java:54–60` permits guest GET Cruise/Package; `ship/controller/CruiseController.java` list/detail and `servicepackage/controller/ServicepackageController.java:53–54` method guards permit anonymous or named staff authorities | Confirm intended public-read policy for **both anonymous and authenticated passenger**. Current source can deny an authenticated passenger lacking CRUISE_READ / TOUR_PACKAGE_* even though guest access is permitted. FE retains its legitimate token; no bypass is applied. | Guest and passenger GET list/detail/package200, only PUBLISHED/ACTIVE public data; staff privilege cases remain protected |
| Public detailed ship/itinerary information | `ship/controller/ShipController.java:51` SHIP_READ; `ItineraryController.java:51,178` ITINERARY_READ; `CruiseStopController.java` listByItinerary CRUISE_STOP_READ; SecurityConfig otherwise authenticated | Decide whether customer-safe read DTOs/endpoints should be public. FE now reads these existing endpoints only when the session has the actual named permission; guest gets core Cruise DTO and truthful restricted-info text. | Legitimate permitted session reads matching ship/itinerary/day/stop IDs; guest has no unauthorized supplemental requests. If public endpoints are introduced, provide reviewed DTO/policy before FE maps them. |
| Account Booking reads / ownership | `booking/controller/BookingController.java:70,82` requires BOOKING_READ; `BookingService.list/detail/validateAccess` owns passenger filtering/access | Supply a permitted test passenger session and confirm BOOKING_READ grant + server ownership behavior. FE fails closed while access loads/is missing and never substitutes samples. | Passenger sees own list/detail only; other owner denied; staff scope tested separately |
| Cabin reference currency | `booking/dto/response/AvailableCabinResponse.java` returns estimatedPrice/priceMultiplier but **no currency**; `BookingService.getAvailableCabins` derives baseFare×multiplier without a currency parameter | Specify monetary unit or return currency alongside estimate. Clarify how requested Booking currency and package currencies are handled; source create labels the amount with request currency, with no conversion established here. | Currency/estimate semantics documented and contract-tested. FE currently labels estimate as missing a currency and never assigns draft currency/converts/sums it. |
| Real Booking create / lookup data | `BookingCreateRequest`, `BookingDetailResponse`, `BookingService.createBooking/lookupBooking` | Provide future PUBLISHED cruise, assigned ship/cabins with capacity, optional ACTIVE package, authorized lookup reference/contact; authorize an **isolated mutation sandbox** explicitly before POST tests | Read-only detail/cabins/lookup first, then separately authorized one-time create + persisted reference/contracts/installments. Do not test against shared real inventory. |
| Confirmation vs payment | `BookingService.confirm:392–408` changes Booking status after access check; it does not reconcile payment there. `PaymentController` has no handlers. | Clarify the authoritative deposit/payment reconciliation workflow and confirmation prerequisite; do not treat Confirmed or Scheduled as payment proof | Server-derived Booking/contract/installment states tested independently; no fake Paid/online-signature status |
| Contract nullable plan | `BookingService.mapToDetailResponse` sets paymentPlan only when installment count is1/2/3; contract/date fields can be null | Confirm behavior for legacy/zero-installment bookings and allowed enum values | Null plan displays “Chưa có kế hoạch thanh toán”; unknown values fail decoding instead of showing fabricated payment success |

## Missing endpoints: no request can be wired yet

These are absent capabilities, not HTTP403 or HTTP502. Do not add guessed client routes. Existing customer screens stay read-only and show the exact unavailable action while displaying live Booking detail where authorized.

| Existing FE route/action | Concrete source finding | Needed contract before implementation |
| --- | --- | --- |
| `/my-bookings/:id/payment`: pay, reconcile transactions, sign contract online | `payment/controller/PaymentController.java` declares `/payment` but has **no method mappings** (`TODO: implement endpoints`). Booking detail supplies only fare/deposit/instructions/installment schedule. | Customer-authorized payment initiation/status/receipt or reconciliation DTOs, idempotency and sandbox rules; online contract acceptance if intended. No handler path can currently be named beyond the empty `/payment` prefix. |
| `/my-bookings/:id/check-in`: submit/check check-in status | `checkin/controller/CheckinController.java` declares `/checkin` but has **no method mappings** (`TODO`). | Per-Booking/passenger access, read status/prerequisites and submit contract; define states and failure/retry behavior |
| `/my-bookings/:id/arrival-time`: read/reserve/change slot | No mapped customer arrival-slot/selection handler in available controllers; empty CheckinController | Slot identity/timezone/capacity, customer selection/update and status endpoints; no sample slots should be treated as inventory |
| `/my-bookings/:id/boarding-pass`: issue/read/download pass | No mapped boarding-pass handler in available controllers; empty CheckinController | Eligibility/status, issuance/download and token handling; Confirmed/contract status is insufficient to fabricate a pass |
| `/my-bookings/:id/travellers`: update profile/upload travel document | No mapped customer Booking passenger update/upload handler. `identity/controller/IdentityController` exposes staff user lookup only; BLE identity endpoints are not document/check-in APIs. | Owner-scoped update/upload, protected-field and redaction DTOs. FE now displays actual readonly DOB/nationality/contact from BookingDetail, excludes documentNumberProtected from its view model. |
| `/my-bookings/:id/change-request`: request/approval workflow | BookingController has confirm/cancel/change-cabin, **no customer change-request or approval-status handler** | Request types/eligibility, submit/status/cancel-request endpoints if such workflow is intended. Existing direct operations remain available only to explicitly permitted sessions/states. |

Missing request-parameter handling on public cabins previously returned500 in V9 control; retest client-error handling after startup without conflating that control with valid-ID availability.

Retest sequence: startup/artifact → anonymous/public reads → actual published ID detail/cabins → permitted passenger ownership/lookup reads → legitimate staff/session checks → explicitly authorized isolated mutations. Tokens, passwords and PII must stay out of evidence reports. No Backend repair or account creation was attempted here.
