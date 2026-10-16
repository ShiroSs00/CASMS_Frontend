# Module map

Status: CONFIRMED for modules present in the repository.

Last reviewed: 2026-10-16

| Module | Public entry | Routes/consumers | Required sources | Checks |
| --- | --- | --- | --- | --- |
| home | `src/features/home/index.ts` | `/` via `src/app/router.tsx`; finder and editorial links lead into customer cruises | WEB-BOOKING-V3-001; live Figma `k754hHXohOrGHSgjtuSRnw / 111:93`; isolated editorial fixtures, no public booking HTTP contract | lint, typecheck, build, 375 px/1440 px rendered check |
| auth | `src/features/auth/index.ts` | app provider, public layout, `/login`, `/403`, six auth concept routes, admin/customer guards | WEB-BOOKING-V3-001; identity.zip 2026-10-15 login/refresh/logout roles-only contract; Figma auth nodes listed in task report; concepts UI_ONLY_PROPOSED | lint, typecheck, build, safe-return tests, rendered auth screens; live session/role checks still require backend and credentials |
| booking | `src/features/booking/index.ts` | `/cruises`, `/cruises/:cruiseId`, `/booking/*`, `/my-bookings/*` | [WEB-BOOKING-V3-001](../tasks/WEB-BOOKING-V3-001.md); live Booking Web V3 Figma; supplied booking schema/enums and WF-005–WF-011 context; UI_WITH_TYPED_ADAPTER, missing HTTP contracts explicitly listed in task report | lint, typecheck, build, draft validation/pricing tests, 1440 px rendered screens, manual navigation/state checks |
| operational-issues | `src/features/operational-issues/index.ts` | `/admin/issues`, `/admin/issues/:issueId` via `src/app/router.tsx` | WEB-OIM-001; Figma WF-023; FOREP.sql current-state schema; explicit mock mode | lint, typecheck, build, 1440/1024/narrow rendered checks |
| regulations | `src/features/regulations/index.ts` | Six WEB-REG-001 admin routes via `src/app/router.tsx` | `docs/tasks/WEB-REG-001.md`; Figma page `30:5`, frames R01–R13; UI/mock adapter only | lint, typecheck, build, manual desktop/narrow interaction check |
| cruises | `src/features/cruises/index.ts` | `/admin/cruises`, `/admin/cruises/new`, `/admin/cruises/:cruiseId`, `/admin/cruises/:cruiseId/edit` via `src/app/router.tsx` | `docs/tasks/WEB-CRUISE-001.md`; Figma page `30:5`, final Cruise section `280:6128`; `FOREP.sql`; typed mock adapter only | domain tests, lint, typecheck, build, 1440/1024 rendered checks |

`app` và `styles` là application infrastructure, không phải feature modules. Booking dùng shared UI và adapter riêng; không import feature khác. Auth/session được ghép tại app router.

Khi thêm module, cập nhật bảng bằng public entry, caller/route, mã BR hoặc screen/API source cụ thể và validation thật.
