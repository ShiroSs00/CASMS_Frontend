# Tour group creation from excursion

User requests reusing excursion information to avoid repeated input and matching the excursion form UX. Scope is the group create/edit form and preserving the excursion selection when entering creation from a filtered group list. No BE changes or automated tests per session instructions.

Baseline: HEAD `ee89e6cfb53876951070c386a59d0333faf94aae`; `git status --short` reviewed before edits. Preserve all earlier changes, especially required group capacity and excursion UI changes.

Allowed paths relative to CASMS_WebApp:
- This document
- src/features/tour-groups/api/group-context-api.ts
- src/features/tour-groups/model/tour-group.ts
- src/features/tour-groups/components/GroupForm.tsx
- src/features/tour-groups/components/TourGroups.module.css
- src/features/tour-groups/pages/TourGroupPages.tsx

Sources: TourGroupRequest, ShoreExcursionResponse and TourGroupService.applyRequest/validateTimes/validateGroup (read only), plus existing shared form and excursion UI conventions. Inherit maximumCapacity, meetingPoint, startTime as assemblyTime/departure, and plannedReturnTime. Do not invent an earlier assembly time. Required capacity must always be present in the outgoing body. Guide/vehicle are not excursion defaults and existing assignments must survive editing.

Acceptance: selecting an excursion supplies defaults immediately without an effect overwriting user edits. Show source summary; expose inputs for missing source values, optional notes, and an expandable group-customization section. Preserve existing group values in edit mode, provide explicit reset to excursion values, and refresh inherited fields when selecting a different excursion. Validate required missing values, capacity limits, assigned-passenger minimum in editing, chronology and excursion time bounds. Preserve permission checks, async recovery, timezone/UTC conversion, BE-generated codes and previous work. Reuse shared UI primitives and CSS Modules; responsive form and action placement match excursion creation. No cross-feature imports, new dependencies or business-data mutations.

Verification: lint, typecheck, build and diff review. No automated tests. Report browser tooling limitation if still unavailable.

## Outcome

Excursion options now decode source capacity, meeting point and schedule. The form derives inherited values from the selected excursion and overlays only group-specific draft values. Create requires no repeat entry for complete source data; missing values receive dedicated inputs. Optional customization displays current values, supports reverting provided source fields, preserves manually supplied missing fields on reset, and marks customized fields in the summary. Editing retains saved group data and guide/vehicle assignments. Changing the excursion resets inherited draft fields; notes/assignments remain intact.

Form layout now follows excursion creation: full-width selection and source context, responsive two-column fields, inline errors/summary, notes and right-aligned footer actions. Context is retained through `?excursionId=` from filtered group list to creation. Closed/completed/cancelled sources are unavailable according to BE rules. Capacity, existing assigned passengers, chronology and excursion time bounds are validated before sending the required capacity and UTC timestamps.

Validation: `npm run lint`, `npm run typecheck`, `npm run build` and scoped `git diff --check` passed. No automated tests or database writes. Browser rendering has not been checked because the session browser tool remains unavailable with the kernel-assets path error observed in the preceding task. BE unchanged.
