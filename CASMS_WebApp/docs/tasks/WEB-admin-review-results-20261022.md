# Admin review and repair results

Scope: WebApp only. All changes from prior branding/UI/API tasks preserved. No Mobile App or backend source edits, account/role grants, commits or pushes.

Confirmed fixes:
- /admin previously redirected every staff account to /admin/ships, producing 403 for onboard staff. It now opens a neutral OceVie overview with available tools derived from effective permissions, with no invented business metrics.
- Sidebar now distinguishes missing read permission from unavailable server functionality. Mappings follow backend list controller annotations; public cruise/itinerary/package catalogs remain accessible. Multi-authority service request and assignment endpoints use any-match checks. Loading/error states do not expose protected links.
- Sidebar previously occupied up to 40dvh on small screens. Added an accessible toggle at <=900px, hidden collapsed navigation, and route-specific state that closes it after navigation. Desktop width remains 248px.
- Ship list previously always offered Tạo tàu. It now requires SHIP_CREATE.
- BookingPassengerPicker attempted protected booking reads even for staff with only package/registration permissions. A permission-aware wrapper now shows loading/error/missing BOOKING_READ states before mounting queries. Existing context, selection and server checks stay intact.
- Admin page titles identify the current section.

Checks: npm run lint, npm run typecheck, npm run build passed. npm test: 286 passed, 1 opt-in integration skipped, 0 failed. Six regression cases added for neutral entry, permission-aware navigation, unavailable/loading/error permissions, picker query suppression/delegation and ship creation visibility. git diff --check passed (existing CRLF normalization warning only).

Live browser checks against existing isolated local QA BE through http://127.0.0.1:5175/api:
- Login with existing limited onboard QA staff; /admin now shows overview rather than ship access error.
- Loaded and awaited 13 admin list screens. Destinations 4 rows; ports 4; cruises 1; itineraries 1; suppliers 1; shore excursions 1; tour groups empty; activities 1; services 3; products 1; packages 1; requests 8. Package assignment list loads but its picker correctly explains missing BOOKING_READ after the fix (no false empty booking list).
- Product create form: blank submit shows three errors, focuses name, marks invalid fields, and performs no write. At 390px no document overflow.
- Overview checked at 390/768/1280/1440px: no document overflow; navigation hidden by default at 390/768 and visible at desktop. Opening menu and selecting Dịch vụ closes it after navigation. Services table retains its own horizontal scroll.

Limits: existing QA staff lacks fleet/regulation/operational issue/booking read permissions. Full privileged CRUD was not exercised, and no permissions were granted to obtain it. Normal database migration blocker remains documented in development.md; BE uses the already-running isolated QA database. Existing backend uncommitted files are unchanged.

Screenshot: webapp-admin-ocevie-after.jpg in this task visualization directory.
