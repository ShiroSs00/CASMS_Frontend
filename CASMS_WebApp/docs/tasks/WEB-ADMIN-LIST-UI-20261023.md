# Admin list UI cleanup

Baseline: 38b0d4816c350487e64198b336c7c51bcf7f7399. Existing auth/public-contact changes and untracked documentation are pre-existing.

Scope: booking list layout; regulation filter layout and removal of informational notices/effective-only button; operational issue unsupported-capability copy; service catalogue tabs; remove operational workflow page and entry links. Allowed: affected src/features/{booking,regulations,operational-issues,service-packages}/**, src/shared/ui/**, src/app/{router.tsx,pages/AdminWorkspacePage.tsx,pages/AdminWorkflowPage*}, this contract. Preserve API behavior and permissions. No dependency, backend or mobile changes.

User explicitly requests code only and no testing. Do not execute tests, lint, typecheck, build, browser verification or modify test files for this task.

Follow-up scope: remove regional overview menu/page and its stylesheet; update manager landing routes to cruises, ships, issues and activities respectively. Extend allowed paths to src/app/pages/AdminWorkspacePage*. Preserve old workspace URLs as redirects to the current role home. No automated checks requested.

Implemented shared ListFilters/ListFooter and existing shared DataTable across the affected lists. Booking uses status badges, linked references, explicit empty states and compact pagination. Regulation informational notices/effective-only button removed. Issue unavailable-feature copy removed. Catalog tabs removed; sidebar remains the navigation entry. Workflow page/styles and links removed; old URL redirects to admin home. Reviewed edited source only; no validation commands executed at user request.
