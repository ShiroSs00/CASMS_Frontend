# CASMS Mobile Phase A0-FE

**Kết luận: `FE_READY_WITH_EXTERNAL_BLOCKERS`.**

Baseline FE `3c01db0412e29486ac750b0ebbcd090c6bed0353`, BE `0bc2b3831301a0d67d45bacc120a161dbacec026`. Local `main`, upstream tracking và GitHub remote cùng commit. Đã đọc Phase 0, AGENTS và OceVie Mobile, các route/source Mobile, contract Backend, SDK 58 và các skill ghi dưới đây.

## Kết quả

- API URL tường minh cho Windows, emulator, thiết bị thật, Web, QA và release. Thiếu/sai URL hiển thị hướng dẫn. Session native gắn URL; bản cũ cần đăng nhập một lần. Refresh 403 giữ phiên còn hạn và không để lại timer cũ.
- Passenger chỉ đọc chi tiết đặt chỗ đã có. Link cũ chuyển về màn companion. Hủy trực tiếp legacy đã bỏ và thay bằng hướng dẫn liên hệ, vẫn hiển thị trạng thái/lý do Backend trả.
- Harness QA yêu cầu URL xác nhận, kiểm readiness/fixture và dùng PostgreSQL service chỉ đọc cho assertion persistence. Windows có entry Expo và runner cho typecheck, lint, unit, QA.
- Typecheck, lint, 108/108 test FE và export Android/iOS/Web đều pass. Web xuất 36 routes, kể cả khi thiếu URL và hiển thị trạng thái hướng dẫn. Windows startup đã mở Metro. Expo Doctor chưa có trong cache. Bảy ca HTTP QA chưa chạy vì môi trường và fixture chưa được xác nhận.

## File cập nhật

| Nhóm | Tệp dưới `CASMS_MobileApp/` |
|---|---|
| Env và scripts | `.env.example`, `.env.qa.example`, `package.json`, `start-mobile.bat`, `run-mobile-tests.bat`, `scripts/start-mobile.mjs`, `scripts/run-qa-tests.mjs` |
| Runtime | `src/app/_layout.tsx`, `src/lib/api/api-client.ts`, `src/lib/api/index.ts`, `src/lib/query-client.ts`, `src/features/auth/{session-model,session-store}.ts`, `src/features/passenger-actions/{PassengerActionUI.tsx,PassengerBookingScreens.tsx,passenger-api.ts}` |
| Kiểm thử | `tests/{live-api.test,passenger-actions.test,session-cleanup.test,mobile-foundation.test}.mjs`, `tests/integration/{real-backend.test,staff-backend.test,qa-environment}.mjs` |
| Tài liệu Mobile | `README.md`, `docs/{real-api-qa,passenger-live-api,passenger-service-flow,onboard-staff-pos,ocevie-mobile-ux}.md` |

## Báo cáo và điều kiện Phase A-FE

- [Triển khai](CASMS_MOBILE_PHASE_A0_FE_IMPLEMENTATION.md)
- [Cấu hình API](CASMS_MOBILE_PHASE_A0_API_CONFIGURATION.md)
- [Route legacy](CASMS_MOBILE_PHASE_A0_LEGACY_ROUTE_FIX.md)
- [Harness QA](CASMS_MOBILE_PHASE_A0_TEST_HARNESS.md)
- [Kiểm hồi quy](CASMS_MOBILE_PHASE_A0_FE_REGRESSION.md)
- [Backend handoff](CASMS_BACKEND_HANDOFF.md)
- [Database handoff](CASMS_DATABASE_HANDOFF.md)
- [Bảy skill đã dùng](CASMS_MOBILE_PHASE_A0_SKILL_USAGE.md)

Phase A-FE có thể tiếp tục trên frontend cho các contract đã xác nhận. Để nghiệm thu luồng đăng nhập/voyage thật, cần đội Backend xác nhận handoff kích hoạt và cấp URL, tài khoản, dataset và quyền chạy tích hợp trên QA riêng. QR/NFC, SSE và Spending chi tiết thuộc các phase sau.
