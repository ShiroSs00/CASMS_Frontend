# Publish frontend journey and UI repairs

User explicitly requests a new branch and push to GitHub. Scope: publish FE work completed in this conversation, with its source dependencies and task/handoff notes. No BE/Mobile changes or pushes, merge, rebase, force-push or PR creation.

Baseline: HEAD `ee89e6cfb53876951070c386a59d0333faf94aae` on main; full status and diffs inspected. After `git fetch origin`, HEAD and origin/main have no divergence (0/0). Created `codex/frontend-journey-ui-fixes-20261023` from that commit, preserving all existing worktree files.

Allowed staging: the 36 tracked modified source files under CASMS_WebApp/src present in this task's baseline; the five newly authored source dependencies PaymentLedger.tsx, CheckinDesk.tsx, CruiseOperations.tsx, schedule-api.ts and ServiceSchedules.tsx; and these session-owned notes under docs/tasks:
- WEB-SERVICE-MENU-MERGE-20261023.md
- WEB-PORT-ACTIONS-20261023.md
- WEB-PORT-CANCELLED-LOAD-20261023.md
- WEB-JOURNEY-INTEGRATION-20261023.md
- WEB-JOURNEY-BE-HANDOFF-20261023.md
- WEB-CATALOG-SHARED-UX-20261023.md
- WEB-EXCURSION-PAYLOAD-UX-20261023.md
- WEB-EXCURSION-DETAIL-ACTIONS-20261023.md
- WEB-TOUR-GROUP-INHERITANCE-20261023.md
- WEB-GROUP-DETAIL-ROSTER-20261023.md
- WEB-CATALOG-FORM-WIDTH-20261023.md
- This document.

Other untracked documents, audit snapshots/raw data, demo/runtime notes, local configuration, secrets and generated artifacts stay outside the commit. Do not overwrite or delete them. No production source edits are part of publication itself.

Verification: source/staged diff and path review, secret/runtime artifact scan, lint, typecheck and build. The user's no-automated-tests instruction remains effective. Browser verification is unavailable in this session; source notes describe the limitations and BE gaps, including the FE roster workaround. Commit with a conventional subject, push only the new branch with upstream, then verify its SHA against origin.

Pre-commit evidence: staged exactly 53 files (41 source files and 12 session-owned notes); all paths are under CASMS_WebApp. Staged source matches the reviewed working source; no deletions or unrelated file changes included. Credential-pattern and runtime-artifact scans found no matches. `npm run lint`, `npm run typecheck`, `npm run build` and `git diff --cached --check` passed. Automated tests were not run, as requested. Older/unrelated untracked documentation and raw audit/demo material are preserved locally and excluded from publication.
