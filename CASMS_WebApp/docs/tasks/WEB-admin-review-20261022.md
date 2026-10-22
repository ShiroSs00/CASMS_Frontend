# Admin review and repair

User request: check and fix the existing admin after OceVie brand alignment. Preserve all preceding uncommitted UI/API/branding work. No backend/mobile source changes, no push.

Base: 5ff285ae05290cb44bee25341ff69c33d00c29f4

Allowed: WebApp src/app admin composition/routes, src/shared admin UI/auth helpers, feature admin pages/components/API adapters where confirmed defects occur, src/domain/booking-context/BookingPassengerPicker.tsx for confirmed missing read-permission checks, tests and admin task/design documentation. Do not change backend business rules or create privileged accounts. Public booking flow and existing internal session compatibility must be preserved.

Review: navigation/entry destination, permission and error states, forms/list/detail API contracts, OceVie typography/palette, keyboard and responsive behavior at 390/768/1280/1440. Verify with local QA BE, source controller contracts and existing tests. Mutations only on explicitly isolated QA fixtures, reversible cleanup. Do not infer server capabilities from mocks.

Required: lint, typecheck, build, relevant regression tests, browser checks, report remaining coverage limits.

Baseline status:
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
 M src/main.tsx
 M src/shared/ui/AdminUI.module.css
 M src/shared/ui/Experience.module.css
 M src/shared/ui/admin-v3/AdminShell.module.css
 M src/shared/ui/admin-v3/AdminShell.tsx
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
?? src/features/home/model/asian-ports.ts
?? src/shared/ui/BrandLogo.module.css
?? src/shared/ui/BrandLogo.tsx
?? src/styles/fonts.css
?? tests/booking/ui-api-repair.test.mjs
?? tests/integration/
?? tests/run-unit.mjs
```
