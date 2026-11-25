# CASMS Database Handoff — Phase A0-FE

Baseline FE `3c01db0`, BE `0bc2b38`. Đã đọc Phase 0, `CASMS_MobileApp/tests/integration`, các migration V74/V140 và các test liên quan ở Backend. Tệp sửa là báo cáo này và harness FE. Kỳ vọng trước/sau, nguyên nhân và acceptance được ghi dưới đây. Chưa có QA xác nhận để chạy lại fixture hay migration trong A0-FE.

| Finding | Priority / trạng thái | Source / API liên quan | Expected → Actual / nguyên nhân | Ảnh hưởng FE / yêu cầu và acceptance |
|---|---|---|---|---|
| DB-01 | P1 / BLOCKED | `CASMS_MobileApp/tests/integration/seed-asian-voyage.sql:21`, V74 `ck_ship_lifecycle_status`; login/voyage | Seed phù hợp schema → PostgreSQL V140 từ chối `Ship.status=ACTIVE`, trạng thái cũ bị V74 thay thế. | Chặn E2E. Nhóm QA cung cấp seed hợp lệ và chứng minh login đúng identity, voyage/cabin lấy được từ QA. |
| DB-02 | P2 / OPEN | `CASMS_Backend/src/test/resources/flyway/migration-checksums.properties`, `MigrationChecksumLockTest.java:61`; gate migration | Lock có mọi migration → thiếu V140 ở Phase 0. Runtime QA validate 131 migration và đến V140. | Chặn gate checksum CI. Chủ DB đồng bộ bằng quy trình repo và chạy lại gate. |
| DB-03 | P2 / OPEN | `CASMS_Backend/src/test/java/com/casms/config/flyway/FlywayMigrationPostgresIntegrationTest.java:103,130,148,257,297`; gate fresh/upgrade | Kiểm mốc hiện hành → 5 assertion còn kỳ vọng version/count trước V140. | Chặn gate Flyway. Chủ DB cập nhật kỳ vọng và chứng minh fresh/upgrade bảo toàn dữ liệu. |
| DB-04 | P1 / BLOCKED | `CASMS_MobileApp/tests/integration/qa-environment.mjs`; GET `/auth/me`, ServiceRequest persistence | API và PostgreSQL QA riêng, được phép chạy mutation test → chưa có xác nhận môi trường/dataset ở A0-FE. | Nhóm BE/DB cung cấp URL QA, xác nhận schema, mô tả dataset, tài khoản QA và PostgreSQL service chỉ đọc. Preflight phải xác nhận đúng DB và transaction read-only. |
| DB-05 | P1 / OPEN | [Dấu vết Phase 0](../mobile-phase-0/CASMS_MOBILE_PHASE_0_TEST_REPORT.md); datasource runtime | Suite nhắm DB QA riêng → tài liệu lần kiểm thử trước ghi Supabase mặc định bị kết nối và áp dụng V140. Đây là bằng chứng lịch sử, chưa xác minh trạng thái Supabase hiện tại. | Chủ DB đối chiếu schema history và log thay đổi để xác nhận ảnh hưởng. Acceptance là biên bản xác minh và profile QA tách riêng. |
| DB-06 | P1 / BLOCKED | `CASMS_MobileApp/docs/real-api-qa.md`; startup QA | Có hướng dẫn rõ để đội BE mở API/database QA → chưa nhận runbook và môi trường xác nhận. | Đội Backend cung cấp lệnh/script vận hành QA do họ quản lý, profile và kiểm readiness. FE chỉ khởi động Expo và chạy harness đã gated. |

## Dataset bàn giao

Tất cả hạng mục dưới đây đang chờ nhóm QA xác nhận. Chỉ trao đổi thông tin đăng nhập theo kênh nội bộ của dự án.

| Dataset | Kiểm chứng chấp nhận | Phase |
|---|---|---|
| Passenger kích hoạt trên Web, thêm ca chưa kích hoạt | Login và handoff báo đúng trạng thái tài khoản. | A-FE |
| Booking đã xác nhận và cabin hợp lệ | Detail trả đúng hành khách, cabin, tầng và ship. | A-FE |
| Chuyến trước, trong và sau hành trình | Từng trạng thái cho hiển thị và thao tác tương ứng theo contract. | A-FE/H-FE |
| Passenger có nhiều booking/cabin | Chọn chính xác booking và bookingPassenger, chuyển context thành công. | A-FE |
| Service, ServiceSchedule, ServiceRequest | Có sẵn, hết slot, theo dõi cả vòng đời Passenger → POS. | C-FE/D-FE |
| Activity, ShoreExcursion | Có nhiều trạng thái và capacity, trạng thái đăng ký/cancel. | C-FE |
| Package entitlement | Có quyền lợi bao gồm và dịch vụ thu phí để đối chiếu. | C-FE/E-FE |
| Employee, POS Terminal, Device Account | Có actor và thiết bị đúng quyền, thêm trường hợp hết phiên. | D-FE |
| POS resource assignment | Assignment xác nhận theo ship/cruise/area, service/activity khả dụng. | D-FE |
| OnboardAccount, SpendingLimit, OnboardTransaction | Giới hạn và history khớp ledger; đủ/thiếu hạn mức. | E-FE |
| Notification và Check-in | Có unread/read, hành khách trước/sau check-in và contact hợp lệ. | B-FE/F-FE |
| Passenger Card | Có claim hết hạn, chưa cấp, đã cấp và mẫu thẻ do QA quản lý. | B-FE/D-FE |

Điều kiện chuyển từ blocked sang nghiệm thu là xác nhận bằng văn bản từ nhóm BE/DB về URL, tên database, quyền chạy các ca có ghi dữ liệu test, phiên bản migration và hồ sơ fixture. Mọi kết quả hiện tại dựa trên audit trước và test harness cục bộ. Không có thay đổi schema, seed, migration, database hay yêu cầu rollback từ A0-FE.

### Đối chiếu Phase A-FE ngày 24/11/2026

DB-01, DB-04 và DB-06 giữ trạng thái **BLOCKED** cho kiểm thử thực. Ưu tiên bộ fixture A-FE gồm tài khoản trước/sau kích hoạt, có hoặc thiếu hồ sơ Passenger, User ID khác BookingPassenger ID, một và nhiều booking có thể chọn, một booking nhiều hồ sơ, booking/hồ sơ bị hủy, cabin chưa gán và itinerary chưa công bố. Bổ sung ca chuyển múi giờ và hai chuyến cùng mức ưu tiên. Acceptance là đội BE/DB cấp API QA đã xác nhận cùng dữ liệu và quyền test riêng, rồi suite xác nhận đúng owner, voyage, cabin và profile. A-FE chưa chạy bộ fixture này. Các finding và danh sách dataset trước đây vẫn áp dụng.

### Phase B-FE 25/11/2026

DB-04/06 giữ **BLOCKED**, Priority P1. File tham chiếu `CASMS_Backend/src/main/resources/db/migration/V138__passenger_nfc_card_checkin.sql`, `CASMS_MobileApp/tests/integration/qa-environment.mjs`, `CASMS_MobileApp/docs/real-api-qa.md`. API liên quan: check-in status/start/complete/card-claim và POS passenger-cards preview/confirm/lookup.

Expected: dataset QA và runbook do BE/DB xác nhận, cho phép kiểm các mutation trên môi trường riêng. Actual: chưa được cung cấp xác nhận fixture/runbook cho B-FE. Root cause: thiếu evidence môi trường và dữ liệu; chưa kết luận lỗi schema. Ảnh hưởng FE: chặn REAL_API_PASSED và DEVICE_E2E_PASSED; source/unit/export vẫn tiếp tục.

Yêu cầu đội BE/DB cung cấp Passenger đã kích hoạt, Confirmed booking/Active BookingPassenger, check-in chưa hoàn tất và BoardingReady, hồ sơ chưa có/đã có thẻ, cruise, employee có CHECKIN_BOARDING/POS_ACCESS, POS terminal/device account/session/assignment đúng area/cruise. Thêm expired/consumed claim, wrong-cruise, UID đã gán, timeout sau commit và thẻ tương thích thiết bị thật.

Acceptance criteria: API QA readiness được xác nhận, actor/permission đúng, issue→preview→native read→confirm→lookup thành công cho đúng BookingPassenger; rejected/expired/duplicate/wrong-cruise và đối soát được kiểm; không đụng DB đang dùng. Không tự seed/migrate hoặc đưa credential/UID/claim vào báo cáo. Chưa có finding VERIFIED_FIXED.

## Phase C-FE — bổ sung DB-04/DB-06, không tạo seed mới

| Hạng mục | Nội dung |
|---|---|
| Finding IDs / priority / status / phase | DB-04, DB-06 / P1 / BLOCKED / C-FE, D-FE |
| File path | CASMS_MobileApp/tests/integration/qa-environment.mjs; CASMS_MobileApp/docs/real-api-qa.md; CASMS_Backend/src/main/java/com/casms/servicepackage/service/ServiceRequestService.java; activity/service/ActivityService.java; cruisepackage/service/CruisePackageEntitlementService.java |
| API liên quan | services/detail/schedules/availability/requests/by-operation-key; activities/registrations; shore-excursions theo CruiseStop; booking cruise-package-entitlements |
| Expected behavior | QA URL, quyền mutation, tài khoản và fixture tách biệt được BE/DB xác nhận trước khi chạy integration. |
| Actual behavior | Chưa có xác nhận QA cho C; unit/contract dùng stub, UI fixture chỉ in-memory localhost trong tests. Không có DB write hoặc API mutation thật. |
| Root cause | Thiếu evidence/runbook/dataset xác nhận, không kết luận schema đang lỗi và không tự tạo dữ liệu để che integration. |
| Ảnh hưởng FE | Chặn REAL_API_PASSED, native/device E2E và đối soát Staff POS → Passenger thật; source/tests/export vẫn tiếp tục. |
| Yêu cầu BE/DB | Cấp activated Passenger, Confirmed/Active BP thuộc một/nhiều booking/chuyến; service catalogue/category/ship assignment; slot còn/hết chỗ, service miễn phí/có phí/null price và historical currency; Fare grant còn/hết/không có quota, legacy package, OPTIONAL, unknown occurrence mapping; ServiceRequest mọi enum; activities/tours/registrations mỗi lifecycle; CruiseStop/ItineraryDay exact IDs, omitted/substituted/rescheduled; POS staff/terminal assignment tương ứng. Thêm timeout sau commit/restart/recovery và overlapping target. |
| Acceptance criteria | Readiness QA và quyền test được xác nhận bằng kênh nội bộ, issue dùng đúng actor/BP/cruise; request create/edit/cancel/recovery và staff fulfillment đồng bộ; activity/tour lifecycle, Fare quota và stop change kiểm chứng; không lẫn hồ sơ cùng booking; không chạm DB đang dùng. |
| Blocker status | BLOCKED, giữ mọi finding DB cũ. Không mark VERIFIED_FIXED bằng fixture FE hoặc source. |


### Phase D-FE — bổ sung DB-04/DB-06 ngày 25/11/2026

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority | DB-04 / DB-06 hiện có, bổ sung D; P1 |
| File path | CASMS_Backend/src/main/resources/db/migration/ (read-only reference); pos/{PosService,PosLedgerService,PassengerCardService}.java; servicepackage/service/{ServiceRequestService,ServiceUsageQuotaService}.java; activity/service/ActivityService.java |
| API | /pos/session, /pos/requests/actions, /pos/activities/registrations/participations, /pos/sales, /pos/accounts/.../statement và Passenger C refetch |
| Expected behavior | QA tách DB đang dùng, được xác nhận URL/tài khoản/dataset/quyền mutation, có evidence đối chiếu usage/charge/ledger/grant sau thao tác. |
| Actual behavior | Chưa có QA readiness xác nhận; chỉ unit/contract và export. ADB devices rỗng. Không chạy SQL, seed, migration, Maven integration hoặc API write thật. |
| Root cause | Thiếu môi trường/evidence, không chứng minh schema hoặc dữ liệu production lỗi. |
| Ảnh hưởng Frontend | Chặn REAL_API/CROSS_APP/DEVICE E2E và nghiệm thu Phase E; source Staff POS độc lập tiếp tục. |
| Yêu cầu Backend/Database xử lý | Cung cấp employee/device/terminal/area/cruise assignment đúng/sai/revoked, active BP cùng/khác booking, cruise IN_PROGRESS/date windows, Fare còn/hết quota và legacy prepaid, service null/positive price/currency lịch sử, slot/quota/allowance, request mọi lifecycle, activity registration/participation/capacity và dữ liệu timeout sau commit/restart. Không yêu cầu sửa DB đang dùng. |
| Acceptance criteria | QA chứng minh một usage SERVICE_COMPLETE:id và một charge/debit mỗi sale; replay giữ IDs/key; complete existing sale request không thu lần hai; statement account-wide đúng; Passenger refetch cùng IDs/status/quota và không thấy người khác. Có runbook/audit redacted và rollback do chủ QA/DB phụ trách. |
| Blocker status | BLOCKED_BY_ENVIRONMENT cho nghiệm thu thật; giữ tất cả finding DB cũ, không mark fixed bằng fixture FE. Không có DB mutation trong D. |


### Phase E0-FE — bổ sung DB-04/DB-06, 25/11/2026

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority / Phase | DB-04/DB-06 hiện có / P1 / E0/E-FE; giữ mọi finding cũ |
| File path | CASMS_Backend/src/main/java/com/casms/payment/entity/{OnboardAccount,OnboardAccountMember,SpendingLimit,OnboardTransaction,FinalSettlement,Invoice}.java; payment/service/{GuestPaymentExperienceService,InternationalCruisePaymentService,InvoiceService}.java; pos/{PosLedgerService,OnboardAllowanceService}.java |
| API | Guest Folio; v1 account/balance/transactions/settlement; invoice; POS statement/allowance (mapping chi tiết matrix E0) |
| Expected behavior | QA tách DB đang dùng, owner/member/BP/cruise/account và nguồn ledger được xác nhận trước financial integration. |
| Actual behavior | Chưa có QA URL/accounts/dataset/quyền mutation/database mapping được BE/DB xác nhận cho E0. Không chạy financial API, SQL/seed/migration/Maven. M06/M07 source còn mở. |
| Root cause | Thiếu contract và evidence QA, không kết luận migration/schema lỗi hoặc tự tạo DB để che thiếu tích hợp. |
| Ảnh hưởng Frontend | Chặn real financial read và settlement/invoice/checkout; formatter/state/Spending hướng dẫn vẫn hoàn thiện. |
| Yêu cầu BE/DB | Cung cấp activated Passenger/Confirmed booking/Active BP, voyage active/ended; không account, account chưa có transaction, account nhiều Passenger; primary/member/nonmember/revoked-expired member; limit đủ/hết/null; debit, negative adjustment, refund/reversal, pending/failed/posted/sync conflict; mixed/historical currency; Pending/PartiallyPaid/Completed/Disputed settlement và invoice thật. Chỉ QA do chủ BE/DB quản lý, không sửa DB đang vận hành. |
| Acceptance criteria | Xác nhận readiness/actor/URL/context mapping, missing account/empty/unknown có contract; owner isolation cùng booking/khác cruise; ledger4decimal/currency đúng; POS allowance khác net payable được giải thích; invoice không synthetic, duplicate settlement/payment được đối soát. Audit redacted, không JWT/credential/tài chính thật trong repo. |
| Blocker status | BLOCKED_BY_ENVIRONMENT và phụ thuộc M06/M07/BE-07/11; chỉ đóng bằng evidence source+QA Backend. Không có DB mutation E0. |


### Phase F-FE — bổ sung DB-04/DB-06 ngày25/11/2026

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority / Phase | DB-04/DB-06 hiện có / P1 / F/G-FE; giữ mọi finding cũ |
| File path | CASMS_Backend/src/main/java/com/casms/{ship,activity,notification}/ và ship/model/publication repositories; chỉ tham chiếu, không seed/SQL |
| API | /itineraries/mine, itinerary/detail/days/stops, history, activities/registrations, notifications REST/SSE/ACK, ship/deck/public-model |
| Expected behavior | QA URL/accounts/mutation quyền/database mapping do BE/DB xác nhận, không hệ thống đang dùng. |
| Actual behavior / Root cause | Chưa có readiness F được xác nhận. FE189 tests/SSE9 và export, local fixture không là QA Backend; AVD load app chưa pass. Không chứng minh schema lỗi từ thiếu evidence. |
| Ảnh hưởng FE | Chặn Real API/realtime/cross-app/full device E2E và ACK/published history/model verification; REST/timeline/source/helper tiếp tục. |
| Yêu cầu BE/DB | Activated Passenger/Confirmed booking/Active BP; nhiều own voyages, itinerary nhiều ngày/zone/overnight/sea-day; stop OMITTED/SUBSTITUTED, published/unpublished change; registration/activity/tour và request status; unread/read/ACK nhiều impacts kháccruise/cùnguser; primary/otheruser notifications; operational ship/READY model/Deck/Area/Cabin exact mapping, wrongship/revokedmodel. |
| Acceptance criteria | Owner isolation, correct IDs/timezone/publication; ACK không ảnh hưởng impact ngoài target; true producer→SSE→GET và lost-event recovery, no mutation replay/journal loss; model/cabin mapping và assets version/cache đúng. Các logs redacted, không token/PII thật trong repo. |
| Blocker status | BLOCKED_BY_ENVIRONMENT/BACKEND cho gate thật; giữ M06/M07/M08/M09/M13/M17 và BE-08…24. Không DB/seed/migration/Maven mutation F. |

### Phase G-FE — bổ sung DB-04/DB-06 hiện có, 25/11/2026

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | DB-04 / DB-06 / P1, không tạo ID trùng |
| File path | Backend resources/db/migration và Passenger/ship/notification/POS datasets chỉ tham chiếu; Frontend docs/audits/mobile-phase-g-fe/ |
| API | Passenger voyage/booking/check-in/services/activities/entitlements/notifications REST/SSE; POS session/requests/fulfillment/registration/attendance/sales/statement |
| Expected behavior | QA tách môi trường đang dùng, identity/owner/voyage/terminal mapping được xác nhận; dataset đủ states và tải lớn để nghiệm thu native UI và performance. |
| Actual behavior | Chưa được xác nhận QA URL/accounts/dataset/quyền mutation. G chỉ source/unit/contract/export; fixture riêng không chứng minh DB hoặc Real API. Không chạy SQL/seed/migration/Maven/backend startup. |
| Root cause | Thiếu QA readiness/runtime evidence, không có bằng chứng schema lỗi mới. |
| Ảnh hưởng Frontend | Chặn Real Backend UI/E2E và benchmark dữ liệu đại diện; source/fixture unit/layout checks vẫn thực hiện được. |
| Yêu cầu Backend/Database | Cung cấp các fixtures B/C/D/E0/F đang mở, thêm dataset notification/request/registration/statement lớn, long Vietnamese text/nullable/mixed currency/zero quota/full/closed states, nhiều owner/BP/voyage/terminal và timeout-after-commit recovery; quản lý dữ liệu bởi chủ QA. |
| Acceptance criteria | URL/actor/rights/readiness xác nhận trước chạy; screen states đúng server, isolation/no stale voyage/terminal, quantity/currency/4decimal, no duplicate mutation/journal loss; benchmark ghi hardware/build/dataset, ảnh/log redacted. Không dùng dữ liệu giả production hoặc sửa DB đang dùng. |
| Blocker status | OPEN/BLOCKED_BY_ENVIRONMENT; mọi finding trước giữ, G UI/source không đóng DB-04/06/M06/M07. |
