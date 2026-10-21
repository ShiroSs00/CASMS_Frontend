# Bàn giao BE — Booking Web

Ngày kiểm tra: 2026-10-21. BE source `e6978f7f7267b388fa844644b88e2b60aef076bd`. FE giữ nguyên Backend/DB/Flyway/security/Admin; không chạy mutation thật. Đây là phân biệt giữa bằng chứng source, HTTP fixture và runtime thật.

## 1. P0 runtime: Backend chưa khởi động

Kiểm tra đọc lúc **10:46:07 UTC / 17:46:07 Việt Nam**:

| Method/path qua FE 127.0.0.1:5173 | Auth | HTTP | Body / application code / trace ID |
|---|---|---|---|
| GET /api/cruise?status=PUBLISHED | anonymous, không Bearer/Cookie | 502 | body rỗng; không code, trace, request/correlation ID |
| GET /api/servicepackage/packages | anonymous | 502 | như trên |
| GET /api/activities | anonymous | 502 | như trên; chưa kiểm chứng permission vì BE chưa chạy |
| GET /api/activities/registrations | anonymous | 502 | như trên |
| GET /api/servicepackage/services | anonymous | 502 | như trên |
| GET /api/servicepackage/requests | anonymous | 502 | như trên |
| GET /api/shore-excursions | anonymous | 502 | như trên |
| GET /api/auth/me | anonymous | 502 | như trên |

GET trực tiếp `http://127.0.0.1:8080/api/cruise?status=PUBLISHED`: connection refused / WinError10061, **không có HTTP response**. FE proxy `/api → http://localhost:8080` không rewrite path; BE `application.yml` dùng port8080, context `/api`. Không có bằng chứng lỗi double `/api`.

`docker ps`: `casms-backend` Restarting, `casms-postgres` healthy. Image `casms_backend-backend`, digest `sha256:8122946a947f4453ceea3e6ff6fe96393899a552e4a2ad3004a33615c4c8bb3a`. Log khớp lần kiểm tra:

```text
Migration V3__insert_default_users.sql failed
SQL State: 42P01
ERROR: relation "UserRole" does not exist
Location: db/migration/V3__insert_default_users.sql, line 7
ALTER TABLE "UserRole" DROP CONSTRAINT IF EXISTS "UserRole_role_check"
```

Lớp chặn hiện tại là BE bootstrap/Flyway; **không phải một 403 mới đã tái hiện**. Lỗi403 lịch sử không thể coi là đã sửa hay vẫn còn chỉ dựa vào502. Chưa có published ID thật để probe detail/cabin/package detail, dữ liệu guest lookup được phép, hoặc phiên PASSENGER/staff hợp lệ. Không gọi lookup bằng dữ liệu đoán.

BE cần sửa/bootstrap môi trường bằng quy trình của đội BE, bảo toàn dữ liệu, khởi động đúng source revision rồi cung cấp fresh OpenAPI. FE không reset volume, sửa migration, tắt security hoặc dùng token đặc quyền để che lỗi.

Tái hiện an toàn (chỉ GET/log, không cần secret):

```powershell
curl.exe -i --max-time 5 'http://127.0.0.1:5173/api/cruise?status=PUBLISHED'
curl.exe -i --max-time 5 'http://127.0.0.1:8080/api/cruise?status=PUBLISHED'
docker logs casms-backend --tail 55
```

HTTP evidence cục bộ: `C:/Users/USER/AppData/Local/Temp/ocv-booking-complete-live-probes.json`.

## 2. P1 quan hệ Passenger ↔ User làm chặn nghiệp vụ sau Booking

Source `booking/service/BookingService.java:createBooking`, khoảng dòng283–304: mỗi người được tạo bằng `new Passenger()` rồi lưu; không gán `Passenger.user`. `Booking.bookedByUser` có gán nhưng đó là quan hệ khác.

Trong khi đó:

- `activity/service/ActivityService.java:assertBookingPassengerOwner` dòng143 yêu cầu `bp.passenger.user.userId == principal.userId` cho nonstaff; null cũng từ chối. Áp dụng tạo/cập nhật/xác nhận/hủy đăng ký hoạt động và tour; các thao tác tạo còn yêu cầu Booking `Confirmed`, đúng cruise, trạng thái OPEN, thời gian/sức chứa hợp lệ.
- `servicepackage/service/ServiceRequestService.java:create` yêu cầu `passengers.findByUser_UserId(userId)`, sau đó `assertSamePassenger` với BookingPassenger nếu có. Không có profile → lỗi; profile khác →403.
- `/auth/me` không có passengerId; Booking passenger DTO không có cờ người sở hữu. FE **không** suy ra danh tính qua email/họ tên, không gán đại người đại diện vào tài khoản, không đổi owner check.

Đây là blocker xác nhận từ source, chưa có live mutation để chứng minh runtime. Những Booking tạo theo nhánh source trên có Passenger.user null sẽ không dùng được đăng ký self-service dù tài khoản đọc được Booking. FE đã nối các API, test bằng fixture có quyền và quan hệ sở hữu hợp lệ, kèm hướng dẫn kiểm tra liên kết hồ sơ.

BE cần xác nhận quy trình liên kết/claim Passenger đã xác minh, tái sử dụng hồ sơ đúng người khi thích hợp; không tự gán mọi người trong nhóm vào người đặt. Sau đó cung cấp một metadata an toàn, ví dụ **đề xuất mới, chưa tồn tại** `passengers[].ownedByCurrentUser: boolean`, hoặc hồ sơ của chính tài khoản. Bảo toàn object-level authorization.

## 3. Quyền đọc public/customer còn thiếu

`config/SecurityConfig.java` hiện permit public GET cruise/packages và guest Booking create/lookup/available-cabins. Method security vẫn áp dụng. `security/jwt/JwtAuthenticationFilter.java` đọc Bearer hợp lệ và giữ Authentication; FE không tự bỏ token để vượt method security.

`servicepackage/controller/ServicepackageController.java:packages,tourPackage`: method condition cho anonymous hoặc TOUR_PACKAGE_MANAGE/ASSIGN. **PASSENGER đã login nhưng không có hai quyền này có thể bị403**, dù anonymous được đọc ACTIVE. Đây là phân tích source, chưa xác nhận trên runtime đang lỗi. BE cần thống nhất public ACTIVE read cho anonymous và customer, tách khỏi quyền quản trị; không cấp quyền quản lý gói cho khách.

Các nhóm cần public/owned read tối thiểu, xem từng verb/path/DTO/permission trong `OCV_BOOKING_API_COVERAGE.md`:

| Nhóm | Điều kiện đang chặn | Cần từ BE |
|---|---|---|
| Ship/itinerary/day/stop bổ sung | SHIP_READ, ITINERARY_READ, CRUISE_STOP_READ | Read-only cho cruise PUBLISHED hoặc cruise thuộc Booking của khách; FE chỉ gọi khi effective permissions cho phép |
| Ports/destinations ACTIVE và detail | PORT_READ / DESTINATION_READ | Nội dung công khai phục vụ discovery; không grant CRUD |
| Deck/cabin detail và các read theo ship/deck | DECK_READ / CABIN_READ | Amenity/deck metadata an toàn; không dùng full catalog thay available-cabins |
| Package benefits và services/activities/excursions composition | TOUR_PACKAGE_MANAGE/ASSIGN hoặc PACKAGE_COMPONENT_MANAGE | Quyền lợi của gói ACTIVE/đã mua, trả thông tin tối thiểu; không grant quản trị |
| Package assignment read | TOUR_PACKAGE_ASSIGN/MANAGE | Agreed package price/currency cho Booking thuộc khách; Booking detail hiện có packageId/name nhưng chưa có giá gói đã thỏa thuận |
| Service catalog/request | SERVICE_READ; SERVICE_REQUEST_CREATE hoặc READ | PASSENGER seed hiện không được cấp. Đội BE/product quyết định có mở self-service hay không; FE chỉ render/call theo effective permissions thật |
| Excursion | EXCURSION_READ/BOOKING có trong PASSENGER seed; ITINERARY_READ/CRUISE_STOP_READ không có | DTO tour chỉ có cruiseStopId, không cruiseId. FE đã nối khi có đủ quyền chứng minh itinerary→stop thuộc cruise; ordinary PASSENGER vẫn bị chặn mapping. Cần owned/public stop mapping hoặc endpoint tour theo Booking/cruise có kiểm tra quyền |

Không coi dữ liệu seed là quyền runtime. Chưa dùng credential trong seed. Đề xuất DTO public benefits dưới đây **không phải response hiện có**, chỉ là yêu cầu BE thiết kế/xác nhận:

```json
{
  "success": true,
  "data": {
    "packageId": "<active-package-id>",
    "benefits": [{"kind": "ACTIVITY", "id": "<id>", "name": "<name>", "benefitType": "INCLUDED"}]
  }
}
```

Chọn gói khác với giữ chỗ hoạt động/dịch vụ. INCLUDED không được diễn giải thành đã đăng ký, đã trả tiền hay chắc chắn còn chỗ.

## 4. Endpoint/schema và capability chưa có

- **311** operation Java hiện tại, **244** path. Snapshot OpenAPI ngày20/10 có268 operation/210 path, thiếu43 operation source (đa phần3D/BLE; ba read cabin/deck cũng thiếu). Cần xuất lại Swagger từ đúng artifact sau khi BE chạy. Full inventory lưu cả268 schema và signature43 operation mới; không suy ra runtime từ dump.
- `CheckinController`, `PaymentController`, `NotificationController` vẫn TODO, không có method mapping. Không có endpoint thật để thu/đối soát tiền, invoices, boarding pass, arrival slot, ký hợp đồng, cập nhật giấy tờ/profile hay gửi change-request trong phạm vi đã kiểm tra. Lịch installment `Scheduled` ≠ đã thanh toán; `ContractStatus` hiện Draft/Accepted/Cancelled, không tự đổi thành SIGNED.
- POST service schedule-check và product sales hiện trả501 NOT_IMPLEMENTED. Không thêm nút fake hoàn tất.
- `ActivityController.RegistrationView` chưa trả `notes` dù PUT nhận `notes`; FE hiển thị rõ việc ghi chú mới sẽ thay thế ghi chú cũ, không dựng lại ghi chú đã lưu. BE nên bổ sung read field nếu cần chỉnh sửa giữ nguyên nội dung. Service request read có `note`, FE giữ giá trị đã lưu khi mở form sửa.

## 5. Dữ liệu/quyền cần bàn giao để kiểm chứng live

1. BE ổn định đúng revision + OpenAPI mới; published cruise ID có ship, phòng trống, optional ACTIVE package.
2. Isolated sandbox được cho phép rõ ràng cho mutation; credentials PASSENGER thử nghiệm với effectivePermissions thật, Passenger đã liên kết đúng user, Booking Confirmed thuộc user, activity/tour OPEN còn chỗ. Nêu rõ dữ liệu nào có thể tạo/hủy và cách dọn do đội BE quản lý.
3. Một bộ reference + approved contact proof sandbox để kiểm tra guest lookup; một record không thuộc user để kiểm chứng403 object-level mà không tiết lộ PII.
4. Staff account thử nghiệm riêng nếu muốn kiểm chứng logout/protected Back/refresh ngoài fixture. Không có account thật hiện tại.

**LIVE_E2E_READY = BLOCKED.** FE kiểm thử HTTP fixture thành công không chứng minh các phụ thuộc trên đã hoạt động.
