# Provision role-specific local QA accounts

2026-10-22 resumed authorization: create accounts for full WebApp role testing. Scope is QA account provisioning and login/permission verification only; no BE pull, source edits, restart, production inserts or pushes. Confirmed QA database casms_mobile_qa on port 55432 has all 12 role definitions and pgcrypto. Provision 10 distinct missing staff-role accounts transactionally, abort on username collision, preserve existing passenger/onboard accounts. Record results here without credentials, tokens or hashes.

Provisioning completed transactionally: ocevie.admin.qa ADMIN, ocevie.schedule.qa CRUISE_MANAGER, ocevie.ship.qa SHIP_MANAGER, ocevie.operations.qa OPERATIONS_MANAGER, ocevie.shore.qa SHORE_MANAGER, ocevie.activity.qa ACTIVITY_MANAGER, ocevie.booking.qa BOOKING_AGENT, ocevie.finance.qa FINANCE_OFFICER, ocevie.checkin.qa CHECKIN_STAFF, ocevie.support.qa CUSTOMER_SERVICE. Existing passenger/onboard credentials unchanged. All 12 login and /auth/me checks passed through Vite :5175 /api proxy; each reports exactly the intended role and non-empty effective permissions. Read checks returned 200 for identity/users, ships, operational-issues, shore-excursions, activities, booking and servicepackage/requests. Initial cruise probe used incorrect /cruises path; actual WebApp endpoint is /cruise. Check-in has no implemented end-to-end workflow to verify. No source changes or test data booking/payment operations performed in this provisioning task. Account readiness does not establish complete business workflow support.

User asks for the remaining manager accounts after requesting accounts to test all WebApp functions. Provision distinct role accounts in verified local casms_mobile_qa only. Do not modify existing accounts/passwords, production data, Mobile App source or push BE.

FE base 5ff285ae05290cb44bee25341ff69c33d00c29f4. BE base d4bd59781402ecbf8e0d43fa5f3d29da6cdf94d6; existing local role/registration/booking-copy changes preserved. QA baseline: khachtest and ocevie.mobile.qa PASSENGER; stafftest and ocevie.staff.qa ONBOARD_STAFF. No managers currently provisioned.

Allowed: this contract and QA account results without passwords; BE src/main/java/com/casms/identity/entity/User.java and new src/test/java/com/casms/identity/entity/UserRoleClassificationTest.java. Fix confirmed isStaff() whitelist omission for SHORE_MANAGER/ACTIVITY_MANAGER. QA User and UserRole inserts for dedicated ocevie.*.qa accounts, transactionally, after database/schema/role verification; never overwrite an existing account or password. Use BCrypt matching server encoder. Verify each login and /auth/me without logging tokens/password hashes. No new account APIs or production seed migration.

Baseline FE:
 M .env.example
 M .gitignore
 M README.md
 M index.html
 M package.json
 M src/app/layouts/AdminAccountLayout.tsx
 M src/app/layouts/PublicFooter.module.css
 M src/app/layouts/PublicFooter.tsx
 M src/app/layouts/PublicLayout.module.css
 M src/app/layouts/PublicLayout.tsx
 M src/app/router.tsx
 M src/domain/booking-context/BookingPassengerPicker.tsx
 M src/features/activities/components/RegistrationPanel.tsx
 M src/features/auth/components/AdminAccountActions.module.css
 M src/features/auth/components/AdminAccountActions.tsx
 M src/features/auth/components/Auth.module.css
 M src/features/auth/components/AuthAccountMenu.tsx
 M src/features/auth/components/AuthPageShell.tsx
 M src/features/auth/components/LoginForm.tsx
 M src/features/auth/guards.tsx
 M src/features/auth/model/auth-concepts.ts
 M src/features/auth/model/auth-types.ts
 M src/features/auth/pages/AccessDeniedPage.tsx
 M src/features/auth/pages/AuthConceptPage.tsx
 M src/features/auth/pages/LoginPage.tsx
 M src/features/booking/api/customer-extras-api.ts
 M src/features/booking/api/real-booking-api.ts
 M src/features/booking/components/Booking.module.css
 M src/features/booking/components/BookingProvider.tsx
 M src/features/booking/components/CruiseDiscovery.tsx
 M src/features/booking/components/CustomerExperiences.tsx
 M src/features/booking/components/CustomerPackageDetails.tsx
 M src/features/booking/components/LiveBooking.module.css
 M src/features/booking/components/LiveBookingFields.tsx
 M src/features/booking/components/LiveCruiseCatalog.tsx
 M src/features/booking/components/PreCruise.tsx
 M src/features/booking/components/PublicBookingRecord.tsx
 M src/features/booking/index.ts
 M src/features/booking/model/live-booking-context.ts
 M src/features/booking/model/real-booking-view.ts
 M src/features/booking/pages/ManagementPages.tsx
 M src/features/booking/pages/RealBookingCreatePage.tsx
 M src/features/booking/pages/RealBookingPages.tsx
 M src/features/cruises/api/cruise-api.ts
 M src/features/cruises/components/CruiseUI.tsx
 M src/features/cruises/components/Cruises.module.css
 M src/features/cruises/hooks/useCruiseList.ts
 M src/features/cruises/model/cruise-validation.ts
 M src/features/cruises/model/cruise-view.ts
 M src/features/cruises/pages/CruiseDetailPage.tsx
 M src/features/cruises/pages/CruiseFormPage.tsx
 M src/features/cruises/pages/CruiseListPage.tsx
 M src/features/home/components/HeroSection.tsx
 M src/features/home/components/Landing.module.css
 M src/features/home/components/LandingSections.tsx
 M src/features/home/model/public-booking.ts
 M src/features/home/pages/HomePage.tsx
 M src/features/itineraries/components/Itineraries.module.css
 M src/features/itineraries/components/LocationPicker.module.css
 M src/features/itineraries/pages/MasterDataPages.tsx
 M src/features/operational-issues/components/IssueSearchFilters.tsx
 M src/features/operational-issues/components/OperationalIssues.module.css
 M src/features/regulations/components/Regulations.module.css
 M src/features/regulations/pages/RegulationDetailPage.tsx
 M src/features/regulations/pages/RegulationListPage.tsx
 M src/features/service-packages/components/CatalogUI.tsx
 M src/features/service-packages/pages/CatalogDetailPage.tsx
 M src/features/ship-deck-cabin/components/Management.module.css
 M src/features/ship-deck-cabin/pages/ListPage.tsx
 M src/features/ship-deck-cabin/pages/ShipListPage.tsx
 M src/main.tsx
 M src/shared/ui/AdminUI.module.css
 M src/shared/ui/Experience.module.css
 M src/shared/ui/admin-v3/AdminShell.module.css
 M src/shared/ui/admin-v3/AdminShell.tsx
 M src/shared/ui/admin-v3/admin-account-context.ts
 M src/shared/ui/admin-v3/index.ts
 M src/shared/ui/index.ts
 M src/styles/global.css
 M src/styles/tokens.css
 M tests/admin/admin-navigation.test.mjs
 M tests/admin/booking-session-isolation.test.mjs
 M tests/admin/onboard-contracts.test.mjs
 M tests/admin/v31-regulation-oim.test.mjs
 M tests/admin/v31-shore-selectors.test.mjs
 M tests/booking/complete-auth.test.mjs
 M tests/booking/complete-integration.browser.mjs
 M tests/booking/v15-integration.browser.mjs
 M tests/cruises/cruise-domain.test.mjs
 M tests/cruises/cruise-form-cancellation.test.mjs
 M tests/cruises/live-contract-rescue.test.mjs
 M tests/home/landing.browser.mjs
 M tests/home/search.test.mjs
 M tests/itineraries/destination-integration.test.mjs
 M tests/ship-deck-cabin/deck-detail-isolation.test.mjs
 M vite.config.ts
?? docs/
?? public/
?? src/app/RouteErrorPage.module.css
?? src/app/RouteErrorPage.tsx
?? src/app/RouteLoading.tsx
?? src/app/pages/AdminOverviewPage.module.css
?? src/app/pages/AdminOverviewPage.tsx
?? src/app/pages/AdminStaffFunctionPage.tsx
?? src/app/pages/AdminSystemPage.tsx
?? src/app/pages/AdminWorkspacePage.module.css
?? src/app/pages/AdminWorkspacePage.tsx
?? src/features/booking/components/BookingInstallments.tsx
?? src/features/booking/model/booking-progress.ts
?? src/features/booking/pages/FinanceBookingsPage.tsx
?? src/features/home/model/asian-ports.ts
?? src/shared/ui/BrandLogo.module.css
?? src/shared/ui/BrandLogo.tsx
?? src/shared/ui/admin-v3/AdminWorkspaceIcon.tsx
?? src/shared/ui/admin-v3/admin-navigation.ts
?? src/styles/fonts.css
?? tests/admin/admin-access-regression.test.mjs
?? tests/booking/production-flow.test.mjs
?? tests/booking/ui-api-repair.test.mjs
?? tests/cruises/admin-be-contract.test.mjs
?? tests/integration/
?? tests/run-unit.mjs

User steering: pull newly updated BE and check it before continuing QA role accounts. Authorized git fetch/pull of BE main tracking origin/main; no push. Preserve all pre-existing tracked/untracked local work using a recoverable named stash before updating. Inspect incoming diff first. Resolve overlapping role/API changes by reconciling with the new BE contract, keeping snapshots recoverable; extend local implementation scope in this contract before any conflict repair. Record old/new commit, conflicts, verification and remaining issues. No manager account inserts have been made yet.
