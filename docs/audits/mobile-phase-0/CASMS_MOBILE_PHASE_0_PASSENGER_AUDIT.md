# Audit Passenger và lifecycle

Ngày rà soát 24/11/2026. FE HEAD 3c01db0 và BE HEAD 0bc2b38, xác minh trực tiếp trong workspace.

Kết luận ghi theo source hoặc mức bằng chứng trong [Báo cáo kiểm thử](CASMS_MOBILE_PHASE_0_TEST_REPORT.md). Dấu vết có sẵn được phân biệt với lần chạy hiện tại.

## Luồng hiện tại

Login → /auth/me → /itineraries/mine → selected bookingPassenger → booking/cabin/cruise. Selection được bind owner, backend URL và signedInAt. Nhiều booking có chooser, không âm thầm đổi passenger khi selection biến mất. Home có dữ liệu API thật và refresh, chưa có đầy đủ lịch hôm nay, quyền lợi và chi tiêu trực tiếp trong summary.

Services có catalogue/search/category, availability/schedules, create/edit/cancel và recovery theo operation key. Activities có activity/excursion availability và registration/confirm/update/cancel. Packages có assignment và benefits nhưng quyền sửa gói sau booking cần chốt. Notification có list/detail/read. Support là FAQ và hướng dẫn tại quầy, chưa có ticket/chat.

## Ma trận lifecycle thực tế

Đây là các trục state độc lập. Tên giai đoạn hành trình dùng để mô tả UX, không thêm enum vào Backend.

| Trục | Enum/rule thực tế | Login/xem | Mutation/quyền lợi |
|---|---|---|---|
| Account | ACTIVE, LOCKED, DISABLED | Chỉ ACTIVE + đúng password đăng nhập | JWT refresh kiểm ACTIVE, screen cần /auth/me |
| Activation | BookingAccountSetup activated_at/token_hash/expires_at | AuthService không trực tiếp kiểm activated_at | M08 cần quyết định workflow |
| Booking | Draft, Confirmed, Cancelled | /mine trả Confirmed/Cancelled, FE chọn Confirmed | Draft không vào voyage onboard context |
| BookingPassenger | Active, Cancelled | FE chỉ chọn Active | Owner từ Passenger.user, không dùng bookedBy để giả ownership mọi người trong gia đình |
| Cruise | DRAFT, PUBLISHED, IN_PROGRESS, COMPLETED, CANCELLED | FE xếp IN_PROGRESS rồi PUBLISHED rồi COMPLETED/CANCELLED | ready=false khi COMPLETED/CANCELLED, Backend vẫn là nguồn quyết định |
| Itinerary | OPEN_FOR_SALE, ACTIVE, COMPLETED, CANCELLED được /mine trả | Xem khi itinerary tồn tại và đủ permission | Excursions adapter lọc OPEN_FOR_SALE/ACTIVE, omit/substitute stop |
| Check-in | NotStarted, InProgress, NeedsReview, Completed, BoardingReady | /status theo ownership | start/complete theo booking/contract/contact, complete adapter đòi BoardingReady |
| PassengerCard | Claim expiry/consumed, card assignment | FE chưa nối | Claim 10 phút, Confirmed/Active/BoardingReady, unique passenger và (cruise,card) |
| OnboardAccount | PENDING_ACTIVATION, ACTIVE, POSTING_BLOCKED, SUSPENDED, CLOSED | Spending placeholder | Không suy ra entitlement chỉ từ account status, cần service validation |
| Settlement | Chưa đối chiếu đầy đủ mọi enum/lifecycle | NOT_TESTED | Checkout/folio phải xử lý M06/M07 và xác nhận nghiệp vụ |

Trước chuyến có thể xem context/check-in theo Backend. Đã lên tàu cần đọc gangway state, BoardingReady chưa chứng minh đã boarding. Đang chuyến cần IN_PROGRESS cùng điều kiện từng service. Đang checkout/đã kết thúc cần policy giữ quyền đọc invoice/statement. Booking hủy cần quyết định có hiển thị lịch sử trên Mobile dù FE hiện loại khỏi chooser. Invoice, refund, dispute, account member toàn gia đình và settlement vẫn NOT_TESTED.

## M01 — Hủy booking (P1)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/src/features/passenger-actions/passenger-api.ts:149` |
| Class/function | `async cancelBooking` |
| Kỳ vọng | Backend yêu cầu cancellation case khi workflow bật. |
| Thực tế | Mobile POST /booking/{id}/cancel và chờ Cancelled, backend mặc định trả 409 CANCELLATION_CASE_REQUIRED. |
| Nguyên nhân | Adapter giữ luồng legacy. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | REDIRECT_TO_WEB, Phase A |
| Khuyến nghị | Điều hướng về đúng booking trên Web sau khi xác nhận phạm vi nghiệp vụ, xử lý deep link cũ. |
| Acceptance criteria | Không còn gọi cancel legacy từ Mobile, test 409 và đường quay lại thành công. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |

## M02 — Passenger QR (P1)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/src/app/passenger-qr.tsx:6` |
| Class/function | `PassengerQrRoute` |
| Kỳ vọng | Hiển thị mã claim Backend còn hạn sau khi đủ điều kiện. |
| Thực tế | Chỉ hướng dẫn nhận thẻ tại quầy. |
| Nguyên nhân | Chưa nối API card-claim. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | IMPLEMENT, Phase B |
| Khuyến nghị | Gọi card-claim, render đúng code, expiry và lỗi ownership. |
| Acceptance criteria | Hết hạn/reissue/đổi tài khoản không hiển thị claim cũ. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |

## M04 — Chi tiêu Passenger (P1)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/src/app/spending.tsx:6` |
| Class/function | `SpendingRoute` |
| Kỳ vọng | Xem tài khoản/chi tiêu của mình. |
| Thực tế | Chỉ hướng dẫn xem tại quầy và chuyển sang booking/payment. |
| Nguyên nhân | Chưa có adapter folio dành riêng Passenger. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | BACKEND_CHANGE_REQUIRED, Phase E |
| Khuyến nghị | Sửa M06/M07 trước, tách hạn mức nội bộ với tiền quyết toán. |
| Acceptance criteria | Số dư/transaction đối chiếu DB, không dùng số giả hoặc quyền staff. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |

## M05 — Realtime (P1)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/src/features/notifications/PassengerNotificationsScreen.tsx:15` |
| Class/function | `PassengerNotificationsScreen` |
| Kỳ vọng | Thông báo cập nhật khi foreground, reconnect và đồng bộ lại inbox. |
| Thực tế | Có list/read và refresh, chưa stream/unread-count/read-all/ack. Không có expo-notifications. |
| Nguyên nhân | Chưa tích hợp SSE/push. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | IMPLEMENT, Phase F |
| Khuyến nghị | Tạo lifecycle SSE với Authorization, backoff, logout cleanup. Quyết định push riêng. |
| Acceptance criteria | Foreground/reconnect nhận thay đổi, app đóng có chiến lược push được kiểm thử riêng. |
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


## Các màn và thao tác đã đối chiếu

| Màn hoặc nhóm chức năng | Mức tích hợp từ source | Phần còn thiếu hoặc cần quyết định |
|---|---|---|
| Login, Account | Login JWT, role routing, restore, refresh và local logout. Auth từ Web activation phụ thuộc M08. | Nghiệm thu Web xác nhận → email → kích hoạt → đăng nhập thiết bị. |
| Home và chọn chuyến | `PassengerLiveHomeScreen` đọc Voyage context, chuyến/tàu/cabin, ngày và hoạt động lấy được từ API, có quick actions và đường dẫn thông báo. `voyage-selection` giữ cặp booking/passenger. | QA cần active, tương lai, hoàn tất, đã hủy và nhiều hành khách. |
| Check-in và thẻ | Status, liên hệ khẩn cấp và complete có adapter. QR chỉ dẫn tới check-in/hỗ trợ. | Chốt kênh check-in trước chuyến. Claim, QR và trạng thái cấp thẻ thiếu UI/adapter M02. |
| Dịch vụ và tiện ích | Danh mục server, availability, lịch, yêu cầu tạo/sửa/hủy, theo dõi status và tìm lại theo key. | Nhà hàng/ẩm thực/spa/giải trí phụ thuộc catalogue BE tại chuyến. QA cần dịch vụ gồm trong gói, có phí, hết slot, và cập nhật từ POS. |
| Hoạt động và tour | Đọc hoạt động, số chỗ, đăng ký/sửa/hủy và tour theo cảng của chuyến. | Kiểm quota, event bị dời và fare entitlement trên dữ liệu thật. |
| Gói | Danh mục/benefits và assignment đã nối. FE có thao tác sửa gói có điều kiện ở draft. | Xác nhận Mobile companion được chỉnh draft hay chỉ đọc. |
| Spending | Khi vào `spending.tsx`, app hướng tới hỗ trợ/đặt chỗ. Payment history là khoản tiền vé. | Thiếu account, allowance, limit, ledger, tổng chi tiêu, invoice/settlement/checkout M04. |
| Hải trình | Ngày, cặp điểm cảng đến/rời, giờ theo ngày, tour và thay đổi từ adapter itinerary. | Sơ đồ tầng/cabin/tiện ích và viewer 3D là phần chưa nối. |
| Thông báo, hỗ trợ | List và mở chi tiết từ item, đánh dấu một mục. Hỗ trợ có UI hướng dẫn. | Unread count BE, read-all, ACK, SSE, reconnect và chính sách kênh hỗ trợ. |

Các điểm tạo tài khoản, kích hoạt, tạo booking, chọn cabin mua và thanh toán ban đầu đi theo Web theo phạm vi nghiệp vụ. Giữ dữ liệu đọc về booking và thanh toán đã có cho hành khách.

## M15 — Độ lớn mô hình hải trình (P2, FE + BE)

`CASMS_Backend/src/main/java/com/casms/ship/controller/PublicShipModelController.java:20–32` có manifest và stream asset. `CASMS_WebBooking/src/features/ship-model-viewer/CustomerShipExplorer.tsx:18` giải mã manifest/cabin mappings, và `CustomerModelScene.tsx:36` chọn asset theo tầng trước khi fallback. Kiểm kê read-only model `Model 3d/CASMS_Cruise_Models/casms_13_decks/manifest.json` và 17 file GLB cho thấy tổng 771.298.280 byte, riêng `ship.glb` 363.415.788 byte, `deck_03.glb` 41.815.088 byte. Mobile thiếu viewer và hiện chưa đo memory, tải hoặc ánh xạ tàu/chuyến triển khai.

Phase F xem xét dùng manifest/deck và mapping sẵn có để hiển thị vị trí theo cabin đã gán. Chỉ thử 3D với asset theo tầng hoặc phiên bản nhẹ sau khi chốt phạm vi. Acceptance là xác định đúng cabin/tầng/khu tiện ích, có fallback khi asset lỗi và đo thời gian tải/memory trên máy thật trước quyết định phát hành. Bằng chứng là source và kích thước file, chưa chạy renderer Mobile.
