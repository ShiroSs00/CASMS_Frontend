# CASMS Booking Agent — Frontend implementation

Ngày: 2026-11-19 (Asia/Saigon). FE base: `main@703c239`; BE tham chiếu chỉ đọc: `main@0cc292e`. Đã fetch cả hai repo trước khi sửa; FE mới hơn SHA `9f064da` trong brief. Báo cáo lập trước commit; xuất bản sau kiểm chứng theo yêu cầu riêng của người dùng. Chỉ sửa source Frontend; không sửa source, migration, schema hoặc business rules BE.

## Thay đổi code thật

| File (dưới CASMS_WebAdmin) | Thay đổi |
|---|---|
| src/features/booking/api/real-booking-api.ts | historyCruises từ booking pages; saleCruises tách dữ liệu inspect và lựa chọn tạo; optional detail fields được validate. |
| src/features/booking/api/booking-quote-api.ts | recoverQuotedBooking GET-only và kiểm tra cruise identity. |
| src/features/booking/model/booking-agent.ts | Lookup field validation và recovery intent tối thiểu theo owner; không lưu hành khách/contact/token. |
| src/features/booking/model/booking-mutation.ts | Copy tiếng Việt từ mã lỗi hợp đồng/cọc/cancellation/fare/recovery đã xác minh. |
| src/features/booking/pages/RealBookingPages.tsx | Bộ lọc lịch sử, table scoped, count/loading/error, detail/lookup, modal actions, legacy cabin selection; không gọi fare assignment không được BE hỗ trợ. |
| src/features/booking/pages/RealBookingCreatePage.tsx | Quote currency từ server, intent trước create, recovery sau reload/unknown; footer modal; giữ wizard/API thật. |
| src/features/booking/pages/BookingSaleCruises.tsx | Trang danh sách chuyến để Booking Agent xem và bắt đầu tạo booking khi đủ điều kiện. |
| src/features/booking/components/BookingContractAcceptance.tsx | Mã bản ký + review/confirm modal, max 255, lock, refresh chỉ khi thành công. |
| src/features/booking/components/BookingAgent.module.css | Tokens OceVie, toolbar, bảng số, responsive, bỏ cuộn lồng của action panel, wizard header. Chỉ scope module Booking Agent. |
| src/features/booking/components/RealBookingUI.tsx | Phân biệt access denied 403 với lỗi tải khác. |
| src/features/booking/index.ts; src/app/pages/AdminBookingPages.tsx; src/app/router.tsx | Export và route `/admin/bookings/cruises`; dùng guard booking hiện có. |
| src/shared/cancellation/CancellationCases.tsx | Optional `confirmRequest=false` giữ tương thích các caller khác. Booking detail bật review dialog và chống resend unknown qua reload; không đổi API/cancellation workflow. |
| tests/booking-agent.test.mjs | 21 test mới về API, DTO, permission, validation, quote và recovery. |

## UI/UX trước → sau

- Filter register ở rail hẹp và lệ thuộc catalogue còn bán → toolbar có nhãn đầy đủ, tải lại/xóa, nguồn lịch sử scoped riêng; bảng có tổng tiền và số khách khi API cung cấp.
- Empty chung dễ gây hiểu là chưa có phân công → thông báo đúng phạm vi và giới hạn contract; 403/500 giữ error riêng.
- Contract ghi ngay từ form → modal đối chiếu đúng booking/reference, footer hành động và khóa double-submit.
- Quote cứng USD → đúng currency/amount từ server; wizard vẫn giữ draft và selection/price revision.
- Action rail cuộn lồng, khó tìm thao tác → action panel nằm theo trang; bảng cuộn trong vùng riêng, không tràn viewport.
- Đổi cabin fare có UI nhưng BE luôn từ chối → read-only limitation; legacy vẫn có before/after và chỉ chọn cabin khác còn sức chứa.
- Gửi case chưa có review → review tác động, giữ trạng thái booking tới lúc được duyệt; timeout không tự gửi lại.

## State và dữ liệu

Recovery booking lưu sessionStorage `{idempotencyKey, cruiseId}` trong key theo userId. Sau unknown/reload chỉ GET `/booking/recovery`, kiểm tra response, xóa intent khi kết quả xác minh được. 404 recovery không phải bằng chứng để tạo lại. SessionStorage không chia sẻ giữa tài khoản; không lưu JWT, email hay draft hành khách trong intent.

Case cancellation chỉ lưu key tối thiểu theo userId/bookingId trong nhánh confirmRequest; unknown khóa submit qua reload. Lịch sử request vẫn đọc được. Nếu không xác minh được kết quả, cần hỗ trợ kiểm tra, không dùng request mới làm workaround.

Các draft vẫn nằm trong BookingProvider theo session; không persist toàn bộ PII vào storage. Guard và shared client vẫn là cơ chế cũ. Không thay Finance, Check-in, Mobile hay WebBooking source.

## Bằng chứng UI

- [Danh sách desktop](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-list-1440.png)
- [Chi tiết desktop](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-detail-1440.png)
- [Quote mobile](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-quote-390.png)
- [BE thật: danh sách rỗng mobile](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-live-empty-390.png)

Ảnh có dữ liệu QA của lượt browser giả lập được ghi rõ bằng receipt `booking-agent-browser.json`; không coi là booking production hoặc E2E BE thật.
