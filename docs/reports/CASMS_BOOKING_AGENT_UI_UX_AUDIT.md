# Rà soát workspace Booking Agent

Ngày 20/11/2026, giờ Việt Nam. Phạm vi là năm route đặt chỗ của Web Admin và các nghiệp vụ mà Booking Agent được cấp quyền trên chuyến thuộc phạm vi của mình.

GitHub xác nhận `main` của FE ở `0a43895` và BE ở `276504f`. Checkout local tương ứng ở `59e56de` và `0cc292e`. Đã so sánh chênh lệch qua GitHub vì Git CLI không phân giải được github.com. Trong các file Booking Agent, FE upstream bổ sung ID cho hai select của bộ lọc. Shared `Field` tự gắn ID trùng với `htmlFor` trong triển khai này. Backend upstream có thay đổi `CruiseController`, còn các controller, service và DTO Booking/Cancellation được đối chiếu vẫn cùng phiên bản giữa hai mốc. Kiểm thử local sử dụng checkout đã nêu.

| Nghiệp vụ | Nguồn BE và giao diện gốc | Điểm cần sửa hoặc giới hạn |
| --- | --- | --- |
| 01 · Danh sách đặt chỗ | `GET /booking`, `RealBookingPages` | Bộ lọc và phân trang chỉ có trong state. Quay lại từ chi tiết làm mất ngữ cảnh. Bảng rộng 960 px ở mọi chiều rộng. Nguồn lọc lịch sử đã đúng, lấy từ danh sách đặt chỗ có scope. |
| 02 · Tạo đặt chỗ | Cruise/Sellability, Available Cabins, Package Offers, Quotes, Create, Recovery. `RealBookingCreatePage`, `LiveBookingFields`, `CruisePackageCabinSelection` | Wizard và xác thực Quote đã có. Thông tin chuyến thiếu trên bước chọn, báo giá chỉ xem được trong modal, sau tạo bị chuyển thẳng sang chi tiết. |
| 03 · Tra cứu | `GET /booking/lookup`, `BookingLookupPage` | Form có kiểm tra hợp lệ nhưng focus tìm toàn trang. Lỗi liên hệ không khớp thiếu hướng dẫn. DTO không chỉ ra ID người đại diện, và thứ tự hành khách trong response không xác nhận vai trò người đại diện. |
| 04 · Chi tiết | `GET /booking/{bookingId}`, `BookingRecord` | Chuyến, hợp đồng, giá và thanh toán nằm chung một nhóm. Bảng hành khách chưa thể hiện tên gói vé. Sidebar có thể dài hơn vùng làm việc. |
| 05 · Ghi nhận hợp đồng | `POST /booking/{bookingId}/contract/accept`, `BookingContractAcceptance` | Đã có dialog và khoá gửi. Ô nhập bản ký nằm ngoài mục hợp đồng, thiếu lỗi đặt cạnh trường khi chỉ nhập khoảng trắng. |
| 06 · Xác nhận đặt chỗ | `POST /booking/{bookingId}/confirm`, `BookingOperations` | Checkbox chứng từ thủ công gây nhầm với khoản thu do BE đối soát. Cọc và hợp đồng cần xuất hiện ngay trong bước kiểm tra. BE kiểm tra khoản thu, khoản hoàn, sức chứa và vòng đời. |
| 07 · Hủy | `GET/POST /booking/{bookingId}/cancellations`, `POST /booking/{bookingId}/cancel`, `StaffCancellation` | Workflow case và legacy đã có. Cần phản hồi rõ tác động và kiểm tra lý do trước khi mở dialog. Hủy trực tiếp phụ thuộc vào chế độ workflow và kiểm tra BE. |
| 08 · Đổi cabin | `GET /booking/available-cabins`, `POST /booking/change-cabin` | Legacy đã có mutation, phần so sánh cabin còn thiếu boong, sức chứa và số chỗ. BE chặn hành khách có fare offer bằng `FARE_CABIN_CHANGE_NOT_SUPPORTED`. DTO chi tiết có số boong, còn sức chứa chỉ hiện nếu cabin hiện tại có trong dữ liệu khả dụng. |
| 09 · Chuyến mở bán | `GET /cruise`, `GET /cruise/{id}/sellability`, `BookingSaleCruises` | Bảng thô khó đọc trên mobile. Cần lọc trên sellability trả về và chỉ cung cấp CTA khi chuyến đủ điều kiện, tài khoản có quyền. |

## Hợp đồng nghiệp vụ đã xác minh từ source

- `BookingAgentCruiseScope` và điều kiện phân công do BE áp dụng. Một danh sách rỗng chỉ mô tả dữ liệu trong phạm vi truy vấn.
- Xác nhận hợp đồng, xác nhận đặt chỗ và số tiền đã đối soát là ba dữ liệu nghiệp vụ độc lập. Lịch trả tiền thể hiện nghĩa vụ theo hợp đồng.
- Luồng báo giá hiện hành kiểm tra fingerprint, policy version, fare-price revision và thời hạn. Khi kết quả tạo chưa xác định, recovery chỉ đọc theo idempotency key.
- Cơ chế duyệt hủy đi theo `allowedActions` từ BE. Tạo yêu cầu hủy vẫn giữ nguyên trạng thái đặt chỗ cho tới khi backend hoàn tất quy trình.

Chi tiết API nền có tại [đối chiếu hợp đồng Booking Agent](CASMS_BOOKING_AGENT_BE_FE_CONTRACT.md).
