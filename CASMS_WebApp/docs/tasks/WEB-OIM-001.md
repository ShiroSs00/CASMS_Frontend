# WEB-OIM-001 — Operational Issue Management UI

Status: PARTIAL — UI và mock behavior đã triển khai; live API và bốn action chưa đủ contract.

Owner: Phan Văn Huy
Implementation date: 2026-10-11
Base commit: `00a63529f9978366fb3cd3258329b34fa93afc6a`
Branch: `feat/WEB-OIM-001-operational-issue-management`

## Outcome

Triển khai module Operational Issue Management theo contract đính kèm
`CASMS_Operational_Issue_Management_Codex_Contract.md` và design WF-023 trong Figma.

- List: search; severity, status, ship, cruise, handler; pagination; URL state; loading/empty/no-results/error.
- Detail: metadata, impact, timeline, transition history và resolution.
- Action UI: Assign Handler, Start Handling, Record Resolution, Verify Resolution, Close, Reopen.
- Mock adapter được gắn nhãn rõ; không fallback từ API lỗi sang mock.

## Design mapping

File: `CASMS Web — Foundations` (`BKLkzpHzVteitEbRhx3oKg`)
Page: `04 — Admin Web` (`30:5`)
Read on: 2026-10-11

| Surface | Node | Viewport / note |
| --- | --- | --- |
| List + admin shell | `135:4588` | WF-023 / 01 / 1440 |
| Detail | `135:4689` | WF-023 / 02 / 1440 |
| Assign + start | `135:4835` | WF-023 / 04 / 1440 |
| Record resolution | `135:5001` | WF-023 / 06 / 1440 |
| Reopen | `135:5077` | WF-023 / 07 / 1440 |
| Close | `135:5143` | WF-023 / 08 / 1440 |
| Compact list | `135:5293` | WF-023 / 10 / 1024 |
| Data states | `135:5361` | WF-023 / 11 / 1440 |
| Handoff notes | `135:5417` | Non-customer UI; business boundary reference |

Figma variables used locally by the feature: admin background `#f5f7f9`, surface `#ffffff`,
primary `#123042`, navy `#092333`, text `#172b36`, secondary text `#52616b`, border
`#d9e0e4`, and the status color pairs returned by node `135:4588`.

## Boundary decisions

- Repo did not contain an admin shell or shared admin components. To avoid changing read-only app
  layouts/shared code, the Figma shell is represented by a module-local `AdminFrame.tsx`. It is a
  temporary OIM presentation boundary, not a new shared platform layout.
- Repo has no HTTP/auth/permission contract. Module runs only against an explicit in-memory mock.
- Repo has no test harness and the contract does not allow package/lockfile changes, so no fake test
  script or new dependency was added.
- List frame shows search + severity + status only. Ship, cruise and handler filters required by the
  task contract use the same Figma field pattern and wrap responsively.
- Record Resolution, Verify Resolution, Close và Reopen đều có UI theo design/contract nhưng không
  mutate state vì status/payload/field bắt buộc của các action này chưa được xác nhận.

## Mock action matrix

| Action | Visible state | Mock outcome |
| --- | --- | --- |
| Assign Handler | OPEN | Updates `assignedTo`; status remains OPEN; adds audit event |
| Start Handling | OPEN + assigned handler | OPEN → IN_PROGRESS |
| Record Resolution | IN_PROGRESS | UI only; blocked before mutation because required fields/result status are unconfirmed |
| Verify Resolution | RESOLVED | UI only; blocked before mutation because payload/transition is unconfirmed |
| Close | RESOLVED | UI only; blocked before mutation because verification criteria are unconfirmed |
| Reopen | RESOLVED | UI only; blocked before mutation because source/target status, reason and preservation rules are unconfirmed |

CLOSED is read-only. OPEN → CLOSED is not exposed.

## Allowed files

- `src/features/operational-issues/**`
- `src/app/router.tsx` for route wiring only
- `docs/tasks/WEB-OIM-001.md`
- `docs/engineering/module-map.md` OIM entry only
- `docs/design/screen-map.md` OIM entries only

## Verification evidence

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm run build` — PASS; Vite transformed 138 modules.
- `git diff --check` — PASS.
- 1440 × 1000 List — visually compared with node `135:4588`; shell, hierarchy, colors,
  metrics, filters, table and information banner align. Extra contract filters wrap in the same field pattern.
- 1440 × 1100 Detail — visually compared with node `135:4689`; summary/action composition and
  admin shell align. Timeline/history/resolution are added below the Figma composition because the
  task contract requires them.
- 1024 × 900/1000 — compact 72 px navigation, three summary cards and controlled table overflow
  verified against node `135:5293`.
- 390 × 900 — defensive narrow layout checked; navigation scrolls horizontally and fields stack
  without reducing text size. This viewport is PROPOSED because WF-023 defines 1440 and 1024 only.
- Browser behavior — verified combined filter writes URL (`?status=OPEN`), excludes nonmatching
  rows and reports two results; direct detail, unknown ID and forbidden state all render separately.
- Mock workflow — verified assignment and BR-OI-08-gated OPEN → IN_PROGRESS start handling.
- Record Resolution, Verify, Close and Reopen — verified forms expose the contract blocker and do
  not mutate status/history or report success.
- Fixture timestamps — kept on or before the implementation date so `reported_at` is never future.

## Remaining blockers

- No confirmed endpoint, DTO, error, timezone, lookup or permission contract.
- Record Resolution result/required fields, Verify semantics/payload, Close verification criteria,
  and Reopen transition/preservation rules are unconfirmed.
- No shared admin shell/component implementation exists in the current repo.
- Automated behavior tests require a scoped package/lockfile change to add the first test harness;
  current allowed paths do not permit that expansion.
- Live integration is not verified. Task must remain PARTIAL until these dependencies are supplied.
