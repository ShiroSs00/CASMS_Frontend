# CASMS Mobile Phase D — CROSS_APP_QA

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, `main`, upstream `origin/main`, cộng working tree B/C. BE `0bc2b3831301a0d67d45bacc120a161dbacec026`; giữ `?? qa/` từ trước. Chỉ sửa Mobile/tài liệu, không Backend/DB/Web, SQL/seed/Maven/API mutation thật, commit/push hoặc dependency. Đã đối chiếu AGENTS/OceVie Mobile, báo cáo 0/A0/A/B/C và handoff trong cùng phiên. Contract STATIC_VERIFIED, chưa xác nhận deployment QA. Áp dụng 7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE. Kết quả kiểm tra cuối ở FE_REGRESSION.

Cross-adapter test decode cùng request qua Passenger requestSchema và POS request: exact ID/BP/service/schedule/quantity/status/Fare snapshot/unit/fulfilled quantity. Đây là test adapter, KHÔNG phải cross-app E2E. Không SSE hoặc local state bridge.

Prerequisites: QA URL tách database đang dùng; quyền mutation và cửa sổ test; activated Passenger A/B cùng và khác booking; staff POS và staff ngoài scope; device credential, terminal/area/cruise assignment; Confirmed/Active BP; IN_PROGRESS cruise/date; service/schedule/quota/grant/allowance và activity dataset. Không tự seed hoặc reset DB, theo DB-04/06.

Runbook, lưu ID/time và request/response đã che token/UID/PII:

1. Passenger A chọn BP/voyage, tạo request bằng C; ghi request/BP/cruise/service/schedule/quantity/unit/grant. Passenger B không thấy A. POS đúng scope đọc cùng request, ngoài scope bị từ chối.
2. Staff assign→accept→start; Passenger refetch từng bước. Fare thiếu quantity/sai unit phải fail; full quantity đúng unit mới complete. QA kiểm một ServiceUsage SERVICE_COMPLETE:id và grant used/remaining server; Passenger refetch. Không POST sale khi fulfill; repeat/timeout/GET reconcile không thêm usage/charge.
3. POS bán mới riêng với BP/account hợp lệ; lưu sale/request/charge/ledger IDs, statement trước/sau server. Hoàn tất request vừa tạo không thêm charge. Sai account/BP/cruise, null price, currency guard, thiếu allowance, hết quota phải fail không debit.
4. Ngắt response sau commit có kiểm soát trên QA. Giữ key/input qua đóng modal và app restart cùng employee/terminal/cruise. GET known sale hoặc manual same-key replay trả cùng sale/request/charge, một debit. Đổi employee/API/cruise bị blocked, không lộ journal. Cùng key khác intent phải conflict, không tạo key mới.
5. Passenger register→PENDING; Staff đọc cùng registration/BP/activity/cruise, sửa số lượng PENDING rồi confirm. Participation REGISTERED→check-in khi IN_PROGRESS→checkout→complete. Passenger GET registration COMPLETED. No-show chỉ sau end; CANCELLED/stale/ngoài scope bị chặn. Capacity/duplicate theo BE.
6. Background/resume, employee expired/disabled, assignment revoked, close timeout, terminal switch: màn cũ không ghi tiếp/nhận late response, pending journal còn. QR claim không là payment token. NFC lookup cần quyền và máy thật.
7. Phone nhỏ/tablet, portrait/landscape, dynamic text, numeric keyboard, TalkBack/VoiceOver/reduced motion: context/label/modal/loading/error/empty/count rõ, không chồng text hoặc mất operation.

Evidence: 164 unit/contract pass; chưa có QA URL/accounts/dataset/quyền mutation được xác nhận, ADB không có device. Không chạy integration seed SQL cũ. REAL_API_NOT_RUN, CROSS_APP_E2E_NOT_RUN, DEVICE_E2E_NOT_RUN. Export không chứng minh nghiệp vụ. Acceptance FE ready với external blockers; BE/QA chỉ đóng gate bằng evidence thực.


API và input đối chiếu từng bước, sau base /api:

| Bước / actor | API và input QA | Expected / điều kiện đối chiếu |
|---|---|---|
| 1 Passenger | POST /servicepackage/requests: serviceId, bookingPassengerId, quantity, note, serviceScheduleId, idempotencyKey; GET /servicepackage/requests/{id} | REQUESTED, exact BP/service/schedule/quantity; GET bằng Passenger B bị từ chối hoặc list không có A |
| 2 Staff | GET /pos/session, /pos/requests; POST /pos/requests/{id}/actions/{assign,accept,start,complete}; Fare complete body fulfilledQuantity/unitCode | X-POS-Session đúng employee/terminal/cruise; exact IDs qua từng state; BE/QA kiểm operation SERVICE_COMPLETE:id một lần và grant projection server |
| 2 Passenger | GET /servicepackage/requests/{id}, GET /booking/{bookingId}/cruise-package-entitlements | Trạng thái/fulfilled quantity và quyền lợi cùng BP sau refetch; không trừ quota local |
| 3–4 Staff | GET /pos/accounts/{accountId}/passengers/{BP}/statement; POST /pos/sales body serviceId/bookingPassengerId/onboardAccountId/scheduleId?/quantity=1/idempotencyKey; GET /pos/sales/{saleId} nếu biết ID | Một sale/request/charge/debit; same-key exact-intent replay trả bản ghi cũ; account history và passenger budget khác phạm vi; không tăng charge khi fulfill request đã bán |
| 5 Passenger | POST /activities/{activityId}/registrations: bookingPassengerId/quantity; GET /activities/registrations/{id} | PENDING đúng activity/BP/cruise; sau staff thao tác GET phản ánh server |
| 5 Staff | GET /pos/activities/{id}/registrations và /participations; PUT /pos/activity-registrations/{id}; POST registration actions confirm/cancel và participation actions check-in/checkout/complete/no-show | Đúng lifecycle/permission/linked IDs; quantity edit chỉ PENDING; no-show sau end; activity hủy không thao tác tiếp |
| 6 Staff | GET/DELETE /pos/session và POST open session; lookup card theo B khi được phép | Resume đọc context, close timeout chưa báo kết thúc; revoked/ngoài scope bị từ chối, journal pending không bị xóa |

Input UUID/QA account/terminal do BE/DB cấp, không điền ID từ production vào runbook. Harness A0 hiện có `tests/integration/qa-environment.mjs` và `scripts/run-qa-tests.mjs` chỉ được dùng sau readiness và kiểm phạm vi từng test; không chạy seed SQL hoặc Backend startup. Manual cross-app/native QA cần hai phiên ứng dụng và đối chiếu BE/QA riêng, không được thay bằng harness transport stub.
