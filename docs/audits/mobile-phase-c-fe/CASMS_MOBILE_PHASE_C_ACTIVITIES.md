# CASMS Mobile Phase C — ACTIVITIES

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`, cộng working tree Phase B chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Baseline 130 tests, TypeScript/lint/export pass, Doctor 19/20. Giữ nguyên thay đổi B và các tệp untracked cũ. Không sửa Backend/DB/Web, không chạy Maven/SQL/seed/migration hoặc API mutation thật; không commit/push, không nâng dependency.

Đối chiếu báo cáo Phase 0/A0/A/B và handoff trong cùng phiên làm việc. Contract được xác minh từ source, chưa phải deployment QA. Các trường hợp nullable đối chiếu cả `application.yml` với `default-property-inclusion: non_null`: trường null có thể bị bỏ khỏi JSON, FE normalize thành null và không coi là 0.

Skill áp dụng: expo-native-ui, expo-data-fetching, expo-router, expo-design-system, ui-ux-pro-max, impeccable, frontend-design. Xem [SKILL_USAGE](CASMS_MOBILE_PHASE_C_SKILL_USAGE.md). Kết quả cuối ở [FE_REGRESSION](CASMS_MOBILE_PHASE_C_FE_REGRESSION.md); acceptance không bao gồm REAL_API_PASSED hoặc DEVICE_E2E_PASSED.

File đọc: ActivityController/ActivityService/RegistrationStatus/OnboardActivityStatus/PortCallBookingPolicy, OnboardOperationController/Service, Fare entitlement và PosService. Baseline không có ActivityRegistrationService riêng; các hàm nằm ActivityService. File sửa: PassengerActivitiesScreen, passenger-api/types; thêm schema/context/entitlement helper.

Root cause: registration list chưa lọc BP, form không reset theo voyage, schema cũ chủ yếu kiểm ID, timeout có thể bị xóa bằng đóng/mở sheet. Nay workspace remount và action guard; activity list đúng cruise, registration đúng BP (BP xác định chuyến duy nhất), không hiện thông tin hành khách cùng booking. Hiển thị schedule UTC, location/meetingPoint/deck/cabin khi DTO có, capacity cấu hình, availability query và quyền lợi liên kết bằng occurrence resource IDs. Không nối theo tên.

Trước register GET registration nếu có read permission, GET detail cùng cruise và lịch hiện tại, GET availability; capacity/duplicate vẫn do BE lock. OPEN và endTime tương lai theo service, không tự đổi điều kiện thành trước startTime. POST trả PENDING mới thành công; confirm riêng PENDING→CONFIRMED khi quyền ACTIVITY_REGISTRATION. Update/cancel GET registration mới, so BP và target; cancellation trước start theo BE. Không triển khai attendance/participation action.

Khi có thể đã gửi nhưng lỗi mạng/5xx/malformed result, khóa toàn flow; cần GET danh sách để đối soát trước thao tác tiếp. Không auto retry. Không có operation-key recovery cho registration; server chống active duplicate theo BP+target, chưa có operation identity cho update/cancel. BE-16 cần runbook/fixture timeout. Schedule-conflict và fare-charge semantics chưa có cùng contract trong standard register; không tự gọi OnboardOperation Folio API hoặc tự thu phí.

Tests: lifecycle/ended/full/capacity, exact identity/schema, target XOR, network no replay, scope guard. UI pure/source đã kiểm; realtime schedule/device và API thật chưa kiểm. Dependency không đổi. Acceptance standard registration FE sẵn sàng; fare transaction/overlap policy riêng BLOCKED_BY_BACKEND, M09 giữ mở cho QA.
