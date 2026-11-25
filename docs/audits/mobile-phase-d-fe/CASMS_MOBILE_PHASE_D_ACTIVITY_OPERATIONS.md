# CASMS Mobile Phase D — ACTIVITY_OPERATIONS

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, `main`, upstream `origin/main`, cộng working tree B/C. BE `0bc2b3831301a0d67d45bacc120a161dbacec026`; giữ `?? qa/` từ trước. Chỉ sửa Mobile/tài liệu, không Backend/DB/Web, SQL/seed/Maven/API mutation thật, commit/push hoặc dependency. Đã đối chiếu AGENTS/OceVie Mobile, báo cáo 0/A0/A/B/C và handoff trong cùng phiên. Contract STATIC_VERIFIED, chưa xác nhận deployment QA. Áp dụng 7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE. Kết quả kiểm tra cuối ở FE_REGRESSION.

Đọc và sửa PosActivities, transport/contracts/lifecycle, đối chiếu PosActivityService và ActivityService. Chỉ onboard activities, không excursion hoặc tour group management.

Hiển thị UTC schedule, location/meetingPoint/capacity theo DTO; registrations và participation tách riêng. Register quantity là positive Java int và tạo PENDING. Sửa số chỗ chỉ PENDING, giữ notes từ GET mới; confirm theo OPEN/FULL/end; cancel PENDING/CONFIRMED trước start. Lifecycle open/start/complete/cancel theo trạng thái thực và ACTIVITY_LIFECYCLE.

Preflight đọc context và activities mới, kiểm resource permission, CANCELLED và cruise nếu DTO có. Đọc registrations mới, so activityId/BP/quantity/status. Attendance đọc cả participation lẫn registration, kiểm đúng liên kết ID. Response phải đúng expected state/target/quantity trước success và invalidate toàn prefix.

REGISTERED + CONFIRMED registration + activity IN_PROGRESS mới check-in. CHECKED_IN → checkout → IN_PROGRESS → complete → COMPLETED. No-show chỉ REGISTERED sau end; Backend đồng thời hoàn tất registration. Không tự đổi registration local. Activity CANCELLED hoặc cache cũ bị chặn trước POST; server vẫn quyết định capacity/concurrency sau preflight.

Root cause cũ là preflight từ cache và thiếu UI sửa số chỗ. Nay đọc mới, sửa số lượng và kiểm kết quả. Timeout dùng GET list đối soát, không retry tự động. Duplicate BP+target không được xem là bằng chứng operation vừa gửi đã commit nếu thiếu evidence. BE-16 về Fare/recovery giữ mở.

Tests lifecycle, cancellation, identity, edit notes và quantity bounds pass. Passenger→Staff→Passenger QA chưa chạy. Acceptance standard FE ready, external gates pending; không dependency mới.
