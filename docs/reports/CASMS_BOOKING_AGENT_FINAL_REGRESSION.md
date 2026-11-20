# Hồi quy Booking Agent

Ngày 20/11/2026, giờ Việt Nam. Kiểm tra trong `CASMS_WebAdmin`, Node.js 24.18.0. Source được kiểm tra trên checkout FE `59e56de` và BE `0cc292e`, sau khi đối chiếu chênh lệch với HEAD GitHub FE `0a43895` và BE `276504f`.

| Hạng mục | Kết quả | Bằng chứng |
| --- | --- | --- |
| TypeScript | **PASS** | `npm run typecheck`. |
| ESLint | **PASS** | `npm run lint`, dùng `--max-warnings 0`. |
| Build Web Admin | **PASS** | `npm run build`. Vite vẫn cảnh báo các bundle chung lớn hơn 500 kB. |
| Booking tests | **PASS · 22/22** | `node --import ./tests/helpers/import-loader.mjs --test ./tests/booking-agent.test.mjs ./tests/booking-contract.test.mjs`. |
| Toàn bộ test Web Admin | **FAIL · 63/64** | `node --import ./tests/helpers/import-loader.mjs --test ./tests/*.test.mjs`. Test quyền OPS với `transaction-policy` trong `cruise-workspace.test.mjs:15` thất bại trên các file thuộc baseline. Đã xác minh test, module preparation và component trực tiếp được import đều trùng với HEAD local. |
| Kiểm tra trình duyệt | **PASS · fixture** | Edge và Playwright thực hiện luồng chính của cả chín nghiệp vụ. Xem assertions, trạng thái lỗi và ảnh ở [báo cáo trình duyệt](CASMS_BOOKING_AGENT_UI_UX_BROWSER_E2E.md). |
| Impeccable | **PASS · detector** | Không báo finding trên các file layout và component được kiểm. |
| Đối chiếu hợp đồng API | **PASS · source** | Đối chiếu Booking, Cruise, Cancel, scope, DTO, Quote và Idempotency. Xem [audit API và UI](CASMS_BOOKING_AGENT_UI_UX_AUDIT.md). |
| Nghiệm thu giao dịch trên Backend thật | **BLOCKED** | API local chưa lắng nghe và chưa có tài khoản Booking Agent phù hợp để nghiệm thu. |

## Giới hạn còn mở

- **Fare cabin:** BE từ chối đổi cabin cho hành khách thuộc fare offer. FE hiển thị giới hạn và chỉ cho đổi cabin legacy hợp lệ. Browser xác nhận guard cho hồ sơ fare; nhánh tạo fare và giữ chỗ theo hạng vẫn dùng component và contract hiện có, chưa thực hiện giao dịch fare trong browser fixture.
- **Tra cứu:** DTO chưa trả ID người đại diện, FE hiển thị danh sách hành khách được BE trả về và phần thanh toán ở chế độ chỉ đọc.
- **Đổi cabin:** Sức chứa cabin hiện tại chỉ có khi giá trị đó xuất hiện trong danh sách cabin khả dụng; số boong lấy từ dữ liệu hành khách chi tiết.
- **Hủy:** Fixture đã chạy tạo case, chờ duyệt, hiển thị case bị từ chối và hủy trực tiếp khi workflow tắt. Hành động duyệt/từ chối và hoàn tiền của bộ phận có thẩm quyền nằm ngoài luồng Booking Agent.
- **Kết quả hủy không xác định:** Lịch sử case hiện chưa trả operation key để tự đối chiếu yêu cầu cụ thể. FE giữ khóa gửi lại và cho tải lịch sử để hỗ trợ đối chiếu.

Xem [danh sách file và quyết định giao diện](CASMS_BOOKING_AGENT_UI_UX_IMPLEMENTATION.md).
