# CASMS Mobile Phase F — SKILL_USAGE

Ngày 25/11/2026. FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main + working tree B/C/D/E0 được giữ; BE0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc (?? qa/ từ trước). Baseline171 tests, typecheck/lint/export pass, Doctor19/20 và11 mismatch nền. Đọc AGENTS/OceVie Mobile, báo cáo0/A0/A/B/C/D/E0, handoff và source hiện tại; không dùng báo cáo thay contract. Chỉ sửa Mobile/tài liệu, không BE/DB/Web, SQL/seed/Maven, dependency mới, commit/push hoặc Folio/checkout. Áp dụng7 skill bắt buộc và frontend-testing-debugging, chi tiết SKILL_USAGE. Evidence là source/unit/contract/export trừ khi ghi rõ rendered; chưa có QA BE/DB xác nhận.

Đã đọc và áp dụng skill trong cùng phiên, đọc lại networking/router/testing hướng dẫn liên quan F, AGENTS gốc/Mobile và OceVie Mobile; packageSDK58/RN0.88.1. Kiểm catalog bổ sung: không có Expo push/deployment skill khác ngoài4 Expo skills hiện có, không tuyên bố dùng skill chưa cài. Không áp animation Web sang RN.

| Skill | Áp dụng F |
|---|---|
| expo-native-ui | safe area/Scaffold/native route, labels/scaling/reduced motion kế thừa; AppState foreground; text fallback khi3D/native unavailable |
| expo-data-fetching | expo/fetch streaming/Bearer/AbortController, bounded retry/fallback, strict schemas/null vszero/GET authority, private scoped query invalidation; không auto POST từ event |
| expo-router | root authenticated sync một lần; exact-BP internal navigation, manual voyage switch, no raw URL/POS/Folio route |
| expo-design-system | reuse OceVie/PassengerButton/Sheet/InfoRow/EmptyState, không primitive/palette/library mới |
| ui-ux-pro-max | targeted notification status updates: contextual unread/status/error feedback, không số0 giả; chỉ lấy guidance phù hợp mobile, không Web ARIA áp máy móc |
| impeccable | stale context/removed day-stop/unknown event/offline resilience, no silent identity fallback; hiệu năng60s timeline/poll250ms event coalesce, không speculative virtualization |
| frontend-design | hierarchy timeline/notification/detail/ship info/support, không dashboard hay3D decoration nặng; giữ riêng trải nghiệm Mobile/POS |
| frontend-testing-debugging | Browser plugin absent, Playwright/Puppeteer unavailable; ADB/SDK/AVD hiện có được kiểm, native attempt có ảnh blocker chính xác; không cài tool/đổi security để báo pass |

Pure modules dùng kebab-case; component giữ convention PascalCase đang có của Mobile thay vì đổi tên cả hệ thống. Tài liệu đúng version và installed source được đối chiếu cho expo/fetch/streams/TextDecoder; SDK58 Notifications chỉ readiness, không cài. skill files ở C:/Users/quanh/.codex/skills/{skill}/SKILL.md, UI UX catalog repo/global. Source/test trước-sau và giới hạn ở từng báo cáo;13 reports và evidence đủ. Không cho rằng skill usage hay export đồng nghĩa real runtime/Backend pass.

Nguồn: [Expo SDK58 runtime/streaming](https://docs.expo.dev/versions/v58.0.0/sdk/expo/), [Expo SDK58 notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/), [llms index](https://docs.expo.dev/llms.txt).
