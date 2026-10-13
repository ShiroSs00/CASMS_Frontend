# WEB-REG-001 — Regulation & Ship/Cruise Regulation UI

Status: DONE — UI/mock implementation (2026-10-12)

Owner: Phan Văn Huy

App root: `CASMS_WebApp/`

## Outcome

Implement exactly these frontend capabilities:

1. Regulation List, Detail and Create/Edit Form with search, filters, activate/deactivate and conflict alert.
2. Ship Regulation UI with assigned list, assign, remove and conflict display.
3. Cruise Regulation UI with assigned list, assign, remove and conflict display.

Completion means every `REG-UI-01`–`REG-UI-11` item below passes in UI/mock mode. Live API integration is not part of this task and must not be claimed.

## Authoritative inputs

Use sources in this order:

1. This contract defines scope, routes, allowed files and completion.
2. Figma defines layout, copy, components, visual states and interactions.
3. `AGENTS.md`, `docs/engineering/architecture.md` and the current repository define code organization and import boundaries.

Figma source read on 2026-10-12:

- File key: `BKLkzpHzVteitEbRhx3oKg`
- Page: `04 — Admin Web`, node `30:5`
- Handoff: `WEB-REG / R13 / Regulation · Handoff & screen map`, node `235:6912`

| Design | Node ID | Required use |
| --- | --- | --- |
| R01 · Regulation list | `231:6742` | List, search, filters, pagination presentation |
| R02 · Regulation detail | `231:6827` | Detail, assignment summary, status actions |
| R03 · Create regulation | `231:6883` | Create form |
| R04 · Edit regulation | `232:6798` | Edit variants, errors, active-value lock |
| R05 · Change status | `232:6865` | Activate/deactivate confirmation and pending/error states |
| R06 · Ship regulations | `232:6901` | Direct assigned list, inherited GLOBAL display, remove entry point |
| R07 · Cruise regulations | `232:6962` | Direct assigned list, inherited SHIP/GLOBAL display, remove entry point |
| R08 · Assign to ship | `233:6838` | Candidate search/filter/select and precheck entry point |
| R09 · Assign to cruise | `233:6899` | Candidate search/filter/select and precheck entry point |
| R10 · Remove assignment | `233:6960` | Remove confirmation and last-target blocked variant |
| R11 · Conflict result | `233:6994` | Warning, blocking and unavailable/error variants |
| R12 · States | `233:7038` | Loading, empty, no results, error, read-only/denied and stale data |
| R13 · Handoff | `235:6912` | Node mapping and host integration notes |

Read the listed nodes before coding. Do not redesign them or infer backend behavior from their sample data.

## Delivery mode

This task is UI/mock-only because the repository has no confirmed Regulation API, permission matrix or Ship/Cruise feature implementation.

- Put all sample data and mutations behind a typed mock adapter.
- Search, filters, create/edit, status changes, assign and remove must visibly work against the mock state.
- Conflict results come from explicit mock responses; the client does not calculate conflicts.
- Mock responses provide capabilities such as `canActivate`, `canDeactivate`, `canAssign`, `canRemove`, `canProceed` and a reason when false. UI renders those capabilities and never derives live policy.
- Label sample data as mock/demo where the Figma frame does so.
- Do not create endpoint URLs, auth roles, permission keys or HTTP error mappings.

## Routes and host decision

Add only these routes:

| Route | Screen |
| --- | --- |
| `/admin/regulations` | R01 |
| `/admin/regulations/new` | R03 |
| `/admin/regulations/:regulationId` | R02 |
| `/admin/regulations/:regulationId/edit` | R04 |
| `/admin/ships/:shipId/regulations` | R06; R08/R10/R11 appear in this flow |
| `/admin/cruises/:cruiseId/regulations` | R07; R09/R10/R11 appear in this flow |

The repository currently has no Ship or Cruise feature. Implement R06 and R07 as regulation-owned pages inside `src/features/regulations/`; do not create Ship/Cruise CRUD modules. Preserve their typed `shipId`/`cruiseId` route context so a later host can compose the same regulation UI without feature-to-feature imports.

R08–R10 are dialogs/panels or in-page states launched from R06/R07. R11 is the shared conflict-result state used by R05, R08 and R09. Do not add separate routes for R08–R11.

## Required behavior

### Regulation List, Detail and Form

- R01 search matches regulation code or name in the complete mock dataset.
- R01 filters by the Figma controls: type, scope, configured status and effective time. `Xóa bộ lọc` resets them.
- Distinguish configured status from effective-at-time display.
- Opening a row goes to R02 for that exact ID; direct URL and refresh render the same record or a not-found state.
- R03 creates a mock DRAFT and then shows the saved record.
- R04 edits a DRAFT through the form variant. For a record marked `hasBeenActive`, value is read-only and excluded from the update payload.
- Required fields and inline errors follow R03/R04. `effectiveTo`, when present, must be later than `effectiveFrom`.
- R05 activate/deactivate uses the capability returned by the mock adapter, requires confirmation, prevents duplicate submission and preserves the previous state on failure.
- When the mock activate precheck returns a conflict, R05 opens R11 with operation context `activate` and the selected regulation. No-conflict may continue; warning follows `canProceed`; blocking or unavailable does not activate.
- R12 supplies loading, empty/no-results, retry, read-only/denied and stale-data variants.

### Ship Regulation

- R06 shows direct assignments for the current `shipId` separately from inherited GLOBAL regulations.
- Only direct assignments expose Remove. Inherited rows are read-only.
- R08 searches/selects SHIP candidates and shows already-assigned or ineligible items using adapter-provided reasons.
- Assign updates only the current ship after a successful mock response.
- R10 removes only the selected ship-regulation link. A `canRemove: false` response shows the last-target reason and performs no mutation.
- R11 displays the newest conflict response for the current ship and selected regulation.

### Cruise Regulation

- R07 shows direct assignments for the current `cruiseId` separately from inherited SHIP and GLOBAL regulations.
- Only direct CRUISE assignments expose Remove. Inherited rows are read-only and link back to their source context where the design provides that action.
- R09 searches/selects CRUISE candidates and shows already-assigned or ineligible items using adapter-provided reasons.
- Assign updates only the current cruise after a successful mock response.
- R10 removes only the selected cruise-regulation link. A `canRemove: false` response shows the last-target reason and performs no mutation.
- R11 displays the newest conflict response for the current cruise and selected regulation.

### Conflict display

- Support the R11 variants: warning, blocking and unavailable/check-failed.
- Render the related regulation IDs, source, message and permitted actions from the mock response.
- Warning permits continuation only when `canProceed` is true.
- Blocking never submits the assignment.
- Unchecked or failed checks are never displayed as no-conflict.
- Changing target, candidate or form input clears the previous conflict result. A late response for an old context must not replace the current result.

## Coverage matrix

| ID | Required result | Evidence |
| --- | --- | --- |
| REG-UI-01 | R01 search, all four filters, reset and no-results work | Interaction check at 1440 px |
| REG-UI-02 | R02 renders the selected ID and handles direct URL/not found | Route check |
| REG-UI-03 | R03 create and R04 edit/validation/value lock work | Interaction check |
| REG-UI-04 | R05 activate and deactivate each handle confirm, pending, success and failure | Interaction check |
| REG-UI-05 | R05 uses R11 for activate conflicts and never reports false safety | Activate precheck state check |
| REG-UI-06 | R06 lists only current ship direct assignments and separates inherited GLOBAL items | Data isolation check |
| REG-UI-07 | R08 assign and R10 remove update only the current ship | Interaction check |
| REG-UI-08 | Ship conflict result is current and context-correct | R11 stale-response check |
| REG-UI-09 | R07 lists only current cruise direct assignments and separates inherited SHIP/GLOBAL items | Data isolation check |
| REG-UI-10 | R09 assign and R10 remove update only the current cruise | Interaction check |
| REG-UI-11 | Cruise conflict result is current and context-correct | R11 stale-response check |

Ship and Cruise evidence must be checked independently even when they reuse components.

## Code boundaries

Follow `app → features → domain → shared`. Keep this feature self-contained and import it through its public entry.

Expected shape; adapt filenames only when it reduces duplication without changing scope:

```text
src/features/regulations/
  index.ts
  pages/
  components/
  hooks/
  model/
  mocks/
```

Pages compose UI. Components receive typed props. Hooks coordinate query/mutation state. The mock adapter owns fixtures and simulated responses. Feature CSS uses CSS Modules.

## Allowed changes

- `CASMS_WebApp/src/features/regulations/**`
- `CASMS_WebApp/src/app/router.tsx` — only the six routes listed above
- `CASMS_WebApp/docs/tasks/WEB-REG-001.md`
- `CASMS_WebApp/docs/engineering/module-map.md` — one Regulation module entry
- `CASMS_WebApp/docs/design/screen-map.md` — R01–R13 mappings

Before implementation, record the base commit and existing `git status --short`. Preserve all pre-existing changes.

## Out of scope

- Live backend/API integration, endpoint creation or HTTP client work
- Authentication, authorization or permission-system implementation
- Ship/Cruise CRUD, ship assignment, itinerary or voyage management
- Regulation delete, bulk actions, import/export, approval, notification or conflict engine
- New global dashboard, KPI cards, analytics, tabs or screens not present in R01–R13
- Changes to Operational Issues, MobileApp, shared/global tokens, dependencies, package files or build configuration
- New routes other than the six routes in this contract

## Validation

From `CASMS_WebApp/` run:

```text
npm run lint
npm run typecheck
npm run build
```

There is currently no test script. Do not add a test dependency in this task. Verify each coverage item manually with the mock adapter and capture screenshots for R01–R12 at the 1440 px Figma viewport. Also check a narrow viewport for overflow and keyboard/focus behavior without redesigning the desktop layout.

Review the complete diff and confirm every changed path is allowed. Do not mark the task complete while any `REG-UI-*` item is failed or unverified.

## Completion report

Report:

- Branch and base commit
- Files added/modified/deleted
- Figma nodes implemented
- `REG-UI-01`–`REG-UI-11`: PASS/FAIL with evidence for each ID
- `npm run lint`, `npm run typecheck`, `npm run build`: actual result
- Screenshots/viewports checked
- Remaining mismatch or blocker
- Confirmation that live API integration was not claimed

## Completion evidence — 2026-10-12

- Branch: `feat/WEB-REG-001-regulation-ui`
- Base commit: `00a63529f9978366fb3cd3258329b34fa93afc6a` (`main`)
- Initial status preserved: `.agents/`, this task contract and `skills-lock.json` were untracked; only task-allowed paths are included in the feature commit.
- Figma nodes implemented: R01–R12 (`231:6742` through `233:7038`); R13 (`235:6912`) used as the handoff map only.
- Browser evidence: Edge at 1440×1200 for list, detail, edit and Ship Regulation; 600×1100 narrow list check; keyboard-focus styles and horizontal table containment reviewed.
- Validation: `npm run lint`, `npm run typecheck`, and `npm run build` all pass.
- Integration mode: typed in-memory mock adapter only; no live endpoint, permission key or HTTP mapping was added or claimed.

| ID | Result | Evidence |
| --- | --- | --- |
| REG-UI-01 | PASS | Browser interaction: 9 initial rows, code search returned one exact row, reset restored 9; combined type/scope/status filter returned `REG-SPD-004`; effective-at display remains separate. |
| REG-UI-02 | PASS | Direct route rendered the selected regulation; unknown ID rendered the not-found state. |
| REG-UI-03 | PASS | Create saved a DRAFT and navigated to its detail; missing fields rendered inline errors; previously ACTIVE value is read-only and omitted from update data. |
| REG-UI-04 | PASS | Activate/deactivate require confirmation, lock while pending, refresh returned state and preserve old state on failure. |
| REG-UI-05 | PASS | SPEED activation returned a warning precheck with `canProceed: true`; blocking/unavailable results keep confirmation disabled. |
| REG-UI-06 | PASS | Ship route separates direct rows from inherited GLOBAL rows. |
| REG-UI-07 | PASS | Ship assignment increased only that host's direct count; remove reduced it; final direct link became non-removable; a different `shipId` remained empty. |
| REG-UI-08 | PASS | Changing selection before a delayed check completed left the newest selection active and discarded the older conflict result. |
| REG-UI-09 | PASS | Cruise route rendered two direct and two inherited SHIP/GLOBAL mock rows in separate sections. |
| REG-UI-10 | PASS | Clear-result Cruise candidate assigned successfully; blocking candidate left Assign disabled; mutations are keyed by current `cruiseId`. |
| REG-UI-11 | PASS | Clear, warning, blocking and unavailable result variants render explicit status, related regulation/source/content and permitted action. |

## Post-merge compatibility correction — 2026-10-13

Branch: `codex/fix-web-oim-reg-completion`

- Regulation type options now match `FOREP.sql`: `SAFETY`, `CAPACITY`, `SPEED`, `WEATHER`,
  `ENVIRONMENT`, `HEALTH`.
- Unit options now match SQL: `KNOT`, `KM`, `METER`, `PERCENT`, `PERSON`, `CELSIUS`, `NONE`,
  plus nullable unit.
- Status now includes `EXPIRED`; invalid mock-only enum values were removed from fixtures.
- Regulation Detail obtains Ship/Cruise targets from direct assignment joins. Scope no longer
  creates a false assignment.
- List, detail, Ship Regulation and Cruise Regulation routes render successfully at 1440 px.
- Lint, typecheck and production build pass after the correction.
