# CASMS Mobile Phase D — UI_UX_REVIEW

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, `main`, upstream `origin/main`, cộng working tree B/C. BE `0bc2b3831301a0d67d45bacc120a161dbacec026`; giữ `?? qa/` từ trước. Chỉ sửa Mobile/tài liệu, không Backend/DB/Web, SQL/seed/Maven/API mutation thật, commit/push hoặc dependency. Đã đối chiếu AGENTS/OceVie Mobile, báo cáo 0/A0/A/B/C và handoff trong cùng phiên. Contract STATIC_VERIFIED, chưa xác nhận deployment QA. Áp dụng 7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE. Kết quả kiểm tra cuối ở FE_REGRESSION.

Đọc AGENTS/OceVie Mobile, shared PassengerUI/PassengerButton và các màn POS; áp dụng 7 skill cùng frontend-testing-debugging. Tìm kiếm ui-ux-pro-max “confirmation destructive action” trả hướng dẫn confirmation và success feedback. Không tạo palette, primitive, library hoặc motion mới.

Vấn đề trước sửa: copy ghi nhận sử dụng trộn bán mới với fulfillment; lịch từ request mở dễ dẫn tới khoản phí mới; lịch sử tài khoản dễ bị hiểu là riêng hành khách; đóng phiên chưa xác nhận vẫn báo kết thúc. Sau sửa: review bán mới có giá, quantity, BP/account; complete request cần đủ quantity/unit, không sale mới; history ghi account-wide; lỗi close giữ và hiển thị trên phiên hiện tại.

Tái sử dụng native Stack, safe areas, ScrollView keyboard insets, visible labels, numeric keyboard, PassengerSheet chặn dismiss trong lúc gửi, PassengerButton loading/disabled. Status có text, không chỉ màu. QueryState tách pending/paused/empty/error; count không giả 0. Giữ OceVie tokens và maxWidth 600 hiện có cho phone/tablet; UUID selectable/wrap và disclosure; không thêm decoration. FadeIn cũ tôn trọng reduced motion.

Source review: CTA review/confirm rõ, destructive confirmation, đủ status, lỗi không cho retry mù, không success sau blur. Typography và mật độ kế thừa Mobile, không redesign toàn ứng dụng. Chưa có ảnh rendered trước/sau hợp lệ, không gọi source review là visual QA.

Runtime: Phase C không có Playwright/Puppeteer; CUA IAB localhost timeout, native Brave từ chối computer-use, không bypass. Phase D kiểm PATH/ANDROID env và bundled LDPlayer ADB: khởi động daemon được sau sandbox escalation, danh sách devices rỗng. Chưa có native target/development binary để kiểm POS; không cài SDK hoặc thay cấu hình bảo mật/network. Chưa nghiệm thu phone/tablet, scaling, screen reader, keyboard và reduced motion; runbook ở CROSS_APP_QA.

Acceptance FE_READY_WITH_EXTERNAL_BLOCKERS; UI_RENDERED_NOT_RUN, DEVICE_E2E_NOT_RUN. Native B2 chưa pass không chặn nghiệp vụ không cần NFC. Dependencies giữ nguyên.
