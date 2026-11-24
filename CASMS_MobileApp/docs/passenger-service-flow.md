# Passenger onboard service requests

This screen serves passengers after booking. It uses the existing service-request APIs, not the unimplemented product POS or payment endpoints.

- A new request requires an active passenger from a confirmed booking. The mobile API adapter rejects a missing bookingPassengerId before HTTP.
- The selected booking determines which request history is visible. Standalone historical requests are not presented as requests for that voyage.
- The active service catalog supports search and displays backend prices/currencies.
- Confirmation shows service, passenger, cabin and unit price. Quantity must be a positive 32-bit integer within the service capacity when configured; notes are limited to 500 characters.
- Creation and editing check the service availability endpoint before sending the write. BE remains authoritative if availability or status changes afterward.
- Only REQUESTED requests can be edited; REQUESTED or ACCEPTED requests can be cancelled. Completed timestamps are displayed when provided.
- Service creation does not mean payment or an issued invoice. There are no cart, charge-to-cabin or payment calls.
- Pending actions cannot be dismissed or submitted twice. Mutations do not automatically retry; errors remain visible and successful writes refresh personal queries.

## A0-FE validation

Unit tests cover validation, scheduled requests and operation-key recovery.
Run `npm test` independently. Run the real service lifecycle suite only after the
QA team confirms the API and fixture, as described in [real-api-qa.md](real-api-qa.md).
Passenger service request cancellation continues to use its own API. Booking
cancellation is handled outside Mobile and has separate contact guidance.
