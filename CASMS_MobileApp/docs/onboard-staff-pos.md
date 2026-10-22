# Onboard staff mobile workspace

Route: `/staff-pos`. Uses unchanged upstream BE `e6978f7`; no backend source or role permissions were edited.

After login, `ONBOARD_STAFF` goes directly to the staff workspace through `/loading`, without loading the passenger itinerary. Opening a passenger tab with this role also redirects to staff. Passenger navigation is not rendered inside staff POS.

The workspace verifies `/auth/me`: the identity must match the current session, the account must be ACTIVE, and the roles must include ONBOARD_STAFF. Data calls and actions require actual effective permissions. An ADMIN-only session is not silently treated as ONBOARD_STAFF. Logout clears session and query caches; forms remount for a different owner. Mutations are never automatically retried.

## Implemented with existing APIs

- Product list/search, creation, editing and lifecycle actions via `/servicepackage/products` and `/products/{id}/status/{action}`.
- New products start ACTIVE as defined by BE. INACTIVE products can be activated; ACTIVE products can be discontinued. There is no reactivation control for DISCONTINUED products because BE does not support that transition.
- Product fields: code, name, category/type, description, unit price and explicit currency. Prices accept up to nine integer digits and four fractional digits. No client-calculated charges are submitted.
- Staff request queue via `/servicepackage/requests`; service names from `/servicepackage/services`. Filters cover outstanding requests, requests assigned to the current staff member, and all returned requests.
- Actions use `/servicepackage/requests/{id}/actions/{action}`: assign to self, accept/reject, start, complete. The UI only offers start/complete on the current staff member's assignments. Confirmation is required for each action, and pending sheets cannot be dismissed or submitted again.
- Completed timestamps and statuses come from BE. Request details do not invent passenger names or cabin numbers: the current response contains identifiers but lacks those display fields.

## Current backend limits

This is the staff product and service workspace that the current BE supports. Product sales still return 501. Payment and invoice endpoints are not implemented. There is no cart/checkout, sale recording, receipt, paid-state simulation or charge-to-cabin button in this workspace.

The staff request endpoint returns all rows authorized by BE; there is no ship-scoped queue contract here. The screen does not claim the list belongs only to a selected vessel. BE is authoritative for permissions and transitions; the current assign implementation can reassign a REQUESTED row, so concurrent staff claims need server-side arbitration from the BE owner.

## QA

Only the isolated `casms_mobile_qa` database is used. Apply `tests/integration/seed-onboard-staff.sql` with the existing QA helper after starting the QA backend.

```powershell
python tests/integration/qa_database.py --file tests/integration/seed-onboard-staff.sql
node --test tests/staff-pos.test.mjs
node --test tests/integration/staff-backend.test.mjs
```

Test-only login: `ocevie.staff.qa` / `OcevieStaffQa@2026`. Seed assigns the existing ONBOARD_STAFF role without modifying its permissions. Credentials are for local QA only.

Verified: 57 unit tests, two real staff HTTP tests (product create/edit/discontinue and full service lifecycle), TypeScript and lint. The web production export passed React Compiler and generated 31 routes including `/staff-pos`. Existing passenger HTTP tests remain separate.

Browser QA: actual staff login routed to POS; a persisted passenger QA request went through assign/accept/start/complete; completed request search worked. The product form rejected missing required fields, created a product, then updated its description and unit price to exactly 20 USD. An automated review blocked a save while the QA price was mistyped; the price was corrected and visibly verified before the successful save. Screens were checked at 320 px and 390 px widths. Screenshots are in `.expo/staff-pos-qa/`.

Native keyboard, safe areas, device performance and hardware back require real-device follow-up; browser QA and web export do not certify them.

## iPhone LAN test configuration

The local QA API is currently `http://192.168.1.5:18080/api`. Expo runs in LAN mode on port 8084; open `exp://192.168.1.5:8084` in Expo Go on the same Wi-Fi. The public API URL is stored in ignored `.env.local` and explicitly passed to the current Metro process. If DHCP changes the computer IP, update that local environment value and restart Metro.

The previous localhost mode bound Metro to `::1` and used `127.0.0.1` for API calls, which cannot reach the computer from iPhone. Both servers now listen on the LAN; API login via `192.168.1.5` returned 200, and the iOS manifest advertises `192.168.1.5:8084`. A physical iPhone connection still depends on the same Wi-Fi and iOS Local Network permission. No firewall or backend source was changed.
