# CASMS Mobile Phase G — RUNTIME_READINESS

Ngày 25/11/2026 (Asia/Saigon). FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main, cộng working tree B/C/D/E0/F được bảo toàn. BE 0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc; ?? qa/ có từ trước. Chỉ Mobile và tài liệu liên quan. Không dependency mới/upgrade, BE/DB/Web mutation, prebuild, commit hoặc push.

Bằng chứng trong G là STATIC_VERIFIED và unit/contract/export; **RENDERED_UI_BLOCKED**. Không có screenshot sản phẩm mới, TalkBack/VoiceOver, Real API hoặc Device E2E pass. Fixture không chứng minh Backend QA.

## G0 findings

| Layer | Kết quả G | Phân loại |
|---|---|---|
| Node/npm/Expo | Node24.18.0/npm11.16.0, Expo~58.0.23/local CLI khởi động Metro | Toolchain source/export khả dụng |
| Environment | ANDROID_HOME/ANDROID_SDK_ROOT trống, adb không trong PATH | Dùng đường dẫn SDK tường minh; không sửa permanent env |
| SDK/AVD | C:/Users/quanh/AppData/Local/Android/Sdk; Pixel_8 có | Không cài SDK/APK |
| ADB | Sandbox daemon lỗi; host execution đọc emulator-5554 device, sys.boot_completed=1 | Sandbox khác host; không kết luận emulator hỏng |
| Runtime | Android16 x86_64, Expo Go version58.0.5; pm list không có CASMS/OceVie package | Same major không chứng minh module compatibility; thiếu dev build đã nghiệm thu |
| Metro | Local fixture18086 + expo start --web --port8086 chạy; CI reload disabled | Log startup không chứng minh browser connectivity |
| Connectivity | HTTP local probe trả000; IAB createBrowserTab timeout attach2 lần | RENDERED_UI_BLOCKED; root cause network/tool attachment chưa xác minh |
| Native F issue | G xác nhận boot tốt; chưa product UI; F ANR/remote update evidence giữ | Không nói G tái hiện chính xác ANR hoặc source gây remote update |
| NFC | Installed JS module4.3.0/config có, dynamic bridge rejects storeClient/Web | Native custom module cần dev build; không nghiệm thu trên Go |
| Backend | QA URL/accounts/dataset/mutation quyền chưa xác nhận | Không startup Backend/seed/migrate/RealAPI |

## Quy trình khởi động đã thử và phần bàn giao M

Trong CASMS_MobileApp, shell-local UI_FIXTURE_PORT=18086, node tests/fixtures/passenger-api-server.mjs; shell-local EXPO_PUBLIC_API_URL=http://127.0.0.1:18086/api, npx --no-install expo start --web --port8086. Chỉ test fixture in-memory; không ghi .env, production bundle dùng env hiện hữu thay vì fixture. Tool logs ở evidence. Android emulator dùng API host alias10.0.2.2 nếu sau này test native; G chưa xác minh kết nối alias, không công bố runbook end-to-end pass.

Phase M cần: xác nhận host/AVD/Metro/API loopback path trong môi trường được phép; đúng SDK58/RN0.88 build, expo-dev-client và react-native-nfc-manager plugin/native rebuild, Android toolchain/JDK/Gradle/signing profile và physical NFC device. iOS cần approved build/signing/capabilities/device. Đọc app.json để lấy scheme/config chính xác. Không tự prebuild trên source chính, cài APK hoặc đổi firewall/security. App native đang portrait/light; landscape test cần quyết định/config build riêng nếu mở.

Helpers G đã đóng: fixture node27488, npx24668, Metro29056 (command line được xác minh trước Stop-Process); AVD emu kill trảOK. Không đóng LDPlayer/browser người dùng. G0 hoàn thành phân loại và bàn giao, chưa đạt gate rendered/native.
