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
