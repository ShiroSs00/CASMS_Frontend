# Role-specific login and admin API audit

User correction: login by role must open its assigned function, not a shared four-workspace selector. ADMIN must not act as all four business managers. Audit admin transport against current backend; inspect the return-port choices in create-cruise.

Base: 5ff285ae05290cb44bee25341ff69c33d00c29f4

Allowed initially: WebApp auth, admin app/shared navigation and presentation, admin feature adapters/forms where mismatches are verified, related shared helpers/tests/docs. Preserve all prior uncommitted work, public booking and session keys. Do not edit Mobile App. No backend edits or push without resolution of the pending role-mapping question: backend has no dedicated shore manager role. User was asked whether to add it locally or retain OPERATIONS_MANAGER for both operations/shore. Continue independent API audit while pending.

Use controllers, DTOs, services and observed responses as contracts. Do not turn scalar returnPortId into a made-up array: backend currently stores one endpoint; multiple visited ports belong to itinerary stops. Ensure complete valid choices, visible loading/errors, and exact payloads. Record every confirmed mismatch and coverage limits.

Verify role landing, direct URLs, missing-role behavior, endpoint/payload compatibility, errors/retry and forms. Lint/typecheck/build/unit tests and live read-only QA API/browser verification. Mutations only with isolated QA fixtures and cleanup. No push.

Baseline:
```
 M .env.example
 M .gitignore
 M README.md
 M index.html
 M package.json
 M src/app/layouts/PublicFooter.module.css
 M src/app/layouts/PublicFooter.tsx
 M src/app/layouts/PublicLayout.module.css
 M src/app/layouts/PublicLayout.tsx
 M src/app/router.tsx
 M src/domain/booking-context/BookingPassengerPicker.tsx
 M src/features/auth/components/AdminAccountActions.module.css
 M src/features/auth/components/AdminAccountActions.tsx
 M src/features/auth/components/Auth.module.css
 M src/features/auth/components/AuthAccountMenu.tsx
 M src/features/auth/components/AuthPageShell.tsx
 M src/features/auth/components/LoginForm.tsx
 M src/features/auth/guards.tsx
 M src/features/auth/model/auth-concepts.ts
 M src/features/auth/pages/AccessDeniedPage.tsx
 M src/features/booking/api/customer-extras-api.ts
 M src/features/booking/api/real-booking-api.ts
 M src/features/booking/components/Booking.module.css
 M src/features/booking/components/CruiseDiscovery.tsx
 M src/features/booking/components/CustomerPackageDetails.tsx
 M src/features/booking/components/LiveBooking.module.css
 M src/features/booking/components/LiveBookingFields.tsx
 M src/features/booking/components/LiveCruiseCatalog.tsx
 M src/features/booking/components/PreCruise.tsx
 M src/features/booking/pages/RealBookingCreatePage.tsx
 M src/features/cruises/components/Cruises.module.css
 M src/features/home/components/HeroSection.tsx
 M src/features/home/components/Landing.module.css
 M src/features/home/components/LandingSections.tsx
 M src/features/home/model/public-booking.ts
 M src/features/home/pages/HomePage.tsx
 M src/features/itineraries/components/Itineraries.module.css
 M src/features/itineraries/components/LocationPicker.module.css
 M src/features/operational-issues/components/OperationalIssues.module.css
 M src/features/regulations/components/Regulations.module.css
 M src/features/ship-deck-cabin/components/Management.module.css
 M src/features/ship-deck-cabin/pages/ShipListPage.tsx
 M src/main.tsx
 M src/shared/ui/AdminUI.module.css
 M src/shared/ui/Experience.module.css
 M src/shared/ui/admin-v3/AdminShell.module.css
 M src/shared/ui/admin-v3/AdminShell.tsx
 M src/shared/ui/admin-v3/index.ts
 M src/shared/ui/index.ts
 M src/styles/global.css
 M src/styles/tokens.css
 M tests/admin/admin-navigation.test.mjs
 M tests/admin/booking-session-isolation.test.mjs
 M tests/admin/v31-regulation-oim.test.mjs
 M tests/admin/v31-shore-selectors.test.mjs
 M tests/booking/complete-integration.browser.mjs
 M tests/booking/v15-integration.browser.mjs
 M tests/cruises/cruise-domain.test.mjs
 M tests/cruises/live-contract-rescue.test.mjs
 M tests/home/landing.browser.mjs
 M tests/home/search.test.mjs
 M tests/itineraries/destination-integration.test.mjs
 M tests/ship-deck-cabin/deck-detail-isolation.test.mjs
 M vite.config.ts
?? docs/
?? public/
?? src/app/RouteLoading.tsx
?? src/app/pages/AdminOverviewPage.module.css
?? src/app/pages/AdminOverviewPage.tsx
?? src/app/pages/AdminWorkspacePage.module.css
?? src/app/pages/AdminWorkspacePage.tsx
?? src/features/home/model/asian-ports.ts
?? src/shared/ui/BrandLogo.module.css
?? src/shared/ui/BrandLogo.tsx
?? src/shared/ui/admin-v3/AdminWorkspaceIcon.tsx
?? src/shared/ui/admin-v3/admin-navigation.ts
?? src/styles/fonts.css
?? tests/admin/admin-access-regression.test.mjs
?? tests/booking/ui-api-repair.test.mjs
?? tests/integration/
?? tests/run-unit.mjs
```

## Approved extension — shore role
User explicitly approved adding SHORE_MANAGER in local BE, without push. BE base d4bd59781402ecbf8e0d43fa5f3d29da6cdf94d6. Baseline: only two pre-existing target/maven-status testCompile *.lst modifications and untracked run-backend.bat. Preserve these. Allowed BE paths: identity/enums/Role.java, identity/service/RolePermissionInitializer.java, new identity/service/RoleConstraintInitializer.java, and matching identity service tests. Align existing database role enum checks before seeding; do not reassign existing users. Add role to FE auth decoder, navigation and regression tests. Verify locally against isolated QA only. No Mobile App source edits, no push.

## Verification completed
- FE: lint, typecheck and production build passed; 299 unit tests passed, one opt-in live integration skipped (300 total).
- BE: RolePermissionInitializerTest 9, RoleConstraintInitializerTest 3, PermissionConstraintInitializerTest 1; all 13 passed.
- Restarted QA BE on 8080 using existing isolated casms_mobile_qa runtime. Confirmed SHORE_MANAGER has 36 persisted permissions, both role checks accept it, zero existing accounts assigned to it.
- Live proxy 5175: login and auth/me return ONBOARD_STAFF with 46 permissions. /ports/active returns four active choices in its normal API envelope.
- Browser: ONBOARD_STAFF login returnTo for /admin/cruises/new lands in /admin/workspaces/onboard; direct cruise-create URL denied even with CRUISE_READ. Own sidebar contains only onboard tools. Desktop 1440 and mobile 390 checked, no horizontal overflow. Desktop screenshot saved outside repo in task visualization directory.
- Existing role permission sets/account assignments preserved. No Mobile App source changes, commit or push. Normal database V4 migration remains outside this local QA verification. New shore-role login/guards are covered by unit fixtures; no new privileged QA account was created for a live shore-role login.
