# Module map

Status: CONFIRMED for modules present in the repository.

Last reviewed: 2026-10-11

| Module | Public entry | Routes/consumers | Required sources | Checks |
| --- | --- | --- | --- | --- |
| home | `src/features/home/index.ts` | `/` via `src/app/router.tsx` | AURORA-AUTH-HOME-V3; Figma `k754hHXohOrGHSgjtuSRnw / 111:93`; static editorial content, no public booking API | lint, typecheck, build, 375 px/1440 px rendered check |
| auth | `src/features/auth/index.ts` | app provider, public layout, `/login`, `/403`, all `/admin/**` guards | AURORA-AUTH-HOME-V3; identity.zip login/refresh/logout roles-only contract; Figma `78:2`, `112:93`, `112:112`, `98:626` | lint, typecheck, build; manual session/role checks require running backend |
| operational-issues | `src/features/operational-issues/index.ts` | `/admin/issues`, `/admin/issues/:issueId` via `src/app/router.tsx` | WEB-OIM-001; Figma WF-023; FOREP.sql current-state schema; explicit mock mode | lint, typecheck, build, 1440/1024/narrow rendered checks |
| regulations | `src/features/regulations/index.ts` | Six WEB-REG-001 admin routes via `src/app/router.tsx` | `docs/tasks/WEB-REG-001.md`; Figma page `30:5`, frames R01–R13; UI/mock adapter only | lint, typecheck, build, manual desktop/narrow interaction check |
| cruises | `src/features/cruises/index.ts` | `/admin/cruises`, `/admin/cruises/new`, `/admin/cruises/:cruiseId`, `/admin/cruises/:cruiseId/edit` via `src/app/router.tsx` | `docs/tasks/WEB-CRUISE-001.md`; Figma page `30:5`, final Cruise section `280:6128`; `FOREP.sql`; typed mock adapter only | domain tests, lint, typecheck, build, 1440/1024 rendered checks |

`app` và `styles` là application infrastructure, không phải feature modules. Chưa tạo `domain`, `shared` hoặc booking vì chưa có task/source được duyệt.

Khi thêm module, cập nhật bảng bằng public entry, caller/route, mã BR hoặc screen/API source cụ thể và validation thật.
