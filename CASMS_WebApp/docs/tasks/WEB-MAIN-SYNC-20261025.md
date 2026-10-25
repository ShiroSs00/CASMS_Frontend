# Main synchronization — 2026-10-25

## Scope and preservation
- Feature branch: `codex/journey-admin-permissions-20261025`.
- Preserved feature commit: `16508c97838b4e6c2c052781eedec27099756308`.
- Incoming main: `b4ca6c07bb8a3a16606228e58248600a95d1fd67`.
- User approved merging main into the feature branch, resolving conflicts, and pushing. No rebase, force push, PR merge, backend source change, or database modification.
- Existing local documents outside this task remain untracked and excluded from the merge commit. The pre-branch archive contains all 143 originally modified/untracked files.

## Resolution decisions
- `ShipListPage.tsx`: retain the incoming fleet cards, filters and structure shortcut; use the feature branch's permission-aware links.
- `AdminShell.tsx`: retain incoming direct navigation and combined deck/cabin highlighting, together with permission loading/error/retry states and labels derived from granted navigation.
- `admin-navigation.ts`: retain incoming fleet/import/model/BLE tools, role presentation order and direct fleet groups. Give every new tool an explicit permission mode. Runtime access remains based on `/auth/me.effectivePermissions`, per the user's Admin Shell requirements and `WEB-ADMIN-ACCESS-CONTENT-20261024.md`; do not restore historical role permission grants or hard role exclusions that conceal granted functions. Ship Manager landing prefers the fleet dashboard only when granted. Deck discovery supports the incoming DECK_READ/CABIN_READ alternatives; editing still requires reading and mutation grants.
- `shared/api/client.ts`: preserve incoming multipart upload and configurable timeouts. Extend session cancellation, late-response rejection and permission checking to streamed model assets, retaining progress and caller cancellation.
- `shared/auth/permission-policy.ts`: match nested asset paths for the existing Spring `{*assetPath}` mapping. Asset permission remains SHIP_READ, verified against local `ShipModelController` annotations; no API field, enum, permission or backend rule was renamed.
- New fleet/import/viewer contextual links use the existing shared permission-aware link. Update only incoming navigation/asset test harnesses impacted by these decisions, and add focused merge regression coverage.

## Validation
- `npm ci --no-audit --no-fund`: passed after temporarily stopping the project Vite process to release its locked log files.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed. Production build includes 418 modules; Vite reports a large Three.js viewer chunk warning.
- Focused tests for merge permissions, asset/session behavior, multipart upload, import, BLE, viewer and fleet management: 28 passed, 0 failed.
- Full existing suite, run with per-file timeout and live API tests disabled: 314 tests, 241 passed, 72 failed, 1 skipped.
- Independent snapshot of the pre-merge feature commit, with the same dependencies and test timeout: 286 tests, 213 passed, 72 failed, 1 skipped. The normalized failing test-name sets are identical before and after the merge. Existing failures are not reported as passing or repaired in this sync task.
- User explicitly approved committing and pushing despite these 72 existing failures on 2026-10-25, after receiving the comparison and focused validation results.
- Live authenticated journey/import/3D/BLE flows remain unverified. Backend startup was previously blocked by duplicate V24 migrations; backend source and database are outside this sync task.

## Delivery
- Push the normal merge commit to the existing feature branch. Main and PR merge remain under the user's control.
