# Kiểm hồi quy Phase A-FE

Baseline FE `3c01db0` cùng working tree A0-FE chưa commit, BE `0bc2b38`. Local main, upstream tracking và remote GitHub trùng. Ngày 24/11/2026.

Đã đọc A0 regression, test auth/API/routing/selection/POS hiện có và SDK 58. Thêm `tests/auth-restore.test.mjs`, `tests/phase-a-voyage.test.mjs`. Mở rộng `session-cleanup.test.mjs`, cập nhật fixture DTO trong `live-api.test.mjs` và `passenger-actions.test.mjs`. Các lỗi gốc gồm restore/role chưa đồng bộ, `rows[0]` khi mơ hồ, DTO cast và cache chưa có epoch. Giải pháp ở [triển khai](CASMS_MOBILE_PHASE_A_FE_IMPLEMENTATION.md). Dùng Expo Data Fetching/Router cho test contract, Native UI và Impeccable cho các state quan sát được.

| Kiểm tra | Trước | Sau |
|---|---|---|
| TypeScript | Pass | `npm run typecheck`, pass |
| Expo lint | Pass | `npm run lint`, pass |
| Unit and contract | 108/108 | `npm test`, 122/122 pass, 0 fail, 0 skip. Thêm 14 ca, không bỏ assertion hiện hành. Fixture UUID và booking summary cập nhật theo contract BE. |
| Expo compatibility | Map SDK local pass | `expo install --check` exit 0. CLI cảnh báo xác minh offline. |
| Expo Doctor | Thiếu package | `npm exec --offline --no -- expo-doctor` trả ENOTCACHED. BLOCKED_BY_ENVIRONMENT. |
| Expo export | Pass | Android/iOS bundles và 36 static routes Web. Dùng URL loopback cho bundling, không gọi Backend thật. |
| Android Emulator | Chưa nghiệm thu | adb không có trong PATH hoặc SDK location mặc định. BLOCKED_BY_ENVIRONMENT cho device/hardware navigation. |
| Real API | QA chưa xác nhận | Không chạy. BLOCKED_BY_ENVIRONMENT cho QA URL, BLOCKED_BY_DATABASE cho fixture/schema, BLOCKED_BY_BACKEND cho M08 Web handoff. |

| Nhóm acceptance | Test evidence | Phạm vi |
|---|---|---|
| Login hợp lệ và sai thông tin | live-api, phase-a-voyage | Kiểm payload, Bearer, DTO, no auto-retry, INVALID_CREDENTIALS. |
| Restore và phiên hết hạn | auth-restore, session-cleanup | SecureStore chỉ đọc một lần, khôi phục selection đúng scope, resume hết hạn trước request. |
| Refresh và 403 | session-cleanup, itinerary-contract | Refresh cùng owner giữ epoch, khác owner bị từ chối, 403 giữ phiên. |
| Logout / đổi tài khoản / API URL | session-cleanup, post-booking | Dọn auth/cache/POS/selection, không nhận token backend khác. |
| Passenger, Staff và deep link guest | phase-a-voyage, mobile-foundation | Role policy, link nội bộ đúng workspace, giữ alias và chặn URL ngoài. |
| Không/có một/nhiều booking và chuyển chuyến | phase-a-voyage, post-booking | Không tự dùng hồ sơ khác, kiểm một ứng viên, nhiều ngang hạng, đổi và mất selection. |
| Booking/hồ sơ bị hủy và Cruise hoàn tất | phase-a-voyage, post-booking | Test lọc và shortcut lifecycle, giữ đọc trạng thái booking. |
| Cabin thiếu, itinerary thiếu, DTO sai | phase-a-voyage, booking-payment, itinerary-contract | Null cabin/ship/itinerary, UUID/date/status, không khớp owner/trip. |
| Network failure và retry | phase-a-voyage, live-api | Timeout/abort có sẵn, chủ động retry login, không replay mutation. |
| A0-FE và phạm vi companion | mobile-foundation, pos-integration, service-request-merge | Giữ product boundary, guidance hủy, POS session, idempotency và QA gate. |

API contract kiểm dùng transport stubs/fixture trong unit, export kiểm bundle và render tĩnh. **FE_READY_WITH_EXTERNAL_BLOCKERS**. Không có FULL_INTEGRATION_PASS hay xác nhận thiết bị. [Backend handoff](../mobile-phase-a0-fe/CASMS_BACKEND_HANDOFF.md) · [Database handoff](../mobile-phase-a0-fe/CASMS_DATABASE_HANDOFF.md).
