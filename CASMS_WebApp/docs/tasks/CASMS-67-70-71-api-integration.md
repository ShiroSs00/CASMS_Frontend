# CASMS-67 / CASMS-70 / CASMS-71 — Backend integration

Status: IMPLEMENTED — backend search failure remains (2026-10-13)
Branch: feat/CASMS-67-70-71-ship-deck-cabin-ui
Base: 77508ea0f6a577e3cf2505743f3fa116486f546c; initial status clean.
Authorization: user explicitly requested implementation after reviewing backend.

Source: http://localhost:8080/api/v3/api-docs, reviewed 2026-10-13.
Swagger: http://localhost:8080/api/swagger-ui/index.html
Prefix /api; JWT bearer declared, local GET list endpoints currently allow no token.

## Scope

Replace Ship/Deck/Cabin mock reads/mutations/checks with the documented APIs.
Preserve full-width UI, shared sidebar and all existing routes. No changes to
Regulations, Operational Issues, MobileApp, dependencies or package/lock files.
Allowed paths: src/features/ship-deck-cabin/**, src/shared/api/**,
vite.config.ts (dev proxy only), .env.example (public API URL), this new task file.
Remove obsolete mock files; no fallback to simulated data. No new login UI.
No automatic commit/push for this integration.

## Contract notes

- Envelope {success,message,data,error,timestamp}; list requests send page/size
  only (user explicitly requested no sort string).
  Existing filters operate across all retrieved pages, not just the first page.
- POST create, PATCH update, DELETE /{kind}/{id}/unused handles HTTP 204.
  Backend determines deletion eligibility and state-transition policy.
- Ship update excludes shipCode/status, Deck excludes shipId; Cabin update only
  cabinType/capacity/isAccessible. DTOs have no version; Cabin has no timestamps.
- Ship availability and affected-cruises require ISO-8601 start/end.
- Cabin availability takes no dates; capacity-check uses requiredCapacity,
  compatibility-check uses requireAccessible. Search POST has CabinSearchRequest.
- Status POST query status; block query reasonStatus OCCUPIED or MAINTENANCE
  per operation description (the published enum is broader); release no body.
- POST validate has no body. Deck validate-ship uses shipId query.
- Errors, including failed boolean checks, never become positive results.
- Observed current-cruise empty response: HTTP 404 with error exactly
  "No active cruise found for ship currently". Only this response maps to no
  current cruise; other 404/auth/server errors remain visible.

## Validation

Run lint/typecheck/build and verify real read-only UI requests. No mock test
harness requested; do not write to existing backend records for verification.
Report unverified write endpoints and environment/auth limitations accurately.

## Delivery evidence

- Removed mock adapter/fixtures from this feature; no simulated fallback.
- Connected CRUD/status/block/release, validation, summary/history, checks and
  available search with exact DTO/parameter mapping. GET lists send no sort.
- Local Vite proxy /api → localhost:8080 verified by the running UI.
- lint, typecheck, build: PASS. No new dependencies or mock test harness.
- Browser reads: real SH-001 / Ocean Voyager; detail and capacity summary;
  readiness false shown as not ready; no-current-cruise shown as empty;
  edit form immutable code/status; Deck/Cabin empty lists; cabin create guard
  when the selected ship has no decks. No backend record was mutated.
- At the time of read-only verification, backend contained one ship, zero decks,
  zero cabins. Record-specific
  Deck/Cabin detail and write success paths have not been exercised live.
- Confirmed backend issue: POST /api/cabin/search returns HTTP 500 and
  {success:false,error:"Internal server error"} for both {} and a request with
  existing shipId plus minCapacity=1. UI displays error/retry, never empty success.
- Write endpoints and authenticated environments still need live validation.
- Integration is delivered on the feature branch; no merge into main performed.
