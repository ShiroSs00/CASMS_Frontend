# Phase A Frontend — Đối chiếu Backend

Frontend main `31249fd` với patch Phase A ở working tree. Đối chiếu Backend `558049c8126bd14743069de01c5ab9e321140d47` với StaffingWorkflowService, CruiseScopedProgramsController, CruiseServiceLocationService, CruisePreparationService và các request DTO. Mọi đường dẫn dùng tiền tố `/api`. [Tệp sửa và skill](CASMS_PHASE_A_FE_IMPLEMENTATION.md) · [Lệnh kiểm thử](CASMS_PHASE_A_FE_REGRESSION.md)

| Luồng | Hợp đồng và tích hợp FE |
| --- | --- |
| Ship Review | GET `/cruises/staffing-requests/{id}/review-details` trả request, tàu, modelId, area, terminal, plannedServices và shipPlanReady kiểu boolean hoặc null. V2 cần đúng true. Legacy giữ gate riêng. |
| Bố trí cặp | configuredPlacements để đọc cấu hình, eligiblePlacements để chọn. PUT `…/service-placements/{serviceId}` gửi areaId, terminalId, expectedRevision. PUT `…/area-pos/{areaId}` gửi terminalId và revision. |
| Định biên | PUT `…/ship-plan` gửi activeAreaIds, needs và expectedRevision. Snapshot có planResetImpact. Trả ASM hoặc Ship gỡ phân công theo nhu cầu. Trả HR hoặc CRM trong các bước sau giữ các phân công đó. |
| Review stale | Revision conflict, stale, lỗi quyền hoặc phạm vi POS kích hoạt GET và khóa ghi tới khi người dùng đối chiếu. shipPlanStale ở snapshot chặn tiến bước và phân công cho nhu cầu đã lỗi thời. Nhánh trả về phù hợp vẫn dùng revision mới. |
| ASM | GET `/cruise-plans/{id}/program-options` dùng ship.modelId, activityAreas và configuredOnShip. GET `/cruise/{id}/service-locations` đọc shipId, deckBlocker và shipAssigned theo đúng nghĩa Quản lý tàu. |
| Budget | GET/PUT `/cruise/{id}/preparation/operating-budget`. PUT dùng expectedRevision của Cruise và amountVnd dạng chuỗi nguyên dương. GET `/cruises/{id}/staffing-requests` đối chiếu ngân sách và scheduleRevision trước POST cùng route. |
| Preparation | GET `/cruise/{id}/preparation` đọc dataReadiness, submissionStatus, approvalStatus, submittedRevision, missingRequiredCheckCodes và allowedActions. POST submit/confirm/return/reject giữ expectedRevision của section. |
| Handoff | CRM khởi tạo, ASM hoàn tất, Ship SHIP_CHECKED, CRM SEND_TO_HR, HR HR_SUBMITTED, CRM PLANNER_CONFIRMED, OPS OPS_APPROVED. Các thao tác plan, Ready và mở bán theo các route hiện hữu. |

Kiểm tra response và payload bằng test hợp đồng. Lượt finalization xác minh thêm trên PostgreSQL V139 và API thật. CRM tạo Cruise, gặp gate ngân sách, lưu rồi đọc lại revision và tạo staffing. ASM nhận và hoàn tất chương trình. Ship nhận đúng `shipPlanReady=false` và `ship.modelId=null` với tàu catalogue. API từ chối revision cũ và từ chối ký phương án chưa đủ cấu hình. Frontend hiển thị lý do tương ứng.

Hồ sơ kỹ thuật có thể được Ship nộp độc lập. OPS nhận HTTP 403 khi gọi dashboard hoặc route xét duyệt trực tiếp của Cruise chưa gửi xét duyệt. Cùng tài khoản OPS mở được section qua `GET /cruise-preparation-reviews/{id}/TECHNICAL_NAUTICAL` và xác nhận qua `POST …/confirm`, HTTP 200. Hàng đợi duyệt hồ sơ trong Web Admin dùng route này. [Kết quả, endpoint và ảnh](CASMS_PHASE_A_FE_E2E.md)
