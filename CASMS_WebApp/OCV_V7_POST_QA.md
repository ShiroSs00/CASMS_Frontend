# V7 post-implementation QA — 2026-10-21

Scope: audit current V7 changes; fix confirmed Frontend defects only. Preserve all 30 pre-existing modified/untracked files from this turn's baseline; no Backend, DB, permissions, migrations, commit, push or live Booking mutation.

Base: `e58770aa954be2508b5aedd0d7843e9890c74a28`. Pre-QA copies/hash manifest: `C:/Users/USER/AppData/Local/Temp/ocv-v7-postqa-wemvr160`.

Allowed QA edits: minimal app Booking-session composition and router wiring; related `tests/admin/**`; feature-local error presentation only if runtime evidence confirms a defect; this report. No auth internals or permission/guard changes.

Confirmed P1 — FIXED: router-level BookingProvider survived Logout/account changes, retaining passenger drafts and the last successful Booking record. Public checkout could therefore display the previous user's data. The app now remounts Booking state on leaving/changing an authenticated identity, while preserving a guest draft when signing in. Retired provider setters cannot populate the new session. Three lifecycle regression tests reproduced two failures before the fix and all pass after it. These are isolated Node lifecycle tests, not an authenticated browser E2E run.

QA-only files:
- `src/app/layouts/BookingSessionLayout.tsx` — identity-aware provider lifetime.
- `src/app/router.tsx` — compose the new layout around existing routes.
- `tests/admin/booking-session-isolation.test.mjs` — guest sign-in, logout/late response, account-switch regressions.
- `tests/admin/admin-navigation.test.mjs` — register the new layout import in the existing test harness.
- This report.

| Flow | Result | Evidence / limit |
| --- | --- | --- |
| Public cruise discovery and details | BLOCKED | Fresh GET `/api/cruise?status=PUBLISHED&size=1` returns 403 through FE on port 5176. Catalogue shows access error and Retry; no invented catalogue. No accessible real cruise to follow into details. |
| Cruise selection / cabin availability | BLOCKED | Catalogue 403 prevents selecting a real cruise. Missing selection/cabin preflight routes to step 1 and focuses the cruise control. No live availability claim. |
| Passenger information | PASS (local UX) | Blank form shows inline errors and focuses first invalid name. Client-only synthetic name/email survive navigation to review. No submission occurred. |
| Optional packages | BLOCKED (live); PASS (fallback) | Fresh GET `/api/servicepackage/packages` returns 403. UI explains failure, offers Retry and allows proceeding without an optional package. |
| Review / validation | PASS (local UX) | Review reflects draft and absent cruise/cabin. Preflight refuses incomplete selection. No fabricated price, paid or confirmed state. |
| Booking submission / resulting reference | BLOCKED | No sandbox authorization and no available real cruise context. No Booking mutation sent. Success flow covered only by isolated tests, not claimed live. |
| Guest lookup | PASS (empty-input UX); BLOCKED (live result) | Empty reference/contact shows validation. No authorized real Booking reference available for success verification. |
| Booking / contract / payment status accuracy | BLOCKED (live records) | Reviewed DTO/status mapping and focused contract tests; no real resulting Booking/contract/payment record available. |
| Admin Logout placement / shared session logic | PASS (source + isolated tests) | Existing Admin shell slot reuses auth.logout; repeated logout is locked and redirect replaces history. New tests prove Booking data retirement. |
| Admin access after logout | PASS (fresh anonymous guard); BLOCKED (fresh staff E2E) | Direct `/admin/bookings` redirects to `/login?returnTo=%2Fadmin%2Fbookings`. No current staff account/session. Earlier V7 authenticated Logout/Back/refresh evidence is historical, not a fresh test in this pass. |
| Desktop UI | PASS within tested states | Catalogue error, lookup, cabin error, passenger and review states checked at nominal 1280/1440/1920 desktop widths. Calibrated CSS measurements 1280/1439/1920 due to browser scaling; no horizontal overflow. Visual form check found no blocking layout defect. Populated live cabin/catalogue states remain blocked. |

Fresh anonymous `/api/auth/me` is 401, expected without a session. Browser error log capture was empty. Previous V7 evidence of authenticated package 400 / stale runtime permission expression was not reverified without a current session; no Backend or permission fix attempted.

Verification after fix:
- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm run build` — PASS; nonblocking chunk >500 kB warning.
- Focused Node suite — 24/24 PASS (`booking-session-isolation`, `booking-recovery-logout`, `v31-booking-activity`, `admin-navigation`, live cruise/itinerary contracts, auth-return).
- Broad Node suite — 168/169 PASS. Existing unrelated failure: `tests/ship-deck-cabin/cabin-integration.test.mjs:35` expects capacity 2147483647 to pass, while current validation caps capacity at 20. This mismatch was previously reproduced at base HEAD and the Cabin files were not changed by V7/this QA.
- `git diff --check` — PASS.
- Baseline hash check: only router and its navigation test changed among the 30 pre-QA files; remaining 28 preserved byte-for-byte. Three new QA files listed above were added. Branch/HEAD unchanged; no commit or push.

Remaining P0/P1: no further confirmed FE P0/P1 from accessible states; the session data retention P1 is fixed. Public Cruise 403 is the blocking integration issue for the primary guest Booking journey. Staff E2E and actual Booking/contract/payment results remain unverified; no sandbox mutation authorization was provided.

Final demo readiness: **BLOCKED for the complete live Booking demo**. Local FE validation and the targeted regression fix pass, but full success cannot be demonstrated with the current public API responses and available session/data.
