# Kết nối OIM / Regulation — phần còn thiếu từ BE

Đối chiếu ngày 2026-10-14 với BE commit `31ed42db0822f2f6d0e5572350daa61cfdbe420e`.
Phạm vi: chỉ thay FE. Tài liệu này ghi nhận giới hạn, không cấp quyền sửa BE.

## Kết quả FE

| Chức năng | FE kết nối |
| --- | --- |
| OIM list/detail | GET `/operational-issues`, GET `/operational-issues/{id}` |
| Người xử lý | GET `/identity/users?status=ACTIVE&assignableFor=OPERATIONAL_ISSUE`; không lấy người báo cáo làm ứng viên thay thế |
| Assign / Start | PATCH `/{id}/assign` với `assignedToId`; PATCH `/{id}/start` |
| Record / Verify | POST `/{id}/resolution` với `resolution`; PATCH `/{id}/verify`; actor lấy từ JWT principal, không gửi UUID suy đoán |
| Close / Reopen | PATCH `/{id}/close`, PATCH `/{id}/reopen` |
| Regulation list/detail/create/edit | GET list/detail, POST create, PUT full DTO |
| Activate / Deactivate | PATCH `/{id}/activate`, PATCH `/{id}/deactivate` |
| Conflict khi activate | GET `/operational-regulations/{id}/conflicts?context=ACTIVATE`; dùng severity/canProceed/message/comparedWith của BE |
| Gán tàu/chuyến | POST `/ships/{id}/regulations/precheck` hoặc `/cruises/{id}/regulations/precheck`, sau đó POST gán |
| Gỡ quy định | DELETE `/ships/{id}/regulations/{regulationId}` hoặc endpoint tương ứng của cruises |
| Quy định trực tiếp/kế thừa đang hiệu lực | GET `/ships/{id}/regulations/effective` hoặc cruises; dùng sourceLabel, checkedAt, canRemove và lý do từ BE |

Các đường dẫn trên có tiền tố `/api` qua transport/Vite proxy.
Search/filter/phân trang danh sách OIM và Regulation thực hiện ở FE. Đổi trang không gọi API.
Danh mục tàu vốn đã có phân trang phía BE: FE đọc hết các trang lookup, không yêu cầu BE thêm pagination.

API lỗi sẽ hiển thị lỗi; không tự chuyển sang mock hoặc báo mutation thành công giả.
`code`, `details`, `traceId` được giữ trong ApiError; form map tên trường DTO sang tên trường FE.
Timeout/network error sau mutation không đồng nghĩa BE chưa ghi: tải lại dữ liệu trước khi thử lại.

## Các giới hạn cần chủ sở hữu BE xác nhận

### GAP-01 — Chưa có luồng cấp JWT (chặn Record / Verify trên web)

- Nguồn: `OperationalIssueController.resolveActorId` yêu cầu CasmsPrincipal và trả 401 nếu thiếu.
- Có JwtService.generateToken và JwtAuthenticationFilter, nhưng không tìm thấy controller login/token/refresh;
  AuthenticationService hiện chỉ implements UserDetailsService.
- FE cũng chưa có login provider. Transport đã có `setApiAccessToken(token)` để provider chính thức tích hợp;
  token chỉ ở bộ nhớ, xóa bằng `setApiAccessToken(null)` khi logout.
- Không dùng reporter/assignee làm actor, không nhúng JWT hoặc secret trong VITE_*.
- Cần contract xác thực hoặc nguồn token chính thức. Chưa thể kiểm chứng sáu action E2E.

### GAP-02 — Chưa có audit/history OIM

- Controller/response chỉ có bản ghi hiện tại, không có history/events.
- Timeline FE hiển thị các timestamp hiện tại; History thông báo chưa có nguồn.
- Reopen xóa resolution/verification hiện tại theo OperationalIssueService; không thể phục hồi lịch sử từ DTO này.
- Các trường cũ như reopenCount, impactSummary, linkedRequestCount không có nguồn API được xác nhận.

### GAP-03 — Chưa có tra cứu ngược đối tượng theo Regulation

- Detail Regulation không trả danh sách tàu/chuyến đã gán; controller không có endpoint targets.
- Endpoint theo host đã có, nhưng không phải API tra cứu ngược theo regulationId.
- FE không hiển thị “không có liên kết” khi chưa biết; ô đối tượng được gán ghi rõ chưa có dữ liệu API.
- GLOBAL là phạm vi tự áp dụng, không được trình bày như một join-row đã tạo.

### GAP-04 — Effective snapshot không phải toàn bộ assignment

- ShipRegulationService/CruiseRegulationService.getEffectiveSnapshot lọc theo ACTIVE và khoảng thời gian.
- Liên kết với quy định INACTIVE, DRAFT, hết hạn hoặc chưa tới hiệu lực không nằm trong snapshot.
- API list cũ trả ID và không có capability/removal reason. FE dùng nó để loại ứng viên đã gán;
  màn hình chính hiện ghi rõ chỉ hiển thị snapshot đang hiệu lực.
- Vì vậy chưa có UI quản lý đầy đủ các liên kết ngoài hiệu lực với capability chính thức.
  Nếu cần đầy đủ, cần thống nhất nguồn/capability cho các row này (không tự sửa BE).

### GAP-05 — Chính sách khóa giá trị / phiên bản chưa được API xác nhận

- OperationalRegulationResponse không có hasBeenActive, canEditFields, version/ETag.
- FE giữ chính sách bảo vệ giá trị có sẵn với record không còn DRAFT; đã ghi rõ đây là policy FE,
  không phải lịch sử ACTIVE được BE xác nhận.
- PUT nhận full DTO, gồm giá trị hiện tại kể cả khi ô value bị khóa; BE update hiện cho phép applyRequest.
- Giá trị version nội bộ FE không phải optimistic-lock của BE. Chưa thể đảm bảo chống ghi đè đồng thời.

### GAP-06 — Danh sách handler chưa chứng minh quyền nghiệp vụ

- IdentityService.findUsers lọc ACTIVE; assignableFor chỉ đặt capabilityLabel, chưa lọc role/capability.
- displayName hiện lấy username. FE dùng đúng response, không tự gán role hoặc tên nhân sự.
- SecurityConfig hiện permitAll và tắt pre/post authorization; nút hiển thị không phải bảo đảm phân quyền.
- Cần BE xác nhận đây là behavior dev hay chính sách chính thức trước production.

### GAP-07 — Chưa có verdict tổng hợp conflict của host hiện tại

- Có precheck ứng viên theo host và conflict của từng regulation khi activate.
- Effective snapshot không chứa verdict conflict tổng hợp cho toàn bộ quy định đang áp dụng.
- FE bỏ thẻ conflict demo cố định; chỉ hiển thị kết quả BE trả khi precheck ứng viên/activate.
- Không tự suy ra ưu tiên giữa GLOBAL / SHIP / CRUISE.

## Môi trường và kiểm chứng

- BE đã có `V2__add_operational_issue_verification.sql`; lỗi thiếu cột trước đây không còn được coi
  là thiếu migration trong source. Chưa xác nhận migration đã chạy trên database của bạn.
- `docker ps` thất bại: Docker Desktop Linux engine pipe không tồn tại.
- HTTP probe `http://localhost:8080/api/operational-issues` không kết nối được (HTTP 000).
- Vì vậy không thực hiện ghi dữ liệu thử vào BE, không tự chạy migration, không sửa cấu hình BE.
- FE: 31 test Node pass; lint/typecheck/build pass trên Node 24.19.0.
  Các test dùng fetch giả lập theo DTO/controller của revision nêu trên, không thay thế E2E với BE thật.
- Test conflict fail-closed đã kiểm chứng red/green: bỏ guard → 1 fail; khôi phục guard → 1 pass.
- Chưa kiểm tra render/interaction trình duyệt ở desktop/mobile trong lần tích hợp này.
- Task tracing tùy chọn `npx --no-install ai-devkit task list` không chạy được do CLI chưa cài;
  không cài thêm dependency để ghi log.
- Hash BE diff trước/sau đều `b742feac4aba756de4e8b27c6869bf6f2e4e5919`;
  chỉ còn hai sửa đổi có sẵn `.idea/misc.xml`, `src/main/resources/application-dev.yml`.

## Cách kiểm tra tiếp khi BE hoạt động

1. Chủ sở hữu BE khởi chạy runtime/database theo quy trình của BE và xác nhận migration V2.
2. Chạy `npm run dev` tại CASMS_WebApp; Vite proxy `/api` tới localhost:8080.
3. Mở `/admin/issues`, `/admin/regulations`; kiểm tra UUID thật, empty/error và filter/page.
4. Dùng `/admin/ships/{shipUuid}/regulations` hoặc `/admin/cruises/{cruiseUuid}/regulations`
   với UUID BE thật. Các màn Cruise mock ngoài phạm vi không cấp UUID BE hợp lệ.
5. Khi có login/token contract chính thức, nối provider vào setApiAccessToken rồi kiểm tra
   Assign → Start → Record → Verify → Close → Reopen, reload từng bước để xác nhận persistence.
6. Kiểm tra conflict blocking/warning, assign/remove và trường hợp dữ liệu thay đổi giữa precheck và submit.

## Thiết kế

Skill generate-design-tokens được áp dụng theo ràng buộc giữ palette đầu vào:
giữ nguyên các token status `--oim-*` và `--reg-*`, không tạo màu mới hoặc đổi theme.
Không có yêu cầu palette mới nên không mở palette editor. Không tuyên bố WCAG khi chưa đo contrast.
