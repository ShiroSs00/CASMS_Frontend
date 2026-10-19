# OceVie mobile navigation and experience

The passenger app groups daily tasks into five persistent destinations. The boarding pass occupies the center position so it remains easy to reach throughout a voyage.

| Destination | Route | Purpose |
| --- | --- | --- |
| Trang chủ | `/home` | Voyage summary, daily activities, check-in and assistance |
| Hải trình | `/itinerary` | Days, ports, shore excursions and published changes |
| Thẻ lên tàu | `/passenger-qr` | Issued-pass state and boarding preparation |
| Khám phá | `/services` | Searchable editorial introductions to onboard experiences |
| Cá nhân | `/account` | Identity, voyage information, spending and support |

Spending is a stack detail at `/spending`, reached from the account tab. Voyage information, notifications, check-in and support are also stack details. They use a back action without repeating the tab bar. Switching tabs preserves the selected itinerary day and discovery filters.

## Shared presentation

`PassengerScaffold` handles safe areas and contextual headers. `PassengerUI` provides section headings, empty states, search, filters and dismissible sheets. Existing itinerary actions and data queries are retained. The approved OceVie logo assets and centralized brand tokens supply the visual identity. System fonts provide offline Vietnamese text support.

## Data boundaries

- Live itineraries, tours and history use the existing API and permission handling.
- Demo voyage details, activities and spending remain explicitly marked as examples.
- Discovery cards are editorial guides, with no invented prices, availability or booking confirmation.
- Boarding passes remain unissued until a real QR integration is available.
- Support provides static guidance. Official contact numbers and desk locations are not invented.
- Password recovery and online check-in explain the available next step without submitting unsupported requests.

## Validation

Run `npm run lint`, `npx tsc --noEmit`, and `node --test tests/*.test.mjs`. The discovery tests cover Vietnamese accent normalization and combined search/category filtering. Browser review covers small and large phone widths, tab state retention, stack back behavior, empty search results, service and notification sheets, FAQ expansion and cancellation of sign-out.

Native device verification remains necessary for keyboard behavior, safe areas, hardware back and screen readers.
