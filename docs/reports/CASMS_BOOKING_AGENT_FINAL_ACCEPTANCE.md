# Booking Agent · Ma trận nghiệm thu

Ngày 20/11/2026. Ma trận ghi kết quả cho từng nghiệp vụ. Phiên Backend thật chạy trên database QA riêng. Cột trạng thái cuối phản ánh khả năng nghiệm thu với dữ liệu thật đầy đủ.

| Feature | Endpoint BE | Component FE | UI test | API test | Real E2E | Trạng thái | Vấn đề còn tồn tại |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01 · Danh sách đặt chỗ | `GET /booking` | `RealBookingList` | PASS fixture. Loading, lọc, lỗi, phân trang, quay lại. | PASS scoped read và serialize query. | PASS danh sách rỗng 200. | BLOCKED danh sách có bản ghi | 0 booking trong QA. |
| 02 · Tạo đặt chỗ | `GET /cruise`, sellability, cabins, package offers. `POST /booking/quotes`, `POST /booking`, `GET /booking/recovery` | `RealBookingCreatePage` | PASS fixture wizard, quote, create và GET recovery sau 503. | PASS fingerprint, giá, idempotency, 403 ngoài scope, recovery 404. | BLOCKED create thành công. | BLOCKED | Cần chuyến sellable, phân công, cabin và gói hợp lệ. |
| 03 · Tra cứu | `GET /booking/lookup` | `BookingLookupPage` | PASS fixture kết quả và focus lỗi. | PASS 400 và 404 thật. | PASS UI tra cứu 404. | BLOCKED tra cứu đúng booking | QA chưa có booking. DTO chưa có định danh người đại diện. |
| 04 · Chi tiết | `GET /booking/{id}` | `RealBookingDetail`, `BookingRecord` | PASS fixture trạng thái, thanh toán và ngày sinh. | PASS decoder và 404 thật. | BLOCKED hồ sơ thật có dữ liệu. | BLOCKED | Cần thêm booking trong và ngoài phạm vi để thử cả 200 và 403. |
| 05 · Hợp đồng | `POST /booking/{id}/contract/accept` | `BookingContractAcceptance` | PASS fixture kiểm tra input, modal và readback. | PASS document reference contract và 404 thật. | BLOCKED ghi nhận ký thật. | BLOCKED | Cần booking Draft và hồ sơ ký thật trong QA. |
| 06 · Xác nhận | `POST /booking/{id}/confirm`, `GET /booking/{id}` | `BookingOperations` | PASS fixture hợp đồng chưa ký, lỗi cọc stale, refresh và xác nhận. | PASS xử lý 400/500 và 404 thật. | BLOCKED xác nhận thật. | BLOCKED | Cần Accepted contract và verified collection. |
| 07 · Hủy | `GET/POST /booking/{id}/cancellations`, `POST /booking/{id}/cancel` | `StaffCancellation`, `BookingOperations` | PASS fixture hủy case, chờ, từ chối và legacy. | PASS giữ lỗi workflow 409 trong API fixture và history 404 thật. | BLOCKED case thành công. | BLOCKED | Cần hồ sơ QA hợp lệ và bật workflow cho lần chạy thật. |
| 08 · Đổi cabin | `GET /booking/available-cabins`, `POST /booking/change-cabin` | `BookingOperations` | PASS fixture legacy thành công và Fare guard. | PASS 403/404 thật và 409 fare giả lập. | BLOCKED đổi cabin thật. | BLOCKED | Cần booking legacy cùng tàu, cabin đích còn chỗ. Fare hiện bị BE chặn. |
| 09 · Mở bán | `GET /cruise`, `GET /cruise/{id}/sellability` | `BookingSaleCruises` | PASS fixture lọc, lỗi 500 và CTA. | PASS public sellability 200 và Agent ngoài scope 403 thật. | PASS UI empty đúng scope. | BLOCKED danh sách có chuyến sellable | Chuyến PUBLISHED trong QA trả `sellable=false`, chưa có phân công Agent. |

**Kết luận.** FE đạt typecheck, lint, build, 27/27 test Booking và browser fixture. Bộ test toàn Web Admin còn một lỗi OPS đã tái hiện trên HEAD gốc. E2E thật đã xác thực login, kiểm tra phạm vi, trạng thái rỗng và nhánh từ chối, với happy path bị chặn bởi dữ liệu QA.

- [Hoàn thiện giao diện](CASMS_BOOKING_AGENT_FINAL_POLISH_REPORT.md)
- [E2E Backend thật](CASMS_BOOKING_AGENT_REAL_BE_E2E_REPORT.md)
- [Regression và ảnh](CASMS_BOOKING_AGENT_REGRESSION_REPORT.md)
