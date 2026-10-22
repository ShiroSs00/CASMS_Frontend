# Admin workspaces and design results

Implemented WebApp-only department workspaces: Schedule, Operations, Shore, Onboard. All 19 existing business modules have exactly one workspace owner. Existing module paths/API contracts are retained. Global admin entry is now a four-department chooser; each department has a dedicated landing page, task descriptions, permission-aware primary action, workflow guide and contextual sidebar. Added clear workspace switching, account identity presentation, mobile disclosure and OceVie typography/color hierarchy.

Authorization: eligibility comes from existing /auth/me effectivePermissions, with individual module read checks retained. Direct unrelated workspace/entity links are blocked before feature mount. Backend authorization remains authoritative. No roles, accounts or extra privileges were created. Same-account token refresh preserves an already admitted form, while switches/revocations retire admission; loading/error never grants a new department.

Validation: npm run lint, npm run typecheck, npm run build. Full unit suite: 291 passed, 1 opt-in live integration skipped, 0 failed. Additional tests exercise four distinct manager capability sets, direct URLs, initial/loading/error states, revocation/account switching, contextual navigation, related regulation/history/registration routes, all 19 unique tools and protected route registrations. git diff --check passed apart from the pre-existing CRLF normalization notice.

Live browser against existing QA BE: existing staff account can enter Schedule/Shore/Onboard, and Operations is correctly denied. Read 1 cruise, 1 supplier and 3 service rows through the normal screens. Contextual navigation remains within its department, switching works, and menu closes on route changes. Checked workspace at 390/768/1280/1440px without document overflow; tested keyboard menu opening and 390px service list scrolling. Product/public booking behavior was not changed.

Coverage limit: QA account has no Operations department permissions, so authorized operation-home behavior was covered with capability/guard tests rather than a new privileged account. No privileged CRUD or database mutations were needed. Existing broad backend roles can access several departments; no mutually exclusive manager roles were invented.

Preserved preceding uncommitted repairs/branding; no Mobile App/backend source edits and no push. Backend working-tree status remains its same two Maven output files plus pre-existing run-backend.bat.

Screenshot: admin-four-workspaces.jpg in the task visualization directory. Design reference: docs/design/OCEVIE-admin-workspaces.md.
