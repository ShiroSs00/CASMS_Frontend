# CASMS Booking Agent — FE audit

Ngày: 2026-11-19 (Asia/Saigon). FE base: `main@703c239`; BE tham chiếu chỉ đọc: `main@0cc292e`. Đã fetch cả hai repo trước khi sửa; FE mới hơn SHA `9f064da` trong brief. Báo cáo lập trước commit; xuất bản sau kiểm chứng theo yêu cầu riêng của người dùng. Chỉ sửa source Frontend; không sửa source, migration, schema hoặc business rules BE.

## Kết luận theo 9 feature

| Feature | Kết quả audit và thay đổi | Kiểm chứng / giới hạn |
|---|---|---|
| 01 Danh sách theo phân công | GET `/booking` có pageable và cruiseId/status. Giữ nguyên scope BE, không gửi bookedByUserId. Sửa nguồn bộ lọc lịch sử: tổng hợp tên chuyến từ tất cả các trang booking được phép đọc; không dùng catalogue mở bán. Thêm tải lại, tổng số và empty scoped; lỗi không thành empty. | PASS unit + browser giả lập (21 kết quả/2 trang, chuyến lịch sử). BE thật trả 200 rỗng. |
| 02 Tạo mới | Giữ wizard 3 bước, validation/capacity, quote POST + readback + revalidation, giá/price revision từ BE, submit lock. Sửa currency hiển thị quote; lưu tham chiếu request theo user trước POST và GET recovery sau timeout/reload. | PASS unit và browser giả lập. Thành công trên BE thật BLOCKED: chưa có chuyến PUBLISHED/phân công. |
| 03 Tra cứu | Lookup mã + email/phone qua API thật; thêm inline validation/focus và quay về danh sách. Kết quả chỉ đọc; không suy diễn có quyền quản lý chuyến. | PASS browser giả lập. BE thật: thiếu liên hệ 400, mã không tồn tại 404. Lookup thành công thật chưa có booking. |
| 04 Chi tiết | Giữ DTO strict; bổ sung tên tàu/mã chuyến, hồ sơ bản ký/thời điểm, tiền đã đối soát/còn thiếu khi BE cung cấp, hồ sơ hành khách và cabin. Missing field không gán giá trị giả. Bỏ cuộn lồng ở action rail. | PASS decoder/browser giả lập. Không có booking thật để nghiệm thu dữ liệu đầy đủ. |
| 05 Hợp đồng | Quyền BOOKING_CONTRACT_MANAGE + booking/contract Draft. Thêm review modal, filing ref tối đa 255 ký tự, submit lock, refresh sau thành công. Hợp đồng không đồng nghĩa booking/payment confirmed. | PASS unit payload + browser double-submit/focus/Escape. |
| 06 Xác nhận booking | BOOKING_CONFIRM, Draft, hợp đồng Accepted; acknowledgement không thay thế BE kiểm tra chứng từ/cọc/capacity. Sửa lỗi 409 bị mất khi tự refresh: giữ lỗi nghiệp vụ trong modal. | PASS browser giả lập cho lỗi BOOKING_DEPOSIT_NOT_PAID và thành công. BE thật BLOCKED. |
| 07 Hủy | Giữ cancellation case sẵn có; thêm confirmation và cảnh báo chưa hủy cho tới khi được duyệt. Unknown case request khóa gửi lại qua reload bằng tham chiếu theo user/booking. Legacy direct cancel chỉ hiện theo cơ chế phát hiện endpoint cũ; BE vẫn quyết định CANCELLATION_CASE_REQUIRED. | PASS browser case request + timeout/reload. Không mở quyền tài chính hoặc tự duyệt hủy. |
| 08 Đổi cabin | Legacy: quyền CABIN_ASSIGN hoặc BOOKING_UPDATE, active passenger, cabin khác, capacity > 0, preview trước/sau và modal, readback BE. Fare/package: bỏ action không tương thích ở detail và thông báo giới hạn. | PASS browser legacy. Fare/package BLOCKED: BE changeCabin từ chối mọi fareOfferId bằng FARE_CABIN_CHANGE_NOT_SUPPORTED. |
| 09 Xem chuyến mở bán | Thêm `/admin/bookings/cruises`, sử dụng GET /cruise và sellability cho từng chuyến. Tên/mã/tàu/ngày/trạng thái từ response. Chỉ có CTA tạo khi sellable và có BOOKING_CREATE. | PASS unit/browser giả lập; BE thật trả rỗng đúng DB hiện tại. Không dùng nguồn này cho lịch sử booking. |

## Những phần đã đúng, giữ nguyên

- BookingAgentCruiseScope sử dụng CruiseStaff ACTIVE + role_in_cruise BOOKING_AGENT. Agent thuộc role quản trị chuyến khác có ngoại lệ scope theo BE, FE không tự đổi.
- BookingRepository.searchAssignedBookings không giới hạn người tạo booking. Detail/mutations gọi validateAccess/requireAssignedCruise.
- Booking quote chốt fingerprint, policyVersion, currency, fare offer và price revision; không dùng giá cộng thủ công làm giá xác nhận.
- Shared API client hủy request cũ khi token thay đổi; AdminAccountLayout và BookingSessionLayout retire private state khi account đổi. Không sửa cơ chế này.
- Permission từ /auth/me và work-policy vẫn bắt buộc. Không cấp toàn cục BOOKING_READ/CRUISE_READ, không hardcode username trong production.

## Contract gap / BE handoff

1. Không có endpoint lịch sử các chuyến được phân công cho Agent. FE dùng booking summaries có quyền đọc, đọc hết các trang. Không thể suy luận Agent chưa được phân công hay chưa có booking; empty copy ghi rõ giới hạn. Đề nghị BE trả distinct lịch sử có scope để giảm số request trên tài khoản lớn, không phải endpoint đã tồn tại.
2. Lookup là API công khai, không nhận principal và không kiểm tra CruiseStaff. `lookupBooking` chấp nhận liên hệ người đặt hoặc bất kỳ hành khách khớp dữ liệu BE; kết quả full detail không là bằng chứng quyền quản lý. FE lookup không render action nội bộ. Đây là contract/privacy boundary cần BE/product review, không thể đảm bảo scope nội bộ bằng FE.
3. `BookingPassengerResponse.documentNumber` được map từ protected document value. FE decoder hiện loại bỏ khỏi hồ sơ render. Việc giảm dữ liệu trên wire là trách nhiệm BE; không báo rằng FE đã giải quyết exposure API.
4. BE `/booking/available-cabins` chưa nhận `bookingPassengerId`; fare cabin change còn bị chặn trong BookingService. Không giả lập group assignment để vượt giới hạn.
5. Không đổi work scope ADMIN: ADMIN hiện có workspace hệ thống/tàu, không tự mở module booking. Các chức năng có sẵn và effective permission giữ nguyên.

## Skills được áp dụng

| Skill | Áp dụng thực tế |
|---|---|
| impeccable | Chạy context cho RealBookingPages, đọc audit/harden/craft-floor; audit Operate, inline errors, các modal, action hierarchy; detector trên target trả `[]`. Giữ OceVie hiện có, không dựng design system mới. |
| ui-ux-pro-max | Đọc hướng dẫn, tìm inline validation/focus management; layout responsive, controls cùng chiều cao, số/cột và bảng cuộn nội bộ. |
| frontend-design | Giữ ngôn ngữ OceVie và shared primitives, giới hạn trang quản trị, không thêm card trang trí hay dependency. |
| frontend-testing-debugging | Render/interaction loop, chụp desktop/tablet/mobile; Browser plugin không có nên dùng Playwright + Edge. |
| security-best-practices | Đọc hướng dẫn React + general JS frontend, rà scope, response trust boundary, không log credential/token, không suy luận quyền từ lookup, cô lập recovery theo user. Không giả vờ có Java-specific security skill. |
| expo-data-fetching | Áp dụng nguyên tắc loading/error/empty/content, shared AbortController và giữ dữ liệu khi mutation lỗi; không thêm Expo dependency. |

Project chỉ có ui-ux-pro-max và animate-ui trong `.agents/skills`. Không có skill Java/Spring/React architecture riêng trong catalog hiện tại; không cài thêm. Animate-ui không áp dụng vì không có yêu cầu motion. Design references: AGENTS.md, README.md, design-systems/ocevie/DESIGN.md, tokens.css, AdminUI và các component target đã đọc.
