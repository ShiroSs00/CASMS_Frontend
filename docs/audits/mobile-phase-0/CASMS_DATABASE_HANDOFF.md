# CASMS Database Handoff

Nguồn Phase 0, FE `3c01db0`, BE `0bc2b38`. Handoff ghi yêu cầu cho chủ Backend/QA/DB. FE chỉ nối hạng mục phụ thuộc sau khi contract được xác nhận. Trạng thái blocker áp dụng theo chức năng hoặc gate ghi ở từng mục.

## DB-01 — Seed Asian voyage bị PostgreSQL từ chối

| Hạng mục | Nội dung |
|---|---|
| Priority | P1 |
| Tham chiếu audit | M09 |
| File path | CASMS_Frontend/CASMS_MobileApp/tests/integration/seed-asian-voyage.sql:21; CASMS_Backend/src/main/resources/db/migration/V74__ship_operational_lifecycle.sql:11–13 |
| API liên quan | POST /auth/login; GET /itineraries/mine và các API phụ thuộc seed voyage |
| Expected behavior | Fixture cài được trong DB QA mới đã migrate để harness có tài khoản và chuyến. |
| Actual behavior | psql exit 3 tại Ship.status=ACTIVE, vi phạm ck_ship_lifecycle_status. Transaction không commit. |
| Root cause | V74 chuyển ACTIVE cũ sang READY và constraint mới không nhận ACTIVE. |
| Ảnh hưởng đến Frontend | Bảy ca HTTP Mobile chưa qua login. Không thể chứng minh E2E với fixture hiện tại. |
| Yêu cầu Backend xử lý | Chủ QA/DB cung cấp fixture phù hợp lifecycle và hồ sơ đặt chỗ thực của QA. Xác nhận máy chủ QA riêng và không reset DB dùng chung. |
| Acceptance criteria | Seed commit trên DB QA mới; login xác nhận đúng test identity, có chuyến/cabin và đi qua harness thao tác nghiệp vụ. |
| Blocker status | Chặn HTTP E2E Mobile. Không chặn tính năng FE có contract đã xác nhận. |

## DB-02 — Checksum lock thiếu migration V140

| Hạng mục | Nội dung |
|---|---|
| Priority | P2 |
| Tham chiếu audit | Phase 0 test |
| File path | CASMS_Backend/src/test/java/com/casms/config/flyway/MigrationChecksumLockTest.java:61; src/main/resources/db/migration/V140__cruise_package_addon_vnd.sql; src/test/resources/flyway/migration-checksums.properties |
| API liên quan | Không gắn với endpoint riêng; ảnh hưởng gate migration cho catalog add-on |
| Expected behavior | Tất cả migration đã commit được ghi đúng checksum trong lock. |
| Actual behavior | Checksum test fail do thiếu V140. Flyway runtime vẫn validate 131 migration và migrate đến V140 trên QA. |
| Root cause | Migration mới chưa được ghi trong checksum lock theo kiểm thử. |
| Ảnh hưởng đến Frontend | Chưa thể đóng gate lược đồ cho QA/CI theo quy trình Backend. |
| Yêu cầu Backend xử lý | Chủ Backend/DB đồng bộ checksum lock bằng quy trình repo. |
| Acceptance criteria | Checksum test pass và Flyway validate trên QA mới. |
| Blocker status | Chặn gate checksum CI. Migration thử nghiệm đã chạy thành công. |

## DB-03 — Assertion Flyway còn kỳ vọng trước V140

| Hạng mục | Nội dung |
|---|---|
| Priority | P2 |
| Tham chiếu audit | Phase 0 test |
| File path | CASMS_Backend/src/test/java/com/casms/config/flyway/FlywayMigrationPostgresIntegrationTest.java:103,130,148,257,297 |
| API liên quan | Không gắn endpoint riêng; gate schema cho Mobile QA |
| Expected behavior | Fresh migrate và upgrade kiểm đúng schema mới nhất, đồng thời giữ kiểm dữ liệu cũ. |
| Actual behavior | 5 assertion fail. Ba ca mong V139 nhưng nhận V140; hai ca mong 11/10 migration nhưng nhận 12/11. Suite 5 pass, 5 fail, 1 skip. |
| Root cause | Mốc version và count được cố định ở kỳ vọng trước V140. |
| Ảnh hưởng đến Frontend | Mất tín hiệu kiểm hồi quy cho fixture và nâng cấp dữ liệu trước Mobile E2E. |
| Yêu cầu Backend xử lý | Chủ Backend/DB cập nhật các kỳ vọng, giữ assertions bảo toàn dữ liệu cũ và kiểm rõ ca skip. |
| Acceptance criteria | Chạy fresh/upgrade trên DB QA riêng và không còn fail do mốc migration cũ. |
| Blocker status | Chặn gate suite Flyway. Không chặn các màn FE đã có API contract. |

Bằng chứng chi tiết trong [báo cáo kiểm thử](CASMS_MOBILE_PHASE_0_TEST_REPORT.md) và [ma trận API](CASMS_MOBILE_PHASE_0_API_CONTRACT_MATRIX.md).
