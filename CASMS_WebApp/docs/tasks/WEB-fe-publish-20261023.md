# Publish OceVie WebApp changes

User explicitly authorized creating a separate branch and pushing FE on 2026-10-23. This supersedes earlier no-commit/no-push limits for WebApp only. No BE or Mobile App changes/pushes, no database access, no merge or force-push.

Baseline HEAD: 5ff285ae05290cb44bee25341ff69c33d00c29f4 on feat/mobile-passenger-live-api. Refreshed origin/main: aa784fb, which contains HEAD and has an identical tree. Baseline status recorded in task visualization fe-push-baseline.txt. All existing WebApp staged/unstaged/untracked application changes from the prior OceVie branding, booking, API, role and UI tasks are included in the user's FE publication request; preserve their content.

Allowed publication paths: CASMS_WebApp/**, excluding ignored local environment/runtime/credential files, logs, dependencies and build artifacts. Additional allowed edit: this contract, to record publication results. Do not stage any other project path.

Create codex/ocevie-webapp-role-ui-20261023 from refreshed origin/main, retain current working changes, stage and review only WebApp, check for credential/runtime artifacts, run lint/typecheck/build/unit tests, commit and push the new branch to origin. Do not create or merge a PR unless asked. Verify remote branch SHA and final worktree status.

Pre-publication review: staged paths are exclusively CASMS_WebApp. Reviewed configuration, auth/navigation/action contracts, assets/attribution and opt-in integration helpers. No real .env, secrets, runtime data, dependencies or build outputs are staged. Removed one trailing space from the Sora license text to satisfy staged diff checks, without changing the license wording.
Verification: npm run typecheck and npm run build passed; npm test passed 342 tests with 0 failures and 1 opt-in live test skipped. Existing isolated desktop/mobile verification is recorded in the role-alignment results. Publish only this new branch; no PR/merge requested.
Final lint and git diff --cached --check also passed. All required publication checks are complete.
