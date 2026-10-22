# Module map

| Area | Location | Responsibility |
|---|---|---|
| App | src/app | Routing, public/admin layouts, cross-feature composition |
| Auth | src/features/auth | Login, session refresh/logout and guards |
| Home | src/features/home | Editorial Asian port photography and catalog entry |
| Booking | src/features/booking | Public catalog, booking draft, create/lookup and account booking views |
| Fleet | src/features/ship-deck-cabin | Ships, decks, cabins and supplementary resource states |
| Cruise planning | src/features/cruises, src/features/itineraries | Cruises, itineraries, days, stops, ports and destinations |
| Operations | src/features/operational-issues, src/features/regulations | Issues and regulation assignment/lifecycle |
| Shore | src/features/suppliers, src/features/shore-excursions, src/features/tour-groups | Suppliers, excursions, groups and passenger assignments |
| Onboard | src/features/activities, src/features/service-packages | Activities, packages, products and service requests |
| Domain | src/domain/booking-context | Validated shared booking identity/context |
| Shared | src/shared | Transport, access state, common UI and formatting |

Preview/mock adapters are test/editorial tools; canonical booking routes use live API adapters. Register/reset/verification concepts and online payment/check-in/boarding capabilities are not implemented server integrations.
