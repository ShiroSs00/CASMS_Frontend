# CASMS Mobile Phase B — POS_SCANNER

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`; BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. So với mốc yêu cầu 3c01db0, A0/A đã được merge ở FE a6bd1d6. Giữ nguyên các tệp untracked có từ trước. Backend có thư mục untracked qa/ từ baseline; không sửa Backend/DB/Web. Không chạy SQL, Maven, API mutation thật, prebuild, commit hoặc push trong Phase B.

Đã đọc AGENTS gốc/Mobile, OceVie Mobile, báo cáo Phase 0/A0/A và handoff; các source và thay đổi chuyên biệt ghi dưới đây. Áp dụng đủ 7 skill theo [SKILL_USAGE](CASMS_MOBILE_PHASE_B_SKILL_USAGE.md). Kết quả kiểm tra tập trung trong [FE_REGRESSION](CASMS_MOBILE_PHASE_B_FE_REGRESSION.md). Chưa có QA do BE/DB xác nhận và thiết bị NFC thật; không tuyên bố REAL_API_PASSED hay DEVICE_E2E_PASSED.

Đọc PosScanner/Dashboard/Layout, pos-api/transport/contracts/access/lifecycle/storage. Sửa Scanner/Dashboard/transport/error copy; thêm PosCardAction.

Root cause camera cũ chỉ đọc chuỗi, chưa Backend preview. Nay camera QR-only, validate base64url claim shape, khóa scan lặp/pending, gọi preview qua employee JWT + scoped X-POS-Session. Chỉ render tên từ response Zod hợp lệ. Không hiển thị raw claim/UID. Quyền cấp thẻ độc lập SERVICE_SALE/ACTIVITY_REGISTER, theo source là POS_ACCESS + CHECKIN_BOARDING.

Màn có chế độ cấp QR và tra NFC, tra NFC không cần camera permission. Permission denied/cannot-ask-again/camera failure có hướng dẫn; focus/AppState/đổi POS key/verified hủy state và loại response muộn. Preview chỉ chứng minh claim, không assignment. Sau preview có đọc native, xác nhận người nhận, confirm và kết quả server. Hủy/quét mã khác không tự gửi confirm. Native cancel/cleanup trên blur/background.

Confirm có khóa ref và retry=false ở transport, re-preview trước gửi, so BookingPassenger trên response. Nếu lệnh có thể đã gửi nhưng mất kết quả: khóa gửi lại trong flow, chỉ lookup cùng UID và đối chiếu đúng BookingPassenger; lookup không khớp/không xác định yêu cầu quản lý. Đổi màn/app restart sẽ bỏ UID/claim local, cần quy trình đối soát vận hành BE-14. Lookup dùng server scope, không mở sale.

M03 source QR/NFC adapter đã xử lý, device E2E BLOCKED_BY_HARDWARE. Không claim thành công trước server.
