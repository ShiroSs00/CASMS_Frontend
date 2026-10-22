# Admin workspaces and UI/UX redesign

User: separate WebApp admin for schedule, operations, shore services and onboard services managers, and redesign admin UI/UX. Existing roles/permissions stay server authoritative. No mobile or backend edits, no account/role grants, no push.

Base: 5ff285ae05290cb44bee25341ff69c33d00c29f4

Allowed: WebApp src/shared/ui/admin-v3/**; src/app/pages/AdminOverviewPage* and AdminWorkspacePage*; src/app/router.tsx for workspace routes; auth AdminAccountActions presentation and AdminGuard for direct department-link access; admin-related shared presentation CSS if needed; tests/admin/** and docs. Preserve all prior uncommitted work. Existing feature routes, data and mutation guards remain intact.

Implement four department workspaces with permission-based access, individual landing pages, contextual navigation, accessible workspace switching, OceVie style, responsive layout. Keep public catalog permissions separate from department eligibility; a UI workspace never grants backend authority. Existing roles do not supply four dedicated manager assignments, so no fictitious role names or account assignments.

Verify permission combinations, direct links, missing/loading/error access, existing module routes and related history/registration contexts, responsive 390/768/1280/1440 and keyboard navigation. Run lint/typecheck/build/unit tests; live read-only QA checks with existing BE. No invented business metrics.

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
 M src/features/auth/components/Auth.module.css
 M src/features/auth/components/AuthAccountMenu.tsx
 M src/features/auth/components/AuthPageShell.tsx
 M src/features/auth/components/LoginForm.tsx
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
?? src/features/home/model/asian-ports.ts
?? src/shared/ui/BrandLogo.module.css
?? src/shared/ui/BrandLogo.tsx
?? src/shared/ui/admin-v3/admin-navigation.ts
?? src/styles/fonts.css
?? tests/admin/admin-access-regression.test.mjs
?? tests/booking/ui-api-repair.test.mjs
?? tests/integration/
?? tests/run-unit.mjs
```
