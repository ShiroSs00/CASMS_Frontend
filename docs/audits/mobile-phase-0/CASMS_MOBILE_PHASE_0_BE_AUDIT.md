# Audit Backend liên quan Mobile

Ngày rà soát 24/11/2026. FE HEAD 3c01db0 và BE HEAD 0bc2b38, xác minh trực tiếp trong workspace.

Kết luận ghi theo source hoặc mức bằng chứng trong [Báo cáo kiểm thử](CASMS_MOBILE_PHASE_0_TEST_REPORT.md). Dấu vết có sẵn được phân biệt với lần chạy hiện tại.

## Kiến trúc và dữ liệu

Spring MVC controller → service transactional → JPA/JdbcTemplate. Database schema dùng tên bảng quoted. Flyway có 131 migration versioned đến V140. QA mới đã migrate toàn bộ và JPA validate khởi tạo EntityManagerFactory thành công. Chưa kiểm tra upgrade trên mọi snapshot database cũ.

AuthService chỉ chấp nhận ACTIVE, refresh cần JWT hợp lệ. /auth/me trả passengerId và thông tin Passenger từ liên kết user. RolePermissionInitializer cấp 29 quyền Passenger. Booking confirmation kiểm tiền thu hợp lệ trừ refund, deposit, cabin/capacity và contract trong workflow. Chưa có bằng chứng full Web activation handoff phù hợp yêu cầu mới.

PassengerItineraryService.mine lấy BookingPassenger bằng user hiện tại, trả Confirmed/Cancelled và itinerary OPEN_FOR_SALE/ACTIVE/COMPLETED/CANCELLED. FE chọn booking Confirmed và participation Active. Cruise đang chạy có trạng thái IN_PROGRESS. CheckinService được controller truyền userId/isStaff. Card service yêu cầu Confirmed + Active + BoardingReady.

ServiceRequestService list/get/by-operation-key có ownership, create có recovery bằng idempotency key, schedule lock và quota/entitlement. PosService kiểm employee, terminal/device, session hash/expiry/revocation, assignment area/ship/cruise. Sale đọc lại scope sau lock service, lock account và kiểm allowance. PosLedger budget dùng member ACTIVE/ALLOWED và SpendingLimit hiệu lực, historical currency guard USD. Đây là kiểm chứng static, race thực tế cần test cạnh tranh.

NotificationController có list/unread-count/stream/read/read-all/ack. Các API impact aggregate/dispatch thuộc vận hành, cần giữ ngoài Passenger UI. Audit/BLE/gangway tồn tại trong Backend nhưng chưa có mobile flow đầy đủ được chứng minh.

## Giới hạn độ phủ

Inventory endpoint trong evidence gồm annotation và dòng, chưa thay thế việc đọc service/DTO từng endpoint. Những domain cancellation, invoice/refund/dispute, gangway, BLE và staff management chưa được kiểm thử end-to-end. Không ghi nhận toàn bộ Backend là an toàn chỉ từ các guard đã đọc.

## M06 — Folio ownership (P0)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | BE `src/main/java/com/casms/payment/service/GuestPaymentExperienceService.java:1080` |
| Class/function | `private void assertAccountAccess` |
| Kỳ vọng | Passenger chỉ đọc folio được phép sở hữu. |
| Thực tế | assertAccountAccess và assertBookingAccess bypass khi có PAYMENT_READ. RolePermissionInitializer cấp PAYMENT_READ cho PASSENGER. |
| Nguyên nhân | Quyền đọc Passenger được dùng làm quyền staff rộng. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | BE |
| Phân loại / phase | BACKEND_CHANGE_REQUIRED, Phase A/E |
| Khuyến nghị | Ràng buộc ownership trước, chỉ cho ngoại lệ staff theo scope được xác nhận. |
| Acceptance criteria | Passenger A gọi account/booking B nhận 403, staff ngoài cruise/ship bị chặn. STATIC_VERIFIED, chưa chạy cross-account đầy đủ. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |

## M07 — Folio dữ liệu mẫu (P1)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | BE `src/main/java/com/casms/payment/service/GuestPaymentExperienceService.java:603` |
| Class/function | `String bookingRef =` |
| Kỳ vọng | Không có account/booking phải trả lỗi hoặc trạng thái rỗng xác thực. |
| Thực tế | Có booking reference, tên, credit limit và giao dịch demo khi không tìm thấy dữ liệu. Member limits và cabin cũng hardcoded. |
| Nguyên nhân | Demo fallback trong service production. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | BE |
| Phân loại / phase | BACKEND_CHANGE_REQUIRED, Phase E |
| Khuyến nghị | Bỏ fallback mẫu, lấy account members/limits và cabin thật, định nghĩa lỗi thiếu context. |
| Acceptance criteria | Không tham số hoặc ID không tồn tại không sinh số dư/giao dịch demo. Bằng chứng hiện tại là nhánh fallback trong source. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |

## M08 — Bàn giao tài khoản (P1)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | BE `src/main/java/com/casms/notification/service/BookingEmailService.java:103` |
| Class/function | `private String provisionTempPasswordIfNew` |
| Kỳ vọng | Theo yêu cầu chính thức, khách đặt mật khẩu qua Web activation trước đăng nhập Mobile. |
| Thực tế | enqueueConfirmation tạo temporary password và đánh activated_at ngay cho account mới. activate endpoint vẫn tồn tại. AuthService chỉ kiểm ACTIVE/password. |
| Nguyên nhân | Luồng source mới khác quy trình nghiệp vụ được yêu cầu. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | BE |
| Phân loại / phase | NEED_BUSINESS_DECISION, Phase A |
| Khuyến nghị | Xác nhận cách bàn giao tài khoản và chính sách temporary password. |
| Acceptance criteria | Web-to-Mobile handoff có test tài khoản trước/sau activation, email đã che PII. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |

## M13 — Secrets mặc định (P1)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | BE `src/main/resources/application.yml:62` |
| Class/function | `  secret:` |
| Kỳ vọng | Thông tin xác thực runtime được cấp từ môi trường. |
| Thực tế | Có fallback database credential và JWT signing secret trong source. Không xác định deployment có override hay không. |
| Nguyên nhân | Cấu hình mặc định chứa secret. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | BE |
| Phân loại / phase | BACKEND_CHANGE_REQUIRED, Phase A |
| Khuyến nghị | Chuyển secret sang cấu hình bắt buộc, rà soát/rotate secret đã công khai sau phê duyệt vận hành. |
| Acceptance criteria | Thiếu secret phải fail startup ở môi trường triển khai, kiểm token với key cũ sau rotation. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |


## Đối chiếu theo domain

| Domain | Source tương đối dưới src/main/java/com/casms | Kết luận tích hợp |
|---|---|---|
| Identity / Booking | `identity/controller/AuthController.java:34`, `BookingAccountController.java:25`, `booking/controller/BookingController.java:237,323` | Login/refresh/me có contract. Luồng email bàn giao cần chốt M08. Legacy cancel tồn tại nhưng flag workflow bật khiến route trả 409. |
| Cancellation | `booking/cancellation/controller/CancellationController.java:33–73` | Intake dùng scenario/reason/issueId tùy chọn và trả CaseView. History GET tách với queue/decision. Cần chốt Mobile read hoặc dẫn Web. |
| Check-in | `checkin/controller/CheckinController.java:35–79`, `pos/PassengerCardController.java:27–61` | Start nhận contact qua query. Passenger-ID trên route trỏ booking passenger. Claim/preview/confirm/lookup có contract và quyền theo actor. |
| Cruise, Ship, Trip | `ship/controller/ItineraryController.java:48,93,266`, `PublicShipModelController.java:20`, `trip/controller/TripController.java` | Mobile dùng dữ liệu itinerary đã materialize theo chuyến. Trip authoring/versioning thuộc vận hành. Public model có metadata và stream assets. |
| Service package / Activity | `servicepackage/controller/ServicepackageController.java:389,416,647–792`, `activity/controller/ActivityController.java:237–429` | Có slot, availability, idempotent request recovery, package assignment và registration. Fare entitlement riêng chưa dùng trong Mobile. |
| POS | `pos/PosController.java:137–240`, `PosActivityController.java:111–201` | POS terminal/session tách JWT employee, giới hạn scope bằng assignment, session và context. Sales và statement cần verified từ ledger trên QA. |
| Payment | `payment/controller/GuestPaymentExperienceController.java:72–99`, `InternationalCruisePaymentController.java:268–302` | Guest folio có fallback cần dọn trước tích hợp. Settlement, invoice và checkout cần chốt ai được thao tác và nguồn số liệu ledger. |
| Notification | `notification/controller/NotificationController.java:30–75` | List/read/count/read-all/ACK dùng JSON, stream gửi `text/event-stream`. Mobile mới dùng list/read. |
| Flyway | `src/main/resources/db/migration`, V138 thẻ và V140 currency addon | Kiểm checksum theo bộ test hiện có. Chứng minh schema mới và tương thích fixture riêng ở báo cáo kiểm thử. |

Bàn giao 3D ở Phase F cần so metadata model với deck/cabin/area và asset thật của tàu được chọn. BE đã có contract công khai để đánh giá reuse. Mobile hiện không có viewer nối route này.
