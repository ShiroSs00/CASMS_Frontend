# Ship Manager after model import

User requests ship management for SHIP_MANAGER and removal of manual ship creation for that role. Preserve the separate ADMIN import feature and previously hidden ADMIN fleet navigation.

User follow-up: keep only the fleet sidebar group for SHIP_MANAGER; hide operations/compliance, destinations/partners and schedule groups from that role's navigation. This extends the allowed navigation change to roleNavigationItems; backend grants and other roles remain unchanged.

Additional user requirement: standalone deck and cabin management pages must require explicit ship selection before showing any deck/cabin records. Use ship-scoped endpoints only; never fetch the global structure snapshot. Switching ships remounts the inventory and resets filters, pagination, dialogs and data.

Latest navigation instruction supersedes the fleet disclosure: SHIP_MANAGER has four direct items labelled Dashboard, Ship, Deck, Cabin. Add a fleet dashboard route and use it as the Ship Manager home. Allowed paths extend to src/app/router.tsx and src/shared/ui/admin-v3/AdminShell.tsx for these explicit navigation changes. Other roles retain their existing menus/home routes.

Also allow the single Ship Manager navigation expectation in tests/ship-model-import/import.test.mjs to match the explicitly requested direct menu instead of the earlier fleet disclosure; preserve the import/access test intent.

Baseline FE 88ab1f440ac3fefbe5b1b2a29b676b06e2ee3e01. Pre-existing edits: router.tsx, shared/api/client.ts, AdminShell.tsx, admin-navigation.ts; untracked ship-model-import feature/tests and import/operations task docs. Preserve all. BE 660e891 has pre-existing local entity/config/permission edits; do not edit BE or mobile.

Allowed: src/features/ship-deck-cabin/**; src/shared/ui/admin-v3/admin-navigation.ts (manual creation route policy); tests/ship-deck-cabin/**; tests/admin/admin-access-regression.test.mjs (manual creation expectation only); this contract. No dependencies, lockfiles, broad auth changes or migrations.

API sources: current ShipController, DeckController, CabinController and services. Cabin PATCH accepts capacity/isAccessible and rejects cabinType and model geometry. OCCUPIED comes from passenger assignment; block supports MAINTENANCE/OUT_OF_SERVICE. Keep backend SHIP_CREATE for manifest registration; deny /admin/ships/new to SHIP_MANAGER, including combined roles.

Scope: fleet list without manual creation; ship detail with overview, ship-scoped deck and cabin panels, filters/pagination, independent loading/errors, and one edit/operation modal at a time. Show model identity/dimensions from persisted responses. Fix legacy edit payloads to respect immutable fields. No 3D viewer, model activation or real data mutations for verification.

Validation: lint, typecheck/build, relevant API/access/regression tests; browser fixtures at desktop/mobile/short viewport. Preserve real FE/BE runtime for the user. Do not represent existing full-suite failures as passing. No commit or push requested.

## Implemented

Git delivery authorized 2026-10-24: user explicitly requests a new branch without “codex”, push, then merge main. Deliver frontend import and fleet work from this conversation through feat/ship-import-management and a pull request (no direct main push). Preserve unrelated operations task notes and all backend/mobile changes. Refresh origin/main, review staged source/test/docs only and run required checks before publishing. This authorization supersedes earlier “no commit/push requested” notes.

Ship list readiness removal: remove the Sẵn sàng filter and Sẵn sàng vận hành card row as requested in the screenshot. Keep name/status filters and current-cruise/capacity details. Dashboard and backend readiness remain outside this UI request. Existing feature paths apply; validate desktop/mobile and required checks.

Breadcrumb follow-up: remove only the “Đội tàu /” prefix from Dashboard, Ship, ship detail and Boong & Cabin page breadcrumbs, per the user's screenshots. Preserve page titles, navigation and behavior. Existing feature allowed paths apply. Verify rendered Ship breadcrumb and required lint/typecheck/build checks.

Breadcrumb validation: lint, typecheck/build and diff whitespace check passed. Authenticated Ship page renders only “SHIP” above its title. Saved ship-breadcrumb-clean.png; all four source breadcrumbs have the prefix removed.

Global admin-shell follow-up: remove the “Xem WebApp” footer link for all admin/manager workspaces using AdminShell, retaining the brand footer. Extend allowed paths to src/shared/ui/admin-v3/AdminShell.module.css to remove the unused footer-anchor rule. Existing unrelated changes remain. Verify the shared-shell source and current authenticated page, lint/typecheck/build; no backend changes.

Footer validation: lint, typecheck/build and diff whitespace check passed. Source search confirms no remaining “Xem WebApp”/“Xem Web App” text in src. Verified authenticated Dashboard sidebar visually, saved admin-sidebar-without-webapp.png. The shared shell applies the removal to every admin/manager role without permission changes.

Current user scope supersedes four-item navigation: SHIP_MANAGER now has Dashboard, Ship and Boong & Cabin. Consolidate structure views with a persistent ship selection and URL-backed Boong/Cabin tabs; preserve legacy /admin/cabins links and select only readable tabs. Deck-row cabin action stays in the combined structure page. Redesign Ship with filterable operational cards and Dashboard with concise metrics, actionable readiness notices and compact fleet overview. Keep actual supplementary loading/errors/retries and existing edit dialogs. Allowed paths additionally cover the updated manual-create test imports in tests/admin/admin-access-regression.test.mjs. No backend/mobile/dependency changes. Verify navigation, deep links, tab/ship isolation and desktop/mobile, plus lint/typecheck/build and relevant regressions.

Combined UI validation: lint, typecheck/build passed; 70 feature/import regressions and the manual-create access test passed. Browser verified three menu entries, Ship search/reset, Dashboard readiness links, ship-card selection, Boong→Cabin deep link with Riviera filter, and changing to Demo ship while retaining Cabin and clearing deck filter. At 390x844 Dashboard/Ship/combined inventory all had document width 375px; cabin table scrolls locally (1080px table inside 307px). Reset viewport. Saved real screenshots fleet-ships-redesign.png, fleet-dashboard-redesign.png, fleet-structure-combined.png. Detail header actions compacted and structure navigation unified; no real data changes.

New selection UX supersedes the sparse toolbar-only entry screen: show selectable ship cards before choosing a ship, using existing ship metadata (name, code, status, configured decks and passenger capacity). Open scoped inventory through the ship query parameter. Keep compact switcher after selection with a return-to-all-ships action. No structure API calls before explicit selection, no invented room counts, no extra data endpoints. Verify desktop/mobile, selecting/returning and both Deck/Cabin views; extend scoped regression coverage for the new entry screen.

Card selection validation: lint, typecheck, production build and 5 regression tests passed (including selectable card presence before selection and scoped inventory only after a valid selection). Browser verified real Cabin cards, opening Carnival Conquest cabins and returning via “Tất cả tàu”; Deck selected layout remains functional. Mobile 390x844: all cards fit within document width 375px, each card 309px; viewport reset. Real UI screenshot ship-selection-cards.png. No real data mutations.

Deck/Cabin UI follow-up: remove the large “Chọn tàu để xem dữ liệu” placeholder panel and redundant helper text. Keep explicit ship-scoped selection as a compact toolbar, with concise loading/error/empty/invalid selection states. Preserve data isolation, permissions and reset behavior. Verify both pages and mobile layout with no real mutations; run required checks and scoped regression tests. Existing allowed paths apply.

Validation: lint, typecheck/build and 5 scoped regression tests passed. Verified real Deck page with no selection and selected Carnival Conquest (13 decks loaded), plus Cabin no-selection layout. At 390x844 the toolbar stays within the viewport (document width 375px); restored viewport and saved structure-toolbar-clean.png. No real data mutations.

Dashboard UI follow-up (2026-10-24): remove introductory and metric/shortcut helper text on Dashboard only. Replace fleet cards with a compact, responsive table showing ship name, code, status, deck/cabin counts and management action. Preserve loading/error/empty states and existing data behavior. Allowed paths remain the feature and this contract. Verify desktop/mobile, lint, typecheck/build and relevant feature tests; no real data mutations.

Follow-up validation: lint, typecheck, production build and 5 ship-management regression tests passed; diff whitespace check passed. Verified real authenticated Dashboard at desktop and 390x844: metric grid uses two columns on mobile; table scrolls inside its 309px container, document width 375px within a 390px viewport. Restored viewport. Saved real UI screenshot ship-manager-dashboard-clean.png. No data mutations.

- SHIP_MANAGER now lands on /admin/fleet-dashboard and has exactly four direct permission-filtered menu entries: Dashboard, Ship, Deck, Cabin. Other roles retain their existing menus; the earlier ADMIN import restrictions remain.
- Removed the manual ship-create button and its empty-state prompt; SHIP_MANAGER cannot open /admin/ships/new, even in a combined-role session. Backend SHIP_CREATE remains unchanged because manifest registration uses it.
- Public feature exports now route ship detail to ShipManagementPage and deck/cabin lists to ShipStructureListPage. The generic legacy detail component remains for deck/cabin detail and its existing regression harness.
- Ship overview displays imported identity/dimensions, capacity and current cruise. Scoped boong/phòng panels support filters and 20-row pagination. Business editing uses one modal; ship operational checks/status and unused deletion reuse existing server contracts. Geometry and cabin type are read-only.
- Standalone Deck/Cabin pages first fetch ship choices only. Their inventory does not mount until a valid ship is selected. A ship change remounts inventory and clears filters, page, dialogs and success messages. All deck/cabin list calls use by-ship endpoints with parent validation and complete page retrieval. Cached reads retain the current scope during refresh and abort obsolete requests.
- Existing Cabin PATCH now omits immutable type/model fields; old edit forms disable the type field. Corrected cabin block options to MAINTENANCE/OUT_OF_SERVICE. Deck validation accepts ordinal 14 when imported metadata says 13 decks and deckNumberLimit=14.

## Validation

- 70 relevant feature/import tests passed; the updated manual-create access regression passed separately. No full-suite passing claim is made; existing legacy full-suite failures were recorded in the earlier import task.
- npm run lint, npm run typecheck and npm run build passed. git diff --check passed.
- Browser checks used isolated API :5189 + FE :5181. Verified exactly four menu items, no structure API reads before choosing a ship, s1/s2 isolation, cleared filters on ship change, successful cabin/ship modal saves, invalid-name focus and blocked manual-create route despite SHIP_CREATE. Observed PATCH cabin body only capacity/isAccessible; ship PATCH only supported business fields.
- Checked 1440x900 desktop, 390x844 mobile and 1280x620 short viewport. Document did not overflow; the 720px room table scrolls inside its 309px container at mobile, pagination advanced correctly, and modal footer buttons remained visible. One dialog at a time. Viewport overrides reset before handoff.
- Screenshot ship-manager-dashboard.png is synthetic UI evidence, not real data. Real BE/FE :8080/:5176 were left running. No real ship mutation, account change, migration, commit or push was performed for this task.
