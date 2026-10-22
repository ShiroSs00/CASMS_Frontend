# Destination form simplification

Baseline: 38b0d4816c350487e64198b336c7c51bcf7f7399; preserve previous session changes.

Allowed: src/features/itineraries/pages/MasterDataPages.tsx, model/itinerary.ts, api/itinerary-api.ts, components/Itineraries.module.css, this contract. User requests destination create payload with destinationName, countryCode, description and status only. Remove destination geocoding, location suggestions and coordinate inputs; preserve port behavior and update API field restrictions. Keep shared UI controls and improve description layout. No testing, lint, typecheck, build or browser checks.

Follow-up: move destination status/delete actions beside Edit in the page header; remove the standalone action panel and destination validation control. Preserve permission checks and confirmation dialogs. Port actions are outside this request.
