# Bàn giao phần FE và yêu cầu BE — 23/10/2026

## Phạm vi

Yêu cầu: sửa UX/UI form Dịch vụ/Sản phẩm và nối luồng gói, hợp đồng, thanh toán, lịch dịch vụ, readiness, vận hành. Người dùng yêu cầu giữ nguyên BE và bỏ lãi suất trả góp. Vì vậy không có API mới hay sửa quyền/schema/logic BE trong thay đổi này.

## FE đã triển khai

| Khu vực | Nội dung | Nơi mở |
|---|---|---|
| Form dịch vụ/sản phẩm/gói | Tách CSS form khỏi filters; nhãn sát control, 2 cột desktop/1 cột mobile, mô tả và nút lưu riêng; sửa tiền tệ trống về USD và sức chứa > 0 | `/admin/services/new`, `/admin/products/new`, `/admin/service-packages/new` |
| Gói dịch vụ | BASIC, PLUS, PREMIUM, PREMIUM_PLUS, ADVANCED, ADD_ON; custom bằng tên/mô tả và thành phần tự chọn; Extra dùng ADD_ON | Tạo gói rồi thêm quyền lợi tại chi tiết gói |
| Quyền lợi | Hiển thị tên dịch vụ và quyền lợi category/định mức/giảm giá từ response BE; không tự suy ra quyền lợi mới theo tên tier | Chi tiết gói |
| Hợp đồng/lịch thanh toán | Hiển thị mã, trạng thái hợp đồng và FULL/DEPOSIT/STAGES; giữ lịch BE, không tính lãi | Đặt chỗ/hợp đồng và tài chính |
| Tài chính | Đọc ledger riêng bằng PAYMENT_READ/PAYMENT_REPORT; tạo payment Pending; xác nhận qua mã biên nhận; có idempotency cho retry cùng payload | `/admin/staff/finance`, chọn booking |
| Lịch dịch vụ | Đọc slot, thêm khung giờ theo chuyến qua API sẵn có; chọn slot khi tạo service request, kiểm tra số lượng và thời hạn lúc gửi, thêm idempotency | Chi tiết dịch vụ và `/admin/service-requests/new` |
| Nhân sự | Danh sách phân công; chọn nhân viên bằng identity lookup và gán vai trò đúng quyền | Chi tiết chuyến |
| Hành khách | Đọc manifest theo CRUISE_MANIFEST_READ; không coi khách có booking là đã boarding; không trình bày MAIN như tên boong thật | Chi tiết chuyến |
| An toàn | Danh sách/tạo buổi hướng dẫn, ghi danh, điểm danh có mặt/vắng và hoàn tất, đều có quyền và xác nhận | Chi tiết chuyến hoặc quầy check-in chọn chuyến |
| Check-in | Tra cứu bằng mã booking + email; chọn khách; đọc hồ sơ, bắt đầu khi chưa có hồ sơ (404), hoàn tất sang BoardingReady theo API; FE chặn booking chưa Confirmed | `/admin/staff/checkin` |
| Readiness | Hiển thị trạng thái itinerary thật thay vì suy ra 'chưa cấu hình'; thông báo mâu thuẫn OPEN_FOR_SALE/APPROVED; không đổi false của BE thành true | Chi tiết chuyến |

Với hướng dẫn an toàn, CHECKIN_STAFF có thể chọn chính tài khoản hiện tại làm giảng viên; nếu đọc được staff trên chuyến thì có thể chọn từ danh sách phân công. Không yêu cầu nhập UUID thủ công. Quyền được kiểm tra lại tại thao tác và BE vẫn quyết định hợp lệ.

## API đang dùng — đã tồn tại trong BE

- `GET /servicepackage/services/{id}/schedules`, `POST /servicepackage/schedules`.
- `POST /servicepackage/requests` với serviceScheduleId và idempotencyKey; sửa request giữ payload update hiện có.
- `GET /servicepackage/packages/{id}/benefits`, `GET /servicepackage/service-categories`.
- `GET /payment/booking/{bookingId}`, `POST /payment/process`, `POST /payment/{paymentId}/confirm`.
- `GET/POST /cruise/{cruiseId}/staff`, `GET /cruise/{cruiseId}/manifest`, `GET /identity/users` theo quyền controller.
- `GET /checkin/guidance-sessions/cruise/{cruiseId}`, `POST /checkin/guidance-sessions`, ghi danh/điểm danh/cập nhật trạng thái của buổi.
- `GET /booking/lookup`, `GET /checkin/passenger/{bookingPassengerId}/status`, `POST .../start`, `POST .../complete`.

## Những việc không thể hoàn tất chỉ ở FE

### 1. Chấp nhận hợp đồng và xác nhận booking — P0

BE tạo hợp đồng Draft và yêu cầu Accepted trước khi confirm booking. Chưa có endpoint chuyển sang Accepted. FE chỉ thể hiện trạng thái thật và lịch thanh toán; chưa có thao tác ghi nhận đã ký/chấp nhận hoạt động end-to-end.

Đề xuất BE bổ sung một thao tác nhận bookingId, mã tài liệu/biên bản ký, thời điểm ký, phương thức thanh toán đã chọn; lấy actor từ principal. Chốt role nào có quyền ghi nhận; kiểm tra booking không hủy, phiên bản hợp đồng và payment plan; lưu audit và trả hợp đồng/booking mới. Đây là thiết kế đề xuất, **không phải API đã triển khai**. Không cần lưu/tính lãi suất theo yêu cầu mới của người dùng.

### 2. Quyền finance đọc booking — P0

`BookingService.validateAccess()` chỉ coi ROLE_ADMIN, ROLE_BOOKING_AGENT, ROLE_CUSTOMER_SERVICE là staff. Finance có BOOKING_READ nhưng chi tiết booking của khách vẫn 403. FE giữ lỗi truy cập; ledger dùng endpoint thanh toán đúng quyền riêng. Không dùng token role khác, lookup thông tin khách ngầm hay đổi dữ liệu để vượt guard. Cần BE thống nhất quyền đọc booking và dữ liệu tài chính theo principal.

### 3. Phân bổ tiền vào installment — P0

Payment confirm chỉ lưu payment; không đồng bộ installment, không tự xác nhận booking như phần mô tả endpoint. FE không tự sửa các kỳ Scheduled thành Paid và không gắn thanh toán vào kỳ bằng phép tính cục bộ.

Cần BE cung cấp phân bổ khoản thu theo installment hoặc quy tắc phân bổ chính thức, lưu chứng từ, số dư từng kỳ và tổng đã thu, xử lý trả một phần/hoàn/void/idempotency. Trả snapshot cập nhật để FE refresh. UI hiện hỗ trợ khoản thu độc lập, chưa phải hoàn tất đồng bộ khoản thu theo kỳ.

### 4. Readiness — P1

BE chỉ chấp nhận đúng APPROVED; OPEN_FOR_SALE lại bị báo chưa phê duyệt. Cần BE quyết định tập trạng thái được duyệt và dùng cùng điều kiện cho readiness/publish. FE hiện chỉ giải thích mâu thuẫn, không bỏ điều kiện publish hoặc giả ready=true.

### 5. Gói custom/Extra và quyền lợi — P1

BE có ADD_ON và cho đặt tên/thành phần tùy chỉnh, nhưng chưa có enum CUSTOM/EXTRA riêng; không gửi các enum không hỗ trợ. Booking hiện chỉ có một tourPackageId cho mỗi khách. Vì vậy chưa thể mua đồng thời nhiều gói chính + Extra cho cùng khách nếu chưa mở rộng mô hình assignment/request.

Quyền lợi theo category đọc được nhưng chưa có API tác giả sửa entitlement/discount/quota trong controller hiện tại. FE chưa tạo miễn phí, giảm giá hay tăng ưu đãi tự động theo tier. Cần BE chốt snapshot quyền lợi đã bán, định mức/discount, consume usage, khoản phát sinh, và giá sau quyền lợi; sau đó FE nối editor và checkout nhiều gói.

### 6. Bật dịch vụ đặt theo lịch — P1

Schema có requiresSchedule; ServiceCatalogDto chưa nhận flag này. FE thêm slot qua API sẵn có nhưng một service tạo mới chưa cấu hình sẽ bị BE từ chối 'Service is not configured for scheduled reservations'. Không có control giả bật flag trên FE. Cần expose cấu hình service/category, requiresSchedule và các thông tin cần kiểm tra liên kết slot/chuyến, sau đó thêm control này vào form. Slot picker hiện dùng lịch thật đã mở và gửi serviceScheduleId.

### 7. Boarding và điều kiện vận hành — P1

BE có start/complete check-in trả entity CruiseCheckin; cần DTO ổn định và kiểm tra đầy đủ điều kiện hợp đồng, giấy tờ, thanh toán, an toàn, thời gian. FE đã chặn booking chưa Confirmed nhưng điều kiện nghiệp vụ phải được BE bảo đảm cho mọi client.

BoardingReady chưa phải Boarded. Chưa có API cấp/thu hồi boarding pass, QR, scan lên/xuống tàu; FE không giả lập thành công các bước này. Start/complete cruise hiện chưa có đủ bộ điều kiện vận hành; không thêm luật giả định vào FE. Cần chốt quy tắc và triển khai guard BE cùng response giải thích điều kiện còn thiếu.

Manifest hiện có placeholder cabinNumber=ASSIGNED, deckName=MAIN và gồm booking Draft. FE diễn đạt lại phần chưa biết; cần BE trả cabin/boong thật và trạng thái confirmed/check-in/boarding cho danh sách vận hành.

## Kiểm tra và giới hạn

- Không chạy bộ test tự động, không tạo thêm booking/payment hoặc cập nhật dữ liệu demo khi triển khai.
- Production build (tsc + Vite), lint và git diff --check hoàn tất thành công sau các chỉnh sửa cuối. Không chạy test tự động.
- Chưa xác minh toàn bộ luồng mutation bằng browser. Công cụ browser của phiên hiện lỗi khởi tạo kernel assets ở lượt demo trước; source/build không thay thế xác minh giao diện và phân quyền thực tế.
- Tất cả thay đổi chỉ ở FE. BE git status được đối chiếu với baseline và không có thay đổi mới.
