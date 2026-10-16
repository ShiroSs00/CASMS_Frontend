# ADM-SHIP-01 provenance and gaps

Baseline: `dcbf7db50c130267037c1cc223edc7959b259a0a`; frontend clean before work.
Branch: `codex/adm-ship-01-v3`. Visual authority: live Figma `k754hHXohOrGHSgjtuSRnw`, `94:2`, inspected 2026-10-16.
Backend sources: local `main`, ShipController, ShipResponse, ShipCapacitySummaryResponse, CruiseSummaryResponse, ShipStatus. Backend worktree changes (`.idea/misc.xml`, untracked `openapi.json`) are unrelated and preserved.

## Gap matrix (recorded before implementation)

| Figma requirement | Existing frontend | Backend support | Mock choice |
| --- | --- | --- | --- |
| AURORA rail/topbar, metrics, dense seven-column table | CASMS shared list, action column, panels | Presentation only | Dedicated Ship page and scoped shell |
| Name/code/status/decks | Shared snapshot calls old `/ship` paths | `/ships` list supports fields, Pageable only | Separate typed fixtures; reuse confirmed ShipStatus type |
| Cabin count | Counts snapshot cabins | Actual count is per-ship capacity-summary | Explicit fixture count |
| Readiness | Per-ship boolean | Per-ship boolean; no ATTENTION/BLOCKED enum | UI-only READY/ATTENTION/BLOCKED |
| Current cruise | Per-ship fetch | Per-ship current-cruise | Nullable fixture summary |
| Fleet metrics | None | No confirmed aggregate endpoint | Independent fleet aggregate fixture |
| Search/status/readiness filters | Local filtering after full snapshot | No confirmed list filters | Pending controls, explicit local apply |
| Create/detail navigation | Existing guarded routes | Separate capabilities | Preserve routes; fictitious UUIDs do not imply live records |
| Sidebar destinations | Only some routes exist | Not established here | Link only existing destinations; unavailable items disabled |

Future integration must resolve list filtering/aggregate projection and avoid per-row capacity/readiness/cruise N+1 calls. No transport imports or network calls belong to this list.

## Design adjustments

Live Figma filter instances have 360px inner fields inside 300/220/220px containers, causing overlap. Fit controls to their containers and align the apply button with inputs. Preserve labels, order, typography, and section rhythm. Native select indicators support discoverability.

AI DevKit is not configured (no AI DevKit config or docs/ai tree); its feature lint is unavailable. Existing repository lint remains mandatory. No new dependencies or test framework.
