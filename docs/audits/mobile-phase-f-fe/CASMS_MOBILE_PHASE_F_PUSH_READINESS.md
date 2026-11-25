# CASMS Mobile Phase F — PUSH_READINESS

Ngày 25/11/2026. FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main + working tree B/C/D/E0 được giữ; BE0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc (?? qa/ từ trước). Baseline171 tests, typecheck/lint/export pass, Doctor19/20 và11 mismatch nền. Đọc AGENTS/OceVie Mobile, báo cáo0/A0/A/B/C/D/E0, handoff và source hiện tại; không dùng báo cáo thay contract. Chỉ sửa Mobile/tài liệu, không BE/DB/Web, SQL/seed/Maven, dependency mới, commit/push hoặc Folio/checkout. Áp dụng7 skill bắt buộc và frontend-testing-debugging, chi tiết SKILL_USAGE. Evidence là source/unit/contract/export trừ khi ghi rõ rendered; chưa có QA BE/DB xác nhận.

Phân biệt SSE foreground, remote push khi background/closed và local notification. F chỉ triển khai foreground SSE/REST, không notification permission hoặc local notification giả push.

Đọc NotificationController/Service/entity và tìm route/field push/device-token/ExpoPushToken/FCM trong Backend: chưa thấy device registration/binding/rotation/unregister contract. Notification outbox hiện là IN_APP semantics, không chứng minh APNs/FCM đã phát. Không gửi token đến endpoint tự đặt, không dựng push server. BE-23 NEED_BUSINESS_DECISION/BLOCKED_BY_BACKEND.

Mobile chưa có expo-notifications. SDK58 docs đề xuất ~58.1.9 và config plugin; Android remote push trong ExpoGo không được hỗ trợ từ SDK53, cần development build. Trước triển khai cần phê duyệt dependency, project identity/EAS credentials/APNs/FCM, account binding, logout revoke, token rotation, permission denial và safe deep link payload. Mặc dù expo-device/dev-client đã có, chúng không tự tạo push contract. Không sửa app.json hoặc package/lock trong F.

Đã kiểm installed skill catalog: chỉ bốn Expo networking/UI/router/design-system, không có skill push/deployment bổ sung để tuyên bố sử dụng. Dùng docs SDK58 và skills bắt buộc cho audit/readiness. Build impact khi được duyệt: plugin/native config và development/release binaries mới; rollback gỡ token registration/listeners/plugin/library rồi rebuild, giữ Notification REST/SSE độc lập.

QA cần device thật hoặc môi trường push được hỗ trợ, token rotation/account switch/logout/unregister, app killed/background/foreground, duplicated deliveries, denied permission và typed internal route scope. Không log tokens, không dùng URL tùy ý. Chưa có QA/credentials/dataset, không test gửi push. Acceptance READINESS_AUDITED/PUSH_BLOCKED; không DEVICE_E2E_PASSED.

Nguồn: [Expo Notifications SDK58](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/). Không cài package hoặc xin approval chưa cần cho phần F độc lập.
