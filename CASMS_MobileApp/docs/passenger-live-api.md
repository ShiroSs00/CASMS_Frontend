# Mobile passenger API integration

Current state: 21 October 2026. FE branch: `feat/mobile-passenger-live-api`.
BE baseline: unmodified `main` at `e6978f7`. Scope is FE only.
Upstream fixed the previous cabin-query PostgreSQL failure. Six real HTTP integration tests passed against this revision on isolated QA. See [the update audit](backend-mobile-audit-2026-10-21.md) for new pricing fields, public discovery routes and the passenger 3D permission blocker.

## Runtime

The application requires a real authenticated session. There is no demo entry,
fake sign-in, mock itinerary, sample spending, placeholder QR or client-generated
passenger/booking data. Historical fixtures live under tests only and are not
imported by src. The API origin comes from EXPO_PUBLIC_API_URL.

The five destinations are Home, Itinerary, Bookings, Services and Account. Unsupported
QR/check-in/spending actions are absent from navigation. Old links redirect to a
supported destination. Password recovery provides contact guidance rather than an
unimplemented submission. The notification button reads actual itinerary history;
it does not pretend to deliver push notifications.

## Existing contracts used

All routes below are relative to the configured /api origin.

| Feature | Routes |
| --- | --- |
| Session | POST /auth/login, POST /auth/refresh, GET /auth/me |
| Bookings | GET /booking, GET /booking/{id}, POST /booking, POST /booking/{id}/cancel |
| Cruise/cabins | GET /cruise?status=PUBLISHED, GET /cruise/{id}, GET /booking/available-cabins?cruiseId=... |
| Itinerary | GET /itineraries, GET /itineraries/{id}, GET /itineraries/{id}/days |
| Stops/tours | GET /cruise-stops/by-itinerary/{id}, GET /shore-excursions?cruiseStopId=... |
| History | GET /itinerary-change-history/itineraries/{id} |
| Groups | GET /tour-groups?excursionId=..., only with actual TOUR_GROUP_READ |
| Services | GET /servicepackage/services, GET /servicepackage/services/{id}/availability?quantity=... |
| Requests | GET/POST /servicepackage/requests, PUT /servicepackage/requests/{id}, POST /servicepackage/requests/{id}/cancel |
| Activities | GET /activities, GET /activities/{id}/availability |
| Registrations | GET /activities/registrations, POST /activities/{id}/registrations or /activities/excursions/{id}/registrations |
| Registration changes | PUT /activities/registrations/{id}, POST /activities/registrations/{id}/confirm or /cancel |
| Packages | GET /servicepackage/packages, GET /servicepackage/packages/{id}/benefits |
| Own assignments | GET /servicepackage/package-assignments, with NO bookingId query for passengers |
| Package changes | POST/PUT/DELETE /servicepackage/package-assignments/{bookingPassengerId} |

The own-assignment response is filtered to real bookingPassengerId values from the
selected booking detail. Sending bookingId is intentionally forbidden by BE for
passengers; the app does not request staff access or relax ownership checks.

## Identity and behavior

Effective permissions come from /auth/me and must match the current user. Personal
screens reject staff/mixed roles because staff list routes can return other users'
records. Session changes clear query caches and remount private forms. A late 401
from an old token cannot expire a new session. 403 is separate from empty data.

userId, passengerId and bookingPassengerId are distinct. All writes use entity IDs
from actual reads. New service requests require an active passenger row in an owned Confirmed booking.
The services screen has no standalone account scope; request history is filtered by
the selected booking. Create and edit check current service availability before writing. Activities/tours require
an Active passenger in a Confirmed booking. Package editing requires Draft status.
Backend ownership, capacity and lifecycle validation remain authoritative.

Writes are not automatically retried. Forms block repeated submission and dismissal
while pending; queries are invalidated after the outcome. Bookings are created as
Draft, with server-provided fare, deposit and installment data. There is no fake
payment or confirm-booking button: those BE payment/confirmation semantics are
not sufficient for a completed purchase. Package prices are not used to overwrite
the booking fare on the client.

## Asian itineraries and clocks

There is no hardcoded port, country or regional filter in the app. Itinerary names,
port names, destinations, dates and ship time zones come from BE. Each itinerary
day uses shipTimeZoneId. Missing/invalid zones are visibly identified with UTC
fallback. Booking/activity timestamps include the UTC offset. History uses device
time with a visible zone label; it is not forced to Vietnamese time. Currency
formatting uses the code in each API response.

## Validation

See [real-api-qa.md](real-api-qa.md) for the isolated PostgreSQL/Spring setup,
seed account and executable tests. Six real HTTP integration tests passed on upstream
`e6978f7`. The earlier experimental BE repository test was removed and is not part
of current verification. Native device FPS, keyboard, large-text and hardware-back
checks remain device follow-ups.
