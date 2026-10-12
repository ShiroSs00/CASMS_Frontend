# CASMS-67 / CASMS-70 / CASMS-71 — Admin Ship, Deck and Cabin UI

Status: UI IMPLEMENTED — pending review (2026-10-12)

## Authorization and baseline

User approved sidebar Tàu & đội tàu → Ship / Deck / Cabin and implementation
initially using new files. User subsequently authorized minimal edits to existing
code for integration, preserving its behavior and avoiding unnecessary conflicts.
Do not create a separate AdminLayout; reuse the existing AdminFrame component.
Branch: `feat/CASMS-67-70-71-ship-deck-cabin-ui`.
Base commit: `1c57fa71313f465822808e2d49ec6f88a9ef9e39`; initial status: clean.

## Sources and limits

- User-approved preview and service matrix (CRUD/deleteUnused, operational actions).
- User-provided FOREP.sql (Ship, Deck, Cabin fields, enums, constraints/comments).
- Regulations components/CSS are visual reference only.
- API, permissions, deletion/transition policy, schedule/compatibility algorithms
  are unconfirmed: only explicit mock capabilities/results, no live policy claims.

## Allowed paths — integration exceptions explicitly authorized

- `src/app/router.tsx` — minimal import and route insertion only (user authorized)
- `src/features/regulations/components/RegulationUI.tsx` — AdminFrame wrapper only;
  original API, children, CSS variables and other components remain unchanged
- `src/features/ship-deck-cabin/**`, `src/shared/ui/**`
- This new task file, `docs/engineering/ship-deck-cabin-ui.md`

Never edit existing pages, business logic, styles, docs, configs, dependencies,
lockfiles or MobileApp. Only the router and AdminFrame integration may change.

## Acceptance

Existing entry with `/admin/ships`, `/admin/decks`, `/admin/cabins` routes,
detail and create/edit pages; `/admin` redirects to ships. Existing AdminFrame is
shared through shared/ui; no separate AdminLayout. Feature owns
typed models, components, pages, hooks and in-memory mock adapter.
CRUD includes search/filter, validation, unused-only delete, capabilities/reasons,
confirmation, pending, error/empty/not-found states and responsive layout.
Ship: summary, current/affected cruise, readiness/schedule mock inspection.
Deck: cabin list/capacity. Cabin: history, availability/capacity/compatibility,
change operational status, block/release. Occupied status is not manually set.
Mock mutations reset on reload; no backend, dependencies or auth implementation.

## Validation

Existing lint/typecheck/build; user requested no further mock tests.
Desktop/narrow browser checks,
keyboard/modal checks and direct URL refresh. Existing-file diff is limited to
router registration and the AdminFrame wrapper; all old routes remain intact.

## Delivery evidence

- `npm run lint`, `npm run typecheck`, `npm run build`: PASS on 2026-10-12.
- Browser verified: Ship → Deck → Cabin creation; field errors; cabin filters;
  status change; block/release; unused deletion; occupied-cabin guards; Escape
  close; existing Regulations screen and sidebar navigation.
- Full-width shared frame verified at 1920px: main begins at 240px and extends
  to the right viewport edge; no fixed desktop maximum width.
- Mock tests were removed and further testing stopped at the user's request.
- No backend integration, permission implementation, dependency/global-token
  changes or MobileApp changes.
- A merge simulation including uncommitted/new files passed against origin/main
  at `1c57fa71313f465822808e2d49ec6f88a9ef9e39` before the width-only adjustment.
- Narrow viewport and complete service scenario coverage remain for review;
  do not infer production readiness from this UI-only delivery.
