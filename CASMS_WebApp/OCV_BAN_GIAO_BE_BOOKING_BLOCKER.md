# OcvViet — Bàn giao BE: Guest Booking bị chặn bởi API 403

**Người nhận:** người phụ trách CASMS_Backend<br>
**Thời điểm kiểm chứng:** 21/10/2026, khoảng 12:31–12:34 giờ Việt Nam (05:31–05:34 UTC)<br>
**Trạng thái:** BLOCKED cho demo Booking live đầy đủ<br>
**Phạm vi:** kết quả điều tra V9 trên môi trường local; không khẳng định môi trường khác có cùng lỗi.

## 1. Vấn đề cần xử lý trước

Khách chưa đăng nhập mở website nhưng không tải được danh sách chuyến đi và gói dịch vụ. Không chọn được chuyến thật nên FE chưa thể kiểm chứng trọn luồng chọn cabin → tạo Booking → nhận reference → tra cứu → xem hợp đồng/lịch thanh toán.

**Nguyên nhân đã xác nhận: JAR trong container BE đang chạy chưa chứa các thay đổi public-read đã có trong source local.**

Điểm chặn trực tiếp là URL authorization trong `SecurityConfig.securityFilterChain`: artifact đang chạy không cho anonymous GET Cruise/Package, nên các request này rơi vào `anyRequest().authenticated()` và nhận 403 trước khi vào controller. Ngoài ra, method-security trong JAR cũng còn phiên bản cũ; chỉ sửa URL matcher sẽ chưa giải quyết đủ.

Đây không phải lỗi FE thêm thừa `/api`, proxy hoặc gửi nhầm token: request trực tiếp BE và qua FE cho cùng kết quả; request browser được kiểm tra không có Authorization/Cookie.

## 2. Môi trường và bằng chứng artifact

| Thành phần | Giá trị đã kiểm tra |
| --- | --- |
| BE local checkout | `CASMS_Backend`, repository `ShiroSs00/CASMS_Backend` |
| BE trực tiếp | `http://127.0.0.1:8080` |
| FE đang chạy | `http://127.0.0.1:5176` |
| Vite proxy | `/api` → `http://localhost:8080`, không rewrite path |
| BE context path | `/api` |
| Container | `casms-backend` |
| Runtime profile | `dev` |
| Image ID | `sha256:c48c7d9de80732c87fdb8dd38ef1526dd1448086fef99fff567c71bf6c75b4e8` |
| Image được build | 20/10/2026 08:21:28 UTC |
| Container được start | 21/10/2026 04:42:00 UTC |
| Artifact | `/app/app.jar`; không có bind mount source/config |

Đã copy JAR ra thư mục tạm bằng thao tác đọc và dùng `javap` kiểm tra bytecode/annotations, không chỉ suy đoán từ thời gian build:

| File/method BE | Trong JAR đang chạy | Trong source local tại thời điểm kiểm tra |
| --- | --- | --- |
| `src/main/java/com/casms/config/SecurityConfig.java` — `securityFilterChain` | Không có rule public GET Cruise/Package; cuối chain yêu cầu authenticated. | Dòng 54–59 đã có GET matchers cho Cruise/Package. |
| `src/main/java/com/casms/ship/controller/CruiseController.java` — `list`, `detail` | `@PreAuthorize("hasAuthority('CRUISE_READ')")`; chưa có tham số Authentication mới. | Dòng 43–69 đã có anonymous read và giới hạn dữ liệu public ở PUBLISHED. |
| `src/main/java/com/casms/servicepackage/controller/ServicepackageController.java` — `packages` | Còn biểu thức `hasAnyPermission(...TOUR_PACKAGE_MANAGE, ...TOUR_PACKAGE_ASSIGN)`. | Dòng 53–54 đã dùng `hasAnyAuthority(...)` kèm anonymous read, giới hạn public ở ACTIVE. |

SHA-256 của `SecurityConfig.class` lấy từ JAR runtime: `604e9c41843287bc9a61d6935769b82f23a2eb817b9f8ecf41bcf405fe794850`.

**Restart lại cùng image cũ sẽ không cập nhật những class này.** Cần đội BE xác minh revision/artifact và rebuild/redeploy đúng bản đã review theo quy trình của môi trường.

## 3. Ma trận request thực tế

Các request dưới đây đều là **GET anonymous, không Authorization và không Cookie**.

| Endpoint / điều kiện | BE trực tiếp | Qua FE | Nhận định |
| --- | --- | --- | --- |
| `/api/cruise?status=PUBLISHED` | 403 | 403 | Blocker đã tái hiện. Body rỗng; không code/trace/correlation trong response. |
| `/api/servicepackage/packages` | 403 | 403 | Blocker đã tái hiện. Body rỗng; không code/trace/correlation trong response. |
| `/api/cruise/{publishedId}` | Chưa gọi | Chưa gọi | Chưa lấy được published ID thật từ danh mục; không dùng ID giả thay thế. |
| `/api/booking/available-cabins?cruiseId={publishedId}` | Chưa gọi | Chưa gọi | Thiếu ID thật. **Chưa có bằng chứng endpoint cabin với ID hợp lệ trả 403.** |
| `/api/booking/lookup` với reference + contact sandbox hợp lệ | Chưa gọi | Chưa gọi | Chưa được cung cấp dữ liệu sandbox được phép dùng. |
| `/api/auth/me` | 401 | 401 | Code `AUTH_REQUIRED`; đúng với request chưa đăng nhập, không phải lỗi đăng nhập. |
| `/api/booking/available-cabins` **không truyền cruiseId** | 500 | Chưa gọi | Request chẩn đoán lỗi input, không phải test availability thành công. Route đã qua bảo mật và tới MVC. |

### Log và trace có thể đối chiếu

- Cruise lúc **05:33:39.671 UTC**: gửi correlation `3d5a9ec9-a19b-47fd-8edf-6ccbdfd5af14`; response 403, 0 byte, không echo correlation.
- Package lúc **05:33:39.696 UTC**: gửi correlation `e9468af3-1f13-442b-8218-b74590e8c377`; response 403, 0 byte, không echo correlation.
- Không tìm thấy log container khớp hai correlation trên ở cấu hình logging hiện tại. Vì vậy không có denial trace để cung cấp; không dùng việc thiếu log làm bằng chứng duy nhất cho nguyên nhân. Kết luận dựa thêm vào bytecode runtime và request trực tiếp/proxy.
- Control cabin thiếu `cruiseId` lúc **05:33:39.715 UTC**: HTTP 500, code `INTERNAL_ERROR`, response trace `4cf1d642-0d3b-4eb0-a761-66d09943eeb3`, correlation `7a3c26ec-b3ea-4a80-9f73-3b84c3603dc6`. Log khớp:

```text
2026-10-21 05:33:39 [7a3c26ec-b3ea-4a80-9f73-3b84c3603dc6]
ERROR GlobalExceptionHandler - Unhandled exception
[traceId: 4cf1d642-0d3b-4eb0-a761-66d09943eeb3]
MissingServletRequestParameterException:
Required request parameter 'cruiseId' for method parameter type UUID is not present
```

- Control `/api/auth/me` lúc **05:33:39.845 UTC**: HTTP 401, `AUTH_REQUIRED`; correlation `4382f7a2-2f4f-4a05-b996-053a1176a1f8` được echo và có log business exception khớp.

Không có JWT, mật khẩu hoặc thông tin hành khách trong tài liệu này.

## 4. Cách tái hiện an toàn

Chạy trên Windows bằng `curl.exe` để tránh alias PowerShell. Chỉ đọc dữ liệu; không cần token:

```powershell
curl.exe --noproxy "*" -i -X GET "http://127.0.0.1:8080/api/cruise?status=PUBLISHED"
curl.exe --noproxy "*" -i -X GET "http://127.0.0.1:8080/api/servicepackage/packages"
curl.exe --noproxy "*" -i -X GET "http://127.0.0.1:5176/api/cruise?status=PUBLISHED"
curl.exe --noproxy "*" -i -X GET "http://127.0.0.1:5176/api/servicepackage/packages"
curl.exe --noproxy "*" -i -X GET "http://127.0.0.1:8080/api/auth/me"
```

Port FE 5176 là port tại lần kiểm tra này; thay bằng port FE thực tế nếu dev server đã đổi. Kết quả trước xử lý: hai endpoint nghiệp vụ trả 403, auth/me trả 401. Đoạn lệnh này không tạo hay sửa record.

## 5. Việc đề nghị đội BE xử lý

### A. Gỡ blocker chính

1. Xác minh revision BE dự định chạy và artifact/container đang thực thi; rebuild/redeploy bản đã review. Kiểm tra cả `SecurityConfig` lẫn annotations controller, không chỉ kiểm tra source checkout.
2. Xác nhận policy public-read dự kiến cho danh sách/chi tiết chuyến PUBLISHED và gói ACTIVE. Giữ bảo vệ dữ liệu chưa công bố, mutation và các nghiệp vụ Admin; không dùng `permitAll` toàn hệ thống để che lỗi.
3. Kiểm tra cả anonymous và passenger đã đăng nhập. **Rủi ro thấy từ source, chưa test live:** biểu thức hiện tại cho anonymous hoặc staff có quyền, nhưng passenger authenticated thiếu `CRUISE_READ`/quyền Package vẫn có thể bị từ chối. Cần chốt policy và test đúng nhóm đối tượng; FE không được bỏ token hợp lệ để lách quyền.
4. Kiểm tra biểu thức Package trong artifact mới không còn gọi hàm security cũ không được hỗ trợ.

### B. Lỗi BE riêng được phát hiện

`GlobalExceptionHandler` đang đưa lỗi thiếu query parameter `cruiseId` thành 500. Đề nghị map lỗi request input này về 400 với error envelope phù hợp. Đây là lỗi xử lý input riêng, **không chứng minh request availability hợp lệ bị lỗi**.

### C. Cung cấp đầu vào để hoàn tất E2E

- Một cruise PUBLISHED thật, chưa khởi hành, đã gán ship, kèm cabin AVAILABLE đủ chỗ.
- Một tài khoản/phiên staff test hợp lệ để kiểm tra quyền và Admin Logout. Cung cấp qua kênh quản lý thông tin đăng nhập của đội, không đưa mật khẩu vào báo cáo/log.
- Reference + contact của Booking sandbox được phép tra cứu.
- Nếu cần test tạo Booking: xác nhận rõ môi trường sandbox cô lập và phạm vi cho phép mutation. Hiện chưa có quyền này.

## 6. Tiêu chí nghiệm thu / thông tin cần BE phản hồi

| Kiểm tra sau xử lý | Kỳ vọng / bằng chứng cần trả |
| --- | --- |
| Xác minh deployment | Revision/image ID mới và xác nhận artifact chứa đúng security/controller changes. |
| Cruise list anonymous | HTTP 200, envelope hợp lệ; chỉ trả dữ liệu PUBLISHED. Danh sách rỗng hợp lệ vẫn chưa đủ cho demo đầy đủ. |
| Cruise detail anonymous với published ID thật | HTTP 200, ID khớp; dữ liệu chưa công bố tiếp tục được bảo vệ. |
| Cabin availability với cruise ID thật | HTTP 200, cabin thuộc ship của cruise, capacity/remainingCapacity đúng. |
| Package anonymous | HTTP 200, envelope hợp lệ; dữ liệu public tuân thủ policy ACTIVE. |
| Passenger authenticated | Public-read hoạt động theo policy đã chốt; không dùng FE bỏ token để workaround. |
| Thiếu cruiseId | HTTP 400 thay cho 500; có error code và correlation theo chuẩn BE. |
| Lookup sandbox hợp lệ / contact không khớp | Đúng Booking được phép xem / bị từ chối phù hợp; không lộ thông tin Booking khác. |
| Staff Logout E2E | Có phiên test: logout thành công, local session bị xóa, Back/refresh không truy cập lại route bảo vệ. |

Sau khi BE cung cấp runtime và dữ liệu hợp lệ, FE sẽ kiểm tra lại discovery → detail → cabin → passenger → review → submit sandbox được phép → reference/lookup → trạng thái contract/payment. Không suy ra “đã thanh toán” hay “Confirmed” chỉ từ việc tạo Booking thành công.

## 7. FE đã kiểm tra gì và chưa làm gì

- Home finder và navigation sang catalogue/lookup hoạt động. Catalogue/checkout hiển thị lỗi thật và nút Retry; không dùng mock fallback để giả thành công.
- V7/V8 form, validation, review, session isolation và Admin guard được giữ nguyên. Không xác nhận mới toàn bộ desktop hoặc staff E2E trong V9.
- Kết quả V9: `npm run lint`, `npm run typecheck`, `npm run build` đều PASS; 24/24 focused tests PASS. Build có cảnh báo chunk >500 kB, không phải nguyên nhân 403.
- Chưa tìm thấy lỗi FE cần sửa trong blocker này. V9 chỉ thêm báo cáo; không sửa BE, DB, migration, quyền hoặc Git history; không restart/rebuild container; không commit/push.
- Chưa POST Booking, chưa kiểm chứng kết quả tạo Booking/reference/contract/payment thật và chưa test Logout với phiên staff mới.

**Kết luận bàn giao:** cần đồng bộ runtime BE với revision đã review và cung cấp dữ liệu/phiên test hợp lệ. Hiện chưa đủ bằng chứng để đánh dấu demo Booking live là READY.
