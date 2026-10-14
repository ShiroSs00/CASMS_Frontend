# BE-OIM-REG-001 — Kế hoạch đồng bộ Backend cho OIM và Regulation

Trạng thái: SẴN SÀNG ĐỂ BACKEND TRIỂN KHAI — chỉ lập kế hoạch, chưa sửa file Backend

Người phụ trách Frontend: Phan Văn Huy  
Backend đã được kiểm tra: `CASMS_Backend` tại commit `e3677bd6f933be31250027e855b9a5cc71cf16ca`  
Hợp đồng tích hợp Frontend: `WEB-OIM-REG-003.md`

## Kết quả cần đạt

Hoàn thiện các hợp đồng Backend mà giao diện Operational Issue Management và Regulation / Ship
Regulation / Cruise Regulation hiện tại cần sử dụng. Sau khi hoàn thành kế hoạch này:

- Danh sách, chi tiết và cả sáu thao tác nghiệp vụ OIM chạy bằng Backend, không cần dữ liệu demo dự phòng.
- Lịch sử OIM đến từ nguồn audit chính thức, không phải dữ liệu do Frontend suy diễn.
- Danh sách, chi tiết, biểu mẫu, trạng thái và màn hình gán Regulation nhận capability và quyết định
  xung đột chính thức từ Backend.
- Mọi API trả về cấu trúc thành công/lỗi ổn định và đúng HTTP status.
- Frontend có thể xóa các giải pháp tương thích tạm thời: tải toàn bộ dữ liệu rồi lọc ở client,
  nhãn ID rút gọn, tự ghép dữ liệu gán và tự chuyển sang demo khi server lỗi.

Đây là tài liệu bàn giao để triển khai. Tài liệu không cho phép thay đổi `CASMS_Frontend` và không
tuyên bố rằng các công việc Backend đã hoàn thành.

## Bằng chứng hiện tại

Các phát hiện dưới đây đã được đối chiếu với code hiện tại và môi trường Docker đang chạy.

| ID | Tình trạng Backend hiện tại | Ảnh hưởng đến Frontend |
| --- | --- | --- |
| BE-01 | Entity `OperationalIssue` ánh xạ `verified_by` và `verified_at`, nhưng Flyway `V1__initial_schema.sql` không tạo hai cột này | `GET /api/operational-issues` trả HTTP 500; OIM phải dùng dữ liệu demo có gắn nhãn rõ ràng |
| BE-02 | `GlobalExceptionHandler` xử lý `BusinessException`, validation và access denied, nhưng service thường ném `IllegalArgumentException`, `IllegalStateException` và `EntityNotFoundException` | Các lỗi dự kiến phải là 400/404/409 lại trở thành HTTP 500 chung chung |
| BE-03 | Danh sách OIM chỉ hỗ trợ `status`, `shipId`, `cruiseId` và trả về mảng thô không phân trang | FE phải tải toàn bộ issue rồi tự search, lọc severity/handler và phân trang |
| BE-04 | `IdentityController` và `IdentityService` vẫn là TODO; chưa có API tra cứu user/handler | FE chỉ hiển thị được `User <short-id>` và chỉ gán được user đã xuất hiện trong issue |
| BE-05 | OIM chưa có bảng hoặc endpoint event/history | Timeline/history trong Figma chưa có dữ liệu chính thức từ Backend |
| BE-06 | Resolver/verifier ID được nhận từ query parameter | Client có thể mạo danh actor khác; FE phải đoán actor ID |
| BE-07 | Controller OIM/Regulation trả body thô, còn Ship/Cruise trả `ApiResponse<T>` | Bộ vận chuyển API của FE phải hỗ trợ hai định dạng thành công |
| BE-08 | Danh sách Regulation không lọc và không phân trang; update không có optimistic version và chưa khóa giá trị sau lần kích hoạt đầu tiên | FE phải lọc cục bộ và suy đoán `hasBeenActive` từ status/`updatedAt` hiện tại |
| BE-09 | API conflict chỉ trả về danh sách Regulation ứng viên | FE không biết kết quả là an toàn, cảnh báo hay chặn và có được phép tiếp tục hay không |
| BE-10 | Response gán Ship/Cruise chỉ chứa host ID và regulation ID | FE phải gọi thêm API và tự ghép danh sách direct/inherited |
| BE-11 | Service gán chưa bắt buộc Regulation phải ACTIVE/còn hiệu lực; `remove` chưa kiểm tra chính sách đối tượng cuối cùng | Kiểm tra capability trên UI không được bảo vệ lại ở server |
| BE-12 | API danh sách Cruise lỗi PostgreSQL SQLState `42P18` khi bỏ trống toàn bộ filter tùy chọn | Consumer không thể tải danh sách/lookup Cruise ổn định |
| BE-13 | Spring Security đang dùng `anyRequest().permitAll()` và tắt method security | Tích hợp local chạy được nhưng chưa có authorization cho production |

## Thuật ngữ nghiệp vụ chuẩn

- **Gán trực tiếp (Direct assignment)**: một dòng `ShipRegulation` hoặc `CruiseRegulation` được lưu
  cho đúng host đang xem.
- **Quy định kế thừa (Inherited regulation)**: quy định áp dụng nhưng không có dòng gán trực tiếp
  trên host đang xem. Ship kế thừa GLOBAL. Cruise kế thừa GLOBAL và các quy định SHIP của tàu được gán.
- **Ứng viên xung đột (Conflict candidate)**: quy định có type/scope/khoảng hiệu lực cần được so sánh.
  Ứng viên không đồng nghĩa với kết luận xung đột.
- **Kết luận xung đột (Conflict verdict)**: quyết định do Backend trả về gồm `CLEAR`, `WARNING`,
  `BLOCKING` hoặc `UNAVAILABLE`, kèm `canProceed`, lý do và các quy định được so sánh.
- **Sự kiện Issue (Issue event)**: một bản ghi audit bất biến cho các hành động report, assign, start,
  resolution, verify, close hoặc reopen. Các cột trên issue hiện tại vẫn là write model; event dùng cho lịch sử.
- **Handler**: user ở trạng thái ACTIVE và được chính sách Backend cho phép xử lý operational issue.
  Không được mặc định coi `user_type` là permission khi chưa có quyết định nghiệp vụ rõ ràng.

## Quy ước API mục tiêu

### Response thành công

Sử dụng `ApiResponse<T>` hiện có một cách thống nhất cho tất cả controller được chỉnh sửa:

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-10-13T10:00:00Z"
}
```

Với endpoint danh sách, đặt dữ liệu Spring `Page` hoặc `PageResponse<T>` ổn định bên trong `data`.
Không trả về mảng không giới hạn khi endpoint đã nhận tham số phân trang.

### Response lỗi

Giữ `error` ở dạng chuỗi để tương thích ngược. Bổ sung field máy có thể đọc thay vì đổi kiểu của
`error`:

```json
{
  "success": false,
  "error": "Chỉ issue ở trạng thái RESOLVED mới có thể đóng.",
  "code": "OIM_INVALID_TRANSITION",
  "details": { "currentStatus": "OPEN", "requiredStatus": "RESOLVED" },
  "traceId": "correlation-id",
  "timestamp": "2026-10-13T10:00:00Z"
}
```

Ánh xạ status bắt buộc:

| Điều kiện | HTTP | Code ví dụ |
| --- | ---: | --- |
| Body/query/path không hợp lệ | 400 | `VALIDATION_FAILED` |
| Thiếu hoặc sai thông tin xác thực | 401 | `AUTH_REQUIRED` |
| Đã xác thực nhưng không có quyền | 403 | `ACCESS_DENIED` |
| Không tồn tại entity | 404 | `OIM_NOT_FOUND`, `REGULATION_NOT_FOUND` |
| Trùng mã, sai chuyển trạng thái, trùng liên kết hoặc version cũ | 409 | `DUPLICATE_CODE`, `OIM_INVALID_TRANSITION`, `REGULATION_ALREADY_ASSIGNED`, `STALE_DATA` |
| Request hợp lệ về cú pháp nhưng bị từ chối bởi luật nghiệp vụ | 422 | `REGULATION_CONFLICT_BLOCKING`, `LAST_TARGET_REQUIRED` |
| Lỗi server ngoài dự kiến | 500 | `INTERNAL_ERROR` |

Chuyển lỗi domain thành các lớp con có kiểu rõ ràng của `BusinessException` hoặc thêm exception
handler cụ thể. Frontend không được phải phân tích chuỗi message để hiểu loại lỗi.

## P0 — Khôi phục tính đúng đắn của Backend

### BE-P0-01: Thêm migration cho thông tin xác minh

Tạo Flyway migration mới; giữ nguyên file `V1__initial_schema.sql` đã được áp dụng.

Tên file đề xuất: `V2__add_operational_issue_verification.sql`

Thay đổi schema bắt buộc:

- Thêm `OperationalIssue.verified_by uuid`, cho phép null.
- Thêm `OperationalIssue.verified_at timestamptz`, cho phép null.
- Thêm foreign key từ `verified_by` đến `User.user_id`.
- Thêm index cho `verified_by` nếu truy vấn handler/audit thực tế sử dụng cột này.
- Hai field được phép null với OPEN/IN_PROGRESS và dữ liệu lịch sử.
- Quyết định và ghi rõ cách xử lý các dòng RESOLVED/CLOSED cũ. Migration không được tự bịa ra verifier.
  Nếu đã có dữ liệu loại này, hoặc response phải đánh dấu legacy-unverified, hoặc phải đối soát từ
  nguồn audit đáng tin cậy trước khi thêm DB check nghiêm ngặt.

Bằng chứng hoàn thành:

1. Flyway áp dụng V1 rồi V2 thành công trên PostgreSQL trống.
2. Flyway nâng cấp thành công database V1 có các issue đại diện.
3. `GET /api/operational-issues` và detail trả HTTP 200.
4. Luồng Record → Verify → Close lưu và đọc lại đúng `verifiedById`, `verifiedAt`.

### BE-P0-02: Trả lỗi domain đúng thay vì HTTP 500

Bao phủ mọi exception hiện đang được service OIM và Regulation sử dụng. Tối thiểu:

- `EntityNotFoundException` → 404.
- trùng code/assignment → 409.
- chuyển trạng thái không hợp lệ → 409.
- location/date không hợp lệ hoặc mâu thuẫn → chọn thống nhất 400 hoặc 422.
- chính sách last-target và blocking conflict → 422.

Thêm test cho controller advice, kiểm tra status, `code`, `error` và `traceId`. Hoàn thành khi mọi
nhánh lỗi nghiệp vụ dự kiến của OIM/Regulation không còn đi vào `handleGeneral`.

### BE-P0-03: Sửa danh sách Cruise khi filter tùy chọn là null

Thay nullable-parameter JPQL đang gây PostgreSQL SQLState `42P18`. Có thể dùng JPA Specification,
Querydsl predicate hoặc các nhánh repository rõ ràng. Phải giữ pagination và mọi tổ hợp `status`,
`shipId`, `cruiseType`.

Bằng chứng hoàn thành: `/api/cruise?page=0&size=20` và mọi tổ hợp một/hai/ba filter đều trả HTTP 200
trên PostgreSQL.

## P1 — Hoàn thiện API Operational Issue

### BE-P1-01: Truy vấn danh sách tại server

Thay hợp đồng danh sách không giới hạn bằng:

```text
GET /api/operational-issues
  ?search=
  &severity=
  &status=
  &shipId=
  &cruiseId=
  &assignedToId=
  &page=0
  &size=20
  &sort=reportedAt,desc
```

Phản hồi: `ApiResponse<PageResponse<OperationalIssueSummaryResponse>>`.

Quy tắc:

- `search` khớp issue code và description, không phân biệt hoa thường.
- Cả sáu filter kết hợp theo điều kiện AND.
- Giới hạn page size tối đa, đề xuất `100`.
- Phân trang tại database; không tải toàn bộ issue rồi lọc bằng Java.
- Sắp xếp ổn định, dùng `issueId` làm tiêu chí phụ khi bằng nhau.
- Thêm index dựa trên query plan thực tế; tối thiểu đánh giá status/severity/ship/cruise/assignee và
  reported time bằng `EXPLAIN`.

### BE-P1-02: Trả về reference đủ để hiển thị

DTO list/detail phải cung cấp đủ dữ liệu hiển thị mà không tạo N+1 request từ Frontend. Dùng nested
reference gọn hoặc các field phẳng tương đương:

```json
{
  "ship": { "id": "uuid", "code": "SH-001", "name": "Ocean Voyager" },
  "cruise": { "id": "uuid", "code": "CR-2026-001", "name": "Ha Long" },
  "cabin": { "id": "uuid", "code": "A-101" },
  "reportedBy": { "id": "uuid", "displayName": "operator01" },
  "assignedTo": { "id": "uuid", "displayName": "engineer01" },
  "resolvedBy": null,
  "verifiedBy": null
}
```

Không trả `password_hash`, trạng thái bảo mật nội bộ hoặc PII không liên quan của user.

### BE-P1-03: API tra cứu Handler

Triển khai API chỉ đọc cho chức năng Assign Handler:

```text
GET /api/identity/users?search=&status=ACTIVE&assignableFor=OPERATIONAL_ISSUE&page=0&size=20
```

Mỗi item trả `id`, display name an toàn, username nếu được phép hiển thị cho admin, status và nhãn
role/capability không nhạy cảm nếu có. Service sở hữu luật assignability và phải kiểm tra lại luật
này trong `PATCH /operational-issues/{id}/assign`.

Nếu dự án chưa định nghĩa role/capability, phải ghi nhận đây là quyết định domain chưa hoàn tất.
Trong giai đoạn đó chỉ trả user ACTIVE và không tuyên bố đã có role-based authorization.

### BE-P1-04: Lịch sử Issue chính thức

Tạo bảng bất biến `OperationalIssueEvent` và endpoint:

```text
GET /api/operational-issues/{issueId}/events?page=0&size=50&sort=occurredAt,desc
```

Field tối thiểu:

- `eventId`, `issueId`, `eventType`, `fromStatus`, `toStatus`.
- `actorId` và display name an toàn của actor.
- `occurredAt`.
- `note` cho resolution/reopen khi phù hợp.
- JSON metadata tùy chọn, chỉ chứa chi tiết audit không nhạy cảm.

Ghi event trong cùng transaction với REPORT, ASSIGN_HANDLER, START_HANDLING, RECORD_RESOLUTION,
VERIFY_RESOLUTION, CLOSE và REOPEN. Mutation thất bại không được thay đổi issue hoặc tạo event.

### BE-P1-05: Hợp đồng workflow và actor

Backend phải giữ state machine sau làm nguồn quyết định chính thức:

| Hành động | Điều kiện trước | Kết quả |
| --- | --- | --- |
| Assign Handler | OPEN hoặc IN_PROGRESS; handler hợp lệ | Giữ nguyên status |
| Start Handling | OPEN và đã gán handler | IN_PROGRESS |
| Record Resolution | IN_PROGRESS; resolution không rỗng | Giữ IN_PROGRESS; ghi resolver/time/text; xóa verification cũ |
| Verify Resolution | IN_PROGRESS và resolution đầy đủ | RESOLVED; ghi verifier/time |
| Close | RESOLVED và có đủ resolution/verification | CLOSED |
| Reopen | RESOLVED hoặc CLOSED | OPEN; xóa resolution/verification; ghi event REOPEN |

Lấy acting user từ `CasmsPrincipal` đã xác thực. Đánh dấu deprecated rồi loại bỏ query parameter
`resolverId`, `verifierId`. Trong thời gian tương thích ngắn, nếu request gửi actor ID khác principal
thì phải từ chối thay vì tin giá trị client.

## P2 — Hoàn thiện API Regulation

### BE-P2-01: Danh sách Regulation tại server

Cung cấp:

```text
GET /api/operational-regulations
  ?search=
  &type=
  &scope=
  &status=
  &effectiveAt=
  &page=0
  &size=20
  &sort=updatedAt,desc
```

Phản hồi: `ApiResponse<PageResponse<OperationalRegulationSummaryResponse>>`.

Trả `status` cấu hình riêng với `effectiveStatus` được tính tại `effectiveAt`. Không tự thay đổi
stored status trong một request đọc.

### BE-P2-02: Lưu metadata vòng đời và version

Thêm Flyway migration và entity field cho:

- optimistic version (`@Version`, ví dụ bigint `version`);
- thông tin lần kích hoạt đầu tiên, ưu tiên `first_activated_at` thay vì suy đoán từ lịch sử.

Trả `version` và `hasBeenActive`/`firstActivatedAt` trong Regulation DTO. Bắt buộc expected version
khi update hoặc đổi status; trả `409 STALE_DATA` khi version không khớp.

Luật phải được Backend thực thi:

- Regulation mới luôn ở DRAFT;
- sau khi Regulation từng ACTIVE, các field nghiệp vụ bất biến—tối thiểu `value`, `unit`, `type`,
  `scope`—không được thay đổi;
- activate phải kiểm tra date range và conflict verdict;
- deactivate chỉ nhận Regulation ACTIVE;
- semantics của EXPIRED chỉ có một nguồn: persisted transition hoặc effective state suy ra, không
  được áp dụng đồng thời cả hai cách.

### BE-P2-03: Trả kết luận xung đột thay vì chỉ trả ứng viên

Thay thế hoặc mở rộng `GET /operational-regulations/{id}/conflicts` bằng response có kiểu rõ ràng:

```json
{
  "context": "ACTIVATE",
  "severity": "WARNING",
  "canProceed": true,
  "code": "REGULATION_OVERLAP_REVIEW",
  "message": "Hai khoảng hiệu lực bị chồng lấn.",
  "comparedWith": [
    { "regulationId": "uuid", "code": "REG-SPD-001", "scope": "GLOBAL", "value": "12", "unit": "KNOT" }
  ]
}
```

Hỗ trợ `CLEAR`, `WARNING`, `BLOCKING`, `UNAVAILABLE`. Phải định nghĩa rõ luật nào chỉ cảnh báo và
luật nào chặn. Activate/assign phải chạy lại cùng phép kiểm tra trong transaction; kết quả precheck
cũ không được dùng để bỏ qua xung đột mới phát sinh.

### BE-P2-04: Snapshot gán theo Host

Thêm endpoint snapshot chính thức cho từng host hoặc mở rộng endpoint danh sách hiện có để trả đúng
phân loại sau:

```text
GET /api/ships/{shipId}/regulations/effective?at=<instant>
GET /api/cruises/{cruiseId}/regulations/effective?at=<instant>
```

Response gồm:

- thông tin tóm tắt host và `checkedAt`;
- `direct[]` có đầy đủ Regulation summary, source `SHIP`/`CRUISE`, `canRemove` và lý do;
- `inherited[]` có đầy đủ Regulation summary và source host (`GLOBAL` hoặc ship ID/name);
- các conflict verdict hiện tại, hoặc link/context để yêu cầu kiểm tra.

Với Cruise, Backend phải ghép:

1. liên kết CRUISE trực tiếp;
2. liên kết SHIP từ tàu hiện được gán cho Cruise;
3. Regulation GLOBAL;
4. loại trùng theo regulation ID nhưng vẫn giữ mọi source áp dụng nếu policy cần hiển thị.

### BE-P2-05: Command gán và chính sách

Giữ các route command hiện tại, nhưng path parameter là giá trị chính thức; body chỉ cần
`regulationId`:

```text
POST   /api/ships/{shipId}/regulations
DELETE /api/ships/{shipId}/regulations/{regulationId}
POST   /api/cruises/{cruiseId}/regulations
DELETE /api/cruises/{cruiseId}/regulations/{regulationId}
```

Validation tại server:

- host tồn tại;
- Regulation tồn tại, đang ACTIVE và có hiệu lực tại thời điểm command;
- scope khớp chính xác SHIP hoặc CRUISE; GLOBAL được kế thừa và không thể gán trực tiếp;
- trùng assignment trả 409;
- conflict policy được kiểm tra trong transaction của command;
- remove chỉ tác động liên kết trực tiếp;
- nếu BR-REG-05 yêu cầu ít nhất một direct target, thao tác xóa target trực tiếp cuối cùng trả
  `422 LAST_TARGET_REQUIRED`. Nếu đây không phải luật mong muốn, phải sửa đồng thời yêu cầu FE và
  hợp đồng này; không để FE và BE áp dụng hai policy khác nhau.

Nên trả snapshot assignment mới sau assign/remove. Cách này loại bỏ một request FE bổ sung và tránh
hiển thị count cũ.

## P3 — Điều kiện tích hợp Production

### Authentication và authorization

Cấu hình `permitAll()` hiện tại chỉ phù hợp môi trường phát triển local tách biệt. Trước khi release:

- bật xác thực cho các route;
- nạp authorities của `CasmsPrincipal` từ mô hình role/permission đã được duyệt;
- bảo vệ mutation OIM, Regulation và command assignment;
- trả 401/403 theo error envelope chung;
- thêm test chứng minh user chỉ có quyền đọc không thể mutation dữ liệu.

Mốc bảo mật này không được chặn việc sửa schema local ở P0, nhưng không được tuyên bố production-ready
nếu chưa hoàn thành.

### OpenAPI và khả năng tương thích

- Mô tả mọi query parameter, enum, response DTO và error code trong Springdoc.
- Chỉ giữ raw-body compatibility trong thời gian deprecation được thông báo; chuyển đồng thời các
  controller liên quan sang `ApiResponse<T>`.
- Tạo lại hoặc cập nhật fixture hợp đồng FE từ tài liệu OpenAPI đã xuất bản.
- Không trả entity trực tiếp qua API.

## Thứ tự triển khai

Làm việc trên một feature branch Backend mới; không triển khai trực tiếp trên `main`.

| Thứ tự | Công việc | Phụ thuộc | Bằng chứng bắt buộc |
| ---: | --- | --- | --- |
| 1 | BE-P0-01 migration verification | Không | Test Flyway cài mới/nâng cấp; OIM GET 200 |
| 2 | BE-P0-02 ánh xạ exception có kiểu | Không | Test controller advice cho 400/404/409/422 |
| 3 | BE-P0-03 sửa Cruise null-filter | Không | Ma trận integration test trên PostgreSQL |
| 4 | OIM paged specification/query | 1–2 | Repository + controller integration test |
| 5 | User/handler lookup và reference mở rộng | 2 | Test DTO an toàn; không lộ password/PII |
| 6 | Migration Issue event và transactional write | 1–2 | Mỗi transition thành công có đúng một event; có rollback test |
| 7 | Actor workflow lấy từ principal | Có identity/security principal | Test chặn mạo danh actor |
| 8 | Regulation paged query và response envelope | 2 | Filter/pagination integration test |
| 9 | Regulation version/activation metadata | 2 | Migration + stale update + immutable field test |
| 10 | Conflict verdict service | 9 | Test clear/warning/blocking/unavailable |
| 11 | Snapshot/command assignment theo Host | 9–10 | Test kế thừa và cô lập dữ liệu Ship/Cruise |
| 12 | Bật production authorization | Có quyết định role/permission | Ma trận test authenticated/forbidden |
| 13 | Xuất bản OpenAPI và chạy FE contract smoke | 1–12 | FE chạy khi tắt demo fallback |

## Ma trận kiểm thử Backend bắt buộc

### OIM

- Danh sách phân trang rỗng/có dữ liệu và từng filter riêng lẻ/kết hợp.
- Search chính xác theo code và search description không phân biệt hoa thường.
- Detail trả 200; ID không tồn tại trả 404.
- Luồng thành công Assign/Start/Record/Verify/Close/Reopen.
- Mọi transition không hợp lệ trả 409 với code ổn định.
- Trường hợp handler và actor không hợp lệ.
- Số lượng/thứ tự/actor/status transition của event; transaction rollback không tạo event mồ côi.
- Nâng cấp database V1 hiện có mà không mất dữ liệu.

### Regulation

- Filter search/type/scope/status/effectiveAt và pagination.
- Trùng code và stale update trả 409.
- Date validation, activate/deactivate, khóa sau lần kích hoạt đầu và semantics EXPIRED.
- Các biến thể conflict verdict và kiểm tra lại trong transaction.
- Phân tách Ship direct và GLOBAL inherited.
- Kế thừa Cruise direct + assigned-ship + GLOBAL.
- Gán Regulation sai scope/inactive/expired/trùng.
- Xóa inherited link, direct link không tồn tại và luật last-target.
- Đổi tàu của Cruise làm thay đổi SHIP inherited nhưng không đổi CRUISE direct.

### Xuyên suốt

- Schema của success/error envelope cho mọi endpoint liên quan.
- Hành vi 401 khác 403.
- Giới hạn page size và thứ tự sắp xếp xác định.
- Dùng PostgreSQL Testcontainers hoặc PostgreSQL thật tương đương để kiểm tra enum, UUID, migration
  và nullable-filter.

## Checklist chuyển FE sang Backend hoàn toàn

Chỉ coi Backend sẵn sàng cho FE cutover khi tất cả mục sau đạt trên cùng một môi trường deploy:

1. `/api/operational-issues?page=0&size=20` trả 200 và page envelope.
2. OIM detail có display reference an toàn và các field verification.
3. Handler lookup trả các user ACTIVE có thể được gán.
4. Mỗi action OIM được lưu, đọc lại và tạo đúng event.
5. Danh sách Regulation trả page envelope có lifecycle/version metadata.
6. Conflict endpoint trả verdict có `canProceed`, không chỉ trả mảng.
7. Snapshot Ship và Cruise phân tách direct/inherited.
8. Lỗi dự kiến trả 400/404/409/422 với code ổn định; không lỗi nào biến thành generic 500.
9. OpenAPI phản ánh đúng contract đang deploy.
10. Cập nhật contract test FE, sau đó xóa OIM demo fallback và workaround ghép Regulation trong một
    nhánh FE riêng.

## Định nghĩa hoàn thành

Task Backend này chỉ hoàn thành khi:

- toàn bộ P0 và P1 đạt;
- các màn hình Regulation trong `WEB-REG-001` được cung cấp đầy đủ bởi contract P2;
- migration chỉ tiến về trước và vượt qua cả test cài mới lẫn nâng cấp;
- toàn bộ ma trận test bắt buộc xanh trên PostgreSQL;
- OpenAPI và payload ví dụ đã được xuất bản;
- FE chạy OIM và Regulation end-to-end khi tắt fallback;
- mọi mục authorization P3 cố ý trì hoãn được ghi nhận là release blocker, không được báo cáo như
  hành vi đã hoàn thành.

## Ngoài phạm vi

- Thiết kế lại các màn hình Figma đã được duyệt.
- Thêm tính năng Cruise, booking, payment hoặc analytics không liên quan.
- Chuyển luật conflict nghiệp vụ sang Frontend.
- Coi capability trên button của client là authorization của Backend.
- Chỉnh sửa migration V1 sau khi đã áp dụng.
- Tạo history giả từ các timestamp của dòng dữ liệu hiện tại.
