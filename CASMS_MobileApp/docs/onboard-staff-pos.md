# Staff POS Mobile

Điểm vào `/staff-pos` dành cho nhân viên có role phù hợp và quyền POS do Backend cấp. App xác minh `/auth/me`, mở phiên terminal bằng credential thiết bị và kiểm ngữ cảnh tàu, chuyến, khu vực. Request scoped đính `X-POS-Session` cùng bearer nhân viên.

- Dashboard hiển thị context và các mục theo quyền.
- Dịch vụ dùng `/pos/services` và `/pos/requests`, xử lý accept/reject/fulfill theo trạng thái và quyền.
- Hoạt động dùng API POS cho danh sách, đăng ký, xác nhận và điểm danh.
- Usage dùng `/pos/sales`, chi tiết giao dịch và statement của hành khách. Sale journal giữ idempotency key khi kết quả chưa rõ.
- Scanner mở camera khi ở foreground, quét QR và hiển thị trạng thái chưa xác minh. Claim preview/confirm/lookup và NFC chưa tích hợp trong A0-FE.

Khi logout, app đóng phiên POS theo khả năng kết nối và xóa context cục bộ. Phiên lưu trên thiết bị ràng buộc theo user, lần đăng nhập và API URL.

Suite `staff-backend.test.mjs` kiểm regression của adapter product/request cũ. Luồng terminal hiện tại có contract test độc lập cùng tài liệu Phase 0. Dùng `npm test` cho test FE và [cấu hình QA](real-api-qa.md) khi đội Backend cung cấp dữ liệu. Quy tắc gán service vào khu vực và cấp lại thẻ có trong [Backend handoff](../../docs/audits/mobile-phase-a0-fe/CASMS_BACKEND_HANDOFF.md).
