# Issue report creation repair

Baseline: 38b0d4816c350487e64198b336c7c51bcf7f7399, existing session edits preserved.

Allowed: src/features/operational-issues/{api/dto.ts,api/operational-issues-api.ts,api/location-lookup-api.ts,pages/IssueFormPage.tsx,components/ReportIssueDialog.tsx}, this contract. Match the six-field OperationalIssueRequest, remove client issueCode, load cabins through public ship-scoped lookup, do not block mandatory ship reporting on unselected optional lookups. Retain relationship validation for selected IDs, permissions, submission locks and existing UI. No backend, dependency or test changes. User's no-testing instruction remains active: no tests, lint, typecheck, build or browser checks.

Source findings: FE included issueCode absent from BE OperationalIssueRequest; both report forms gated submission on all optional lookups and requested global cabins requiring CABIN_READ. Implemented exact six-field serialization with trimmed values/null optional IDs; removed issueCode state/call arguments; use public ship-scoped cabin endpoint and selected-only lookup readiness. Quick-report controls load independently and identify optional failures. No live creation/reproduction performed; reviewed source only.
