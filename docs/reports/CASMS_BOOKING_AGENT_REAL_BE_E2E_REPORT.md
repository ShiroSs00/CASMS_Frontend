# Booking Agent · E2E trên Backend thật

Ngày 20/11/2026. **Smoke và các nhánh từ chối đã chạy đạt. Giao dịch đầy đủ bị chặn do dữ liệu QA.**

## Môi trường và tác động

- Ban đầu cổng 8080 đã dừng. PostgreSQL làm việc lắng nghe cổng 5432. Truy vấn với `default_transaction_read_only=on` xác nhận 128 migration thành công, V137, 0 chuyến PUBLISHED, 0 phân công Booking Agent ACTIVE và 0 booking. Launcher `--check` chạy đạt.
- Cụm QA có sẵn trên cổng 15439 được khởi động lại. Database QA gốc `casms_qa_local` ở V101. Tạo bản sao độc lập `casms_ba_final_20261120101033` để chạy launcher. Spring Boot Java 21 trên `127.0.0.1:8080/api` kết nối bản sao. Web Admin chạy build qua Vite Preview `127.0.0.1:5185`, proxy `/api` tới cổng 8080.
- Nhật ký launcher cho thấy `DatabaseConfig` gọi Flyway repair trong startup. Bước tự động đó đã chạy trên bản sao QA dù yêu cầu loại trừ repair. Kiểm tra chỉ đọc sau startup cho thấy metadata và checksum các version đến V101 trùng QA gốc. Launcher áp 29 migration mới lên bản sao, đạt V137 với 128 bản ghi thành công và 0 lỗi. Database làm việc và QA gốc được truy vấn chỉ đọc.
- Đăng nhập UI bằng tài khoản demo đã có. `GET /auth/me` xác nhận `BOOKING_AGENT` và 38 quyền hiệu lực. Ảnh chụp che tên đăng nhập. Báo cáo ghi trạng thái và mã lỗi API.
- Sau kiểm thử, đã dừng Backend và cụm PostgreSQL QA đã khởi động cho lượt chạy. Cổng 8080 và 15439 trở về trạng thái dừng, PostgreSQL làm việc tại 5432 vẫn lắng nghe. Bản sao QA được giữ để đối chiếu.

## Kiểm kê dữ liệu sau migration

| Điều kiện | Kết quả |
| --- | --- |
| Chuyến PUBLISHED | 1 |
| Sellability của chuyến PUBLISHED | `GET /cruise/{id}/sellability` công khai trả 200, `saleState=NOT_YET_OPEN`, `sellable=false` và `transactionReady=false`. |
| Phân công Booking Agent ACTIVE | 0 |
| Cabin vật lý trên chuyến PUBLISHED | 14 cabin vật lý trên tàu. API công khai trả tồn chỗ tổng hợp dương. Agent chưa được phân công nhận 403 khi truy vấn khả dụng nên chưa xác nhận được cabin còn chỗ trong scope nghiệp vụ. |
| Giá fare | 10 bản ghi giá trong bản sao. Một phiên bản giá được duyệt khớp phiên bản thương mại của gói PUBLISHED hiện hành trên chuyến PUBLISHED. Chưa có tổ hợp giá và cabin bán được cho Agent vì chuyến PUBLISHED hiện không sellable và chưa được phân công. |
| Booking, hợp đồng và thanh toán | 0 booking, 0 hợp đồng Draft/Accepted, 0 payment Confirmed. |

## Thao tác chạy thật

| Thao tác | Kết quả API / UI |
| --- | --- |
| Đăng nhập và đọc quyền | 200 / 200. Vào workspace Booking Agent. |
| Danh sách Booking và chuyến PUBLISHED trong scope | 200 / 200, hai danh sách rỗng như SQL kiểm kê. UI thể hiện empty state. |
| Agent chưa được phân công truy cập sellability, cabin và quote của chuyến QA | 403 `ACCESS_DENIED` ở cả ba endpoint. |
| Tra cứu sai hoặc thiếu dữ liệu | 404 `RESOURCE_NOT_FOUND` và 400 `MISSING_REQUIRED_PARAMETER`. Form vẫn giữ mã nhập sau 404. |
| Chi tiết, ghi nhận hợp đồng và xác nhận với ID booking không tồn tại | 404 `RESOURCE_NOT_FOUND`. |
| Lịch sử hủy với ID không tồn tại | 404 `RESOURCE_NOT_FOUND`. Luồng tạo case thật cần booking đã có và workflow tương ứng. |
| Đổi cabin với ID hành khách không tồn tại | 404 `RESOURCE_NOT_FOUND`. |
| Recovery với khóa ngẫu nhiên | 404 `RECOVERY_NOT_FOUND`. |
| Chuỗi giao dịch thành công | **BLOCKED** từ bước chọn chuyến đủ điều kiện. Cần chuyến sellable, phân công đúng, cabin/gói hợp lệ và hồ sơ Booking QA. Xác nhận cần thêm khoản thu thật có bằng chứng và quyền nghiệp vụ liên quan. |

Ảnh thật từ Backend QA qua Edge tại localhost gồm [danh sách 1440](booking-agent-final-evidence/20-be-that-danh-sach-1440.png), [danh sách 390](booking-agent-final-evidence/20-be-that-danh-sach-390.png), [chuyến mở bán 768](booking-agent-final-evidence/21-be-that-chuyen-mo-ban-768.png) và [tra cứu 404](booking-agent-final-evidence/22-be-that-tra-cuu-khong-ton-tai-390.png).
