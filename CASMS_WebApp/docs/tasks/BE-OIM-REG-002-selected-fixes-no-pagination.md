# BE-OIM-REG-002 — Các thay đổi Backend được chọn để kết nối FE




Hợp đồng tích hợp Frontend: `WEB-OIM-REG-003.md`

## Mục tiêu

Backend chỉ triển khai bảy hạng mục đã được chọn:

1. BE-01 — bổ sung schema xác minh Operational Issue.
2. BE-02 — trả lỗi nghiệp vụ đúng HTTP status và error code.
3. BE-04 — cung cấp dữ liệu user/handler cho Assign Handler.
4. BE-06 — lấy resolver/verifier từ user đã xác thực.
5. BE-07 — thống nhất response bằng `ApiResponse<T>`.
6. BE-09 — trả kết luận conflict chính thức từ Backend.
7. BE-10 — trả dữ liệu assignment đầy đủ thay vì chỉ ID.


## BE-01 — Bổ sung schema xác minh Operational Issue

### Vấn đề hiện tại

Entity `OperationalIssue` ánh xạ hai field:

- `verified_by`
- `verified_at`

Flyway `V1__initial_schema.sql` chưa tạo hai cột này. Hibernate vì vậy làm
`GET /api/operational-issues` trả HTTP 500 với lỗi PostgreSQL `column verified_at does not exist`.

### Thay đổi bắt buộc

Tạo migration mới, không chỉnh sửa V1 đã được áp dụng:

```text
src/main/resources/db/migration/V2__add_operational_issue_verification.sql
```

Migration phải:

- thêm `verified_by uuid`, cho phép null;
- thêm `verified_at timestamptz`, cho phép null;
- thêm foreign key từ `verified_by` đến `User.user_id`;
- giữ dữ liệu OPEN/IN_PROGRESS hiện có hợp lệ;
- không tự gán verifier giả cho dữ liệu RESOLVED/CLOSED cũ.

### Tiêu chí hoàn thành

- Flyway cài mới V1 → V2 thành công.
- Flyway nâng cấp database V1 hiện có thành công.
- `GET /api/operational-issues` trả HTTP 200.
- Record Resolution → Verify Resolution → Close lưu và đọc lại đúng `verifiedById`, `verifiedAt`.

## BE-02 — Chuẩn hóa lỗi nghiệp vụ

### Vấn đề hiện tại

`GlobalExceptionHandler` chưa xử lý các exception được OIM và Regulation service sử dụng phổ biến:

- `IllegalArgumentException`
- `IllegalStateException`
- `EntityNotFoundException`

Các lỗi nghiệp vụ dự kiến vì vậy bị trả thành HTTP 500 `Internal server error`.

### Hợp đồng lỗi bắt buộc

Giữ `error` ở dạng chuỗi để FE hiện tại tương thích. Bổ sung `code`, `details`, `traceId`:

```json
{
  "success": false,
  "error": "Chỉ issue RESOLVED mới có thể đóng.",
  "code": "OIM_INVALID_TRANSITION",
  "details": {
    "currentStatus": "OPEN",
    "requiredStatus": "RESOLVED"
  },
  "traceId": "correlation-id",
  "timestamp": "2026-10-13T10:00:00Z"
}
```

Ánh xạ tối thiểu:

| Trường hợp | HTTP | Error code |
| --- | ---: | --- |
| Request/body/path không hợp lệ | 400 | `VALIDATION_FAILED` |
| Chưa xác thực | 401 | `AUTH_REQUIRED` |
| Không có quyền | 403 | `ACCESS_DENIED` |
| Không tìm thấy entity | 404 | `OIM_NOT_FOUND`, `REGULATION_NOT_FOUND`, `HOST_NOT_FOUND` |
| Trùng code/assignment hoặc sai state transition | 409 | `DUPLICATE_CODE`, `REGULATION_ALREADY_ASSIGNED`, `OIM_INVALID_TRANSITION` |
| Bị chặn bởi luật conflict | 422 | `REGULATION_CONFLICT_BLOCKING` |
| Lỗi ngoài dự kiến | 500 | `INTERNAL_ERROR` |

Ưu tiên chuyển lỗi domain sang `BusinessException` có code rõ ràng. FE không được phải phân tích nội
dung chuỗi message.

### Tiêu chí hoàn thành

- Có controller-advice test cho 400, 401, 403, 404, 409, 422 và 500.
- Mọi nhánh lỗi nghiệp vụ OIM/Regulation đã chọn không đi vào `handleGeneral`.
- Response luôn có `success`, `error`, `code`, `timestamp`; lỗi server có `traceId` để tra log.

## BE-04 — API danh sách Handler

### Vấn đề hiện tại

`IdentityController` và `IdentityService` chưa có endpoint user. FE hiện chỉ biết các user ID đã xuất
hiện trong issue, không thể tải danh sách handler có thể gán và chỉ hiển thị được nhãn ID rút gọn.

### Endpoint bắt buộc

```text
GET /api/identity/users?status=ACTIVE&assignableFor=OPERATIONAL_ISSUE
```

Không phân trang trong task này.

Phản hồi:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "displayName": "Nguyễn Văn A",
      "username": "operator01",
      "status": "ACTIVE",
      "capabilityLabel": "Operational Issue Handler"
    }
  ],
  "timestamp": "2026-10-13T10:00:00Z"
}
```

Quy tắc:

- chỉ trả user ACTIVE;
- chỉ trả field an toàn cho màn hình admin;
- không trả `password_hash` hoặc PII không liên quan;
- Backend kiểm tra lại handler có hợp lệ trong `PATCH /operational-issues/{issueId}/assign`;
- nếu role/capability chưa tồn tại trong domain, trả toàn bộ ACTIVE user và bỏ
  `capabilityLabel`; không được tuyên bố đã có role-based authorization.

### Tiêu chí hoàn thành

- Endpoint trả `ApiResponse<List<UserLookupResponse>>`.
- FE có thể hiển thị tên user thật và chọn handler chưa từng xuất hiện trong issue.
- Assign user INACTIVE hoặc không tồn tại trả error code ổn định.
- Test xác nhận response không lộ password hoặc field bảo mật.

## BE-06 — Actor lấy từ user đã xác thực

### Vấn đề hiện tại

Hai endpoint đang nhận actor từ query parameter:

```text
POST  /api/operational-issues/{issueId}/resolution?resolverId=<uuid>
PATCH /api/operational-issues/{issueId}/verify?verifierId=<uuid>
```

Client có thể gửi ID của user khác. FE hiện phải đoán actor từ assignee/reporter hoặc biến môi trường.

### Hợp đồng mục tiêu

```text
POST  /api/operational-issues/{issueId}/resolution
PATCH /api/operational-issues/{issueId}/verify
```

- Lấy `resolverId`/`verifierId` từ `CasmsPrincipal.getUserId()`.
- Request không còn bắt buộc query parameter actor.
- JWT thiếu hoặc không hợp lệ trả 401.
- Principal không được phép thực hiện hành động trả 403.
- Trong thời gian tương thích ngắn, nếu client vẫn gửi actor ID khác principal thì trả 403 thay vì
  tin dữ liệu client.

Task này chỉ yêu cầu authentication tối thiểu để xác định actor cho hai thao tác trên. Thiết kế đầy
đủ role/permission cho toàn hệ thống nằm ngoài phạm vi.

### Tiêu chí hoàn thành

- Resolver/verifier được lưu đúng bằng user trong JWT.
- Không thể mạo danh actor bằng query parameter hoặc body.
- Integration test bao phủ JWT hợp lệ, thiếu JWT, JWT sai và actor giả mạo.
- FE có thể xóa `VITE_CASMS_ACTOR_ID` và logic đoán actor.

## BE-07 — Thống nhất `ApiResponse<T>`

### Vấn đề hiện tại

OIM và Regulation controller trả raw DTO/list, trong khi Ship/Cruise trả `ApiResponse<T>`. FE phải có
hai nhánh parse response.

### Hợp đồng bắt buộc

Mọi endpoint OIM, Regulation và assignment được dùng trong task này phải trả:

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-10-13T10:00:00Z"
}
```

Các kiểu cụ thể:

| Endpoint | Kiểu `data` |
| --- | --- |
| `GET /operational-issues` | `List<OperationalIssueResponse>` |
| `GET /operational-issues/{id}` | `OperationalIssueResponse` |
| Các action OIM | `OperationalIssueResponse` |
| `GET /operational-regulations` | `List<OperationalRegulationResponse>` |
| `GET /operational-regulations/{id}` | `OperationalRegulationResponse` |
| Create/update/status Regulation | `OperationalRegulationResponse` |
| Handler lookup | `List<UserLookupResponse>` |
| Conflict check | `RegulationConflictResponse` |
| Assignment snapshot | `RegulationAssignmentSnapshotResponse` |

Không dùng `PageResponse` trong task này. HTTP 204 được phép cho DELETE không có body; mọi response
có body phải dùng envelope thống nhất.

### Tiêu chí hoàn thành

- Contract test xác nhận mọi endpoint trong bảng dùng cùng một envelope.
- Error response tuân theo BE-02.
- OpenAPI mô tả đúng envelope thực tế.
- Sau FE cutover có thể xóa nhánh parse raw body.

## BE-09 — Kết luận Conflict từ Backend

### Vấn đề hiện tại

`GET /operational-regulations/{regulationId}/conflicts` chỉ trả danh sách ứng viên có khoảng hiệu lực
chồng lấn. FE không thể biết đây là cảnh báo hay xung đột chặn thao tác.

### Response bắt buộc

```json
{
  "success": true,
  "data": {
    "context": "ACTIVATE",
    "severity": "WARNING",
    "canProceed": true,
    "code": "REGULATION_OVERLAP_REVIEW",
    "message": "Có các khoảng hiệu lực cần được rà soát.",
    "comparedWith": [
      {
        "regulationId": "uuid",
        "code": "REG-SPD-001",
        "scope": "GLOBAL",
        "value": "12",
        "unit": "KNOT"
      }
    ]
  },
  "timestamp": "2026-10-13T10:00:00Z"
}
```

Giá trị `severity`:

- `CLEAR`: không có conflict, `canProceed=true`.
- `WARNING`: có vấn đề cần xác nhận, `canProceed` theo policy Backend.
- `BLOCKING`: bị chặn, `canProceed=false`.
- `UNAVAILABLE`: không kiểm tra được, `canProceed=false`.

### Endpoint

Kiểm tra trước khi activate:

```text
GET /api/operational-regulations/{regulationId}/conflicts?context=ACTIVATE
```

Kiểm tra trước khi gán:

```text
POST /api/ships/{shipId}/regulations/precheck
Body: { "regulationId": "uuid" }

POST /api/cruises/{cruiseId}/regulations/precheck
Body: { "regulationId": "uuid" }
```

Backend phải chạy lại conflict check trong transaction của action activate/assign. Kết quả precheck
cũ không được dùng để bỏ qua một conflict vừa phát sinh.

### Tiêu chí hoàn thành

- Có test cho `CLEAR`, `WARNING`, `BLOCKING`, `UNAVAILABLE`.
- Response luôn có `canProceed`, `code`, `message`, `comparedWith`.
- Activate/assign bị chặn khi verdict mới nhất là `BLOCKING` hoặc `UNAVAILABLE`.
- FE không còn phải suy diễn severity từ số lượng candidate.

## BE-10 — Response Assignment đầy đủ

### Vấn đề hiện tại

`ShipRegulationResponse` và `CruiseRegulationResponse` chỉ trả host ID và regulation ID. FE phải:

- gọi danh sách Regulation riêng;
- tự phân loại direct/inherited;
- gọi thêm Ship assignment để ghép quy định kế thừa cho Cruise;
- tự tạo nhãn source/capability.

### Endpoint snapshot đề xuất

Giữ endpoint danh sách ID hiện tại trong thời gian tương thích. Thêm hai endpoint không phân trang:

```text
GET /api/ships/{shipId}/regulations/effective?at=<instant>
GET /api/cruises/{cruiseId}/regulations/effective?at=<instant>
```

Phản hồi:

```json
{
  "success": true,
  "data": {
    "host": {
      "type": "CRUISE",
      "id": "uuid",
      "code": "CR-2026-001",
      "name": "Hải trình Hạ Long"
    },
    "checkedAt": "2026-10-13T10:00:00Z",
    "direct": [
      {
        "regulation": {},
        "source": "CRUISE",
        "sourceHostId": "uuid",
        "sourceLabel": "CRUISE · CR-2026-001",
        "canRemove": true,
        "removeBlockedReason": null
      }
    ],
    "inherited": [
      {
        "regulation": {},
        "source": "SHIP",
        "sourceHostId": "uuid",
        "sourceLabel": "SHIP · SH-001",
        "canRemove": false,
        "removeBlockedReason": "Quy định kế thừa chỉ đọc tại Cruise."
      }
    ]
  },
  "timestamp": "2026-10-13T10:00:00Z"
}
```

Quy tắc ghép dữ liệu:

- Ship: direct gồm `ShipRegulation`; inherited gồm Regulation GLOBAL.
- Cruise: direct gồm `CruiseRegulation`; inherited gồm Regulation SHIP của tàu đang gán và GLOBAL.
- Chỉ direct row có thể `canRemove=true`.
- `regulation` chứa đầy đủ summary cần hiển thị: ID, code, name, type, scope, value, unit, status,
  effectiveFrom, effectiveTo.
- Loại trùng theo regulation ID nhưng giữ source chính xác theo policy.
- `at` mặc định là thời điểm server hiện tại khi FE không truyền.

### Tiêu chí hoàn thành

- Ship snapshot phân tách đúng direct và GLOBAL inherited.
- Cruise snapshot phân tách đúng CRUISE direct, SHIP inherited và GLOBAL inherited.
- Đổi tàu của Cruise làm thay đổi SHIP inherited mà không thay đổi CRUISE direct.
- Host không tồn tại trả 404 theo BE-02.
- FE không cần tự ghép assignment từ ba endpoint khác nhau.

## Thứ tự triển khai

Thực hiện trên feature branch Backend mới, không làm trực tiếp trên `main`.

| Thứ tự | Công việc | Phụ thuộc | Bằng chứng |
| ---: | --- | --- | --- |
| 1 | BE-01 migration verification | Không | Flyway clean-install/upgrade; OIM GET 200 |
| 2 | BE-02 error contract | Không | Test 400/401/403/404/409/422/500 |
| 3 | BE-07 success envelope | BE-02 | Contract test mọi endpoint liên quan |
| 4 | BE-04 Handler lookup | BE-02, BE-07 | DTO an toàn và assign handler integration test |
| 5 | BE-06 principal actor | BE-02, BE-07 | JWT và impersonation integration test |
| 6 | BE-09 conflict verdict | BE-02, BE-07 | Ma trận CLEAR/WARNING/BLOCKING/UNAVAILABLE |
| 7 | BE-10 assignment snapshot | BE-07, BE-09 | Test inheritance độc lập cho Ship và Cruise |
| 8 | FE contract smoke | 1–7 | FE chạy với API mới; không dùng workaround tương ứng |

## Checklist bàn giao cho Frontend

- [ ] OIM list/detail trả HTTP 200 sau migration.
- [ ] Handler endpoint trả danh sách ACTIVE user đầy đủ, không phân trang.
- [ ] Resolver/verifier lấy từ JWT principal.
- [ ] Tất cả success response liên quan dùng `ApiResponse<T>`.
- [ ] Mọi lỗi dự kiến có HTTP status và error code ổn định.
- [ ] Conflict endpoint trả verdict và `canProceed`.
- [ ] Ship/Cruise snapshot có Regulation summary cùng direct/inherited source.
- [ ] OpenAPI đã cập nhật đúng payload thực tế.
- [ ] FE tiếp tục tự search/filter/paginate; Backend không thêm API pagination trong task này.

## Ngoài phạm vi

- API pagination, server-side search/filter/sort.
- OIM event/history table và history endpoint.
- Regulation optimistic version hoặc metadata lần kích hoạt đầu tiên.
- Chính sách last-target ngoài capability được trả trong snapshot.
- Sửa Cruise nullable-filter query.
- Mô hình role/permission đầy đủ cho toàn hệ thống.
- Chỉnh sửa giao diện Figma hoặc code Frontend trong task Backend này.
