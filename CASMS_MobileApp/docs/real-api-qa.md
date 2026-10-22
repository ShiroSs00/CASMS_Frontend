# Kiểm thử app qua Spring Boot và PostgreSQL

Cập nhật ngày 21/10/2026. App không có chế độ demo hoặc dữ liệu giả trong `src`.
Dữ liệu hành trình dùng khi kiểm thử được lưu trong PostgreSQL và đọc qua BE thật.

- FE: branch `feat/mobile-passenger-live-api`.
- BE: `main` tại `e6978f7`, giữ nguyên mã nguồn. Phạm vi công việc chỉ là FE.
- Database QA: `casms_mobile_qa`, PostgreSQL 16, `127.0.0.1:55432`.
- BE QA: `http://127.0.0.1:18080/api`.
- Metro web: `http://[::1]:8084`.

Database `casms` hiện có và cổng 5432 không được dùng cho quy trình này. Cluster
QA cùng mật khẩu ngẫu nhiên nằm trong `.expo/` đã được gitignore. Các script đều
trỏ cố định vào database QA; seed có kiểm tra tên database và chạy trong transaction.
Không chạy BE vào database hiện có với `ddl-auto: create` trong cấu hình mặc định.
Script BE QA ghi đè thành `update`; bootstrap khai báo ba enum PostgreSQL theo
migration V1 để Hibernate tạo đủ schema của môi trường mới.

## Chạy lại

Từ thư mục CASMS_MobileApp, dùng PowerShell:

```powershell
.\tests\integration\initialize-database.ps1
.\tests\integration\start-backend.ps1
```

Giữ terminal BE chạy. Trong terminal khác, sau khi BE báo đã khởi động:

```powershell
python tests/integration/qa_database.py --file tests/integration/seed-asian-voyage.sql
$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:18080/api'
node node_modules/expo/bin/cli start --web --port 8084 --localhost
```

Nếu PostgreSQL ở thư mục khác, truyền `-PostgresBin` cho script khởi tạo. Script
không xóa cluster sẵn có và sẽ dừng nếu gặp một thư mục khởi tạo dở chưa rõ trạng thái.
Seed có thể chạy lại; không ghi đè người dùng/bản ghi đã tồn tại.

Tài khoản QA do seed tạo, chỉ dùng trong môi trường này:

- Tên đăng nhập: `ocevie.mobile.qa`
- Mật khẩu: `OcevieQa@2026`
- Vai trò: `PASSENGER`, dùng quyền mặc định của BE, không cấp quyền staff để né 403.

Seed gồm một tàu, bốn hạng phòng, hai đặt chỗ của hành khách, bốn cảng Singapore /
Port Klang / Penang / Phuket, ngày hải trình với múi giờ Singapore–Malaysia–Thái Lan,
dịch vụ, hoạt động, tour và gói quyền lợi. Đây là dữ liệu QA, không phải lịch khai
thác, giá bán hoặc đặt chỗ thương mại. Nó không được import vào app.

## Kiểm thử tự động

```powershell
node --test tests/*.test.mjs
node --test tests/integration/real-backend.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/expo/bin/cli lint
```

Integration test sử dụng HTTP thật, JWT thật, logic Spring thật và database QA.
Các write test tạo rồi hủy yêu cầu/đăng ký/đặt chỗ; lịch sử được giữ trong QA.
Test gói quyền lợi sử dụng POST/PUT/DELETE và không mô phỏng thanh toán.
Một test đối chiếu trực tiếp bản ghi PostgreSQL sau thao tác API.

## Giới hạn API BE hiện có

Không sửa source, quyền hoặc contract BE để làm cho kiểm thử FE vượt qua.

1. `/booking/available-cabins` từng trả HTTP 500 trên PostgreSQL QA vì không suy ra
   kiểu tham số trong `:cabinType IS NULL` (SQLState 42P18). Bản sửa BE thử nghiệm đã
   được hoàn tác theo phạm vi FE-only. Cần chuyển lỗi này cho người phụ trách BE;
   chưa thể xác nhận luồng tìm phòng và tạo đặt chỗ hoàn chỉnh với BE gốc.
2. Danh sách package assignment trả 403 khi hành khách truyền `bookingId`.
   Đã sửa ở FE: bỏ query chỉ dành cho staff, lấy danh sách của chính tài khoản rồi
   lọc bằng `bookingPassengerId` từ chi tiết đơn. Không thay đổi quyền BE.

Kết quả sáu integration test và ảnh chọn cabin trước đây dùng bản BE thử nghiệm đã
hoàn tác, nên không phải bằng chứng các luồng này chạy được trên BE gốc. Chạy lại
suite HTTP ở trên để ghi nhận kết quả trên môi trường BE thực tế. Giữ assertion
phòng trống để lỗi server được báo rõ, không biến lỗi thành một test thành công.

52 unit test FE đã qua; TypeScript, lint và export Android/iOS/web đã qua trước khi
hoàn tác BE. UI đã thực hiện yêu cầu dịch vụ và kiểm tra bản ghi PostgreSQL. Các
kiểm tra này không thay thế xác minh tích hợp trên BE gốc.

## Điện thoại và triển khai

Trên điện thoại thật, thay host API bằng địa chỉ LAN/HTTPS có thể truy cập của BE,
không dùng localhost của điện thoại. Database vẫn chỉ cần BE truy cập. Bản release
phải cấu hình API deployment thực, không trỏ vào cổng QA. App không tự chuyển sang
mock khi mất kết nối. Cần thử tiếp keyboard, safe area, Reduce Motion, chữ lớn và
hardware back trên thiết bị thật; bundle export không chứng minh tốc độ 60/120 FPS.

Để dừng PostgreSQL QA sau khi dừng BE:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe' -D '.expo\postgres-qa' -m fast -w stop
```

Giữ lại thư mục QA để lần sau mở lại dữ liệu; không cần xóa hoặc tạo lại cluster.

## Cập nhật sau khi pull e6978f7

BE upstream đã sửa truy vấn phòng trống. Sau khi áp dụng migration V10 có sẵn
vào database QA, cả sáu integration test HTTP đều qua trên BE nguyên bản mới.
Lỗi phòng trống và kết quả thử nghiệm được mô tả phía trên là lịch sử trước pull.
Chi tiết API mới và kiểm tra quyền xem model: [audit](backend-mobile-audit-2026-10-21.md).
