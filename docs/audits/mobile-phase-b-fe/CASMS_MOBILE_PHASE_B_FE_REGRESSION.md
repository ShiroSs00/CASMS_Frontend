# CASMS Mobile Phase B — FE_REGRESSION

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`; BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. So với mốc yêu cầu 3c01db0, A0/A đã được merge ở FE a6bd1d6. Giữ nguyên các tệp untracked có từ trước. Backend có thư mục untracked qa/ từ baseline; không sửa Backend/DB/Web. Không chạy SQL, Maven, API mutation thật, prebuild, commit hoặc push trong Phase B.

Đã đọc AGENTS gốc/Mobile, OceVie Mobile, báo cáo Phase 0/A0/A và handoff; các source và thay đổi chuyên biệt ghi dưới đây. Áp dụng đủ 7 skill theo [SKILL_USAGE](CASMS_MOBILE_PHASE_B_SKILL_USAGE.md). Kết quả kiểm tra tập trung trong [FE_REGRESSION](CASMS_MOBILE_PHASE_B_FE_REGRESSION.md). Chưa có QA do BE/DB xác nhận và thiết bị NFC thật; không tuyên bố REAL_API_PASSED hay DEVICE_E2E_PASSED.

Baseline 122 test; thêm 3 contract tests và 5 pure native session tests. Fixture chỉ trong tests, không production.

| Kiểm tra | Kết quả / giới hạn |
|---|---|
| npm run typecheck | PASS, exit 0 |
| npm run lint | PASS, exit 0, không error/warning |
| npm test | 130/130 PASS, không skip/fail; giữ toàn bộ 122 tests baseline |
| Contract tests | Claim DTO/expiry/countdown, POS scoped header/preview/confirm/lookup, malformed response/UID, no replay confirm PASS |
| Native session pure tests | 5/5 PASS: normalize hex/reject FeliCa, unsupported/disabled không request, overlap bị khóa, cancel trong module load/read bỏ late result, failure cleanup và lần scan sau |
| Expo install --check | Local SDK58 map báo up to date trong offline mode; công cụ cảnh báo validation offline không đủ tin cậy |
| Expo Doctor online | 19/20 PASS; check phiên bản đề nghị cập nhật 11 package nền so với upstream SDK58 hiện tại. Chưa tự update |
| Expo config introspect | PASS, NFC Android permission, iOS mô tả và TAG entitlement đúng |
| Expo export --platform all | PASS cả lượt đầy đủ và lượt kiểm tra cuối Android/iOS/Web, exit 0 |
| Git diff --check | PASS, không whitespace error; chỉ có cảnh báo line-ending CRLF của Git |
| REAL_API / DEVICE_E2E | Chưa chạy; BLOCKED_BY_DATABASE/BACKEND và HARDWARE/ENVIRONMENT |

Doctor mismatch nền giữ nguyên: expo-web-browser expected ~58.1.0/found58.0.7; @expo/ui ~58.0.29/58.0.27; expo ~58.0.26/58.0.23; constants ~58.0.16/58.0.15; font ~58.0.12/58.0.11; linking ~58.0.17/58.0.16; router ~58.0.32/58.0.30; secure-store ~58.0.3/58.0.2; splash-screen ~58.0.14/58.0.13; status-bar ~58.0.5/58.0.4; symbols ~58.0.5/58.0.4. Các version này không đổi trong Phase B. Cần đợt dependency maintenance riêng, không che kết quả Doctor bằng exclude hoặc báo Doctor pass.

PATH không có adb; ANDROID_HOME và ANDROID_SDK_ROOT không trỏ SDK. Đã tìm LOCALAPPDATA/Android/Sdk, C:/Android, C:/Android/Sdk, C:/Program Files/Android và C:/Program Files (x86)/Android. Có Android Studio trong Program Files/Android nhưng không thấy adb.exe trong cây đã kiểm. Không cài SDK hoặc đổi cấu hình hệ thống; chưa có thiết bị thật NFC được xác nhận.

Evidence local (ignored `.expo/`): phase-b-tests-final.log, phase-b-export.log, phase-b-export-final.log, phase-b-config.json. Introspection xác nhận NFC permission/entitlement. Không lưu raw claim/JWT/UID thực trong report. Regression baseline auth/session/voyage/POS vẫn được chạy cùng toàn suite.

QA chưa sẵn sàng: không gọi API mutation thật, không SQL/seed/Maven. Các ca permission/camera/device/QR roundtrip/confirm timeout sau server commit cần runbook QA và máy thật; unit tests không thay thế các ca này.
