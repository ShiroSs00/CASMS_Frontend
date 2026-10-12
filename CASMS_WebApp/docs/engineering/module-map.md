# Module map

Status: CONFIRMED for modules present in the repository.

Last reviewed: 2026-10-11

| Module | Public entry | Routes/consumers | Required sources | Checks |
| --- | --- | --- | --- | --- |
| home | `src/features/home/index.ts` | `/` via `src/app/router.tsx` | Architecture: CONFIRMED; product screen/Figma/API: UNCONFIRMED and not used | lint, typecheck, build, 375 px/1440 px shell check |
| operational-issues | `src/features/operational-issues/index.ts` | `/admin/issues`, `/admin/issues/:issueId` via `src/app/router.tsx` | WEB-OIM-001; Figma WF-023 nodes recorded in screen-map; BR-OI-02–09 from attached contract; API UNCONFIRMED, explicit mock mode | lint, typecheck, build, 1440/1024/narrow rendered checks |

`app` và `styles` là application infrastructure, không phải feature modules. Chưa tạo `domain`, `shared`, search, detail hoặc booking vì chưa có task/source được duyệt.

Khi thêm module, cập nhật bảng bằng public entry, caller/route, mã BR hoặc screen/API source cụ thể và validation thật.
