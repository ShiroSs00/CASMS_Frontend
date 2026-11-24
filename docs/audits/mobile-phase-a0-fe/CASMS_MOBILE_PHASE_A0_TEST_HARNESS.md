# Harness kiểm thử Mobile

Baseline FE `3c01db0`, BE `0bc2b38` trên `main`. Remote GitHub xác nhận cùng HEAD.

**Đã đọc:** `tests/integration/{real-backend.test,staff-backend.test,qa_database.py,start-backend.ps1,initialize-database.ps1}`, fixture SQL và contract `AuthController.me`. **Đã sửa:** hai suite HTTP, helper `qa-environment.mjs`, runner `scripts/run-qa-tests.mjs`, `.env.qa.example`, `tests/mobile-foundation.test.mjs`, docs `real-api-qa.md`.

| Gate | Trước → Sau |
|---|---|
| Endpoint | Cố định port 18080 → yêu cầu API URL QA khớp URL được xác nhận, độc lập với biến Expo. |
| Readiness | Bắt đầu login ngay → GET vô danh `/auth/me` với timeout 5 giây, yêu cầu 401 `AUTH_REQUIRED` đúng envelope, từ chối redirect. |
| Credential/fixture | Credentials ghi trong suite → biến từ `.env.qa.local`, giữ ID và role fixture, đọc booking/BookingPassenger trước giao dịch. |
| Persistence | Python helper gắn với database mặc định riêng cố định → `psql` qua PG service được cấp, kiểm tên DB và transaction read-only, giữ assertion kiểm trạng thái trực tiếp. |
| Chạy suite | Gọi Node trực tiếp → `npm test` độc lập, `npm run test:qa` có preflight, Node runner chạy tuần tự các tệp. |

Khi thiếu cấu hình, runner báo `BLOCKED_BY_ENVIRONMENT` và exit 2 trước khi kết nối. Khi xác thực/API lỗi báo `BLOCKED_BY_BACKEND`; sai fixture hoặc DB read-only báo `BLOCKED_BY_DATABASE`. Assertion nghiệp vụ giữ nguyên ngoài phần probe/auth, đọc SQL và kiểm trước test. Validation local kiểm gate và readiness giả lập độc lập, không dùng giả lập để báo tích hợp thật. Harness confirm là tín hiệu người vận hành xác nhận, chưa thể tự chứng minh API và PG service cùng backend datasource. Điều kiện nhận từ team là URL, fixture, credentials, mapping API → QA database được phép ghi qua API, và quyền đọc kiểm chứng.

**Acceptance:** harness và guard local sẵn sàng. Bảy ca HTTP chưa chạy vì không có QA xác nhận. [Database handoff](CASMS_DATABASE_HANDOFF.md) ghi seed V74/V140 và 17 nhu cầu bàn giao. [Regression](CASMS_MOBILE_PHASE_A0_FE_REGRESSION.md).
