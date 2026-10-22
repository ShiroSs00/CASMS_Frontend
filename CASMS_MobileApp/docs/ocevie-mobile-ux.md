# OceVie mobile navigation and experience

The application uses the existing OceVie logo, pearl/navy/teal/gold palette,
shared safe-area scaffold, 20 px cards, 14 px buttons and Vietnamese system fonts.
Copy is concise; technical API labels and implementation explanations are excluded
from passenger flows.

| Destination | Route | Purpose |
| --- | --- | --- |
| Trang chủ | /home | API voyage summary and supported actions |
| Hải trình | /itinerary | API days, ports, excursions and history |
| Đặt chỗ | /bookings | Own booking list, cabin/passenger detail and draft creation |
| Khám phá | /services | Service catalogue and personal requests |
| Cá nhân | /account | Actual session identity, activities/packages and support |

The centered destination is Bookings. QR, check-in and spending placeholders have
been removed from navigation until usable backend contracts exist. No demo session
or mock data can be enabled in the app. Historical fixtures are test-only.

Detail screens have a back action and retain tab state. Sheets share one cancellable
opacity/transform transition, retained exit content, a scrollable body and native
keyboard avoidance. Pending writes lock submission and dismissal. Expanded itinerary
sheets reset scroll position when switching their nested view. Reduce Motion is
observed through one application-level OS subscription.

Asian port names and day-specific ship zones come from the API. Currency follows
the server response. See [passenger-live-api.md](passenger-live-api.md) for contracts,
[ocevie-motion-qa.md](ocevie-motion-qa.md) for motion findings and
[real-api-qa.md](real-api-qa.md) for the PostgreSQL integration workflow.
