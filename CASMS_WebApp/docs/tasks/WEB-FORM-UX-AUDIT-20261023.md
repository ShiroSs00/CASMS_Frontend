# Form layout and itinerary editor UX

User scope expanded from the itinerary editor to reviewing all WebApp forms for excessive length and inconsistent alignment. UI/layout only; preserve fields, state, validation, permissions, API payloads and previously completed work.

Baseline HEAD `0b1645b`, branch `codex/complete-journey-workflows-20261023`. The booking/service-package source changes, tests and documents from the previous task are pre-existing; retain them. Existing untracked operations/masterdata notes are unrelated.

Allowed paths: this document; src/shared/ui/AdminUI.module.css; existing feature-local CSS Modules used by forms under src/features; src/features/itineraries/components/{StopEditor,DayEditor}.tsx and pages/ItineraryDetailPage.tsx. UI-only className/wrapper adjustments in existing form components are allowed where CSS alone cannot place descriptions/actions or group related inputs. No BE/Mobile/dependency changes or push.

Audit coverage: itinerary/day/stop and port/destination; cruise; ship/deck/cabin; supplier; activity; regulation; operational issues/actions; excursion/tour group; service/product/package/request; booking/passenger/payment/check-in; authentication. Existing short, intentionally single-column or already consistent forms need no gratuitous rewrite.

Acceptance: shared fields cannot stretch labels/controls apart; control heights remain accessible; main data-entry grids align at the top; descriptions/errors/actions occupy full rows; forms keep two columns when their actual container fits them and collapse on narrow surfaces. Itinerary stop editor gains paired date/day inputs, compact secondary details and grouped actions; day editor shares the same field rhythm and full-width notes. No hidden required fields or lost validation. Test representative desktop/tablet/mobile layouts with read-only fixtures. Run lint, typecheck, build and relevant existing tests; report baseline failures accurately.

Temporary read-only UI preview files may live under ignored node_modules/.cache/form-ux-qa; do not commit them or write live business data.

## Result and verification

Reviewed the form surfaces across all listed modules. Updated shared label sizing and eleven feature stylesheets: itineraries, cruise, fleet, supplier, activity, regulation, issues, shore excursions, tour groups, service catalog/request and booking. Existing short authentication and action forms retain their flow and inherit shared Field fixes where used. No business rule, permissions, request serializer or BE/Mobile changes in this task.

Data-entry grids now size their columns using the available container width, with a maximum of two columns, aligned fields and smaller vertical gaps. Textarea descriptions and editor feedback/actions use complete rows. Supplier context no longer adds a separate top offset; relevant save/cancel footers align consistently.

Itinerary editing now gives the stop editor more usable space, pairs port/order, ETA/ETD and arrival/departure day controls, combines timezone help and groups optional destination/call/arrival settings. Diagnostic tools are available in a disclosure. The day editor uses matching spacing, a full-width description, grouped actions and a wide modal. Service-request layout now shares the catalog editor grid and footer. All existing input IDs, state, handlers and validation are retained.

Checks: ESLint, TypeScript and final Vite production build passed; git diff --check passed. Full suite: 351 tests, 311 pass, 39 fail, 1 skip. Comparison against the previously captured clean base 0b1645b confirms the same 39 named failures; no new failing tests. No new test was added for these presentation-only changes.

Browser QA used read-only local fixtures: actual DayEditor, StopEditor and SupplierForm plus the nine other module grid styles with shared fields. Checked widths 1440, 1024 and 390: no document horizontal overflow; two columns on wide containers, one on mobile, paired controls align on the same Y coordinate. Optional stop selections survive closing/reopening the disclosure. These checks cover representative layouts and empty/help/error states, not every live route or server mutation. No live business data was written.

All prior booking/service-package changes and unrelated untracked documents remain intact. No commit or push. Temporary QA harness/server removed after verification.
