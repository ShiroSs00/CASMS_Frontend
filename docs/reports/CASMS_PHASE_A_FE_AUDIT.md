# Phase A Frontend — Audit hợp đồng

Web Admin trên main tại `31249fdaddc54694da39313d0d18d843c8c1f431`. Backend tham chiếu main tại `558049c8126bd14743069de01c5ab9e321140d47`. GitHub trả đúng hai HEAD qua `git ls-remote --heads origin main`. Trước khi sửa, Frontend chỉ có bằng chứng Booking Agent chưa theo dõi và Backend có `qa/` cục bộ. Đã giữ các tệp đó. [Backend handoff](https://github.com/ShiroSs00/CASMS_Backend/blob/558049c8126bd14743069de01c5ab9e321140d47/docs/reports/CASMS_PHASE_A_BE_API_HANDOFF.md)

| Hạng mục | API Backend | FE trước sửa | Phân loại | Vị trí sửa |
| --- | --- | --- | --- | --- |
| ASM Program | GET `/cruise-plans/{id}/program-options` | Dùng các mảng lựa chọn nhưng chưa đọc model hiệu lực và cờ cấu hình service | Thiếu tích hợp và giải thích khi danh sách rỗng | CruisePrograms, CruiseActivityFields, program-options |
| Đề nghị boong | GET `/cruise/{id}/service-locations` | Đọc shipAssigned để nói về Quản lý tàu, thiếu lý do cụ thể khi chưa gán tàu hoặc chưa có boong | Thiếu tích hợp | ServiceLocationRequests |
| Ship Review | GET `…/review-details`, POST `…/SHIP_CHECKED` | Gate bắt buộc có khu vực đang mở. Tóm tắt dùng số liệu tự suy ra | Sai điều kiện V2 | StaffingV2, ship-review |
| Phương án tàu | GET snapshot và PUT `…/ship-plan` | Gửi đúng revision nhưng thiếu số nhu cầu/phân công bị ảnh hưởng | Thiếu tích hợp | staffing-api, StaffingV2 |
| Khu vực và POS | PUT `…/area-pos/{areaId}`, PUT `…/service-placements/{serviceId}` | Cặp service dùng eligibleAreaIds rồi lấy máy đầu của khu vực | Sai dữ liệu gửi V2 | staffing-api, StaffingV2, ship-review |
| HR | PUT `…/needs/{needId}/assignments/{userId}`, work-plan và candidates | Nhu cầu, thiếu người, ứng viên và ca đã có. Roadmap chưa chặn mọi thao tác khi phương án stale | Thiếu tích hợp stale, cần runtime | StaffingV2, StaffingInboxPage |
| Preparation | GET `/cruise/{id}/preparation` và POST theo section | Có scope và allowedActions. Badge dùng status chung, thiếu revision nộp và checklist server | Thiếu tích hợp | preparation-api, PreparationEvidence, StaffingInboxPage |
| CRM Budget | GET/PUT `/cruise/{id}/preparation/operating-budget`, GET/POST `/cruises/{id}/staffing-requests` | Editor chuỗi VND đã có. Chưa hiển thị trạng thái phê duyệt ngân sách và chưa xử lý budget 422 bằng tải lại cả hai nguồn | Thiếu tích hợp | OperatingBudget, CruisePlanWorkspace, StaffingPreparation, staffing-api |
| CRM và OPS | Staffing V2, Cruise Plan, Ready và Open Sale | Route và gate độc lập đã có. Cần xác minh quyền, revision và handoff trên dữ liệu thật | Giữ luồng hiện hành, cần runtime | StaffingV2 và PreparationEvidence |

Đã đọc hướng dẫn gốc, hướng dẫn Web Admin, danh mục `.agents/skills`, chuẩn OceVie, primitives và Overlay, cùng constitution của Backend tham chiếu. Frontend không có `.specify/`, `.codex/` hoặc spec/plan/tasks Phase A để cập nhật.
