# OceVie — BE cần hoàn thiện theo Context Diagram

Ngày đối chiếu: 22/10/2026. Nguồn: context diagram người dùng gửi và mã nguồn BE local tại `CASMS_Backend`. Tài liệu này là bàn giao kỹ thuật, không xác nhận hệ thống đã sẵn sàng triển khai production.

Context diagram xác định tác nhân và luồng trao đổi dữ liệu. Nó không quy định chính xác tên role, URL, tỷ lệ trả góp, trạng thái hợp đồng hay quy tắc xác nhận booking. Các đề xuất dưới đây cần được chốt cùng quy tắc nghiệp vụ; không tự coi mọi chi tiết đề xuất là yêu cầu được vẽ trong sơ đồ.

## 1. Phần đã sửa ở BE local — chưa push

- Thêm `SHORE_MANAGER` và `ACTIVITY_MANAGER` vào Role; đồng bộ allowlist role trong database trước bước khởi tạo quyền.
- Tách quản lý hoạt động/danh mục (`ACTIVITY_MANAGER`) khỏi nhân viên phục vụ (`ONBOARD_STAFF`). Nhân viên phục vụ không còn quyền tạo hoạt động hoặc sửa danh mục.
- Tách quyền sửa dịch vụ bờ khỏi nhân sự trên tàu; bỏ quyền sửa nhà cung cấp của quản lý vận hành; bỏ quyền sửa danh mục dịch vụ/gói của quản lý lịch trình.
- Quản lý vận hành được đọc booking/cabin để điều phối, không được sửa/hủy booking.
- Khởi tạo quyền chuẩn thay thế các quyền cũ chồng chéo. Chưa thay đổi role của tài khoản hiện có và chưa tạo tài khoản quản lý mới.
- API đăng ký/điểm danh dùng chung kiểm tra đúng đối tượng trên tàu hoặc trên bờ trước thao tác; giữ kiểm tra chủ sở hữu hành khách trong service.
- Hướng dẫn hợp đồng đổi về OceVie và bỏ địa chỉ văn phòng ghi cứng chưa được xác minh.

Các file chính đã sửa local: `identity/enums/Role.java`, `identity/service/RolePermissionInitializer.java`, `identity/service/RoleConstraintInitializer.java`, `activity/service/RegistrationAccessPolicy.java`, `activity/controller/ActivityController.java`, `booking/service/BookingService.java` và test liên quan. Đường dẫn tính từ `src/main/java/com/casms/`.

## 2. Ánh xạ tác nhân sang trách nhiệm

| Tác nhân/nhóm nghiệp vụ | Role hoặc cơ chế BE | Phạm vi cần bảo đảm |
| --- | --- | --- |
| System Administrator | ADMIN | Quản trị tài khoản, gán vai trò, cấu hình và tra cứu audit. Không dùng tài khoản ADMIN làm tài khoản vận hành thường ngày. |
| Operations Manager | OPERATIONS_MANAGER; CRUISE_MANAGER/SHIP_MANAGER hỗ trợ lập lịch và đội tàu theo phân tách trước đó | Công suất, tàu/cabin, quy định, sự cố, lịch trình và thông tin booking cần cho điều phối. |
| Booking Coordination Department | BOOKING_AGENT / CUSTOMER_SERVICE | Tiếp nhận, cập nhật, điều phối phòng, yêu cầu thay đổi/hủy và xác nhận booking theo điều kiện nghiệp vụ. |
| Activity Management Department | ACTIVITY_MANAGER; SHORE_MANAGER cho dịch vụ bờ theo yêu cầu tách riêng | Hoạt động, lịch, sức chứa, dịch vụ/gói; tour bờ, nhà cung cấp, nhóm khách và điểm danh theo đúng phạm vi. |
| Onboard Sales & Service Staff | ONBOARD_STAFF | Tiếp nhận/thực hiện yêu cầu và nghiệp vụ bán hàng qua POS; không sửa danh mục hoặc hoạt động. |
| Finance / nghiệp vụ cuối chuyến | FINANCE_OFFICER | Giao dịch, đợt thanh toán, hoàn tiền, hóa đơn, công nợ và quyết toán cuối chuyến. |
| Passenger | PASSENGER và luồng khách tra cứu hợp lệ | Chỉ dữ liệu booking/hành khách của mình; không được tự xác nhận đã thu tiền hoặc cấp boarding pass. |
| Payment Gateway | Tích hợp có xác thực webhook | Kết quả giao dịch đã xác minh, hoàn tiền và đối soát. Không phải role đăng nhập WebApp. |
| POS terminal | Định danh ứng dụng/thiết bị, kèm nhân viên thao tác khi cần | Bán hàng/ghi nhận giao dịch đúng hành khách và tài khoản chi tiêu. |
| Passenger Location Device / BLE | Định danh thiết bị/receiver và quyền theo chuyến | Nhận quan sát vị trí, gắn định danh hành khách, kiểm soát truy cập dữ liệu vị trí. |

Cần chốt thêm ma trận RACI cho phê duyệt thay đổi booking, giải quyết tranh chấp và hoàn tiền. Sơ đồ ảnh chưa đủ để suy ra ai được phê duyệt từng trường hợp.

## 3. Các việc bắt buộc trước khi đưa các luồng này lên production

### P0-A. Chặn xác nhận booking khi chưa đủ điều kiện

**Hiện tại:** `booking/service/BookingService.java`, hàm `confirm()` kiểm tra truy cập và trạng thái rồi gán `Confirmed`; chưa đối chiếu số tiền thực thu. Controller cho phép `BOOKING_UPDATE` hoặc `BOOKING_CREATE`, trong khi role hành khách cũng có quyền tạo booking.

**Cần sửa:**
- Tách quyền tạo booking khỏi quyền xác nhận thu tiền/xác nhận booking. Không để hành khách tự xác nhận booking chỉ vì có `BOOKING_CREATE`.
- Chốt điều kiện xác nhận: đủ khoản tiền yêu cầu đã được đối soát, trạng thái hợp đồng hợp lệ và booking/công suất còn hợp lệ. Không suy ra hợp đồng bắt buộc ký trực tuyến; quy định hiện tại vẫn là ký bản cứng.
- Chuyển trạng thái trong transaction, khóa/xử lý cạnh tranh phù hợp và hỗ trợ gửi lặp an toàn.
- Luồng thanh toán đã thu nhưng booking không xác nhận được phải có cơ chế phục hồi/đối soát.

**Nghiệm thu:** chưa thu đủ tiền hoặc chưa đủ điều kiện thì không đổi sang `Confirmed`; hành khách gọi trực tiếp API không được vượt quy tắc; hai yêu cầu đồng thời không tạo hai kết quả tài chính.

### P0-B. Hoàn thiện module Payment Gateway và thanh toán theo đợt

**Hiện tại:** `payment/controller/PaymentController.java` và `payment/service/PaymentService.java` còn TODO. `InstallmentStatus` mới có `Scheduled`, `Cancelled`. Booking đã sinh lịch `STAGES` 30%–40%–30%, nhưng lịch không chứng minh đã thu tiền.

**Cần sửa:**
- API đọc lịch từng đợt, số tiền đã thu/còn phải thu; khởi tạo thanh toán một đợt; kiểm tra kết quả giao dịch; nhận webhook của cổng được chọn.
- Xác thực chữ ký webhook; đối chiếu mã đơn, số tiền, tiền tệ và môi trường; chống xử lý lặp. Không tin tham số trên return URL của trình duyệt là bằng chứng thanh toán thành công.
- Liên kết mỗi giao dịch với đúng booking/đợt; lưu mã giao dịch duy nhất và lịch sử đối soát. Chốt cách biểu diễn thanh toán một phần, thành công, thất bại và hoàn tiền trên mô hình hiện có.
- Tách quyền bắt đầu thanh toán của khách khỏi quyền xác nhận thủ công/đối soát/hoàn tiền của tài chính.
- Cần tên cổng, tài liệu API, quy tắc tiền tệ/phí và cấu hình môi trường; không đưa khóa bí mật vào FE/Git.

**API gợi ý, chưa tồn tại:** `POST /payment/installments/{id}/checkout`, `GET /payment/transactions/{id}`, `POST /payment/webhooks/{provider}`. Tên cuối cùng phải thống nhất trong OpenAPI.

**Nghiệm thu:** webhook gửi hai lần chỉ ghi nhận một lần; sai chữ ký/số tiền/tiền tệ bị từ chối; thất bại không biến thành đã thu tiền; có thể đối soát giao dịch treo.

### P0-C. Sửa lịch thanh toán cho booking sát ngày khởi hành

**Hiện tại:** hạn cuối được tính từ khởi hành trừ 7 ngày, có nhánh kéo về thời điểm hiện tại; đợt giữa có nhánh kéo thành hiện tại cộng 7 ngày. Với chuyến gần ngày khởi hành, thứ tự các đợt có thể không hợp lý.

**Cần sửa:** chốt chính sách đặt sát ngày: gộp đợt, thanh toán toàn bộ hoặc từ chối kế hoạch nhiều đợt; bảo đảm thứ tự hạn thanh toán và tổng tiền theo quy tắc làm tròn của tiền tệ. Tỷ lệ 30/40/30 là logic BE hiện có, không phải quy tắc được nêu trong context diagram.

**Nghiệm thu:** test chuyến khởi hành sau 1, 3, 7, 14, 30 và 60 ngày; không có lịch đợt sau đến hạn trước đợt trước hoặc sau thời điểm nghiệp vụ cho phép.

### P0-D. Hoàn thiện tài khoản và phân quyền có thể vận hành thật

**Hiện tại:** `IdentityController` mới có `GET /identity/users` để tra cứu/phân công; `AuthController` có login/refresh/me/logout. Chưa có luồng quản trị tài khoản, gán role hoặc khôi phục tài khoản phục vụ các màn tương ứng.

**Cần sửa:** API cấp/kích hoạt/khóa tài khoản, gán/thu hồi role, quy trình khôi phục mật khẩu và audit. Chốt quyền chuẩn theo phiên bản; nếu cho sửa quyền trong DB thì không được để bootstrap ghi đè tùy chỉnh ngoài ý muốn khi restart. Áp quyền đọc/sửa theo chuyến, booking, hành khách hoặc phân công, không chỉ dựa vào `isStaff()`.

**Nghiệm thu:** role nào chỉ làm đúng công việc đó dù gọi API trực tiếp; dữ liệu ngoài phạm vi bị chặn; đổi/thu hồi quyền có hiệu lực theo chính sách phiên đã chốt; mọi thay đổi quyền có người thực hiện và thời điểm.

### P0-E. Migration production phải chạy được

**Hiện tại:** đã ghi nhận lỗi constraint ở migration V4 trong lần chạy database thường trước đó. QA đang dùng database riêng và Flyway bị tắt trong script QA; kết quả QA không chứng minh migration production đã chạy được.

**Cần sửa:** kiểm tra lại lịch sử migration và dữ liệu thực tế; xử lý thứ tự đồng bộ allowlist quyền/role bằng migration có phiên bản. Không tùy tiện sửa migration đã áp dụng hoặc tắt Flyway trên production để né lỗi.

**Nghiệm thu:** chạy migration trên database mới và bản sao database đã có dữ liệu; quyền/role và dữ liệu cũ hợp lệ; có phương án phục hồi đã kiểm tra.

## 4. Hoàn thiện các luồng còn thiếu trong sơ đồ

| Ưu tiên | Nhóm | Hiện trạng và việc BE cần làm |
| --- | --- | --- |
| P1 | Check-in / boarding / check-out | CheckinController và CheckinService còn TODO. Cần kiểm tra booking, giấy tờ, khoản phải thu; ghi nhận thủ tục từng khách; cấp/thu hồi thẻ lên tàu; nhận bàn giao tài khoản chi tiêu/BLE và kết thúc chuyến. Không dùng trạng thái booking thay cho trạng thái check-in. |
| P1 | POS / bán hàng trên tàu | `POST /servicepackage/products/{id}/sales` hiện trả 501. Cần hợp đồng dữ liệu bán hàng, dòng hàng, giá/tiền tệ tại thời điểm bán, người mua, terminal/nhân viên, quyền ghi nợ và chống gửi trùng. Kết nối giao dịch với tài khoản chi tiêu/hóa đơn; quy tắc tồn kho nếu nghiệp vụ có yêu cầu. |
| P1 | Tài chính / sau chuyến | Đã có entity cho payment, invoice, final settlement nhưng controller/service nghiệp vụ chưa triển khai. Cần công nợ, tranh chấp khoản tính phí, hoàn tiền, hóa đơn và quyết toán cuối chuyến; phân biệt khoản dự kiến với khoản thực thu. |
| P1 | Thông báo | NotificationController/Service còn TODO dù booking đã tạo bản ghi thông báo hợp đồng. Cần đọc/đánh dấu thông báo theo chủ sở hữu; sự kiện booking/thanh toán/lịch trình/sự cố; kênh gửi, retry và theo dõi kết quả nếu gửi email/push. |
| P1 | Vận hành / báo cáo | Đã có API tàu, cabin, quy định, sự cố, hải trình và điểm dừng; không cần viết lại toàn bộ. Cần tổng hợp dashboard/báo cáo công suất, booking, tour/nhóm khách, sự cố và lịch trình; các thay đổi được phê duyệt phải có lịch sử và thông báo cho bên liên quan. |
| P1 | Hoạt động / dịch vụ bờ và biển | CRUD/lifecycle/đăng ký/nhóm khách đã có. Hoàn thiện kiểm tra sức chứa đồng thời, lịch trùng và điều kiện đổi/hủy; nối việc ghi nhận doanh thu/hoàn tiền với payment. Endpoint kiểm tra lịch dịch vụ hiện trả 501 vì schema dịch vụ chưa có lịch; cần bổ sung mô hình lịch nếu nghiệp vụ yêu cầu, không trả kết quả kiểm tra giả. |
| P1 | BLE / thiết bị định vị | Đã có API ingest/tracking/calibration và gán/thu hồi định danh BLE hành khách. Cần kiểm chứng toàn tuyến thiết bị thật; xác thực và giới hạn thiết bị theo receiver/chuyến; kiểm soát truy cập vị trí, dữ liệu cũ/trùng và thu hồi định danh khi kết thúc chuyến theo chính sách lưu trữ được chốt. |
| P1 | Audit liên module | AuditService đã có, không cần tạo lại từ đầu. Cần bảo đảm các hành động gán quyền, xác nhận booking, thanh toán/hoàn tiền, thay đổi lịch, xử lý sự cố và truy cập dữ liệu nhạy cảm đều được ghi đúng phạm vi, không ghi mật khẩu/token/số giấy tờ thô. |

## 5. Quy tắc mô hình dữ liệu cần giữ đúng

- Cổng thanh toán, POS terminal và thiết bị định vị là tác nhân tích hợp; không tự chuyển chúng thành role đăng nhập nhân viên.
- Một chuyến có một `returnPortId` ở BE hiện tại; nhiều cảng ghé thuộc Itinerary/CruiseStop. Context diagram không yêu cầu tự đổi field này thành mảng.
- Giữ riêng trạng thái booking, hợp đồng, đợt thanh toán, giao dịch, đăng ký hoạt động và check-in. Không suy từ một trạng thái để tự đánh dấu các trạng thái còn lại.
- Tài liệu định danh, vị trí và chứng từ phải có phạm vi truy cập theo nghiệp vụ. FE ẩn trường hoặc menu không thay thế kiểm tra ở BE.
- Tên mới ở bảng/API không cần đổi chỉ để trùng thương hiệu; tên hiển thị và thông báo gửi khách phải dùng OceVie.

## 6. Thứ tự triển khai và kiểm tra tích hợp

1. Chốt ma trận vai trò/trách nhiệm, điều kiện xác nhận booking và chính sách đặt sát ngày; xử lý migration.
2. Hoàn thiện tài khoản/phân quyền và payment theo cổng được chọn; khóa lỗ hổng xác nhận booking trước khi đủ điều kiện.
3. Kiểm tra trọn luồng: đặt phòng → lịch trả theo đợt → giao dịch thật đã xác minh → đủ điều kiện xác nhận booking.
4. Hoàn thiện check-in, gắn định danh, đăng ký hoạt động/tour, yêu cầu dịch vụ và POS.
5. Nối hóa đơn, hoàn tiền/quyết toán, thông báo, báo cáo và kiểm chứng BLE thiết bị thật.

Mỗi nhóm cần OpenAPI/DTO/error code rõ ràng, test gọi API trái quyền, test sở hữu dữ liệu, test cạnh tranh/chống gửi trùng cho các thao tác có trạng thái. Kết quả hiện có: 28 test BE liên quan thay đổi local và kiểm tra booking STAGES trên QA đã đạt ở task trước; đó chưa phải kiểm chứng các module TODO hoặc chứng nhận production.

Không có thay đổi BE source, tài khoản hoặc database nào được thực hiện trong lượt bàn giao tài liệu này. Không push BE.
