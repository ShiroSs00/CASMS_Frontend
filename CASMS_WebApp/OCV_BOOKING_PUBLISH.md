# Booking delivery — publish scope and verification

User explicitly authorized GitHub push on2026-10-21, superseding the earlier no-commit/no-push constraint for this delivery. Existing task branch: `codex/ocv-booking-ux-admin-logout-v7`; base `e58770aa954be2508b5aedd0d7843e9890c74a28`; remote `https://github.com/ShiroSs00/CASMS_Frontend.git`. Preserve history; no rebase, amend, force push, direct main push or merge.

Allowed publish scope is exactly the95 modified/untracked files inventoried in `C:/Users/USER/AppData/Local/Temp/ocv-publish-baseline-bnslmfb5/paths.json`, plus this report and `tests/ship-deck-cabin/cabin-integration.test.mjs` for the confirmed stale validation test described below. These are the accumulated V7–V15/current Booking API, Landing, existing Admin Logout, session isolation and user-requested QA handoff changes from this conversation. No unrelated Mobile/Backend/DB/security config/dependency/IDE changes. Do not mechanically stage a whole directory or force-add ignored local docs.

The standalone QA HTML, redacted anonymous GET report, six screenshots and shareable ZIP are intentional deliverables explicitly required by the preceding QA handoff task, not build/cache output. ZIP contents have been inspected and secret-pattern scanned. Node modules, dist, env, logs and local task/rules documentation remain excluded by existing ignore policy. Historical task reports describe their state when written; their no-commit/no-push statements are historical, not current publication status.

## Confirmed pre-existing test discrepancy

The expanded test run found186/187 passing. `tests/ship-deck-cabin/cabin-integration.test.mjs` expected capacity2147483647 to be accepted, whereas **both HEAD and current unchanged FE** `src/features/ship-deck-cabin/model/validation.ts:77` restrict Cabin capacity to1–20. Isolated execution reproduced15/16 passing; the failure is independent of Booking changes. BE DTO has `@Min(1)` and no matching maximum; this delivery does not invent or change a Backend limit or alter the existing FE rule.

Scope extension: update only that stale test's name and assertions to verify accepted FE boundaries1/20 and rejected21/int32 maximum. No production code, Admin UI or business-rule change. Commit this test correction separately, then publish the Booking delivery. Required validation must pass before committing.

## Review and checks

- Remote fetched before comparison; current branch starts at origin/main, and its remote branch does not yet exist.
- Reviewed modified routing, session/Logout composition, public/preview adapters, Booking writes/DTOs, Landing changes and test updates. Source and handoff artifacts scanned for private keys, GitHub/API credentials, JWTs and credential URLs; no matches found. Fixture credentials are explicitly test-only.
- Required checks: lint, typecheck, build; entire existing `.test.mjs` suite; relevant existing isolated Booking/auth/Logout browser tests. No live mutations or credentials used.
- Current live Booking remains BE BLOCKED (bootstrap/Flyway, public/owned contracts, Passenger↔User linkage and sandbox prerequisites). Publishing is for code collaboration/review, not a claim of live demo readiness or authorization to deploy/merge.

Pre-push verification:187/187 unit/contract tests PASS across31 test files;19/19 isolated Booking/auth/Logout browser cases PASS; npm lint/typecheck/build PASS (existing large-bundle warning remains); targeted ESLint for the corrected Cabin test PASS; diff whitespace and secret-pattern checks PASS. The separate Cabin test-only commit is9ded7ea. Final publication status and branch HEAD are reported after push; no live Booking success is inferred. See `OCV_BOOKING_IMPLEMENTATION_SUMMARY.md`, `qa/OCV_BOOKING_QA_GUIDE.md` and `OCV_BOOKING_BE_HANDOFF.md` for behavior, endpoint coverage, previous evidence and BE dependencies.

Staged review also normalized three Markdown hard breaks to explicit `<br>` and removed one extra blank line at the preview adapter EOF; content and runtime behavior are unchanged.
