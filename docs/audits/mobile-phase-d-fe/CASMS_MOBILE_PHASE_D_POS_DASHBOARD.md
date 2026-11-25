# CASMS Mobile Phase D — POS_DASHBOARD

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, `main`, upstream `origin/main`, cộng working tree B/C. BE `0bc2b3831301a0d67d45bacc120a161dbacec026`; giữ `?? qa/` từ trước. Chỉ sửa Mobile/tài liệu, không Backend/DB/Web, SQL/seed/Maven/API mutation thật, commit/push hoặc dependency. Đã đối chiếu AGENTS/OceVie Mobile, báo cáo 0/A0/A/B/C và handoff trong cùng phiên. Contract STATIC_VERIFIED, chưa xác nhận deployment QA. Áp dụng 7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE. Kết quả kiểm tra cuối ở FE_REGRESSION.

Đọc/sửa PosDashboard, reuse usePosRequests/usePosActivities/ActionRow/OceVie. Nhân viên cần thấy ca làm việc và queue trước các chức năng phụ.

Trước: chưa có queue count, activity entry phụ thuộc list có dữ liệu. Sau: REQUESTED và ACCEPTED/IN_PROGRESS count chỉ khi query có data và không lỗi; pending/error không biến thành0. Catalogue/request/activities/sale-statement theo resource/terminal permissions; QR theo POS_ACCESS + CHECKIN_BOARDING. Không doanh thu giả/product sale.

Session card dùng terminal/name/code/employee/ship/cruise, UUID trong disclosure; label APIs không gọi khi thiếu quyền. Close/logout có confirmation. Count là scoped list trả server, không KPI toàn tàu. Refresh xác minh lại session; app focus refetch kế thừa A/C.

Root cause xử lý bằng authoritative query và permission; giữ Mobile một cột/maxWidth hiện có, không Web Admin thu nhỏ. Tests scope/lifecycle pass, rendered phone/tablet chưa nghiệm thu. Acceptance FE source ready, không visual/device pass. Không đổi dependency hoặc business rule.
