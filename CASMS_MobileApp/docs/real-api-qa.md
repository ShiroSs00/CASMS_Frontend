# Kiểm thử Mobile qua Backend QA

Chạy `npm test` để kiểm thử FE độc lập. Bảy ca HTTP hiện có được giữ trong `tests/integration`. Chỉ dùng `npm run test:qa` khi đội Backend và QA đã xác nhận API là môi trường dành riêng cho kiểm thử ghi dữ liệu và có fixture tương thích.

## Cấu hình

Trong thư mục Mobile, sao chép `.env.qa.example` thành `.env.qa.local`. Tệp local được gitignore. Endpoint `CASMS_MOBILE_QA_API_URL` và xác nhận `CASMS_MOBILE_QA_CONFIRMED_URL` phải trỏ cùng URL do nhóm Backend cấp. Harness không lấy `EXPO_PUBLIC_API_URL`. Đặt tài khoản Passenger và Staff bằng biến private trong mẫu và yêu cầu nhóm QA xác nhận ID fixture mà suite đang kiểm.

Ca kiểm lưu ServiceRequest cần `psql` trong PATH và một PostgreSQL service đã được nhóm QA cấp với tài khoản chỉ đọc. Điền `CASMS_MOBILE_QA_PG_SERVICE` và `CASMS_MOBILE_QA_DATABASE`. Harness xác minh database name và transaction read-only trước ca chạy. Cấu hình service được quản lý ngoài repo. Hạ tầng và fixture do nhóm Backend/DB chuẩn bị.

## Chạy và đọc kết quả

`npm run test:qa` hoặc `run-mobile-tests.bat --qa` chạy tuần tự các suite, kiểm GET `/auth/me` vô danh trước login, xác minh tài khoản và fixture trước thao tác ghi. Assertion persistence đọc trạng thái thực qua kết nối chỉ đọc sau vòng đời service request. Các request QA từ chối redirect.

- `BLOCKED_BY_ENVIRONMENT` cho thiếu xác nhận, thiếu credential QA hoặc không truy cập được API.
- `BLOCKED_BY_BACKEND` cho lỗi xác thực hoặc API không cho đọc fixture.
- `BLOCKED_BY_DATABASE` cho sai fixture, sai database hoặc thiếu kết nối chỉ đọc.
- Lỗi assertion sau preflight là kết quả nghiệp vụ của suite. Các suite tạo giao dịch kiểm thử qua API nên QA phải chịu được thay đổi dữ liệu test.

Các script provisioning/SQL lịch sử nằm trong `tests/integration/` để tham chiếu. Chạy FE chỉ gọi API đã xác nhận và đọc PostgreSQL QA qua service riêng. Xem [Database handoff](../../docs/audits/mobile-phase-a0-fe/CASMS_DATABASE_HANDOFF.md) cho dataset và blocker V140.
