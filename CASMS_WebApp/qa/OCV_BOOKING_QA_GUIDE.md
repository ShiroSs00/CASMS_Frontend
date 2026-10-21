# Gửi đội BE — màn hình QA Booking Web

## Mở file nào?

Giải nén `booking-web-handoff.zip`, mở **booking-web-qa.html** bằng Chrome/Edge. File HTML chứa sẵn dữ liệu và giao diện, không tải thư viện/font từ Internet. Có thể đọc offline, lọc58 endpoint, xem20 ca UI test, ghi nhận thủ công và tải JSON kết quả. ZIP là bộ QA/bàn giao, không phải toàn bộ source FE/BE.

Để chạy8 GET kiểm tra runtime, đặt file HTML vào `CASMS_WebApp/qa/booking-web-qa.html` của checkout FE đang tích hợp Booking, chạy `npm run dev`, rồi mở:

**http://127.0.0.1:5173/qa/booking-web-qa.html**

Khi mở bằng file://, nút GET bị khóa chủ động; không sửa CORS/security hoặc dán token để vượt giới hạn. Chạy qua local FE cùng origin với `/api` proxy. Không có request API tự động khi mở trang. HTML này không được thêm vào router hay production build.

## 58 API nghĩa là gì?

| Phạm vi hiện tại, theo BE revision e6978f7f7267b388fa844644b88e2b60aef076bd | Số operation |
|---|---:|
| Tổng controller operation quan sát trong source | 311 |
| Customer, gồm guest Booking và phiên tài khoản | 34 |
| Dữ liệu supporting cho Booking | 21 |
| Thao tác Booking có quyền staff riêng, đã có từ trước | 3 |
| Tổng liên quan được chọn | **58** |
| Đã nối control/route thật và contract-tested | **41** |
| Supporting read chưa nối vì quyền/contract public hoặc owned chưa phù hợp | **17** |

Đây không phải58 API đều public, không phải mọi khách đều gọi cả58, cũng không phải giới hạn cố định cho nghiệp vụ tương lai.253 operation khác chủ yếu Admin/vận hành/3D/BLE hoặc capability không thuộc customer Booking. API chưa tồn tại của Payment/Check-in/Notification và các luồng thiếu khác được ghi là BE_MISSING, không cộng vào58 như endpoint đã có.

Source snapshot OpenAPI cũ chỉ268 operation;43 operation source chưa có trong dump. Vì vậy cần xuất lại Swagger khi BE khởi động đúng artifact. Không dùng số268 hay311 làm mục tiêu nối tất cả vào customer UI.

## Quy trình BE sửa và tự kiểm tra

1. Đọc `OCV_BOOKING_BE_HANDOFF.md`: sửa bootstrap/Flyway bằng quy trình đội BE bảo toàn dữ liệu. Evidence cũ: thiếu relation `UserRole`, container restart, FE proxy502. FE không sửa BE/DB hoặc reset volume.
2. Chạy8 GET trên trang QA, tải JSON. Public cruise/packages phải truy cập được khi được công bố/ACTIVE. Private endpoint trả401/403 với request ẩn danh là kiểm tra âm đúng dự kiến, chưa phải positive E2E.502 là runtime blocked;200 chưa xác thực toàn bộ DTO hay nghiệp vụ.
3. Cấp tài khoản PASSENGER thử nghiệm và effective permissions thực; liên kết Passenger ↔ User đã xác minh. Cần Booking Confirmed thuộc user, cruise PUBLISHED, cabin còn chỗ, optional ACTIVE package, activity/tour OPEN. Không gán người đại diện hoặc mọi người trong nhóm vào user theo email/tên. Giữ owner check.
4. Mở FE thật và làm20 ca tại phần “Test theo màn hình”. Route, thao tác, API và điều kiện mong đợi đã có ở từng ca; cập nhật trạng thái CHƯA TEST/PASS/FAIL/BLOCKED bằng tay. UI01–05 là guest navigation/form; UI06–08 create/recovery/lookup; UI09–18 customer/ownership/activities/services/excursions/session/staff; UI19–20 capability thiếu và UX/lỗi.
5. Chỉ chạy ca mutation trong **isolated sandbox được cho phép rõ ràng**, dùng records mà đội BE cấp. Trang QA không có nút POST/PUT/PATCH/DELETE, không tự tạo Booking, không nhập credentials/contact proof. Authenticated positive tests và guest lookup dùng màn hình FE thật với account/data được phép.
6. Sau khi sửa, xuất JSON bằng nút “Tải JSON kết quả” và gửi kèm ảnh lỗi cần thiết. Trang không lưu localStorage; refresh/đóng sẽ xóa checklist chưa export. Không đưa PII/token/log nhạy cảm vào ảnh hoặc nội dung trao đổi.

## Các chốt cần kiểm chứng với account thật

| Chốt | Mong đợi |
|---|---|
| Anonymous discovery/cabin/package | Public dữ liệu hợp lệ; không bắt login hoặc dùng token staff |
| PASSENGER đã login xem ACTIVE packages | Không bị403 chỉ vì có Authentication; method security và public read thống nhất |
| Booking ownership | Danh sách của mình; foreign sandbox record bị403, không trả PII |
| Passenger identity | View Booking không mặc nhiên cho thao tác thay mọi người; user/profile liên kết đúng trước activity/service registration |
| Service quyền riêng | Nếu muốn mở self-service, BE/product cấp đúng SERVICE_READ/SERVICE_REQUEST_*; không grant quản trị |
| Excursion | Chứng minh cruise→itinerary→stop; cần read contract an toàn cho customer nếu thiếu quyền mapping |
| Package benefits và supporting read | Public/owned read tối thiểu; không mở quyền quản lý package/deck/ship cho khách |
| Booking/contract/payment/check-in | Hiển thị riêng; schedule ≠ đã trả tiền; Accepted không tự thành SIGNED; không QR/check-in giả |
| Logout | Xóa local session, Back/refresh không khôi phục private data; staff E2E cần tài khoản thử nghiệm staff |

## Kết quả đã chạy cho lần bàn giao này

- **6/6 browser test cho QA screen PASS**: đủ58 hàng và34/21/3 persona,41/17 coverage; không request khi mở; filter; checklist/export/reset; GET-only/không token/không response body; chặn double-click;502/denial/network; offline; viewport1280/1440/1920 và focus. Ca cuối chạy8 GET thật qua local FE, chỉ ghi metadata.
- **8/8 browser regression Booking PASS**, toàn bộ API được intercept bằng fixture: package detail/retry, activity/service/excursion lifecycle, permission/owner mismatch, uncertain result lock,403 recovery và desktop. Không phải live mutation.
- **36/36 unit/contract PASS**, gồm Booking, auth/session/logout, transport mapping/DTO, package/activity/service/excursion và preview isolation.
- **lint/typecheck/build PASS**. Build vẫn có cảnh báo bundle >500KB đã tồn tại. QA không nằm trong output production.
- **8 GET live trả502** trong phiên kiểm tra lúc 11:26 UTC ngày21/10/2026 (18:26 Việt Nam); xem thời gian chính xác của lần chạy mới nhất trong `booking-qa-results.json`. Không gửi Booking mutation, lookup có contact, login thật hoặc dùng tài khoản staff.
- Mọi checklist thủ công trong file kết quả được để **NOT_TESTED**; các kết quả test tự động ở trên không tự đánh dấu20 ca live thành PASS.

**Kết luận: bộ QA sẵn dùng; Live Booking E2E vẫn BLOCKED.** Cần BE ổn định, quyền/contracts và Passenger linkage, account/dữ liệu sandbox trước khi xác nhận các luồng thật.

## Nội dung ZIP

- `booking-web-qa.html`: UI độc lập, mở offline hoặc qua Vite.
- `README.md`: hướng dẫn này.
- `booking-qa-results.json`:8 kết quả GET thật gần nhất, không raw body/token/PII.
- `OCV_BOOKING_BE_HANDOFF.md`: bằng chứng source/runtime, vị trí code và yêu cầu BE.
- `OCV_BOOKING_API_COVERAGE.md`: từng endpoint→screen/control→DTO/permission→test/gap.
- `OCV_BOOKING_ENDPOINT_INVENTORY.md`: toàn bộ311 operation và lý do chọn/loại.
- `OCV_BOOKING_IMPLEMENTATION_SUMMARY.md`: các thay đổi FE và queue chờ contract.
- `screenshots/booking-qa-*.png`: screenshot viewport/full page1280/1440/1920.

File `OCV_BOOKING_IMPLEMENTATION_SUMMARY.md` là báo cáo lần triển khai trước, giữ nguyên để đối chiếu; số test mới cho bộ QA này nằm ở phần kết quả phía trên.

## Chạy lại bằng CLI (trong CASMS_WebApp)

```powershell
python tests/booking/build-qa-handoff.py
$env:CASMS_PLAYWRIGHT_MODULE='C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:CASMS_QA_LIVE_READS='1'
node --test tests/booking/qa-screen.browser.mjs
node --test tests/booking/complete-integration.browser.mjs
npm run lint
npm run typecheck
npm run build
```

Đường dẫn Playwright ở trên chỉ là runtime đã có trên máy hiện tại. Máy người nhận cần runtime Playwright/Edge phù hợp; không dùng credentials giả của test làm tài khoản thật. Bỏ `CASMS_QA_LIVE_READS` nếu chỉ muốn chạy fixture tests; ca probe live sẽ SKIP và không được báo là đã kiểm tra BE. Chưa chạy manual screen reader hoặc đầy đủ mọi trình duyệt.
