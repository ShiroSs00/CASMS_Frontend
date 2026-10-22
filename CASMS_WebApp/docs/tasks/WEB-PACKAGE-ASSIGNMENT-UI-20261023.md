# Package assignment UI

Baseline: 38b0d4816c350487e64198b336c7c51bcf7f7399. Preserve all existing worktree changes from earlier tasks.

Allowed: src/features/service-packages/pages/PackageAssignmentPage.tsx, src/features/service-packages/components/PackageAssignment.module.css, this contract. Redesign standalone and embedded package assignment UI using shared controls. Preserve booking/passenger identity, TOUR_PACKAGE_ASSIGN permission, Draft/Active eligibility, confirmation and mutation lock. Display catalogue prices as references, persisted agreed prices separately. No backend/dependency/mobile changes.

User's code-only/no-testing instruction remains active: no tests, lint, typecheck, build or browser checks. Review source only.

Implemented: responsive two-panel layout, booking/passenger summary, persisted current assignment details shown directly from assignment data, searchable active package radio cards, reference prices and validity dates, selected-package summary, review/confirm modal for assign/change/remove, success feedback and permission/lifecycle explanations. No global assignment request until a booking is selected. Existing APIs and mutation safeguards retained. Source reviewed; no commands for automated or browser validation executed.
