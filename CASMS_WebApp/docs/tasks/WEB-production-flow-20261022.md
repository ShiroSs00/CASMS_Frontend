# Production WebApp cleanup, booking stages, hero ports and department access

User requests production behavior (no demo copy), booking steps AND installment payments, more than three Asian hero ports, and permissions aligned to provided system-context diagram. Existing no BE push and no Mobile App edits remain in force.

FE base 5ff285ae05290cb44bee25341ff69c33d00c29f4. Full baseline status saved below; all work is pre-existing and must be preserved. BE baseline includes previous local SHORE_MANAGER source/tests plus two generated Maven metadata modifications and run-backend.bat. No commits/push.

Allowed: WebApp src/ for verified production cleanup and role/booking behavior; public/images/ports and attribution; related tests/ and docs/. No dependencies/lockfile changes. BE identity role permissions/constraint initialization and corresponding tests only if needed to implement the requested role boundaries; inspect controllers first. Do not invent payment-gateway endpoints or infer fine-grained permissions from unreadable diagram labels. Align departmental responsibilities with existing roles and supported APIs. Test-only fixtures may remain isolated; runtime cannot expose preview controls or bypass authentication through preview parameters.

Booking: selected staged plan must be serialized as STAGES and persisted installment rows rendered from BE. Guard forward steps using completed required inputs; preserve draft when navigating back. Do not fabricate prices, paid states, invoices or boarding credentials. Remove developer/API explanations from product text while retaining concise operational status/error messages.

Hero: use identifiable real Asian port photographs with source/license records, accessible controls and reduced-motion support; avoid claiming these images are available itineraries. Verify image resources and desktop/mobile layout.

Required: lint, typecheck, build, relevant/full unit tests, browser home/booking/login and direct-URL checks, live read-only QA APIs; isolated transactional QA fixtures only if needed. Record actual limitations rather than marking full production readiness without server capabilities.

## Baseline FE
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
 M src/features/auth/pages/LoginPage.tsx
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
 M src/features/operational-issues/components/OperationalIssues.module.css
 M src/features/regulations/components/Regulations.module.css
 M src/features/ship-deck-cabin/components/Management.module.css
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
?? src/app/RouteLoading.tsx
?? src/app/pages/AdminOverviewPage.module.css
?? src/app/pages/AdminOverviewPage.tsx
?? src/app/pages/AdminStaffFunctionPage.tsx
?? src/app/pages/AdminSystemPage.tsx
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
?? tests/cruises/admin-be-contract.test.mjs
?? tests/integration/
?? tests/run-unit.mjs

Scope extension after API inspection: BE activity/controller/ActivityController.java, new activity/service/RegistrationAccessPolicy.java and corresponding controller/service tests. Shared registration endpoints currently authorize ACTIVITY_REGISTRATION even for shore targets, blocking SHORE_MANAGER while permitting ONBOARD_STAFF to mutate shore registrations by ID. Enforce target-specific authorities while keeping service ownership checks. FE activities RegistrationPanel must use EXCURSION_BOOKING for shore mutations. These are local changes only, required by requested department boundaries.

Copy-only BE extension: booking/service/BookingService.java and its existing BookingServiceTest are allowed to replace old CASMS branding and hardcoded, unverified physical-office address in contract instructions/notifications. Keep physical contract signing policy and all payment calculations unchanged.

Diagram role separation extension: add ACTIVITY_MANAGER to local BE identity/enums/Role.java and canonical permission initializer, and FE auth/navigation/tests. The supplied diagram distinguishes Activity Management Department from Onboard Sales & Service Staff. ACTIVITY_MANAGER owns the onboard management workspace; ONBOARD_STAFF is limited to service-request execution, reference reads and existing POS sale authority, without activity/catalog/shore mutations. No existing user assignment is changed; RoleConstraintInitializer synchronizes the new enum allowlist. Do not invent POS or payment endpoints/UI where unsupported.
