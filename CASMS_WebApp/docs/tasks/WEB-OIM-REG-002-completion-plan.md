# WEB-OIM-REG-002 — Completion plan

Status: IMPLEMENTED AND VALIDATED ON FEATURE BRANCH.

Branch: `codex/fix-web-oim-reg-completion`

Base commit: `da14050`

Owner: Phan Văn Huy

## Goal

Complete only the assigned frontend mock scope for Operational Issue Management and Regulation /
Ship Regulation / Cruise Regulation. Align the UI with the referenced Figma frames and align all
persisted mock records with `FOREP.sql`, without inventing APIs or database relationships.

## Ordered work

1. Restore the OIM routes and module/screen maps.
2. Introduce an exact SQL-record boundary for OperationalIssue and map it to display data.
3. Implement all six OIM actions using only SQL-backed states and fields.
4. Replace synthetic OIM history/impact/link data with transparent schema-limitation states.
5. Align Regulation type, unit and status enums with `FOREP.sql`.
6. Make Regulation Detail derive assigned targets from ShipRegulation/CruiseRegulation mock joins.
7. Preserve Figma layout/components for both modules and verify key screens at 1440 px.
8. Run lint, typecheck, production build and browser workflow checks.

## Design and data rules

- Figma controls presentation, copy hierarchy, responsive layout and interaction states.
- `FOREP.sql` controls persistable entities, enums, columns and relationships.
- Mock adapters own fixtures and all mutation logic.
- UI view models may contain resolved display labels, but persistence-shaped records must not
  contain fields that do not exist in SQL.
- Conflict results are derived adapter responses; no frontend conflict engine is invented.
- A static Figma sample count is not a data invariant. Visible counts follow the current mock query.

## Acceptance matrix

| Area | Acceptance result |
| --- | --- |
| OIM list | Search, five filters, reset, pagination and route access work |
| OIM detail | Current record, timestamp projection, history limitation and resolution render |
| OIM actions | Assign, start, record, verify, close and reopen behave per SQL state machine |
| Regulation CRUD UI | List/detail/form, search/filter, activate/deactivate and conflict alert work |
| Regulation SQL compatibility | Type/unit/status options match `FOREP.sql` |
| Assignment UI | Ship/Cruise direct joins drive assigned lists; assign/remove/conflict work |
| Documentation | Module map, screen map, task contract and system-design artifact are updated |
| Quality gates | Lint, typecheck, build and browser smoke/workflow checks pass |

## Validation evidence

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm run build` — PASS; Vite transformed 162 modules.
- OIM list and direct detail routes — PASS at 1440 px.
- OIM Assign, Start, Record, Verify, Reopen and Close — PASS in one browser session.
- Regulation list/detail, Ship Regulation and Cruise Regulation routes — PASS at 1440 px.
- Key OIM and Regulation screens were visually compared against the referenced Figma frames.

## Out of scope

- Live backend/API integration.
- Authentication/authorization implementation.
- A new audit-history schema or synthetic audit data.
- ServiceRequest linking, analytics, bulk actions or unrelated Ship/Cruise CRUD.
- New features not present in the assigned task or referenced Figma surfaces.
