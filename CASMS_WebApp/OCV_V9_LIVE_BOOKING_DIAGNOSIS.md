# V9 — Live Booking diagnosis (2026-10-21)

Verdict: **BLOCKED** for a complete live Booking demo. Root cause of the reproduced Cruise/Package guest 403 is confirmed: the running Backend artifact predates the public-read security changes present in the local checkout. No FE production defect was confirmed or patched in this pass.

## Scope and preservation

- FE branch: `codex/ocv-booking-ux-admin-logout-v7`; HEAD `e58770aa954be2508b5aedd0d7843e9890c74a28`.
- All 33 existing FE changed/untracked files were hashed before this task's edits and preserved. Only this report is added by V9. Baseline: `%TEMP%/ocv-v9-baseline.json`.
- BE baseline remains `.idea/misc.xml` modified and `openapi.json` untracked. No Backend, DB, permissions, migrations, Git history, commit or push changes. No container restart/rebuild and no Booking mutation.
- Allowed V9 scope: relevant FE API/auth/Booking repairs and regression tests only if a defect is confirmed; this diagnostic report. Existing V7/V8 source remains untouched.

## Root cause and exact layer

Running container `casms-backend` uses image `sha256:c48c7d9de80732c87fdb8dd38ef1526dd1448086fef99fff567c71bf6c75b4e8`, built **2026-10-20 08:21:28 UTC**, started **2026-10-21 04:42:00 UTC**. Active environment profile is `dev`; image working directory `/app`, JAR `/app/app.jar`, no source/config bind mounts. Runtime JAR config has port 8080 and context path `/api`.

Read-only `docker cp` to a temporary directory and `javap -p -c/-v` establish an artifact mismatch directly:

| Layer | Running JAR | Local source |
| --- | --- | --- |
| `SecurityConfig.securityFilterChain` | Public matchers include auth, docs, `/booking/available-cabins`, `/booking/lookup`, POST `/booking`. **No GET Cruise/Package allow rules**, then `anyRequest().authenticated()`. | `src/main/java/com/casms/config/SecurityConfig.java:54–59` has additional GET public matchers for Cruise/Package. |
| `CruiseController.list/detail` | `@PreAuthorize("hasAuthority('CRUISE_READ')")`; signatures lack the new Authentication argument. | `src/main/java/com/casms/ship/controller/CruiseController.java:43–69` permits anonymous reads and restricts public data to PUBLISHED. |
| `ServicepackageController.packages` | Old `hasAnyPermission(…TOUR_PACKAGE_MANAGE, …TOUR_PACKAGE_ASSIGN)` expression. | `src/main/java/com/casms/servicepackage/controller/ServicepackageController.java:53–54` has anonymous access and ACTIVE filtering, using `hasAnyAuthority`. |

**Immediate denial for the anonymous Cruise/Package requests is the URL authorization filter chain**, before controller/method security. The older method annotations are an additional obstacle if only URL matchers were changed. Simply restarting the same image cannot update these classes.

The inspected JWT filter passes requests without a Bearer header down the chain; it does not independently reject anonymous requests. FE uses `/api` once, Vite forwards it unchanged to 8080, and BE context is `/api`. Direct BE and proxied requests produce the same denial. A fresh browser Retry request also had **no Authorization or Cookie header**. No stale token, malformed path, FE interceptor or proxy-generated 403 was found. No valid staff/test credentials or authenticated session were available; no credentials were guessed or created.

Evidence artifacts outside the worktree: `%TEMP%/ocv-v9-runtime/` contains copied JAR/classes, disassembled SecurityConfig/Cruise/Package/Booking controller output and `correlated-probes.json`; `%TEMP%/ocv-v9-http.json` contains the initial sanitized direct/proxy probes. Runtime SecurityConfig class SHA-256: `604e9c41843287bc9a61d6935769b82f23a2eb817b9f8ecf41bcf405fe794850`.

## Public endpoint verification

All requests below are GET, anonymous, with no Authorization/Cookie. Initial direct `127.0.0.1:8080` and FE proxy `127.0.0.1:5176` probes ran at 05:31:54 UTC; correlation controls ran at 05:33:39 UTC.

| Exact path / scenario | Direct BE | FE proxy | Response code / trace | Conclusion |
| --- | --- | --- | --- | --- |
| `/api/cruise?status=PUBLISHED` | 403 | 403 | Empty body (0 bytes); no response code, trace ID or correlation header. | BLOCKED by runtime URL policy. |
| `/api/cruise/{id}` with valid published ID | NOT RUN | NOT RUN | No verified live ID available; listing denied. | BLOCKED prerequisite; no guessed/fixture ID substituted. |
| `/api/booking/available-cabins?cruiseId={id}` with valid ID | NOT RUN | NOT RUN | Same missing verified ID. | BLOCKED prerequisite; **valid-ID cabin 403 is not established**. |
| `/api/servicepackage/packages` | 403 | 403 | Empty body; no response code, trace ID or correlation header. | BLOCKED by runtime URL policy. |
| `/api/booking/lookup` with authorized sandbox reference/contact | NOT RUN | NOT RUN | No authorized sandbox data. Opening lookup UI makes no lookup request. | BLOCKED prerequisite. |
| `/api/auth/me` (control) | 401 | 401 | `AUTH_REQUIRED`; expected anonymous behavior. | PASS control; not a failed login. |
| `/api/booking/available-cabins` **without required parameter** (diagnostic control only) | 500 | NOT RUN | `INTERNAL_ERROR`; trace `4cf1d642-0d3b-4eb0-a761-66d09943eeb3`. | Route passes security and reaches MVC. This is not availability success or a valid-ID test. |

Correlation/log evidence:

- Cruise sent `X-Correlation-Id: 3d5a9ec9-a19b-47fd-8edf-6ccbdfd5af14`; Package sent `e9468af3-1f13-442b-8218-b74590e8c377`. Neither was echoed, and neither has a matching container log event. Denied requests lack request/security logging at current runtime levels; no denial trace is invented. This absence is consistent with rejection before the application's CorrelationIdFilter.
- Missing-parameter cabin control echoed `7a3c26ec-b3ea-4a80-9f73-3b84c3603dc6`. Matching 05:33:39 UTC log: `GlobalExceptionHandler - Unhandled exception [traceId: 4cf1d642-0d3b-4eb0-a761-66d09943eeb3]`; stack reports `MissingServletRequestParameterException` for required `cruiseId`.
- Auth control echoed `4382f7a2-2f4f-4a05-b996-053a1176a1f8`; matching 05:33:39 UTC log reports business exception `AUTH_REQUIRED`. These controls demonstrate application error/trace handling is reachable on permitted routes.

## FE navigation, prerequisites and E2E limits

- Fresh browser Home finder navigates to `/cruises`. Real API 403 produces access error + Retry; Retry sends the actual paginated PUBLISHED request. No mock cruise cards appear.
- Direct checkout shows transient loading then real Cruise/Package errors. Optional Package failure has retry and permits proceeding without a package. Cabin API is not called before a cruise is selected. Lookup navigation opens the real form without sending a lookup request.
- Public discovery routes compose LiveCruiseSearch/LiveCruiseDetail; flow routes compose RealBookingCreatePage. Legacy fixture adapters remain in the codebase but are not a fallback in these routes. Loading/error/empty branches were inspected; a real successful empty catalogue was not observed during V9.
- Source prerequisites: future PUBLISHED cruise with assigned ship; available cabin on that ship and sufficient grouped capacity; passenger/contact validation; guest primary email; valid optional ACTIVE package; payment plan/currency. FE serialization uses the documented DTO. No client-generated price/contract/payment success.
- Submission lock, explicit confirmation, uncertain-write lockout and recovery remain intact. POST creates Booking/passenger/account/contract/installment/notification records in BE; no isolated sandbox or mutation authorization was established, so no POST was sent.
- BE unit/repository fixtures and FE isolated browser fixtures were inspected as test code, not used as live data or credentials. BE integration tests can write repository records; none were run. No real reference, contract or payment result is claimed verified.
- **Booking E2E: BLOCKED. Admin Logout authenticated E2E: UNTESTED/BLOCKED**, missing a valid staff account/session. V7/V8 logout/session-isolation unit evidence remains valid, but is not a fresh authenticated live test.

## Verification and team action

Fresh commands from CASMS_WebApp: `npm run lint` PASS; `npm run typecheck` PASS; `npm run build` PASS (nonblocking >500 kB chunk warning); focused tests **24/24 PASS** (session isolation, recovery/logout, Booking/Activity API contracts, Admin navigation, cruise/itinerary mapping, auth-return). No production source changed, so no new regression test was necessary. `git diff --check` PASS.

BE team action:

1. Rebuild/redeploy the intended reviewed Backend revision through the team's normal environment process; verify the artifact actually contains both URL and method-security changes. Keep public responses limited to PUBLISHED cruises / ACTIVE packages and protect nonpublic data. Do not merely restart the Oct-20 image or remove security checks.
2. Review the source's non-staff authenticated case as well: current public method expressions allow anonymous callers or privileged staff, but a logged-in passenger lacking the named authorities can still be denied. Validate the intended public-read policy for both identities without bypassing auth from FE.
3. Correct missing-request-parameter handling in `GlobalExceptionHandler` to return a client error instead of 500; separate robustness issue, not proof of valid-ID cabin failure.
4. Supply a verified future published cruise/cabin, a valid staff test session, and explicitly authorized isolated sandbox data before the remaining successful detail/availability/lookup/logout/creation/contract/payment E2E runs.

No FE workaround can repair the deployed filter chain. Final readiness stays **BLOCKED** until the intended Backend artifact and legitimate test prerequisites are available.
