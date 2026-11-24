# Triển khai Mobile Foundation

Baseline FE `3c01db0`, BE `0bc2b38` trên `main`. Remote GitHub xác nhận cùng HEAD.

| Hạng mục | File đã đọc | File đã sửa | Trước → Sau, nguyên nhân và giải pháp |
|---|---|---|---|
| A0-FE.1 | `.env.example`, `app.json`, `src/lib/api`, SDK docs | `.env.example`, `.env.qa.example`, `src/lib/api/{api-client,index}.ts`, `src/app/_layout.tsx` | Metro suy endpoint hoặc render lỗi khi thiếu URL → URL tường minh, normalize suffix và thông báo cấu hình ở root trước khi mount query/navigation. |
| A0-FE.2 | `api-client.ts`, POS transport, service recovery, BE ApiResponse | `api-client.ts`, `query-client.ts` | Raw message và request hủy muộn có thể lộ lỗi hoặc chạy unauthorized callback → map status, giữ code cho adapter, phân biệt abort/timeout và chặn retry lỗi 4xx ở query. |
| A0-FE.3 | Hai suite thật và helper QA lịch sử | `tests/integration/{real-backend.test,staff-backend.test,qa-environment}.mjs`, `scripts/run-qa-tests.mjs` | Cổng và thông tin đăng nhập cố định → endpoint/credentials từ env riêng, kiểm readiness, danh tính, fixture và DB read-only. Bảy ca và assertions nghiệp vụ được giữ. |
| A0-FE.4/5 | Routes Expo, booking adapter và BE Cancellation/Booking Controller | `PassengerBookingScreens.tsx`, `passenger-api.ts`, test route/booking | Alias legacy vốn đã redirect, cần cố định bằng regression. Xóa consumer duy nhất của direct cancel và adapter không còn caller, giữ projection và hướng dẫn liên hệ. |
| A0-FE.6 | Root/tabs/POS layouts, store/auth model, POS storage, query | `src/features/auth/{session-model,session-store}.ts`, `tests/session-cleanup.test.mjs` | Refresh 403 xóa phiên còn hạn, nhánh retry bỏ sót timer cũ, SecureStore chưa gắn API URL → chỉ hết phiên theo 401/hạn, dọn timer trước refresh và restore đúng môi trường. Phiên cũ chưa có scope cần đăng nhập một lần. Session model từ chối tokenType/email sai kiểu bằng thông báo an toàn. |
| A0-FE.7 | Scaffold, Button, Sheet, EmptyState, LivePage, POS Notice | `PassengerActionUI.tsx`, `src/app/_layout.tsx` | Abort có thể thành thông báo chung và query paused có spinner → suppress AbortError, thông báo chờ kết nối/kết nối máy chủ, nội dung lỗi selectable. |
| A0-FE.8/9 | Phase 0, source BE liên quan và evidence PostgreSQL | Hai tệp handoff cạnh báo cáo | Chuyển vấn đề BE/DB theo owner và phase phụ thuộc. |
| A0-FE.10/11 | `start-dev.bat`, scripts, AGENTS, tài liệu Mobile | `start-mobile.bat`, `run-mobile-tests.bat`, `scripts/start-mobile.mjs`, `package.json`, README và 5 tài liệu Mobile | Tách lệnh FE Windows và QA; đồng bộ docs với menu/capability hiện tại. |

Không thay đổi app.json trong phase này vì SDK, scheme và plugin hiện tại vẫn phục vụ đúng cấu hình. Danh sách file cụ thể nằm ở [tổng hợp](CASMS_MOBILE_PHASE_A0_FINAL_SUMMARY.md).

**Evidence và acceptance.** [Regression](CASMS_MOBILE_PHASE_A0_FE_REGRESSION.md) và [Harness](CASMS_MOBILE_PHASE_A0_TEST_HARNESS.md). Gate FE được tính qua typecheck, lint, tests, export và smoke script. QA thật phụ thuộc API URL, tài khoản, dataset và PostgreSQL service bộ phận Backend/DB cấp. UI native, Web-to-Mobile handoff và các phase tích hợp sâu không có kết quả runtime trong phạm vi A0-FE.
