# WebApp repair verification — 2026-10-22

## Delivered

- Hero slideshow with real Singapore, Hong Kong and Yokohama port photographs. Local optimized WebP assets, per-slide credits, full license page, previous/next/direct selection, pause, focus/hover/hidden-tab pausing and reduced-motion support. The home editorial sections use the same credited Asian port collection.
- Sharper login artwork and consistent OcvViet branding.
- Guest cruise details now call the public ship, itinerary, days and port-call APIs. Restricted endpoints retain backend authorization.
- Public package benefits render included versus optional component counts from the actual DTO. Backend does not return public component names in this response, so the UI does not invent them or request protected resources as a guest.
- Package currency is checked in the UI and refreshed before booking POST. Changed/removed/cross-currency packages cannot be submitted. A failed preflight read is a safe retry, since booking has not been sent.
- Configurable dev API origin using CASMS_API_PROXY_TARGET, default 127.0.0.1:8080.
- Admin feature routes load through public module entries on demand. Main JS chunk reduced from about 956 kB to 379.35 kB (gzip 107.54 kB), with no oversized-chunk or ineffective-import warning in the final build. Booking session state remains mounted for its existing navigation behavior.
- Repaired stale imports, modal-footer traversal, old label/identifier expectations and cruise fixtures in tests, retaining the behavioral assertions. Added package/currency regression coverage and an opt-in live QA test.
- Restored the documentation referenced by AGENTS.md; added portable npm test/test:live commands and the guarded QA backend launcher.

## Checks

| Check | Result |
|---|---|
| npm run lint | Pass, zero warnings |
| npm run typecheck / build typecheck | Pass |
| npm run build | Pass |
| npm test | 280 pass, 0 fail, 1 intentionally skipped live QA test |
| Explicit live QA test | Pass, 16 requests via http://127.0.0.1:5175/api |
| git diff --check | Pass |
| Browser public flow | Home, slideshow, catalog, ship/itinerary/4 stops, cabins and package benefits verified against running BE |
| Browser authentication/admin | QA onboard staff sign-in and live service list verified; no browser errors on this flow |
| Responsive | Home/lookup checked at 390 px, home at 1440 px; no horizontal overflow at those measured sizes |

The live test signs in as the seeded passenger, creates one draft booking (HTTP 201), reads it, looks it up anonymously, cancels it (HTTP 200), and verifies cancellation. Test reference: BK-20261022-B9AF. It performs no payment or confirmation. Fixture browser scripts were updated for the new public API behavior; the entire historical browser-script suite was not run.

## Runtime and limits

- WebApp remains at http://127.0.0.1:5175/.
- BE remains at http://127.0.0.1:8080/api using the isolated PostgreSQL casms_mobile_qa database on port 55432.
- The normal casms database startup failed migration V4 because its RolePermissionMapping_permission_check constraint does not admit all rows seeded by the current migrations. Backend source/migrations were not changed. QA uses the existing development workflow with Flyway disabled only for the isolated QA database; this is not a repair of normal migrations.
- No dependencies/lockfile or mobile sources changed. No commit or push was performed, including no backend push.
- Unsupported payment/check-in/boarding/reset capabilities remain explicitly unavailable until matching backend APIs exist. Full privileged CRUD across every admin module was not exercised against live data.
