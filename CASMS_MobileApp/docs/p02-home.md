# P02 · Passenger / Trang chủ

Implemented in Mobile on feat/p00-p01-p02 at the user's request. The pasted
design-only template is overridden by the explicit request to code the screen.
This remains a UI prototype for Expo Go; no API, actual session, camera or APK.

The supplied fictional Minh Anh / Ocean Aurora / cabin 802 / Ocean Comfort /
12–15 October 2026 / 350.000 ₫ data lives in home-model.ts. Home labels it as
illustrative data. It is not a restored passenger account and is not persisted.

Login's prototype success now opens the P02 Home screen. Home shows the cruise,
QR action, pending check-in, today's event, services and spending. The top bar
and five-destination navigation stay fixed; only content scrolls. Top and bottom
safe areas are respected. All colors use the existing Passenger light roles.

State previews at /home?state=loading|empty|error|offline|success|disabled|expired:
- Loading: skeleton, actions locked, no passenger information.
- Empty: no assigned cruise, support action, cruise/navigation actions locked.
- Error: no passenger information, retry returns to the default local preview.
- Offline: demo cruise and an explicitly illustrative last-update timestamp.
- Success: discreet confirmation; the completed check-in row is disabled.
- Disabled: unavailable QR button with explanation; QR view also has no pass.
- Expired: no name/cruise/cabin/spending, locked actions, login CTA with expired state.

Notifications, cruise details, itinerary, services, spending, QR and check-in
routes provide navigation previews until their screen/API contracts arrive.
The QR view does not generate a usable pass; check-in does not submit a profile;
the spending view does not invent transactions. Navigation and back actions work.
No camera permission is requested automatically or by any of these previews.

Validation:
- TypeScript and ESLint for app routes, Passenger components and Home: passed.
- Web export and iOS Hermes bundle export: passed.
- Browser: 393 x 852 visual check; 412 x 892 has no horizontal overflow. Bottom
  navigation stays fixed on scroll and spending is reachable above it.
- QR, notifications/back, check-in, all tab routes, expired login CTA, local
  retry and empty-state support navigation: passed.
- All seven alternative states checked; expired Home renders no passenger name,
  cruise, cabin or spending. Active tab is exposed as aria-selected.
- Full-app lint still reports the existing set-state-in-effect error in the
  unchanged src/hooks/use-color-scheme.web.ts template hook.
- No emulator/device verification or APK build.

## Navigation correction

The five destination routes now live in src/app/(passenger)/ under a real Tabs
navigator, preserving their public URLs. The navigation bar is mounted once.
Tab selection uses the navigator rather than replacing root Stack pages; screens
are preloaded and retained so Home state and its scroll position survive switches.
Tab transitions cross-fade for 200 ms with standard easing, disabled under Reduce
Motion. Stack detail screens still support normal back navigation.

Home content links select existing tabs. Detail navigation returns to the existing
tab group. Preview lock state is read from Expo Router's active URL parameters,
and retry synchronizes those parameters to unlock the bar. The custom tab bar is
rendered as JSX to remain compatible with the enabled React Compiler.

Browser regression: Home scroll offset retained at 54 px across a tab round-trip;
all five tabs switch; detail return has exactly one bar; expired actions remain
locked; retry unlocks the bar. No native device/emulator was used.
