# BE update audit for mobile — 21 October 2026

Pulled `origin/main` with fast-forward from `ef59dd2` to `e6978f7`.
No backend source was edited. Existing local build metadata and `run-backend.bat` were preserved.
Source contracts and real HTTP were checked against the isolated PostgreSQL QA database.

All routes below are relative to `/api`.

## Confirmed product scope

The passenger app is used after a completed booking and account provisioning. It is not a cruise storefront. Public cruise/package discovery, available-cabin search, cabin price comparison, booking creation and draft package selection are outside this app's intended journey. Their technical availability and test results below do not make them passenger-app features.

For this upstream update, no newly added endpoint is immediately ready to add to the post-booking passenger journey. Existing authenticated trip details, assigned cabin, itinerary, service requests and activity/excursion registrations remain relevant. Read cruise details only for the passenger's assigned voyage, rather than browsing unrelated published cruises. Package entitlements must come from the passenger's actual booking/assignment.

The 3D model read endpoints could support an onboard map, but ordinary passengers currently receive 403 because `SHIP_READ` is absent. BLE x/y/z localization is still unavailable. Neither should be presented as a working passenger feature.

Existing FE booking-creation, draft-booking and package-sales entry points need a separate implementation pass to align with this clarified scope. This audit did not remove or redesign those screens, and does not claim that the current UI already follows the post-booking-only journey.

| Mobile area | New behavior | Integration assessment |
| --- | --- | --- |
| Available cabins | `GET /booking/available-cabins?cruiseId=...` now casts nullable query parameters explicitly | Upstream fix addresses the previous PostgreSQL parameter inference failure; needs HTTP regression verification |
| Cabin price | Same response adds `priceMultiplier` and `estimatedPrice` | FE can display the server estimate per passenger; current FE does not yet consume these fields |
| Booking fare | `POST /booking` calculates base cabin fare multiplied by the deck multiplier for each passenger | Use server booking totals; do not calculate a replacement fare in FE |
| Cruise discovery | `GET /cruise` and `GET /cruise/{id}` permit anonymous access at both security layers | Anonymous users see published cruises; authenticated callers still need `CRUISE_READ` at the method layer; default passenger initialization includes it |
| Package discovery | `GET /servicepackage/packages` and `GET /servicepackage/packages/{id}` permit anonymous access | Anonymous users see active packages; authenticated callers need `TOUR_PACKAGE_ASSIGN` or `TOUR_PACKAGE_MANAGE`; default passengers have the former |
| Package benefits | `GET /servicepackage/packages/{id}/benefits` unchanged | Still requires package permission; not a new anonymous endpoint |
| Model 3D | `GET /ships/{shipId}/model` returns the active model | Requires `SHIP_READ`, absent from default passenger permissions; cannot yet expose to ordinary passengers |
| Model details | `GET /ships/{shipId}/models/{modelId}` now returns `ShipModelAssetResponse` | Changed response contract: metadata includes `baseUrl`, `manifestUrl`, units, up axis, deck/cabin counts and mapped counts |
| Model assets | `GET /ships/{shipId}/models/{modelId}/assets/{assetPath}` streams GLB/JSON | Requires `SHIP_READ` and JWT, including asset requests; supports downloading model files from BE |
| Model mapping | `GET /ships/{shipId}/models/{modelId}/deck-mappings` and `/cabin-mappings` | Requires `SHIP_READ`; returns model node IDs mapped to real database UUIDs |
| BLE | Migration adds `LocationDevice.calibrated` | No changed BLE controller or new x/y/z localization endpoint in this update |

Upload, register, mapping replacement and activation routes require `SHIP_UPDATE` and belong to administration, not the passenger app. Model-list permission remains `SHIP_MODEL_READ`, distinct from the new asset read routes.

The current passenger FE already calls cabin discovery, cruise discovery and package catalog APIs. No new screens or application code were added during this audit.

## Follow-up verification

1. Run the existing real HTTP integration suite against the new BE and isolated PostgreSQL QA.
2. Check cabin results with omitted filters and each cabin type; verify the new price fields and booking totals.
3. Check anonymous cruise/package discovery and authenticated passenger access separately.
4. For passenger 3D access, ask the backend owner for the intended permission/ownership contract; do not grant staff permissions from FE or test seeds.

## Verified HTTP results

BE `e6978f7` started on port 18080 against isolated QA only. The unchanged upstream V10 migration was applied to that database to add the deck multiplier (Hibernate update alone could not add a non-null column to existing deck rows). No production database or BE source was changed.

- Existing real-backend suite: **6/6 passed**, including booking creation/cancellation, service persistence, activity/excursion registration and package assignments.
- Anonymous `GET /cruise`: **200**.
- Anonymous `GET /servicepackage/packages`: **200**.
- Passenger cabin discovery with omitted optional filters: **200**; returned all four types with multiplier 1.00 and estimates 300/450/650/1100 in the QA seed.
- Passenger `GET /ships/{shipId}/model`: **403**, matching the missing `SHIP_READ` permission.

The first integration attempt preceded server readiness and failed to connect; the completed run after readiness passed all six tests. A multiplier other than 1.00 and actual GLB streaming with an authorized model were not runtime-tested in this audit.

The previous audit's successful six HTTP tests and two repository tests used an experimental local backend patch that was later reverted. They do not certify this upstream revision. The experimental repository test is no longer part of BE.
