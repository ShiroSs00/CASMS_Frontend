# Kiểm hồi quy A0-FE

Baseline FE `3c01db0`, BE `0bc2b38`. Đã đọc Phase 0 test report, suite Mobile, root/Passenger/POS layouts, auth/POS lifecycle, transport và SDK 58. Đã sửa ba test file hiện có và thêm `tests/mobile-foundation.test.mjs`; nhánh lỗi được sửa tại các file trong [triển khai](CASMS_MOBILE_PHASE_A0_FE_IMPLEMENTATION.md).

| Gate | Trước | Sau | Evidence |
|---|---|---|---|
| TypeScript | Pass | Pass | `npm run typecheck`, qua entry point Windows. |
| Expo lint | Pass | Pass | `npm run lint`, qua entry point Windows. |
| FE tests | 98 test pass | 108/108 pass, 0 fail, 0 skip | `run-mobile-tests.bat` gọi `npm test`. |
| SDK deps | Offline map checked | Local SDK map báo up to date | `expo install --check` có cảnh báo dependency check offline. |
| Expo Doctor | Thiếu tool | BLOCKED_BY_ENVIRONMENT | npm cache trả ENOTCACHED, giữ dependencies đã lock. |
| Expo export Android/iOS/Web | Pass với API URL | Pass, 36 route tĩnh Web | `expo export --platform all` với URL loopback chỉ cho bundling. |
| Web config thiếu | Phase 0 fail static render check-in | Pass, HTML check-in có trạng thái “Chưa thể kết nối” | Export web với dotenv tắt, bỏ biến API và kiểm tra HTML route check-in. |
| Windows | Thiếu entry riêng Mobile | Metro và guard pass | Metro khởi động tại localhost:8081. Sai option, thiếu API URL và QA chưa xác nhận đều exit 2. |
| HTTP QA | 7 ca lỗi hook login vì cổng cố định | BLOCKED_BY_ENVIRONMENT / BLOCKED_BY_DATABASE | Runner đã được kiểm nhánh cấm chạy khi chưa xác nhận. Không thực thi ca QA thật. |

## Lỗi gốc và test thay đổi

- Hai test được cập nhật theo phạm vi đã đổi. Test suy URL từ Metro kiểm URL explicit. Test POST hủy legacy chuyển sang đọc booking đã hủy, kiểm lý do và kiểm adapter thiếu phương thức ghi.
- Thêm kiểm HTTP status/code, tokenType/email sai kiểu trong login DTO, invalid/empty/void payload, abort trước request và abort khi 401 trả muộn. Các test timeout, xử lý POS sessions, service recovery, sale idempotency, role routing và query focus tiếp tục chạy.
- Thêm regression deep link, kiểm UI không gọi hủy legacy, kiểm QA URL confirmation, readiness, login/fixture error. Các probe dùng stub ở lớp unit.
- Thêm test restore bỏ JWT khác API URL và refresh trả 403 vẫn giữ phiên. Ca 403 phát hiện timer refresh trước đó bị bỏ quên khi lên lịch retry. Store dọn timer trước khi thực hiện refresh, để logout dọn lịch đang hoạt động.

Acceptance FE gồm typecheck, lint, unit, compatibility local, export và guard Windows. Nghiệm thu thiết bị, đăng nhập QA, đột biến dữ liệu API và chứng minh end-to-end chờ điều kiện [harness](CASMS_MOBILE_PHASE_A0_TEST_HARNESS.md). Bản Expo export là bundle/static render, chưa phải APK/IPA, signing hoặc kiểm native.
