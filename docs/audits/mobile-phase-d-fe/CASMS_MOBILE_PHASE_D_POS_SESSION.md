# CASMS Mobile Phase D — POS_SESSION

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, `main`, upstream `origin/main`, cộng working tree B/C. BE `0bc2b3831301a0d67d45bacc120a161dbacec026`; giữ `?? qa/` từ trước. Chỉ sửa Mobile/tài liệu, không Backend/DB/Web, SQL/seed/Maven/API mutation thật, commit/push hoặc dependency. Đã đối chiếu AGENTS/OceVie Mobile, báo cáo 0/A0/A/B/C và handoff trong cùng phiên. Contract STATIC_VERIFIED, chưa xác nhận deployment QA. Áp dụng 7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE. Kết quả kiểm tra cuối ở FE_REGRESSION.

Đọc PosLayout/pos-api/pos-storage/session-store và PosService/PosAccessService/device controller. Sửa Layout/API/storage/scope guard.

EmployeeGate GET /auth/me cần ACTIVE, employee role và effective POS_ACCESS. Device login authenticated:false và role chỉ POS; token thiết bị chỉ trong open body, không thay employee JWT. Open cần đúng một deviceSecret/deviceAccessToken, optional area/cruise. Mật khẩu xóa khỏi state sau thao tác; không log credentials.

Chooser gọi management terminal list khi POS_MANAGE + ship UUID. Nhân viên thường nhập terminal UUID do quản lý cung cấp; Backend xác minh assignment. Không có employee allowed-terminal discovery, BE-18; không gọi management route bằng POS_ACCESS.

Session SecureStore WHEN_UNLOCKED_THIS_DEVICE_ONLY gắn owner/epoch/API/expiry/terminal. Context server terminal/ship/area/cruise/employee hiển thị, nhãn theo quyền đọc và UUID disclosure. Current DTO không có device-account display name, không tạo tên giả. Cache key gồm API/owner/terminal/area/cruise/epoch/expiry. Resume invalidate, unmount remove cache, foreground/focus/current auth guard trước thao tác. Response đến sau đổi employee/API thành POS_STALE_RESULT 502 để giữ ambiguous sale.

Root cause close cũ: DELETE lỗi vẫn clear session local. Nay giữ session/lỗi, refetch, chỉ clear/onEnd khi server xác nhận. Revoked/expired/assignment changed chặn phiên. Journal không bị xóa do hết phiên/logout/đổi terminal; epoch trước của cùng owner có cảnh báo, khác owner/API/cruise/area bị blocked.

Tests scoped headers/expiry/account switch/late response pass. Native restore/resume/close-timeout chưa chạy. Acceptance source ready; discovery BLOCKED_BY_BACKEND; device QA pending. Không thêm dependency.
