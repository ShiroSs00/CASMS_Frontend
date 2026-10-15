# AURORA-AUTH-HOME-V3 — 2026-10-15

## Scope and baseline

User-authorized implementation of AURORA_TODAY_MASTER_CODEX_PROMPT.md and AURORA_TODAY_AUTH_HOME_CODEX_CONTEXT.md. These documents supply task requirements, not authority for unrelated actions.
Base: 4ffd6629d3308ee6deec730ee5c36845c9c1efae. Baseline worktree was clean on main.
Branch: codex/aurora-auth-home-v3. Implementation handoff initially left changes uncommitted; the user subsequently authorized committing and pushing this task branch. No merge authorized.

Visual source: Figma k754hHXohOrGHSgjtuSRnw. Read full design context and screenshots for 111:93, 78:2, 112:93, 112:112, 98:626, 98:503.
API source: supplied identity.zip and today's context. No role-permission matrix copied.

## Implementation status

| Package | Code status | Acceptance evidence / remaining verification |
| --- | --- | --- |
| Home V3 | DONE | Eight ordered sections, local exact Figma imagery, responsive rendering; public booking is an explicitly unavailable typed navigation boundary |
| Auth/session | DONE | Login/refresh/logout adapters, sessionStorage hydration, Bearer synchronization, expiry/401 clearing, single-flight refresh, stale-response generation guard; live session lifecycle verification BLOCKED by unavailable backend |
| Admin guard/403 | DONE | All existing admin paths under guard; anonymous redirect verified with query-preserving returnTo; staff/PASSENGER checks implemented, live role journey verification BLOCKED |
| Authenticated header/logout | DONE | Username, disabled profile, staff-only admin entry, outside-click/Escape close, pending logout; signed-in browser verification BLOCKED without backend/account |
| OIM handler lookup | DONE | Identity lookup replaces manual UUID; loading/error/retry/empty states; ACTIVE filtering and returned id submission; live lookup/assignment verification BLOCKED |

DONE above means implementation completed, not all live end-to-end scenarios passed.

## Integrated endpoints

- POST /auth/login: username + password, no existing Bearer header.
- POST /auth/refresh: current Bearer token; no separate refresh token.
- POST /auth/logout: local session cleared even on request failure.
- GET /identity/users?status=ACTIVE&assignableFor=OPERATIONAL_ISSUE.

Existing OIM assignment action payload/workflow unchanged. The role gate is navigation UX only; backend remains authorization authority.
The 403 frame retains its supplied “Refund Approval” example copy; no refund feature or endpoint was implemented.
Unsupported profile, account recovery, register and public booking flows remain unimplemented.

## Verification

- npm run typecheck: PASS.
- npm run lint: PASS (initial control-character regex issue fixed).
- npm run build: PASS; non-blocking minified bundle warning (~540 kB).
- git diff --check: PASS.
- Browser: Home full-page desktop screenshot; all eight image callsites loaded (hero 640h, cards 220h, destinations 320h, editorial 520x300). Section top positions 1470/1970/2400 and footer 2790 match source at desktop.
- Browser: Login and session-expired assets loaded at 760x818 on 1440 viewport. Inputs 360x50, radius 8. Empty submit shows required-field errors.
- Browser: anonymous /admin/issues?status=OPEN redirects to /login?returnTo=%2Fadmin%2Fissues%3Fstatus%3DOPEN.
- Browser: 403 rendered. Home/Login/403 at 375 viewport have no horizontal overflow after fixing the Login grid minimum size.
- Five local PNGs are nonempty. Exact source assets retained, including their source resolution/cropping; no temporary Figma URLs shipped.
- Backend connection probe to localhost:8080 returned curl exit 1 / HTTP 000. No successful login, refresh, logout, signed-in menu, passenger/staff runtime gate or handler assignment is claimed.
- Code Connect lookup unavailable due Figma seat restriction; high-fidelity design contexts and screenshots were accessible and used.
- Existing document title “CASMS Web — Foundation” is outside allowed index.html scope and was not changed.

## Boundaries and files

No MobileApp, backend, package/lockfile, unrelated cruise/regulation/ship/deck/cabin implementation files changed. No new dependency or test framework. Old HeroSection.module.css removed as obsolete presentation; recoverable from Git.

Changes (A = added/untracked, M = modified, D = deleted; paths relative to repository):

```text
M CASMS_WebApp/docs/design/screen-map.md
 M CASMS_WebApp/docs/engineering/module-map.md
 M CASMS_WebApp/src/app/layouts/PublicLayout.module.css
 M CASMS_WebApp/src/app/layouts/PublicLayout.tsx
 M CASMS_WebApp/src/app/providers.tsx
 M CASMS_WebApp/src/app/router.tsx
 D CASMS_WebApp/src/features/home/components/HeroSection.module.css
 M CASMS_WebApp/src/features/home/components/HeroSection.tsx
 M CASMS_WebApp/src/features/home/index.ts
 M CASMS_WebApp/src/features/home/pages/HomePage.tsx
 M CASMS_WebApp/src/features/operational-issues/components/IssueActions.tsx
 M CASMS_WebApp/src/features/operational-issues/components/actions/AssignHandlerForm.tsx
 M CASMS_WebApp/src/shared/api/client.ts
 M CASMS_WebApp/src/shared/api/index.ts
A  CASMS_WebApp/src/features/auth/AuthProvider.tsx
A  CASMS_WebApp/src/features/auth/api/auth-api.ts
A  CASMS_WebApp/src/features/auth/api/dto.ts
A  CASMS_WebApp/src/features/auth/assets/expired-editorial.png
A  CASMS_WebApp/src/features/auth/assets/login-editorial.png
A  CASMS_WebApp/src/features/auth/components/Auth.module.css
A  CASMS_WebApp/src/features/auth/components/AuthAccountMenu.tsx
A  CASMS_WebApp/src/features/auth/components/AuthPageShell.tsx
A  CASMS_WebApp/src/features/auth/components/LoginForm.tsx
A  CASMS_WebApp/src/features/auth/guards.tsx
A  CASMS_WebApp/src/features/auth/index.ts
A  CASMS_WebApp/src/features/auth/model/auth-session.ts
A  CASMS_WebApp/src/features/auth/model/auth-types.ts
A  CASMS_WebApp/src/features/auth/pages/AccessDeniedPage.tsx
A  CASMS_WebApp/src/features/auth/pages/LoginPage.tsx
A  CASMS_WebApp/src/features/auth/useAuth.ts
A  CASMS_WebApp/src/features/home/assets/editorial.png
A  CASMS_WebApp/src/features/home/assets/ha-long.png
A  CASMS_WebApp/src/features/home/assets/lan-ha.png
A  CASMS_WebApp/src/features/home/components/Landing.module.css
A  CASMS_WebApp/src/features/home/components/LandingSections.tsx
A  CASMS_WebApp/src/features/home/model/public-booking.ts
A  CASMS_WebApp/src/features/operational-issues/api/handler-lookup-api.ts
A  CASMS_WebApp/src/features/operational-issues/hooks/useAssignableHandlers.ts
A  CASMS_WebApp/docs/tasks/AURORA-AUTH-HOME-V3.md
```
