# Passenger API permission handoff

Superseded by the official backend permission initializer in commit `042d7bc`
(`update/ role permession for passenger`), verified locally on 2026-10-15.
No temporary database grants or rollback are required. Backend source was not
edited by the mobile integration.

## Official PASSENGER permissions

- BOOKING_READ
- CHECKIN_CREATE, CHECKIN_READ
- CRUISE_READ, ITINERARY_READ, ITINERARY_DAY_READ, CRUISE_STOP_READ
- ITINERARY_CHANGE_READ, PORT_READ, DESTINATION_READ
- ACTIVITY_READ, ACTIVITY_REGISTRATION, EXCURSION_READ, EXCURSION_BOOKING
- NOTIFICATION_READ, PAYMENT_PROCESS

The initializer now saves the complete role permission set at startup. This
supersedes the earlier four temporary read grants. Do not run manual permission
INSERT/DELETE statements or the retired rollback SQL.

## Mobile behavior

Login supplies roles, but no effective permission list. Mobile does not infer
grants from a hardcoded role map: BE remains authoritative for each request.
403 shows a section-specific access message without logging out or presenting an
empty result. 401 expires the session. Network and server failures stay distinct
from permission denials. Account changes clear cached responses.

Connected live features: login/refresh/local logout, itinerary selection, cruise
detail, days, stops, change history, excursions and group information. Groups load
when opened. Mobile itinerary/tour/group operations are GET-only. No management,
start/complete, attendance or passenger roster action is exposed. Booking, check-in,
registration, notifications and payments need separate feature integration even
though the role has related permissions.

Selections browse shared BE results; they do not establish a passenger booking
or personal group assignment. User ID must never be treated as passenger ID.

## Verified behavior and remaining BE gaps

The test identity had only PASSENGER. Itinerary list/detail/days/stops/history,
cruise detail, ports, destinations and filtered excursions returned HTTP 200.
GET /ships returned 403; anonymous GET /itineraries returned 403.

- GET /cruise and unfiltered /tour-group-passengers returned 500 due to SQL null
  parameter type inference. Mobile fetches cruise by itinerary.cruiseId and does
  not call either failing list endpoint.
- Cruise/itinerary lists are not scoped to a passenger booking or published status.
  Draft local fixtures may appear. FE does not claim ownership.
- Tour/group management controllers lack operation permission checks. Hiding
  these operations in FE does not secure them; BE must enforce staff permissions.
- Original local fixtures are drafts without a confirmed passenger booking or
  personal assignment. Credentials and fixture IDs stay in ignored .expo files.

Reverify when BE changes permissions or adds passenger-owned endpoints.
