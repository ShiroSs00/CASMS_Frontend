# Align WebApp access with BE 15a113a

User authorization: update WebApp according to the pulled backend roles/permissions. No database access, QA runtime, migrations, BE edits, mobile changes, commits or pushes.
FE base: 5ff285ae05290cb44bee25341ff69c33d00c29f4. BE source contract: 15a113ac3b8917d8150d69225a3b785f49a60b0e.
All baseline staged and unstaged changes are pre-existing; preserve them, do not alter index.

Allowed paths: this task contract/results; docs/design/OCEVIE-admin-workspaces.md; src/features/auth/model/auth-types.ts; src/features/auth/guards.tsx; src/shared/ui/admin-v3/admin-navigation.ts; src/shared/ui/admin-v3/AdminShell.tsx; src/shared/ui/admin-v3/AdminWorkspaceIcon.tsx; src/shared/ui/admin-v3/index.ts; src/app/pages/AdminWorkspacePage.tsx; src/app/pages/AdminOverviewPage.tsx; src/app/pages/AdminSystemPage.tsx; src/features/service-packages/components/CatalogUI.tsx; src/features/service-packages/pages/CatalogDetailPage.tsx; src/features/booking/pages/RealBookingPages.tsx; src/features/booking/model/booking-permissions.ts; tests/admin/admin-access-regression.test.mjs; tests/admin/admin-navigation.test.mjs; tests/admin/backend-role-policy.test.mjs; tests/booking/complete-auth.test.mjs; tests/booking/production-flow.test.mjs; tests/booking/ui-api-repair.test.mjs; tests/booking/booking-action-access.test.mjs.

Implement unified ACTIVITY_SERVICE_MANAGER and remove legacy role recognition. Keep role-specific landing, unite shore/onboard management tools. Use BE effectivePermissions for route/action access, including cross-module reference reads and multiple-role unions; fail closed while access is unknown, preserve only same-account/path admitted forms during refresh. No ADMIN all-permission bypass. Match BOOKING_CONFIRM and cabin permission controller guards. Do not implement new payment/check-in/model features in this access-alignment task.
Verification: lint, typecheck, build, all existing unit tests plus role/action regression tests; browser UI QA using isolated fixture responses only (never QA database); report limitations separately.

Scope extension: tests/admin/onboard-contracts.test.mjs needs its CatalogUI import stub updated for the new session permission hook. Temporary UI fixture server and screenshots live only in the task visualization directory; no application fixture bypass or production seed changes.

User steering: group related sidebar tools into expandable parents. Additional allowed path: src/shared/ui/admin-v3/AdminShell.module.css. Use keyboard-accessible native disclosure groups, auto-open the current resource group, retain permission filtering and active child links; test desktop and narrow-screen expand/collapse/navigation. No role/API changes from this steering.

Follow-up: apply and verify the grouped navigation for every BE role. Preserve the current worktree/index as recorded in task visualization all-roles-baseline.txt (same FE base). All existing changes remain pre-existing. Use distinct role labels, place each role's primary job group first (fleet for SHIP_MANAGER, issues for OPERATIONS_MANAGER), cover all 10 staff roles plus passenger admin denial with permission and disclosure matrices. Allowed paths remain unchanged. No database connections, account provisioning, BE edits or migrations.

Follow-up explicitly includes action permission parity for each role. Additional allowed paths: src/features/activities/components/RegistrationPanel.tsx; src/features/activities/model/activity-permissions.ts; tests/admin/activity-permissions.test.mjs. Fix verified differences against ActivityController: registration read uses ACTIVITY_ATTENDANCE or ACTIVITY_REGISTRATION; existing registration mutation uses ACTIVITY_REGISTRATION for both targets; participation endpoints use ACTIVITY_ATTENDANCE. Avoid inaccessible participation/registration requests for read-only roles. Package-assignment read must retain BOOKING_READ as the controller allows. Workspace cards/primary action should honor each role's actual grants.

## Baseline
M  CASMS_WebApp/.env.example
M  CASMS_WebApp/.gitignore
M  CASMS_WebApp/README.md
A  CASMS_WebApp/docs/README.md
A  CASMS_WebApp/docs/design/OCEVIE-admin-workspaces.md
A  CASMS_WebApp/docs/design/OCEVIE-brand-reference.md
A  CASMS_WebApp/docs/engineering/OCEVIE-BE-context-diagram-handoff.md
A  CASMS_WebApp/docs/engineering/architecture.md
A  CASMS_WebApp/docs/engineering/development.md
A  CASMS_WebApp/docs/engineering/git-workflow.md
A  CASMS_WebApp/docs/engineering/module-map.md
A  CASMS_WebApp/docs/tasks/WEB-admin-review-20261022.md
A  CASMS_WebApp/docs/tasks/WEB-admin-review-results-20261022.md
A  CASMS_WebApp/docs/tasks/WEB-admin-workspaces-20261022.md
A  CASMS_WebApp/docs/tasks/WEB-admin-workspaces-results-20261022.md
A  CASMS_WebApp/docs/tasks/WEB-backend-context-handoff-20261022.md
A  CASMS_WebApp/docs/tasks/WEB-ocevie-brand-20261022.md
A  CASMS_WebApp/docs/tasks/WEB-ocevie-brand-results-20261022.md
A  CASMS_WebApp/docs/tasks/WEB-production-flow-20261022.md
A  CASMS_WebApp/docs/tasks/WEB-production-flow-results-20261022.md
AM CASMS_WebApp/docs/tasks/WEB-qa-role-accounts-20261022.md
A  CASMS_WebApp/docs/tasks/WEB-role-login-api-audit-20261022.md
A  CASMS_WebApp/docs/tasks/WEB-ui-api-repair-20261022.md
A  CASMS_WebApp/docs/tasks/WEB-ui-api-repair-results-20261022.md
M  CASMS_WebApp/index.html
M  CASMS_WebApp/package.json
A  CASMS_WebApp/public/branding/LOGO-KIT-README.md
A  CASMS_WebApp/public/branding/apple-touch-icon.png
A  CASMS_WebApp/public/branding/favicon.ico
A  CASMS_WebApp/public/branding/ocevie-favicon.svg
A  CASMS_WebApp/public/branding/ocevie-horizontal-dark-no-tagline.svg
A  CASMS_WebApp/public/branding/ocevie-horizontal-dark.svg
A  CASMS_WebApp/public/branding/ocevie-horizontal-light-no-tagline.svg
A  CASMS_WebApp/public/branding/ocevie-social-og.png
A  CASMS_WebApp/public/branding/ocevie-symbol-dark.svg
A  CASMS_WebApp/public/fonts/BeVietnamPro-Medium.ttf
A  CASMS_WebApp/public/fonts/BeVietnamPro-OFL.txt
A  CASMS_WebApp/public/fonts/BeVietnamPro-Regular.ttf
A  CASMS_WebApp/public/fonts/BeVietnamPro-SemiBold.ttf
A  CASMS_WebApp/public/fonts/Sora-OFL.txt
A  CASMS_WebApp/public/fonts/Sora-Variable.ttf
A  CASMS_WebApp/public/images/ports/busan-port.webp
A  CASMS_WebApp/public/images/ports/credits.html
A  CASMS_WebApp/public/images/ports/hong-kong-victoria.webp
A  CASMS_WebApp/public/images/ports/keelung-harbour.webp
A  CASMS_WebApp/public/images/ports/kobe-port.webp
A  CASMS_WebApp/public/images/ports/port-klang-cruise.webp
A  CASMS_WebApp/public/images/ports/singapore-marina-bay.webp
A  CASMS_WebApp/public/images/ports/yokohama-osanbashi.webp
A  CASMS_WebApp/src/app/RouteErrorPage.module.css
A  CASMS_WebApp/src/app/RouteErrorPage.tsx
A  CASMS_WebApp/src/app/RouteLoading.tsx
M  CASMS_WebApp/src/app/layouts/AdminAccountLayout.tsx
M  CASMS_WebApp/src/app/layouts/PublicFooter.module.css
M  CASMS_WebApp/src/app/layouts/PublicFooter.tsx
M  CASMS_WebApp/src/app/layouts/PublicLayout.module.css
M  CASMS_WebApp/src/app/layouts/PublicLayout.tsx
A  CASMS_WebApp/src/app/pages/AdminOverviewPage.module.css
A  CASMS_WebApp/src/app/pages/AdminOverviewPage.tsx
A  CASMS_WebApp/src/app/pages/AdminStaffFunctionPage.tsx
A  CASMS_WebApp/src/app/pages/AdminSystemPage.tsx
A  CASMS_WebApp/src/app/pages/AdminWorkspacePage.module.css
A  CASMS_WebApp/src/app/pages/AdminWorkspacePage.tsx
M  CASMS_WebApp/src/app/router.tsx
M  CASMS_WebApp/src/domain/booking-context/BookingPassengerPicker.tsx
M  CASMS_WebApp/src/features/activities/components/RegistrationPanel.tsx
M  CASMS_WebApp/src/features/auth/components/AdminAccountActions.module.css
M  CASMS_WebApp/src/features/auth/components/AdminAccountActions.tsx
M  CASMS_WebApp/src/features/auth/components/Auth.module.css
M  CASMS_WebApp/src/features/auth/components/AuthAccountMenu.tsx
M  CASMS_WebApp/src/features/auth/components/AuthPageShell.tsx
M  CASMS_WebApp/src/features/auth/components/LoginForm.tsx
M  CASMS_WebApp/src/features/auth/guards.tsx
M  CASMS_WebApp/src/features/auth/model/auth-concepts.ts
M  CASMS_WebApp/src/features/auth/model/auth-types.ts
M  CASMS_WebApp/src/features/auth/pages/AccessDeniedPage.tsx
M  CASMS_WebApp/src/features/auth/pages/AuthConceptPage.tsx
M  CASMS_WebApp/src/features/auth/pages/LoginPage.tsx
M  CASMS_WebApp/src/features/booking/api/customer-extras-api.ts
M  CASMS_WebApp/src/features/booking/api/real-booking-api.ts
M  CASMS_WebApp/src/features/booking/components/Booking.module.css
A  CASMS_WebApp/src/features/booking/components/BookingInstallments.tsx
M  CASMS_WebApp/src/features/booking/components/BookingProvider.tsx
M  CASMS_WebApp/src/features/booking/components/CruiseDiscovery.tsx
M  CASMS_WebApp/src/features/booking/components/CustomerExperiences.tsx
M  CASMS_WebApp/src/features/booking/components/CustomerPackageDetails.tsx
M  CASMS_WebApp/src/features/booking/components/LiveBooking.module.css
M  CASMS_WebApp/src/features/booking/components/LiveBookingFields.tsx
M  CASMS_WebApp/src/features/booking/components/LiveCruiseCatalog.tsx
M  CASMS_WebApp/src/features/booking/components/PreCruise.tsx
M  CASMS_WebApp/src/features/booking/components/PublicBookingRecord.tsx
M  CASMS_WebApp/src/features/booking/index.ts
A  CASMS_WebApp/src/features/booking/model/booking-progress.ts
M  CASMS_WebApp/src/features/booking/model/live-booking-context.ts
M  CASMS_WebApp/src/features/booking/model/real-booking-view.ts
A  CASMS_WebApp/src/features/booking/pages/FinanceBookingsPage.tsx
M  CASMS_WebApp/src/features/booking/pages/ManagementPages.tsx
M  CASMS_WebApp/src/features/booking/pages/RealBookingCreatePage.tsx
M  CASMS_WebApp/src/features/booking/pages/RealBookingPages.tsx
M  CASMS_WebApp/src/features/cruises/api/cruise-api.ts
M  CASMS_WebApp/src/features/cruises/components/CruiseUI.tsx
M  CASMS_WebApp/src/features/cruises/components/Cruises.module.css
M  CASMS_WebApp/src/features/cruises/hooks/useCruiseList.ts
M  CASMS_WebApp/src/features/cruises/model/cruise-validation.ts
M  CASMS_WebApp/src/features/cruises/model/cruise-view.ts
M  CASMS_WebApp/src/features/cruises/pages/CruiseDetailPage.tsx
M  CASMS_WebApp/src/features/cruises/pages/CruiseFormPage.tsx
M  CASMS_WebApp/src/features/cruises/pages/CruiseListPage.tsx
M  CASMS_WebApp/src/features/home/components/HeroSection.tsx
M  CASMS_WebApp/src/features/home/components/Landing.module.css
M  CASMS_WebApp/src/features/home/components/LandingSections.tsx
A  CASMS_WebApp/src/features/home/model/asian-ports.ts
M  CASMS_WebApp/src/features/home/model/public-booking.ts
M  CASMS_WebApp/src/features/home/pages/HomePage.tsx
M  CASMS_WebApp/src/features/itineraries/components/Itineraries.module.css
M  CASMS_WebApp/src/features/itineraries/components/LocationPicker.module.css
M  CASMS_WebApp/src/features/itineraries/pages/MasterDataPages.tsx
M  CASMS_WebApp/src/features/operational-issues/components/IssueSearchFilters.tsx
M  CASMS_WebApp/src/features/operational-issues/components/OperationalIssues.module.css
M  CASMS_WebApp/src/features/regulations/components/Regulations.module.css
M  CASMS_WebApp/src/features/regulations/pages/RegulationDetailPage.tsx
M  CASMS_WebApp/src/features/regulations/pages/RegulationListPage.tsx
M  CASMS_WebApp/src/features/service-packages/components/CatalogUI.tsx
M  CASMS_WebApp/src/features/service-packages/pages/CatalogDetailPage.tsx
M  CASMS_WebApp/src/features/ship-deck-cabin/components/Management.module.css
M  CASMS_WebApp/src/features/ship-deck-cabin/pages/ListPage.tsx
M  CASMS_WebApp/src/features/ship-deck-cabin/pages/ShipListPage.tsx
M  CASMS_WebApp/src/main.tsx
M  CASMS_WebApp/src/shared/ui/AdminUI.module.css
A  CASMS_WebApp/src/shared/ui/BrandLogo.module.css
A  CASMS_WebApp/src/shared/ui/BrandLogo.tsx
M  CASMS_WebApp/src/shared/ui/Experience.module.css
M  CASMS_WebApp/src/shared/ui/admin-v3/AdminShell.module.css
M  CASMS_WebApp/src/shared/ui/admin-v3/AdminShell.tsx
A  CASMS_WebApp/src/shared/ui/admin-v3/AdminWorkspaceIcon.tsx
M  CASMS_WebApp/src/shared/ui/admin-v3/admin-account-context.ts
A  CASMS_WebApp/src/shared/ui/admin-v3/admin-navigation.ts
M  CASMS_WebApp/src/shared/ui/admin-v3/index.ts
M  CASMS_WebApp/src/shared/ui/index.ts
A  CASMS_WebApp/src/styles/fonts.css
M  CASMS_WebApp/src/styles/global.css
M  CASMS_WebApp/src/styles/tokens.css
A  CASMS_WebApp/tests/admin/admin-access-regression.test.mjs
M  CASMS_WebApp/tests/admin/admin-navigation.test.mjs
M  CASMS_WebApp/tests/admin/booking-session-isolation.test.mjs
M  CASMS_WebApp/tests/admin/onboard-contracts.test.mjs
M  CASMS_WebApp/tests/admin/v31-regulation-oim.test.mjs
M  CASMS_WebApp/tests/admin/v31-shore-selectors.test.mjs
M  CASMS_WebApp/tests/booking/complete-auth.test.mjs
M  CASMS_WebApp/tests/booking/complete-integration.browser.mjs
A  CASMS_WebApp/tests/booking/production-flow.test.mjs
A  CASMS_WebApp/tests/booking/ui-api-repair.test.mjs
M  CASMS_WebApp/tests/booking/v15-integration.browser.mjs
A  CASMS_WebApp/tests/cruises/admin-be-contract.test.mjs
M  CASMS_WebApp/tests/cruises/cruise-domain.test.mjs
M  CASMS_WebApp/tests/cruises/cruise-form-cancellation.test.mjs
M  CASMS_WebApp/tests/cruises/live-contract-rescue.test.mjs
M  CASMS_WebApp/tests/home/landing.browser.mjs
M  CASMS_WebApp/tests/home/search.test.mjs
A  CASMS_WebApp/tests/integration/start-backend-qa.ps1
A  CASMS_WebApp/tests/integration/webapp-live-api.test.mjs
M  CASMS_WebApp/tests/itineraries/destination-integration.test.mjs
A  CASMS_WebApp/tests/run-unit.mjs
M  CASMS_WebApp/tests/ship-deck-cabin/deck-detail-isolation.test.mjs
M  CASMS_WebApp/vite.config.ts

Follow-up 2026-10-22: permission-specific UI must omit unauthorized mutation controls, editor inputs and confirmation dialogs rather than showing disabled create/edit/delete/manage actions. Preserve read/search/retry and allowed lifecycle constraints; permissions remain effectivePermissions, not role-name checks. Baseline: visualization permission-ux-baseline.txt; all pre-existing changes/index preserved. Additional allowed paths: TSX files in src/features/activities, booking, cruises, itineraries, operational-issues, regulations, service-packages, ship-deck-cabin, shore-excursions and tour-groups (only permission-driven UI); tests/admin/permission-action-ui.test.mjs; existing tests for those modules only when adapting prior disabled-control assertions. No API/schema/DB/mobile changes. Check rendered read-only and writable controls, limited grants, desktop/mobile, lint/typecheck/build/unit suite. Fixture files/screenshots remain outside repo in task visualization directory.
Additional regression path: src/features/tour-groups/api/group-passenger-api.test.mjs. Its SSR render must set an explicit authorized session before testing lifecycle controls and test an empty permission session separately; prior anonymous session only tested disabled buttons.
Additional allowed UI path: src/features/suppliers/components/SupplierDetail.tsx, for the same read-only action visibility rule and permission revocation of dialogs.
