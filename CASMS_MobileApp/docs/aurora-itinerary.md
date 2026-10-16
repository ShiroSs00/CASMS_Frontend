# Aurora Passenger mobile

Voyage Editorial uses #123042, #4B8AF1, #D4A84F and #F5F2E9 across Splash,
Login, Loading, Home, itinerary sheets and the floating navigation dock.
Reduced motion disables decorative movement. Tabs remain mounted and switch
without a page fade; a shared active pill springs between destinations.

## iPhone / Expo Go

Run `npm start -- --go --lan --port 8081` and scan the QR with the iPhone camera.
Both devices must share a network. BE runs on port 8080 with context path /api.
In development the API host is derived from Expo; override EXPO_PUBLIC_API_URL
in ignored .env.local when required (see .env.example). Never put a password
or JWT in EXPO_PUBLIC variables.

Live login posts credentials to BE. Native sessions use SecureStore; browser
previews keep tokens only in memory. Passwords are not persisted. Loading waits
for the live catalog; Home then displays available information or an error.

The development-only demo action opens isolated fictional scenarios without
authenticating or calling operational services. Scenarios include schedule changes,
cancellations, substitutions, sea days and empty/error states. These do not
represent real passenger records.

## Live scope

Home selects an itinerary from BE and fetches its linked cruise by ID. Itinerary
supports day/stop views, port times, all-aboard time, excursion/group details,
ship timezone and change history. These are read-only views. Shared results do
not establish personal bookings or assignments. Other tabs show unavailable
information until their feature APIs are integrated.

See [permission handoff](temporary-passenger-api.md) for the official permission
set, 401/403 behavior, verified endpoints and remaining BE gaps. Temporary scripts
are retired; the official initializer owns role permissions.

## Validation

- `npx tsc --noEmit`
- `npm run lint`
- `node --test tests/*.test.mjs` (Node 22.18+ for TypeScript type stripping)
- `npx expo export --platform ios --output-dir .expo/aurora-ios-preview`

Display name is Aurora. Expo slug and URL scheme retain their existing IDs.
Native display-name/splash updates require a new native build.
