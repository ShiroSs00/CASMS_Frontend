# CASMS Mobile Phase B — NFC_INTEGRATION

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`; BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. So với mốc yêu cầu 3c01db0, A0/A đã được merge ở FE a6bd1d6. Giữ nguyên các tệp untracked có từ trước. Backend có thư mục untracked qa/ từ baseline; không sửa Backend/DB/Web. Không chạy SQL, Maven, API mutation thật, prebuild, commit hoặc push trong Phase B.

Đã đọc AGENTS gốc/Mobile, OceVie Mobile, báo cáo Phase 0/A0/A và handoff; các source và thay đổi chuyên biệt ghi dưới đây. Áp dụng đủ 7 skill theo [SKILL_USAGE](CASMS_MOBILE_PHASE_B_SKILL_USAGE.md). Kết quả kiểm tra tập trung trong [FE_REGRESSION](CASMS_MOBILE_PHASE_B_FE_REGRESSION.md). Chưa có QA do BE/DB xác nhận và thiết bị NFC thật; không tuyên bố REAL_API_PASSED hay DEVICE_E2E_PASSED.

Đã đọc toàn bộ Swift reference: CardReader, ClaimScanner, CustomerCheckinView, POSAPI, PassengerCardPOSApp, Info.plist, entitlements, Xcode project. Reference poll iso14443/iso15693; chấp nhận miFare/iso7816/iso15693, UID 4–32 byte hex uppercase; không FeliCa. Bridge v4 Swift source cũng lấy identifier tương ứng. Không copy Swift vào TS.

Người dùng đã phê duyệt **QR và NFC** trước thêm dependency. react-native-nfc-manager **4.3.0** pin, upstream yêu cầu RN>=0.76 New Architecture và React>=18.2; SDK58/RN0.88.1/React19.3 thỏa peer, chưa chứng minh native compile. Expo install thêm expo-dev-client **~58.0.21**, không nâng SDK. QR **6.3.54** JS/SVG, không tạo native encoder mới. npm install báo 11 advisories (10 moderate, 1 high) trên dependency tree; chưa tự audit-fix/upgrade vì ngoài scope, không kết luận do dependency mới khi chưa so baseline audit.

Thêm card-reader.ts pure port/state và nfc-reader.ts lazy import; Expo Go/web từ chối rõ, tránh native module làm crash startup. Device unsupported/disabled/cancel/read error/invalid tag có copy riêng; serial read và await cleanup; bỏ late tag khi đổi context. iOS request MifareIOS/IsoDep/Iso15693IOS; Android NfcA/NfcB/IsoDep/NfcV. Không nhập UID thủ công hoặc tự sinh UID.

Config plugin trong app.json: localized NFCReaderUsageDescription, TAG entitlement (không dùng NDEF), android.permission.NFC. Package manifest declares android.hardware.nfc required=false. Expo config introspect đã xác nhận Android permission=true, iOS mô tả tiếng Việt, formats=[TAG]; đây là cấu hình tĩnh, chưa là signed binary. Chưa tạo ios/android hoặc chạy prebuild.

Cần native development build sau thay dependency/plugin. Chọn EAS development profile hoặc build local theo runbook dự án; thiết lập applicationId/bundleIdentifier/signing và Apple NFC capability/provisioning do chủ ứng dụng cung cấp. Chạy `npx expo start --dev-client` sau khi cài binary phù hợp. Chưa chạy EAS build vì chưa có identity/signing/project build xác nhận. Windows không build iOS local. Expo Go không hỗ trợ NFC; simulator/emulator không chứng minh đọc thẻ.

Android/iOS cần máy thật NFC, thẻ thực tế, QA fixture đúng POS assignment. UID endian/format cùng thẻ giữa Swift/iOS/Android, thiết bị/tags/OS support, native sheet AppState và cleanup phải đối chiếu trên máy thật. Không coi UID là chứng cứ mật mã. Không dựng AID hoặc FeliCa system codes chưa được nghiệp vụ xác nhận.

Rollback: revert source NFC UI/adapters, plugin, các dependency/lock đã thêm và rebuild binary; không thay database/card assignment. Acceptance B2 source STATIC_VERIFIED + pure tests; **BLOCKED_BY_HARDWARE / BLOCKED_BY_ENVIRONMENT** cho native binary/E2E, không còn blocker chờ duyệt dependency.

Nguồn chính thức: [Expo SDK58 camera](https://docs.expo.dev/versions/v58.0.0/sdk/camera/), [Development builds](https://docs.expo.dev/develop/development-builds/introduction/), [NFC v4 upstream](https://github.com/revtel/react-native-nfc-manager), [QR renderer](https://github.com/Expensify/react-native-qrcode-svg). Package source/config plugin/peer dependencies tại node_modules đã đối chiếu đúng version pin.
