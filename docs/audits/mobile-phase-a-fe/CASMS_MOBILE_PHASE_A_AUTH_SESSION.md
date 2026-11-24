# Authentication, handoff và session

Baseline ngày 24/11/2026. FE `3c01db0412e29486ac750b0ebbcd090c6bed0353` cộng toàn bộ working tree A0-FE chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Local `main`, upstream tracking và remote GitHub trùng hai commit.

Đã đọc `CASMS_Backend/src/main/java/com/casms/identity/{controller/AuthController.java,service/AuthService.java,dto/LoginRequest.java,dto/LoginResponse.java,dto/UserMeResponse.java,entity/User.java,entity/Passenger.java,service/RolePermissionInitializer.java,controller/BookingAccountController.java}`, `notification/service/BookingEmailService.java`, V94 bảng BookingAccountSetup và Web activation dưới `CASMS_WebBooking/src/features/account-activation/`. Đọc transport, query config hiện hành và Account/Login. Sửa `session-model.ts`, `session-store.ts`, `login-model.ts`, `PassengerLoginScreen.tsx`, `_layout.tsx`, Account và test.

| Contract | Hành vi FE |
|---|---|
| POST `/auth/login` | Username/password NotBlank. Trim username, giữ password chính xác. JWT Bearer, expiresIn giây, UUID userId, username/roles/permissions thật. Hiển thị loading một lần, lỗi invalid credentials, mạng/timeout và lỗi phản hồi. |
| GET `/auth/me` | Principal ACTIVE, trả UUID, role, effective permissions và hồ sơ Passenger nullable. Validate UUID/enum/permission. UI chỉ dùng họ tên, email, điện thoại và Passenger ID để đối chiếu. |
| POST `/auth/refresh` | Bearer JWT hiện tại còn hợp lệ, không body refresh token. Giữ epoch cho cùng user, bỏ response khác generation. 401 hoặc deadline hết hạn mới xóa phiên, 403 còn hạn giữ nguyên. |
| POST `/auth/logout` | BE mô tả logout stateless. FE đóng POS session nếu có và dọn local auth, query cache, lựa chọn chuyến, không phụ thuộc request auth logout. |

**Nguyên nhân và trước/sau.** A0 gắn SecureStore với API URL và chặn response cũ. Phase A thêm xác thực UUID và NotBlank, giữ epoch đơn điệu khi login, khôi phục lựa chọn native cùng record đã có. Ghi lựa chọn nối hàng đợi lưu trữ và chỉ cập nhật trường lựa chọn để tránh ghi đè JWT mới. Resume kiểm tra deadline trước TanStack Query focus. Account sai/suspended nhận thông báo theo code BE. AuthService gộp account locked/disabled vào INVALID_CREDENTIALS nên FE không suy ra nguyên nhân riêng.

**M08 / BLOCKED_BY_BACKEND.** Web có endpoint kích hoạt dùng token và mật khẩu. `BookingEmailService` hiện có nhánh cấp mật khẩu tạm và ghi activated_at cho account mới. Login kiểm ACTIVE và credential, DTO không trả activation state. Không tạo trường activation trên FE. Cần BE xác nhận chính sách theo booking/payment và bằng chứng email, activation, login cùng User → Passenger.

**Acceptance:** unit login/restore/expiry/refresh 403/logout, đổi account/API scope pass. Expo Data Fetching, Router và Native UI áp dụng trực tiếp. Handoff activation thật chưa nghiệm thu. [Backend handoff](../mobile-phase-a0-fe/CASMS_BACKEND_HANDOFF.md).
