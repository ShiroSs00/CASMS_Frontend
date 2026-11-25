# CASMS Mobile Phase B — CHECKIN

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`; BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. So với mốc yêu cầu 3c01db0, A0/A đã được merge ở FE a6bd1d6. Giữ nguyên các tệp untracked có từ trước. Backend có thư mục untracked qa/ từ baseline; không sửa Backend/DB/Web. Không chạy SQL, Maven, API mutation thật, prebuild, commit hoặc push trong Phase B.

Đã đọc AGENTS gốc/Mobile, OceVie Mobile, báo cáo Phase 0/A0/A và handoff; các source và thay đổi chuyên biệt ghi dưới đây. Áp dụng đủ 7 skill theo [SKILL_USAGE](CASMS_MOBILE_PHASE_B_SKILL_USAGE.md). Kết quả kiểm tra tập trung trong [FE_REGRESSION](CASMS_MOBILE_PHASE_B_FE_REGRESSION.md). Chưa có QA do BE/DB xác nhận và thiết bị NFC thật; không tuyên bố REAL_API_PASSED hay DEVICE_E2E_PASSED.

Đọc `src/app/check-in.tsx`, PassengerCheckInScreen, passenger-api/types/hooks, voyage-selection, PassengerVoyageChooser và BE CheckinController/Service/Response/enums.

Sửa PassengerCheckInScreen và schema passenger-api. Hiển thị đúng hồ sơ/chuyến/tàu/cabin từ booking, chặn ghi trước khi xác minh person/booking, reset form theo session epoch và BookingPassenger. Bỏ nhận diện 404 theo raw error message; dùng RESOURCE_NOT_FOUND sau GET status. Không tự chọn phần tử đầu khi có nhiều lựa chọn.

Contact được lưu bằng start, service chỉ yêu cầu không trống lúc complete; bỏ quy tắc FE 8–15 chữ số không có trong service. Complete chỉ bật khi hợp đồng được xác nhận Accepted, contact đã lưu và trạng thái phù hợp. UI giữ bước xác nhận và giải thích BoardingReady; hiển thị boardingBlockReason nếu server cung cấp.

Trước mỗi POST đọc GET status mới. Nếu complete trước đã thành BoardingReady thì chỉ hiển thị kết quả xác nhận từ GET, không gửi lại. POST không retry; outcome invalidate status. Zod và adapter từ chối HTTP200 có hồ sơ/trạng thái sai. Quyền và cửa sổ thời gian cuối do Backend quyết định, không đổi rule online từ Web sang Mobile. M02 phần check-in source STATIC_VERIFIED; QA nghiệp vụ còn BLOCKED_BY_DATABASE/BACKEND.
