# Kiểm thử chức năng Mobile và Backend

**24/11/2026 · FE `3c01db0` · BE `0bc2b38`**. Windows, Node 24.18.0, Java 21.0.12.1, Maven 3.9.16, PostgreSQL 16.15. Kết quả dưới đây thuộc lần audit hiện tại.

## Lệnh và kết quả

| Kiểm tra | Kết quả | Mức bằng chứng |
|---|---|---|
| Kiểm HEAD FE/BE | Đúng hai commit. Diff tracked trống tại lúc kiểm. | Source baseline |
| `tsc --noEmit` và `npm run lint` | Pass, không diagnostic. | Static |
| `node --test tests/*.test.mjs` | 98/98 pass. | Unit, fixture, transport contract |
| `node --test tests/integration/*.test.mjs` | 7/7 lỗi ở hook đăng nhập với ApiError status 0. Harness dùng cứng `127.0.0.1:18080/api`, chưa có Backend đã seed ở đó. | Chưa chạy thao tác nghiệp vụ Mobile |
| `expo install --check` | Map SDK local báo dependencies up to date và cảnh báo offline. | Kiểm compatibility local |
| `npm exec --offline --no -- expo-doctor` | `ENOTCACHED`. Expo Doctor chưa có trong cache, nên chưa chạy chẩn đoán. | Bị chặn |
| `expo export --platform all` | Pass với `EXPO_NO_DOTENV=1` và `EXPO_PUBLIC_API_URL=http://127.0.0.1:18080/api`. Bundle Android/iOS và 36 static routes web. Lần không cấu hình URL fail ở static render check-in. | Export, chưa có binary/signing/device |
| Maven compile | `mvn -o -B -DskipTests compile` exit 0, compiler báo classes up to date. | Gate incremental |
| Maven unit/contract chọn lọc | 86 ca: 82 pass, 1 failure, 3 errors, 0 skip. | Surefire |
| Flyway validation và migration QA | Spring QA validate 131 migration và migrate đến V140. | PostgreSQL mới biệt lập |
| FlywayMigrationPostgresIntegrationTest | 11 ca: 5 pass, 5 failures, 1 skip. | PostgreSQL integration |
| PosPostgresIntegrationTest | 41 ca: 40 pass, 1 failure, 0 errors/skip. | Spring MockMvc và PostgreSQL QA |
| Fixture `seed-asian-voyage.sql` | Exit 3 tại dòng 21. `Ship.status=ACTIVE` vi phạm `ck_ship_lifecycle_status`. Transaction không commit. | psql trên PostgreSQL QA |

## Lỗi phân loại được

- `MigrationChecksumLockTest.committedMigrationsMatchTheChecksumLock:61` báo `V140__cruise_package_addon_vnd.sql` thiếu trong `flyway/migration-checksums.properties`. Đây là lỗi gate kiểm khóa checksum. Flyway runtime đã validate và migrate trên QA.
- `BookingServiceTest` có 3 errors, gồm hai lượt báo `createBooking_guestSuccess:275` và một `confirmBooking_verifiedDirectBookingPaymentIsAccepted:619`. Test fixture thiếu `NotificationService`, khiến `notifyUser` gặp null. Chưa có bằng chứng lỗi tương ứng trên production.
- `FlywayMigrationPostgresIntegrationTest` có năm assertion cũ: ba mong latest 139 nhưng thực tế 140, hai mong lần lượt 11 và 10 migration nâng cấp nhưng thực tế 12 và 11. Đây là kết quả chạy suite riêng với cluster audit.
- `PosPostgresIntegrationTest.missingDeckAssignmentSuspendedServiceAndUnpublishedAreaCannotBeUsed:776` mong 422 cho thao tác quản lý gán service vào area, thực tế 200 vì `PosService.assign` tự tạo deck assignment còn thiếu. Trước đó sale thiếu assignment bị từ chối đúng kỳ vọng. Ca dừng ở assertion nên bước kiểm model archived sau đó chưa chạy. Xem M17.
- Fixture Asian voyage không seed được trên schema hiện tại. V74 đổi Ship ACTIVE thành READY và giới hạn danh sách lifecycle. SQL cũ tiếp tục INSERT ACTIVE. Đây là lỗi đầu tiên quan sát được. Chưa thể chứng nhận các bước seed kế tiếp.
- `tests/integration/real-backend.test.mjs:13` và `staff-backend.test.mjs:7–8` cố định cổng 18080. Fix trong H là cấu hình endpoint QA và test fixtures theo Flyway thật, kèm gate xác nhận database target trước mutation.
- Bản initial thử PostgreSQL trong sandbox không mở được kết nối loopback, Windows 10013. Lần được duyệt đã kiểm tra chính xác thư mục data cluster trước khi tạo DB `casms_mobile_qa` ở `127.0.0.1:55437`. Datasource và admin JDBC chỉ trỏ cluster riêng. Không dùng env database có sẵn hoặc script reset. Cấu hình QA tắt booking email.

## Kiểm tra 13 bước thực tế

| Bước | Bằng chứng hiện có | Khoảng trống |
|---|---|---|
| 1. Login Passenger | Unit auth transport/route và AuthService/Controller pass. | Handoff Web email/activation và fixture QA. |
| 2. Voyage/cabin | Unit selection, scope, booking DTO pass. | Login thiết bị vào chuyến có cabin đã xác nhận. |
| 3. Lịch trình | Unit adapter và timezone pass. | Dataset đổi giờ/cảng đã xác nhận theo DB. |
| 4. Danh mục dịch vụ | Có adapter và unit. | Check catalogue theo chuyến và slot thực tế. |
| 5. Passenger gửi yêu cầu | Unit schedule/idempotency/recovery pass. | Harness HTTP chưa qua login. |
| 6. POS tiếp nhận | Có requestAction, POS transport test và BE QA kiểm thao tác theo assignment. | Kiểm cùng request từ bước 5. |
| 7. POS hoàn tất | Unit contract và BE QA kiểm hoàn tất, usage và rollback. | Kiểm cùng request, usage và quota trong QA. |
| 8. Passenger thấy trạng thái mới | Source cache invalidation/revalidation. | Chưa có chuỗi hai app dùng chung record. |
| 9. Đăng ký hoạt động | Unit workflow/adapter và POS QA kiểm registration/attendance. | Chạy activity và tour thật cùng cruise. |
| 10. Ghi nhận giao dịch | Unit POS transport/journal và POS QA kiểm giá server, idempotency và allowance. | Thiết bị, replay quy trình đầy đủ trên PostgreSQL. |
| 11. Xem sao kê | Adapter POS; Passenger placeholder. | Folio Passenger còn M04/M06/M07. |
| 12. Notification | REST list/read và unit service. | SSE Mobile chưa có. |
| 13. Logout | Cleanup unit pass. | Thiết bị thật, background/resume và đóng terminal. |

## Bằng chứng và giới hạn

Log Maven hiện tại nằm dưới `CASMS_Backend/target`. `mobile-phase0-unit-current.log` ghi bộ unit/contract. `mobile-phase0-qa-c323cb8ed41b4bb1ac71ca0841577d79/maven-integration.log` ghi suite PostgreSQL. Surefire có XML theo classname tương ứng. Scope backend test là các suite trực tiếp liên quan, kèm Flyway và POS PostgreSQL. Bộ PostgreSQL tổng 52 ca: 45 pass, 6 failures, 0 errors, 1 skip. Cluster xác minh history version 140 / 131 migration / success toàn bộ, sau đó được dừng. Trong 40 ca POS pass có online check-in của chủ hồ sơ, xử lý service request, registration/attendance, sale, allowance và chống ghi sale lặp. MockMvc thực thi controller/service/JPA trên database thật. Phase H cần thêm chuỗi full qua hai Mobile client và native QA.

Evidence có sẵn trong `evidence/` thuộc lượt trước. Báo cáo có sẵn trước khi cập nhật từng ghi một lần test cũ dùng datasource ngoài QA và đã áp dụng V140. Dấu vết đó được giữ để chủ sở hữu theo dõi. Lần audit hiện tại chỉ dùng cluster QA riêng và không dùng kết quả lần cũ làm bằng chứng thực thi.

Chưa có Expo Doctor online, Android APK, iOS signing, camera/NFC trên thiết bị, screen reader/tablet, hoặc toàn bộ luồng Web-to-Mobile. Expo export từ URL loopback chỉ kiểm bundle và static rendering.
