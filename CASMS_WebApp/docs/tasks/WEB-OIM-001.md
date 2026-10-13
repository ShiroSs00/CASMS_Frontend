# WEB-OIM-001 — Operational Issue Management UI

Status: DONE — frontend mock implementation; live API integration is out of scope.

Owner: Phan Văn Huy

Completion branch: `codex/fix-web-oim-reg-completion`

Completion base: `da14050`

## Outcome

The frontend implements the assigned scope only:

- List: search; filters for severity, status, ship, cruise and handler; pagination and URL state.
- Detail: current issue data, SQL-backed timestamp timeline, schema limitation notice for history,
  and scalar resolution fields.
- Actions: Assign Handler, Start Handling, Record Resolution, Verify Resolution, Close and Reopen.
- Routes: `/admin/issues` and `/admin/issues/:issueId`.

All data and mutations run through an explicit typed in-memory adapter. No live API, endpoint,
permission key or backend behavior is claimed.

## Authoritative boundary

`FOREP.sql` is the data source of truth. `OperationalIssueRecord` mirrors the SQL columns and is
mapped to a UI view model at the adapter boundary.

- Persisted statuses: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`.
- Record Resolution: `IN_PROGRESS → RESOLVED`; writes `resolution`, `resolved_by`, `resolved_at`.
- Verify Resolution: validates that those three fields exist; it does not invent a `VERIFIED`
  status or database field.
- Close: `RESOLVED → CLOSED` after the resolution precheck passes.
- Reopen: `RESOLVED → IN_PROGRESS`; keeps the current scalar resolution because SQL has no
  reopen reason/count/history fields.
- Assign Handler updates `assigned_to`; Start Handling requires a handler.

`FOREP.sql` has no OperationalIssue audit/event/history table and no ServiceRequest relation.
The UI therefore does not synthesize event rows, reopen counts, impact summaries, linked-request
counts or a false assignment history. Timeline cards are explicitly labeled as a projection of the
current record timestamps, not an audit trail.

## Figma mapping

File: `CASMS Web — Foundations` (`BKLkzpHzVteitEbRhx3oKg`)

Page: `04 — Admin Web` (`30:5`)

| Surface | Node |
| --- | --- |
| List + admin shell | `135:4588` |
| Detail | `135:4689` |
| Assign + start | `135:4835` |
| Record resolution | `135:5001` |
| Reopen | `135:5077` |
| Close | `135:5143` |
| Compact list | `135:5293` |
| Data states | `135:5361` |
| SQL/business handoff | `135:5417` |

The implementation preserves the Figma hierarchy, admin shell, token values, table/filter patterns,
dialogs and workflow states. Counts and row content remain adapter-driven mock data rather than
hard-coded screenshot values.

## Mock action matrix

| Action | Preconditions | Mock outcome |
| --- | --- | --- |
| Assign Handler | `OPEN` | Updates `assigned_to`; remains `OPEN` |
| Start Handling | `OPEN` + handler | Changes status to `IN_PROGRESS` |
| Record Resolution | `IN_PROGRESS` + non-empty resolution | Writes resolution fields; changes to `RESOLVED` |
| Verify Resolution | `RESOLVED` + complete resolution fields | Returns a successful precheck; no persisted state invented |
| Close | `RESOLVED` + complete resolution fields | Changes status to `CLOSED` |
| Reopen | `RESOLVED` | Changes status to `IN_PROGRESS`; retains resolution fields |

`CLOSED` is read-only. `OPEN → CLOSED` is not exposed.

## Validation

Run from `CASMS_WebApp/`:

```text
npm run lint
npm run typecheck
npm run build
```

Manual browser coverage must include the list route, direct detail route, all five filters,
pagination and the complete six-action workflow. Visual comparison uses the 1440 px Figma frames.

Completion evidence on `codex/fix-web-oim-reg-completion`:

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm run build` — PASS; Vite transformed 162 modules.
- Browser route checks for list and direct detail — PASS.
- One-session workflow: Assign → Start → Record → Verify → Reopen → Record → Close — PASS.
- Final CLOSED state renders as read-only — PASS.

## Deferred live-integration inputs

- Confirmed API endpoints and request/response DTOs.
- Authentication and permission/capability contract.
- Lookup APIs for users, ships, cruises and cabins.
- A backend audit/event source if true transition history is required.
