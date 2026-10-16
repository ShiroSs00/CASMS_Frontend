# WEB-BOOKING-V3-001 — AURORA Booking Web

Updated: 2026-10-16 (Asia/Saigon).

Status: frontend routes and typed UI boundaries implemented; production business integration remains blocked by the missing contracts below. This is not a claim that live booking, payment or check-in is operational.

## Scope and sources

- Branch: `codex/aurora-booking-web-v3`.
- Base: `7b24ed0fc17d227aab1c44eed940ac6003af8ca3`; initial worktree was clean. On continuation, `.gitignore` also contained an unrelated `*.docs` addition; it was preserved and is not part of this implementation.
- User requested a separate branch and implementation of `AURORA_BOOKING_WEB_MASTER_CODEX_PROMPT.md` and `AURORA_BOOKING_WEB_CODEX_IMPLEMENTATION_CONTRACT.md` supplied in Downloads.
- Visual authority: live [AURORA Booking Web](https://www.figma.com/design/k754hHXohOrGHSgjtuSRnw?node-id=2-5), with the production Georgia / Times New Roman editorial override and Inter / Arial controls. No DM Serif Display font is shipped.
- Auth authority: `identity.zip`, supplied 2026-10-15; inspected `AuthController`, `LoginRequest`, `LoginResponse`. The existing frontend DTO/session implementation matches this contract.
- Business boundary: supplied booking schema/enums and contract WF-005–WF-011 requirements. Local backend Booking, Checkin and Payment controllers still have TODOs rather than implemented operations. No public booking API was inferred from Admin Cruise.
- Architecture: existing app → features → domain → shared boundaries; CSS Modules, shared Button/Field, feature-owned adapters. No dependency or lockfile change; no Admin/Mobile/backend source edits.

## Route and Figma inventory

All 24 frames have an implementation or shell/state representation. The first 15 entries use typed fixture view models; auth concepts do not make HTTP requests.

| Screen | Route / representation | Figma node |
| --- | --- | --- |
| Home | `/` | `111:93` |
| Cruise Search | `/cruises` | `43:14` |
| Cruise Detail | `/cruises/:cruiseId` | `43:127` |
| Traveller Details | `/booking/travellers` | `56:52` |
| Cabin & Experience | `/booking/cabin-experience` | `43:236` |
| Review & Submit | `/booking/review` | `43:317` |
| My Bookings | `/my-bookings` | `56:118` |
| Booking Detail | `/my-bookings/:bookingId` | `79:333` |
| Manage Booking | `/my-bookings/:bookingId/manage` | `79:48` |
| Travellers & Documents | `/my-bookings/:bookingId/travellers` | `79:122` |
| Online Check-in | `/my-bookings/:bookingId/check-in` | `79:190` |
| Arrival Time | `/my-bookings/:bookingId/arrival-time` | `79:253` |
| Boarding Pass | `/my-bookings/:bookingId/boarding-pass` | `79:287` |
| Payment & Contract | `/my-bookings/:bookingId/payment` | `56:167` |
| Change / Cancel | `/my-bookings/:bookingId/change-request` | `56:219` |
| Sign In | `/login` | `78:2` |
| Authenticated header / logout | `PublicLayout` + `AuthAccountMenu` | `112:93` |
| Session Expired | `/login?reason=expired` and session boundary | `112:112` |
| Create Account | `/register` | `78:36` |
| Verify Email | `/verify-email` | `78:75` |
| Forgot Password | `/forgot-password` | `78:102` |
| Reset Password | `/reset-password` | `78:130` |
| Account Locked | `/account-locked` | `78:163` |
| Reservation Lookup | `/reservation-lookup` | `78:190` |

## Implementation and integration modes

### LIVE_CONFIRMED

Existing `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` integration is preserved through shared `apiRequest`. Username/password and roles-only DTOs remain unchanged. Logout clears local session even if its request fails. Existing identity-users functionality is untouched.

Customer return-to accepts only local cruise/booking/my-bookings paths. Passengers default to My Bookings; public customer links never point to Admin. Staff administration remains behind the original guard. Customer pages require identity in production. The development-only `?preview=1` escape shows explicitly fictitious adapter records and is removed by the production build; it is not an authorization system for a live API.

### UI_WITH_TYPED_ADAPTER

Cruise discovery, booking wizard, customer booking management and pre-cruise/payment/change surfaces use isolated fixtures behind `features/booking/api/booking-api.ts`. View models are not claimed as backend DTOs. Public prices and availability are identified as examples. Private surfaces initially explain that account bookings cannot yet be loaded and offer an explicit fixture preview.

For local review: `/my-bookings?preview=1`, with records `sample-1842` and `sample-1843`. No other user's booking is queried. Production previews still require the normal customer guard.

The wizard retains cruise, travellers, requested category and per-passenger packages through route transitions and login within the same app lifetime. Refresh starts a new draft; a browser unload warning protects entered traveller data. No personal draft/document values are written to browser storage. Required traveller fields, real calendar dates and safe guest counts are validated. Included packages are not charged again, removed passengers' packages do not contribute to totals, and pending actions are locked against duplicate clicks.

Booking status, payment status, check-in status and boarding eligibility remain separate. Requested category does not become an assigned cabin. Check-in `Completed` does not issue a pass. Document numbers are masked; the boarding graphic is an explicitly nonfunctional placeholder. Unsupported saves keep input and do not advance server readiness or payment status.

### UI_ONLY_PROPOSED

Register, verify-email, forgot-password, reset-password, account-locked and reservation-lookup render the supplied concepts. `authConceptAdapter` returns an unavailable message without POSTs, emails, password changes, lookup results or account linking. Login does not route users into these unsupported capabilities as required steps.

### BE_CONTRACT_MISSING

| Missing boundary | Required before live integration |
| --- | --- |
| Public cruises / prices / availability | Authorized public list/detail contract, query fields, real availability and stale-selection errors |
| Booking create / my bookings / detail | Request/response DTOs, ownership enforcement, authentication requirements, pricing, status transitions, idempotency and unknown-outcome recovery |
| Passenger / documents | Per-passenger validation, protected document handling, permissions and save/read endpoints |
| Online check-in | Step eligibility, readiness transitions, emergency-contact/photo contracts |
| Arrival selection | Real slot availability, selection rules and persistence endpoint |
| Boarding pass | Backend-issued credential, eligibility, download/email endpoints |
| Payment / contract | Contract document/version, acceptance, due amounts, gateway initiation and authoritative payment-status confirmation |
| Change / cancellation | Request DTO, allowed changes, supplied fees/refunds, timeline and decision states |
| Additional auth concepts | Registration, email verification, password recovery and reservation lookup contracts |

Action result types cover validation, conflict, error, unknown, received, no-access, expired and missing. The current adapter deliberately returns `missing` for business writes. Conflict/success/server error responses cannot be exercised against a live booking service until one exists; no simulated success path is exposed as production behavior.

## Files changed

- `src/features/booking/**`: typed view models/fixtures, draft/context/action hooks, adapter, discovery/wizard/management/pre-cruise/payment components, composition pages, public entry, CSS Modules, persisted Figma images and regression tests.
- `src/features/home/**`: current Home composition, finder/navigation and editorial sections/images.
- `src/features/auth/**`: Georgia/Inter parity, auth concepts/assets, safe customer return-to, customer guard, account-menu booking link, login destination and auth shell refinements. Existing transport/session machinery remains intact.
- `src/app/router.tsx`, `src/app/layouts/PublicLayout.tsx`, `PublicLayout.module.css`: customer routing/provider and real navigation.
- `docs/engineering/module-map.md`, this report, and `WEB-BOOKING-V3-001-evidence/`: module ownership and review evidence.

## Visual QA and intentional differences

Live contexts/screenshots were retrieved for all listed nodes. Rendered Home, discovery, all wizard steps, eight management-detail surfaces, My Bookings, Login, Expired and all six concepts were inspected at 1440 px. Fixed review card row direction, cabin heading/spacing, editorial font specificity, CTA widths and progress-bar styling. Home also received a 375 px overflow check. Images are local assets; no temporary Figma URLs remain in runtime code.

Rendered differences required by backend honesty include sample-data labels, blank initial traveller inputs, masked documents, no issued QR/pass, unavailable submit feedback, actual calculated totals, additional Back/add/remove/passenger controls and no fabricated verification/lookup success. Georgia rasterization and wrapping differ from Figma's DM Serif surrogate. This is a visual review, not a pixel-diff certification.

The authenticated header implementation was reviewed against `112:93`, but its real authenticated rendering and login/refresh/logout round trip could not be exercised without a live backend account. Guest-header geometry and expired-state rendering were inspected. No live payment, booking, check-in or identity mutation was performed.

Screenshots: [Home 1440](WEB-BOOKING-V3-001-evidence/home-1440.jpg), [Manage Booking 1440](WEB-BOOKING-V3-001-evidence/manage-1440.jpg), [Review 1440 after row-layout fix](WEB-BOOKING-V3-001-evidence/review-1440.jpg).

## Validation

Checks were run from `CASMS_WebApp`. Host Node is 25.2.1; validation was also run with Node **24.0.0** from npm's temporary execution cache, within the repository's required Node 24 major, and npm 11.4.1. The exact recommended Node 24.21.0/npm 11.19.0 pair was not used. No package/lockfile was modified.

| Check | Result |
| --- | --- |
| `npm run lint` under Node 24 | PASS, zero warnings |
| `npm run typecheck` under Node 24 | PASS |
| `npm run build` under Node 24 | PASS; Vite reports a nonblocking >500 kB bundle warning |
| `node --test src/features/booking/model/booking-draft.test.mjs src/features/auth/model/auth-return.test.mjs tests/cruises/cruise-domain.test.mjs` under Node 24 | PASS, 8 tests |
| Traveller validation → cabin → per-passenger package → review | PASS in browser; one optional package adds 900,000 VND only once |
| Unsupported submit → back to traveller fields | PASS; unavailable message, entered names retained |
| Empty search → reset | PASS; three fixture results return |
| Anonymous My Bookings | PASS; login screen with safe return context |
| Documents/arrival save | PASS; unavailable feedback, input/selection retained |
| Completed passenger → boarding pass | PASS; still “Chưa phát hành”, downloads disabled |
| Browser console during inspected flows | No recorded errors |
| Home assets / overflow | All nine images load; no horizontal overflow at 1440 or 375 px |

Run Node 24 checks without changing project dependencies using `npx --yes --package=node@24.0.0 --call "npm run lint"` (replace the inner command for typecheck/build/tests).

No commit or push was performed. Backend contracts and live-auth verification remain the release gates; all independent frontend work is available on the named branch.
