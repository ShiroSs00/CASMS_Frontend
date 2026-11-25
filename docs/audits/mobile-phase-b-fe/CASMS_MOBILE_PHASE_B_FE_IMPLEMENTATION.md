# CASMS Mobile Phase B — FE_IMPLEMENTATION

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`; BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. So với mốc yêu cầu 3c01db0, A0/A đã được merge ở FE a6bd1d6. Giữ nguyên các tệp untracked có từ trước. Backend có thư mục untracked qa/ từ baseline; không sửa Backend/DB/Web. Không chạy SQL, Maven, API mutation thật, prebuild, commit hoặc push trong Phase B.

Đã đọc AGENTS gốc/Mobile, OceVie Mobile, báo cáo Phase 0/A0/A và handoff; các source và thay đổi chuyên biệt ghi dưới đây. Áp dụng đủ 7 skill theo [SKILL_USAGE](CASMS_MOBILE_PHASE_B_SKILL_USAGE.md). Kết quả kiểm tra tập trung trong [FE_REGRESSION](CASMS_MOBILE_PHASE_B_FE_REGRESSION.md). Chưa có QA do BE/DB xác nhận và thiết bị NFC thật; không tuyên bố REAL_API_PASSED hay DEVICE_E2E_PASSED.

Các file sửa trong `CASMS_MobileApp/`:

- `app.json`, `package.json`, `package-lock.json`.
- `src/app/passenger-qr.tsx`.
- `src/features/passenger-actions/PassengerCheckInScreen.tsx`, `passenger-api.ts`.
- Thêm `src/features/passenger-actions/PassengerCardScreen.tsx`, `card-contracts.ts`.
- `src/features/pos/PosDashboard.tsx`, `PosScanner.tsx`, `pos-transport.ts`, `pos-ui.tsx`.
- Thêm `src/features/pos/PosCardAction.tsx`, `card-reader.ts`, `nfc-reader.ts`.
- Thêm `tests/passenger-card.test.mjs`, `tests/card-reader.test.mjs`.

Tài liệu: 10 báo cáo trong thư mục này; cập nhật hai handoff hiện có tại `docs/audits/mobile-phase-a0-fe/`. Không mở thêm backlog mất thẻ trùng BE-09.

Root cause: màn QR là placeholder; camera cũ chưa gọi preview; chưa có QR encoder/NFC bridge; FE so thông báo lỗi thô dù transport A0 đã sanitize. Nay tái dùng API client, auth epoch, voyage context và POS scoped transport, thêm Zod contract, QR server claim, NFC read/confirm/lookup. Không đổi authentication hoặc POS session store.

Người dùng đã duyệt cả QR và NFC trong phiên này trước khi cài. Pin react-native-qrcode-svg 6.3.54, react-native-nfc-manager 4.3.0; Expo install bổ sung expo-dev-client ~58.0.21 đúng SDK58. Không nâng Expo/RN. Lệnh test preload hook TypeScript trước static import, tránh khác biệt resolution Node/Metro.

B1: source hoàn thiện cho check-in/QR/preview, typecheck/lint/130 tests và export ba nền tảng pass; chờ QA thật. B2: native adapter/UI/config đã triển khai; binary signing, compatibility thực tế RN0.88 và đọc thẻ chưa nghiệm thu. Acceptance tổng: FE_READY_WITH_EXTERNAL_BLOCKERS, không FULL_INTEGRATION_PASS.
