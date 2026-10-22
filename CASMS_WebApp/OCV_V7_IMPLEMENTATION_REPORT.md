# OcvViet V7 implementation and evidence

Date: 2026-10-21 (Asia/Saigon). Frontend implementation complete for independent scope; live guest journey remains blocked by runtime authorization.

## Latest live retest — 2026-10-21 12:08:07 (Asia/Saigon)

User requested a new runtime verification after starting FE/BE. All previous Frontend changes were preserved; this rerun changes this report only. No Backend/database/security changes, no account creation or permission edits, no Booking mutations, no commit/push.

FE was listening at `127.0.0.1:5176`; Docker container `casms-backend` was listening on port 8080. Container started 2026-10-21 11:42:00 Vietnam time; its image was created 2026-10-20 15:21:28 Vietnam time. No container rebuild/restart/reset was performed.

| Actor / actual runtime check | Result | Current interpretation |
| --- | --- | --- |
| Anonymous GET `/api/cruise?status=PUBLISHED&size=1` | 403 | Public discovery remains BLOCKED |
| Anonymous GET `/api/servicepackage/packages` | 403 | Public package catalog remains BLOCKED |
| Anonymous GET `/api/auth/me` | 401 | Expected without a session; not itself a defect |
| Same anonymous requests through localhost, IPv4 127.0.0.1, IPv6 ::1, and FE proxy | Same statuses | Not just a stopped server or FE proxy connection failure |
| GET `/api/v3/api-docs` | 200 | Backend online; both catalog GET paths documented |
| Existing real ADMIN browser session: GET `/api/auth/me` after reload | 200, success true, ADMIN role, BOOKING_READ present | Staff session runtime VERIFIED; no new login/credentials were entered by the agent |
| ADMIN GET `/api/booking` | 200, success true, totalElements 0 | Real protected read PASS; empty state rendered |
| ADMIN GET `/api/cruise?status=PUBLISHED...` from Booking create | 200, success true, totalElements 0 | No published cruise currently available for a real checkout |
| ADMIN GET `/api/servicepackage/packages` | 400, success false, code VALIDATION_FAILED | BE error: failed evaluation of `hasAnyPermission(T(com.casms.identity.enums.Permission).TOUR_PACKAGE_MANAGE, T(com.casms.identity.enums.Permission).TOUR_PACKAGE_ASSIGN)` |
| Existing ADMIN session: UI Logout → POST `/api/auth/logout` | 200; browser navigates to `/login` | Real Admin Logout PASS |
| Browser Back after Logout | Redirected to `/login?returnTo=%2Fadmin%2Fbookings` | Guard PASS |
| Refresh after that redirect | Remains on login; no restored Admin session | Persistent guard PASS |
| Public catalog in the same browser after Logout | GET `/api/cruise` 403, visible access error, no fixture cards | Guest blocker reproduced after real Logout |
| Live Booking create/confirm/cancel/change-cabin | NOT_RUN | Explicit disposable sandbox authorization remains absent |
| Live detail/guest lookup | NOT_RUN | No existing Booking/reference (list empty); no approved create |

The user initially reported having no staff account. During the check, the current FE tab acquired an existing authenticated ADMIN session; its provenance was not assumed. The agent used only that existing session, did not create an account, did not handle or disclose credentials/tokens, and then logged it out as requested.

Current blocker handoff: local source uses `hasAuthority`/`hasAnyAuthority` and declares catalog GETs public, whereas the running package error explicitly references `hasAnyPermission`. This is evidence of a runtime/source mismatch or a different authorization path; the exact cause is not established. Backend owner should reconcile the running image and method-security implementation. No security workaround was attempted. No published cruise and no existing booking are additional demo-data gates. Full live Booking E2E remains BLOCKED; real staff reads and Logout/Back/refresh are now PASS.

## S0 — Baseline, authority, boundaries

- Branch: `codex/ocv-booking-ux-admin-logout-v7`.
- Base: `e58770aa954be2508b5aedd0d7843e9890c74a28`; initial branch `main`, initial `git status --short` empty.
- Executed source: `C:/Users/USER/Downloads/OCV_CODEX_AGENT_MASTER_V7_EN_RTF_5S_TOKEN_OPTIMIZED.md`. It appeared in Downloads during the run and was read before completing S2–S6.
- Read Web AGENTS, architecture/module map/development/testing docs. Applied master V7 business digest; no claim of reading inaccessible Drive files.
- BE source read at `e6978f7f7267b388fa844644b88e2b60aef076bd`: Booking controller/service/request/response DTOs, Cruise and Servicepackage controllers, SecurityConfig, AuthController, ApiResponse. Running BE commit is UNKNOWN.
- Allowed paths: Booking feature, Booking-related Home component, minimal app route/layout and auth account-widget composition, shared Admin shell/slot, focused tests, this report. No mobile, Backend, database, authorization/session internals, environment, dependency or lockfile edits. No commit, push, merge or history rewrite. No live Booking mutations.

## S1 — Original API gate (superseded where noted by latest retest)

All paths below use browser `/api` proxy once; transport/session behavior is unchanged. GETs sent without Authorization or cookies from PowerShell and a fresh browser context.

| Fresh live evidence | Result | Interpretation |
| --- | --- | --- |
| GET `/api/cruise?status=PUBLISHED&size=1` | 403, empty response body | RUNTIME_BLOCKER: public discovery denied |
| GET `/api/servicepackage/packages` | 403, empty response body | RUNTIME_BLOCKER: optional public packages denied |
| GET `/api/booking` | 403 | Anonymous protected list denied |
| GET `/api/auth/me` | 401 | No anonymous session |
| GET `/api/v3/api-docs` | 200 | Booking paths present; API version 1.0.0 |
| Fresh browser `/cruises` through Vite | GET `/api/cruise` 403; visible error; zero voyage cards | No fixture fallback after real failure |
| Authenticated runtime reads/logout | NOT_RUN | No authorized staff credentials supplied |
| Live availability/detail/lookup | NOT_RUN | No authorized real cruise/reference context from denied catalog |
| Live Booking POST/confirm/cancel/change-cabin | NOT_RUN | Disposable sandbox authorization absent |

Initially port 8080 refused connections; later it responded as recorded above. Historic 403 is therefore freshly reproduced, not assumed. Local source declares public GET paths, but the running server denies them; no security changes or bypass were attempted. Backend owner should reconcile running configuration/revision and anonymous method-security handling. Source does not prove runtime readiness.

Verified request: `cruiseId`, currency, FULL/DEPOSIT/STAGES, optional notes, passengers with fullName, cabinId, optional birth date/nationality/document/contact/tourPackageId. Guest representative email is required by BookingService. Capacity is grouped per cabin; package status ACTIVE. Real `ApiResponse.data`, Spring page metadata and server fare/installments/contracts remain authoritative.

## Delivered changes

- **S2 discovery:** Home finder uses server-supported cruiseType; inspiration links go to live inventory without invented date/price/IDs. List/detail always use live adapter. Filters stay in URL across pagination, detail Back and reload; no single-page local filtering. Old slug URLs produce a missing state, never fixture detail. Protected ship/itinerary data can degrade without hiding cruise core.
- **S3 checkout:** specific cabin and optional package per passenger → passenger details/payment plan → full review. One provider-owned in-memory draft survives route Back/Next and login. No passenger details are persisted or placed in navigation URLs. Refresh warns before discarding entered personal data. Direct review visits validate earlier steps and return to the relevant field.
- Inline BE-aligned validation, first-invalid focus, group capacity controls, optional package error/retry, per-passenger choices and masked document review. Only backend-returned fare/deposit/deadline/contract are shown after submission; no invented quote, payment success or check-in.
- **S4 recovery:** shared synchronous submission lock, preserved draft after explicit rejection, refreshed cabin availability, no automatic POST retry. Timeout/5xx/unreadable success remains uncertain and blocks resubmission across step navigation. Success offers copy-reference, guest lookup and an explicit new-booking action. Lookup prefills only reference, clears stale results on input change and cancels reads on unmount.
- Existing Admin Booking operations also block repeated writes after unknown outcomes until an explicit record reload. Admin lookup link stays in Admin chrome.
- **S5 logout:** auth-aware widget injected from app into shared shell; visible with default or custom topbar. Reuses existing logout and fail-safe local clearing; duplicate-click lock; replace navigation to login. Permission guards, auth internals and public menu unchanged.

## Changed files (grouped)

- Discovery/Home: `features/home/components/LandingSections.tsx`; Booking `pages/DiscoveryPages.tsx`, `components/LiveCruiseCatalog.tsx`, `CruiseDiscovery.tsx`, `Booking.module.css`, `api/booking-api.ts`.
- Checkout/recovery: Booking `pages/FlowPages.tsx`, `RealBookingCreatePage.tsx`, `RealBookingPages.tsx`; `components/BookingProvider.tsx`, new `LiveBookingFields.tsx` / `LiveBooking.module.css`; `api/real-booking-api.ts`; `model/real-booking-view.ts`, new `live-booking-context.ts`, `live-booking-navigation.ts`, `booking-mutation.ts`.
- Logout composition: `app/router.tsx`, new `app/layouts/AdminAccountLayout.tsx`; `features/auth/index.ts`, new `components/AdminAccountActions.tsx` / `.module.css`; shared AdminShell, public index and new `admin-account-context.ts`.
- Tests: `tests/admin/admin-navigation.test.mjs`, `v31-booking-activity.test.mjs`, new `booking-recovery-logout.test.mjs`, `booking-logout.browser.mjs`. Source paths above are relative to `src/` unless prefixed `tests/`.

## S6 — Verification

| Check | Result |
| --- | --- |
| `npm run lint` | PASS, zero warnings |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; existing nonblocking >500 kB bundle warning |
| Focused Booking/Auth/navigation contract command below | PASS, 21 tests |
| Isolated Edge browser command below | PASS, 5 tests; every API request fulfilled/aborted locally |
| Expanded regression command below | 165 PASS / 1 FAIL (166 total) |
| `git diff --check` | PASS |

The expanded failure is pre-existing: `tests/ship-deck-cabin/cabin-integration.test.mjs`, “Cabin validation accepts supported enums, positive int32 capacity and unused number”, expects capacity 2147483647 to pass while validation limits it to 20. Reproduced the identical assertion against files loaded directly using `git show e58770a:...`; Cabin source/test are unchanged by this task. It remains outside the approved Booking scope.

Browser coverage: Home → filtered catalog → detail → cabin/package → travellers → review → explicit 400/409 rejection/reviewed retry → server record → guest lookup; route Back/Next retains draft; catalog Back/reload retains filter; 401/403/400/500/offline/empty/retry; optional package 403; capacity; inline focus; rapid double-click sends one POST; unknown create/cancel stays locked; Admin logout request failure clears token and Back/direct access/refresh stay guarded; public account Escape/focus/logout regression.

Rendered checks: cruise detail, cabin, travellers and review at 1280/1440/1920/390/768; no horizontal overflow. Additional 375 px guest lookup check. Inspected generated desktop/mobile screenshots under the task visualization folder `ocv-v7/`. Screenshots contain isolated QA data, not live business results. Typography falls back locally while external font requests are blocked in isolated browser tests.

### Reproduce

From `CASMS_WebApp` with Node 24 (used: 24.22.0, npm 11.19.1):

```powershell
npm run lint
npm run typecheck
npm run build
node --test tests/admin/booking-recovery-logout.test.mjs tests/admin/v31-booking-activity.test.mjs tests/admin/admin-navigation.test.mjs src/features/booking/api/live-cruise-contract.test.mjs src/features/booking/api/live-itinerary-contract.test.mjs src/features/auth/model/auth-return.test.mjs
node --test tests/**/*.test.mjs src/features/booking/**/*.test.mjs src/features/auth/**/*.test.mjs
```

Run isolated browser tests against the local dev server on 127.0.0.1:5176. Set `CASMS_PLAYWRIGHT_MODULE` to an existing Playwright package path, then `node --test tests/admin/booking-logout.browser.mjs`. No dependency installation is required; without that environment variable the optional browser tests are explicitly skipped. `CASMS_EVIDENCE_DIR` optionally saves rendered screenshots. Every API request in that test is intercepted, so test writes cannot reach the live backend.

## Flow readiness and demo

| Flow | Frontend verification | Live readiness |
| --- | --- | --- |
| Home/discovery/detail/filter | PASS, isolated browser | BLOCKED: anonymous catalog 403 |
| Three-step draft/capacity/review | PASS, isolated browser | PARTIAL: guest 403; ADMIN published-cruise list 200 but empty |
| Submit/success/lookup recovery | PASS, isolated browser | NOT_RUN: no approved disposable sandbox POST/reference |
| Admin Logout/Back/refresh | PASS, isolated browser | PASS: real existing ADMIN session, logout 200, Back/refresh guarded |
| Public login/account menu | PASS, isolated browser | New login NOT_RUN; existing ADMIN session verified with auth/me 200 |

Demo once public GET access is resolved: Home → choose trip type → select published voyage → select actual cabins/packages → enter passengers and plan → review. Stop before submit unless disposable-sandbox authorization is explicitly supplied. Then one approved POST and lookup/reload of its actual reference are required to establish live E2E. Staff demo: authorized login → any Admin page → Logout → verify Back/refresh remain guarded.

BUSINESS_BE_GAP: guarantee cabin is not supported by the required cabinId DTO; no pre-submit quote/conversion or payment/check-in/signing execution contract is supplied. Package ownership does not reserve its services/activities. Uncertain writes cannot be reconciled automatically without a known reference/idempotency contract. Do not claim paid/confirmed/readiness from a submitted booking or successful build.
